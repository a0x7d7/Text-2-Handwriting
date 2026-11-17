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
const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <main class="shell">
    <header>
      <h1>Text 2 Handwriting</h1>
    </header>
    <section class="workspace">
      <div class="editor panel">
        <label for="text">Your text</label>
        <textarea id="text" spellcheck="false">The quick brown fox jumps over the lazy dog.

This is a handwriting sample generated with Longhand. Type anything you want in this box, then generate your pages.</textarea>
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
          <button id="repair" type="button" aria-pressed="false" disabled>Repair mode</button>
          <button id="download" disabled>Download all pages (.zip)</button>
        </div>
        <div id="generation-progress" class="generation-progress" hidden>
          <div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div>
          <span id="progress-percent">0%</span>
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
            <img id="preview" alt="Generated handwritten page preview" />
            <svg id="repair-overlay" viewBox="0 0 794 1123" aria-label="Repair selection overlay"></svg>
          </div>
          <div id="placeholder" class="placeholder">Your handwritten pages will appear here.</div>
        </div>
      </div>
    </section>
    <footer>Runs in your browser. Text and generated pages are not sent to a generation server.</footer>
  </main>`;

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const textArea = $("#text") as HTMLTextAreaElement;
const styleSelect = $("#style") as HTMLSelectElement;
const inkSelect = $("#ink") as HTMLSelectElement;
const textSize = $("#text-size") as HTMLInputElement;
const textSizeValue = $("#text-size-value") as HTMLOutputElement;
const generateButton = $("#generate") as HTMLButtonElement;
const repairButton = $("#repair") as HTMLButtonElement;
const downloadButton = $("#download") as HTMLButtonElement;
const prevButton = $("#prev-page") as HTMLButtonElement;
const nextButton = $("#next-page") as HTMLButtonElement;
const pageNumber = $("#page-number") as HTMLSpanElement;
const pageInfo = $("#page-info") as HTMLSpanElement;
const status = $("#status") as HTMLParagraphElement;
const generationProgress = $("#generation-progress") as HTMLDivElement;
const progressFill = $("#progress-fill") as HTMLDivElement;
const progressPercent = $("#progress-percent") as HTMLSpanElement;
const preview = $("#preview") as HTMLImageElement;
const placeholder = $("#placeholder") as HTMLDivElement;
const overlay = $("#repair-overlay") as SVGSVGElement;
const pageStage = $("#page-stage") as HTMLDivElement;
const paperWrap = $("#paper-wrap") as HTMLDivElement;
const zoomOutButton = $("#zoom-out") as HTMLButtonElement;
const zoomInButton = $("#zoom-in") as HTMLButtonElement;
const zoomFitButton = $("#zoom-fit") as HTMLButtonElement;
const zoomLevel = $("#zoom-level") as HTMLSpanElement;

interface RepairPatch {
  id: number; erase: { x: number; y: number; width: number; height: number };
  x: number; y: number; width: number; height: number; scale: number;
  offsetX: number; offsetY: number; body: string;
}
interface PageDocument { svg: string; patches: RepairPatch[] }
let model: CalligrapherModel | null = null;
let pages: PageDocument[] = [];
let currentPage = 0;
let currentPngUrl = "";
let repairMode = false;
let selecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionNow = { x: 0, y: 0 };
let dragPatchId: number | null = null;
let dragOffset = { x: 0, y: 0 };
let nextPatchId = 1;
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
function normalizeText(input: string, activeModel: CalligrapherModel): string {
  const replacements: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"', "—": "-", "–": "-", "…": "...", "\u00a0": " " };
  return [...input].map((char) => replacements[char] ?? char).join("")
    .split("\n").map((paragraph) => [...paragraph].map((char) => activeModel.supports(char) ? char : " ").join("").replace(/[ \t]+/g, " ").trim()).join("\n").trim();
}
function innerSvg(svgText: string): { width: number; height: number; body: string } {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml"); const root = parsed.documentElement;
  if (root.tagName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) throw new Error("The renderer returned invalid SVG.");
  const nums = (root.getAttribute("viewBox") ?? "0 0 1 1").trim().split(/\s+/).map(Number);
  return { width: nums[2] || 1, height: nums[3] || 1, body: [...root.childNodes].map((node) => new XMLSerializer().serializeToString(node)).join("") };
}
async function loadModel(): Promise<CalligrapherModel> {
  const response = await fetch(weightsUrl); if (!response.ok) throw new Error(`Could not load model weights (HTTP ${response.status}).`);
  return new CalligrapherModel(parseCalligrapherWeights(await response.arrayBuffer()));
}
async function buildPages(
  activeModel: CalligrapherModel,
  input: string,
  style: number,
  ink: string,
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
    const svg = lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink, ribbonWidth: 1.35 });
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
      // Yield so the browser can paint the progress indicator between model calls.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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
    output.push({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><rect width="100%" height="100%" fill="${PAPER}"/>${elements.join("\n")}</svg>`, patches: [] });
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
    const raw = lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink, ribbonWidth: 1.35 });
    const rawLayout = innerSvg(raw);
    const scale = Math.min(size, availableW / rawLayout.width);
    const rendered = lineToSvg(line, { renderer: "ribbon", scale, padding: 2, ink, ribbonWidth: 1.35 * scale });
    const layout = innerSvg(rendered);
    const gap = row.paragraphGap ? 10 * size : 0;
    const lineHeight = layout.height + 8 * size + gap;
    if (y + lineHeight > bottomY && elements.length) { finishPage(); startPage(); }
    y += gap;
    elements.push(`<svg x="${MARGIN_X}" y="${y.toFixed(1)}" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" overflow="visible">${layout.body}</svg>`);
    y += layout.height + 8 * size;
    renderedLines++;
    onProgress(65 + Math.round(renderedLines / Math.max(1, lineRows) * 35), `Rendering handwriting · ${renderedLines} of ${lineRows} lines`);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  if (elements.length || output.length === 0) finishPage();
  onProgress(100, `Finished · ${output.length} page${output.length === 1 ? "" : "s"}`);
  return output;
}
function svgPoint(event: PointerEvent) {
  const rect = overlay.getBoundingClientRect();
  return { x: Math.max(0, Math.min(PAGE_W, (event.clientX - rect.left) * PAGE_W / rect.width)), y: Math.max(0, Math.min(PAGE_H, (event.clientY - rect.top) * PAGE_H / rect.height)) };
}
function renderOverlay() {
  const patches = pages[currentPage]?.patches ?? [];
  const markup = patches.map((patch) => `<rect x="${patch.erase.x}" y="${patch.erase.y}" width="${patch.erase.width}" height="${patch.erase.height}" fill="${PAPER}"/><g data-patch-id="${patch.id}" class="repair-patch" transform="translate(${patch.x + patch.offsetX} ${patch.y + patch.offsetY}) scale(${patch.scale})"><svg width="${patch.width}" height="${patch.height}" viewBox="0 0 ${patch.width} ${patch.height}" overflow="visible">${patch.body}</svg><rect x="0" y="0" width="${patch.width}" height="${patch.height}" fill="transparent"/></g>`).join("");
  const selection = selecting ? `<rect class="selection-box" x="${Math.min(selectionStart.x, selectionNow.x)}" y="${Math.min(selectionStart.y, selectionNow.y)}" width="${Math.abs(selectionNow.x - selectionStart.x)}" height="${Math.abs(selectionNow.y - selectionStart.y)}"/>` : "";
  overlay.innerHTML = markup + selection;
}
function finalSvg(page: PageDocument): string {
  const parsed = new DOMParser().parseFromString(page.svg, "image/svg+xml"); const root = parsed.documentElement;
  const markup = page.patches.map((patch) => `<rect x="${patch.erase.x}" y="${patch.erase.y}" width="${patch.erase.width}" height="${patch.erase.height}" fill="${PAPER}"/><g transform="translate(${patch.x + patch.offsetX} ${patch.y + patch.offsetY}) scale(${patch.scale})"><svg width="${patch.width}" height="${patch.height}" viewBox="0 0 ${patch.width} ${patch.height}" overflow="visible">${patch.body}</svg></g>`).join("");
  const overlayDoc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, "image/svg+xml");
  for (const child of [...overlayDoc.documentElement.childNodes]) root.appendChild(parsed.importNode(child, true));
  return new XMLSerializer().serializeToString(root);
}
function renderCurrentPage() {
  if (!pages.length) return;
  if (currentPngUrl) URL.revokeObjectURL(currentPngUrl);
  currentPngUrl = URL.createObjectURL(new Blob([pages[currentPage].svg], { type: "image/svg+xml;charset=utf-8" }));
  preview.src = currentPngUrl; renderOverlay();
  pageNumber.textContent = `Page ${currentPage + 1} of ${pages.length}`;
  pageInfo.textContent = `A4 · ${pages.length} page${pages.length === 1 ? "" : "s"}`;
  prevButton.disabled = currentPage === 0; nextButton.disabled = currentPage === pages.length - 1;
  repairButton.disabled = false; downloadButton.disabled = false;
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

textSize.addEventListener("input", () => { textSizeValue.value = `${textSize.value}%`; textSizeValue.textContent = `${textSize.value}%`; });
generateButton.addEventListener("click", async () => {
  if (!model) return;
  generateButton.disabled = true; repairButton.disabled = true; downloadButton.disabled = true;
  generationProgress.hidden = false; progressFill.style.width = "0%"; progressPercent.textContent = "0%";
  setStatus("Starting generation...");
  try {
    const generated = await buildPages(model, textArea.value, Number(styleSelect.value), inkSelect.value, Number(textSize.value) / 100, (percent, message) => {
      progressFill.style.width = `${percent}%`; progressPercent.textContent = `${percent}%`; setStatus(message);
    });
    pages = generated;
    currentPage = 0; nextPatchId = 1; repairMode = false; selecting = false;
    repairButton.setAttribute("aria-pressed", "false"); overlay.classList.remove("repair-active");
    pageStage.hidden = false; placeholder.hidden = true; renderCurrentPage();
    setStatus("");
  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  finally { generateButton.disabled = false; repairButton.disabled = pages.length === 0; downloadButton.disabled = pages.length === 0; }
});
repairButton.addEventListener("click", () => {
  if (!pages.length) return;
  repairMode = !repairMode; overlay.classList.toggle("repair-active", repairMode);
  repairButton.setAttribute("aria-pressed", String(repairMode));
  setStatus(repairMode ? `Drag a box around the faulty area on page ${currentPage + 1}.` : "Repair mode off.");
});
prevButton.addEventListener("click", () => { if (currentPage > 0) { currentPage--; selecting = false; renderCurrentPage(); } });
nextButton.addEventListener("click", () => { if (currentPage < pages.length - 1) { currentPage++; selecting = false; renderCurrentPage(); } });
overlay.addEventListener("pointerdown", (event) => {
  if (!repairMode) return; const point = svgPoint(event); const target = (event.target as Element).closest<SVGGElement>("[data-patch-id]");
  if (target) {
    dragPatchId = Number(target.dataset.patchId); const patch = pages[currentPage].patches.find((item) => item.id === dragPatchId);
    if (patch) dragOffset = { x: point.x - patch.x - patch.offsetX, y: point.y - patch.y - patch.offsetY };
    overlay.setPointerCapture(event.pointerId); event.preventDefault(); return;
  }
  selecting = true; selectionStart = point; selectionNow = point; overlay.setPointerCapture(event.pointerId); renderOverlay();
});
overlay.addEventListener("pointermove", (event) => {
  if (dragPatchId !== null) {
    const patch = pages[currentPage].patches.find((item) => item.id === dragPatchId); if (patch) { const point = svgPoint(event); patch.offsetX = point.x - patch.x - dragOffset.x; patch.offsetY = point.y - patch.y - dragOffset.y; renderOverlay(); }
  } else if (selecting) { selectionNow = svgPoint(event); renderOverlay(); }
});
async function makeRepair(selection: { x: number; y: number; width: number; height: number }) {
  if (!model) return;
  const answer = window.prompt("What should be written in this area?"); if (answer === null || !answer.trim()) { setStatus("Repair cancelled."); return; }
  const replacement = normalizeText(answer.trim(), model).replace(/\n/g, " "); if (!replacement) { setStatus("That text contains no supported characters."); return; }
  setStatus("Generating replacement handwriting...");
  try {
    const offsets = model.write(replacement, { bias: 0.6, style: Number(styleSelect.value), seed: Math.floor(Math.random() * 1_000_000) });
    const line = alignLine(offsetsToLine(offsets));
    const rendered = lineToSvg(line, { renderer: "ribbon", scale: 1, padding: 2, ink: inkSelect.value, ribbonWidth: 1.35 }); const layout = innerSvg(rendered);
    // The highlighted rectangle is only the erase mask. Replacement handwriting
    // uses the same text-size setting as normal page generation, not the box dimensions.
    const scale = Number(textSize.value) / 100;
    pages[currentPage].patches.push({ id: nextPatchId++, erase: selection, x: selection.x, y: selection.y, width: layout.width, height: layout.height, scale, offsetX: 0, offsetY: 0, body: layout.body });
    renderOverlay(); setStatus("Repair added at the document's normal text size. Drag it to position it; the highlighted box is only the erased area.");
  } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
}
overlay.addEventListener("pointerup", async () => {
  if (dragPatchId !== null) { dragPatchId = null; return; } if (!selecting) return;
  selecting = false; const x = Math.min(selectionStart.x, selectionNow.x); const y = Math.min(selectionStart.y, selectionNow.y);
  const width = Math.abs(selectionNow.x - selectionStart.x); const height = Math.abs(selectionNow.y - selectionStart.y); renderOverlay();
  if (width < 12 || height < 12) { setStatus("Selection too small. Draw a larger box."); return; }
  await makeRepair({ x, y, width, height });
});
overlay.addEventListener("pointercancel", () => { selecting = false; dragPatchId = null; renderOverlay(); });
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
