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
4. Optionally turn on **Speed mode** for word-by-word generation and live word spacing, line spacing, and underhang controls. **Correction mode** appears when Speed mode is on and asks Gemini to check each generated word image once.
5. Click **Generate pages**. A percentage progress bar reports generation progress. Text automatically continues onto additional A4 pages when the current page runs out of vertical space.
6. Use **Previous** and **Next** to inspect pages.
7. To repair a page, enable **Repair mode**, drag a rectangle around the faulty area on the currently displayed page, and enter replacement text. The rectangle only defines what gets erased; the replacement is generated at the selected document text size, not squeezed into the rectangle.
8. Drag the normally sized replacement to reposition it. Repairs are kept separately for each page.
9. Use **− / +** to zoom the page preview independently, or **Fit** to return to the fitted view.
10. Click **Download all pages (.zip)**. The ZIP contains one full-resolution PNG per page, including repairs.

The selection rectangle is painted over with the paper colour. Each replacement is a separate generated handwriting run; it may not connect naturally to adjacent cursive letters. Re-generating clears all pages and repairs.

## Notes

- Page size is A4 portrait (794 × 1123 SVG units; PNG export at 2× resolution).
- Normal generation happens in the browser. Correction Mode sends individual word images to Gemini for recognition. The Gemini key stays in the server-side Vercel function and is never included in client code.
- Set `GEMINI_API_KEY` in the Vercel project's Environment Variables and redeploy to enable Correction Mode. For local use, run the Vercel function with `vercel dev` and keep the key in `.env.local`.
- The model's supported alphabet is limited. Unsupported characters are replaced with spaces.
- The ZIP is assembled locally in the browser; no ZIP library or upload service is used.
- The upstream project notes that the model weights and Calligrapher engine have separate licensing limitations. Review the upstream README before redistributing this project or its model assets: https://github.com/tmarkovski/longhand
