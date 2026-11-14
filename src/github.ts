/**
 * Read-only views of eucalypt files in public GitHub repositories.
 *
 * A link `#gh=<owner>/<repo>/<ref>/<path.eu>` shows that file highlighted
 * and read-only, with a link back to its source. `&L5` or `&L5-L12` after
 * the path picks out lines. The ref is a branch, tag or commit without a
 * `/`. These files are shown, never run.
 */

export interface LineRange {
  start: number;
  end: number;
}

export interface GitHubFile {
  owner: string;
  repo: string;
  ref: string;
  /** The path within the repository, without a leading `/`. */
  path: string;
  lines: LineRange | null;
}

/** Files larger than this are not fetched. */
export const MAX_BYTES = 1024 * 1024;

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._-]{1,250}$/;
const SEGMENT = /^[^/\\]+$/;

/** Parse the part of the hash after `gh=`; null if it is not a valid link. */
export function parseGitHubLink(spec: string): GitHubFile | null {
  let lines: LineRange | null = null;
  const amp = spec.indexOf("&");
  let target = spec;
  if (amp >= 0) {
    target = spec.slice(0, amp);
    const m = /^L(\d+)(?:-L?(\d+))?$/.exec(spec.slice(amp + 1));
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b < 1) return null;
    lines = { start: Math.min(a, b), end: Math.max(a, b) };
  }
  let decoded: string[];
  try {
    decoded = target.split("/").map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const [owner, repo, ref, ...rest] = decoded;
  if (rest.length === 0) return null;
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === "." || repo === "..") return null;
  if (!REF.test(ref) || ref.includes("..")) return null;
  if (!rest.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) return null;
  const path = rest.join("/");
  if (!path.endsWith(".eu")) return null;
  return { owner, repo, ref, path, lines };
}

const encodePath = (f: GitHubFile): string =>
  [f.owner, f.repo, f.ref, ...f.path.split("/")].map(encodeURIComponent).join("/");

const lineSuffix = (lines: LineRange | null, sep: string): string =>
  !lines ? "" : lines.start === lines.end ? `${sep}L${lines.start}` : `${sep}L${lines.start}-L${lines.end}`;

/** The hash (without `#`) that links to `file`. */
export function gitHubHash(file: GitHubFile): string {
  return "gh=" + encodePath(file) + lineSuffix(file.lines, "&");
}

/** Where the file's content is fetched from. */
export function rawUrl(file: GitHubFile): string {
  return "https://raw.githubusercontent.com/" + encodePath(file);
}

/** The file's page on GitHub, at its picked lines. */
export function sourceUrl(file: GitHubFile): string {
  const [owner, repo, ref, ...path] = encodePath(file).split("/");
  return `https://github.com/${owner}/${repo}/blob/${ref}/${path.join("/")}` + lineSuffix(file.lines, "#");
}

/** Fetch the file's text, with an error a reader can act on. */
export async function fetchGitHubFile(file: GitHubFile, fetchFn: typeof fetch = fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchFn(rawUrl(file));
  } catch (e) {
    throw new Error(`Could not reach raw.githubusercontent.com: ${String(e)}`);
  }
  if (response.status === 404) {
    throw new Error(
      `${file.path} was not found at ${file.ref} in ${file.owner}/${file.repo}. ` +
        "Only files in public repositories can be shown.",
    );
  }
  if (!response.ok) throw new Error(`Fetching ${file.path} failed: HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) throw new Error(`${file.path} is larger than ${MAX_BYTES} bytes`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error(`${file.path} is larger than ${MAX_BYTES} bytes`);
  return text;
}
