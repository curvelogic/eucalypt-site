/**
 * URL sharing — playground state in the URL hash.
 *
 * Links are written as `#z=<data>`: the state as JSON, compressed with
 * raw DEFLATE and encoded as unpadded base64url. Links from before
 * compression (`#<base64 JSON>`) are still read.
 */

export interface PlaygroundState {
  source: string;
  format: string;
  mode?: "unit" | "expr";
}

const PREFIX = "z=";

/** A shared state larger than this, decompressed, is refused. */
export const MAX_STATE_BYTES = 4 * 1024 * 1024;

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Pipe `bytes` through `stream`, refusing output over MAX_STATE_BYTES. */
async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_STATE_BYTES) {
      await reader.cancel();
      throw new Error("shared state is too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function validState(obj: unknown): PlaygroundState | null {
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.source !== "string" || typeof o.format !== "string") return null;
  if (o.mode !== undefined && o.mode !== "unit" && o.mode !== "expr") return null;
  return { source: o.source, format: o.format, ...(o.mode ? { mode: o.mode } : {}) };
}

/** The hash (without `#`) for `state`. */
export async function encodeState(state: PlaygroundState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** Decode a hash (without `#`), compressed or legacy; null if it is not one. */
export async function decodeState(hash: string): Promise<PlaygroundState | null> {
  try {
    let json: string;
    if (hash.startsWith(PREFIX)) {
      const bytes = await pipe(fromBase64Url(hash.slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
      json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } else {
      json = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(hash));
    }
    return validState(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function writeStateToUrl(state: PlaygroundState): Promise<void> {
  history.replaceState(null, "", "#" + (await encodeState(state)));
}

export async function copyShareLink(state: PlaygroundState): Promise<string> {
  await writeStateToUrl(state);
  const url = window.location.href;
  await navigator.clipboard.writeText(url);
  return url;
}
