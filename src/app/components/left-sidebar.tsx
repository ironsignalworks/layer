import { useEffect, useState } from "react";
import { Layers, ChevronDown, Plus, Pencil, Trash2, Eye, EyeOff, Eraser, MousePointer2 } from "lucide-react";
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
  selectedLayerId: string;
  onSelectLayer: (id: string) => void;
  onRenameLayer: (id: string, nextTitle: string) => void;
  onCreateCanvas: () => string;
  onRenameCanvas: (nextName: string) => void;
  onDeleteCanvas: () => void;
  activeTool: "select" | "brush" | "eraser";
  onToolChange: (tool: "select" | "brush" | "eraser") => void;
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
  selectedLayerId,
  onSelectLayer,
  onRenameLayer,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  activeTool,
  onToolChange,
}: LeftSidebarProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const currentCanvas = canvases.find((canvas) => canvas.id === currentCanvasId);
  const [draftName, setDraftName] = useState(currentCanvas?.name ?? "");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [draftLayerTitle, setDraftLayerTitle] = useState("");
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
  if (isCollapsed) {
    return (
      <div className="h-full w-full lg:basis-[3.5rem] lg:min-w-[3.5rem] lg:max-w-[3.5rem] bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center py-6 overflow-hidden">
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
    <div className="h-full w-full lg:basis-[16rem] lg:min-w-[16rem] lg:max-w-[16rem] bg-[#0a0a0a] border-r border-white/5 flex flex-col overflow-hidden">
      {/* Header spacer */}
      <div className="flex-shrink-0 h-0" />

      {/* Canvas Selector */}
      <div className="flex-shrink-0 px-6 pt-2 pb-4 border-b border-white/5 overflow-hidden">
        <label className="text-[10px] text-[#737373] mb-2 block uppercase tracking-wider font-light">
          Canvas
        </label>
        <>
          <div className="relative w-full overflow-hidden">
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
                <select
                  value={currentCanvasId}
                  onChange={(e) => onCanvasChange(e.target.value)}
                  className="w-full h-10 min-w-0 bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 pr-8 text-sm font-light appearance-none hover:border-white/20 focus:border-white/30 focus:outline-none transition-colors cursor-pointer rounded-none overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {canvases.map((canvas) => (
                    <option key={canvas.id} value={canvas.id} className="bg-[#0a0a0a]">
                      {canvas.name || " "}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#737373] pointer-events-none" />
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 overflow-hidden w-full">
            <button
              onClick={() => {
                onCreateCanvas();
                setIsRenaming(true);
              }}
              className="flex-1 h-10 px-2 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              New Canvas
            </button>
            <button
              onClick={() => {
                setDraftName(currentCanvas?.name ?? "");
                setIsRenaming(true);
              }}
              className="h-10 w-10 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 rounded-none transition-colors flex items-center justify-center flex-shrink-0"
              aria-label="Rename canvas"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={onDeleteCanvas}
              className="h-10 w-10 border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 rounded-none transition-colors flex items-center justify-center flex-shrink-0"
              aria-label="Delete canvas"
            >
              <Trash2 />
            </button>
          </div>
        </>
      </div>

      {/* Layers */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-6 py-4 min-w-0">
            <div className="mb-3 overflow-hidden">
              <label className="text-[10px] text-[#737373] uppercase tracking-wider block mb-2">
                Canvas Preset
              </label>
              <div className="relative w-full overflow-hidden">
                <select
                  value={canvasPreset}
                  onChange={(event) =>
                    onCanvasPresetChange(event.target.value as LeftSidebarProps["canvasPreset"])
                  }
                  className="w-full h-10 min-w-0 bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 pr-8 text-sm font-light appearance-none hover:border-white/20 focus:border-white/30 focus:outline-none transition-colors cursor-pointer rounded-none overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <option className="bg-[#0a0a0a]" value="none">None</option>
                  <option className="bg-[#0a0a0a]" value="zine">Zine</option>
                  <option className="bg-[#0a0a0a]" value="acid">Acid</option>
                  <option className="bg-[#0a0a0a]" value="retro">Retro</option>
                  <option className="bg-[#0a0a0a]" value="mono">Mono</option>
                  <option className="bg-[#0a0a0a]" value="neon">Neon</option>
                  <option className="bg-[#0a0a0a]" value="paper">Paper</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#737373] pointer-events-none" />
              </div>
            </div>
            <div className="mb-3 overflow-hidden">
              <label className="text-[10px] text-[#737373] uppercase tracking-wider block mb-2">
                Canvas Background
              </label>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 w-full min-w-0 overflow-hidden">
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
            <div className="mt-4 mb-3">
              <div className="text-[10px] text-[#737373] uppercase tracking-wider font-light mb-2">
                Tools
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onToolChange("select")}
                  className={`control-pill h-10 px-2 border text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 ${
                    activeTool === "select"
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <MousePointer2 className="w-4 h-4 stroke-[2.2]" />
                  Select
                </button>
                <button
                  type="button"
                  onClick={() => onToolChange("brush")}
                  className={`control-pill h-10 px-2 border text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 ${
                    activeTool === "brush"
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <Pencil className="w-4 h-4 stroke-[2.2]" />
                  Brush
                </button>
                <button
                  type="button"
                  onClick={() => onToolChange("eraser")}
                  className={`control-pill h-10 px-2 border text-[10px] uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-1 ${
                    activeTool === "eraser"
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <Eraser className="w-4 h-4 stroke-[2.2]" />
                  Eraser
                </button>
              </div>
            </div>
            <div className="text-[10px] text-[#737373] uppercase tracking-wider font-light mb-2">
              Layers
            </div>
            <div className="space-y-1 min-w-0 overflow-hidden">
              {nodes.map((node) => (
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
                  onClick={() => {
                    if (activeTool !== "select") return;
                    onSelectLayer(node.id);
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setRenamingLayerId(node.id);
                    setDraftLayerTitle(node.title || "");
                  }}
                  className={`w-full max-w-full h-10 px-2 rounded-none border text-[10px] font-light transition-colors cursor-grab overflow-hidden min-w-0 flex items-center ${
                    selectedLayerId === node.id
                      ? "border-white/30 bg-white/10 text-[#fafafa]"
                      : draggingId === node.id
                      ? "border-white/30 bg-white/5 text-[#fafafa]"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_5.25rem] items-center gap-1 min-w-0 w-full">
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
                      <span className="truncate min-w-0">{node.title || "Untitled"}</span>
                    )}
                    <span className="text-[9px] uppercase tracking-wider text-[#737373] whitespace-nowrap truncate text-right">
                      {node.type}
                    </span>
                    <div className="flex items-center justify-end gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onToggleLayerVisibility(node.id, !node.visible);
                        }}
                        className={`control-square h-10 w-10 flex items-center justify-center rounded-none border transition-colors ${
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
                        className="control-square h-10 w-10 flex items-center justify-center rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                        aria-label="Delete layer"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {nodes.length === 0 && (
                <div className="text-[10px] text-[#737373]">
                  No layers yet. Add one to create a layer.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="flex-shrink-0 p-6 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="fanzinator-subtitle text-[10px] text-[#737373]">
          <a href="https://ironsignalworks.com" target="_blank" rel="noreferrer">
            IRON SIGNAL WORKS
          </a>
          </div>
        </div>
      </div>
    </div>
  );
}
