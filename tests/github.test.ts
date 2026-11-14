import { describe, expect, it } from "vitest";
import { fetchGitHubFile, gitHubHash, parseGitHubLink, rawUrl, sourceUrl } from "../src/github";

describe("parseGitHubLink", () => {
  it("parses owner, repo, ref and path", () => {
    expect(parseGitHubLink("curvelogic/eucalypt/master/examples/aoc25/day01.eu")).toEqual({
      owner: "curvelogic",
      repo: "eucalypt",
      ref: "master",
      path: "examples/aoc25/day01.eu",
      lines: null,
    });
  });

  it("parses a line and a line range", () => {
    expect(parseGitHubLink("o/r/v1.0/a.eu&L7")?.lines).toEqual({ start: 7, end: 7 });
    expect(parseGitHubLink("o/r/v1.0/a.eu&L9-L3")?.lines).toEqual({ start: 3, end: 9 });
    expect(parseGitHubLink("o/r/v1.0/a.eu&L3-9")?.lines).toEqual({ start: 3, end: 9 });
  });

  it.each([
    "o/r/main",
    "o/r/main/a.yaml",
    "o/r/main/../a.eu",
    "o/r/ma..in/a.eu",
    "o/../main/a.eu",
    "-o/r/main/a.eu",
    "o/r/main/a.eu&L0",
    "o/r/main/a.eu&lines",
    "o/r/main/%2e%2e/a.eu",
    "o/r/main/a%2Fb.eu",
    "o/r/main/%E0%A4%A.eu",
  ])("rejects %s", (spec) => {
    expect(parseGitHubLink(spec)).toBeNull();
  });

  it("round-trips through its hash", () => {
    const f = parseGitHubLink("o/r/abc123/dir/my%20file.eu&L2-L4")!;
    expect(f.path).toBe("dir/my file.eu");
    expect(gitHubHash(f)).toBe("gh=o/r/abc123/dir/my%20file.eu&L2-L4");
    expect(parseGitHubLink(gitHubHash(f).slice(3))).toEqual(f);
  });

  it("builds the raw and source URLs", () => {
    const f = parseGitHubLink("o/r/main/d/a.eu&L5")!;
    expect(rawUrl(f)).toBe("https://raw.githubusercontent.com/o/r/main/d/a.eu");
    expect(sourceUrl(f)).toBe("https://github.com/o/r/blob/main/d/a.eu#L5");
    expect(sourceUrl({ ...f, lines: { start: 2, end: 8 } })).toBe("https://github.com/o/r/blob/main/d/a.eu#L2-L8");
  });
});

describe("fetchGitHubFile", () => {
  const file = parseGitHubLink("o/r/main/a.eu")!;
  const respond = (body: string, status = 200) => (async () => new Response(body, { status })) as typeof fetch;

  it("returns the text", async () => {
    await expect(fetchGitHubFile(file, respond("x: 1"))).resolves.toBe("x: 1");
  });

  it("explains a 404", async () => {
    await expect(fetchGitHubFile(file, respond("", 404))).rejects.toThrow(/public repositories/);
  });

  it("rejects an oversized file", async () => {
    await expect(fetchGitHubFile(file, respond("x".repeat(1024 * 1024 + 1)))).rejects.toThrow(/larger/);
  });
});
