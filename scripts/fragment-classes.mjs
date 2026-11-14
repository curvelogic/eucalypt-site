// Read a `cargo xtask highlight-html --fragment` rendering back into its
// text and, for each character, the class list of its innermost span (or
// null). Used by the tests to compare the playground's highlighting with
// eucalypt's renderer character by character.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'" };

/** @returns {{ text: string, classes: (string | null)[] }} */
export function fragmentClasses(html) {
  const body = /^<pre class="eu"><code>([\s\S]*)<\/code><\/pre>\s*$/.exec(html);
  if (!body) throw new Error("not a highlight-html fragment");
  const stack = [];
  let text = "";
  const classes = [];
  const re = /<span class="([^"]*)">|<\/span>|&(#?\w+);|([^<&]+)/g;
  let at = 0;
  for (let m; (m = re.exec(body[1])); ) {
    if (m.index !== at) throw new Error(`unexpected markup at offset ${at}`);
    at = re.lastIndex;
    if (m[1] !== undefined) {
      stack.push(m[1]);
      continue;
    }
    if (m[0] === "</span>") {
      stack.pop();
      continue;
    }
    const chunk = m[2] !== undefined ? ENTITIES[m[2]] : m[3];
    if (chunk === undefined) throw new Error(`unknown entity ${m[0]}`);
    for (const ch of chunk) {
      text += ch;
      classes.push(stack.length ? stack[stack.length - 1] : null);
    }
  }
  if (at !== body[1].length) throw new Error(`unexpected markup at offset ${at}`);
  return { text, classes };
}

/** Split per-character classes into lines, dropping the newlines. */
export function classesByLine(text, classes) {
  const lines = [[]];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lines.push([]);
    else lines[lines.length - 1].push(classes[i]);
  }
  return lines;
}
