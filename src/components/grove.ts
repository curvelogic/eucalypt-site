/**
 * The grove: ghost-gum trunks that lean, bow and taper, fork into limbs
 * with leaf clusters, and carry grey and salmon patches where the bark
 * sheds, with leaves along the top. Flat fills from four tokens (--gg-trunk,
 * --gg-trunk-edge, --gg-patch, --gg-canopy), so it follows the theme.
 *
 * Drawn once, at build time, from a fixed seed: the same picture on every
 * page and every build, and no image request.
 */

const W = 1440;
const H = 1000;
const LEAF = "M0 0C2-18 14-34 34-38C33-19 20-3 0 0Z";

function rng(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Pt = [number, number];
const f = (n: number) => n.toFixed(1);

/** Catmull-Rom through points, as cubic path segments. */
function smooth(pts: Pt[]): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** A tapering, gently wobbling limb from (x0, y0) to (x1, y1). */
function limb(r: () => number, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, bend: number): string {
  const N = 10;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const ph = r() * 6;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const cx = x0 + dx * t + Math.sin(t * Math.PI) * bend + Math.sin(ph + t * 7) * w0 * 0.12;
    const cy = y0 + dy * t;
    const ww = ((w0 + (w1 - w0) * t) * (1 + 0.07 * Math.sin(ph * 2 + t * 11))) / 2;
    L.push([cx + nx * ww, cy + ny * ww]);
    R.push([cx - nx * ww, cy - ny * ww]);
  }
  R.reverse();
  return `M${f(L[0][0])} ${f(L[0][1])}${smooth(L)}L${f(R[0][0])} ${f(R[0][1])}${smooth(R)}Z`;
}

function blob(r: () => number, cx: number, cy: number, rx: number, ry: number): string {
  const pts: Pt[] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const s = 0.7 + r() * 0.5;
    pts.push([cx + Math.cos(a) * rx * s, cy + Math.sin(a) * ry * s]);
  }
  pts.push(pts[0], pts[1]);
  return `M${f(pts[0][0])} ${f(pts[0][1])}${smooth(pts).replace(/C[^C]*$/, "")}Z`;
}

/** The grove's SVG markup. */
export function groveSvg(): string {
  const r = rng(23);
  // [base x, base width, top width, lean, bow, opacity]
  const trunks: number[][] = [
    [56, 120, 46, 70, -60, 1],
    [268, 46, 20, 40, 50, 0.85],
    [640, 26, 12, -40, 30, 0.5],
    [1010, 34, 16, 60, -40, 0.6],
    [1214, 150, 58, -90, 70, 1],
    [1400, 70, 30, -50, -40, 0.9],
  ];
  let out = "";
  for (const [x, wb, wt, lean, bow, a] of trunks) {
    const xt = x + lean;
    out += `<g opacity="${a}"><path d="${limb(r, x, H + 20, xt, -20, wb, wt, bow)}" fill="var(--gg-trunk)"/>`;
    const forks = wb > 60 ? 3 : wb > 30 ? 2 : 1;
    for (let k = 0; k < forks; k++) {
      const t = 0.55 + k * 0.14 + r() * 0.08;
      const by = H - (H + 20) * t;
      const bx = x + (xt - x) * t + Math.sin(t * Math.PI) * bow;
      const dir = (k % 2 ? -1 : 1) * (x < W / 2 ? 1 : -1) * (r() < 0.25 ? -1 : 1);
      const bw = Math.max(8, (wb + (wt - wb) * t) * 0.55);
      const ex = bx + dir * (120 + r() * 200);
      const ey = Math.max(-20, by - (260 + r() * 420));
      out += `<path d="${limb(r, bx, by + bw, ex, ey, bw, 3, dir * 30)}" fill="var(--gg-trunk)"/>`;
      if (ey > -10) {
        for (let j = 0; j < 6; j++) {
          const lx = ex + (r() - 0.5) * 90;
          const ly = ey + (r() - 0.2) * 70;
          out += `<path d="${LEAF}" transform="translate(${f(lx)} ${f(ly)}) rotate(${(100 + r() * 70).toFixed(0)}) scale(${(0.9 + r() * 0.8).toFixed(2)})" fill="var(--gg-canopy)"/>`;
        }
      }
    }
    for (let i = 0; i < 10; i++) {
      const t = 0.04 + r() * 0.9;
      const yy = H - (H + 20) * t;
      const cx = x + (xt - x) * t + Math.sin(t * Math.PI) * bow + (r() - 0.5) * wt * 0.4;
      const ww = wb + (wt - wb) * t;
      out += `<path d="${blob(r, cx, yy, ww * (0.18 + r() * 0.14), 18 + r() * 60)}" fill="${r() < 0.45 ? "var(--gg-patch)" : "var(--gg-trunk-edge)"}"/>`;
    }
    out += "</g>";
  }
  for (let i = 0; i < 54; i++) {
    const lx = r() * W;
    const ly = r() * r() * 420 - 10;
    out += `<path d="${LEAF}" transform="translate(${f(lx)} ${f(ly)}) rotate(${(95 + r() * 80).toFixed(0)}) scale(${(0.9 + r() * 1.1).toFixed(2)})" fill="var(--gg-canopy)"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${out}</svg>`;
}
