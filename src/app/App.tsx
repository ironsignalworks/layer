import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { LeftSidebar } from "./components/left-sidebar";
import { RightSidebar } from "./components/right-sidebar";
import { WorldCanvas } from "./components/world-canvas";
import { NodeData } from "./components/world-node";
import { Plus, ZoomIn, RotateCcw, RotateCw, Printer, Frame, Download, Crop, Link2, Info, PanelLeft, SlidersHorizontal, X, ChevronUp, ChevronDown, Upload } from "lucide-react";

const STORAGE_KEY = "Layer:canvas-editor:v2";
const RESET_KEY = "Layer:force-reset:v1";
const UI_SKIN_KEY = "Layer:ui-skin:v1";
const ONBOARDING_KEY = "Layer:onboarding:v1";
const SCHEMA_VERSION = 1;
const HISTORY_LIMIT = 50;
// 8.5x11 portrait at 96dpi-equivalent working units.
const DEFAULT_PRINT_AREA_PORTRAIT = { x: 0, y: 0, width: 816, height: 1056 };
const DEFAULT_PRINT_AREA_LANDSCAPE = { x: 0, y: 0, width: 1056, height: 816 };
const LOW_ZOOM_EXPONENT = 2.321928094887362;
type PrintOrientation = "portrait" | "landscape";

type Canvas = {
  id: string;
  name: string;
  nodes: NodeData[];
  snapEnabled: boolean;
  gridSize: number;
  alignThreshold: number;
  snapStrength: number;
  canvasPreset: "zine" | "acid" | "retro" | "mono" | "neon" | "paper" | "none";
  backgroundColor: string;
  printOrientation: PrintOrientation;
};

type Snapshot = {
  canvases: Canvas[];
  currentCanvasId: string;
};

type ExportFormat = "png" | "jpeg" | "webp" | "svg" | "ico" | "avif" | "gif" | "heic";
type FinalPassMode = "none" | "threshold" | "bitmap" | "posterize" | "duotone";
type UiSkin = "standard" | "fanzine" | "blade-runner" | "terminal" | "psy-ops";
type ExportPresentation = "shared" | "opened" | "downloaded";
type ExportTemplateId =
  | "custom"
  | "a1"
  | "a2"
  | "a3"
  | "a4"
  | "a5"
  | "instagram-square"
  | "instagram-portrait"
  | "instagram-story"
  | "tiktok-story"
  | "youtube-thumb"
  | "hd"
  | "full-hd"
  | "4k";
type StartTemplateCategory = "social" | "print" | "screen" | "mobile" | "paper";
type StartTemplateId = string;
type StartMoreSizeId =
  | "a0"
  | "a1"
  | "a2"
  | "a3"
  | "a5"
  | "letter"
  | "legal"
  | "tabloid"
  | "b5"
  | "postcard";
type VisualPreset = "zine" | "acid" | "retro" | "mono" | "neon" | "paper";
type FilterOp =
  | { kind: "grayscale"; value: number }
  | { kind: "contrast"; value: number }
  | { kind: "brightness"; value: number }
  | { kind: "saturate"; value: number }
  | { kind: "sepia"; value: number }
  | { kind: "hueRotate"; value: number };
type SupportPromptContext = "export" | "share" | "project";

const EXPORT_FORMAT_OPTIONS: ExportFormat[] = ["png", "jpeg", "webp", "svg", "ico", "avif", "gif", "heic"];
const UI_SKINS: UiSkin[] = ["standard", "fanzine", "blade-runner", "terminal", "psy-ops"];
const UI_SKIN_LABELS: Record<UiSkin, string> = {
  standard: "Standard",
  fanzine: "Layer Classic",
  "blade-runner": "Blade Runner",
  terminal: "Terminal",
  "psy-ops": "Psy-Ops",
};

const DONATION_URL = "https://donate.stripe.com/4gMdR25le5GXenHbrT5Ne00";
const ONBOARDING_STEPS: Array<{ title: string; description: string }> = [
  {
    title: "Import Assets",
    description:
      "Use Import from the top bar or right inspector to bring in images and text files quickly.",
  },
  {
    title: "Build Layers",
    description:
      "Add image and text layers from the left panel, then drag layers to reorder and toggle visibility.",
  },
  {
    title: "Edit Precisely",
    description:
      "Select a layer to edit metadata, text styles, opacity, presets, and media from the inspector.",
  },
  {
    title: "Export & Share",
    description:
      "Use Export Snip, Download, and Share Link in the top bar for final output and distribution.",
  },
];

const nextAutoCanvasName = (existingNames: Iterable<string>) => {
  const normalized = new Set(Array.from(existingNames, (name) => name.trim().toLowerCase()));
  let index = 1;
  while (normalized.has(`canvas${index}`)) index += 1;
  return `canvas${index}`;
};


const initialCanvases: Canvas[] = [
  {
    id: "canvas-1",
    name: "canvas1",
    nodes: [],
    snapEnabled: true,
    gridSize: 20,
    alignThreshold: 6,
    snapStrength: 1,
    canvasPreset: "none",
    backgroundColor: "#0a0a0a",
    printOrientation: "portrait",
  },
];

const EXPORT_TEMPLATES: Array<{
  id: ExportTemplateId;
  label: string;
  width: number;
  height: number;
}> = [
  { id: "custom", label: "Custom", width: 0, height: 0 },
  { id: "a1", label: "A1 (Portrait) - 2245 x 3179", width: 2245, height: 3179 },
  { id: "a2", label: "A2 (Portrait) - 1587 x 2245", width: 1587, height: 2245 },
  { id: "a3", label: "A3 (Portrait) - 1123 x 1587", width: 1123, height: 1587 },
  { id: "a4", label: "A4 (Portrait) - 794 x 1123", width: 794, height: 1123 },
  { id: "a5", label: "A5 (Portrait) - 559 x 794", width: 559, height: 794 },
  { id: "instagram-square", label: "Instagram Square - 1080 x 1080", width: 1080, height: 1080 },
  { id: "instagram-portrait", label: "Instagram Portrait - 1080 x 1350", width: 1080, height: 1350 },
  { id: "instagram-story", label: "Instagram Story - 1080 x 1920", width: 1080, height: 1920 },
  { id: "tiktok-story", label: "TikTok/Reels - 1080 x 1920", width: 1080, height: 1920 },
  { id: "youtube-thumb", label: "YouTube Thumbnail - 1280 x 720", width: 1280, height: 720 },
  { id: "hd", label: "HD - 1280 x 720", width: 1280, height: 720 },
  { id: "full-hd", label: "Full HD - 1920 x 1080", width: 1920, height: 1080 },
  { id: "4k", label: "4K UHD - 3840 x 2160", width: 3840, height: 2160 },
];

const START_TEMPLATES: Array<{
  id: StartTemplateId;
  category: StartTemplateCategory;
  label: string;
  width: number;
  height: number;
}> = [
  { id: "instagram-square", category: "social", label: "Instagram", width: 1080, height: 1080 },
  { id: "instagram-story", category: "social", label: "Insta Story", width: 1080, height: 1920 },
  { id: "instagram-portrait", category: "social", label: "Insta Portrait", width: 1080, height: 1350 },
  { id: "fb-cover", category: "social", label: "FB Page Cover", width: 1640, height: 664 },
  { id: "fb-event", category: "social", label: "FB Event Image", width: 1920, height: 1080 },
  { id: "fb-group-header", category: "social", label: "FB Group Header", width: 1640, height: 856 },
  { id: "x-post", category: "social", label: "X Post", width: 1600, height: 900 },
  { id: "linkedin-post", category: "social", label: "LinkedIn Post", width: 1200, height: 627 },
  { id: "pinterest-pin", category: "social", label: "Pinterest Pin", width: 1000, height: 1500 },

  { id: "a4", category: "print", label: "A4 Poster", width: 794, height: 1123 },
  { id: "a3", category: "print", label: "A3 Poster", width: 1123, height: 1587 },
  { id: "a2", category: "print", label: "A2 Poster", width: 1587, height: 2245 },
  { id: "letter", category: "print", label: "Letter", width: 816, height: 1056 },
  { id: "legal", category: "print", label: "Legal", width: 816, height: 1344 },
  { id: "tabloid", category: "print", label: "Tabloid", width: 1056, height: 1632 },

  { id: "youtube-thumb", category: "screen", label: "YouTube Thumb", width: 1280, height: 720 },
  { id: "full-hd", category: "screen", label: "Full HD", width: 1920, height: 1080 },
  { id: "4k", category: "screen", label: "4K UHD", width: 3840, height: 2160 },
  { id: "hd", category: "screen", label: "HD", width: 1280, height: 720 },
  { id: "uwqhd", category: "screen", label: "UWQHD", width: 3440, height: 1440 },
  { id: "presentation", category: "screen", label: "Presentation", width: 1920, height: 1080 },

  { id: "iphone-16-pro", category: "mobile", label: "iPhone 16 Pro", width: 1179, height: 2556 },
  { id: "iphone-16", category: "mobile", label: "iPhone 16", width: 1179, height: 2556 },
  { id: "pixel-8", category: "mobile", label: "Pixel 8", width: 1080, height: 2400 },
  { id: "android-common", category: "mobile", label: "Android Common", width: 1080, height: 2340 },
  { id: "mobile-banner", category: "mobile", label: "Mobile Banner", width: 640, height: 320 },
  { id: "story-vertical", category: "mobile", label: "Story Vertical", width: 1080, height: 1920 },

  { id: "a5-paper", category: "paper", label: "A5", width: 559, height: 794 },
  { id: "a4-paper", category: "paper", label: "A4", width: 794, height: 1123 },
  { id: "a3-paper", category: "paper", label: "A3", width: 1123, height: 1587 },
  { id: "a2-paper", category: "paper", label: "A2", width: 1587, height: 2245 },
  { id: "a1-paper", category: "paper", label: "A1", width: 2245, height: 3179 },
  { id: "letter-paper", category: "paper", label: "US Letter", width: 816, height: 1056 },
];

const START_TEMPLATE_TABS: Array<{ id: StartTemplateCategory; label: string }> = [
  { id: "social", label: "Social" },
  { id: "print", label: "Print" },
  { id: "screen", label: "Screen" },
  { id: "mobile", label: "Mobile" },
  { id: "paper", label: "Paper" },
];

const START_MORE_SIZES: Array<{
  id: StartMoreSizeId;
  label: string;
  width: number;
  height: number;
}> = [
  { id: "a5", label: "A5 - 559 x 794", width: 559, height: 794 },
  { id: "a3", label: "A3 - 1123 x 1587", width: 1123, height: 1587 },
  { id: "a2", label: "A2 - 1587 x 2245", width: 1587, height: 2245 },
  { id: "a1", label: "A1 - 2245 x 3179", width: 2245, height: 3179 },
  { id: "a0", label: "A0 - 3179 x 4494", width: 3179, height: 4494 },
  { id: "letter", label: "Letter - 816 x 1056", width: 816, height: 1056 },
  { id: "legal", label: "Legal - 816 x 1344", width: 816, height: 1344 },
  { id: "tabloid", label: "Tabloid - 1056 x 1632", width: 1056, height: 1632 },
  { id: "b5", label: "B5 - 709 x 1001", width: 709, height: 1001 },
  { id: "postcard", label: "Postcard - 1181 x 1748", width: 1181, height: 1748 },
];

const NODE_PRESET_FILTERS: Record<VisualPreset, string> = {
  zine: "grayscale(1) contrast(1.35)",
  acid: "saturate(3.2) contrast(1.6) brightness(1.25) hue-rotate(18deg)",
  retro: "saturate(0.7) contrast(0.9) sepia(0.2)",
  mono: "grayscale(1) contrast(1.05)",
  neon: "saturate(2.4) contrast(1.45) brightness(1.2)",
  paper: "contrast(0.9) brightness(1.05)",
};

const CANVAS_PRESET_FILTERS: Record<VisualPreset, string> = {
  zine: "grayscale(1) contrast(1.3)",
  acid: "saturate(3.4) contrast(1.7) brightness(1.2) hue-rotate(16deg)",
  retro: "saturate(0.7) contrast(0.9) sepia(0.25)",
  mono: "grayscale(1) contrast(1.05)",
  neon: "saturate(2.6) contrast(1.5) brightness(1.2)",
  paper: "contrast(0.9) brightness(1.05)",
};

const NODE_PRESET_OPS: Record<VisualPreset, FilterOp[]> = {
  zine: [
    { kind: "grayscale", value: 1 },
    { kind: "contrast", value: 1.35 },
  ],
  acid: [
    { kind: "saturate", value: 3.2 },
    { kind: "contrast", value: 1.6 },
    { kind: "brightness", value: 1.25 },
    { kind: "hueRotate", value: 18 },
  ],
  retro: [
    { kind: "saturate", value: 0.7 },
    { kind: "contrast", value: 0.9 },
    { kind: "sepia", value: 0.2 },
  ],
  mono: [
    { kind: "grayscale", value: 1 },
    { kind: "contrast", value: 1.05 },
  ],
  neon: [
    { kind: "saturate", value: 2.4 },
    { kind: "contrast", value: 1.45 },
    { kind: "brightness", value: 1.2 },
  ],
  paper: [
    { kind: "contrast", value: 0.9 },
    { kind: "brightness", value: 1.05 },
  ],
};

const CANVAS_PRESET_OPS: Record<VisualPreset, FilterOp[]> = {
  zine: [
    { kind: "grayscale", value: 1 },
    { kind: "contrast", value: 1.3 },
  ],
  acid: [
    { kind: "saturate", value: 3.4 },
    { kind: "contrast", value: 1.7 },
    { kind: "brightness", value: 1.2 },
    { kind: "hueRotate", value: 16 },
  ],
  retro: [
    { kind: "saturate", value: 0.7 },
    { kind: "contrast", value: 0.9 },
    { kind: "sepia", value: 0.25 },
  ],
  mono: [
    { kind: "grayscale", value: 1 },
    { kind: "contrast", value: 1.05 },
  ],
  neon: [
    { kind: "saturate", value: 2.6 },
    { kind: "contrast", value: 1.5 },
    { kind: "brightness", value: 1.2 },
  ],
  paper: [
    { kind: "contrast", value: 0.9 },
    { kind: "brightness", value: 1.05 },
  ],
};

const composeCssFilters = (filters: Array<string | undefined | null>) => {
  const composed = filters
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0 && value !== "none")
    .join(" ");
  return composed.length > 0 ? composed : "none";
};

const resolveNodePresetFilter = (preset?: NodeData["preset"]) =>
  preset ? NODE_PRESET_FILTERS[preset] : "none";

const resolveCanvasPresetFilter = (preset?: Canvas["canvasPreset"]) =>
  preset && preset !== "none" ? CANVAS_PRESET_FILTERS[preset] : "none";

const resolveNodePresetOps = (preset?: NodeData["preset"]) =>
  preset ? NODE_PRESET_OPS[preset] : [];

const resolveCanvasPresetOps = (preset?: Canvas["canvasPreset"]) =>
  preset && preset !== "none" ? CANVAS_PRESET_OPS[preset] : [];

const resolvePrintArea = (orientation: PrintOrientation) =>
  orientation === "landscape" ? DEFAULT_PRINT_AREA_LANDSCAPE : DEFAULT_PRINT_AREA_PORTRAIT;

const clamp255 = (value: number) => Math.max(0, Math.min(255, value));

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
};

const hueToRgb = (p: number, q: number, t: number) => {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
};

const hslToRgb = (h: number, s: number, l: number) => {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
};

const applyFilterOpsToImageData = (
  imageData: ImageData,
  ops: FilterOp[],
  invert: boolean
) => {
  const data = imageData.data;
  if (ops.length === 0 && !invert) return imageData;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (data[i + 3] === 0) continue;
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    for (const op of ops) {
      if (op.kind === "grayscale") {
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = y * op.value + r * (1 - op.value);
        g = y * op.value + g * (1 - op.value);
        b = y * op.value + b * (1 - op.value);
      } else if (op.kind === "contrast") {
        r = (r - 128) * op.value + 128;
        g = (g - 128) * op.value + 128;
        b = (b - 128) * op.value + 128;
      } else if (op.kind === "brightness") {
        r *= op.value;
        g *= op.value;
        b *= op.value;
      } else if (op.kind === "saturate") {
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = y + (r - y) * op.value;
        g = y + (g - y) * op.value;
        b = y + (b - y) * op.value;
      } else if (op.kind === "sepia") {
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = r * (1 - op.value) + sr * op.value;
        g = g * (1 - op.value) + sg * op.value;
        b = b * (1 - op.value) + sb * op.value;
      } else {
        const hsl = rgbToHsl(r, g, b);
        const hue = (hsl.h + op.value / 360 + 1) % 1;
        const rgb = hslToRgb(hue, hsl.s, hsl.l);
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
      }
      r = clamp255(r);
      g = clamp255(g);
      b = clamp255(b);
    }
    data[i] = Math.round(r);
    data[i + 1] = Math.round(g);
    data[i + 2] = Math.round(b);
  }
  return imageData;
};

const applyFilterOpsToCanvas = (
  canvas: HTMLCanvasElement,
  ops: FilterOp[],
  invert = false
) => {
  if (ops.length === 0 && !invert) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const next = applyFilterOpsToImageData(imageData, ops, invert);
  ctx.putImageData(next, 0, 0);
};

const drawEraserStamp = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: "round" | "square" | "triangle"
) => {
  const radius = Math.max(0.5, size / 2);
  if (shape === "square") {
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    return;
  }
  if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x - radius, y + radius);
    ctx.lineTo(x + radius, y + radius);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
};

const applyNodeErasePathsToCanvas = (
  ctx: CanvasRenderingContext2D,
  node: NodeData,
  scaleX = 1,
  scaleY = 1
) => {
  const erasePaths = node.erasePaths ?? [];
  if (erasePaths.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  erasePaths.forEach((erasePath) => {
    const points = erasePath.points ?? [];
    if (points.length === 0) return;
    const avgScale = Math.max(0.001, (Math.abs(scaleX) + Math.abs(scaleY)) / 2);
    const size = Math.max(1, erasePath.size * avgScale);
    const alpha = Math.max(0.05, Math.min(1, erasePath.opacity));
    ctx.globalAlpha = alpha;
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const px = point.x * scaleX;
      const py = point.y * scaleY;
      drawEraserStamp(ctx, px, py, size, erasePath.shape);
      if (i === 0) continue;
      const prev = points[i - 1];
      const prevX = prev.x * scaleX;
      const prevY = prev.y * scaleY;
      const dx = px - prevX;
      const dy = py - prevY;
      const distance = Math.hypot(dx, dy);
      const step = Math.max(0.75, size * 0.28);
      const count = Math.max(1, Math.ceil(distance / step));
      for (let stepIndex = 1; stepIndex < count; stepIndex += 1) {
        const t = stepIndex / count;
        const ix = prevX + dx * t;
        const iy = prevY + dy * t;
        drawEraserStamp(ctx, ix, iy, size, erasePath.shape);
      }
    }
  });
  ctx.restore();
};

const buildSvgEraseMaskDefinition = (
  node: NodeData,
  maskId: string,
  offsetX: number,
  offsetY: number,
  scaleX: number,
  scaleY: number,
  width: number,
  height: number
) => {
  const erasePaths = node.erasePaths ?? [];
  if (erasePaths.length === 0) return "";
  const body: string[] = [
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${offsetX}" y="${offsetY}" width="${width}" height="${height}">`,
    `<rect x="${offsetX}" y="${offsetY}" width="${width}" height="${height}" fill="white" />`,
  ];
  erasePaths.forEach((erasePath) => {
    if (!erasePath.points || erasePath.points.length === 0) return;
    const opacity = Math.max(0.05, Math.min(1, erasePath.opacity));
    const strokeWidth = Math.max(1, erasePath.size * Math.max(0.001, (Math.abs(scaleX) + Math.abs(scaleY)) / 2));
    const points = erasePath.points
      .map((point) => `${offsetX + point.x * scaleX},${offsetY + point.y * scaleY}`)
      .join(" ");
    if (erasePath.points.length > 1) {
      body.push(
        `<polyline points="${points}" fill="none" stroke="black" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linecap="${
          erasePath.shape === "round" ? "round" : erasePath.shape === "square" ? "square" : "butt"
        }" stroke-linejoin="${
          erasePath.shape === "triangle" ? "bevel" : erasePath.shape === "square" ? "miter" : "round"
        }" />`
      );
    } else {
      const single = erasePath.points[0];
      const radius = Math.max(0.5, strokeWidth / 2);
      const px = offsetX + single.x * scaleX;
      const py = offsetY + single.y * scaleY;
      if (erasePath.shape === "square") {
        body.push(
          `<rect x="${px - radius}" y="${py - radius}" width="${radius * 2}" height="${radius * 2}" fill="black" fill-opacity="${opacity}" />`
        );
      } else if (erasePath.shape === "triangle") {
        body.push(
          `<polygon points="${px},${py - radius} ${px - radius},${py + radius} ${px + radius},${py + radius}" fill="black" fill-opacity="${opacity}" />`
        );
      } else {
        body.push(
          `<circle cx="${px}" cy="${py}" r="${radius}" fill="black" fill-opacity="${opacity}" />`
        );
      }
    }
  });
  body.push(`</mask>`);
  return body.join("");
};

const applyFinalPassToCanvas = (
  canvas: HTMLCanvasElement,
  mode: FinalPassMode,
  amount: number
) => {
  if (mode === "none") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const intensity = Math.max(0, Math.min(1, amount));

  if (mode === "bitmap") {
    const step = Math.max(2, Math.round(2 + intensity * 18));
    const w = Math.max(1, Math.round(canvas.width / step));
    const h = Math.max(1, Math.round(canvas.height / step));
    const tiny = document.createElement("canvas");
    tiny.width = w;
    tiny.height = h;
    const tinyCtx = tiny.getContext("2d");
    if (!tinyCtx) return;
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.drawImage(canvas, 0, 0, w, h);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const thresholdCutoff = Math.round(64 + intensity * 150);
  const levels = Math.max(2, Math.round(2 + intensity * 8));
  const light = { r: 244, g: 242, b: 231 };
  const dark = { r: 17, g: 17, b: 17 };

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    if (mode === "threshold" || mode === "bitmap") {
      const v = y >= thresholdCutoff ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      continue;
    }

    if (mode === "posterize") {
      const step = 255 / (levels - 1);
      data[i] = Math.round(Math.round(r / step) * step);
      data[i + 1] = Math.round(Math.round(g / step) * step);
      data[i + 2] = Math.round(Math.round(b / step) * step);
      continue;
    }

    if (mode === "duotone") {
      const t = y / 255;
      data[i] = Math.round(dark.r + (light.r - dark.r) * t);
      data[i + 1] = Math.round(dark.g + (light.g - dark.g) * t);
      data[i + 2] = Math.round(dark.b + (light.b - dark.b) * t);
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

export default function App() {
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [canvases, setCanvases] = useState<Canvas[]>(initialCanvases);
  const [currentCanvasId, setCurrentCanvasId] = useState(initialCanvases[0]?.id ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [historyPast, setHistoryPast] = useState<Snapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Snapshot[]>([]);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPrintArea, setShowPrintArea] = useState(true);
  const [showSizeHelper, setShowSizeHelper] = useState(true);
  const [sizeHelperBounds, setSizeHelperBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printLayout, setPrintLayout] = useState<{ offsetX: number; offsetY: number; scale: number } | null>(null);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [printFrame, setPrintFrame] = useState<{ x: number; y: number; width: number; height: number; enabled: boolean }>({
    x: 0,
    y: 0,
    width: 480,
    height: 320,
    enabled: false,
  });
  const [customFont, setCustomFont] = useState<{ name: string; dataUrl: string } | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportWidth, setExportWidth] = useState(1200);
  const [exportHeight, setExportHeight] = useState(800);
  const [exportTemplate, setExportTemplate] = useState<ExportTemplateId>("custom");
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(1);
  const [exportAutoScale, setExportAutoScale] = useState(true);
  const [exportQuality, setExportQuality] = useState(0.92);
  const [exportIncludeFilters, setExportIncludeFilters] = useState(true);
  const [exportFinalPass, setExportFinalPass] = useState<FinalPassMode>("none");
  const [exportFinalPassAmount, setExportFinalPassAmount] = useState(0.65);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string>("");
  const [isExportPreviewLoading, setIsExportPreviewLoading] = useState(false);
  const [exportEstimatedBytes, setExportEstimatedBytes] = useState<number | null>(null);
  const [exportPreviewZoom, setExportPreviewZoom] = useState(1);
  const [exportPreviewPan, setExportPreviewPan] = useState({ x: 0, y: 0 });
  const [isExportPreviewDragging, setIsExportPreviewDragging] = useState(false);
  const [isExportFormatMenuOpen, setIsExportFormatMenuOpen] = useState(false);
  const [isExportTemplateMenuOpen, setIsExportTemplateMenuOpen] = useState(false);
  const [isExportScaleMenuOpen, setIsExportScaleMenuOpen] = useState(false);
  const [isExportFinalPassMenuOpen, setIsExportFinalPassMenuOpen] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState("");
  const [showShareQr, setShowShareQr] = useState(false);
  const [showSupportPrompt, setShowSupportPrompt] = useState(false);
  const [supportPromptContext, setSupportPromptContext] = useState<SupportPromptContext>("export");
  const [supportPromptNote, setSupportPromptNote] = useState("");
  const exportFormatMenuRef = useRef<HTMLDivElement | null>(null);
  const exportTemplateMenuRef = useRef<HTMLDivElement | null>(null);
  const exportScaleMenuRef = useRef<HTMLDivElement | null>(null);
  const exportFinalPassMenuRef = useRef<HTMLDivElement | null>(null);
  const shareModalRef = useRef<HTMLDivElement | null>(null);
  const supportModalRef = useRef<HTMLDivElement | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);
  const exportModalRef = useRef<HTMLDivElement | null>(null);
  const aboutModalRef = useRef<HTMLDivElement | null>(null);
  const onboardingModalRef = useRef<HTMLDivElement | null>(null);
  const startModalRef = useRef<HTMLDivElement | null>(null);
  const startMoreSizesMenuRef = useRef<HTMLDivElement | null>(null);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMobileLeftSidebar, setShowMobileLeftSidebar] = useState(false);
  const [showMobileRightSidebar, setShowMobileRightSidebar] = useState(false);
  const [uiSkin, setUiSkin] = useState<UiSkin>("standard");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startProjectName, setStartProjectName] = useState("New Project");
  const [startCategory, setStartCategory] = useState<StartTemplateCategory>("social");
  const [startTemplate, setStartTemplate] = useState<StartTemplateId>("instagram-square");
  const [isStartMoreSizesOpen, setIsStartMoreSizesOpen] = useState(false);
  const [selectedStartMoreSizeId, setSelectedStartMoreSizeId] = useState<StartMoreSizeId | null>(null);
  const [startWidthInput, setStartWidthInput] = useState("1080");
  const [startHeightInput, setStartHeightInput] = useState("1080");
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "brush" | "eraser">("select");
  const [historyLog, setHistoryLog] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [brushPreset, setBrushPreset] = useState<"ink" | "marker" | "chalk">("marker");
  const [brushShape, setBrushShape] = useState<"round" | "square" | "triangle">("round");
  const [brushSize, setBrushSize] = useState(6);
  const [brushColor, setBrushColor] = useState("#fafafa");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [eraserSize, setEraserSize] = useState(12);
  const [eraserFormat, setEraserFormat] = useState<"round" | "square" | "triangle">("round");
  const [eraserOpacity, setEraserOpacity] = useState(1);
  const dragDepthRef = useRef(0);
  const exportAspectRatioRef = useRef(1200 / 800);
  const exportPreviewDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const clampZoom = (value: number) => Math.min(200, Math.max(50, Math.round(value)));
  const clampPreviewZoom = (value: number) => Math.min(6, Math.max(1, value));
  const zoomToCanvasScale = (zoom: number) =>
    zoom <= 100 ? Math.pow(zoom / 100, LOW_ZOOM_EXPONENT) : 1 + (zoom - 100) / 100;
  const shareQrCodeUrl = shareImageUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=0&data=${encodeURIComponent(shareImageUrl)}`
    : "";
  const openSupportPrompt = (context: SupportPromptContext, note = "") => {
    setSupportPromptContext(context);
    setSupportPromptNote(note);
    setShowSupportPrompt(true);
  };
  const supportPromptLead =
    supportPromptContext === "share"
      ? "Share generated."
      : supportPromptContext === "project"
      ? "Project saved."
      : "Export complete.";
  const handleZoomChange = (value: number) => {
    setZoomLevel(clampZoom(value));
  };

  const handleCycleUiSkin = () => {
    setUiSkin((prev) => {
      const currentIndex = UI_SKINS.indexOf(prev);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % UI_SKINS.length : 0;
      return UI_SKINS[nextIndex];
    });
  };
  const uiSkinLabel = UI_SKIN_LABELS[uiSkin];
  const onboardingTotal = ONBOARDING_STEPS.length;
  const isOnboardingLastStep = onboardingStep >= onboardingTotal - 1;
  const activeOnboardingStep = ONBOARDING_STEPS[Math.min(onboardingStep, onboardingTotal - 1)];
  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "done");
    setShowOnboarding(false);
    setOnboardingStep(0);
  }, []);

  const handleNukeAndRestart = async () => {
    const shouldProceed = window.confirm(
      "Reset will clear saved Layer data/cache and restart the app. Continue?"
    );
    if (!shouldProceed) return;

    try {
      // Remove known keys first.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RESET_KEY);

      // Remove any project-scoped keys.
      Object.keys(localStorage)
        .filter((key) => key.startsWith("Layer:"))
        .forEach((key) => localStorage.removeItem(key));
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith("Layer:"))
        .forEach((key) => sessionStorage.removeItem(key));

      // Clear Cache Storage entries when available.
      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      // Clear IndexedDB databases when API is available.
      const idbAny = indexedDB as unknown as { databases?: () => Promise<Array<{ name?: string }>> };
      if (typeof idbAny.databases === "function") {
        const dbs = await idbAny.databases();
        await Promise.all(
          dbs.map(
            (db) =>
              new Promise<void>((resolve) => {
                if (!db.name) return resolve();
                const request = indexedDB.deleteDatabase(db.name);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              })
          )
        );
      }
    } finally {
      window.location.reload();
    }
  };

  const hasDroppedFiles = (dataTransfer: DataTransfer | null) =>
    Array.from(dataTransfer?.types ?? []).includes("Files");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => {
      const isMobile = mediaQuery.matches;
      setIsMobileViewport(isMobile);
      if (!isMobile) {
        setShowMobileLeftSidebar(false);
        setShowMobileRightSidebar(false);
      }
    };
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (!showMobileLeftSidebar && !showMobileRightSidebar) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMobileViewport, showMobileLeftSidebar, showMobileRightSidebar]);

  useEffect(() => {
    return () => {
      if (shareImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(shareImageUrl);
      }
    };
  }, [shareImageUrl]);

  useEffect(() => {
    const storedSkin = localStorage.getItem(UI_SKIN_KEY) as UiSkin | null;
    if (storedSkin && UI_SKINS.includes(storedSkin)) {
      setUiSkin(storedSkin);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY) !== "done") {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_SKIN_KEY, uiSkin);
  }, [uiSkin]);

  useEffect(() => {
    const needsReset = localStorage.getItem(RESET_KEY) !== "done";
    if (needsReset) {
      const freshCanvas: Canvas = {
        id: `canvas-${Date.now()}`,
        name: "canvas1",
        nodes: [],
        snapEnabled: true,
        gridSize: 20,
        alignThreshold: 6,
        snapStrength: 1,
        canvasPreset: "none",
        backgroundColor: "#0a0a0a",
        printOrientation: "portrait",
      };
      setCanvases([freshCanvas]);
      setCurrentCanvasId(freshCanvas.id);
      setSelectedNodeIds([]);
      setHistoryPast([]);
      setHistoryFuture([]);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ canvases: [freshCanvas], currentCanvasId: freshCanvas.id })
      );
      localStorage.setItem(RESET_KEY, "done");
      setShowStartModal(true);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setShowStartModal(true);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<
        Snapshot & { worlds?: Canvas[]; currentWorldId?: string }
      >;
      const storedCanvases = parsed.canvases ?? parsed.worlds;
      const storedCurrentId = parsed.currentCanvasId ?? parsed.currentWorldId;
      if (storedCanvases?.length) {
        const placeholderNames = new Set([
          "Main Canvas",
          "Experiments",
          "Client Work",
          "Archive",
        ]);
        const existingNames = new Set<string>();
        const normalized = storedCanvases
          .filter((canvas) => !placeholderNames.has(canvas.name))
          .map((canvas) => {
            const raw = (canvas.name ?? "").trim();
            const baseName =
              raw === "" || raw === "New Canvas" || raw === "Untitled"
                ? nextAutoCanvasName(existingNames)
                : raw;
            const finalName = uniqueCanvasName(baseName, existingNames);
            existingNames.add(finalName);
            return {
              ...canvas,
              name: finalName,
              backgroundColor: canvas.backgroundColor ?? "#0a0a0a",
              printOrientation: canvas.printOrientation ?? "portrait",
            };
          });
        if (normalized.length > 0) {
          setCanvases(normalized);
          setCurrentCanvasId(storedCurrentId || normalized[0].id);
          setShowStartModal(!normalized.some((canvas) => (canvas.nodes?.length ?? 0) > 0));
        } else {
          const freshCanvas: Canvas = {
            id: `canvas-${Date.now()}`,
            name: "canvas1",
            nodes: [],
            snapEnabled: true,
            gridSize: 20,
            alignThreshold: 6,
            snapStrength: 1,
            canvasPreset: "none",
            backgroundColor: "#0a0a0a",
            printOrientation: "portrait",
          };
          setCanvases([freshCanvas]);
          setCurrentCanvasId(freshCanvas.id);
          setShowStartModal(true);
        }
        setSelectedNodeIds([]);
        setHistoryPast([]);
        setHistoryFuture([]);
      }
      if (!storedCanvases || storedCanvases.length === 0) {
        const freshCanvas: Canvas = {
          id: `canvas-${Date.now()}`,
          name: "canvas1",
          nodes: [],
          snapEnabled: true,
          gridSize: 20,
          alignThreshold: 6,
          snapStrength: 1,
          canvasPreset: "none",
          backgroundColor: "#0a0a0a",
          printOrientation: "portrait",
        };
        setCanvases([freshCanvas]);
        setCurrentCanvasId(freshCanvas.id);
        setSelectedNodeIds([]);
        setHistoryPast([]);
        setHistoryFuture([]);
        setShowStartModal(true);
      }
    } catch {
      // Ignore malformed storage
      setShowStartModal(true);
    }
  }, []);

  useEffect(() => {
    const activeModal =
      (showStartModal ? startModalRef.current : null) ??
      (showOnboarding ? onboardingModalRef.current : null) ??
      (showSupportPrompt ? supportModalRef.current : null) ??
      (showExport ? exportModalRef.current : null) ??
      (expandedNodeId ? previewModalRef.current : null) ??
      (showShareQr ? shareModalRef.current : null) ??
      (showAbout ? aboutModalRef.current : null);
    if (!activeModal) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusRaf = window.requestAnimationFrame(() => {
      const firstFocusable = activeModal.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? activeModal).focus();
    });

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (showStartModal) {
          setShowStartModal(false);
          return;
        }
        if (showOnboarding) {
          completeOnboarding();
          return;
        }
        if (showSupportPrompt) {
          setShowSupportPrompt(false);
          return;
        }
        if (showExport) {
          setShowExport(false);
          return;
        }
        if (expandedNodeId) {
          setExpandedNodeId(null);
          return;
        }
        if (showShareQr) {
          setShowShareQr(false);
          return;
        }
        if (showAbout) {
          setShowAbout(false);
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusables = Array.from(
        activeModal.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      if (focusables.length === 0) {
        event.preventDefault();
        activeModal.focus();
        return;
      }
      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      } else if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    };

    document.addEventListener("keydown", handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(focusRaf);
      document.removeEventListener("keydown", handleModalKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [showStartModal, showOnboarding, showSupportPrompt, showExport, expandedNodeId, showShareQr, showAbout, completeOnboarding]);

  useEffect(() => {
    setSaveStatus("saving");
    const payload = JSON.stringify({ canvases, currentCanvasId });
    try {
      localStorage.setItem(STORAGE_KEY, payload);
      setSaveStatus("saved");
      setSaveErrorMessage(null);
    } catch (error) {
      // Large imported files can exceed storage quota on mobile browsers.
      // Keep the editor running even if autosave fails.
      setSaveStatus("error");
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        setSaveErrorMessage("Autosave full. Free storage or export your project file.");
      } else {
        setSaveErrorMessage("Autosave failed. Recent edits may not persist after refresh.");
      }
    }
  }, [canvases, currentCanvasId]);

  useEffect(() => {
    if (!customFont) return;
    const styleId = "Layer-custom-font";
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @font-face {
        font-family: "${customFont.name}";
        src: url("${customFont.dataUrl}");
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }, [customFont]);

  const cloneSnapshot = (snapshot: Snapshot): Snapshot =>
    JSON.parse(JSON.stringify(snapshot)) as Snapshot;

  const recordHistory = (label = "Edit") => {
    const snapshot = cloneSnapshot({ canvases, currentCanvasId });
    setHistoryPast((prev) => {
      const next = [...prev, snapshot];
      return next.slice(-HISTORY_LIMIT);
    });
    setHistoryFuture([]);
    setHistoryLog((prev) => {
      const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return [`${stamp} ${label}`, ...prev].slice(0, 25);
    });
  };

  const currentCanvas = canvases.find((canvas) => canvas.id === currentCanvasId) ?? null;

  const selectedNode =
    currentCanvas?.nodes.find((node) => node.id === selectedNodeIds[0]) || null;
  const expandedNode = useMemo(() => {
    if (!currentCanvas || !expandedNodeId) return null;
    return currentCanvas.nodes.find((node) => node.id === expandedNodeId) ?? null;
  }, [currentCanvas, expandedNodeId]);

  const updateNode = (id: string, updates: Partial<NodeData>) => {
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              nodes: canvas.nodes.map((node) =>
                node.id === id ? { ...node, ...updates } : node
              ),
            }
          : canvas
      )
    );
  };

  const updateNodeLive = (id: string, updates: Partial<NodeData>) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              nodes: canvas.nodes.map((node) =>
                node.id === id ? { ...node, ...updates } : node
              ),
            }
          : canvas
      )
    );
  };

  const createStrokeNodeLive = (node: NodeData) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              nodes: [...canvas.nodes, node],
            }
          : canvas
      )
    );
    setSelectedNodeIds([node.id]);
  };

  const deleteNodesLive = (ids: string[]) => {
    if (ids.length === 0) return;
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? { ...canvas, nodes: canvas.nodes.filter((node) => !ids.includes(node.id)) }
          : canvas
      )
    );
    setSelectedNodeIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleAddTextLayer = () => {
    if (!currentCanvas) return;
    recordHistory();
    const now = Date.now();
    const newNode: NodeData = {
      id: `text-${now}`,
      type: "text",
      title: "Text",
      x: 240,
      y: 220,
      visible: true,
      tags: [],
      description: "",
      altText: "",
      rotation: 0,
      invertColors: false,
      textStyle: {
        fontSize: 14,
        bold: false,
        italic: false,
        underline: false,
        align: "center",
        color: "#e6e6e6",
      },
      motionReduced: false,
    };
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? { ...canvas, nodes: [...canvas.nodes, newNode] }
          : canvas
      )
    );
    setSelectedNodeIds([newNode.id]);
  };

  const handleImportFont = async (file: File) => {
    if (file.size > maxFileSize) {
      window.alert("File is too large. Please use a file under 5MB.");
      return;
    }
    try {
      if (file.type === "application/json") {
        const raw = await readFileAsText(file);
        const parsed = JSON.parse(raw) as { name?: string; dataUrl?: string };
        if (parsed?.name && parsed?.dataUrl) {
          setCustomFont({ name: parsed.name, dataUrl: parsed.dataUrl });
        } else {
          window.alert("Font JSON must include name and dataUrl.");
        }
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const name = file.name.replace(/\.[^/.]+$/, "");
      setCustomFont({ name, dataUrl });
    } catch {
      window.alert("Failed to import font.");
    }
  };


  const updateCanvasPreset = (preset: Canvas["canvasPreset"]) => {
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, canvasPreset: preset } : canvas
      )
    );
  };

  const updateCanvasBackground = (color: string) => {
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? { ...canvas, backgroundColor: color, canvasPreset: "none" }
          : canvas
      )
    );
  };

  const toggleCanvasPrintOrientation = () => {
    if (!currentCanvas) return;
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              printOrientation:
                canvas.printOrientation === "landscape" ? "portrait" : "landscape",
            }
          : canvas
      )
    );
  };

  const flipCurrentCanvas = (axis: "horizontal" | "vertical") => {
    if (!currentCanvas) return;
    if (currentCanvas.nodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    currentCanvas.nodes.forEach((node) => {
      const size = getNodeSize(node);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + size.width);
      maxY = Math.max(maxY, node.y + size.height);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return;
    }
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) => {
        if (canvas.id !== currentCanvasId) return canvas;
        return {
          ...canvas,
          nodes: canvas.nodes.map((node) => {
            const size = getNodeSize(node);
            const nextX = axis === "horizontal" ? minX + maxX - (node.x + size.width) : node.x;
            const nextY = axis === "vertical" ? minY + maxY - (node.y + size.height) : node.y;
            const nextStrokePoints =
              node.type === "stroke" && node.strokePoints
                ? node.strokePoints.map((point) => ({
                    x: axis === "horizontal" ? Math.max(0, size.width - point.x) : point.x,
                    y: axis === "vertical" ? Math.max(0, size.height - point.y) : point.y,
                  }))
                : node.strokePoints;
            return {
              ...node,
              x: nextX,
              y: nextY,
              strokePoints: nextStrokePoints,
            };
          }),
        };
      })
    );
  };

  const handleReorderNodes = (sourceId: string, targetId: string) => {
    if (!currentCanvas) return;
    const nodes = currentCanvas.nodes.slice();
    const sourceIndex = nodes.findIndex((node) => node.id === sourceId);
    const targetIndex = nodes.findIndex((node) => node.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [moved] = nodes.splice(sourceIndex, 1);
    nodes.splice(targetIndex, 0, moved);
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId ? { ...canvas, nodes } : canvas
      )
    );
  };


  const handleAddNode = () => {
    if (!currentCanvas) return;
    recordHistory();
    const currentNodes = currentCanvas?.nodes ?? [];
    const nextIndex = currentNodes.length + 1;
    const newNode: NodeData = {
      id: String(Date.now()),
      type: "image",
      title: `Untitled ${nextIndex}`,
      x: 200 + (currentNodes.length % 4) * 120,
      y: 200 + Math.floor(currentNodes.length / 4) * 120,
      visible: true,
      tags: [],
      description: "",
      altText: "",
      rotation: 0,
      layerColor: "#2a2a2a",
      invertColors: false,
      motionReduced: false,
    };
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? { ...canvas, nodes: [...canvas.nodes, newNode] }
          : canvas
      )
    );
    setSelectedNodeIds([newNode.id]);
  };

  const maxFileSize = 5 * 1024 * 1024;
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Unable to read file."));
        }
      };
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });
  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Unable to read file."));
        }
      };
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsText(file);
    });

  const handleHeaderUpload = async (file: File) => {
    if (!currentCanvas) return;
    if (file.size > maxFileSize) {
      window.alert("File is too large. Please use a file under 5MB.");
      return;
    }
    try {
      const isImage = file.type.startsWith("image/");
      const isText = file.type === "text/plain" || file.type === "application/json";
      if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
        window.alert("Only image and text imports are enabled.");
        return;
      }
      if (!isImage && !isText) {
        window.alert("Only image and text imports are enabled.");
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const description = isText ? await readFileAsText(file) : "";
      const type: NodeData["type"] = isImage ? "image" : "text";
      const now = Date.now();
      const newNode: NodeData = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        title: file.name.replace(/\.[^/.]+$/, ""),
        x: 200 + (currentCanvas.nodes.length % 4) * 120,
        y: 200 + Math.floor(currentCanvas.nodes.length / 4) * 120,
        visible: true,
        tags: [],
        description,
        altText: "",
        thumbnail: isImage ? dataUrl : undefined,
        mediaUrl: dataUrl,
        rotation: 0,
        invertColors: false,
        motionReduced: false,
      };
      recordHistory();
      setCanvases((prev) =>
        prev.map((canvas) =>
          canvas.id === currentCanvasId
            ? { ...canvas, nodes: [...canvas.nodes, newNode] }
            : canvas
        )
      );
      setSelectedNodeIds([newNode.id]);
    } catch {
      window.alert("Failed to upload file.");
    }
  };

  const handleDroppedFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const droppedFiles = Array.from(files);
    for (const file of droppedFiles) {
      await handleHeaderUpload(file);
    }
  };


  const handleDeleteNodes = (ids: string[]) => {
    if (ids.length === 0) return;
    if (!currentCanvas) return;
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? { ...canvas, nodes: canvas.nodes.filter((node) => !ids.includes(node.id)) }
          : canvas
      )
    );
    setSelectedNodeIds([]);
  };

  const handleDuplicateNodes = (ids: string[]) => {
    if (!currentCanvas) return;
    const sources = currentCanvas?.nodes.filter((node) => ids.includes(node.id)) ?? [];
    if (sources.length === 0) return;
    recordHistory();
    const now = Date.now();
    const duplicates = sources.map((source, index) => ({
      ...source,
      id: `${now}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      x: source.x + 24,
      y: source.y + 24,
      title: `${source.title} Copy`,
    }));
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? { ...canvas, nodes: [...canvas.nodes, ...duplicates] }
          : canvas
      )
    );
    setSelectedNodeIds(duplicates.map((node) => node.id));
  };

  const handleMoveNodes = (updates: { id: string; x: number; y: number }[]) => {
    if (!currentCanvas) return;
    const updateMap = new Map(updates.map((item) => [item.id, item]));
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              nodes: canvas.nodes.map((node) => {
                const update = updateMap.get(node.id);
                return update ? { ...node, x: update.x, y: update.y } : node;
              }),
            }
          : canvas
      )
    );
  };

  const handleMoveCommit = () => {
    recordHistory();
  };

  const handleNodeClick = (node: NodeData) => {
    if (!isPlaying) return;
    setExpandedNodeId(node.id);
  };

  const handleTogglePlay = async () => {
    if (!isPlaying) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Ignore fullscreen errors.
      }
      setIsPlaying(true);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    setIsPlaying(false);
  };

  const getNodeSize = (node: NodeData) => {
    if (node.width && node.height) return { width: node.width, height: node.height };
    switch (node.type) {
      case "video":
        return { width: 224, height: 128 };
      case "interactive":
        return { width: 176, height: 176 };
      case "text":
        return { width: 220, height: 96 };
      case "stroke":
        return { width: node.width ?? 1, height: node.height ?? 1 };
      default:
        return { width: 192, height: 192 };
    }
  };

  const getVisibleNodes = () =>
    (currentCanvas?.nodes ?? []).filter((node) => node.visible !== false);

  const getExportBounds = (nodes: NodeData[]) => {
    if (showSizeHelper && sizeHelperBounds) {
      return {
        minX: sizeHelperBounds.x,
        minY: sizeHelperBounds.y,
        width: Math.max(1, sizeHelperBounds.width),
        height: Math.max(1, sizeHelperBounds.height),
      };
    }
    if (printFrame.enabled) {
      return {
        minX: printFrame.x,
        minY: printFrame.y,
        width: Math.max(1, printFrame.width),
        height: Math.max(1, printFrame.height),
      };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
      const size = getNodeSize(node);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + size.width);
      maxY = Math.max(maxY, node.y + size.height);
    });
    return {
      minX,
      minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  };

  const openExportPanel = () => {
    resetExportPreviewTransform();
    const nodes = getVisibleNodes();
    if (nodes.length > 0) {
      const bounds = getExportBounds(nodes);
      const nextWidth = Math.max(64, Math.round(bounds.width));
      const nextHeight = Math.max(64, Math.round(bounds.height));
      setExportTemplate("custom");
      setExportWidth(nextWidth);
      setExportHeight(nextHeight);
      exportAspectRatioRef.current = nextWidth / Math.max(1, nextHeight);
    }
    setShowExport(true);
  };

  useEffect(() => {
    if (!showSizeHelper || !sizeHelperBounds) return;
    const helperWidth = Math.max(16, Math.round(sizeHelperBounds.width));
    const helperHeight = Math.max(16, Math.round(sizeHelperBounds.height));
    setExportTemplate("custom");
    setExportWidth((prev) => (prev === helperWidth ? prev : helperWidth));
    setExportHeight((prev) => (prev === helperHeight ? prev : helperHeight));
    exportAspectRatioRef.current = helperWidth / Math.max(1, helperHeight);
  }, [showSizeHelper, sizeHelperBounds]);

  const handleToggleExportAutoScale = () => {
    setExportAutoScale((prev) => {
      const next = !prev;
      if (next) {
        exportAspectRatioRef.current = exportWidth / Math.max(1, exportHeight);
      }
      return next;
    });
  };

  const handleSelectExportTemplate = (templateId: ExportTemplateId) => {
    setExportTemplate(templateId);
    if (templateId === "custom") return;
    const selected = EXPORT_TEMPLATES.find((template) => template.id === templateId);
    if (!selected) return;
    const nextWidth = Math.max(16, Math.round(selected.width));
    const nextHeight = Math.max(16, Math.round(selected.height));
    setExportWidth(nextWidth);
    setExportHeight(nextHeight);
    exportAspectRatioRef.current = nextWidth / Math.max(1, nextHeight);
  };

  const flipSelectedImage = (axis: "horizontal" | "vertical") => {
    if (!selectedNode || selectedNode.type !== "image") return;
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) => {
        if (canvas.id !== currentCanvasId) return canvas;
        return {
          ...canvas,
          nodes: canvas.nodes.map((node) => {
            if (node.id !== selectedNode.id) return node;
            return axis === "horizontal"
              ? { ...node, flipX: !node.flipX }
              : { ...node, flipY: !node.flipY };
          }),
        };
      })
    );
  };

  const handleSelectStartTemplate = (templateId: StartTemplateId) => {
    setStartTemplate(templateId);
    setSelectedStartMoreSizeId(null);
    const selected = START_TEMPLATES.find((template) => template.id === templateId);
    if (!selected) return;
    setStartWidthInput(String(Math.max(0, Math.round(selected.width))));
    setStartHeightInput(String(Math.max(0, Math.round(selected.height))));
  };

  const handleSelectStartMoreSize = (sizeId: StartMoreSizeId) => {
    const selected = START_MORE_SIZES.find((item) => item.id === sizeId);
    if (!selected) return;
    setStartTemplate("custom");
    setSelectedStartMoreSizeId(sizeId);
    setStartWidthInput(String(Math.max(0, Math.round(selected.width))));
    setStartHeightInput(String(Math.max(0, Math.round(selected.height))));
    setIsStartMoreSizesOpen(false);
  };

  const applyStartTemplate = () => {
    const parsedWidth = Number(startWidthInput);
    const parsedHeight = Number(startHeightInput);
    const width = Math.max(1, Math.round(Number.isFinite(parsedWidth) ? parsedWidth : 0));
    const height = Math.max(1, Math.round(Number.isFinite(parsedHeight) ? parsedHeight : 0));
    const exportTemplateMatch = EXPORT_TEMPLATES.find(
      (template) => template.width === width && template.height === height
    );
    setExportTemplate((exportTemplateMatch?.id as ExportTemplateId | undefined) ?? "custom");
    setExportWidth(width);
    setExportHeight(height);
    exportAspectRatioRef.current = width / Math.max(1, height);
    setPrintFrame({
      x: 0,
      y: 0,
      width,
      height,
      enabled: false,
    });
    setShowPrintArea(false);
    setIsStartMoreSizesOpen(false);
    const nextName = startProjectName.trim();
    if (nextName) {
      setCanvases((prev) =>
        prev.map((canvas) =>
          canvas.id === currentCanvasId ? { ...canvas, name: nextName } : canvas
        )
      );
    }
    setShowStartModal(false);
  };

  const startTemplateComparisonBounds = useMemo(() => {
    const maxWidth = Math.max(...START_TEMPLATES.map((template) => template.width));
    const maxHeight = Math.max(...START_TEMPLATES.map((template) => template.height));
    return { maxWidth, maxHeight };
  }, []);
  const startTemplateRenditionScale = useMemo(() => {
    const previewMax = 88;
    return Math.min(
      previewMax / Math.max(1, startTemplateComparisonBounds.maxWidth),
      previewMax / Math.max(1, startTemplateComparisonBounds.maxHeight)
    );
  }, [startTemplateComparisonBounds]);
  const startTemplatesForCategory = useMemo(
    () => START_TEMPLATES.filter((template) => template.category === startCategory),
    [startCategory]
  );

  const handleExportWidthChange = (value: number) => {
    setExportTemplate("custom");
    const nextWidth = Math.max(16, Math.round(value) || 16);
    if (!exportAutoScale) {
      setExportWidth(nextWidth);
      return;
    }
    const ratio = exportAspectRatioRef.current || 1;
    const nextHeight = Math.max(16, Math.round(nextWidth / ratio));
    setExportWidth(nextWidth);
    setExportHeight(nextHeight);
  };

  const handleExportHeightChange = (value: number) => {
    setExportTemplate("custom");
    const nextHeight = Math.max(16, Math.round(value) || 16);
    if (!exportAutoScale) {
      setExportHeight(nextHeight);
      return;
    }
    const ratio = exportAspectRatioRef.current || 1;
    const nextWidth = Math.max(16, Math.round(nextHeight * ratio));
    setExportHeight(nextHeight);
    setExportWidth(nextWidth);
  };

  const resetExportPreviewTransform = () => {
    setExportPreviewZoom(1);
    setExportPreviewPan({ x: 0, y: 0 });
    setIsExportPreviewDragging(false);
    exportPreviewDragRef.current = null;
  };

  const handleExportPreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!exportPreviewUrl) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setExportPreviewZoom((prev) => {
      const next = clampPreviewZoom(prev + direction * 0.2);
      if (next <= 1) {
        setExportPreviewPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleExportPreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (exportPreviewZoom <= 1 || !exportPreviewUrl) return;
    event.preventDefault();
    setIsExportPreviewDragging(true);
    exportPreviewDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: exportPreviewPan.x,
      originY: exportPreviewPan.y,
    };
  };

  const handleExportPreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isExportPreviewDragging || !exportPreviewDragRef.current) return;
    const drag = exportPreviewDragRef.current;
    setExportPreviewPan({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const handleExportPreviewMouseUp = () => {
    setIsExportPreviewDragging(false);
    exportPreviewDragRef.current = null;
  };

  const handleExportPreviewDoubleClick = (event: React.MouseEvent<HTMLDivElement | HTMLImageElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resetExportPreviewTransform();
  };

  const readImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = src;
    });

  const blobFromCanvas = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to encode export"));
          return;
        }
        resolve(blob);
      }, type, quality);
    });

  const canEncodeCanvasMimeType = (mimeType: string) => {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    try {
      return probe.toDataURL(mimeType).startsWith(`data:${mimeType}`);
    } catch {
      return false;
    }
  };

  const buildIcoBlobFromPng = async (pngBlob: Blob, width: number, height: number) => {
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const iconHeader = new ArrayBuffer(22);
    const view = new DataView(iconHeader);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    view.setUint8(6, width >= 256 ? 0 : width);
    view.setUint8(7, height >= 256 ? 0 : height);
    view.setUint8(8, 0);
    view.setUint8(9, 0);
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
    view.setUint32(14, pngBytes.byteLength, true);
    view.setUint32(18, 22, true);
    const headerBytes = new Uint8Array(iconHeader);
    const out = new Uint8Array(headerBytes.byteLength + pngBytes.byteLength);
    out.set(headerBytes, 0);
    out.set(pngBytes, headerBytes.byteLength);
    return new Blob([out], { type: "image/x-icon" });
  };

  const presentExportBlob = async (blob: Blob, fileName: string): Promise<ExportPresentation> => {
    const canShareToPhotos = /^image\/(png|jpeg|webp|gif|avif|heic)$/i.test(blob.type);
    if (isMobileViewport && canShareToPhotos && typeof File !== "undefined" && typeof navigator.share === "function") {
      try {
        const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
        await navigator.share({ files: [file], title: fileName });
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
      }
    }

    const url = URL.createObjectURL(blob);
    try {
      if (isMobileViewport) {
        window.open(url, "_blank", "noopener,noreferrer");
        return "opened";
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return "downloaded";
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

  const escapeXml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const buildExportSvgMarkup = (
    nodes: NodeData[],
    bounds: { minX: number; minY: number; width: number; height: number },
    renderWidth: number,
    renderHeight: number,
    options?: { includeFilters?: boolean }
  ) => {
    if (!currentCanvas) return "";
    const includeFilters = options?.includeFilters ?? true;
    const scaleX = renderWidth / bounds.width;
    const scaleY = renderHeight / bounds.height;
    const canvasPreset = currentCanvas.canvasPreset;
    const canvasFilter = includeFilters ? resolveCanvasPresetFilter(canvasPreset) : "none";
    const includeCanvasGrain = includeFilters && canvasPreset !== "none";
    const parts: string[] = [];
    const defsParts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${renderWidth} ${renderHeight}">`
    );
    if (includeCanvasGrain) {
      const grainColor = canvasPreset === "paper" ? "0,0,0" : "255,255,255";
      const grainAlpha = canvasPreset === "paper" ? "0.08" : "0.12";
      defsParts.push(
        `<pattern id="canvas-grain" patternUnits="userSpaceOnUse" width="3" height="3"><circle cx="1" cy="1" r="0.6" fill="rgba(${grainColor},${grainAlpha})" /></pattern>`
      );
    }
    if (canvasFilter !== "none") {
      parts.push(`<g style="filter:${escapeXml(canvasFilter)}">`);
    }
    parts.push(`<rect x="0" y="0" width="${renderWidth}" height="${renderHeight}" fill="${escapeXml(currentCanvas.backgroundColor)}" />`);
    nodes.forEach((node) => {
      const size = getNodeSize(node);
      const x = (node.x - bounds.minX) * scaleX;
      const y = (node.y - bounds.minY) * scaleY;
      const w = size.width * scaleX;
      const h = size.height * scaleY;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const opacity = Math.max(0, Math.min(1, node.opacity ?? 1));
      const rotation = node.rotation ?? 0;
      const nodeMaskId = `node-erase-mask-${node.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const hasEraseMask = (node.erasePaths?.length ?? 0) > 0;
      if (hasEraseMask) {
        defsParts.push(
          buildSvgEraseMaskDefinition(
            node,
            nodeMaskId,
            x,
            y,
            scaleX,
            scaleY,
            Math.max(1, size.width * scaleX),
            Math.max(1, size.height * scaleY)
          )
        );
      }
      const nodeFilter = composeCssFilters([
        includeFilters ? resolveNodePresetFilter(node.preset) : undefined,
        includeFilters && node.invertColors ? "invert(1)" : undefined,
      ]);
      const nodeFilterAttr = nodeFilter !== "none" ? ` style="filter:${escapeXml(nodeFilter)}"` : "";
      parts.push(`<g opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"${nodeFilterAttr}>`);
      if (node.type === "stroke" && (node.strokePoints?.length ?? 0) > 1) {
        const strokePoints =
          node.strokePoints
            ?.map((point) => `${x + point.x * scaleX},${y + point.y * scaleY}`)
            .join(" ") ?? "";
        parts.push(
          `<polyline points="${strokePoints}" fill="none" stroke="${escapeXml(
            node.strokeColor ?? "#fafafa"
          )}" stroke-width="${Math.max(1, (node.strokeWidth ?? 6) * Math.min(scaleX, scaleY))}" stroke-linecap="${
            node.strokeShape === "round" ? "round" : "butt"
          }" stroke-linejoin="${
            node.strokeShape === "triangle" ? "bevel" : node.strokeShape === "square" ? "miter" : "round"
          }"${hasEraseMask ? ` mask="url(#${nodeMaskId})"` : ""} />`
        );
      } else if (node.type === "text") {
        const textStyle = node.textStyle ?? {};
        const align = textStyle.align ?? "center";
        const textAnchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
        const textX = align === "left" ? x + 8 : align === "right" ? x + w - 8 : x + w / 2;
        const textY = y + h / 2;
        const textColor = textStyle.color ?? "#e6e6e6";
        parts.push(
          `<text x="${textX}" y="${textY}" dominant-baseline="middle" text-anchor="${textAnchor}" fill="${escapeXml(
            textColor
          )}" font-size="${Math.max(
            10,
            Math.min(512, textStyle.fontSize ?? 14)
          )}" font-family="${escapeXml(textStyle.fontFamily ?? "IBM Plex Mono, monospace")}" font-weight="${textStyle.bold ? 700 : 300}" font-style="${textStyle.italic ? "italic" : "normal"}" text-decoration="${
            textStyle.underline ? "underline" : "none"
          }"${hasEraseMask ? ` mask="url(#${nodeMaskId})"` : ""}>${escapeXml(node.title || "Text")}</text>`
        );
      } else if (node.type !== "stroke") {
        const imageSrc = node.mediaUrl || node.thumbnail || "";
        const isImage =
          (node.mediaUrl?.startsWith("data:image/") ||
            node.mediaUrl?.startsWith("blob:") ||
            /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(node.mediaUrl || "")) ||
          (node.thumbnail?.length ?? 0) > 0;
        if (isImage && imageSrc) {
          if (node.flipX || node.flipY) {
            parts.push(
              `<g transform="translate(${node.flipX ? x + w : x} ${node.flipY ? y + h : y}) scale(${node.flipX ? -1 : 1} ${node.flipY ? -1 : 1})"><image href="${escapeXml(imageSrc)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${hasEraseMask ? ` mask="url(#${nodeMaskId})"` : ""} /></g>`
            );
          } else {
            parts.push(
              `<image href="${escapeXml(imageSrc)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${hasEraseMask ? ` mask="url(#${nodeMaskId})"` : ""} />`
            );
          }
        } else {
          parts.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeXml(
              node.layerColor ?? "rgba(255,255,255,0.08)"
            )}"${hasEraseMask ? ` mask="url(#${nodeMaskId})"` : ""} />`
          );
          parts.push(
            `<text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle" fill="#8a8a8a" font-size="12">${escapeXml(
              node.type
            )}</text>`
          );
        }
      }
      parts.push(`</g>`);
    });
    if (defsParts.length > 0) {
      parts.splice(1, 0, `<defs>${defsParts.join("")}</defs>`);
    }
    if (canvasFilter !== "none") {
      parts.push(`</g>`);
    }
    if (includeCanvasGrain) {
      parts.push(`<rect x="0" y="0" width="${renderWidth}" height="${renderHeight}" fill="url(#canvas-grain)" />`);
    }
    parts.push("</svg>");
    return parts.join("");
  };

  const applyCanvasPresetGrain = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    canvasPreset: Canvas["canvasPreset"]
  ) => {
    if (canvasPreset === "none") return;
    const grainCanvas = document.createElement("canvas");
    grainCanvas.width = width;
    grainCanvas.height = height;
    const grainCtx = grainCanvas.getContext("2d");
    if (!grainCtx) return;
    const grainData = grainCtx.createImageData(width, height);
    const pixels = grainData.data;
    const grainBaseAlpha = canvasPreset === "paper" ? 0.08 : 0.12;
    const grainColor = canvasPreset === "paper" ? 0 : 255;
    let seed = ((width * 73856093) ^ (height * 19349663) ^ canvasPreset.charCodeAt(0)) >>> 0;
    const nextRandom = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let y = 0; y < height; y += 3) {
      for (let x = 0; x < width; x += 3) {
        const index = (y * width + x) * 4;
        const alpha = grainBaseAlpha * (0.35 + 0.65 * nextRandom());
        pixels[index] = grainColor;
        pixels[index + 1] = grainColor;
        pixels[index + 2] = grainColor;
        pixels[index + 3] = Math.round(alpha * 255);
      }
    }
    grainCtx.putImageData(grainData, 0, 0);
    ctx.drawImage(grainCanvas, 0, 0);
  };

  const renderExportCanvas = async (
    nodes: NodeData[],
    bounds: { minX: number; minY: number; width: number; height: number },
    renderWidth: number,
    renderHeight: number,
    options?: { includeFilters?: boolean }
  ) => {
    if (!currentCanvas) throw new Error("No active canvas");
    const includeFilters = options?.includeFilters ?? true;
    const scaleX = renderWidth / bounds.width;
    const scaleY = renderHeight / bounds.height;
    const canvas = document.createElement("canvas");
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Export context not available.");
    ctx.fillStyle = currentCanvas.backgroundColor;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    for (const node of nodes) {
      const size = getNodeSize(node);
      const x = (node.x - bounds.minX) * scaleX;
      const y = (node.y - bounds.minY) * scaleY;
      const w = size.width * scaleX;
      const h = size.height * scaleY;
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, node.opacity ?? 1));
      ctx.translate(cx, cy);
      ctx.rotate(((node.rotation ?? 0) * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      if (node.type === "stroke" && (node.strokePoints?.length ?? 0) > 1) {
        const nodeCanvas = document.createElement("canvas");
        nodeCanvas.width = Math.max(1, Math.round(w));
        nodeCanvas.height = Math.max(1, Math.round(h));
        const nodeCtx = nodeCanvas.getContext("2d");
        if (!nodeCtx) {
          ctx.restore();
          continue;
        }
        nodeCtx.strokeStyle = node.strokeColor ?? "#fafafa";
        nodeCtx.lineWidth = Math.max(1, (node.strokeWidth ?? 6) * Math.min(scaleX, scaleY));
        nodeCtx.lineCap = node.strokeShape === "round" ? "round" : "butt";
        nodeCtx.lineJoin = node.strokeShape === "triangle" ? "bevel" : node.strokeShape === "square" ? "miter" : "round";
        nodeCtx.beginPath();
        const first = node.strokePoints?.[0];
        if (first) {
          nodeCtx.moveTo(first.x * scaleX, first.y * scaleY);
          node.strokePoints?.slice(1).forEach((point) => {
            nodeCtx.lineTo(point.x * scaleX, point.y * scaleY);
          });
          nodeCtx.stroke();
        }
        applyNodeErasePathsToCanvas(
          nodeCtx,
          node,
          nodeCanvas.width / Math.max(1, size.width),
          nodeCanvas.height / Math.max(1, size.height)
        );
        ctx.drawImage(nodeCanvas, x, y, w, h);
      } else if (node.type === "text") {
        const nodeOps = includeFilters ? resolveNodePresetOps(node.preset) : [];
        const textStyle = node.textStyle ?? {};
        const fontSize = Math.max(10, Math.min(512, textStyle.fontSize ?? 14)) * Math.min(scaleX, scaleY);
        const fontFamily = (textStyle.fontFamily ?? "IBM Plex Mono").replace(/"/g, "");
        const nodeCanvas = document.createElement("canvas");
        nodeCanvas.width = Math.max(1, Math.round(w));
        nodeCanvas.height = Math.max(1, Math.round(h));
        const nodeCtx = nodeCanvas.getContext("2d");
        if (!nodeCtx) {
          ctx.restore();
          continue;
        }
        nodeCtx.fillStyle = textStyle.color ?? "#e6e6e6";
        nodeCtx.textBaseline = "middle";
        nodeCtx.font = `${textStyle.italic ? "italic " : ""}${textStyle.bold ? "700" : "300"} ${fontSize}px "${fontFamily}", monospace`;
        if ((textStyle.align ?? "center") === "left") {
          nodeCtx.textAlign = "left";
          nodeCtx.fillText(node.title || "Text", 8, h / 2, Math.max(1, w - 16));
        } else if ((textStyle.align ?? "center") === "right") {
          nodeCtx.textAlign = "right";
          nodeCtx.fillText(node.title || "Text", w - 8, h / 2, Math.max(1, w - 16));
        } else {
          nodeCtx.textAlign = "center";
          nodeCtx.fillText(node.title || "Text", w / 2, h / 2, Math.max(1, w - 16));
        }
        applyFilterOpsToCanvas(nodeCanvas, nodeOps, includeFilters && Boolean(node.invertColors));
        applyNodeErasePathsToCanvas(
          nodeCtx,
          node,
          nodeCanvas.width / Math.max(1, size.width),
          nodeCanvas.height / Math.max(1, size.height)
        );
        ctx.drawImage(nodeCanvas, x, y, w, h);
      } else if (node.type !== "stroke") {
        const nodeOps = includeFilters ? resolveNodePresetOps(node.preset) : [];
        const src = node.mediaUrl || node.thumbnail || "";
        const isImage =
          (node.mediaUrl?.startsWith("data:image/") ||
            node.mediaUrl?.startsWith("blob:") ||
            /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(node.mediaUrl || "")) ||
          (node.thumbnail?.length ?? 0) > 0;
        if (isImage && src) {
          try {
            const image = await readImage(src);
            const nodeCanvas = document.createElement("canvas");
            nodeCanvas.width = Math.max(1, Math.round(w));
            nodeCanvas.height = Math.max(1, Math.round(h));
            const nodeCtx = nodeCanvas.getContext("2d");
            if (!nodeCtx) {
              ctx.restore();
              continue;
            }
            const sourceRatio = image.width / image.height;
            const targetRatio = w / h;
            let drawW = w;
            let drawH = h;
            let drawX = 0;
            let drawY = 0;
            if (sourceRatio > targetRatio) {
              drawH = w / sourceRatio;
              drawY = (h - drawH) / 2;
            } else {
              drawW = h * sourceRatio;
              drawX = (w - drawW) / 2;
            }
            nodeCtx.save();
            if (node.flipX || node.flipY) {
              nodeCtx.translate(nodeCanvas.width / 2, nodeCanvas.height / 2);
              nodeCtx.scale(node.flipX ? -1 : 1, node.flipY ? -1 : 1);
              nodeCtx.translate(-nodeCanvas.width / 2, -nodeCanvas.height / 2);
            }
            nodeCtx.drawImage(image, drawX, drawY, drawW, drawH);
            nodeCtx.restore();
            applyFilterOpsToCanvas(nodeCanvas, nodeOps, includeFilters && Boolean(node.invertColors));
            applyNodeErasePathsToCanvas(
              nodeCtx,
              node,
              nodeCanvas.width / Math.max(1, size.width),
              nodeCanvas.height / Math.max(1, size.height)
            );
            ctx.drawImage(nodeCanvas, x, y, w, h);
          } catch {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(x, y, w, h);
          }
        } else {
          const nodeCanvas = document.createElement("canvas");
          nodeCanvas.width = Math.max(1, Math.round(w));
          nodeCanvas.height = Math.max(1, Math.round(h));
          const nodeCtx = nodeCanvas.getContext("2d");
          if (!nodeCtx) {
            ctx.restore();
            continue;
          }
          nodeCtx.fillStyle = node.layerColor ?? "rgba(255,255,255,0.08)";
          nodeCtx.fillRect(0, 0, nodeCanvas.width, nodeCanvas.height);
          nodeCtx.fillStyle = "#8a8a8a";
          nodeCtx.textAlign = "center";
          nodeCtx.textBaseline = "middle";
          nodeCtx.font = `${12 * Math.min(scaleX, scaleY)}px sans-serif`;
          nodeCtx.fillText(node.type.toUpperCase(), nodeCanvas.width / 2, nodeCanvas.height / 2);
          applyNodeErasePathsToCanvas(
            nodeCtx,
            node,
            nodeCanvas.width / Math.max(1, size.width),
            nodeCanvas.height / Math.max(1, size.height)
          );
          ctx.drawImage(nodeCanvas, x, y, w, h);
        }
      }
      ctx.restore();
    }
    const canvasOps = includeFilters ? resolveCanvasPresetOps(currentCanvas.canvasPreset) : [];
    if (canvasOps.length > 0) {
      applyFilterOpsToCanvas(canvas, canvasOps, false);
      applyCanvasPresetGrain(ctx, renderWidth, renderHeight, currentCanvas.canvasPreset);
    }
    return canvas;
  };

  const runExport = async () => {
    if (!currentCanvas) return;
    try {
      const nodes = getVisibleNodes();
      if (nodes.length === 0) {
        window.alert("Nothing to export.");
        return;
      }
      const bounds = getExportBounds(nodes);
      const width =
        showSizeHelper && sizeHelperBounds
          ? Math.max(16, Math.round(sizeHelperBounds.width))
          : Math.max(16, Math.round(exportWidth));
      const height =
        showSizeHelper && sizeHelperBounds
          ? Math.max(16, Math.round(sizeHelperBounds.height))
          : Math.max(16, Math.round(exportHeight));
      const renderWidth = width * exportScale;
      const renderHeight = height * exportScale;
      const fileBase = (currentCanvas.name || "canvas").trim().toLowerCase().replace(/\s+/g, "-") || "canvas";

      if (exportFormat === "svg") {
        if (exportFinalPass !== "none") {
          window.alert("Final pass is not applied to SVG exports.");
        }
        const svgMarkup = buildExportSvgMarkup(nodes, bounds, renderWidth, renderHeight, {
          includeFilters: exportIncludeFilters,
        });
        const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
        await presentExportBlob(svgBlob, `${fileBase}.svg`);
        setShowExport(false);
        openSupportPrompt("export");
        return;
      }

      const canvas = await renderExportCanvas(nodes, bounds, renderWidth, renderHeight, {
        includeFilters: exportIncludeFilters,
      });
      applyFinalPassToCanvas(canvas, exportFinalPass, exportFinalPassAmount);

      const mimeType =
        exportFormat === "jpeg"
          ? "image/jpeg"
          : exportFormat === "webp"
          ? "image/webp"
          : exportFormat === "avif"
          ? "image/avif"
          : exportFormat === "gif"
          ? "image/gif"
          : exportFormat === "heic"
          ? "image/heic"
          : "image/png";
      if (!canEncodeCanvasMimeType(mimeType)) {
        window.alert(`${exportFormat.toUpperCase()} export is not supported in this browser. Try PNG, JPEG, or WEBP.`);
        return;
      }
      const blob = await blobFromCanvas(
        canvas,
        mimeType,
        exportFormat === "jpeg" || exportFormat === "webp" || exportFormat === "avif" ? exportQuality : undefined
      );
      const outputBlob =
        exportFormat === "ico"
          ? await buildIcoBlobFromPng(await blobFromCanvas(canvas, "image/png"), renderWidth, renderHeight)
          : blob;
      const extension = exportFormat === "jpeg" ? "jpg" : exportFormat;
      const presentation = await presentExportBlob(outputBlob, `${fileBase}.${extension}`);
      setShowExport(false);
      const mobilePhotoNote =
        isMobileViewport && /^image\/(png|jpeg|webp|gif|avif|heic)$/i.test(outputBlob.type)
          ? presentation === "shared"
            ? "Use Save Image in Share to add it to Photos."
            : presentation === "opened"
            ? "Image opened in a new tab. Long-press it to save to Photos."
            : ""
          : "";
      openSupportPrompt("export", mobilePhotoNote);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      window.alert(
        isMobileViewport
          ? "Export failed on this device. Try PNG format and a lower resolution."
          : "Export failed. Try a supported format or lower resolution."
      );
    }
  };

  const handleShareVisibleCanvasImageLink = async () => {
    if (!currentCanvas) return;
    const nodes = getVisibleNodes();
    if (nodes.length === 0) {
      window.alert("Nothing visible to share.");
      return;
    }

    const canvasEl = document.querySelector('[data-role="canvas"]') as HTMLElement | null;
    const canvasRect = canvasEl?.getBoundingClientRect();
    if (!canvasRect) {
      window.alert("Canvas viewport not found.");
      return;
    }

    const zoomScale = zoomToCanvasScale(zoomLevel);
    const bounds = {
      minX: (canvasRect.left - canvasPosition.x) / zoomScale,
      minY: (canvasRect.top - canvasPosition.y) / zoomScale,
      width: Math.max(1, canvasRect.width / zoomScale),
      height: Math.max(1, canvasRect.height / zoomScale),
    };
    const renderWidth = Math.max(1, Math.round(canvasRect.width));
    const renderHeight = Math.max(1, Math.round(canvasRect.height));

    try {
      const renderCanvas = await renderExportCanvas(nodes, bounds, renderWidth, renderHeight, {
        includeFilters: true,
      });
      const blob = await blobFromCanvas(renderCanvas, "image/png");
      const objectUrl = URL.createObjectURL(blob);
      setShareImageUrl((prev) => {
        if (prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return objectUrl;
      });
      setShowShareQr(true);
      try {
        await navigator.clipboard.writeText(objectUrl);
        openSupportPrompt("share", "Image link copied to clipboard.");
      } catch {
        openSupportPrompt("share", "Image link created. Clipboard access is unavailable in this browser.");
      }
    } catch {
      window.alert("Failed to create share image link.");
    }
  };

  useEffect(() => {
    if (!showExport || !currentCanvas) {
      setExportPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setExportEstimatedBytes(null);
      return;
    }
    const nodes = getVisibleNodes();
    if (nodes.length === 0) {
      setExportPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setExportEstimatedBytes(null);
      return;
    }
    const width =
      showSizeHelper && sizeHelperBounds
        ? Math.max(16, Math.round(sizeHelperBounds.width))
        : Math.max(16, Math.round(exportWidth));
    const height =
      showSizeHelper && sizeHelperBounds
        ? Math.max(16, Math.round(sizeHelperBounds.height))
        : Math.max(16, Math.round(exportHeight));
    const fullWidth = width * exportScale;
    const fullHeight = height * exportScale;
    const longestSide = Math.max(fullWidth, fullHeight);
    const previewMaxSide = 520;
    const previewRatio = longestSide > previewMaxSide ? previewMaxSide / longestSide : 1;
    const previewWidth = Math.max(16, Math.round(fullWidth * previewRatio));
    const previewHeight = Math.max(16, Math.round(fullHeight * previewRatio));
    const bounds = getExportBounds(nodes);
    let active = true;
    let nextPreviewUrl = "";
    setIsExportPreviewLoading(true);
    const buildPreview = async () => {
      try {
        if (exportFormat === "svg") {
          const fullSvgMarkup = buildExportSvgMarkup(nodes, bounds, fullWidth, fullHeight, {
            includeFilters: exportIncludeFilters,
          });
          setExportEstimatedBytes(new TextEncoder().encode(fullSvgMarkup).length);
        }
        const canvas = await renderExportCanvas(nodes, bounds, previewWidth, previewHeight, {
          includeFilters: exportIncludeFilters,
        });
        if (exportFormat !== "svg") {
          applyFinalPassToCanvas(canvas, exportFinalPass, exportFinalPassAmount);
        }
        const blob = await blobFromCanvas(canvas, "image/png");
        if (exportFormat !== "svg") {
          const previewPixels = Math.max(1, previewWidth * previewHeight);
          const fullPixels = Math.max(1, fullWidth * fullHeight);
          const ratio = fullPixels / previewPixels;
          setExportEstimatedBytes(Math.max(1, Math.round(blob.size * ratio)));
        }
        nextPreviewUrl = URL.createObjectURL(blob);
        if (!active) {
          if (nextPreviewUrl) URL.revokeObjectURL(nextPreviewUrl);
          return;
        }
        setExportPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextPreviewUrl;
        });
      } catch {
        if (nextPreviewUrl) URL.revokeObjectURL(nextPreviewUrl);
        if (active) {
          setExportPreviewUrl("");
          setExportEstimatedBytes(null);
        }
      } finally {
        if (active) setIsExportPreviewLoading(false);
      }
    };
    void buildPreview();
    return () => {
      active = false;
    };
  }, [
    showExport,
    currentCanvas,
    exportFormat,
    exportWidth,
    exportHeight,
    exportScale,
    exportQuality,
    exportIncludeFilters,
    exportFinalPass,
    exportFinalPassAmount,
    showSizeHelper,
    sizeHelperBounds?.x,
    sizeHelperBounds?.y,
    sizeHelperBounds?.width,
    sizeHelperBounds?.height,
    printFrame.enabled,
    printFrame.x,
    printFrame.y,
    printFrame.width,
    printFrame.height,
    canvases,
    currentCanvasId,
  ]);

  useEffect(() => {
    if (!showExport) return;
    const closeExportMenusIfOutside = (target: Node | null) => {
      if (!target) return;
      if (exportFormatMenuRef.current && !exportFormatMenuRef.current.contains(target)) {
        setIsExportFormatMenuOpen(false);
      }
      if (exportTemplateMenuRef.current && !exportTemplateMenuRef.current.contains(target)) {
        setIsExportTemplateMenuOpen(false);
      }
      if (exportScaleMenuRef.current && !exportScaleMenuRef.current.contains(target)) {
        setIsExportScaleMenuOpen(false);
      }
      if (exportFinalPassMenuRef.current && !exportFinalPassMenuRef.current.contains(target)) {
        setIsExportFinalPassMenuOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      // Ignore touch scroll/drag starts; close on click/tap instead.
      if (event.pointerType === "touch") return;
      closeExportMenusIfOutside(event.target as Node | null);
    };
    const onClick = (event: MouseEvent) => {
      closeExportMenusIfOutside(event.target as Node | null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("click", onClick);
    };
  }, [showExport]);

  useEffect(() => {
    if (!showStartModal || !isStartMoreSizesOpen) return;
    const closeStartMenuIfOutside = (target: Node | null) => {
      if (!target) return;
      if (startMoreSizesMenuRef.current && !startMoreSizesMenuRef.current.contains(target)) {
        setIsStartMoreSizesOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      closeStartMenuIfOutside(event.target as Node | null);
    };
    const onClick = (event: MouseEvent) => {
      closeStartMenuIfOutside(event.target as Node | null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("click", onClick);
    };
  }, [showStartModal, isStartMoreSizesOpen]);

  const handlePrintCanvas = () => {
    if (!currentCanvas) return;
    const printArea = resolvePrintArea(currentCanvas.printOrientation ?? "portrait");
    const minX = printArea.x;
    const minY = printArea.y;
    const padding = 40;
    const scale = 1;
    setPrintLayout({
      offsetX: padding - minX,
      offsetY: padding - minY,
      scale,
    });
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 80);
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isPlaying) {
        setIsPlaying(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isPlaying]);

  useEffect(() => {
    const preventBrowserFileDrop = (event: DragEvent) => {
      if (!hasDroppedFiles(event.dataTransfer)) return;
      event.preventDefault();
    };

    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
    };
  }, []);


  const uniqueCanvasName = (base: string, existingNames: Set<string>) => {
    const trimmed = base.trim();
    if (!trimmed) return nextAutoCanvasName(existingNames);
    const normalized = new Set(Array.from(existingNames, (name) => name.trim().toLowerCase()));
    if (!normalized.has(trimmed.toLowerCase())) return trimmed;
    let index = 2;
    while (normalized.has(`${trimmed} ${index}`.toLowerCase())) index += 1;
    return `${trimmed} ${index}`;
  };

  const handleCreateCanvas = () => {
    recordHistory();
    const existing = new Set(canvases.map((canvas) => canvas.name));
    const name = uniqueCanvasName(nextAutoCanvasName(existing), existing);
    const canvas: Canvas = {
      id: `canvas-${Date.now()}`,
      name,
      nodes: [],
      snapEnabled: true,
      gridSize: 20,
      alignThreshold: 6,
      snapStrength: 1,
      canvasPreset: "none",
      backgroundColor: "#0a0a0a",
      printOrientation: "portrait",
    };
    setCanvases((prev) => [...prev, canvas]);
    setCurrentCanvasId(canvas.id);
    setSelectedNodeIds([]);
    return canvas.id;
  };

  const handleRenameCanvas = (nextName: string) => {
    const target = currentCanvas;
    const cleanName = nextName.trim();
    if (!target) return;
    const existingNames = new Set(
      canvases.filter((canvas) => canvas.id !== target.id).map((canvas) => canvas.name)
    );
    const uniqueName = uniqueCanvasName(
      cleanName || nextAutoCanvasName(existingNames),
      existingNames
    );
    if (uniqueName === target.name) return;
    recordHistory();
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === target.id ? { ...canvas, name: uniqueName } : canvas
      )
    );
  };

  const handleDeleteCanvas = () => {
    if (canvases.length <= 1) return;
    const target = currentCanvas;
    if (!target) return;
    const confirmed = window.confirm(`Delete "${target.name}"?`);
    if (!confirmed) return;
    recordHistory();
    const remaining = canvases.filter((canvas) => canvas.id !== target.id);
    setCanvases(remaining);
    setCurrentCanvasId(remaining[0].id);
    setSelectedNodeIds([]);
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const currentSnapshot = cloneSnapshot({ canvases, currentCanvasId });
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [currentSnapshot, ...prev]);
    setCanvases(previous.canvases);
    setCurrentCanvasId(previous.currentCanvasId);
    setSelectedNodeIds([]);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const currentSnapshot = cloneSnapshot({ canvases, currentCanvasId });
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, currentSnapshot].slice(-HISTORY_LIMIT));
    setCanvases(next.canvases);
    setCurrentCanvasId(next.currentCanvasId);
    setSelectedNodeIds([]);
  };

  const handleShareCanvas = async () => {
    if (!currentCanvas) return;
    const payload = JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, canvas: currentCanvas },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(payload);
      openSupportPrompt("project", "Project JSON copied to clipboard.");
    } catch {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Layer-${currentCanvas.name.toLowerCase().replace(/\s+/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      openSupportPrompt("project", "Project JSON downloaded.");
    }
  };

  const handleSelectNode = (id: string, additive: boolean) => {
    setSelectedNodeIds((prev) => {
      if (!additive) return [id];
      if (prev.includes(id)) return prev.filter((nodeId) => nodeId !== id);
      return [...prev, id];
    });
  };

  const handleLayerPanelSelect = (id: string, additive: boolean) => {
    setSelectedNodeIds((prev) => {
      if (!additive) return [id];
      if (prev.includes(id)) return prev.filter((nodeId) => nodeId !== id);
      return [...prev, id];
    });
  };

  const handleBoxSelect = (ids: string[], additive: boolean) => {
    setSelectedNodeIds((prev) => {
      if (!additive) return ids;
      const merged = new Set([...prev, ...ids]);
      return Array.from(merged);
    });
  };

  const handleClearSelection = () => {
    setSelectedNodeIds([]);
  };

  const handleNudgeSelectedNodes = (dx: number, dy: number) => {
    if (!currentCanvas || selectedNodeIds.length === 0) return;
    recordHistory();
    const selectedSet = new Set(selectedNodeIds);
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === currentCanvasId
          ? {
              ...canvas,
              nodes: canvas.nodes.map((node) =>
                selectedSet.has(node.id)
                  ? { ...node, x: node.x + dx, y: node.y + dy }
                  : node
              ),
            }
          : canvas
      )
    );
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (showStartModal || showSupportPrompt || showExport || showAbout || showShareQr || showOnboarding || Boolean(expandedNodeId)) return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable) return;
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isMeta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (isMeta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        handleDuplicateNodes(selectedNodeIds);
        return;
      }
      if (isMeta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleAddNode();
        return;
      }
      if (isMeta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        importFileInputRef.current?.click();
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "v") {
        event.preventDefault();
        setActiveTool("select");
        return;
      }
      if (key === "b") {
        event.preventDefault();
        setActiveTool("brush");
        return;
      }
      if (key === "e") {
        event.preventDefault();
        setActiveTool("eraser");
        return;
      }
      if (event.key.startsWith("Arrow")) {
        if (selectedNodeIds.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowUp") handleNudgeSelectedNodes(0, -step);
        if (event.key === "ArrowDown") handleNudgeSelectedNodes(0, step);
        if (event.key === "ArrowLeft") handleNudgeSelectedNodes(-step, 0);
        if (event.key === "ArrowRight") handleNudgeSelectedNodes(step, 0);
        return;
      }
      if (event.key === "Escape") {
        handleClearSelection();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          handleDeleteNodes(selectedNodeIds);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNodeIds,
    handleUndo,
    handleRedo,
    handleAddNode,
    handleNudgeSelectedNodes,
    handleDuplicateNodes,
    handleDeleteNodes,
    handleClearSelection,
    currentCanvas,
    showExport,
    showAbout,
    showShareQr,
    showSupportPrompt,
    showStartModal,
    showOnboarding,
    expandedNodeId,
    importFileInputRef,
  ]);

  const filteredNodes = useMemo(() => {
    if (!currentCanvas) return [];
    return currentCanvas.nodes.filter((node) => node.visible !== false);
  }, [currentCanvas]);

  const expandedMedia = expandedNode?.mediaUrl || expandedNode?.thumbnail || "";
  const expandedIsImage =
    expandedMedia.startsWith("data:image/") ||
    expandedMedia.startsWith("blob:") ||
    /\.(png|jpe-g|gif|webp|avif)$/i.test(expandedMedia);
  const expandedIsVideo =
    expandedMedia.startsWith("data:video/") || /\.(mp4|webm|ogg)$/i.test(expandedMedia);
  const printNodes = currentCanvas?.nodes.filter((node) => node.visible !== false) ?? [];
  const activePrintArea = resolvePrintArea(currentCanvas?.printOrientation ?? "portrait");
  const saveStatusLabel =
    saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Save Failed" : "Saved";

  return (
    <div 
      data-role="app-shell"
      data-skin={uiSkin}
      data-printing={isPrinting ? "true" : "false"}
      className="h-[100dvh] w-full flex flex-col dark overflow-hidden bg-[#0a0a0a]"
      onDragEnter={(event) => {
        if (!hasDroppedFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsFileDragActive(true);
      }}
      onDragOver={(event) => {
        if (!hasDroppedFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!hasDroppedFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setIsFileDragActive(false);
        }
      }}
      onDrop={async (event) => {
        if (!hasDroppedFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsFileDragActive(false);
        await handleDroppedFiles(event.dataTransfer.files);
      }}
      style={{
        fontFamily: customFont ? `"${customFont.name}", var(--font-sans)` : "var(--font-sans)",
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[120] focus:border focus:border-white/30 focus:bg-[#0a0a0a] focus:px-3 focus:py-2 focus:text-xs focus:uppercase focus:tracking-wider focus:text-[#fafafa]"
      >
        Skip to main content
      </a>
      {isFileDragActive && !isPlaying && (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center">
          <div className="border border-white/25 bg-[#0a0a0a]/80 px-8 py-6 text-center">
            <div className="text-xs uppercase tracking-[0.18em] text-[#a3a3a3]">Drop Files</div>
            <div className="mt-2 text-sm text-[#fafafa]">Import files into current canvas</div>
          </div>
        </div>
      )}
      {!isPlaying && (
      <div className="panel-3d print-hide relative flex-shrink-0 min-h-16 px-3 lg:px-0 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 lg:py-0 flex flex-col lg:flex-row lg:items-center gap-1 border-b border-white/5 bg-[#0a0a0a]">
        <div className="flex items-center justify-between lg:basis-[16rem] lg:min-w-[16rem] lg:max-w-[16rem] lg:px-4">
          <div
            onClick={handleCycleUiSkin}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleCycleUiSkin();
              }
            }}
            tabIndex={0}
            className="app-logo-trigger group flex min-h-[3.35rem] flex-col items-start justify-center gap-0.5 py-1 pr-2 leading-[1.15] text-left cursor-pointer select-none overflow-visible outline-none focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/30 focus-visible:outline-offset-2 lg:w-full"
            aria-label="Cycle interface skin"
          >
            <span className="layer-title self-start text-[2rem] font-light tracking-wide leading-[1.02] text-[#fafafa] [text-shadow:0_1px_0_rgba(0,0,0,0.75)] transition-transform group-active:translate-y-px">
              Layer
            </span>
            <span className="layer-subtitle w-full self-end text-right text-[11px] font-light tracking-[0.14em] leading-[1.1] text-[#f0f0f0] [text-shadow:0_1px_0_rgba(0,0,0,0.85)]">
              Visual graphics studio
            </span>
          </div>
          <div className="lg:hidden flex items-center gap-1">
            <button
              onClick={() => {
                setShowMobileLeftSidebar((prev) => !prev);
                setShowMobileRightSidebar(false);
              }}
              className="h-10 w-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
              aria-label="Toggle layers panel"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowMobileRightSidebar((prev) => !prev);
                setShowMobileLeftSidebar(false);
              }}
              className="h-10 w-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
              aria-label="Toggle inspector panel"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="w-full lg:flex-1 lg:min-w-0 lg:pr-0 overflow-hidden">
          <div className="flex flex-col gap-1 text-xs text-[#737373] w-full max-w-full pb-1 lg:pb-0">
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-1">
              <div className="control-pill order-1 lg:order-1 w-full min-w-0 border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] flex items-center overflow-hidden">
                <span className="truncate min-w-0">
                  Back {historyPast.length} | Fwd {historyFuture.length} | {historyLog[0] ?? "Ready"} | {saveStatusLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleNukeAndRestart();
                }}
                className="control-pill order-2 lg:order-10 w-full min-w-0 border border-white/20 text-[10px] uppercase tracking-wider text-[#fafafa] hover:border-white/30 hover:bg-white/10 transition-colors"
                aria-label="Reset app data and restart"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  if (!printFrame.enabled) {
                    const zoomScale = zoomToCanvasScale(zoomLevel);
                    const canvasEl = document.querySelector('[data-role="canvas"]') as HTMLElement | null;
                    const canvasRect = canvasEl?.getBoundingClientRect();
                    if (!canvasRect) {
                      return;
                    }
                    const viewportWidthPx = canvasRect.width;
                    const viewportHeightPx = canvasRect.height;
                    const centerX = canvasRect.left + canvasRect.width / 2;
                    const centerY = canvasRect.top + canvasRect.height / 2;
                    const screenToCanvasX = (screenX: number) =>
                      centerX + (screenX - centerX - canvasPosition.x) / zoomScale;
                    const screenToCanvasY = (screenY: number) =>
                      centerY + (screenY - centerY - canvasPosition.y) / zoomScale;
                    const viewMinX = Math.min(
                      screenToCanvasX(canvasRect.left),
                      screenToCanvasX(canvasRect.right)
                    );
                    const viewMaxX = Math.max(
                      screenToCanvasX(canvasRect.left),
                      screenToCanvasX(canvasRect.right)
                    );
                    const viewMinY = Math.min(
                      screenToCanvasY(canvasRect.top),
                      screenToCanvasY(canvasRect.bottom)
                    );
                    const viewMaxY = Math.max(
                      screenToCanvasY(canvasRect.top),
                      screenToCanvasY(canvasRect.bottom)
                    );
                    const viewWidth = Math.max(1, viewMaxX - viewMinX);
                    const viewHeight = Math.max(1, viewMaxY - viewMinY);
                    const frameWidth = Math.min(480, Math.max(120, viewWidth * 0.7), viewWidth);
                    const frameHeight = Math.min(320, Math.max(90, viewHeight * 0.7), viewHeight);
                    const centeredX = viewMinX + (viewWidth - frameWidth) / 2;
                    const centeredY = viewMinY + (viewHeight - frameHeight) / 2;
                    const clampedX = Math.min(Math.max(centeredX, viewMinX), viewMaxX - frameWidth);
                    const clampedY = Math.min(Math.max(centeredY, viewMinY), viewMaxY - frameHeight);
                    setPrintFrame({
                      x: clampedX,
                      y: clampedY,
                      width: frameWidth,
                      height: frameHeight,
                      enabled: true,
                    });
                  } else {
                    setPrintFrame((prev) => ({
                      ...prev,
                      enabled: false,
                    }));
                  }
                }}
                className={`control-pill order-4 lg:order-3 w-full min-w-0 border text-[10px] uppercase tracking-wider transition-colors ${
                  printFrame.enabled
                    ? "border-white/30 text-[#fafafa] bg-white/12"
                    : "border-white/20 text-[#fafafa] bg-white/5 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <Crop />
                {isMobileViewport ? "Snip" : printFrame.enabled ? "Hide Export Snip" : "Export Snip"}
              </button>
              <button
                onClick={() => setShowPrintArea((prev) => !prev)}
                className={`control-pill order-5 lg:order-4 w-full min-w-0 border text-[10px] uppercase tracking-wider transition-colors ${
                  showPrintArea
                    ? "border-white/30 text-[#fafafa] bg-white/12"
                    : "border-white/20 text-[#fafafa] bg-white/5 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <Frame />
                {isMobileViewport ? "Print Area" : showPrintArea ? "Hide Print Area" : "Show Print Area"}
              </button>
              <button
                onClick={() => {
                  void handleShareVisibleCanvasImageLink();
                }}
                className="control-pill order-3 lg:order-5 w-full min-w-0 border border-white/20 bg-white/5 text-[10px] uppercase tracking-wider text-[#fafafa] hover:border-white/30 hover:bg-white/10 transition-colors"
              >
                <Link2 />
                {isMobileViewport ? "Share Link" : "Share Image Link"}
              </button>
              <button
                onClick={handleUndo}
                disabled={historyPast.length === 0}
                className="control-pill order-9 lg:order-7 w-full min-w-0 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Undo"
              >
                <RotateCcw />
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={historyFuture.length === 0}
                className="control-pill order-10 lg:order-8 w-full min-w-0 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Redo"
              >
                <RotateCw />
                Redo
              </button>
              <button
                type="button"
                onClick={() => setShowAbout(true)}
                className="control-pill order-11 lg:order-11 w-full min-w-0 border border-white/20 bg-white/5 text-[10px] uppercase tracking-wider text-[#fafafa] hover:border-white/30 hover:bg-white/10 transition-colors"
              >
                <Info />
                About
              </button>
              <button
                type="button"
                onClick={handleCycleUiSkin}
                className="control-pill order-8 lg:order-6 w-full min-w-0 border border-white/20 bg-white/5 text-[10px] uppercase tracking-wider text-[#fafafa] hover:border-white/30 hover:bg-white/10 transition-colors"
                aria-label="Cycle interface skin"
              >
                Skin: {uiSkinLabel}
              </button>
              <button
                onClick={handlePrintCanvas}
                className="control-pill hidden lg:flex order-6 lg:order-9 w-full min-w-0 border border-white/20 bg-white/5 text-[10px] uppercase tracking-wider text-[#fafafa] hover:border-white/30 hover:bg-white/10 transition-colors"
              >
                <Printer />
                Print
              </button>
            </div>
            <input
              ref={importFileInputRef}
              type="file"
              accept="image/*,text/plain,application/json,.csv,.md"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                await handleHeaderUpload(file);
                event.currentTarget.value = "";
              }}
            />
            {saveStatus === "error" && saveErrorMessage && (
              <div className="text-[10px] uppercase tracking-wider text-[#d9a66f]" aria-live="polite">
                {saveErrorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main Layout */}
      <main id="main-content" className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        {!isPlaying && (
        <div className="print-hide hidden lg:block flex-shrink-0 basis-[16rem] min-w-[16rem] max-w-[16rem] overflow-hidden">
          <LeftSidebar
            isCollapsed={isLeftCollapsed}
            onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
            currentCanvasId={currentCanvas?.id ?? ""}
            canvases={canvases.map((canvas) => ({ id: canvas.id, name: canvas.name }))}
            onCanvasChange={(canvasId) => {
              if (!canvasId) return;
              setCurrentCanvasId(canvasId);
              setSelectedNodeIds([]);
            }}
            nodes={(currentCanvas?.nodes ?? []).map((node) => ({
              id: node.id,
              title: node.title,
              type: node.type,
              visible: node.visible !== false,
            }))}
            onReorderNodes={handleReorderNodes}
            onToggleLayerVisibility={(id, nextVisible) =>
              updateNode(id, { visible: nextVisible })
            }
            onDeleteLayer={(id) => handleDeleteNodes([id])}
            canvasBackground={currentCanvas?.backgroundColor ?? "#0a0a0a"}
            onCanvasBackgroundChange={updateCanvasBackground}
            canvasPreset={currentCanvas?.canvasPreset ?? "none"}
            onCanvasPresetChange={updateCanvasPreset}
            selectedLayerIds={selectedNodeIds}
            onSelectLayer={handleLayerPanelSelect}
            onRenameLayer={(id, nextTitle) => updateNode(id, { title: nextTitle })}
            onCreateCanvas={handleCreateCanvas}
            onRenameCanvas={handleRenameCanvas}
            onDeleteCanvas={handleDeleteCanvas}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onAddLayer={handleAddNode}
            onAddTextLayer={handleAddTextLayer}
            onImportFont={handleImportFont}
            onImportFile={handleHeaderUpload}
            onDownload={openExportPanel}
            zoomLevel={zoomLevel}
            onZoomChange={handleZoomChange}
          />
        </div>
        )}

        {/* Center Canvas */}
        <div className="flex-1 min-w-0 flex flex-col relative">
          <div className="flex-1 min-h-0">
                {currentCanvas ? (
                  <WorldCanvas
                    nodes={filteredNodes}
                    selectedNodeIds={selectedNodeIds}
                    onSelectNode={handleSelectNode}
                    onBoxSelect={handleBoxSelect}
                    onClearSelection={handleClearSelection}
                    zoomLevel={zoomLevel}
                    canvasPosition={canvasPosition}
                    onCanvasPositionChange={setCanvasPosition}
                    onMoveNodes={handleMoveNodes}
                    onMoveCommit={handleMoveCommit}
                    onNodeClick={handleNodeClick}
                    onZoomChange={handleZoomChange}
                    onResizeStart={recordHistory}
                    onResize={(id, size) => updateNodeLive(id, size)}
                    onUpdateNode={updateNode}
                    onUpdateNodeLive={updateNodeLive}
                    onCreateStroke={createStrokeNodeLive}
                    onDeleteNodesLive={deleteNodesLive}
                    onStrokeActionStart={recordHistory}
                    activeTool={activeTool}
                    brushPreset={brushPreset}
                    brushShape={brushShape}
                    brushSize={brushSize}
                    brushColor={brushColor}
                    brushOpacity={brushOpacity}
                    onBrushPresetChange={setBrushPreset}
                    onBrushShapeChange={setBrushShape}
                    onBrushSizeChange={setBrushSize}
                    onBrushColorChange={setBrushColor}
                    onBrushOpacityChange={setBrushOpacity}
                    eraserSize={eraserSize}
                    eraserFormat={eraserFormat}
                    eraserOpacity={eraserOpacity}
                    onEraserSizeChange={setEraserSize}
                    onEraserFormatChange={setEraserFormat}
                    onEraserOpacityChange={setEraserOpacity}
                    printFrame={printFrame}
                    onPrintFrameChange={setPrintFrame}
                    defaultPrintArea={activePrintArea}
                    printOrientation={currentCanvas.printOrientation}
                    onTogglePrintOrientation={toggleCanvasPrintOrientation}
                    isFullscreen={isPlaying}
                    onToggleFullscreen={handleTogglePlay}
                    showPrintArea={showPrintArea}
                    showSizeHelper={showSizeHelper}
                    onToggleSizeHelper={() => setShowSizeHelper((prev) => !prev)}
                    onSizeHelperBoundsChange={setSizeHelperBounds}
                    canvasPreset={currentCanvas.canvasPreset}
                    backgroundColor={currentCanvas.backgroundColor}
                    snapToGrid={currentCanvas.snapEnabled}
                    gridSize={currentCanvas.gridSize}
                    alignThreshold={currentCanvas.alignThreshold}
                    snapStrength={currentCanvas.snapStrength}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[#737373] text-sm">
                    Create a canvas to start composing.
                  </div>
                )}
          </div>

          {/* Bottom Controls - Integrated */}
        </div>

        {/* Right Sidebar */}
        {!isPlaying && (
        <div className="print-hide hidden lg:block flex-shrink-0 h-full min-h-0 basis-[20rem] min-w-[20rem] max-w-[20rem] overflow-hidden">
          <RightSidebar
            selectedNode={selectedNode}
            activeTool={activeTool}
            brushSpec={{ size: brushSize, opacity: brushOpacity, shape: brushShape }}
            eraserSpec={{ size: eraserSize, opacity: eraserOpacity, shape: eraserFormat }}
            brushColor={brushColor}
            onBrushSizeChange={setBrushSize}
            onBrushOpacityChange={setBrushOpacity}
            onBrushShapeChange={setBrushShape}
            onBrushColorChange={setBrushColor}
            onEraserSizeChange={setEraserSize}
            onEraserOpacityChange={setEraserOpacity}
            onEraserShapeChange={setEraserFormat}
            onUpdateNode={updateNode}
            onDeleteNode={() => handleDeleteNodes(selectedNodeIds)}
            onDuplicateNode={() => handleDuplicateNodes(selectedNodeIds)}
            onImportFile={handleHeaderUpload}
            onOpenPreview={() => {
              if (selectedNode) {
                setExpandedNodeId(selectedNode.id);
              }
            }}
            onUpdateOpacity={(opacity) => {
              if (!selectedNode) return;
              updateNode(selectedNode.id, { opacity });
            }}
            onFlipCanvasHorizontal={() => flipCurrentCanvas("horizontal")}
            onFlipCanvasVertical={() => flipCurrentCanvas("vertical")}
            onFlipSelectedHorizontal={() => flipSelectedImage("horizontal")}
            onFlipSelectedVertical={() => flipSelectedImage("vertical")}
          />
        </div>
        )}
      </main>

      {!isPlaying && isMobileViewport && showMobileLeftSidebar && (
        <div
          className="print-hide fixed inset-0 z-[80] lg:hidden bg-black/65 backdrop-blur-sm"
          onClick={() => setShowMobileLeftSidebar(false)}
        >
          <div
            className="panel-3d absolute left-0 top-0 h-[100dvh] w-[100vw] max-w-none bg-[#0a0a0a] border-r border-white/10 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">Layers</div>
              <button
                type="button"
                onClick={() => setShowMobileLeftSidebar(false)}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close layers panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <LeftSidebar
                isCollapsed={false}
                onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                currentCanvasId={currentCanvas?.id ?? ""}
                canvases={canvases.map((canvas) => ({ id: canvas.id, name: canvas.name }))}
                onCanvasChange={(canvasId) => {
                  if (!canvasId) return;
                  setCurrentCanvasId(canvasId);
                  setSelectedNodeIds([]);
                }}
                nodes={(currentCanvas?.nodes ?? []).map((node) => ({
                  id: node.id,
                  title: node.title,
                  type: node.type,
                  visible: node.visible !== false,
                }))}
                onReorderNodes={handleReorderNodes}
                onToggleLayerVisibility={(id, nextVisible) =>
                  updateNode(id, { visible: nextVisible })
                }
                onDeleteLayer={(id) => handleDeleteNodes([id])}
                canvasBackground={currentCanvas?.backgroundColor ?? "#0a0a0a"}
                onCanvasBackgroundChange={updateCanvasBackground}
                canvasPreset={currentCanvas?.canvasPreset ?? "none"}
                onCanvasPresetChange={updateCanvasPreset}
                selectedLayerIds={selectedNodeIds}
                onSelectLayer={handleLayerPanelSelect}
                onRenameLayer={(id, nextTitle) => updateNode(id, { title: nextTitle })}
                onCreateCanvas={handleCreateCanvas}
                onRenameCanvas={handleRenameCanvas}
                onDeleteCanvas={handleDeleteCanvas}
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onAddLayer={handleAddNode}
                onAddTextLayer={handleAddTextLayer}
                onImportFont={handleImportFont}
                onImportFile={handleHeaderUpload}
                onDownload={openExportPanel}
                zoomLevel={zoomLevel}
                onZoomChange={handleZoomChange}
              />
            </div>
          </div>
        </div>
      )}

      {!isPlaying && isMobileViewport && showMobileRightSidebar && (
        <div
          className="print-hide fixed inset-0 z-[80] lg:hidden bg-black/65 backdrop-blur-sm"
          onClick={() => setShowMobileRightSidebar(false)}
        >
          <div
            className="panel-3d absolute right-0 top-0 h-[100dvh] w-[100vw] max-w-none bg-[#0a0a0a] border-l border-white/10 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">Inspector</div>
              <button
                type="button"
                onClick={() => setShowMobileRightSidebar(false)}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close inspector panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <RightSidebar
                selectedNode={selectedNode}
                activeTool={activeTool}
                brushSpec={{ size: brushSize, opacity: brushOpacity, shape: brushShape }}
                eraserSpec={{ size: eraserSize, opacity: eraserOpacity, shape: eraserFormat }}
                brushColor={brushColor}
                onBrushSizeChange={setBrushSize}
                onBrushOpacityChange={setBrushOpacity}
                onBrushShapeChange={setBrushShape}
                onBrushColorChange={setBrushColor}
                onEraserSizeChange={setEraserSize}
                onEraserOpacityChange={setEraserOpacity}
                onEraserShapeChange={setEraserFormat}
                onUpdateNode={updateNode}
                onDeleteNode={() => handleDeleteNodes(selectedNodeIds)}
                onDuplicateNode={() => handleDuplicateNodes(selectedNodeIds)}
                onImportFile={handleHeaderUpload}
                onOpenPreview={() => {
                  if (selectedNode) {
                    setExpandedNodeId(selectedNode.id);
                    setShowMobileRightSidebar(false);
                  }
                }}
                onUpdateOpacity={(opacity) => {
                  if (!selectedNode) return;
                  updateNode(selectedNode.id, { opacity });
                }}
                onFlipCanvasHorizontal={() => flipCurrentCanvas("horizontal")}
                onFlipCanvasVertical={() => flipCurrentCanvas("vertical")}
                onFlipSelectedHorizontal={() => flipSelectedImage("horizontal")}
                onFlipSelectedVertical={() => flipSelectedImage("vertical")}
              />
            </div>
          </div>
        </div>
      )}

      {showShareQr && shareImageUrl && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            ref={shareModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Share image link"
            tabIndex={-1}
            className="panel-3d w-[420px] max-w-[94vw] bg-[#0a0a0a] border border-white/10 rounded-none p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#fafafa] font-light">Share Image Link</div>
              <button
                type="button"
                onClick={() => setShowShareQr(false)}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close share panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <img
                src={shareQrCodeUrl}
                alt="QR code for exported image link"
                className="w-56 h-56 border border-white/10 bg-white p-2"
              />
              <div className="w-full text-[10px] text-[#737373] uppercase tracking-wider">
                Link
              </div>
              <input
                type="text"
                readOnly
                value={shareImageUrl}
                className="w-full h-9 bg-transparent border border-white/10 text-[#cfcfcf] px-3 rounded-none text-[11px] font-light focus:outline-none"
              />
              <div className="w-full grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareImageUrl).catch(() => undefined);
                  }}
                  className="h-9 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                >
                  Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => window.open(shareImageUrl, "_blank", "noopener,noreferrer")}
                  className="h-9 rounded-none border border-white/20 text-[10px] uppercase tracking-wider text-[#fafafa] bg-white/10 hover:bg-white/15 transition-colors"
                >
                  Open Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSupportPrompt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[85]">
          <div
            ref={supportModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Support development"
            tabIndex={-1}
            className="panel-3d w-[560px] max-w-[94vw] bg-[#0a0a0a] border border-white/10 rounded-none p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">
                {supportPromptContext === "share" ? "Share Generated" : supportPromptContext === "project" ? "Project Saved" : "Export Finished"}
              </div>
              <button
                type="button"
                onClick={() => setShowSupportPrompt(false)}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close support prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {isMobileViewport ? (
              <div className="mt-3 space-y-3">
                <div className="text-sm text-[#e8e8e8]">{supportPromptLead}</div>
                <div className="text-sm text-[#9a9a9a]">Support keeps updates coming.</div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="text-base text-[#e8e8e8]">{supportPromptLead}</div>
                <div className="text-sm text-[#9a9a9a] leading-relaxed">
                  Iron Signal Works tools stay free, independent, and ad-free because some users choose to support them.
                </div>
              </div>
            )}

            {supportPromptNote && (
              <div className="mt-3 text-[10px] uppercase tracking-wider text-[#737373]">{supportPromptNote}</div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSupportPrompt(false)}
                className="h-9 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
              >
                Close
              </button>
              <a
                href={DONATION_URL}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 rounded-none border border-white/20 text-[10px] uppercase tracking-wider text-[#fafafa] bg-white/10 hover:bg-white/15 transition-colors inline-flex items-center"
              >
                Help keep this free
              </a>
            </div>
          </div>
        </div>
      )}

      {expandedNode && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            ref={previewModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Layer preview"
            tabIndex={-1}
            className="w-[720px] max-w-[92vw] bg-[#0a0a0a] border border-white/10 rounded-none p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#fafafa] font-light">
                {expandedNode.title || "Preview"}
              </div>
              <button
                type="button"
                onClick={() => setExpandedNodeId(null)}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close preview"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              className={`w-full aspect-video bg-white/5 border border-white/10 rounded-none flex items-center justify-center overflow-hidden ${
                expandedNode?.preset ? `preset-${expandedNode.preset}` : ""
              }`}
            >
              {expandedMedia && expandedIsImage && (
                <img
                  src={expandedMedia}
                  alt={expandedNode.title}
                  className="w-full h-full object-contain"
                  style={{ filter: expandedNode.invertColors ? "invert(1)" : "none" }}
                />
              )}
              {expandedMedia && expandedIsVideo && (
                <video src={expandedMedia} className="w-full h-full" controls />
              )}
              {!expandedMedia && (
                <div className="text-[#737373] text-xs">No media attached.</div>
              )}
            </div>
            <div className="mt-4">
              <label className="text-xs text-[#737373] mb-1.5 block font-light">Layer Preset</label>
              <select
                value={expandedNode.preset ?? "none"}
                onChange={(event) =>
                  updateNode(expandedNode.id, {
                    preset: event.target.value === "none"
                      ? undefined
                      : (event.target.value as NodeData["preset"]),
                  })
                }
                className="w-full bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
              >
                <option className="bg-[#0a0a0a]" value="none">None</option>
                <option className="bg-[#0a0a0a]" value="zine">Zine</option>
                <option className="bg-[#0a0a0a]" value="acid">Acid</option>
                <option className="bg-[#0a0a0a]" value="retro">Retro</option>
                <option className="bg-[#0a0a0a]" value="mono">Mono</option>
                <option className="bg-[#0a0a0a]" value="neon">Neon</option>
                <option className="bg-[#0a0a0a]" value="paper">Paper</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            ref={exportModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Export output"
            tabIndex={-1}
            className="panel-3d w-[980px] max-w-[96vw] max-h-[92vh] overflow-y-auto overflow-x-visible bg-[#0a0a0a] border border-white/10 rounded-none p-4 lg:p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#fafafa] font-light">Export Output</div>
              <button
                type="button"
                onClick={() => setShowExport(false)}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close export panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 lg:gap-5 items-start">
              <div className="space-y-3">
                <div className="text-[10px] text-[#737373] mb-2 uppercase tracking-wider font-light">
                  Preview
                </div>
                <div
                  className="w-full h-[240px] lg:h-[360px] border border-white/10 bg-black/30 overflow-hidden"
                  onWheel={handleExportPreviewWheel}
                  onMouseDown={handleExportPreviewMouseDown}
                  onMouseMove={handleExportPreviewMouseMove}
                  onMouseUp={handleExportPreviewMouseUp}
                  onMouseLeave={handleExportPreviewMouseUp}
                  onDoubleClick={handleExportPreviewDoubleClick}
                >
                  {isExportPreviewLoading ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[#737373]">
                      Rendering preview...
                    </div>
                  ) : exportPreviewUrl ? (
                    <div
                      className={`w-full h-full flex items-center justify-center ${
                        exportPreviewZoom > 1
                          ? isExportPreviewDragging
                            ? "cursor-grabbing"
                            : "cursor-grab"
                          : "cursor-zoom-in"
                      }`}
                      style={{
                        transform: `translate(${exportPreviewPan.x}px, ${exportPreviewPan.y}px) scale(${exportPreviewZoom})`,
                        transformOrigin: "center center",
                      }}
                      onDoubleClick={handleExportPreviewDoubleClick}
                    >
                      <img
                        src={exportPreviewUrl}
                        alt="Export preview"
                        draggable={false}
                        className="max-w-full max-h-full object-contain select-none"
                        onDoubleClick={handleExportPreviewDoubleClick}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[#737373]">
                      No preview available.
                    </div>
                  )}
                </div>
                <div className="text-[9px] leading-tight text-[#737373]">
                  Wheel to zoom, drag to pan, double-click to reset.
                </div>
              </div>

              <div className="space-y-3 lg:space-y-3 max-h-[calc(92vh-9rem)] overflow-y-auto pr-3 [scrollbar-gutter:stable]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#737373] mb-1.5 block font-light">Format</label>
                    <div className="relative" ref={exportFormatMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsExportFormatMenuOpen((prev) => !prev)}
                        className="w-full h-10 bg-[#0a0a0a] border border-white/10 text-[#fafafa] pl-3 pr-8 py-0 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors text-center"
                      >
                        {exportFormat.toUpperCase()}
                      </button>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fafafa] pointer-events-none" />
                      {isExportFormatMenuOpen && (
                        <div className="dropdown-panel absolute left-0 right-0 top-[calc(100%+2px)] z-50 rounded-none overflow-hidden">
                          {EXPORT_FORMAT_OPTIONS.map((format) => (
                            <button
                              key={format}
                              type="button"
                              onClick={() => {
                                setExportFormat(format);
                                setIsExportFormatMenuOpen(false);
                              }}
                              className={`dropdown-panel-item w-full h-8 px-3 border-b last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                                exportFormat === format
                                  ? "text-[#fafafa] bg-white/10"
                                  : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                              }`}
                            >
                              {format.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#737373] mb-1.5 block font-light">Resolution</label>
                    <div className="relative" ref={exportScaleMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsExportScaleMenuOpen((prev) => !prev)}
                        className="w-full h-10 bg-[#0a0a0a] border border-white/10 text-[#fafafa] pl-3 pr-8 py-0 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors text-center"
                      >
                        {exportScale}x
                      </button>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fafafa] pointer-events-none" />
                      {isExportScaleMenuOpen && (
                        <div className="dropdown-panel absolute left-0 right-0 top-[calc(100%+2px)] z-50 rounded-none overflow-hidden">
                          {([1, 2, 3] as const).map((scale) => (
                            <button
                              key={scale}
                              type="button"
                              onClick={() => {
                                setExportScale(scale);
                                setIsExportScaleMenuOpen(false);
                              }}
                              className={`dropdown-panel-item w-full h-8 px-3 border-b last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                                exportScale === scale
                                  ? "text-[#fafafa] bg-white/10"
                                  : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                              }`}
                            >
                              {scale}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block font-light">Template</label>
                  <div className="relative" ref={exportTemplateMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsExportTemplateMenuOpen((prev) => !prev)}
                      className="w-full h-10 bg-[#0a0a0a] border border-white/10 text-[#fafafa] pl-3 pr-8 py-0 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors text-center"
                    >
                      {(EXPORT_TEMPLATES.find((template) => template.id === exportTemplate) ?? EXPORT_TEMPLATES[0]).label}
                    </button>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fafafa] pointer-events-none" />
                    {isExportTemplateMenuOpen && (
                      <div className="dropdown-panel absolute left-0 right-0 top-[calc(100%+2px)] z-50 max-h-56 overflow-y-auto rounded-none">
                        {EXPORT_TEMPLATES.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => {
                              handleSelectExportTemplate(template.id);
                              setIsExportTemplateMenuOpen(false);
                            }}
                            className={`dropdown-panel-item w-full h-8 px-3 border-b last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                              exportTemplate === template.id
                                ? "text-[#fafafa] bg-white/10"
                                : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                            }`}
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#737373] mb-1.5 block font-light">Width (px)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="16"
                        value={exportWidth}
                        onChange={(event) => handleExportWidthChange(Number(event.target.value))}
                        className="w-full h-10 bg-transparent border border-white/10 text-[#fafafa] pl-3 pr-11 py-0 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="export-stepper absolute right-0 inset-y-px w-8 border-l border-white/10 bg-[#0a0a0a] overflow-hidden divide-y divide-white/10">
                        <button
                          type="button"
                          onClick={() => handleExportWidthChange(exportWidth + 1)}
                          className="export-step-btn w-full flex items-center justify-center text-[#737373] hover:text-[#fafafa] transition-colors"
                          aria-label="Increase width"
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportWidthChange(exportWidth - 1)}
                          className="export-step-btn w-full flex items-center justify-center text-[#737373] hover:text-[#fafafa] transition-colors"
                          aria-label="Decrease width"
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#737373] mb-1.5 block font-light">Height (px)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="16"
                        value={exportHeight}
                        onChange={(event) => handleExportHeightChange(Number(event.target.value))}
                        className="w-full h-10 bg-transparent border border-white/10 text-[#fafafa] pl-3 pr-11 py-0 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="export-stepper absolute right-0 inset-y-px w-8 border-l border-white/10 bg-[#0a0a0a] overflow-hidden divide-y divide-white/10">
                        <button
                          type="button"
                          onClick={() => handleExportHeightChange(exportHeight + 1)}
                          className="export-step-btn w-full flex items-center justify-center text-[#737373] hover:text-[#fafafa] transition-colors"
                          aria-label="Increase height"
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportHeightChange(exportHeight - 1)}
                          className="export-step-btn w-full flex items-center justify-center text-[#737373] hover:text-[#fafafa] transition-colors"
                          aria-label="Decrease height"
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border border-white/10 px-3 py-2">
                  <div>
                    <div className="text-xs text-[#fafafa] font-light">Auto Scaling</div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Keep width and height locked to aspect ratio.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleExportAutoScale}
                    className={`control-square h-7 w-7 rounded-none border text-[9px] uppercase tracking-wider transition-colors ${
                      exportAutoScale
                        ? "border-white/30 text-[#fafafa] bg-white/10"
                        : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                    }`}
                  >
                    {exportAutoScale ? "On" : "Off"}
                  </button>
                </div>

                <div className="flex items-center justify-between border border-white/10 px-3 py-2">
                  <div>
                    <div className="text-xs text-[#fafafa] font-light">Apply Filters</div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Includes layer preset, canvas preset, and invert settings.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExportIncludeFilters((prev) => !prev)}
                    className={`control-square h-7 w-7 rounded-none border text-[9px] uppercase tracking-wider transition-colors ${
                      exportIncludeFilters
                        ? "border-white/30 text-[#fafafa] bg-white/10"
                        : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                    }`}
                  >
                    {exportIncludeFilters ? "On" : "Off"}
                  </button>
                </div>

                <div className="border border-white/10 px-3 py-2">
                  <div className="mb-2 text-xs text-[#fafafa] font-light">Final Pass</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#737373] mb-1 block uppercase tracking-wider">Mode</label>
                      <div className="relative" ref={exportFinalPassMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsExportFinalPassMenuOpen((prev) => !prev)}
                          className="w-full h-10 bg-[#0a0a0a] border border-white/10 text-[#fafafa] pl-3 pr-8 py-0 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors text-center"
                        >
                          {exportFinalPass === "none"
                            ? "None"
                            : exportFinalPass.charAt(0).toUpperCase() + exportFinalPass.slice(1)}
                        </button>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fafafa] pointer-events-none" />
                        {isExportFinalPassMenuOpen && (
                          <div className="dropdown-panel absolute left-0 right-0 bottom-[calc(100%+2px)] z-[70] max-h-40 overflow-y-auto rounded-none">
                            {(["none", "threshold", "bitmap", "posterize", "duotone"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => {
                                  setExportFinalPass(mode);
                                  setIsExportFinalPassMenuOpen(false);
                                }}
                                className={`dropdown-panel-item w-full h-8 px-3 border-b last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                                  exportFinalPass === mode
                                    ? "text-[#fafafa] bg-white/10"
                                    : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                                }`}
                              >
                                {mode === "none" ? "None" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] text-[#737373] uppercase tracking-wider">Intensity</label>
                        <span className="text-[10px] text-[#737373] tabular-nums">
                          {Math.round(exportFinalPassAmount * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(exportFinalPassAmount * 100)}
                        disabled={exportFinalPass === "none"}
                        onChange={(event) =>
                          setExportFinalPassAmount(Math.max(0, Math.min(1, Number(event.target.value) / 100)))
                        }
                        className="compact-range w-full h-0.5 bg-white/10 appearance-none cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>
                  {exportFormat === "svg" && exportFinalPass !== "none" && (
                    <div className="mt-2 text-[10px] text-[#737373] uppercase tracking-wider">
                      Final pass applies to raster exports (png/jpeg/webp/ico/avif/gif/heic), not svg.
                    </div>
                  )}
                </div>

                {(exportFormat === "jpeg" || exportFormat === "webp" || exportFormat === "avif") && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[#737373] block font-light">Quality</label>
                      <span className="text-[10px] text-[#737373] tabular-nums">
                        {Math.round(exportQuality * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={Math.round(exportQuality * 100)}
                      onChange={(event) => setExportQuality(Math.max(0.5, Math.min(1, Number(event.target.value) / 100)))}
                      className="compact-range w-full h-0.5 bg-white/10 appearance-none cursor-pointer"
                    />
                  </div>
                )}

                <div className="text-[10px] leading-tight text-[#737373]">
                  Final Output: {(exportWidth * exportScale).toLocaleString()} x {(exportHeight * exportScale).toLocaleString()} px
                </div>
                <div className="text-[10px] leading-tight text-[#737373]">
                  Estimated File Size: {exportEstimatedBytes !== null ? formatBytes(exportEstimatedBytes) : "Calculating..."}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={DONATION_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3 rounded-none border border-white/10 text-[10px] tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors inline-flex items-center"
                  >
                    Help keep this free
                  </a>
                  <button
                    onClick={() => setShowExport(false)}
                    className="h-9 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      void runExport();
                    }}
                    className="h-9 px-3 rounded-none border border-white/20 text-[10px] uppercase tracking-wider text-[#fafafa] bg-white/10 hover:bg-white/15 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    {isMobileViewport && ["png", "jpeg", "webp", "gif", "avif", "heic"].includes(exportFormat)
                      ? "Export to Photos"
                      : "Export File"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStartModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-[95] p-2 sm:p-4">
          <div
            ref={startModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Start new project"
            tabIndex={-1}
            className="panel-3d w-[1220px] max-w-[98vw] h-[96vh] sm:h-[92vh] max-h-[98vh] sm:max-h-[96vh] border border-white/10 rounded-none p-3 sm:p-6 lg:p-8 flex flex-col overflow-hidden"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[#737373]">Start Page</div>
                <div className="text-base sm:text-xl text-[#fafafa] font-light mt-1 leading-tight">Choose a canvas size</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsStartMoreSizesOpen(false);
                  setShowStartModal(false);
                }}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close start page"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 sm:mt-6 flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.7fr_0.9fr] gap-3 sm:gap-4 lg:gap-5 overflow-y-auto xl:overflow-hidden">
              <div className="border border-white/10 min-h-0 flex flex-col">
                <div className="flex items-center gap-2 px-2 py-2 border-b border-white/10 overflow-x-auto">
                  {START_TEMPLATE_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStartCategory(tab.id)}
                      className={`h-8 px-3 rounded-none border text-[10px] uppercase tracking-wider whitespace-nowrap transition-colors ${
                        startCategory === tab.id
                          ? "border-white/25 bg-white/10 text-[#fafafa]"
                          : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {startTemplatesForCategory.map((template) => {
                      const renditionWidth = Math.max(12, Math.round(template.width * startTemplateRenditionScale));
                      const renditionHeight = Math.max(12, Math.round(template.height * startTemplateRenditionScale));
                      return (
                        <div
                          key={template.id}
                          role="option"
                          aria-selected={startTemplate === template.id}
                          tabIndex={0}
                          onClick={() => handleSelectStartTemplate(template.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleSelectStartTemplate(template.id);
                            }
                          }}
                          className={`p-3 rounded-none border text-left transition-colors cursor-pointer ${
                            startTemplate === template.id
                              ? "border-white/25 bg-white/10 text-[#fafafa]"
                              : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                          }`}
                        >
                          {!isMobileViewport && (
                            <div className="h-28 border border-white/20 bg-black/30 flex items-center justify-center">
                              <div
                                className={`border ${startTemplate === template.id ? "border-white/70" : "border-white/40"}`}
                                style={{ width: renditionWidth, height: renditionHeight }}
                              />
                            </div>
                          )}
                          <div className={`${isMobileViewport ? "mt-0" : "mt-3"} text-sm text-[#e8e8e8] font-light`}>
                            {template.label}
                          </div>
                          <div className="text-xs text-[#9d9d9d]">
                            {template.width.toLocaleString()} x {template.height.toLocaleString()} px
                          </div>
                        </div>
                      );
                    })}
                    {startTemplatesForCategory.length === 0 && (
                      <div className="col-span-full text-[11px] uppercase tracking-wider text-[#737373] p-4 border border-white/10">
                        No presets in this category yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-white/10 p-4 flex flex-col gap-4 min-w-0">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#737373] mb-1 block">Name</label>
                  <input
                    type="text"
                    value={startProjectName}
                    onChange={(event) => setStartProjectName(event.target.value)}
                    className="w-full h-10 bg-transparent border border-white/10 text-[#fafafa] px-3 rounded-none text-base font-light focus:border-white/20 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] gap-2 items-end">
                  <div className="min-w-0">
                    <label className="text-[10px] uppercase tracking-wider text-[#737373] mb-1 block">Width</label>
                    <input
                      type="number"
                      min="0"
                      value={startWidthInput}
                      onChange={(event) => {
                        setStartTemplate("custom");
                        setSelectedStartMoreSizeId(null);
                        setStartWidthInput(event.target.value);
                      }}
                      className="w-full h-10 bg-transparent border border-white/10 text-[#fafafa] px-3 rounded-none text-base font-light focus:border-white/20 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStartTemplate("custom");
                      setSelectedStartMoreSizeId(null);
                      setStartWidthInput(startHeightInput);
                      setStartHeightInput(startWidthInput);
                    }}
                    className="h-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                    aria-label="Swap width and height"
                  >
                    ⇄
                  </button>
                  <div className="min-w-0">
                    <label className="text-[10px] uppercase tracking-wider text-[#737373] mb-1 block">Height</label>
                    <input
                      type="number"
                      min="0"
                      value={startHeightInput}
                      onChange={(event) => {
                        setStartTemplate("custom");
                        setSelectedStartMoreSizeId(null);
                        setStartHeightInput(event.target.value);
                      }}
                      className="w-full h-10 bg-transparent border border-white/10 text-[#fafafa] px-3 rounded-none text-base font-light focus:border-white/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Extra Sizes</div>
                  <div className="relative min-w-0" ref={startMoreSizesMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsStartMoreSizesOpen((prev) => !prev)}
                      className="h-10 w-full px-3 pr-8 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#fafafa] text-left hover:border-white/20 transition-colors"
                    >
                      {selectedStartMoreSizeId
                        ? START_MORE_SIZES.find((item) => item.id === selectedStartMoreSizeId)?.label
                        : "Select Extra Size"}
                    </button>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#737373] pointer-events-none" />
                    {isStartMoreSizesOpen && (
                      <div className="dropdown-panel absolute left-0 right-0 top-[calc(100%+2px)] z-[80] max-h-56 overflow-y-auto rounded-none">
                        {START_MORE_SIZES.map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => handleSelectStartMoreSize(size.id)}
                            className={`dropdown-panel-item w-full h-8 px-3 border-b last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                              selectedStartMoreSizeId === size.id
                                ? "text-[#fafafa] bg-white/10"
                                : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                            }`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsStartMoreSizesOpen(false);
                      setShowStartModal(false);
                    }}
                    className="h-10 px-4 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={applyStartTemplate}
                    className="h-10 px-4 rounded-none border border-white/20 text-[10px] uppercase tracking-wider text-[#fafafa] bg-white/10 hover:bg-white/15 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            ref={aboutModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="About Layer"
            tabIndex={-1}
            className="panel-3d w-[1240px] max-w-[98vw] h-[96vh] sm:h-[92vh] max-h-[98vh] sm:max-h-[96vh] bg-[#0a0a0a] border border-white/10 rounded-none p-3 sm:p-6 lg:p-8 flex flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                <span className="layer-title text-[1.35rem] sm:text-[2rem] font-light tracking-wide leading-[1.05] text-[#fafafa] [text-shadow:0_1px_0_rgba(0,0,0,0.75)]">
                  Layer
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-[#bdbdbd]">About</div>
                  <div className="text-base sm:text-xl text-[#fafafa] font-light mt-1 leading-tight">Product Overview</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close about panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[0.75fr_1.25fr] gap-3 sm:gap-4 lg:gap-5 overflow-y-auto xl:overflow-hidden">
              <div className="border border-white/15 p-4 flex flex-col gap-4 min-h-0">
                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Layer - Image + Text Editor</div>
                  <div className="text-[15px] text-[#e3e3e3] leading-relaxed">
                    A fast, layered canvas studio for collage, typography, paint, and export workflows in one place.
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-[#b8b8b8]">
                    Build, edit, and publish without leaving the canvas.
                  </div>
                </div>
                <div className="space-y-2 border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Skin</div>
                    <div className="text-[11px] uppercase tracking-wider text-[#b8b8b8]">Current: {uiSkinLabel}</div>
                  </div>
                  <div className="text-[11px] text-[#b8b8b8] uppercase tracking-wider">
                    Tip: click app name in the header to cycle skins.
                  </div>
                </div>
                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Key Shortcuts</div>
                  <div className="text-[15px] text-[#d8d8d8] leading-relaxed">`V` Select, `B` Brush, `E` Eraser</div>
                  <div className="text-[15px] text-[#d8d8d8] leading-relaxed">`Cmd/Ctrl+Z` Undo, `Shift+Cmd/Ctrl+Z` Redo</div>
                  <div className="text-[15px] text-[#d8d8d8] leading-relaxed">`Cmd/Ctrl+D` Duplicate, `Delete/Backspace` Remove</div>
                </div>
              </div>

              <div className="border border-white/15 min-h-0 xl:overflow-y-auto p-4 space-y-4 text-[15px] text-[#d6d6d6] leading-relaxed">
                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Canvas + Layers</div>
                  <div>Create, rename, and delete canvases from the left panel. Blank names auto-generate as canvas1, canvas2, and so on.</div>
                  <div>Set canvas preset/background, toggle layer visibility, drag to reorder, double-click a layer to rename, and use layer delete controls.</div>
                  <div>Arrow keys move selected items on canvas. Shift+drag enables box select.</div>
                </div>

                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Tools</div>
                  <div>Left Tools panel includes Select, Brush, Eraser, Add Layer, Add Text, Import Font, and zoom controls.</div>
                  <div>Brush creates stroke layers and supports size, opacity, shape (round/square/triangle), and color.</div>
                  <div>Eraser supports size, opacity, and shape. Ghost pointers show active brush/eraser size on canvas.</div>
                  <div>Right-click on canvas while Brush/Eraser is active opens quick tool settings.</div>
                </div>

                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Inspector</div>
                  <div>Inspector updates by selection: media preview, title/description, URLs, tags, alt text, transparency, invert, presets, and text styling controls.</div>
                  <div>Text tools include font picker, color, size, weight/style/underline, and alignment.</div>
                </div>

                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Edit + Navigation</div>
                  <div>Pan by dragging empty space. Zoom with wheel or zoom controls. Double-click export preview to reset zoom/pan.</div>
                  <div>Projects are auto-saved locally in your browser.</div>
                </div>

                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Export + Output</div>
                  <div>Export supports PNG, JPEG, WEBP, SVG, ICO, AVIF, GIF, and HEIC with resolution scaling, templates, explicit width/height, and optional filter inclusion.</div>
                  <div>Final Pass modes: None, Threshold, Bitmap, Posterize, Duotone with intensity control (raster exports only).</div>
                  <div>Use Export Snip, Download, Share Image Link with QR, and Print from the top controls.</div>
                </div>

                <div className="border border-white/10 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#e2e2e2]">Import</div>
                  <div>Main import is in the left footer. You can also drag/drop supported files directly onto the canvas.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && !showStartModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[90]">
          <div
            ref={onboardingModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Quick start onboarding"
            tabIndex={-1}
            className="panel-3d w-[560px] max-w-[94vw] bg-[#0a0a0a] border border-white/10 rounded-none p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#737373]">Quick Start</div>
                <div className="text-base text-[#fafafa] font-light mt-1">{activeOnboardingStep.title}</div>
              </div>
              <button
                type="button"
                onClick={completeOnboarding}
                className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
                aria-label="Close onboarding"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-4 text-sm text-[#a8a8a8] leading-relaxed">
              {activeOnboardingStep.description}
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-wider text-[#737373]">
              Step {onboardingStep + 1} of {onboardingTotal}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={completeOnboarding}
                className="h-9 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setOnboardingStep((prev) => Math.max(0, prev - 1))}
                disabled={onboardingStep === 0}
                className="h-9 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isOnboardingLastStep) {
                    completeOnboarding();
                  } else {
                    setOnboardingStep((prev) => Math.min(onboardingTotal - 1, prev + 1));
                  }
                }}
                className="h-9 rounded-none border border-white/20 text-[10px] uppercase tracking-wider text-[#fafafa] bg-white/10 hover:bg-white/15 transition-colors"
              >
                {isOnboardingLastStep ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPrinting && currentCanvas && (
        <div
          data-role="print-canvas"
          className="fixed inset-0 bg-[#0a0a0a] z-[9999]"
          style={{
            background: currentCanvas.backgroundColor,
            filter: resolveCanvasPresetFilter(currentCanvas.canvasPreset) || "none",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: printLayout
                ? `translate(${printLayout.offsetX}px, ${printLayout.offsetY}px) scale(${printLayout.scale})`
                : "none",
              transformOrigin: "top left",
            }}
          >
            <div
              style={{
                position: "relative",
                width: activePrintArea.width,
                height: activePrintArea.height,
                overflow: "hidden",
              }}
            >
              {printNodes.map((node) => {
                const size =
                  node.width && node.height
                    ? { width: node.width, height: node.height }
                    : node.type === "video"
                    ? { width: 224, height: 128 }
                    : node.type === "interactive"
                    ? { width: 176, height: 176 }
                    : node.type === "text"
                    ? { width: 220, height: 96 }
                    : node.type === "stroke"
                    ? { width: Math.max(1, node.width ?? 1), height: Math.max(1, node.height ?? 1) }
                    : { width: 192, height: 192 };
                const isImage =
                  (node.mediaUrl?.startsWith("data:image/") ||
                    node.mediaUrl?.startsWith("blob:") ||
                    /\.(png|jpe?g|gif|webp|avif)$/i.test(node.mediaUrl || "")) ||
                  (node.thumbnail?.length ?? 0) > 0;
                const src = node.mediaUrl || node.thumbnail || "";
                const offsetX = node.x - activePrintArea.x;
                const offsetY = node.y - activePrintArea.y;
                const hasEraseMask = (node.erasePaths?.length ?? 0) > 0;
                const printMaskId = `print-erase-mask-${node.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
                return (
                  <div
                    key={node.id}
                    style={{
                      position: "absolute",
                      left: offsetX,
                      top: offsetY,
                      width: size.width,
                      height: size.height,
                      opacity: node.opacity ?? 1,
                      transform: `rotate(${node.rotation ?? 0}deg) scale(${node.flipX ? -1 : 1}, ${node.flipY ? -1 : 1})`,
                      transformOrigin: "center center",
                      overflow: "hidden",
                      background: "transparent",
                      filter: composeCssFilters([
                        resolveNodePresetFilter(node.preset),
                        node.invertColors ? "invert(1)" : undefined,
                      ]),
                    }}
                  >
                    {node.type === "stroke" && (node.strokePoints?.length ?? 0) > 1 ? (
                      <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
                        preserveAspectRatio="none"
                      >
                        {hasEraseMask && (
                          <defs>
                            <mask id={printMaskId}>
                              <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                              {(node.erasePaths ?? []).map((erasePath) =>
                                erasePath.points.length > 1 ? (
                                  <polyline
                                    key={erasePath.id}
                                    points={erasePath.points.map((point) => `${point.x},${point.y}`).join(" ")}
                                    fill="none"
                                    stroke="black"
                                    strokeOpacity={Math.max(0.05, Math.min(1, erasePath.opacity))}
                                    strokeWidth={Math.max(1, erasePath.size)}
                                    strokeLinecap={erasePath.shape === "round" ? "round" : erasePath.shape === "square" ? "square" : "butt"}
                                    strokeLinejoin={erasePath.shape === "triangle" ? "bevel" : erasePath.shape === "square" ? "miter" : "round"}
                                  />
                                ) : (
                                  <circle
                                    key={erasePath.id}
                                    cx={erasePath.points[0]?.x ?? 0}
                                    cy={erasePath.points[0]?.y ?? 0}
                                    r={Math.max(0.5, erasePath.size / 2)}
                                    fill="black"
                                    fillOpacity={Math.max(0.05, Math.min(1, erasePath.opacity))}
                                  />
                                )
                              )}
                            </mask>
                          </defs>
                        )}
                        <polyline
                          points={node.strokePoints?.map((point) => `${point.x},${point.y}`).join(" ") ?? ""}
                          fill="none"
                          stroke={node.strokeColor ?? "#fafafa"}
                          strokeWidth={node.strokeWidth ?? 6}
                          strokeLinecap={node.strokeShape === "round" ? "round" : "butt"}
                          strokeLinejoin={
                            node.strokeShape === "triangle" ? "bevel" : node.strokeShape === "square" ? "miter" : "round"
                          }
                          vectorEffect="non-scaling-stroke"
                          mask={hasEraseMask ? `url(#${printMaskId})` : undefined}
                        />
                      </svg>
                    ) : node.type === "text" ? (
                      hasEraseMask ? (
                        <svg
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <mask id={printMaskId}>
                              <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                              {(node.erasePaths ?? []).map((erasePath) =>
                                erasePath.points.length > 1 ? (
                                  <polyline
                                    key={erasePath.id}
                                    points={erasePath.points.map((point) => `${point.x},${point.y}`).join(" ")}
                                    fill="none"
                                    stroke="black"
                                    strokeOpacity={Math.max(0.05, Math.min(1, erasePath.opacity))}
                                    strokeWidth={Math.max(1, erasePath.size)}
                                    strokeLinecap={erasePath.shape === "round" ? "round" : erasePath.shape === "square" ? "square" : "butt"}
                                    strokeLinejoin={erasePath.shape === "triangle" ? "bevel" : erasePath.shape === "square" ? "miter" : "round"}
                                  />
                                ) : (
                                  <circle
                                    key={erasePath.id}
                                    cx={erasePath.points[0]?.x ?? 0}
                                    cy={erasePath.points[0]?.y ?? 0}
                                    r={Math.max(0.5, erasePath.size / 2)}
                                    fill="black"
                                    fillOpacity={Math.max(0.05, Math.min(1, erasePath.opacity))}
                                  />
                                )
                              )}
                            </mask>
                          </defs>
                          <foreignObject x="0" y="0" width={size.width} height={size.height} mask={`url(#${printMaskId})`}>
                            <div
                              xmlns="http://www.w3.org/1999/xhtml"
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent:
                                  (node.textStyle?.align ?? "center") === "left"
                                    ? "flex-start"
                                    : (node.textStyle?.align ?? "center") === "right"
                                    ? "flex-end"
                                    : "center",
                                color: node.textStyle?.color ?? "#e6e6e6",
                                fontSize: `${Math.max(10, Math.min(512, node.textStyle?.fontSize ?? 14))}px`,
                                fontFamily: node.textStyle?.fontFamily ?? "var(--font-sans)",
                                fontWeight: node.textStyle?.bold ? 700 : 300,
                                fontStyle: node.textStyle?.italic ? "italic" : "normal",
                                textDecoration: node.textStyle?.underline ? "underline" : "none",
                                textAlign: node.textStyle?.align ?? "center",
                                padding: "8px",
                                boxSizing: "border-box",
                              }}
                            >
                              {node.title || "Text"}
                            </div>
                          </foreignObject>
                        </svg>
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent:
                              (node.textStyle?.align ?? "center") === "left"
                                ? "flex-start"
                                : (node.textStyle?.align ?? "center") === "right"
                                ? "flex-end"
                                : "center",
                            color: node.textStyle?.color ?? "#e6e6e6",
                            fontSize: Math.max(10, Math.min(512, node.textStyle?.fontSize ?? 14)),
                            fontFamily: node.textStyle?.fontFamily ?? "var(--font-sans)",
                            fontWeight: node.textStyle?.bold ? 700 : 300,
                            fontStyle: node.textStyle?.italic ? "italic" : "normal",
                            textDecoration: node.textStyle?.underline ? "underline" : "none",
                            textAlign: node.textStyle?.align ?? "center",
                            padding: "8px",
                          }}
                        >
                          {node.title || "Text"}
                        </div>
                      )
                    ) : isImage && src ? (
                      hasEraseMask ? (
                        <svg
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <mask id={printMaskId}>
                              <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                              {(node.erasePaths ?? []).map((erasePath) =>
                                erasePath.points.length > 1 ? (
                                  <polyline
                                    key={erasePath.id}
                                    points={erasePath.points.map((point) => `${point.x},${point.y}`).join(" ")}
                                    fill="none"
                                    stroke="black"
                                    strokeOpacity={Math.max(0.05, Math.min(1, erasePath.opacity))}
                                    strokeWidth={Math.max(1, erasePath.size)}
                                    strokeLinecap={erasePath.shape === "round" ? "round" : erasePath.shape === "square" ? "square" : "butt"}
                                    strokeLinejoin={erasePath.shape === "triangle" ? "bevel" : erasePath.shape === "square" ? "miter" : "round"}
                                  />
                                ) : (
                                  <circle
                                    key={erasePath.id}
                                    cx={erasePath.points[0]?.x ?? 0}
                                    cy={erasePath.points[0]?.y ?? 0}
                                    r={Math.max(0.5, erasePath.size / 2)}
                                    fill="black"
                                    fillOpacity={Math.max(0.05, Math.min(1, erasePath.opacity))}
                                  />
                                )
                              )}
                            </mask>
                          </defs>
                          <image
                            href={src}
                            x="0"
                            y="0"
                            width={size.width}
                            height={size.height}
                            preserveAspectRatio="xMidYMid meet"
                            opacity="0.8"
                            mask={`url(#${printMaskId})`}
                          />
                        </svg>
                      ) : (
                        <img
                          src={src}
                          alt={node.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            opacity: 0.8,
                          }}
                        />
                      )
                    ) : node.type === "image" ? (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: node.layerColor ?? "rgba(255,255,255,0.08)",
                        }}
                      />
                    ) : node.type === "stroke" ? null : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#8a8a8a",
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                        }}
                      >
                        {node.type}
                      </div>
                    )}
                  </div>
                );
              })}
              {currentCanvas.canvasPreset !== "none" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    backgroundImage:
                      currentCanvas.canvasPreset === "paper"
                        ? "radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)"
                        : "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
                    backgroundSize: "3px 3px",
                    opacity: currentCanvas.canvasPreset === "paper" ? 0.08 : 0.12,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


