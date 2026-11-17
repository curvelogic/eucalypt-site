import { describe, expect, it } from "vitest";
import { docsFiles, docsMapping, playFiles, redirectPage, SITE } from "../scripts/old-site-redirects.mjs";

const redirects = {
  "index.html": "/docs/",
  "guide/anaphora.html": "/docs/guide/anaphora/",
  "appendices/migration.html": "/docs/appendices/migration/",
};

describe("old docs redirects", () => {
  it("maps each old page to its new page", () => {
    const map = docsMapping(redirects);
    expect(map["index.html"]).toBe(`${SITE}/docs/`);
    expect(map["guide/anaphora.html"]).toBe(`${SITE}/docs/guide/anaphora/`);
  });

  it("sends retired pages and old pages with no new equivalent to /docs/", () => {
    const map = docsMapping(redirects, ["print.html", "toc.html", "404.html", "searchindex.js"]);
    expect(map["appendices/migration.html"]).toBe(`${SITE}/docs/`);
    expect(map["print.html"]).toBe(`${SITE}/docs/`);
    expect(map["toc.html"]).toBe(`${SITE}/docs/`);
    expect(map).not.toHaveProperty("404.html");
    expect(map).not.toHaveProperty("searchindex.js");
  });

  it("writes a page per old path, a 404 that maps by script, and .nojekyll", () => {
    const files = docsFiles(redirects, ["print.html"]);
    expect(Object.keys(files).sort()).toEqual(
      [".nojekyll", "404.html", "appendices/migration.html", "guide/anaphora.html", "index.html", "print.html"].sort(),
    );
    expect(files["404.html"]).toContain(`"guide/anaphora.html":"${SITE}/docs/guide/anaphora/"`);
  });

  it("replaces the old llms.txt files with a note of their new place, and drops other files", () => {
    const files = docsFiles(redirects, ["llms.txt", "searchindex.js", "superpowers/x.txt"]);
    expect(files["llms.txt"]).toContain("https://github.com/curvelogic/eucalypt/blob/master/docs/llms.txt");
    expect(files).not.toHaveProperty("searchindex.js");
    expect(files).not.toHaveProperty("superpowers/x.txt");
  });
});

describe("redirect page", () => {
  const page = redirectPage(`${SITE}/docs/guide/anaphora/`, "Moved");
  it("has a canonical link, a meta refresh and a visible link", () => {
    expect(page).toContain(`<link rel="canonical" href="${SITE}/docs/guide/anaphora/">`);
    expect(page).toContain(`<meta http-equiv="refresh" content="0; url=${SITE}/docs/guide/anaphora/">`);
    expect(page).toContain(`<a href="${SITE}/docs/guide/anaphora/">`);
  });
  it("forwards by script first, keeping the fragment", () => {
    expect(page.indexOf("location.hash")).toBeLessThan(page.indexOf("http-equiv"));
  });
});

describe("old playground", () => {
  it("forwards index and 404 to /play/", () => {
    const files = playFiles();
    expect(files["index.html"]).toContain(`location.replace("${SITE}/play/" + location.hash)`);
    expect(files["404.html"]).toBe(files["index.html"]);
  });
});
