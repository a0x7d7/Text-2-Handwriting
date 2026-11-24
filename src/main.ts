import { CalligrapherModel, parseCalligrapherWeights } from "longhand/ink-calligrapher";
import { offsetsToLine } from "longhand/ink-core";
import { alignLine, lineToSvg } from "longhand/ink-render";
import weightsUrl from "longhand/calligrapher.bin?url";
import "./style.css";

const PAGE_W = 794;
const PAGE_H = 1123;
const MARGIN_X = 112;
const MARGIN_TOP = 70;
const MARGIN_BOTTOM = 65;
const PAPER = "#fffefb";
const BASE_INK = "#000000";
const app = document.querySelector<HTMLDivElement>("#app")!;
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

app.innerHTML = `
  <main class="shell">
    <header>
      <h1>Text 2 Handwriting</h1>
    </header>
    <section class="workspace">
      <div class="editor panel">
        <div class="mode-toolbar"><button id="pair-mode" type="button" aria-pressed="true">Pair mode</button><button id="correction-mode" type="button" aria-pressed="false">Correction mode</button></div>
        <div id="speed-settings" class="speed-settings">
          <div><label for="word-spacing">Word spacing <output id="word-spacing-value">16 px</output></label><input id="word-spacing" type="range" min="0" max="48" step="1" value="16"></div>
          <div><label for="line-spacing">Line spacing <output id="line-spacing-value">28 px</output></label><input id="line-spacing" type="range" min="0" max="72" step="1" value="28"></div>
        </div>
        <div class="text-input-heading"><label for="text">Your text</label><div class="text-format-controls"><button id="size-down" type="button" aria-label="Make selected text smaller" title="Make selected text smaller">A−</button><button id="size-up" type="button" aria-label="Make selected text bigger" title="Make selected text bigger">A+</button></div></div>
        <div id="text" class="text-editor" contenteditable="plaintext-only" role="textbox" aria-label="Your text" aria-multiline="true" spellcheck="false">The quick brown fox jumps over the lazy dog.

This is a handwriting sample generated with Longhand. Type anything you want in this box, then generate your pages.</div>
        <div class="settings">
          <div><label for="style">Handwriting style</label><select id="style">
            <option value="2" selected>Style 2</option><option value="1">Style 1</option><option value="3">Style 3</option><option value="4">Style 4</option><option value="5">Style 5</option><option value="6">Style 6</option><option value="7">Style 7</option><option value="8">Style 8</option><option value="9">Style 9</option>
          </select></div>
          <div><label for="ink">Ink colour</label><select id="ink">
            <option value="#203b68" selected>Blue</option><option value="#202020">Black</option><option value="#7a4a21">Sepia</option><option value="#b3261e">Red</option>
          </select></div>
          <div class="size-setting"><label for="text-size">Text size <output id="text-size-value">100%</output></label><input id="text-size" type="range" min="55" max="145" step="5" value="100"></div>
        </div>
        <div class="actions">
          <button id="generate" class="primary" disabled>Generate pages</button>
          <button id="regenerate" type="button" title="Regenerate selected word or pair (Ctrl+R)" disabled>Regenerate</button>
          <button id="download" disabled>Download all pages (.zip)</button>
        </div>
        <div id="generation-progress" class="generation-progress" hidden>
          <div class="progress-heading"><span class="progress-label">Progress</span><span id="progress-percent">0%</span></div>
          <div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div>
        </div>
        <p id="status" class="status" aria-live="polite"></p>
      </div>
      <div class="preview panel">
        <div class="preview-head"><span>PAGE PREVIEW</span><span id="page-info">No pages yet</span></div>
        <div class="page-toolbar">
          <div class="page-controls"><button id="prev-page" disabled>← Previous</button><span id="page-number">Page 0 of 0</span><button id="next-page" disabled>Next →</button></div>
          <div class="zoom-controls" aria-label="Page zoom controls"><button id="zoom-out" type="button" title="Zoom out" disabled>−</button><span id="zoom-level">100%</span><button id="zoom-in" type="button" title="Zoom in" disabled>+</button><button id="zoom-fit" type="button" disabled>Fit</button></div>
        </div>
        <div class="paper-wrap" id="paper-wrap">
          <div class="page-stage" id="page-stage" hidden>
            <svg id="preview" viewBox="0 0 794 1123" role="img" aria-label="Generated handwritten page preview"></svg>
          </div>
          <div id="placeholder" class="placeholder">Your handwritten pages will appear here.</div>
        </div>
      </div>
    </section>
    <footer>you can support me at <a href="https://buymeacoffee.com/cofei" target="_blank" rel="noopener noreferrer">buymeacoffee.com/cofei</a></footer>
  </main>`;

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const textArea = $("#text") as HTMLDivElement;
const styleSelect = $("#style") as HTMLSelectElement;
const inkSelect = $("#ink") as HTMLSelectElement;
const correctionModeButton = $("#correction-mode") as HTMLButtonElement;
const pairModeButton = $("#pair-mode") as HTMLButtonElement;
const wordSpacing = $("#word-spacing") as HTMLInputElement;
const wordSpacingValue = $("#word-spacing-value") as HTMLOutputElement;
const lineSpacing = $("#line-spacing") as HTMLInputElement;
const lineSpacingValue = $("#line-spacing-value") as HTMLOutputElement;
const sizeDownButton = $("#size-down") as HTMLButtonElement;
const sizeUpButton = $("#size-up") as HTMLButtonElement;
const textSize = $("#text-size") as HTMLInputElement;
const textSizeValue = $("#text-size-value") as HTMLOutputElement;
const generateButton = $("#generate") as HTMLButtonElement;
const regenerateButton = $("#regenerate") as HTMLButtonElement;
const downloadButton = $("#download") as HTMLButtonElement;
const prevButton = $("#prev-page") as HTMLButtonElement;
const nextButton = $("#next-page") as HTMLButtonElement;
const pageNumber = $("#page-number") as HTMLSpanElement;
const pageInfo = $("#page-info") as HTMLSpanElement;
const status = $("#status") as HTMLParagraphElement;
const generationProgress = $("#generation-progress") as HTMLDivElement;
const progressFill = $("#progress-fill") as HTMLDivElement;
const progressPercent = $("#progress-percent") as HTMLSpanElement;
const preview = $("#preview") as SVGSVGElement;
const placeholder = $("#placeholder") as HTMLDivElement;
const pageStage = $("#page-stage") as HTMLDivElement;
const paperWrap = $("#paper-wrap") as HTMLDivElement;
const zoomOutButton = $("#zoom-out") as HTMLButtonElement;
const zoomInButton = $("#zoom-in") as HTMLButtonElement;
const zoomFitButton = $("#zoom-fit") as HTMLButtonElement;
const zoomLevel = $("#zoom-level") as HTMLSpanElement;

interface SpeedWord { id: number; text: string; style: number; width: number; height: number; baseline: number; body: string; paragraphEnd: boolean; localScale: number; postScale: number; offsetX: number; offsetY: number }
interface PlacedWord { word: SpeedWord; x: number; y: number; width: number; height: number; scale: number }
interface PageDocument { svg: string; words: PlacedWord[] }
interface DocumentSnapshot { speedWords: SpeedWord[] | null; pages: PageDocument[]; currentPage: number; selectedWordIds: number[]; textSize: string; wordSpacing: string; lineSpacing: string; ink: string }
let model: CalligrapherModel | null = null;
let pages: PageDocument[] = [];
let speedWords: SpeedWord[] | null = null;
let speedTextSize = 1;
let correctionMode = false;
let pairMode = true;
let lastInk = inkSelect.value;
let currentPage = 0;
let selectedWordIds = new Set<number>();
let dragState: { startX: number; startY: number; items: Array<{ id: number; offsetX: number; offsetY: number }>; before: DocumentSnapshot; changed: boolean } | null = null;
let resizeState: { handle: string; startX: number; startY: number; bounds: { left: number; top: number; right: number; bottom: number }; items: Array<{ id: number; left: number; top: number; width: number; height: number; scale: number; postScale: number }>; before: DocumentSnapshot; changed: boolean } | null = null;
let nextWordId = 1;
const undoStack: DocumentSnapshot[] = [];
const redoStack: DocumentSnapshot[] = [];
let pageZoom = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
function applyPageZoom() {
  const fitWidth = Math.max(220, Math.min(520, paperWrap.clientWidth - 24));
  pageStage.style.width = `${Math.round(fitWidth * pageZoom)}px`;
  zoomLevel.textContent = `${Math.round(pageZoom * 100)}%`;
  zoomOutButton.disabled = !pages.length || pageZoom <= MIN_ZOOM;
  zoomInButton.disabled = !pages.length || pageZoom >= MAX_ZOOM;
  zoomFitButton.disabled = !pages.length;
}

function setStatus(message: string) { status.textContent = message; }
function copyDocumentGraph(words: SpeedWord[] | null, sourcePages: PageDocument[]) {
  const wordCopies = new Map<number, SpeedWord>();
  for (const word of words ?? []) wordCopies.set(word.id, { ...word });
  for (const page of sourcePages) for (const placed of page.words) if (!wordCopies.has(placed.word.id)) wordCopies.set(placed.word.id, { ...placed.word });
  return {
    speedWords: words?.map((word) => wordCopies.get(word.id)!) ?? null,
    pages: sourcePages.map((page) => ({ svg: page.svg, words: page.words.map((placed) => ({ ...placed, word: wordCopies.get(placed.word.id)! })) })),
  };
}
function captureDocument(): DocumentSnapshot {
  const graph = copyDocumentGraph(speedWords, pages);
  return {
    ...graph, currentPage, selectedWordIds: [...selectedWordIds],
    textSize: textSize.value, wordSpacing: wordSpacing.value, lineSpacing: lineSpacing.value, ink: inkSelect.value,
  };
}
function pushUndo(snapshot: DocumentSnapshot) {
  undoStack.push(snapshot);
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
}
function restoreDocument(snapshot: DocumentSnapshot) {
  const graph = copyDocumentGraph(snapshot.speedWords, snapshot.pages);
  speedWords = graph.speedWords; pages = graph.pages;
  currentPage = Math.min(snapshot.currentPage, Math.max(0, pages.length - 1));
  selectedWordIds = new Set(snapshot.selectedWordIds);
  textSize.value = snapshot.textSize; wordSpacing.value = snapshot.wordSpacing; lineSpacing.value = snapshot.lineSpacing;
  inkSelect.value = snapshot.ink; lastInk = snapshot.ink;
  speedTextSize = Number(textSize.value) / 100;
  textSizeValue.value = `${textSize.value}%`; textSizeValue.textContent = `${textSize.value}%`;
  updateSpacingOutputs();
  if (pages.length) { pageStage.hidden = false; placeholder.hidden = true; renderCurrentPage(); } else {
    regenerateButton.disabled = true; downloadButton.disabled = true; prevButton.disabled = true; nextButton.disabled = true;
    pageNumber.textContent = "Page 0 of 0"; pageInfo.textContent = "No pages yet";
    pageStage.hidden = true; placeholder.hidden = false; applyPageZoom();
  }
}
function undoDocument() {
  const previous = undoStack.pop(); if (!previous) return;
  redoStack.push(captureDocument()); restoreDocument(previous);
}
function redoDocument() {
  const next = redoStack.pop(); if (!next) return;
  undoStack.push(captureDocument()); restoreDocument(next);
}
function readEditorText(): { text: string; scales: number[]; editorScales: number[] } {
  let text = ""; const scales: number[] = []; const editorScales: number[] = [];
  const walker = document.createTreeWalker(textArea, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue ?? "";
    let scale = 1; let editorScale = 1; let foundScale = false; let foundEditorScale = false; let parent = node.parentElement;
    while (parent && parent !== textArea && (!foundScale || !foundEditorScale)) {
      const localLevel = parent.getAttribute("data-local-level");
      if (localLevel !== null) { scale = 1 + 0.2 * Number(localLevel); foundScale = true; }
      const editorLevel = parent.getAttribute("data-editor-level");
      if (editorLevel !== null) { editorScale = 1 + 0.1 * Number(editorLevel); foundEditorScale = true; }
      parent = parent.parentElement;
    }
    text += value;
    for (let i = 0; i < value.length; i++) { scales.push(scale); editorScales.push(editorScale); }
  }
  return { text, scales, editorScales };
}
function textOffsetAt(node: Node, offset: number): number {
  const range = document.createRange(); range.selectNodeContents(textArea); range.setEnd(node, offset);
  return range.toString().length;
}
function unwrapScaleMarkers(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child instanceof HTMLElement && child.hasAttribute("data-local-level")) {
      child.replaceWith(...Array.from(child.childNodes));
    } else unwrapScaleMarkers(child);
  }
}
function normalizeText(input: string, activeModel: CalligrapherModel): string {
  const replacements: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"', "—": "-", "–": "-", "…": "...", "\u00a0": " " };
  return [...input].map((char) => replacements[char] ?? char).join("")
    .split("\n").map((paragraph) => [...paragraph].map((char) => activeModel.supports(char) ? char : " ").join("").replace(/[ \t]+/g, " ").trim()).join("\n").trim();
}
function innerSvg(svgText: string): { width: number; height: number; body: string } {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml"); const root = parsed.documentElement;
  if (root.tagName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) throw new Error("The renderer returned invalid SVG.");
  const nums = (root.getAttribute("viewBox") ?? "0 0 1 1").trim().split(/\s+/).map(Number);
  const inheritedPaint = ["fill", "stroke", "stroke-linecap", "stroke-linejoin"].map((name) => {
    const value = root.getAttribute(name); return value === null ? "" : ` ${name}="${value}"`;
  }).join("");
  const body = [...root.childNodes].map((node) => new XMLSerializer().serializeToString(node)).join("");
  return { width: nums[2] || 1, height: nums[3] || 1, body: `<g${inheritedPaint}>${body}</g>` };
}
function baselineInSvg(line: ReturnType<typeof offsetsToLine>, padding = 2): number {
  const ys = line.strokes.flatMap((stroke) => stroke.points.map(([, y]) => y));
  if (!ys.length) return padding;
  const minY = Math.min(...ys);
  const fittedBaseline = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  return fittedBaseline - minY + padding;
}
async function loadModel(): Promise<CalligrapherModel> {
  const response = await fetch(weightsUrl); if (!response.ok) throw new Error(`Could not load model weights (HTTP ${response.status}).`);
  return new CalligrapherModel(parseCalligrapherWeights(await response.arrayBuffer()));
}
async function buildPages(
  activeModel: CalligrapherModel,
  input: string,
  style: number,
  size: number,
  onProgress: (percent: number, message: string) => void,
): Promise<PageDocument[]> {
  const cleaned = normalizeText(input, activeModel);
  if (!cleaned) throw new Error("Enter some text first.");

  const availableW = PAGE_W - MARGIN_X - 60;
  const bottomY = PAGE_H - MARGIN_BOTTOM;
  const paragraphs = cleaned.split(/\n+/).map((paragraph) => paragraph.trim());
  const totalWords = Math.max(1, paragraphs.reduce((sum, paragraph) => sum + (paragraph ? paragraph.split(/\s+/).length : 0), 0));
  let processedWords = 0;
  const rows: Array<{ text: string; paragraphGap: boolean }> = [];
  const seed = Math.floor(Math.random() * 1_000_000);

  // Measure the actual handwriting, rather than estimating line length by character count.
  // The selected size is the intended scale; smaller sizes therefore fit more words per line.
  const measureWidth = (text: string, lineSeed: number) => {
    const offsets = activeModel.write(text, { bias: 0.6, style, seed: lineSeed });
    const line = alignLine(offsetsToLine(offsets));
    const svg = lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink: BASE_INK, ribbonWidth: 1.35 });
    return innerSvg(svg).width;
  };

  let lineSeed = seed;
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    const paragraph = paragraphs[paragraphIndex];
    if (!paragraph) continue;
    const words = paragraph.split(/\s+/);
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = measureWidth(candidate, lineSeed);
      if (currentLine && candidateWidth * size > availableW) {
        rows.push({ text: currentLine, paragraphGap: false });
        currentLine = word;
      } else {
        currentLine = candidate;
      }
      processedWords++;
      const percent = Math.min(65, Math.round(processedWords / totalWords * 65));
      onProgress(percent, `Laying out text · ${processedWords} of ${totalWords} words`);
      // Timer yields continue in hidden tabs; batching avoids one throttled timer per word.
      if (processedWords % 8 === 0) await yieldToBrowser();
      lineSeed++;
    }
    if (currentLine) rows.push({ text: currentLine, paragraphGap: false });
    if (paragraphIndex < paragraphs.length - 1 && paragraphs.slice(paragraphIndex + 1).some((item) => item.length)) {
      rows.push({ text: "", paragraphGap: true });
    }
  }

  const output: PageDocument[] = [];
  let elements: string[] = [];
  let y = MARGIN_TOP;
  let renderedLines = 0;
  const lineRows = rows.filter((row) => row.text).length;
  const startPage = () => { elements = []; y = MARGIN_TOP; };
  const finishPage = () => {
    output.push({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><rect width="100%" height="100%" fill="${PAPER}"/>${elements.join("\n")}</svg>`, words: [] });
  };
  startPage();
  for (const row of rows) {
    if (!row.text) {
      const gapHeight = 20 * size;
      if (y + gapHeight > bottomY && elements.length) { finishPage(); startPage(); }
      y += gapHeight;
      continue;
    }
    const offsets = activeModel.write(row.text, { bias: 0.6, style, seed: seed + renderedLines });
    const line = alignLine(offsetsToLine(offsets));
    const raw = lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink: BASE_INK, ribbonWidth: 1.35 });
    const rawLayout = innerSvg(raw);
    const scale = Math.min(size, availableW / rawLayout.width);
    const rendered = lineToSvg(line, { renderer: "ribbon", scale, padding: 2, ink: BASE_INK, ribbonWidth: 1.35 * scale });
    const layout = innerSvg(rendered);
    const gap = row.paragraphGap ? 10 * size : 0;
    const lineHeight = layout.height + 8 * size + gap;
    if (y + lineHeight > bottomY && elements.length) { finishPage(); startPage(); }
    y += gap;
    elements.push(`<svg x="${MARGIN_X}" y="${y.toFixed(1)}" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" overflow="visible">${layout.body}</svg>`);
    y += layout.height + 8 * size;
    renderedLines++;
    onProgress(65 + Math.round(renderedLines / Math.max(1, lineRows) * 35), `Rendering handwriting · ${renderedLines} of ${lineRows} lines`);
    if (renderedLines % 4 === 0) await yieldToBrowser();
  }
  if (elements.length || output.length === 0) finishPage();
  onProgress(100, `Finished · ${output.length} page${output.length === 1 ? "" : "s"}`);
  return output;
}
async function buildSpeedWords(
  activeModel: CalligrapherModel,
  input: string,
  inputScales: number[],
  style: number,
  groupSingles: boolean,
  correctWords: boolean,
  onProgress: (percent: number, message: string) => void,
): Promise<SpeedWord[]> {
  const tokens: Array<{ text: string; start: number; end: number; localScale: number; paragraphEnd: boolean }> = [...input.matchAll(/\S+/g)].map((match) => {
    const start = match.index ?? 0;
    const text = normalizeText(match[0], activeModel).replace(/\s+/g, "");
    const scales = inputScales.slice(start, start + match[0].length);
    const localScale = scales.length ? scales.reduce((sum, value) => sum + value, 0) / scales.length : 1;
    return { text, start, end: start + match[0].length, localScale, paragraphEnd: false };
  }).filter((token) => token.text);
  if (!tokens.length) throw new Error("Enter some text first.");
  for (let index = 0; index < tokens.length; index++) {
    const next = tokens[index + 1];
    tokens[index].paragraphEnd = !next || input.slice(tokens[index].end, next.start).includes("\n");
  }
  const groups: Array<(typeof tokens)[number] & { partCount: number }> = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (groupSingles && /^[^A-Za-z0-9]*[A-Za-z][^A-Za-z0-9]*$/.test(token.text)) {
      if (next && !input.slice(token.end, next.start).includes("\n")) {
        const textLength = token.text.length + next.text.length;
        groups.push({
          ...token, text: `${token.text} ${next.text}`, end: next.end,
          localScale: (token.localScale * token.text.length + next.localScale * next.text.length) / textLength,
          paragraphEnd: next.paragraphEnd, partCount: 2,
        });
        index++;
        continue;
      }
      const previous = groups.at(-1);
      if (previous?.partCount === 1 && !input.slice(previous.end, token.start).includes("\n")) {
        const textLength = previous.text.length + token.text.length;
        groups[groups.length - 1] = {
          ...previous, text: `${previous.text} ${token.text}`, end: token.end,
          localScale: (previous.localScale * previous.text.length + token.localScale * token.text.length) / textLength,
          paragraphEnd: token.paragraphEnd, partCount: 2,
        };
        continue;
      }
    }
    groups.push({ ...token, partCount: 1 });
  }
  const total = groups.length;
  const output: SpeedWord[] = [];
  const seed = Math.floor(Math.random() * 1_000_000);
  let completed = 0;
  for (const token of groups) {
    const offsets = activeModel.write(token.text, { bias: 0.6, style, seed: seed + completed });
    const line = alignLine(offsetsToLine(offsets));
    const layout = innerSvg(lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink: BASE_INK, ribbonWidth: 1.35 }));
    const baseline = Math.max(0, Math.min(layout.height, baselineInSvg(line)));
    if (correctWords) {
      onProgress(Math.round(completed / total * 88), `Checking word group ${completed + 1} of ${total}`);
      await recognizeWordImage(await wordImageDataUrl(layout));
    }
    output.push({
      id: nextWordId++, text: token.text, style, width: layout.width, height: layout.height, baseline, body: layout.body,
      paragraphEnd: token.paragraphEnd, localScale: token.localScale, postScale: 1, offsetX: 0, offsetY: 0,
    });
    completed++;
    onProgress(Math.round(completed / total * 88), `${correctWords ? "Checking" : "Drawing"} word groups · ${completed} of ${total}`);
    if (completed % 8 === 0) await yieldToBrowser();
  }
  onProgress(90, "Placing words on pages...");
  return output;
}
async function wordImageDataUrl(layout: { width: number; height: number; body: string }): Promise<string> {
  const scale = 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(layout.width * scale)}" height="${Math.ceil(layout.height * scale)}" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="#ffffff"/>${layout.body}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(layout.width * scale); canvas.height = Math.ceil(layout.height * scale);
    const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare a word image for checking.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}
async function recognizeWordImage(image: string): Promise<string> {
  const response = await fetch("/api/verify-word", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
  const result = await response.json() as { text?: string; error?: string };
  if (!response.ok) throw new Error(result.error || `Word checking failed (HTTP ${response.status}).`);
  return result.text ?? "";
}
function normalizeRecognizedWord(word: string): string { return word.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""); }
function composeSpeedPages(words: SpeedWord[], size: number, wordGap: number, lineGap: number): PageDocument[] {
  const availableW = PAGE_W - MARGIN_X - 60;
  const bottomY = PAGE_H - MARGIN_BOTTOM;
  const rows: Array<{ words: PlacedWord[]; ascent: number; descent: number; height: number }> = [];
  let row: { words: PlacedWord[]; ascent: number; descent: number; height: number } = { words: [], ascent: 0, descent: 0, height: 0 };
  let x = 0;
  const finishRow = () => {
    if (row.words.length) rows.push(row);
    row = { words: [], ascent: 0, descent: 0, height: 0 }; x = 0;
  };
  for (const word of words) {
    const scale = Math.min(size * word.localScale * word.postScale, availableW / word.width);
    const width = word.width * scale;
    const height = word.height * scale;
    const gap = row.words.length ? Math.max(0, wordGap * size) : 0;
    if (row.words.length && x + gap + width > availableW) finishRow();
    const actualGap = row.words.length ? Math.max(0, wordGap * size) : 0;
    x += actualGap;
    row.words.push({ word, x, y: 0, scale, width, height });
    row.ascent = Math.max(row.ascent, word.baseline * scale);
    row.descent = Math.max(row.descent, (word.height - word.baseline) * scale);
    row.height = row.ascent + row.descent;
    x += width;
    if (word.paragraphEnd) finishRow();
  }
  finishRow();

  const output: PageDocument[] = [];
  let elements: string[] = [];
  let pageWords: PlacedWord[] = [];
  let y = MARGIN_TOP;
  const finishPage = () => output.push({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><rect width="100%" height="100%" fill="${PAPER}"/>${elements.join("\n")}</svg>`, words: pageWords });
  for (const line of rows) {
    const lineHeight = line.height + lineGap;
    if (y + lineHeight > bottomY && elements.length) { finishPage(); elements = []; pageWords = []; y = MARGIN_TOP; }
    for (const placed of line.words) {
      const top = y + line.ascent - placed.word.baseline * placed.scale;
      placed.x += MARGIN_X; placed.y = top;
      pageWords.push(placed);
      elements.push(wordSvgMarkup(placed));
    }
    y += lineHeight;
  }
  if (elements.length || output.length === 0) finishPage();
  return output;
}
function wordSvgMarkup(placed: PlacedWord): string {
  return `<svg x="${placed.x.toFixed(1)}" y="${placed.y.toFixed(1)}" width="${placed.width.toFixed(1)}" height="${placed.height.toFixed(1)}" viewBox="0 0 ${placed.word.width} ${placed.word.height}" overflow="visible">${placed.word.body}</svg>`;
}
function recolor(markup: string): string { return markup.replaceAll(BASE_INK, inkSelect.value); }
function svgPoint(event: PointerEvent) {
  const rect = preview.getBoundingClientRect();
  return { x: Math.max(0, Math.min(PAGE_W, (event.clientX - rect.left) * PAGE_W / rect.width)), y: Math.max(0, Math.min(PAGE_H, (event.clientY - rect.top) * PAGE_H / rect.height)) };
}
function serializePage(page: PageDocument, hitTargets = false): string {
  const words = page.words.map((placed) => {
    const { word } = placed; const x = placed.x + word.offsetX; const y = placed.y + word.offsetY;
    const ink = `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${placed.width.toFixed(1)}" height="${placed.height.toFixed(1)}" viewBox="0 0 ${word.width} ${word.height}" overflow="visible">${word.body}</svg>`;
    const hit = hitTargets ? `<rect class="word-hit" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${placed.width.toFixed(1)}" height="${placed.height.toFixed(1)}" fill="transparent"/>` : "";
    return `<g${hitTargets ? ` data-word-id="${word.id}"` : ""}>${ink}${hit}</g>`;
  }).join("");
  const selected = hitTargets ? page.words.filter((placed) => selectedWordIds.has(placed.word.id)) : [];
  const selection = selected.length ? (() => {
    const boxes = selected.map((placed) => ({ left: placed.x + placed.word.offsetX, top: placed.y + placed.word.offsetY, right: placed.x + placed.word.offsetX + placed.width, bottom: placed.y + placed.word.offsetY + placed.height }));
    const left = Math.min(...boxes.map((box) => box.left)); const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right)); const bottom = Math.max(...boxes.map((box) => box.bottom));
    const wordBoxes = selected.map((placed) => `<rect class="selected-word" x="${(placed.x + placed.word.offsetX).toFixed(1)}" y="${(placed.y + placed.word.offsetY).toFixed(1)}" width="${placed.width.toFixed(1)}" height="${placed.height.toFixed(1)}"/>`).join("");
    const handle = (name: string, x: number, y: number) => `<rect class="resize-handle" data-resize-handle="${name}" x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" rx="2"/>`;
    return `${wordBoxes}<rect class="word-selection" x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${(right - left).toFixed(1)}" height="${(bottom - top).toFixed(1)}"/>${handle("nw", left, top)}${handle("ne", right, top)}${handle("sw", left, bottom)}${handle("se", right, bottom)}`;
  })() : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><rect width="100%" height="100%" fill="${PAPER}"/>${words}${selection}</svg>`;
}
function renderOverlay() {
  const page = pages[currentPage];
  if (!page) return;
  regenerateButton.disabled = !page.words.some((placed) => selectedWordIds.has(placed.word.id));
  page.svg = recolor(serializePage(page));
  const content = serializePage(page, true).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  preview.innerHTML = recolor(content);
}
function finalSvg(page: PageDocument): string { return recolor(serializePage(page)); }
function renderCurrentPage() {
  if (!pages.length) return;
  renderOverlay();
  pageNumber.textContent = `Page ${currentPage + 1} of ${pages.length}`;
  pageInfo.textContent = `A4 · ${pages.length} page${pages.length === 1 ? "" : "s"}`;
  prevButton.disabled = currentPage === 0; nextButton.disabled = currentPage === pages.length - 1;
  downloadButton.disabled = false;
  applyPageZoom();
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
async function pageToPng(page: PageDocument): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([finalSvg(page)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = PAGE_W * 2; canvas.height = PAGE_H * 2;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Could not create the PNG canvas.");
    context.scale(2, 2); context.drawImage(image, 0, 0, PAGE_W, PAGE_H);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
// Minimal ZIP writer (STORE method). PNGs are already compressed, so deflate is unnecessary.
const crcTable = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; } return table; })();
function crc32(data: Uint8Array): number { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function makeZip(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const encoder = new TextEncoder(); const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = []; let offset = 0;
  const put16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const put32 = (view: DataView, at: number, value: number) => view.setUint32(at, value >>> 0, true);
  for (const file of files) {
    const name = encoder.encode(file.name); const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
    put32(lv, 0, 0x04034b50); put16(lv, 4, 20); put16(lv, 6, 0x0800); put16(lv, 8, 0); put32(lv, 14, crc); put32(lv, 18, file.data.length); put32(lv, 22, file.data.length); put16(lv, 26, name.length); local.set(name, 30);
    localParts.push(local, file.data);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    put32(cv, 0, 0x02014b50); put16(cv, 4, 20); put16(cv, 6, 20); put16(cv, 8, 0x0800); put16(cv, 10, 0); put32(cv, 16, crc); put32(cv, 20, file.data.length); put32(cv, 24, file.data.length); put16(cv, 28, name.length); put32(cv, 42, offset); central.set(name, 46);
    centralParts.push(central); offset += local.length + file.data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer); put32(ev, 0, 0x06054b50); put16(ev, 8, files.length); put16(ev, 10, files.length); put32(ev, 12, centralSize); put32(ev, 16, offset);
  // Copy typed arrays into ArrayBuffer-backed views accepted by the DOM Blob typings.
  return new Blob([...localParts, ...centralParts, end].map((part) => new Uint8Array(part)), { type: "application/zip" });
}

textSize.addEventListener("input", () => {
  textSizeValue.value = `${textSize.value}%`; textSizeValue.textContent = `${textSize.value}%`;
  if (speedWords) { speedTextSize = Number(textSize.value) / 100; reflowSpeedPages(); }
});
function trackRangeHistory(input: HTMLInputElement) {
  let before: DocumentSnapshot | null = null;
  const begin = () => { if (!before) before = captureDocument(); };
  input.addEventListener("pointerdown", begin);
  input.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) begin(); });
  input.addEventListener("change", () => {
    if (before && (before.textSize !== textSize.value || before.wordSpacing !== wordSpacing.value || before.lineSpacing !== lineSpacing.value)) pushUndo(before);
    before = null;
  });
}
trackRangeHistory(textSize); trackRangeHistory(wordSpacing); trackRangeHistory(lineSpacing);
function adjustSelectedTextSize(amount: number) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !textArea.contains(selection.anchorNode)) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return;
  const { scales, editorScales } = readEditorText();
  const start = textOffsetAt(range.startContainer, range.startOffset);
  const end = textOffsetAt(range.endContainer, range.endOffset);
  const selectedScales = scales.slice(start, end);
  const selectedEditorScales = editorScales.slice(start, end);
  const currentScale = selectedScales.length ? selectedScales.reduce((sum, value) => sum + value, 0) / selectedScales.length : 1;
  const currentEditorScale = selectedEditorScales.length ? selectedEditorScales.reduce((sum, value) => sum + value, 0) / selectedEditorScales.length : 1;
  const levelChange = Math.sign(amount);
  const localLevel = Math.max(-4, Math.min(4, Math.round((currentScale - 1) / 0.2) + levelChange));
  const editorLevel = Math.max(-4, Math.min(4, Math.round((currentEditorScale - 1) / 0.1) + levelChange));
  const fragment = range.extractContents(); unwrapScaleMarkers(fragment);
  const marker = document.createElement("span");
  marker.dataset.localLevel = String(localLevel); marker.dataset.editorLevel = String(editorLevel);
  marker.style.fontSize = `${100 + editorLevel * 10}%`;
  marker.append(fragment); range.insertNode(marker);
  selection.removeAllRanges(); const updatedRange = document.createRange(); updatedRange.selectNodeContents(marker); selection.addRange(updatedRange);
}
sizeDownButton.addEventListener("mousedown", (event) => event.preventDefault());
sizeUpButton.addEventListener("mousedown", (event) => event.preventDefault());
sizeDownButton.addEventListener("click", () => adjustSelectedTextSize(-0.2));
sizeUpButton.addEventListener("click", () => adjustSelectedTextSize(0.2));
function insertPlainText(value: string) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = selection.rangeCount && textArea.contains(selection.anchorNode) ? selection.getRangeAt(0) : document.createRange();
  if (!textArea.contains(selection.anchorNode)) { range.selectNodeContents(textArea); range.collapse(false); }
  range.deleteContents();
  const inserted = document.createTextNode(value); range.insertNode(inserted); range.setStartAfter(inserted); range.collapse(true);
  selection.removeAllRanges(); selection.addRange(range);
  textArea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}
textArea.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); insertPlainText("\n"); }
});
textArea.addEventListener("paste", (event) => {
  event.preventDefault(); insertPlainText(event.clipboardData?.getData("text/plain") ?? "");
});
function updateSpacingOutputs() {
  wordSpacingValue.value = `${wordSpacing.value} px`; wordSpacingValue.textContent = `${wordSpacing.value} px`;
  lineSpacingValue.value = `${lineSpacing.value} px`; lineSpacingValue.textContent = `${lineSpacing.value} px`;
}
function reflowSpeedPages() {
  if (!speedWords) return;
  const previousPage = currentPage;
  pages = composeSpeedPages(speedWords, speedTextSize, Number(wordSpacing.value), Number(lineSpacing.value));
  const selectedPage = pages.findIndex((page) => page.words.some((placed) => selectedWordIds.has(placed.word.id)));
  currentPage = selectedPage >= 0 ? selectedPage : Math.min(previousPage, pages.length - 1);
  const visibleIds = new Set(pages[currentPage]?.words.map((placed) => placed.word.id) ?? []);
  selectedWordIds = new Set([...selectedWordIds].filter((id) => visibleIds.has(id)));
  renderCurrentPage();
}
pairModeButton.addEventListener("click", () => {
  pairMode = !pairMode;
  pairModeButton.setAttribute("aria-pressed", String(pairMode));
});
correctionModeButton.addEventListener("click", () => {
  correctionMode = !correctionMode;
  correctionModeButton.setAttribute("aria-pressed", String(correctionMode));
});
wordSpacing.addEventListener("input", () => { updateSpacingOutputs(); reflowSpeedPages(); });
lineSpacing.addEventListener("input", () => { updateSpacingOutputs(); reflowSpeedPages(); });
inkSelect.addEventListener("change", () => {
  if (lastInk !== inkSelect.value) { const before = captureDocument(); before.ink = lastInk; pushUndo(before); lastInk = inkSelect.value; }
  if (pages.length) renderCurrentPage();
});
generateButton.addEventListener("click", async () => {
  if (!model) return;
  const beforeGeneration = captureDocument();
  generateButton.disabled = true; regenerateButton.disabled = true; downloadButton.disabled = true;
  pairModeButton.disabled = true; correctionModeButton.disabled = true; wordSpacing.disabled = true; lineSpacing.disabled = true; sizeDownButton.disabled = true; sizeUpButton.disabled = true;
  generationProgress.hidden = false; progressFill.style.width = "0%"; progressPercent.textContent = "0%";
  setStatus("Starting generation...");
  try {
    const report = (percent: number, message: string) => { progressFill.style.width = `${percent}%`; progressPercent.textContent = `${percent}%`; setStatus(message); };
    const editor = readEditorText();
    speedWords = await buildSpeedWords(model, editor.text, editor.scales, Number(styleSelect.value), pairMode, correctionMode, report);
    speedTextSize = Number(textSize.value) / 100;
    pages = composeSpeedPages(speedWords, speedTextSize, Number(wordSpacing.value), Number(lineSpacing.value));
    pushUndo(beforeGeneration);
    report(100, `Finished · ${pages.length} page${pages.length === 1 ? "" : "s"}`);
    currentPage = 0; selectedWordIds.clear();
    pageStage.hidden = false; placeholder.hidden = true; renderCurrentPage();
    setStatus("");
  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  finally {
    generateButton.disabled = false; pairModeButton.disabled = false; correctionModeButton.disabled = false;
    wordSpacing.disabled = false; lineSpacing.disabled = false; sizeDownButton.disabled = false; sizeUpButton.disabled = false;
    regenerateButton.disabled = !pages[currentPage]?.words.some((placed) => selectedWordIds.has(placed.word.id));
    downloadButton.disabled = pages.length === 0;
  }
});
prevButton.addEventListener("click", () => { if (currentPage > 0) { currentPage--; selectedWordIds.clear(); renderCurrentPage(); } });
nextButton.addEventListener("click", () => { if (currentPage < pages.length - 1) { currentPage++; selectedWordIds.clear(); renderCurrentPage(); } });
preview.addEventListener("pointerdown", (event) => {
  const resizeHandle = (event.target as Element).closest<SVGRectElement>("[data-resize-handle]");
  const target = (event.target as Element).closest<SVGGElement>("[data-word-id]");
  if (!resizeHandle && !target) { selectedWordIds.clear(); renderOverlay(); return; }
  const point = svgPoint(event);
  if (resizeHandle) {
    const selected = pages[currentPage]?.words.filter((placed) => selectedWordIds.has(placed.word.id)) ?? [];
    if (!selected.length) return;
    const items = selected.map((placed) => ({ id: placed.word.id, left: placed.x + placed.word.offsetX, top: placed.y + placed.word.offsetY, width: placed.width, height: placed.height, scale: placed.scale, postScale: placed.word.postScale }));
    resizeState = {
      handle: resizeHandle.dataset.resizeHandle ?? "se", startX: point.x, startY: point.y,
      bounds: { left: Math.min(...items.map((item) => item.left)), top: Math.min(...items.map((item) => item.top)), right: Math.max(...items.map((item) => item.left + item.width)), bottom: Math.max(...items.map((item) => item.top + item.height)) },
      items, before: captureDocument(), changed: false,
    };
    preview.setPointerCapture(event.pointerId); event.preventDefault(); return;
  }
  const wordId = Number(target!.dataset.wordId);
  if (event.shiftKey) {
    if (selectedWordIds.has(wordId)) selectedWordIds.delete(wordId); else selectedWordIds.add(wordId);
    renderOverlay(); event.preventDefault(); return;
  }
  if (!selectedWordIds.has(wordId)) selectedWordIds = new Set([wordId]);
  const selected = pages[currentPage]?.words.filter((placed) => selectedWordIds.has(placed.word.id)) ?? [];
  dragState = { startX: point.x, startY: point.y, items: selected.map((placed) => ({ id: placed.word.id, offsetX: placed.word.offsetX, offsetY: placed.word.offsetY })), before: captureDocument(), changed: false };
  preview.setPointerCapture(event.pointerId); event.preventDefault(); renderOverlay();
});
preview.addEventListener("pointermove", (event) => {
  if (resizeState) {
    const point = svgPoint(event); const dx = point.x - resizeState.startX; const dy = point.y - resizeState.startY;
    if (Math.hypot(dx, dy) <= 2) return;
    if (!resizeState.changed) { pushUndo(resizeState.before); resizeState.changed = true; }
    const bounds = resizeState.bounds;
    const growsLeft = resizeState.handle.includes("w"); const growsTop = resizeState.handle.includes("n");
    const groupWidth = bounds.right - bounds.left; const groupHeight = bounds.bottom - bounds.top;
    const factor = Math.max(0.25, 1 + Math.max((growsLeft ? -dx : dx) / groupWidth, (growsTop ? -dy : dy) / groupHeight));
    const anchorX = growsLeft ? bounds.right : bounds.left; const anchorY = growsTop ? bounds.bottom : bounds.top;
    for (const item of resizeState.items) {
      const placed = pages[currentPage]?.words.find((current) => current.word.id === item.id);
      if (!placed) continue;
      const left = anchorX + (item.left - anchorX) * factor; const top = anchorY + (item.top - anchorY) * factor;
      placed.width = item.width * factor; placed.height = item.height * factor; placed.scale = item.scale * factor;
      placed.word.postScale = item.postScale * factor;
      placed.word.offsetX = left - placed.x; placed.word.offsetY = top - placed.y;
    }
    renderOverlay(); return;
  }
  if (!dragState) return;
  const point = svgPoint(event);
  const dx = point.x - dragState.startX; const dy = point.y - dragState.startY;
  if (Math.hypot(dx, dy) <= 2) return;
  if (!dragState.changed) { pushUndo(dragState.before); dragState.changed = true; }
  for (const item of dragState.items) {
    const placed = pages[currentPage]?.words.find((current) => current.word.id === item.id);
    if (placed) { placed.word.offsetX = item.offsetX + dx; placed.word.offsetY = item.offsetY + dy; }
  }
  renderOverlay();
});
async function regenerateSelectedWords() {
  if (!model) return;
  const selected = pages[currentPage]?.words.filter((placed) => selectedWordIds.has(placed.word.id)) ?? [];
  if (!selected.length) return;
  const before = captureDocument(); let changed = false;
  try {
    regenerateButton.disabled = true;
    setStatus(`Regenerating ${selected.length} word${selected.length === 1 ? "" : " groups"}...`);
    for (const placed of selected) {
      const offsets = model.write(placed.word.text, { bias: 0.6, style: placed.word.style, seed: Math.floor(Math.random() * 1_000_000) });
      const line = alignLine(offsetsToLine(offsets));
      const layout = innerSvg(lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink: BASE_INK, ribbonWidth: 1.35 }));
      if (correctionMode) await recognizeWordImage(await wordImageDataUrl(layout));
      placed.word.width = layout.width; placed.word.height = layout.height; placed.word.baseline = Math.max(0, Math.min(layout.height, baselineInSvg(line))); placed.word.body = layout.body;
      changed = true;
    }
    if (changed) pushUndo(before);
    renderOverlay(); setStatus("");
  } catch (error) {
    if (changed) pushUndo(before);
    renderOverlay(); setStatus(error instanceof Error ? error.message : String(error));
  }
  finally { regenerateButton.disabled = !pages[currentPage]?.words.some((placed) => selectedWordIds.has(placed.word.id)); }
}
regenerateButton.addEventListener("click", () => void regenerateSelectedWords());
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase(); const mod = event.ctrlKey || event.metaKey;
  const editingText = textArea.contains(document.activeElement);
  if (mod && key === "z" && !editingText) { event.preventDefault(); if (event.shiftKey) redoDocument(); else undoDocument(); return; }
  if (mod && key === "y" && !editingText) { event.preventDefault(); redoDocument(); return; }
  if (event.ctrlKey && key === "r" && selectedWordIds.size && pages.length) { event.preventDefault(); void regenerateSelectedWords(); }
});
preview.addEventListener("pointerup", () => {
  resizeState = null; dragState = null;
});
preview.addEventListener("pointercancel", () => { dragState = null; resizeState = null; renderOverlay(); });
document.addEventListener("pointerdown", (event) => {
  const target = event.target as Node;
  if (selectedWordIds.size && !preview.contains(target) && !regenerateButton.contains(target)) {
    selectedWordIds.clear();
    if (pages.length) renderOverlay();
  }
});
zoomOutButton.addEventListener("click", () => { pageZoom = Math.max(MIN_ZOOM, Math.round((pageZoom - 0.1) * 10) / 10); applyPageZoom(); });
zoomInButton.addEventListener("click", () => { pageZoom = Math.min(MAX_ZOOM, Math.round((pageZoom + 0.1) * 10) / 10); applyPageZoom(); });
zoomFitButton.addEventListener("click", () => { pageZoom = 1; applyPageZoom(); paperWrap.scrollTo({ left: 0, top: 0, behavior: "smooth" }); });
const pageResizeObserver = new ResizeObserver(() => { if (pages.length) applyPageZoom(); });
pageResizeObserver.observe(paperWrap);

downloadButton.addEventListener("click", async () => {
  if (!pages.length) return; downloadButton.disabled = true; setStatus(`Rendering ${pages.length} PNG page${pages.length === 1 ? "" : "s"}...`);
  try {
    const files: Array<{ name: string; data: Uint8Array }> = [];
    for (let i = 0; i < pages.length; i++) {
      setStatus(`Rendering page ${i + 1} of ${pages.length}...`);
      const blob = await pageToPng(pages[i]); files.push({ name: `page-${String(i + 1).padStart(2, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    downloadBlob(makeZip(files), "longhand-pages.zip"); setStatus(`Downloaded longhand-pages.zip (${pages.length} pages).`);
  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  finally { downloadButton.disabled = false; }
});
(async () => {
  try { model = await loadModel(); setStatus(""); generateButton.disabled = false; }
  catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
})();
