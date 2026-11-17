/**
 * The homepage hero editor in the browser. Its markup, from
 * src/components/HeroEditor.astro, carries every example's output in each
 * format, rendered at build time, so the picker and the format buttons
 * work with no engine at all.
 *
 * The live stage: on idle, or as soon as the reader focuses or clicks the
 * source, the playground's editor and engine (src/live.ts) load and the
 * shown example's source becomes an editor. Each edit re-evaluates it
 * (debounced; the engine has its own step limit), and the output pane
 * switches in place to the live result. An example whose source has not
 * been edited keeps its pre-rendered output.
 */
import type { EvalResult, LiveEditor } from "../live";
import { formatDiagnostic } from "../diagnostic";

const root = document.querySelector<HTMLElement>(".gg-hero-ed");

/** Each example's live editor, once it has one. */
const live = new Map<string, Promise<LiveEditor>>();
let loader: Promise<typeof import("../live")> | null = null;
const loadLive = () => (loader ??= import("../live"));

const pane = (id: string) => root!.querySelector<HTMLElement>(`[data-for="${id}"]`)!;

/** Show the current example and format, pre-rendered or live. */
function show(): void {
  const ex = root!.dataset.example!;
  const fmt = root!.dataset.format!;
  for (const tab of root!.querySelectorAll<HTMLElement>("[data-pick]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.pick === ex));
  }
  for (const p of root!.querySelectorAll<HTMLElement>("[data-for]")) {
    p.hidden = p.dataset.for !== ex;
    render(p, fmt);
  }
}

/** Render one example's output pane for `fmt`. */
function render(p: HTMLElement, fmt: string): void {
  const state = current.get(p.dataset.for!);
  const edited = state !== undefined && state.source !== p.dataset.source;
  const failed = edited ? !state.result?.success : p.dataset.fails !== undefined;
  for (const el of p.querySelectorAll<HTMLElement>("[data-out]")) el.hidden = edited || el.dataset.out !== fmt;
  const diag = p.querySelector<HTMLElement>(".ed-diag[data-static]");
  if (diag) diag.hidden = edited;
  const out = p.querySelector<HTMLElement>("[data-live]")!;
  out.hidden = !edited;
  if (edited && state.result) {
    const r = state.result;
    out.classList.toggle("err", !r.success);
    out.textContent = r.success
      ? (r.output ?? "").replace(/^---\n/, "").replace(/\n+$/, "")
      : formatDiagnostic(r.error ?? { message: "evaluation failed" }, p.dataset.file!, state.source);
  }
  p.querySelector<HTMLElement>("[data-label]")!.textContent = failed ? "Error" : "Output";
  for (const b of p.querySelectorAll<HTMLButtonElement>("[data-fmt]")) {
    b.setAttribute("aria-pressed", String(b.dataset.fmt === fmt));
    b.disabled = failed;
  }
  const cmd = p.querySelector<HTMLElement>(`[data-fmt="${fmt}"]`)?.dataset.command ?? "eu";
  p.querySelector<HTMLElement>("[data-cmd]")!.textContent = `${cmd} ${p.dataset.file}`;
}

/** The last source and result of each example that has gone live. */
const current = new Map<string, { source: string; result: EvalResult | null }>();

/** The foot's status: loading, or the "Live" mark (as on "Run live" when on). */
function setState(p: HTMLElement, text: string, live = false): void {
  const s = p.querySelector<HTMLElement>("[data-state]");
  if (!s) return;
  s.textContent = text;
  s.classList.toggle("gg-live-mark", live);
  if (live) s.title = "Edits re-run as you type";
  else s.removeAttribute("title");
}

/** Mount the live editor over one example's source; once per example. */
function goLive(p: HTMLElement, focus: boolean): Promise<LiveEditor> {
  const id = p.dataset.for!;
  let entry = live.get(id);
  if (!entry) {
    setState(p, "Loading engine…");
    entry = (async () => {
      const [{ mountLiveEditor }, { encodeState }] = await Promise.all([loadLive(), import("../share")]);
      const link = p.querySelector<HTMLAnchorElement>("[data-link]");
      current.set(id, { source: p.dataset.source!, result: null });
      const editor = await mountLiveEditor(p.querySelector<HTMLElement>("[data-src]")!, {
        source: p.dataset.source!,
        format: root!.dataset.format!,
        wrap: true,
        onOutput(result, source) {
          current.set(id, { source, result });
          render(p, root!.dataset.format!);
          if (link) void encodeState({ source, format: "yaml", mode: "unit" }).then((h) => (link.href = `/play/#${h}`));
        },
      });
      p.querySelector<HTMLElement>("[data-src]")!.removeAttribute("tabindex");
      setState(p, "Live", true);
      return editor;
    })();
    entry.catch(() => {
      live.delete(id);
      setState(p, "");
    });
    live.set(id, entry);
  }
  if (focus) void entry.then((editor) => editor.view.focus());
  return entry;
}

if (root) {
  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>("[data-pick]");
    const fmt = target.closest<HTMLButtonElement>("[data-fmt]");
    if (pick) root.dataset.example = pick.dataset.pick;
    if (fmt && !fmt.disabled) {
      root.dataset.format = fmt.dataset.fmt;
      // Live editors evaluate in the new format; an edited one shows it.
      for (const editor of live.values()) void editor.then((ed) => ed.setFormat(fmt.dataset.fmt!));
    }
    if (pick || fmt) show();
    // The shown example goes live when picked, once the engine has loaded.
    if (pick && loader) void goLive(pane(root.dataset.example!), false);
  });
  // The first edit: focus or click on a pre-rendered source.
  root.addEventListener("focusin", (e) => {
    const src = (e.target as HTMLElement).closest<HTMLElement>("[data-src][tabindex]");
    if (src) void goLive(src.closest<HTMLElement>("[data-for]")!, true);
  });
  // Or on idle, without taking focus.
  const start = () => void goLive(pane(root.dataset.example!), false);
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}
