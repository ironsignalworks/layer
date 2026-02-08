# Fanzinator

Fanzinator is a browser-based DIY graphic studio for building image-and-text compositions on a freeform canvas.
It is designed for quick visual work: import assets, place and style layers, manage multiple canvases, and export in common formats.

## What the app does

- Create and manage multiple canvases
- Add image and text layers
- Drag to position, resize, reorder, duplicate, hide, and delete layers
- Box-select and multi-select layers for fast editing
- Style text with:
  - Font family (including Google Fonts + custom font file import)
  - Size, color, alignment
  - Bold, italic, underline
- Use canvas presets and background color controls
- Use snap-to-grid and alignment guides while arranging elements
- Export output as `png`, `jpeg`, `webp`, `svg`, or `ico`
- Print canvas layouts, including an export snip frame
- Share canvas JSON or copy a generated image link
- Persist work in local browser storage

## Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Radix UI primitives
- Lucide icons

## Local development

1. Install dependencies:
   `npm install`
2. Run the dev server:
   `npm run dev`
3. Build for production:
   `npm run build`

## Keyboard shortcuts

- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Ctrl/Cmd + Y`: Redo
- `Ctrl/Cmd + D`: Duplicate selected layer(s)
- `Ctrl/Cmd + N`: Add image layer
- `Delete` / `Backspace`: Delete selected layer(s)
- `Esc`: Clear selection

Live URL:
`https://ironsignalworks.github.io/fanzinator/`
