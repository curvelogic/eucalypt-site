/**
 * Eucalypt Playground — entry point.
 *
 * Wires together the editor, evaluator, examples, and sharing.
 */

import "../styles/playground.css";
import { initEvaluator, run, runExpr, getFormats } from "./evaluator";
import { createEditor } from "./editor";
import { EXAMPLES } from "./examples";
import { readStateFromUrl, writeStateToUrl, copyShareLink } from "./share";
import { EditorView } from "@codemirror/view";

// ── DOM references ────────────────────────────────────────────────────────────

const loadingOverlay = document.getElementById("loading-overlay")!;
const editorContainer = document.getElementById("editor-container")!;
const outputEl = document.getElementById("output")!;
const errorPanel = document.getElementById("error-panel")!;
const errorMessage = document.getElementById("error-message")!;
const errorNotes = document.getElementById("error-notes")!;
const statusIndicator = document.getElementById("status-indicator")!;
const runBtn = document.getElementById("run-btn")! as HTMLButtonElement;
const shareBtn = document.getElementById("share-btn")! as HTMLButtonElement;
const formatSelect = document.getElementById("format-select") as HTMLSelectElement;
const exampleSelect = document.getElementById("example-select") as HTMLSelectElement;
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;

// ── State ─────────────────────────────────────────────────────────────────────

let editor: EditorView | null = null;
let isRunning = false;

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
  runBtn.textContent = "Running…";
  statusIndicator.textContent = "";
  statusIndicator.className = "";

  const source = getSource();
  const format = formatSelect.value;
  const mode = getMode();

  // Persist state in URL
  writeStateToUrl({ source, format, mode });

  // Run synchronously (WASM is sync)
  try {
    const result = mode === "expr" ? runExpr(source, format) : run(source, format);
    if (result.success && result.output !== undefined) {
      outputEl.textContent = result.output;
      outputEl.className = "success";
      errorPanel.classList.add("hidden");
      statusIndicator.textContent = "✓";
      statusIndicator.className = "success";
    } else if (result.error) {
      outputEl.textContent = "";
      outputEl.className = "";
      errorMessage.textContent = result.error.message;
      const notes = result.error.notes ?? [];
      errorNotes.textContent = notes.join("\n");
      errorNotes.style.display = notes.length ? "block" : "none";
      errorPanel.classList.remove("hidden");
      statusIndicator.textContent = "✗";
      statusIndicator.className = "error";
    }
  } catch (e) {
    outputEl.textContent = "";
    errorMessage.textContent = String(e);
    errorNotes.textContent = "";
    errorNotes.style.display = "none";
    errorPanel.classList.remove("hidden");
    statusIndicator.textContent = "✗";
    statusIndicator.className = "error";
  }

  isRunning = false;
  runBtn.disabled = false;
  runBtn.textContent = "▶ Run";
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
      formatSelect.value = example.format;
      modeSelect.value = example.mode ?? "unit";
    }
    exampleSelect.value = "";
  });
}

// ── Format selector ───────────────────────────────────────────────────────────

function populateFormats(): void {
  const formats = getFormats();
  // Clear existing options
  while (formatSelect.options.length > 0) formatSelect.remove(0);
  for (const fmt of formats) {
    const option = document.createElement("option");
    option.value = fmt;
    option.textContent = fmt.toUpperCase();
    formatSelect.appendChild(option);
  }
  formatSelect.value = "yaml";
}

// ── Share ─────────────────────────────────────────────────────────────────────

shareBtn.addEventListener("click", async () => {
  await copyShareLink({ source: getSource(), format: formatSelect.value, mode: getMode() });
  shareBtn.textContent = "Copied!";
  setTimeout(() => {
    shareBtn.textContent = "Share";
  }, 2000);
});

// ── Initialisation ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  // Determine initial content (URL hash takes precedence over default example)
  const urlState = readStateFromUrl();
  const initialExample = EXAMPLES[0];
  const initialSource = urlState?.source ?? initialExample.source;
  const initialFormat = urlState?.format ?? initialExample.format;
  const initialMode = urlState?.mode ?? initialExample.mode ?? "unit";

  // Create editor
  editor = createEditor(editorContainer, initialSource, runCode);

  // Wire up run button
  runBtn.addEventListener("click", runCode);

  // Load WASM
  await initEvaluator();

  // Populate UI
  populateFormats();
  populateExamples();
  formatSelect.value = initialFormat;
  modeSelect.value = initialMode;

  // Hide loading overlay
  loadingOverlay.style.display = "none";

  // Auto-run on load if there's URL content
  if (urlState) {
    runCode();
  }
}

init().catch((err) => {
  console.error("Failed to initialise playground:", err);
  const loadingText = document.getElementById("loading-text");
  if (loadingText) {
    loadingText.textContent = `Failed to load: ${String(err)}`;
    loadingText.style.color = "#f87171";
  }
});
