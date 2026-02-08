import { useState, useRef, useEffect } from "react";
import { MoveDiagonal2 } from "lucide-react";
import { WorldNode, NodeData } from "./world-node";

const LOW_ZOOM_EXPONENT = 2.321928094887362;

interface WorldCanvasProps {
  nodes: NodeData[];
  selectedNodeIds: string[];
  onSelectNode: (id: string, additive: boolean) => void;
  onBoxSelect: (ids: string[], additive: boolean) => void;
  onClearSelection: () => void;
  zoomLevel: number;
  canvasPosition: { x: number; y: number };
  onCanvasPositionChange: (next: { x: number; y: number }) => void;
  onMoveNodes: (updates: { id: string; x: number; y: number }[]) => void;
  onMoveCommit: () => void;
  onNodeClick: (node: NodeData) => void;
  onZoomChange: (nextZoom: number) => void;
  onResizeStart: () => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onUpdateNode: (id: string, updates: Partial<NodeData>) => void;
  printFrame: { x: number; y: number; width: number; height: number; enabled: boolean };
  onPrintFrameChange: (next: { x: number; y: number; width: number; height: number; enabled: boolean }) => void;
  defaultPrintArea: { x: number; y: number; width: number; height: number };
  showPrintArea: boolean;
  backgroundColor: string;
  canvasPreset: "zine" | "acid" | "retro" | "mono" | "neon" | "paper" | "none";
  snapToGrid: boolean;
  gridSize: number;
  alignThreshold: number;
  snapStrength: number;
}

export function WorldCanvas({
  nodes,
  selectedNodeIds,
  onSelectNode,
  onBoxSelect,
  onClearSelection,
  zoomLevel,
  canvasPosition,
  onCanvasPositionChange,
  onMoveNodes,
  onMoveCommit,
  onNodeClick,
  onZoomChange,
  onResizeStart,
  onResize,
  onUpdateNode,
  printFrame,
  onPrintFrameChange,
  defaultPrintArea,
  showPrintArea,
  backgroundColor,
  canvasPreset,
  snapToGrid,
  gridSize,
  alignThreshold,
  snapStrength,
}: WorldCanvasProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingNodes, setDraggingNodes] = useState<{
    startMouse: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
  } | null>(null);
  const [pendingDrag, setPendingDrag] = useState<{
    startMouse: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
  } | null>(null);
  const [guideLines, setGuideLines] = useState<{
    alignX: number | null;
    alignY: number | null;
    snapX: number | null;
    snapY: number | null;
  }>({ alignX: null, alignY: null, snapX: null, snapY: null });
  const [selectionRect, setSelectionRect] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
    additive: boolean;
  } | null>(null);
  const [isFrameDrawing, setIsFrameDrawing] = useState(false);
  const [isFrameDragging, setIsFrameDragging] = useState(false);
  const [isFrameResizing, setIsFrameResizing] = useState(false);
  const frameDrawStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const frameStart = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const frameMouseStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveFrame = useRef<number | null>(null);
  const pendingMove = useRef<{ id: string; x: number; y: number }[] | null>(null);
  const dragMoved = useRef(false);
  const zoomScale =
    zoomLevel <= 100
      ? Math.pow(zoomLevel / 100, LOW_ZOOM_EXPONENT)
      : 1 + (zoomLevel - 100) / 100;
  const effectiveGrid = Math.max(6, gridSize);
  const effectiveAlign = Math.max(1, alignThreshold);
  const effectiveSnapStrength = Math.min(1, Math.max(0, snapStrength));
  const dragThreshold = 4;
  const clampZoom = (value: number) => Math.min(200, Math.max(50, Math.round(value)));
  const minFrameSize = 16;

  const toCanvasPoint = (clientX: number, clientY: number) => ({
    x: (clientX - canvasPosition.x) / zoomScale,
    y: (clientY - canvasPosition.y) / zoomScale,
  });

  const getNodeSize = (type: NodeData["type"]) => {
    switch (type) {
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

  // Canvas panning / selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-bg")) {
      if (printFrame.enabled && !e.shiftKey) {
        const start = toCanvasPoint(e.clientX, e.clientY);
        frameDrawStart.current = start;
        setIsFrameDrawing(true);
        onPrintFrameChange({
          ...printFrame,
          enabled: true,
          x: start.x,
          y: start.y,
          width: 1,
          height: 1,
        });
        return;
      }
      if (e.shiftKey) {
        setSelectionRect({
          start: { x: e.clientX, y: e.clientY },
          current: { x: e.clientX, y: e.clientY },
          additive: true,
        });
      } else {
        onClearSelection();
        setIsDragging(true);
        setDragStart({
          x: e.clientX - canvasPosition.x,
          y: e.clientY - canvasPosition.y,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isFrameDrawing) {
      const current = toCanvasPoint(e.clientX, e.clientY);
      const start = frameDrawStart.current;
      const nextX = Math.min(start.x, current.x);
      const nextY = Math.min(start.y, current.y);
      const nextWidth = Math.max(minFrameSize, Math.abs(current.x - start.x));
      const nextHeight = Math.max(minFrameSize, Math.abs(current.y - start.y));
      onPrintFrameChange({
        ...printFrame,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        enabled: true,
      });
      return;
    }
    if (selectionRect) {
      setSelectionRect((prev) =>
        prev
          ? {
              ...prev,
              current: { x: e.clientX, y: e.clientY },
            }
          : null
      );
      return;
    }
    if (pendingDrag) {
      if (e.buttons === 0) {
        setPendingDrag(null);
        return;
      }
      const dx = e.clientX - pendingDrag.startMouse.x;
      const dy = e.clientY - pendingDrag.startMouse.y;
      if (Math.hypot(dx, dy) >= dragThreshold) {
        dragMoved.current = true;
        setDraggingNodes(pendingDrag);
        setPendingDrag(null);
      } else {
        return;
      }
    }
    if (draggingNodes) {
      dragMoved.current = true;
      const deltaX = (e.clientX - draggingNodes.startMouse.x) / zoomScale;
      const deltaY = (e.clientY - draggingNodes.startMouse.y) / zoomScale;
      const updates = Object.entries(draggingNodes.startPositions).map(([id, pos]) => {
        let nextX = pos.x + deltaX;
        let nextY = pos.y + deltaY;
        if (snapToGrid) {
          const snapX = Math.round(nextX / effectiveGrid) * effectiveGrid;
          const snapY = Math.round(nextY / effectiveGrid) * effectiveGrid;
          nextX = nextX + (snapX - nextX) * effectiveSnapStrength;
          nextY = nextY + (snapY - nextY) * effectiveSnapStrength;
        }
        return { id, x: nextX, y: nextY };
      });
      pendingMove.current = updates;
      if (moveFrame.current === null) {
        moveFrame.current = requestAnimationFrame(() => {
          if (pendingMove.current) {
            onMoveNodes(pendingMove.current);
            pendingMove.current = null;
          }
          moveFrame.current = null;
        });
      }

      const activeId = Object.keys(draggingNodes.startPositions)[0];
      const activeUpdate = updates.find((item) => item.id === activeId);
      const activeNode = nodes.find((node) => node.id === activeId);
      if (activeUpdate && activeNode) {
        const { width, height } = getNodeSize(activeNode.type);
        const activeCenterX = activeUpdate.x + width / 2;
        const activeCenterY = activeUpdate.y + height / 2;
        const threshold = effectiveAlign / zoomScale;
        let alignX: number | null = null;
        let alignY: number | null = null;
        nodes.forEach((node) => {
          if (node.id === activeId) return;
          const size = getNodeSize(node.type);
          const centerX = node.x + size.width / 2;
          const centerY = node.y + size.height / 2;
          if (alignX === null && Math.abs(centerX - activeCenterX) < threshold) {
            alignX = centerX;
          }
          if (alignY === null && Math.abs(centerY - activeCenterY) < threshold) {
            alignY = centerY;
          }
        });
        const snapX = snapToGrid ? Math.round(activeUpdate.x / effectiveGrid) * effectiveGrid : null;
        const snapY = snapToGrid ? Math.round(activeUpdate.y / effectiveGrid) * effectiveGrid : null;
        setGuideLines({ alignX, alignY, snapX, snapY });
      }
      return;
    }
    if (isDragging) {
      if (e.buttons === 0) {
        setIsDragging(false);
        return;
      }
      onCanvasPositionChange({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (pendingDrag) {
      setPendingDrag(null);
    }
    if (moveFrame.current !== null) {
      cancelAnimationFrame(moveFrame.current);
      moveFrame.current = null;
    }
    if (pendingMove.current) {
      onMoveNodes(pendingMove.current);
      pendingMove.current = null;
    }
    if (selectionRect) {
      const rect = selectionRect;
      setSelectionRect(null);
      const minX = Math.min(rect.start.x, rect.current.x);
      const maxX = Math.max(rect.start.x, rect.current.x);
      const minY = Math.min(rect.start.y, rect.current.y);
      const maxY = Math.max(rect.start.y, rect.current.y);
      const ids = nodes
        .filter((node) => {
          const { width, height } = getNodeSize(node.type);
          const nodeLeft = canvasPosition.x + node.x * zoomScale;
          const nodeTop = canvasPosition.y + node.y * zoomScale;
          const nodeRight = nodeLeft + width * zoomScale;
          const nodeBottom = nodeTop + height * zoomScale;
          return nodeRight >= minX && nodeLeft <= maxX && nodeBottom >= minY && nodeTop <= maxY;
        })
        .map((node) => node.id);
      onBoxSelect(ids, rect.additive);
    }
    if (draggingNodes) {
      setDraggingNodes(null);
      onMoveCommit();
      setGuideLines({ alignX: null, alignY: null, snapX: null, snapY: null });
    }
    if (isFrameDrawing) {
      setIsFrameDrawing(false);
    }
    if (isFrameDragging) {
      setIsFrameDragging(false);
    }
    if (isFrameResizing) {
      setIsFrameResizing(false);
    }
  };

  useEffect(() => {
    const handleWindowMouseUp = () => {
      handleMouseUp();
    };
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  });

  const handleWheel = (event: React.WheelEvent) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const delta = -event.deltaY / 8;
    onZoomChange(clampZoom(zoomLevel + delta));
  };

  useEffect(() => {
    const onBeforePrint = () => setIsPrinting(true);
    const onAfterPrint = () => setIsPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const handleFrameMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!printFrame.enabled) return;
    setIsFrameDragging(true);
    frameStart.current = {
      x: printFrame.x,
      y: printFrame.y,
      width: printFrame.width,
      height: printFrame.height,
    };
    frameMouseStart.current = { x: event.clientX, y: event.clientY };
  };

  const handleFrameResizeMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!printFrame.enabled) return;
    setIsFrameResizing(true);
    frameStart.current = {
      x: printFrame.x,
      y: printFrame.y,
      width: printFrame.width,
      height: printFrame.height,
    };
    frameMouseStart.current = { x: event.clientX, y: event.clientY };
  };

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!printFrame.enabled) return;
      if (isFrameDragging) {
        const delta = toCanvasPoint(event.clientX, event.clientY);
        const start = toCanvasPoint(frameMouseStart.current.x, frameMouseStart.current.y);
        const dx = delta.x - start.x;
        const dy = delta.y - start.y;
        onPrintFrameChange({
          ...printFrame,
          x: frameStart.current.x + dx,
          y: frameStart.current.y + dy,
        });
      }
      if (isFrameResizing) {
        const delta = toCanvasPoint(event.clientX, event.clientY);
        const start = toCanvasPoint(frameMouseStart.current.x, frameMouseStart.current.y);
        const dx = delta.x - start.x;
        const dy = delta.y - start.y;
        onPrintFrameChange({
          ...printFrame,
          width: Math.max(minFrameSize, frameStart.current.width + dx),
          height: Math.max(minFrameSize, frameStart.current.height + dy),
        });
      }
    };
    const handleUp = () => {
      setIsFrameDragging(false);
      setIsFrameResizing(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isFrameDragging, isFrameResizing, printFrame, onPrintFrameChange, zoomScale, canvasPosition]);

  return (
    <div
      ref={canvasRef}
      data-role="canvas"
      className={`relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing ${
        canvasPreset !== "none" ? `canvas-preset-${canvasPreset}` : ""
      }`}
      style={{ background: backgroundColor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none canvas-bg"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: `${effectiveGrid * zoomScale}px ${effectiveGrid * zoomScale}px`,
          transform: `translate(${canvasPosition.x % (effectiveGrid * zoomScale)}px, ${canvasPosition.y % (effectiveGrid * zoomScale)}px)`,
        }}
      />

      {/* Canvas content */}
      <div
        data-role="canvas-content"
        className="absolute inset-0 canvas-bg"
        style={{
          transform: isPrinting ? "none" : `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoomScale})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        {/* Nodes */}
        {nodes.map((node, index) => (
          <WorldNode
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.includes(node.id)}
            parallaxOffset={{ x: 0, y: 0 }}
            zIndex={index}
            zoomScale={zoomScale}
            onResizeStart={() => onResizeStart()}
            onResize={(target, size) => onResize(target.id, size)}
            onUpdateNode={onUpdateNode}
            onMouseDown={(event, target) => {
              if (event.button !== 0) return;
              dragMoved.current = false;
              const additive = event.shiftKey || event.metaKey || event.ctrlKey;
              if (!selectedNodeIds.includes(target.id) && !additive) {
                onSelectNode(target.id, false);
              } else if (additive) {
                onSelectNode(target.id, true);
              }
              const selectedIds = selectedNodeIds.includes(target.id)
                ? selectedNodeIds
                : additive
                ? [...selectedNodeIds, target.id]
                : [target.id];
              const startPositions = selectedIds.reduce<Record<string, { x: number; y: number }>>(
                (acc, id) => {
                  const nodeData = nodes.find((item) => item.id === id);
                  if (nodeData) acc[id] = { x: nodeData.x, y: nodeData.y };
                  return acc;
                },
                {}
              );
              setPendingDrag({
                startMouse: { x: event.clientX, y: event.clientY },
                startPositions,
              });
            }}
            onClick={(event, target) => {
              if (event.button !== 0) return;
              if (dragMoved.current) return;
              onNodeClick(target);
            }}
          />
        ))}
      </div>

      {selectionRect && (
        <div
          className="absolute border border-white/30 bg-white/5 pointer-events-none"
          style={{
            left: Math.min(selectionRect.start.x, selectionRect.current.x),
            top: Math.min(selectionRect.start.y, selectionRect.current.y),
            width: Math.abs(selectionRect.current.x - selectionRect.start.x),
            height: Math.abs(selectionRect.current.y - selectionRect.start.y),
          }}
        />
      )}

      {(guideLines.alignX !== null || guideLines.snapX !== null) && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left:
              (guideLines.alignX ?? guideLines.snapX ?? 0) * zoomScale +
              canvasPosition.x,
            width: 1,
            background:
              guideLines.alignX !== null ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
            borderLeft:
              guideLines.alignX === null && guideLines.snapX !== null
                ? "1px dashed rgba(255,255,255,0.3)"
                : undefined,
          }}
        />
      )}
      {(guideLines.alignY !== null || guideLines.snapY !== null) && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top:
              (guideLines.alignY ?? guideLines.snapY ?? 0) * zoomScale +
              canvasPosition.y,
            height: 1,
            background:
              guideLines.alignY !== null ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
            borderTop:
              guideLines.alignY === null && guideLines.snapY !== null
                ? "1px dashed rgba(255,255,255,0.3)"
                : undefined,
          }}
        />
      )}

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none canvas-bg"
        style={{
          background: "radial-gradient(circle at center, transparent 50%, rgba(10, 10, 10, 0.4) 100%)",
        }}
      />

      {(showPrintArea || printFrame.enabled) && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <div
            className="absolute inset-0"
            style={{
              transform: isPrinting ? "none" : `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoomScale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.2s ease-out",
            }}
          >
            {showPrintArea && (
              <div
                className="absolute border border-dashed border-white/45 bg-white/6"
                style={{
                  left: defaultPrintArea.x,
                  top: defaultPrintArea.y,
                  width: defaultPrintArea.width,
                  height: defaultPrintArea.height,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
                  pointerEvents: "none",
                }}
              >
                <div className="absolute top-2 left-2 px-2 py-1 border border-white/30 bg-black/45 text-[10px] uppercase tracking-wider text-white/85 pointer-events-none">
                  PDF Page Area (8.5 x 11)
                </div>
              </div>
            )}
            {printFrame.enabled && (
              <div
                className="absolute border border-white/70 bg-white/5"
                style={{
                  left: printFrame.x,
                  top: printFrame.y,
                  width: printFrame.width,
                  height: printFrame.height,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                  pointerEvents: "auto",
                  cursor: isFrameDragging ? "grabbing" : "grab",
                }}
                onMouseDown={handleFrameMouseDown}
              >
                <div className="absolute top-2 left-2 px-2 py-1 border border-white/30 bg-black/45 text-[10px] uppercase tracking-wider text-white/85 pointer-events-none">
                  Export Snip Area
                </div>
                <div
                  className="absolute bottom-2 right-2 h-5 w-5 border border-white/60 bg-white/25 text-white/90 flex items-center justify-center"
                  style={{ cursor: "nwse-resize" }}
                  onMouseDown={handleFrameResizeMouseDown}
                >
                  <MoveDiagonal2 className="w-3 h-3" />
                </div>
              </div>
            )}
            {printFrame.enabled && printFrame.width <= 1 && printFrame.height <= 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-2 border border-white/25 bg-black/50 text-[10px] uppercase tracking-wider text-white/85 pointer-events-none">
                Click and drag to draw export snip area
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
