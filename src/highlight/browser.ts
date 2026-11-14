/** Load the eucalypt highlighter in the browser, from the bundled assets. */

import Parser from "web-tree-sitter";
import runtimeUrl from "web-tree-sitter/tree-sitter.wasm?url";
import grammarUrl from "../../vendor/tree-sitter/tree-sitter-eucalypt.wasm?url";
import highlightsScm from "../../vendor/tree-sitter/highlights.scm?raw";
import { EuHighlighter } from "./core";

export async function loadHighlighter(): Promise<EuHighlighter> {
  await Parser.init({ locateFile: () => runtimeUrl });
  return EuHighlighter.create(Parser, grammarUrl, highlightsScm);
}
