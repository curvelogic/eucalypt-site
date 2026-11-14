import { describe, expect, it } from "vitest";
import { decodeState, encodeState } from "../src/share";

describe("share links", () => {
  const state = { source: "greeting: \"héllo ✓\"\n".repeat(50), format: "yaml", mode: "unit" as const };

  it("round-trips compressed state", async () => {
    const hash = await encodeState(state);
    expect(hash).toMatch(/^z=[A-Za-z0-9_-]+$/);
    await expect(decodeState(hash)).resolves.toEqual(state);
  });

  it("is shorter than the uncompressed encoding", async () => {
    const legacy = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    expect((await encodeState(state)).length).toBeLessThan(legacy.length / 4);
  });

  it("still reads links from before compression", async () => {
    const legacy = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    await expect(decodeState(legacy)).resolves.toEqual(state);
  });

  it.each(["z=!!!", "z=AAAA", "bm90IGpzb24", btoa('{"source":1,"format":"yaml"}'), btoa('{"source":"","format":"yaml","mode":"x"}')])(
    "rejects %s",
    async (hash) => {
      await expect(decodeState(hash)).resolves.toBeNull();
    },
  );
});
