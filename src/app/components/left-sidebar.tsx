import { useEffect, useRef, useState } from "react";
import { Layers, ChevronDown, Plus, Type, Pencil, Trash2, Eye, EyeOff, Eraser, MousePointer2, Upload, ZoomIn, Image as ImageIcon, Download } from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentCanvasId: string;
  canvases: { id: string; name: string }[];
  onCanvasChange: (canvasId: string) => void;
  nodes: { id: string; title: string; type: string; visible: boolean }[];
  onReorderNodes: (sourceId: string, targetId: string) => void;
  onToggleLayerVisibility: (id: string, visible: boolean) => void;
  onDeleteLayer: (id: string) => void;
  canvasBackground: string;
  onCanvasBackgroundChange: (color: string) => void;
  canvasPreset: "zine" | "acid" | "retro" | "mono" | "neon" | "paper" | "none";
  onCanvasPresetChange: (preset: "zine" | "acid" | "retro" | "mono" | "neon" | "paper" | "none") => void;
  selectedLayerIds: string[];
  onSelectLayer: (id: string, additive: boolean) => void;
  onRenameLayer: (id: string, nextTitle: string) => void;
  onCreateCanvas: () => string;
  onRenameCanvas: (nextName: string) => void;
  onDeleteCanvas: () => void;
  activeTool: "select" | "brush" | "eraser";
  onToolChange: (tool: "select" | "brush" | "eraser") => void;
  onAddLayer: () => void;
  onAddTextLayer: () => void;
  onImportFont: (file: File) => void;
  onImportFile: (file: File) => Promise<void> | void;
  onDownload: () => void;
  zoomLevel: number;
  onZoomChange: (nextZoom: number) => void;
}

export function LeftSidebar({
  isCollapsed,
  onToggleCollapse,
  currentCanvasId,
  canvases,
  onCanvasChange,
  nodes,
  onReorderNodes,
  onToggleLayerVisibility,
  onDeleteLayer,
  canvasBackground,
  onCanvasBackgroundChange,
  canvasPreset,
  onCanvasPresetChange,
  selectedLayerIds,
  onSelectLayer,
  onRenameLayer,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  activeTool,
  onToolChange,
  onAddLayer,
  onAddTextLayer,
  onImportFont,
  onImportFile,
  onDownload,
  zoomLevel,
  onZoomChange,
}: LeftSidebarProps) {
  const presetOptions: Array<{ value: LeftSidebarProps["canvasPreset"]; label: string }> = [
    { value: "none", label: "None" },
    { value: "zine", label: "Zine" },
    { value: "acid", label: "Acid" },
    { value: "retro", label: "Retro" },
    { value: "mono", label: "Mono" },
    { value: "neon", label: "Neon" },
    { value: "paper", label: "Paper" },
  ];
  const [isRenaming, setIsRenaming] = useState(false);
  const currentCanvas = canvases.find((canvas) => canvas.id === currentCanvasId);
  const [draftName, setDraftName] = useState(currentCanvas?.name ?? "");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [draftLayerTitle, setDraftLayerTitle] = useState("");
  const [isCanvasMenuOpen, setIsCanvasMenuOpen] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const canvasMenuRef = useRef<HTMLDivElement | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isRenaming) {
      setDraftName(currentCanvas?.name ?? "");
    }
  }, [currentCanvas?.name, isRenaming]);
  useEffect(() => {
    if (currentCanvas && currentCanvas.name === "") {
      setIsRenaming(true);
    }
  }, [currentCanvas?.id]);
  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (canvasMenuRef.current && !canvasMenuRef.current.contains(target)) {
        setIsCanvasMenuOpen(false);
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(target)) {
        setIsPresetMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, []);
  if (isCollapsed) {
    return (
      <div className="panel-3d h-full w-full lg:basis-[3.5rem] lg:min-w-[3.5rem] lg:max-w-[3.5rem] bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-6 overflow-hidden">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-white/5 transition-colors rounded-none"
        >
          <Layers className="w-4 h-4 text-[#737373]" />
        </button>
      </div>
    );
  }

  return (
    <div className="panel-3d h-full w-full lg:basis-[16rem] lg:min-w-[16rem] lg:max-w-[16rem] bg-[#0a0a0a] border-r border-white/5 flex flex-col overflow-hidden">
      {/* Header spacer */}
      <div className="flex-shrink-0 h-0" />

      {/* Canvas Selector */}
      <div className="relative z-40 flex-shrink-0 px-4 py-3 border-b border-white/5 overflow-visible">
        <div className="flex flex-col gap-1">
          <label className="control-pill w-full h-10 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 cursor-pointer overflow-hidden">
            <Upload />
            Import
            <input
              type="file"
              accept="image/*,text/plain,application/json,.csv,.md"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                await onImportFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={onDownload}
            className="control-pill w-full h-10 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 overflow-hidden"
          >
            <Download />
            Download
          </button>
          <label className="text-[10px] text-[#737373] uppercase tracking-wider font-light">
            Project
          </label>
          <div className="relative w-full overflow-visible z-20" ref={canvasMenuRef}>
            {isRenaming ? (
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => {
                  onRenameCanvas(draftName);
                  setIsRenaming(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onRenameCanvas(draftName);
                    setIsRenaming(false);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraftName(currentCanvas?.name ?? "");
                    setIsRenaming(false);
                  }
                }}
                className="w-full bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 py-2 text-sm font-light focus:border-white/30 focus:outline-none transition-colors rounded-none"
                autoFocus
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsCanvasMenuOpen((prev) => !prev)}
                  className="w-full h-10 min-w-0 bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 pr-8 text-sm font-light hover:border-white/20 focus:border-white/30 focus:outline-none transition-colors cursor-pointer rounded-none overflow-hidden text-ellipsis whitespace-nowrap text-center"
                >
                  {currentCanvas?.name || " "}
                </button>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#737373] pointer-events-none" />
                {isCanvasMenuOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-[80] max-h-[min(16rem,calc(100vh-10rem))] overflow-y-auto border border-white/10 bg-[#0a0a0a] rounded-none">
                    {canvases.map((canvas) => (
                      <button
                        key={canvas.id}
                        type="button"
                        onClick={() => {
                          onCanvasChange(canvas.id);
                          setIsCanvasMenuOpen(false);
                        }}
                        className={`w-full h-8 px-3 border-b border-white/10 last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                          canvas.id === currentCanvasId
                            ? "text-[#fafafa] bg-white/10"
                            : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                        }`}
                      >
                        {canvas.name || "Untitled"}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_2.2rem_2.2rem] items-center gap-1 overflow-hidden w-full">
            <button
              onClick={() => {
                onCreateCanvas();
                setIsRenaming(true);
              }}
              className="w-full h-10 px-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              New Canvas
            </button>
            <button
              onClick={() => {
                setDraftName(currentCanvas?.name ?? "");
                setIsRenaming(true);
              }}
              className="h-10 w-full border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 rounded-none transition-colors flex items-center justify-center"
              aria-label="Rename canvas"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={onDeleteCanvas}
              className="h-10 w-full border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 rounded-none transition-colors flex items-center justify-center"
              aria-label="Delete canvas"
            >
              <Trash2 />
            </button>
          </div>
        </div>
      </div>

      {/* Layers */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-4 py-4 min-w-0">
            <div className="mb-4 overflow-visible relative z-10">
              <label className="text-[10px] text-[#737373] uppercase tracking-wider block mb-2">
                Canvas Preset
              </label>
              <div className="relative w-full overflow-visible z-20" ref={presetMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPresetMenuOpen((prev) => !prev)}
                  className="w-full h-10 min-w-0 bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 pr-8 text-sm font-light hover:border-white/20 focus:border-white/30 focus:outline-none transition-colors cursor-pointer rounded-none overflow-hidden text-ellipsis whitespace-nowrap text-center"
                >
                  {presetOptions.find((option) => option.value === canvasPreset)?.label ?? "None"}
                </button>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#737373] pointer-events-none" />
                {isPresetMenuOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-[80] border border-white/10 bg-[#0a0a0a] rounded-none overflow-hidden">
                    {presetOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onCanvasPresetChange(option.value);
                          setIsPresetMenuOpen(false);
                        }}
                        className={`w-full h-8 px-3 border-b border-white/10 last:border-b-0 text-left text-[10px] uppercase tracking-wider transition-colors ${
                          option.value === canvasPreset
                            ? "text-[#fafafa] bg-white/10"
                            : "text-[#737373] hover:text-[#fafafa] hover:bg-white/5"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mb-4 overflow-hidden">
              <label className="text-[10px] text-[#737373] uppercase tracking-wider block mb-2">
                Canvas Background
              </label>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-1 w-full min-w-0 overflow-hidden">
                <input
                  type="color"
                  value={canvasBackground}
                  onChange={(event) => onCanvasBackgroundChange(event.target.value)}
                  className="control-square h-10 w-10 border border-white/10 bg-transparent flex-shrink-0"
                />
                <input
                  type="text"
                  value={canvasBackground}
                  onChange={(event) => onCanvasBackgroundChange(event.target.value)}
                  className="control-pill w-full h-10 px-3 border border-white/10 bg-transparent text-[#fafafa] text-xs uppercase tracking-wider rounded-none focus:border-white/20 focus:outline-none min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                />
              </div>
            </div>
            <div className="mb-4">
              <div className="text-[10px] text-[#737373] uppercase tracking-wider font-light mb-2">
                Tools
              </div>
              <div className="grid grid-cols-3 gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onToolChange("select")}
                  className={`control-pill w-full min-w-0 h-10 px-2 border text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 overflow-hidden ${
                    activeTool === "select"
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <MousePointer2 className="tool-mode-icon tool-mode-icon-select" />
                  Select
                </button>
                <button
                  type="button"
                  onClick={() => onToolChange("brush")}
                  className={`control-pill w-full min-w-0 h-10 px-2 border text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 overflow-hidden ${
                    activeTool === "brush"
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <Pencil className="tool-mode-icon" />
                  Brush
                </button>
                <button
                  type="button"
                  onClick={() => onToolChange("eraser")}
                  className={`control-pill w-full min-w-0 h-10 px-2 border text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 overflow-hidden ${
                    activeTool === "eraser"
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <Eraser className="tool-mode-icon tool-mode-icon-eraser" />
                  Eraser
                </button>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 min-w-0">
                <button
                  type="button"
                  onClick={onAddLayer}
                  className="control-pill w-full min-w-0 h-10 px-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 overflow-hidden"
                >
                  <Plus />
                  Add Layer
                </button>
                <button
                  type="button"
                  onClick={onAddTextLayer}
                  className="control-pill w-full min-w-0 h-10 px-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 overflow-hidden"
                >
                  <Type />
                  Add Text
                </button>
                <label className="control-pill w-full min-w-0 h-10 px-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 cursor-pointer overflow-hidden">
                  <Upload />
                  Import Font
                  <input
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      onImportFont(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="mt-1 min-w-0 overflow-hidden">
                <div className="grid grid-cols-2 gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onZoomChange(zoomLevel - 10)}
                    className="control-pill w-full min-w-0 h-10 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                    aria-label="Zoom out"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => onZoomChange(zoomLevel + 10)}
                    className="control-pill w-full min-w-0 h-10 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[0.9rem_minmax(0,1fr)_3.25rem] items-center gap-1 min-w-0 overflow-hidden">
                  <ZoomIn className="w-3.5 h-3.5 text-[#737373]" />
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={zoomLevel}
                    onChange={(event) => onZoomChange(Number(event.target.value))}
                    className="compact-range flex-1 min-w-0 h-0.5 bg-white/10 appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-[#737373] tabular-nums w-[3.25rem] text-right">
                    {zoomLevel}%
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-[#737373] uppercase tracking-wider font-light mb-2">
              Layers
            </div>
            <div className="space-y-1 min-w-0 overflow-hidden">
              {nodes.map((node) => {
                const isSelectedLayer = selectedLayerIds.includes(node.id);
                const isDraggingLayer = draggingId === node.id;
                return (
                <div
                  key={node.id}
                  draggable
                  onDragStart={() => setDraggingId(node.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (!draggingId || draggingId === node.id) return;
                    onReorderNodes(draggingId, node.id);
                    setDraggingId(null);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={(event) => {
                    onSelectLayer(node.id, event.shiftKey || event.metaKey || event.ctrlKey);
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setRenamingLayerId(node.id);
                    setDraftLayerTitle(node.title || "");
                  }}
                  className={`layer-row relative w-full max-w-full h-11 pl-2 pr-1.5 rounded-none border text-[10px] font-light transition-colors cursor-grab overflow-visible min-w-0 flex items-center ${
                    isSelectedLayer
                      ? "border-white/40 text-[#fafafa] layer-row-selected"
                      : isDraggingLayer
                      ? "border-white/30 text-[#fafafa] layer-row-selected"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  {isSelectedLayer && (
                    <div className="absolute left-0 top-0 h-full w-1 bg-white/80 pointer-events-none" />
                  )}
                  <div className={`absolute -left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isSelectedLayer ? "text-[#fafafa]" : "text-[#737373]"}`}>
                    {node.type === "text" ? (
                      <Type className="w-3.5 h-3.5" />
                    ) : node.type === "image" ? (
                      <ImageIcon className="w-3.5 h-3.5" />
                    ) : (
                      <Pencil className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_4.6rem] items-center gap-0.5 min-w-0 w-full">
                    {renamingLayerId === node.id ? (
                      <input
                        value={draftLayerTitle}
                        onChange={(event) => setDraftLayerTitle(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => {
                          onRenameLayer(node.id, draftLayerTitle.trim() || "Untitled");
                          setRenamingLayerId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            onRenameLayer(node.id, draftLayerTitle.trim() || "Untitled");
                            setRenamingLayerId(null);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRenamingLayerId(null);
                            setDraftLayerTitle(node.title || "");
                          }
                        }}
                        className="w-full h-5 bg-transparent border border-white/15 px-1 text-[10px] text-[#fafafa] rounded-none focus:outline-none focus:border-white/30"
                        autoFocus
                      />
                    ) : (
                      <span className={`truncate min-w-0 ${isSelectedLayer ? "text-[#fafafa]" : ""}`}>{node.title || "Untitled"}</span>
                    )}
                    <div className="grid grid-cols-2 gap-0.5 items-center justify-end flex-shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onToggleLayerVisibility(node.id, !node.visible);
                        }}
                        className={`control-square h-full w-full flex items-center justify-center rounded-none border transition-colors ${
                          node.visible
                            ? "border-white/20 text-[#fafafa] bg-white/5"
                            : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                        }`}
                        aria-label={node.visible ? "Hide layer" : "Show layer"}
                      >
                        {node.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteLayer(node.id);
                        }}
                        className="control-square h-full w-full flex items-center justify-center rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                        aria-label="Delete layer"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </div>
              )})}
              {nodes.length === 0 && (
                <div className="text-[10px] text-[#737373]">
                  No layers yet. Add one to create a layer.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="panel-3d flex-shrink-0 px-4 py-2 border-t border-white/5">
        <div className="flex flex-col items-stretch gap-1">
          <div className="text-center">
            <a
              href="https://donate.stripe.com/4gMdR25le5GXenHbrT5Ne00"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center justify-center px-2 border border-white/20 bg-white/10 text-[8px] tracking-[0.16em] text-[#fafafa] hover:bg-white/15 hover:border-white/30 transition-colors"
            >
              HELP KEEP THIS FREE
            </a>
          </div>
          <div className="layer-subtitle text-[8px] text-[#737373] text-center whitespace-nowrap">
            <a href="https://ironsignalworks.com" target="_blank" rel="noreferrer">
              IRON SIGNAL WORKS
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

