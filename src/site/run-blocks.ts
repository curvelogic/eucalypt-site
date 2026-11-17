/**
 * Runnable blocks in the browser. Each `[data-run]` block arrives with its
 * output already rendered (src/site/runnable.ts for the docs, the tour on
 * the homepage); this script only shows the Run buttons. Pressing one loads
 * the playground's editor and engine (src/live.ts) for the first time on
 * the page, turns the block's source into an editor and its output into the
 * live result, which follows each edit. "Open in the playground" follows
 * the edits too.
 *
 * Block markup: `[data-run]` with `data-source` and `data-format`, holding
 * `[data-run-src]` (the source), `[data-run-out]` (the output), a
 * `[data-run-btn]` button and a `[data-run-link]` link.
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

async function onRun(block: HTMLElement, button: HTMLButtonElement): Promise<void> {
  let editor = live.get(block);
  if (!editor) {
    button.disabled = true;
    button.textContent = "Loading…";
    editor = mount(block);
    live.set(block, editor);
    try {
      const ed = await editor;
      ed.run();
      ed.view.focus();
    } catch (e) {
      live.delete(block);
      button.textContent = "Could not load the engine";
      console.error(e);
      return;
    } finally {
      button.disabled = false;
    }
    button.textContent = "▶ Run";
    return;
  }
  (await editor).run();
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-run] [data-run-btn]")) {
  button.hidden = false;
  button.addEventListener("click", () => void onRun(button.closest<HTMLElement>("[data-run]")!, button));
}
