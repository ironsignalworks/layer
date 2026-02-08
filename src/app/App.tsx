import { useState, useEffect, useMemo, useRef } from "react";
import { LeftSidebar } from "./components/left-sidebar";
import { RightSidebar } from "./components/right-sidebar";
import { WorldCanvas } from "./components/world-canvas";
import { NodeData } from "./components/world-node";
import { Play, Plus, ZoomIn, RotateCcw, RotateCw, Printer, Upload, Info, Frame, Download, Crop, Link2, PanelLeft, SlidersHorizontal, X } from "lucide-react";

const STORAGE_KEY = "fanzinator:canvas-editor:v2";
const RESET_KEY = "fanzinator:force-reset:v1";
const SCHEMA_VERSION = 1;
const HISTORY_LIMIT = 50;
// 8.5x11 portrait at 96dpi-equivalent working units.
const DEFAULT_PRINT_AREA = { x: 0, y: 0, width: 816, height: 1056 };
const LOW_ZOOM_EXPONENT = 2.321928094887362;

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
};

type Snapshot = {
  canvases: Canvas[];
  currentCanvasId: string;
};

type ExportFormat = "png" | "jpeg" | "webp" | "svg" | "ico";


const initialCanvases: Canvas[] = [
  {
    id: "canvas-1",
    name: "New Canvas",
    nodes: [],
    snapEnabled: true,
    gridSize: 20,
    alignThreshold: 6,
    snapStrength: 1,
    canvasPreset: "none",
    backgroundColor: "#0a0a0a",
  },
];

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
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(1);
  const [exportQuality, setExportQuality] = useState(0.92);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string>("");
  const [isExportPreviewLoading, setIsExportPreviewLoading] = useState(false);
  const [exportEstimatedBytes, setExportEstimatedBytes] = useState<number | null>(null);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMobileLeftSidebar, setShowMobileLeftSidebar] = useState(false);
  const [showMobileRightSidebar, setShowMobileRightSidebar] = useState(false);
  const dragDepthRef = useRef(0);
  const clampZoom = (value: number) => Math.min(200, Math.max(50, Math.round(value)));
  const zoomToCanvasScale = (zoom: number) =>
    zoom <= 100 ? Math.pow(zoom / 100, LOW_ZOOM_EXPONENT) : 1 + (zoom - 100) / 100;
  const handleZoomChange = (value: number) => {
    setZoomLevel(clampZoom(value));
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
    const needsReset = localStorage.getItem(RESET_KEY) !== "done";
    if (needsReset) {
      const freshCanvas: Canvas = {
        id: `canvas-${Date.now()}`,
        name: "New Canvas",
        nodes: [],
        snapEnabled: true,
        gridSize: 20,
        alignThreshold: 6,
        snapStrength: 1,
        canvasPreset: "none",
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
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
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
        const normalized = storedCanvases
          .filter((canvas) => !placeholderNames.has(canvas.name))
          .map((canvas) => ({
          ...canvas,
          name:
            canvas.name === "New Canvas" || canvas.name === "Untitled" ? "" : canvas.name,
        }));
        if (normalized.length > 0) {
          setCanvases(normalized);
          setCurrentCanvasId(storedCurrentId || normalized[0].id);
        } else {
          const freshCanvas: Canvas = {
            id: `canvas-${Date.now()}`,
            name: "",
            nodes: [],
            snapEnabled: true,
            gridSize: 20,
            alignThreshold: 6,
            snapStrength: 1,
            canvasPreset: "none",
            backgroundColor: "#0a0a0a",
          };
          setCanvases([freshCanvas]);
          setCurrentCanvasId(freshCanvas.id);
        }
        setSelectedNodeIds([]);
        setHistoryPast([]);
        setHistoryFuture([]);
      }
      if (!storedCanvases || storedCanvases.length === 0) {
        const freshCanvas: Canvas = {
          id: `canvas-${Date.now()}`,
          name: "",
          nodes: [],
          snapEnabled: true,
          gridSize: 20,
          alignThreshold: 6,
          snapStrength: 1,
          canvasPreset: "none",
          backgroundColor: "#0a0a0a",
        };
        setCanvases([freshCanvas]);
        setCurrentCanvasId(freshCanvas.id);
        setSelectedNodeIds([]);
        setHistoryPast([]);
        setHistoryFuture([]);
      }
    } catch {
      // Ignore malformed storage
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({ canvases, currentCanvasId });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [canvases, currentCanvasId]);

  useEffect(() => {
    if (!customFont) return;
    const styleId = "fanzinator-custom-font";
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

  const recordHistory = () => {
    const snapshot = cloneSnapshot({ canvases, currentCanvasId });
    setHistoryPast((prev) => {
      const next = [...prev, snapshot];
      return next.slice(-HISTORY_LIMIT);
    });
    setHistoryFuture([]);
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
        canvas.id === currentCanvasId ? { ...canvas, backgroundColor: color } : canvas
      )
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
      default:
        return { width: 192, height: 192 };
    }
  };

  const getVisibleNodes = () =>
    (currentCanvas?.nodes ?? []).filter((node) => node.visible !== false);

  const getExportBounds = (nodes: NodeData[]) => {
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
    const nodes = getVisibleNodes();
    if (nodes.length > 0) {
      const bounds = getExportBounds(nodes);
      setExportWidth(Math.max(64, Math.round(bounds.width)));
      setExportHeight(Math.max(64, Math.round(bounds.height)));
    }
    setShowExport(true);
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
    renderHeight: number
  ) => {
    if (!currentCanvas) return "";
    const scaleX = renderWidth / bounds.width;
    const scaleY = renderHeight / bounds.height;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${renderWidth} ${renderHeight}">`
    );
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
      parts.push(`<g opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})">`);
      if (node.type === "text") {
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
          }">${escapeXml(node.title || "Text")}</text>`
        );
      } else {
        const imageSrc = node.mediaUrl || node.thumbnail || "";
        const isImage =
          (node.mediaUrl?.startsWith("data:image/") ||
            node.mediaUrl?.startsWith("blob:") ||
            /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(node.mediaUrl || "")) ||
          (node.thumbnail?.length ?? 0) > 0;
        if (isImage && imageSrc) {
          parts.push(
            `<image href="${escapeXml(imageSrc)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${
              node.invertColors ? ` style="filter:invert(1)"` : ""
            } />`
          );
        } else {
          parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(255,255,255,0.08)" />`);
          parts.push(
            `<text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="middle" text-anchor="middle" fill="#8a8a8a" font-size="12">${escapeXml(
              node.type
            )}</text>`
          );
        }
      }
      parts.push(`</g>`);
    });
    parts.push("</svg>");
    return parts.join("");
  };

  const renderExportCanvas = async (
    nodes: NodeData[],
    bounds: { minX: number; minY: number; width: number; height: number },
    renderWidth: number,
    renderHeight: number
  ) => {
    if (!currentCanvas) throw new Error("No active canvas");
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
      if (node.type === "text") {
        const textStyle = node.textStyle ?? {};
        const fontSize = Math.max(10, Math.min(512, textStyle.fontSize ?? 14)) * Math.min(scaleX, scaleY);
        const fontFamily = (textStyle.fontFamily ?? "IBM Plex Mono").replace(/"/g, "");
        ctx.fillStyle = textStyle.color ?? "#e6e6e6";
        ctx.textBaseline = "middle";
        ctx.font = `${textStyle.italic ? "italic " : ""}${textStyle.bold ? "700" : "300"} ${fontSize}px "${fontFamily}", monospace`;
        if ((textStyle.align ?? "center") === "left") {
          ctx.textAlign = "left";
          ctx.fillText(node.title || "Text", x + 8, y + h / 2, w - 16);
        } else if ((textStyle.align ?? "center") === "right") {
          ctx.textAlign = "right";
          ctx.fillText(node.title || "Text", x + w - 8, y + h / 2, w - 16);
        } else {
          ctx.textAlign = "center";
          ctx.fillText(node.title || "Text", x + w / 2, y + h / 2, w - 16);
        }
      } else {
        const src = node.mediaUrl || node.thumbnail || "";
        const isImage =
          (node.mediaUrl?.startsWith("data:image/") ||
            node.mediaUrl?.startsWith("blob:") ||
            /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(node.mediaUrl || "")) ||
          (node.thumbnail?.length ?? 0) > 0;
        if (isImage && src) {
          try {
            const image = await readImage(src);
            const sourceRatio = image.width / image.height;
            const targetRatio = w / h;
            let drawW = w;
            let drawH = h;
            let drawX = x;
            let drawY = y;
            if (sourceRatio > targetRatio) {
              drawH = w / sourceRatio;
              drawY = y + (h - drawH) / 2;
            } else {
              drawW = h * sourceRatio;
              drawX = x + (w - drawW) / 2;
            }
            ctx.filter = node.invertColors ? "invert(1)" : "none";
            ctx.drawImage(image, drawX, drawY, drawW, drawH);
            ctx.filter = "none";
          } catch {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(x, y, w, h);
          }
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = "#8a8a8a";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `${12 * Math.min(scaleX, scaleY)}px sans-serif`;
          ctx.fillText(node.type.toUpperCase(), x + w / 2, y + h / 2);
        }
      }
      ctx.restore();
    }
    return canvas;
  };

  const runExport = async () => {
    if (!currentCanvas) return;
    const nodes = getVisibleNodes();
    if (nodes.length === 0) {
      window.alert("Nothing to export.");
      return;
    }
    const bounds = getExportBounds(nodes);
    const width = Math.max(16, Math.round(exportWidth));
    const height = Math.max(16, Math.round(exportHeight));
    const renderWidth = width * exportScale;
    const renderHeight = height * exportScale;
    const fileBase = (currentCanvas.name || "canvas").trim().toLowerCase().replace(/\s+/g, "-") || "canvas";

    if (exportFormat === "svg") {
      const svgMarkup = buildExportSvgMarkup(nodes, bounds, renderWidth, renderHeight);
      const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const link = document.createElement("a");
      link.href = svgUrl;
      link.download = `${fileBase}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(svgUrl);
      setShowExport(false);
      return;
    }

    const canvas = await renderExportCanvas(nodes, bounds, renderWidth, renderHeight);

    const mimeType =
      exportFormat === "jpeg"
        ? "image/jpeg"
        : exportFormat === "webp"
        ? "image/webp"
        : "image/png";
    const blob = await blobFromCanvas(
      canvas,
      mimeType,
      exportFormat === "jpeg" || exportFormat === "webp" ? exportQuality : undefined
    );
    const outputBlob =
      exportFormat === "ico"
        ? await buildIcoBlobFromPng(await blobFromCanvas(canvas, "image/png"), renderWidth, renderHeight)
        : blob;
    const extension = exportFormat === "jpeg" ? "jpg" : exportFormat;
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBase}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setShowExport(false);
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
      const renderCanvas = await renderExportCanvas(nodes, bounds, renderWidth, renderHeight);
      const blob = await blobFromCanvas(renderCanvas, "image/png");
      const objectUrl = URL.createObjectURL(blob);
      await navigator.clipboard.writeText(objectUrl);
      window.alert("Image link copied to clipboard.");
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
    const width = Math.max(16, Math.round(exportWidth));
    const height = Math.max(16, Math.round(exportHeight));
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
          const fullSvgMarkup = buildExportSvgMarkup(nodes, bounds, fullWidth, fullHeight);
          setExportEstimatedBytes(new TextEncoder().encode(fullSvgMarkup).length);
          const svgMarkup = buildExportSvgMarkup(nodes, bounds, previewWidth, previewHeight);
          const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
          nextPreviewUrl = URL.createObjectURL(svgBlob);
        } else {
          const canvas = await renderExportCanvas(nodes, bounds, previewWidth, previewHeight);
          const blob = await blobFromCanvas(canvas, "image/png");
          const previewPixels = Math.max(1, previewWidth * previewHeight);
          const fullPixels = Math.max(1, fullWidth * fullHeight);
          const ratio = fullPixels / previewPixels;
          setExportEstimatedBytes(Math.max(1, Math.round(blob.size * ratio)));
          nextPreviewUrl = URL.createObjectURL(blob);
        }
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
    printFrame.enabled,
    printFrame.x,
    printFrame.y,
    printFrame.width,
    printFrame.height,
    canvases,
    currentCanvasId,
  ]);

  const handlePrintCanvas = () => {
    if (!currentCanvas) return;
    const minX = DEFAULT_PRINT_AREA.x;
    const minY = DEFAULT_PRINT_AREA.y;
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
    if (!existingNames.has(base)) return base;
    let index = 2;
    while (existingNames.has(`${base} ${index}`)) index += 1;
    return `${base} ${index}`;
  };

  const handleCreateCanvas = () => {
    recordHistory();
    const name = uniqueCanvasName("New Canvas", new Set(canvases.map((canvas) => canvas.name)));
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
    };
    setCanvases((prev) => [...prev, canvas]);
    setCurrentCanvasId(canvas.id);
    setSelectedNodeIds([]);
    return canvas.id;
  };

  const handleRenameCanvas = (nextName: string) => {
    const target = currentCanvas;
    const cleanName = nextName.trim();
    if (!target || !cleanName || cleanName === target.name) return;
    const existingNames = new Set(
      canvases.filter((canvas) => canvas.id !== target.id).map((canvas) => canvas.name)
    );
    const uniqueName = uniqueCanvasName(cleanName, existingNames);
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
      window.alert("Canvas copied to clipboard.");
    } catch {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fanzinator-${currentCanvas.name.toLowerCase().replace(/\s+/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  const handleSelectNode = (id: string, additive: boolean) => {
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
    handleDuplicateNodes,
    handleDeleteNodes,
    handleClearSelection,
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
  const activePrintArea = DEFAULT_PRINT_AREA;

  return (
    <div 
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
      {isFileDragActive && !isPlaying && (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center">
          <div className="border border-white/25 bg-[#0a0a0a]/80 px-8 py-6 text-center">
            <div className="text-xs uppercase tracking-[0.18em] text-[#a3a3a3]">Drop Files</div>
            <div className="mt-2 text-sm text-[#fafafa]">Import files into current canvas</div>
          </div>
        </div>
      )}
      {!isPlaying && (
      <div className="print-hide flex-shrink-0 min-h-16 px-3 lg:px-8 py-2 lg:py-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 border-b border-white/5 bg-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-0 leading-tight">
            <span className="fanzinator-title text-xl font-light tracking-wide text-[#fafafa]">
              Fanzinator
            </span>
            <span className="fanzinator-subtitle text-[10px] font-light text-[#fafafa]">
              DIY graphic studio
            </span>
          </div>
          <div className="lg:hidden flex items-center gap-2">
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
        <div className="w-full lg:w-auto overflow-x-auto">
          <div className="flex items-center gap-2 lg:gap-3 text-xs text-[#737373] min-w-max pb-1 lg:pb-0">
          <button
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            className="h-10 w-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            aria-label="Undo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            className="h-10 w-10 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            aria-label="Redo"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleTogglePlay}
            className={`h-10 px-3 rounded-none border text-[10px] uppercase tracking-wider transition-colors ${
              isPlaying
                ? "border-white/20 text-[#fafafa] bg-white/5"
                : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
            }`}
          >
            <Play className="w-3 h-3" />
          </button>
          <label className="h-10 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3 h-3" />
            Import
            <input
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
          </label>
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
            className={`h-10 w-[156px] px-3 rounded-none border text-[10px] uppercase tracking-wider transition-colors ${
              printFrame.enabled
                ? "border-white/20 text-[#fafafa] bg-white/5"
                : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5 w-full">
              <Crop className="w-3 h-3" />
              {printFrame.enabled ? "Hide Export Snip" : "Export Snip"}
            </span>
          </button>
          <button
            onClick={openExportPanel}
            className="h-10 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3 h-3" />
            Download
          </button>
          <button
            onClick={() => {
              void handleShareVisibleCanvasImageLink();
            }}
            className="h-10 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Link2 className="w-3 h-3" />
            Share Image Link
          </button>
          <button
            onClick={() => setShowPrintArea((prev) => !prev)}
            className={`h-10 w-[156px] px-3 rounded-none border text-[10px] uppercase tracking-wider transition-colors ${
              showPrintArea
                ? "border-white/20 text-[#fafafa] bg-white/5"
                : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5 w-full">
              <Frame className="w-3 h-3" />
              {showPrintArea ? "Hide Print Area" : "Show Print Area"}
            </span>
          </button>
          <button
            onClick={handlePrintCanvas}
            className="h-10 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3 h-3" />
            Print
          </button>
          <button
            onClick={() => setShowAbout(true)}
            className="h-10 px-3 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Info className="w-3 h-3" />
            About
          </button>
          </div>
        </div>
      </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
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
            canvasBackground={currentCanvas?.backgroundColor ?? "#0a0a0a"}
            onCanvasBackgroundChange={updateCanvasBackground}
            canvasPreset={currentCanvas?.canvasPreset ?? "none"}
            onCanvasPresetChange={updateCanvasPreset}
            selectedLayerId={selectedNodeIds[0] ?? ""}
            onSelectLayer={(id) => setSelectedNodeIds([id])}
            onCreateCanvas={handleCreateCanvas}
            onRenameCanvas={handleRenameCanvas}
            onDeleteCanvas={handleDeleteCanvas}
          />
        </div>
        )}

        {/* Center Canvas */}
        <div className="flex-1 min-w-0 flex flex-col">
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
                    printFrame={printFrame}
                    onPrintFrameChange={setPrintFrame}
                    defaultPrintArea={DEFAULT_PRINT_AREA}
                    showPrintArea={showPrintArea}
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
          {!isPlaying && (
          <div className="print-hide flex-shrink-0 border-t border-white/5 bg-[#0a0a0a] px-3 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-y-4 relative">
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <button
                onClick={handleAddNode}
                className="px-3 h-10 min-w-[120px] text-[10px] uppercase tracking-wider transition-colors rounded-none flex items-center justify-center gap-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Layer
              </button>
              <button
                onClick={handleAddTextLayer}
                className="px-3 h-10 min-w-[120px] text-[10px] uppercase tracking-wider transition-colors rounded-none flex items-center justify-center gap-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Text
              </button>
              <label className="px-3 h-10 min-w-[140px] text-[10px] uppercase tracking-wider transition-colors rounded-none flex items-center justify-center gap-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Import Font
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleImportFont(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-7">
              {/* Zoom */}
              <div className="flex items-center gap-3">
                <ZoomIn className="w-3.5 h-3.5 text-[#737373]" />
                <button
                  onClick={() => handleZoomChange(zoomLevel - 10)}
                  className="h-7 w-7 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors text-[12px]"
                  aria-label="Zoom out"
                >
                  -
                </button>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={zoomLevel}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className="w-20 h-0.5 bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:bg-white/80 [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <button
                  onClick={() => handleZoomChange(zoomLevel + 10)}
                  className="h-7 w-7 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors text-[12px]"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="text-[11px] text-[#737373] font-mono min-w-[4ch] text-right tabular-nums">
                  {zoomLevel}%
                </span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right Sidebar */}
        {!isPlaying && (
        <div className="print-hide hidden lg:block flex-shrink-0 h-full min-h-0 basis-[20rem] min-w-[20rem] max-w-[20rem] overflow-hidden">
          <RightSidebar
            selectedNode={selectedNode}
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
          />
        </div>
        )}
      </div>

      {!isPlaying && isMobileViewport && showMobileLeftSidebar && (
        <div className="print-hide fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setShowMobileLeftSidebar(false)}
            aria-label="Close layers panel"
          />
          <div className="absolute left-0 top-0 h-[100dvh] w-[90vw] max-w-[22rem] bg-[#0a0a0a] border-r border-white/10 flex flex-col">
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
                canvasBackground={currentCanvas?.backgroundColor ?? "#0a0a0a"}
                onCanvasBackgroundChange={updateCanvasBackground}
                canvasPreset={currentCanvas?.canvasPreset ?? "none"}
                onCanvasPresetChange={updateCanvasPreset}
                selectedLayerId={selectedNodeIds[0] ?? ""}
                onSelectLayer={(id) => setSelectedNodeIds([id])}
                onCreateCanvas={handleCreateCanvas}
                onRenameCanvas={handleRenameCanvas}
                onDeleteCanvas={handleDeleteCanvas}
              />
            </div>
          </div>
        </div>
      )}

      {!isPlaying && isMobileViewport && showMobileRightSidebar && (
        <div className="print-hide fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setShowMobileRightSidebar(false)}
            aria-label="Close inspector panel"
          />
          <div className="absolute right-0 top-0 h-[100dvh] w-[90vw] max-w-[24rem] bg-[#0a0a0a] border-l border-white/10 flex flex-col">
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
              />
            </div>
          </div>
        </div>
      )}

      {expandedNode && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-[720px] max-w-[92vw] bg-[#0a0a0a] border border-white/10 rounded-none p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#fafafa] font-light">
                {expandedNode.title || "Preview"}
              </div>
              <button
                onClick={() => setExpandedNodeId(null)}
                className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors"
              >
                Close
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
          <div className="w-[560px] max-w-[92vw] bg-[#0a0a0a] border border-white/10 rounded-none p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#fafafa] font-light">Export Output</div>
              <button
                onClick={() => setShowExport(false)}
                className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-[#737373] mb-2 uppercase tracking-wider font-light">
                  Preview
                </div>
                <div className="w-full h-[220px] border border-white/10 bg-black/30 flex items-center justify-center overflow-hidden">
                  {isExportPreviewLoading ? (
                    <div className="text-xs text-[#737373]">Rendering preview...</div>
                  ) : exportPreviewUrl ? (
                    <img
                      src={exportPreviewUrl}
                      alt="Export preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-[#737373]">No preview available.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block font-light">Format</label>
                  <select
                    value={exportFormat}
                    onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
                  >
                    <option className="bg-[#0a0a0a]" value="png">PNG</option>
                    <option className="bg-[#0a0a0a]" value="jpeg">JPEG</option>
                    <option className="bg-[#0a0a0a]" value="webp">WEBP</option>
                    <option className="bg-[#0a0a0a]" value="svg">SVG</option>
                    <option className="bg-[#0a0a0a]" value="ico">ICO</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block font-light">Resolution</label>
                  <select
                    value={exportScale}
                    onChange={(event) => setExportScale(Number(event.target.value) as 1 | 2 | 3)}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
                  >
                    <option className="bg-[#0a0a0a]" value={1}>1x</option>
                    <option className="bg-[#0a0a0a]" value={2}>2x</option>
                    <option className="bg-[#0a0a0a]" value={3}>3x</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block font-light">Width (px)</label>
                  <input
                    type="number"
                    min="16"
                    value={exportWidth}
                    onChange={(event) => setExportWidth(Math.max(16, Number(event.target.value) || 16))}
                    className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block font-light">Height (px)</label>
                  <input
                    type="number"
                    min="16"
                    value={exportHeight}
                    onChange={(event) => setExportHeight(Math.max(16, Number(event.target.value) || 16))}
                    className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {(exportFormat === "jpeg" || exportFormat === "webp") && (
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
                    className="w-full h-0.5 bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white/80 [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              )}

              <div className="text-[11px] text-[#737373]">
                Final Output: {(exportWidth * exportScale).toLocaleString()} x {(exportHeight * exportScale).toLocaleString()} px
              </div>
              <div className="text-[11px] text-[#737373]">
                Estimated File Size: {exportEstimatedBytes !== null ? formatBytes(exportEstimatedBytes) : "Calculating..."}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
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
                  Export File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-[560px] max-w-[92vw] bg-[#0a0a0a] border border-white/10 rounded-none p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#fafafa] font-light">Fanzinator - Image + Text Editor</div>
              <button
                onClick={() => setShowAbout(false)}
                className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 text-xs text-[#737373] leading-relaxed">
              <div className="text-[#fafafa]">
                Fanzinator is a focused image-and-text canvas editor for fast visual composition.
              </div>
              <div>
                Create multiple canvases, arrange layers in free space, and style text with font, size, color, and alignment controls.
                Work is auto-saved locally in your browser.
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#737373]">Build</div>
                <div>Add Image or Add Text, drag files onto the canvas to import, and manage layers from the left panel.</div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#737373]">Edit</div>
                <div>Use Undo/Redo or Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z, duplicate with Cmd/Ctrl+D, and delete with Delete/Backspace.</div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#737373]">Output</div>
                <div>Use Export Snip to frame visible output, Download for PNG/JPEG/SVG, Share Image Link for quick previews, and Print for page output.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPrinting && currentCanvas && (
        <div
          data-role="print-canvas"
          className="fixed inset-0 bg-[#0a0a0a] z-[9999]"
          style={{ background: currentCanvas.backgroundColor }}
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
                    : { width: 192, height: 192 };
                const isImage =
                  (node.mediaUrl?.startsWith("data:image/") ||
                    node.mediaUrl?.startsWith("blob:") ||
                    /\.(png|jpe?g|gif|webp|avif)$/i.test(node.mediaUrl || "")) ||
                  (node.thumbnail?.length ?? 0) > 0;
                const src = node.mediaUrl || node.thumbnail || "";
                const offsetX = node.x - activePrintArea.x;
                const offsetY = node.y - activePrintArea.y;
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
                      transform: `rotate(${node.rotation ?? 0}deg)`,
                      transformOrigin: "center center",
                      overflow: "hidden",
                      background: "transparent",
                    }}
                  >
                    {node.type === "text" ? (
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
                    ) : isImage && src ? (
                      <img
                        src={src}
                        alt={node.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          opacity: 0.8,
                          filter: node.invertColors ? "invert(1)" : "none",
                        }}
                      />
                    ) : (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

