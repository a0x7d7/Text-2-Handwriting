# Longhand Page Generator

A local Vite/TypeScript app using the Longhand handwriting synthesis engine. Type or paste text, choose handwriting style, ink colour and text size, generate as many A4 pages as needed, repair individual regions, and download all pages as PNG files inside one ZIP archive.

## Requirements

- Node.js 24 or newer
- npm
- Internet connection for dependency installation and the first model load

## Run on Windows PowerShell

Open PowerShell in this folder and run:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173/`.

## Use

1. Type or paste text in the left box.
2. Choose a handwriting style and ink colour.
3. Adjust **Text size**. Smaller values make the handwriting smaller and allow more characters per line; larger values make it bigger and wrap sooner. Line breaks are calculated from the measured handwriting width, not a fixed character count.
4. **Pair mode** groups isolated single letters with a neighboring word before generation. Select text and use **A− / A+** to adjust its local size. The **Text size** slider scales the whole document; word spacing, line spacing, and top spacing adjust the layout. Use the arrows above the preview to switch between blank and lined paper. **Correction mode** asks Gemini to check each generated word image once.
5. Click **Generate pages**. A percentage progress bar reports generation progress. Text automatically continues onto additional A4 pages when the current page runs out of vertical space.
6. Click a word or pair to select it. Hold **Shift** and click to select more. Use **Regenerate** or **Ctrl+R** to redraw the selection; drag it to move it or use a corner handle to resize it.
7. Use **Previous** and **Next** to inspect pages, and **− / +** or **Fit** to adjust the preview zoom.
8. Click **Download all pages (.zip)**. The ZIP contains one full-resolution PNG per page with all word changes applied.

Use **Ctrl+Z** to undo and **Ctrl+Y** or **Ctrl+Shift+Z** to redo page changes.

Regenerating a word creates a separate handwriting run; it may not connect naturally to adjacent cursive letters. Generating new pages replaces the current document.

## Notes

- Page size is A4 portrait (794 × 1123 SVG units; PNG export at 2× resolution).
- Normal generation happens in the browser. Correction Mode sends individual word images to Gemini for recognition. The Gemini key stays in the server-side Vercel function and is never included in client code.
- Set `GEMINI_API_KEY` in the Vercel project's Environment Variables and redeploy to enable Correction Mode. For local use, run the Vercel function with `vercel dev` and keep the key in `.env.local`.
- The model's supported alphabet is limited. Unsupported characters are replaced with spaces.
- The ZIP is assembled locally in the browser; no ZIP library or upload service is used.
- The upstream project notes that the model weights and Calligrapher engine have separate licensing limitations. Review the upstream README before redistributing this project or its model assets: https://github.com/tmarkovski/longhand
