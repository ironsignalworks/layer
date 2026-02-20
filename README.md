# Layer

Layer is a browser-based collage and layout studio for fast, layer-driven visual work.
It supports multi-canvas projects, freeform composition, drawing tools, and production-ready export controls.

## Highlights (Current)

- Multi-canvas workflow with create/rename/delete and per-canvas settings
- Layer system with reorder, rename, hide/show, duplicate, rotate, resize, and multi-select
- Layer types: image, text, and stroke (brush-drawn vector-like polylines)
- Brush + eraser tools with size, opacity, and shape control (`round`, `square`, `triangle`)
- Inspector for layer metadata (`title`, `description`, URLs, tags, alt text)
- Text styling:
  - Google Font browser + dynamic loading
  - Custom font import (`.ttf`, `.otf`, `.woff`, `.woff2`)
  - Color, size, weight, italic, underline, alignment
- Visual treatment controls:
  - Per-layer presets (`zine`, `acid`, `retro`, `mono`, `neon`, `paper`)
  - Canvas-level preset + background color
  - Invert + opacity controls
- Composition aids:
  - Snap-to-grid with configurable grid size, snap strength, and alignment threshold
  - Alignment guides + shift-drag box selection
  - Zoom controls and canvas pan
- Export system:
  - Formats: `png`, `jpeg`, `webp`, `svg`, `ico`, `avif`, `gif`, `heic`
  - Size templates (A-series + social + HD/4K), custom dimensions, and scaling
  - JPEG/WEBP quality control
  - Optional filter inclusion during export
  - Final pass modes for raster output: `threshold`, `bitmap`, `posterize`, `duotone`
  - Live export preview with zoom/pan + estimated file size
- Print/snip workflow:
  - Print page overlay (`portrait` / `landscape`)
  - Draggable/resizable export snip frame
- Share flow:
  - Copy generated exported-image link
  - Display QR code for the generated share link
- Local-first persistence with undo/redo history
- File import via picker or drag-and-drop (images + supported text/JSON content)

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Radix UI primitives
- Lucide icons

## Local Development

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Build production bundle: `npm run build`

## Keyboard Shortcuts

- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: Redo
- `Ctrl/Cmd + D`: Duplicate selected layer(s)
- `Ctrl/Cmd + N`: Add image layer
- `Delete` / `Backspace`: Delete selected layer(s)
- `Esc`: Clear selection
- `V`: Select tool
- `B`: Brush tool
- `E`: Eraser tool

Live URL: `https://ironsignalworks.github.io/Layer/`

