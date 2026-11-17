/**
 * Runnable blocks in the browser. Each `[data-run]` block arrives with its
 * output already rendered (src/site/runnable.ts for the docs, the tour on
 * the homepage); this script only shows the "Run live" toggles. Turning one
 * on loads the playground's editor and engine (src/live.ts) for the first
 * time on the page, turns the block's source into an editor and its output
 * into the live result, which follows each edit. Turning it off stops
 * evaluating and leaves the last output. "Open in the playground" follows
 * the edits too.
 *
 * Block markup: `[data-run]` with `data-source` and `data-format`, holding
 * `[data-run-src]` (the source), `[data-run-out]` (the output), a
 * `[data-run-btn]` toggle (`aria-pressed`) and a `[data-run-link]` link.
 */
import type { EvalResult, LiveEditor } from "../live";

const live = new WeakMap<HTMLElement, Promise<LiveEditor>>();

function show(out: HTMLElement, result: EvalResult): void {
  const pre = document.createElement("pre");
  pre.className = "gg-run-live";
  if (result.success) {
    pre.textContent = (result.output ?? "").replace(/^---\n/, "").replace(/\n+$/, "");
  } else {
    pre.classList.add("err");
    const notes = result.error?.notes ?? [];
    pre.textContent = [result.error?.message ?? "evaluation failed", ...notes].join("\n");
  }
  const head = document.createElement("span");
  head.className = "gg-run-oh";
  head.textContent = result.success ? "output" : "error";
  out.replaceChildren(head, pre);
  out.classList.toggle("failed", !result.success);
}

async function mount(block: HTMLElement): Promise<LiveEditor> {
  const [{ mountLiveEditor }, { encodeState }] = await Promise.all([import("../live"), import("../share")]);
  const src = block.querySelector<HTMLElement>("[data-run-src]")!;
  const out = block.querySelector<HTMLElement>("[data-run-out]")!;
  const link = block.querySelector<HTMLAnchorElement>("[data-run-link]");
  const format = block.dataset.format ?? "yaml";
  const editor = await mountLiveEditor(src, {
    source: block.dataset.source ?? "",
    format,
    onOutput(result, source) {
      show(out, result);
      if (link) void encodeState({ source, format, mode: "unit" }).then((h) => (link.href = `/play/#${h}`));
    },
  });
  block.classList.add("live");
  return editor;
}

/** The button's visible label, which is also its accessible name. */
function label(button: HTMLButtonElement, text: string): void {
  button.querySelector<HTMLElement>(".lbl")!.textContent = text;
}

/**
 * "Run live" is a toggle. The first press loads the editor and engine and
 * turns the block live; a second turns live mode off, leaving the source
 * read-only and the last output showing; a third turns it on again.
 */
async function onToggle(block: HTMLElement, button: HTMLButtonElement): Promise<void> {
  if (button.getAttribute("aria-busy") === "true") return;
  let editor = live.get(block);
  if (editor) {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    block.classList.toggle("live", on);
    (await editor).setLive(on);
    return;
  }
  button.setAttribute("aria-busy", "true");
  label(button, "Loading…");
  editor = mount(block);
  live.set(block, editor);
  try {
    const ed = await editor;
    button.setAttribute("aria-pressed", "true");
    ed.run();
    label(button, "Run live");
  } catch (e) {
    live.delete(block);
    label(button, "Could not load the engine");
    console.error(e);
  } finally {
    button.removeAttribute("aria-busy");
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-run] [data-run-btn]")) {
  button.hidden = false;
  button.addEventListener("click", () => void onToggle(button.closest<HTMLElement>("[data-run]")!, button));
}
