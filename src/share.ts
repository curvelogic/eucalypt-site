/** URL sharing — encode/decode playground state in the URL hash. */

export interface PlaygroundState {
  source: string;
  format: string;
  mode?: "unit" | "expr";
}

export function encodeState(state: PlaygroundState): string {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeState(hash: string): PlaygroundState | null {
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    const obj = JSON.parse(json) as unknown;
    if (
      typeof obj === "object" &&
      obj !== null &&
      "source" in obj &&
      "format" in obj &&
      typeof (obj as Record<string, unknown>).source === "string" &&
      typeof (obj as Record<string, unknown>).format === "string"
    ) {
      return obj as PlaygroundState;
    }
    return null;
  } catch {
    return null;
  }
}

export function readStateFromUrl(): PlaygroundState | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  return decodeState(hash);
}

export function writeStateToUrl(state: PlaygroundState): void {
  window.location.hash = encodeState(state);
}

export async function copyShareLink(state: PlaygroundState): Promise<void> {
  writeStateToUrl(state);
  const url = window.location.href;
  await navigator.clipboard.writeText(url);
}
