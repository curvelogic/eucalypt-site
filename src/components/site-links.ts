/** The site's links, in the header on every surface and in its mobile menus. */
export type SiteLinkId = "docs" | "play" | "prelude" | "install";

export const SITE_LINKS: { id: SiteLinkId; label: string; href: string; note: string }[] = [
  { id: "docs", label: "Docs", href: "/docs/", note: "guide, reference" },
  { id: "play", label: "Playground", href: "/play/", note: "/play" },
  { id: "prelude", label: "Prelude", href: "/docs/reference/prelude/", note: "reference" },
  { id: "install", label: "Install", href: "/docs/welcome/quick-start/", note: "quick start" },
];

export const GITHUB = "https://github.com/curvelogic/eucalypt";
export const INSTALL_LINE = "brew install curvelogic/homebrew-tap/eucalypt";
