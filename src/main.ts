/**
 * Eucalypt Playground — entry point.
 *
 * Wires together the editor, evaluator, examples, and sharing; or, for a
 * `#gh=` link, a read-only view of a repository file.
 */

import "../styles/playground.css";
import "../vendor/highlight.css";
import engine from "../vendor/eucalypt.json";
import { initEvaluator, run, runExpr, getFormats } from "./evaluator";
import { createEditor, createViewer } from "./editor";
import { createOutputView, type OutputView } from "./output";
import { EXAMPLES } from "./examples";
import { decodeState, writeStateToUrl, copyShareLink } from "./share";
import { fetchGitHubFile, gitHubHash, parseGitHubLink, sourceUrl, type GitHubFile } from "./github";
import { loadHighlighter } from "./highlight/browser";
import { EditorView } from "@codemirror/view";

// ── DOM references ────────────────────────────────────────────────────────────

const loadingOverlay = document.getElementById("loading-overlay")!;
const editorContainer = document.getElementById("editor-container")!;
const outputEl = document.getElementById("output")!;
const errorPanel = document.getElementById("error-panel")!;
const problemsCount = document.getElementById("problems-count")!;
const outputLabel = document.getElementById("output-label")!;
const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
const engineState = document.getElementById("engine-state")!;
const errorMessage = document.getElementById("error-message")!;
const errorNotes = document.getElementById("error-notes")!;
const statusIndicator = document.getElementById("status-indicator")!;
const runBtn = document.getElementById("run-btn")! as HTMLButtonElement;
const shareBtn = document.getElementById("share-btn")! as HTMLButtonElement;
const formatTabs = document.getElementById("format-tabs")!;
const exampleSelect = document.getElementById("example-select") as HTMLSelectElement;
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;

// ── State ─────────────────────────────────────────────────────────────────────

let editor: EditorView | null = null;
let output: OutputView | null = null;
let isRunning = false;
let format = "yaml";

/** File extensions for the output tab's name. */
const EXTENSIONS: Record<string, string> = { text: "txt" };

function setFormat(f: string): void {
  format = f;
  for (const tab of formatTabs.querySelectorAll<HTMLButtonElement>("[data-fmt]")) {
    tab.setAttribute("aria-checked", String(tab.dataset.fmt === f));
  }
}

function getSource(): string {
  return editor?.state.doc.toString() ?? "";
}

function setSource(source: string): void {
  if (!editor) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: source },
  });
}

function getMode(): "unit" | "expr" {
  return modeSelect?.value === "expr" ? "expr" : "unit";
}

// ── Evaluation ────────────────────────────────────────────────────────────────

function runCode(): void {
  if (isRunning) return;
  isRunning = true;
  runBtn.disabled = true;
  statusIndicator.textContent = "";
  statusIndicator.className = "";

  const source = getSource();
  const mode = getMode();
  outputLabel.textContent = `output.${EXTENSIONS[format] ?? format}`;

  // Persist state in URL
  void writeStateToUrl({ source, format, mode });

  // Run synchronously (WASM is sync)
  try {
    const result = mode === "expr" ? runExpr(source, format) : run(source, format);
    if (result.success && result.output !== undefined) {
      output?.show(result.output, format);
      outputEl.classList.remove("hidden");
      showProblems(null);
      statusIndicator.textContent = "✓";
      statusIndicator.className = "success";
    } else if (result.error) {
      output?.show("", format);
      outputEl.classList.add("hidden");
      showProblems(result.error.message, result.error.notes ?? []);
      statusIndicator.textContent = "✗";
      statusIndicator.className = "error";
    }
  } catch (e) {
    output?.show("", format);
    outputEl.classList.add("hidden");
    showProblems(String(e));
    statusIndicator.textContent = "✗";
    statusIndicator.className = "error";
  }

  isRunning = false;
  runBtn.disabled = false;
}

/** Show an error and its notes in the problems panel, or clear it. */
function showProblems(message: string | null, notes: string[] = []): void {
  document.body.classList.toggle("has-problems", message !== null);
  errorPanel.classList.toggle("hidden", message === null);
  problemsCount.textContent = message === null ? "No problems" : "1 error";
  errorMessage.textContent = message ?? "";
  errorNotes.textContent = notes.join("\n");
  errorNotes.style.display = notes.length ? "block" : "none";
}

// ── Examples ──────────────────────────────────────────────────────────────────

function populateExamples(): void {
  for (const example of EXAMPLES) {
    const option = document.createElement("option");
    option.value = example.name;
    option.textContent = example.name;
    exampleSelect.appendChild(option);
  }

  exampleSelect.addEventListener("change", () => {
    const name = exampleSelect.value;
    if (!name) return;
    const example = EXAMPLES.find((e) => e.name === name);
    if (example) {
      setSource(example.source);
      setFormat(example.format);
      modeSelect.value = example.mode ?? "unit";
      runCode();
    }
    exampleSelect.value = "";
  });
}

// ── Format selector ───────────────────────────────────────────────────────────

/** One tab per format the engine offers; choosing one runs the code in it. */
function populateFormats(): void {
  formatTabs.replaceChildren(
    ...getFormats().map((fmt) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "fmt";
      tab.setAttribute("role", "radio");
      tab.dataset.fmt = fmt;
      tab.textContent = fmt.toUpperCase();
      tab.addEventListener("click", () => {
        setFormat(fmt);
        runCode();
      });
      return tab;
    }),
  );
  setFormat("yaml");
}

// ── Share ─────────────────────────────────────────────────────────────────────

shareBtn.addEventListener("click", async () => {
  try {
    await copyShareLink({ source: getSource(), format, mode: getMode() });
    shareBtn.textContent = "Copied!";
  } catch {
    shareBtn.textContent = "Link in address bar";
  }
  setTimeout(() => {
    shareBtn.textContent = "Share";
  }, 2000);
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output?.view.state.doc.toString() ?? "");
    copyBtn.textContent = "Copied!";
  } catch {
    copyBtn.textContent = "Not copied";
  }
  setTimeout(() => {
    copyBtn.textContent = "Copy";
  }, 2000);
});

// ── Engine version ────────────────────────────────────────────────────────────

function showEngineVersion(): void {
  const el = document.getElementById("engine-version") as HTMLAnchorElement;
  el.textContent = `eucalypt ${engine.version} (${engine.commit.slice(0, 7)})`;
  el.href = `https://github.com/${engine.repository}/tree/${engine.commit}`;
  el.title = `Engine and grammar ${engine.grammar_version} built from ${engine.repository} at ${engine.commit}`;
}

// ── Repository file view ──────────────────────────────────────────────────────

async function initViewer(file: GitHubFile): Promise<void> {
  document.body.classList.add("viewing");
  const title = document.getElementById("view-title")!;
  const source = document.getElementById("view-source") as HTMLAnchorElement;
  const errorEl = document.getElementById("view-error")!;
  title.textContent = `${file.owner}/${file.repo} · ${file.ref} · ${file.path}`;
  source.href = sourceUrl(file);
  document.title = `${file.path} · Eucalypt Playground`;
  try {
    engineState.textContent = "Read-only";
    const [highlighter, text] = await Promise.all([loadHighlighter(), fetchGitHubFile(file)]);
    createViewer(editorContainer, text, highlighter, file.lines, (lines) => {
      const picked = { ...file, lines };
      history.replaceState(null, "", "#" + gitHubHash(picked));
      source.href = sourceUrl(picked);
    });
  } catch (e) {
    errorEl.textContent = e instanceof Error ? e.message : String(e);
    errorEl.classList.remove("hidden");
  }
  loadingOverlay.style.display = "none";
}

// ── Initialisation ────────────────────────────────────────────────────────────

async function initPlayground(hash: string): Promise<void> {
  // URL hash takes precedence over the default example
  const urlState = hash ? await decodeState(hash) : null;
  const initialExample = EXAMPLES[0];
  const initialSource = urlState?.source ?? initialExample.source;
  const initialFormat = urlState?.format ?? initialExample.format;
  const initialMode = urlState?.mode ?? initialExample.mode ?? "unit";

  // Without highlighting the playground still edits and runs code.
  const [highlighter] = await Promise.all([
    loadHighlighter().catch((e) => {
      console.error("Highlighting unavailable:", e);
      return null;
    }),
    initEvaluator(),
  ]);
  editor = createEditor(editorContainer, initialSource, highlighter, runCode);
  output = createOutputView(outputEl);
  runBtn.addEventListener("click", runCode);

  populateFormats();
  populateExamples();
  setFormat(initialFormat);
  modeSelect.value = initialMode;
  if (/Mac|iPhone|iPad/.test(navigator.platform)) document.getElementById("run-key")!.textContent = "⌘↵";
  engineState.textContent = "Engine ready";
  engineState.className = "ready";

  loadingOverlay.style.display = "none";

  // Open with the output already there, as the design has it.
  runCode();
}

async function init(): Promise<void> {
  showEngineVersion();
  const hash = window.location.hash.slice(1);
  // A link pasted into the address bar replaces the page's content.
  window.addEventListener("hashchange", () => window.location.reload());
  if (hash.startsWith("gh=")) {
    const file = parseGitHubLink(hash.slice(3));
    if (file) return initViewer(file);
    document.body.classList.add("viewing");
    const errorEl = document.getElementById("view-error")!;
    errorEl.textContent =
      "This link is not a valid repository file link. The form is #gh=<owner>/<repo>/<ref>/<path>.eu, " +
      "optionally followed by &L<n> or &L<n>-L<m>.";
    errorEl.classList.remove("hidden");
    loadingOverlay.style.display = "none";
    return;
  }
  return initPlayground(hash);
}

init().catch((err) => {
  console.error("Failed to initialise playground:", err);
  const loadingText = document.getElementById("loading-text");
  if (loadingText) {
    loadingText.textContent = `Failed to load: ${String(err)}`;
    loadingText.style.color = "#f87171";
  }
});
