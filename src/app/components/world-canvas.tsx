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
  onUpdateNodeLive: (id: string, updates: Partial<NodeData>) => void;
  onCreateStroke: (node: NodeData) => void;
  onDeleteNodesLive: (ids: string[]) => void;
  onStrokeActionStart: () => void;
  activeTool: "select" | "brush" | "eraser";
  brushPreset: "ink" | "marker" | "chalk";
  brushShape: "round" | "square" | "triangle";
  brushSize: number;
  brushColor: string;
  brushOpacity: number;
  onBrushPresetChange: (preset: "ink" | "marker" | "chalk") => void;
  onBrushShapeChange: (shape: "round" | "square" | "triangle") => void;
  onBrushSizeChange: (size: number) => void;
  onBrushColorChange: (color: string) => void;
  onBrushOpacityChange: (opacity: number) => void;
  eraserSize: number;
  eraserFormat: "round" | "square" | "triangle";
  eraserOpacity: number;
  onEraserSizeChange: (size: number) => void;
  onEraserFormatChange: (format: "round" | "square" | "triangle") => void;
  onEraserOpacityChange: (opacity: number) => void;
  printFrame: { x: number; y: number; width: number; height: number; enabled: boolean };
  onPrintFrameChange: (next: { x: number; y: number; width: number; height: number; enabled: boolean }) => void;
  defaultPrintArea: { x: number; y: number; width: number; height: number };
  printOrientation: "portrait" | "landscape";
  onTogglePrintOrientation: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
  onUpdateNodeLive,
  onCreateStroke,
  onDeleteNodesLive,
  onStrokeActionStart,
  activeTool,
  brushPreset,
  brushShape,
  brushSize,
  brushColor,
  brushOpacity,
  onBrushPresetChange,
  onBrushShapeChange,
  onBrushSizeChange,
  onBrushColorChange,
  onBrushOpacityChange,
  eraserSize,
  eraserFormat,
  eraserOpacity,
  onEraserSizeChange,
  onEraserFormatChange,
  onEraserOpacityChange,
  printFrame,
  onPrintFrameChange,
  defaultPrintArea,
  printOrientation,
  onTogglePrintOrientation,
  isFullscreen,
  onToggleFullscreen,
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
  const [isBrushDrawing, setIsBrushDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [toolCursor, setToolCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [toolMenu, setToolMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const strokeActionStartedRef = useRef(false);
  const eraserTargetNodeIdRef = useRef<string | null>(null);
  const eraserPathIdRef = useRef<string | null>(null);
  const eraserModeRef = useRef<"stroke" | "mask" | null>(null);
  const brushStrokeIdRef = useRef<string | null>(null);
  const brushPointsRef = useRef<{ x: number; y: number }[]>([]);
  const frameDrawStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const frameStart = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const frameMouseStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    startDistance: number;
    startScale: number;
    startCenter: { x: number; y: number };
    startCanvasPosition: { x: number; y: number };
  } | null>(null);
  const framePointerIdRef = useRef<number | null>(null);
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
  const zoomLevelToScale = (zoom: number) =>
    zoom <= 100
      ? Math.pow(Math.max(0.0001, zoom / 100), LOW_ZOOM_EXPONENT)
      : 1 + (zoom - 100) / 100;
  const scaleToZoomLevel = (scale: number) => {
    if (scale <= 1) {
      return 100 * Math.pow(Math.max(0.0001, scale), 1 / LOW_ZOOM_EXPONENT);
    }
    return 100 + (scale - 1) * 100;
  };
  const getLocalPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  };
  const minFrameSize = 16;
  const brushPresetDefaults: Record<"ink" | "marker" | "chalk", { size: number; color: string }> = {
    ink: { size: 3, color: "#fafafa" },
    marker: { size: 6, color: "#fafafa" },
    chalk: { size: 10, color: "#d6d6d6" },
  };

  const toCanvasPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const offsetX = rect?.left ?? 0;
    const offsetY = rect?.top ?? 0;
    return {
      x: (clientX - offsetX - canvasPosition.x) / zoomScale,
      y: (clientY - offsetY - canvasPosition.y) / zoomScale,
    };
  };

  const getNodeSize = (node: NodeData) => {
    if (node.width && node.height) {
      return { width: node.width, height: node.height };
    }
    switch (node.type) {
      case "video":
        return { width: 224, height: 128 };
      case "interactive":
        return { width: 176, height: 176 };
      case "text":
        return { width: 220, height: 96 };
      case "stroke":
        return { width: 1, height: 1 };
      default:
        return { width: 192, height: 192 };
    }
  };

  const getPrimarySelectedNode = () =>
    nodes.find((node) => node.id === selectedNodeIds[0]) ?? null;

  const handleNodeResizeLive = (node: NodeData, size: { width: number; height: number }) => {
    if (node.type !== "stroke") {
      onResize(node.id, size);
      return;
    }
    const prevSize = getNodeSize(node);
    const safePrevWidth = Math.max(1, prevSize.width);
    const safePrevHeight = Math.max(1, prevSize.height);
    const nextWidth = Math.max(1, size.width);
    const nextHeight = Math.max(1, size.height);
    const scaleX = nextWidth / safePrevWidth;
    const scaleY = nextHeight / safePrevHeight;
    const scaledStrokePoints = (node.strokePoints ?? []).map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    }));
    const scaledErasePaths = (node.erasePaths ?? []).map((erasePath) => ({
      ...erasePath,
      size: erasePath.size * Math.max(0.001, (Math.abs(scaleX) + Math.abs(scaleY)) / 2),
      points: erasePath.points.map((point) => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
      })),
    }));
    onUpdateNodeLive(node.id, {
      width: nextWidth,
      height: nextHeight,
      strokePoints: scaledStrokePoints,
      erasePaths: scaledErasePaths,
    });
  };

  const getAbsoluteStrokePoints = (node: NodeData) =>
    (node.strokePoints ?? []).map((strokePoint) => ({
      x: node.x + strokePoint.x,
      y: node.y + strokePoint.y,
    }));

  const isWithinToolShape = (
    dx: number,
    dy: number,
    radius: number,
    shape: "round" | "square" | "triangle"
  ) => {
    if (shape === "square") {
      return Math.abs(dx) <= radius && Math.abs(dy) <= radius;
    }
    if (shape === "triangle") {
      const nx = dx / Math.max(radius, 0.001);
      const ny = dy / Math.max(radius, 0.001);
      if (ny < -1 || ny > 1) return false;
      return Math.abs(nx) <= (ny + 1) / 2;
    }
    return dx * dx + dy * dy <= radius * radius;
  };

  const eraseStrokeContentAtPoint = (node: NodeData, point: { x: number; y: number }) => {
    if (node.type !== "stroke" || !node.strokePoints || node.strokePoints.length === 0) return false;
    const threshold = (eraserSize * Math.max(0.05, eraserOpacity)) / Math.max(zoomScale, 0.001);
    const absolutePoints = getAbsoluteStrokePoints(node);
    const keptPoints = absolutePoints.filter((strokePoint) => {
      const dx = strokePoint.x - point.x;
      const dy = strokePoint.y - point.y;
      return !isWithinToolShape(dx, dy, threshold, eraserFormat);
    });
    if (keptPoints.length === absolutePoints.length) return false;
    if (keptPoints.length === 0) {
      if (!strokeActionStartedRef.current) {
        onStrokeActionStart();
        strokeActionStartedRef.current = true;
      }
      onUpdateNodeLive(node.id, {
        x: node.x,
        y: node.y,
        width: 1,
        height: 1,
        strokePoints: [],
      });
      return true;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    keptPoints.forEach((strokePoint) => {
      minX = Math.min(minX, strokePoint.x);
      minY = Math.min(minY, strokePoint.y);
      maxX = Math.max(maxX, strokePoint.x);
      maxY = Math.max(maxY, strokePoint.y);
    });
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const padding = Math.max(2, (node.strokeWidth ?? brushSize) / 2 + 2);
    const nodeX = minX - padding;
    const nodeY = minY - padding;
    const nodeWidth = Math.max(1, width + padding * 2);
    const nodeHeight = Math.max(1, height + padding * 2);
    const localPoints = keptPoints.map((strokePoint) => ({
      x: strokePoint.x - nodeX,
      y: strokePoint.y - nodeY,
    }));
    if (!strokeActionStartedRef.current) {
      onStrokeActionStart();
      strokeActionStartedRef.current = true;
    }
    onUpdateNodeLive(node.id, {
      x: nodeX,
      y: nodeY,
      width: nodeWidth,
      height: nodeHeight,
      strokePoints: localPoints,
    });
    return true;
  };

  const isMaskErasableNode = (node: NodeData) =>
    node.type === "image" || node.type === "text" || node.type === "stroke";

  const getNodeBounds = (node: NodeData) => {
    const size = getNodeSize(node);
    return { x: node.x, y: node.y, width: size.width, height: size.height };
  };

  const isPointInsideNode = (node: NodeData, point: { x: number; y: number }) => {
    const bounds = getNodeBounds(node);
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  };

  const toNodeLocalPoint = (node: NodeData, point: { x: number; y: number }) => {
    const bounds = getNodeBounds(node);
    return {
      x: Math.max(0, Math.min(bounds.width, point.x - bounds.x)),
      y: Math.max(0, Math.min(bounds.height, point.y - bounds.y)),
    };
  };

  const applyMaskErasePath = (node: NodeData, localPoint: { x: number; y: number }, pathId: string) => {
    const currentPaths = node.erasePaths ?? [];
    const existingIndex = currentPaths.findIndex((path) => path.id === pathId);
    if (existingIndex < 0) {
      const nextPaths = [
        ...currentPaths,
        {
          id: pathId,
          size: Math.max(1, eraserSize),
          opacity: Math.max(0.05, Math.min(1, eraserOpacity)),
          shape: eraserFormat,
          points: [localPoint],
        },
      ];
      onUpdateNodeLive(node.id, { erasePaths: nextPaths });
      return;
    }
    const targetPath = currentPaths[existingIndex];
    const lastPoint = targetPath.points[targetPath.points.length - 1];
    if (lastPoint) {
      const dx = localPoint.x - lastPoint.x;
      const dy = localPoint.y - lastPoint.y;
      if (dx * dx + dy * dy < 0.04) {
        return;
      }
    }
    const nextPaths = currentPaths.map((path) =>
      path.id === pathId ? { ...path, points: [...path.points, localPoint] } : path
    );
    onUpdateNodeLive(node.id, { erasePaths: nextPaths });
  };

  const resolveEraserTarget = (point: { x: number; y: number }) => {
    const selectedNode = getPrimarySelectedNode();
    if (selectedNode && (selectedNode.type === "stroke" || isMaskErasableNode(selectedNode))) {
      return selectedNode;
    }
    const threshold = (eraserSize * Math.max(0.05, eraserOpacity)) / Math.max(zoomScale, 0.001);
    return [...nodes].reverse().find((node) => {
      if (node.type === "stroke" && node.strokePoints && node.strokePoints.length > 0) {
        const hitStrokePoint = node.strokePoints.some((strokePoint) => {
          const absX = node.x + strokePoint.x;
          const absY = node.y + strokePoint.y;
          const dx = absX - point.x;
          const dy = absY - point.y;
          return isWithinToolShape(dx, dy, threshold, eraserFormat);
        });
        if (hitStrokePoint) return true;
        // Fallback to stroke node bounds so sparse stroke points are still erasable.
        return isPointInsideNode(node, point);
      }
      if (!isMaskErasableNode(node)) return false;
      return isPointInsideNode(node, point);
    }) ?? null;
  };

  const beginEraseAtPoint = (point: { x: number; y: number }) => {
    const targetNode = resolveEraserTarget(point);
    if (!targetNode) return;
    eraserTargetNodeIdRef.current = targetNode.id;
    if (!strokeActionStartedRef.current) {
      onStrokeActionStart();
      strokeActionStartedRef.current = true;
    }
    eraserModeRef.current = "mask";
    const pathId = `erase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    eraserPathIdRef.current = pathId;
    applyMaskErasePath(targetNode, toNodeLocalPoint(targetNode, point), pathId);
  };

  const continueEraseAtPoint = (point: { x: number; y: number }) => {
    const nodeId = eraserTargetNodeIdRef.current;
    const mode = eraserModeRef.current;
    if (!nodeId || !mode) {
      beginEraseAtPoint(point);
      return;
    }
    const targetNode = nodes.find((node) => node.id === nodeId);
    if (!targetNode) return;
    const pathId = eraserPathIdRef.current;
    if (!pathId || mode !== "mask" || !isMaskErasableNode(targetNode)) return;
    applyMaskErasePath(targetNode, toNodeLocalPoint(targetNode, point), pathId);
  };

  const updateBrushStroke = (point: { x: number; y: number }) => {
    const strokeId = brushStrokeIdRef.current;
    if (!strokeId) return;
    brushPointsRef.current = [...brushPointsRef.current, point];
    const points = brushPointsRef.current;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((item) => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x);
      maxY = Math.max(maxY, item.y);
    });
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const padding = Math.max(2, brushSize / 2 + 2);
    const nodeX = minX - padding;
    const nodeY = minY - padding;
    const nodeWidth = Math.max(1, width + padding * 2);
    const nodeHeight = Math.max(1, height + padding * 2);
    const localPoints = points.map((item) => ({ x: item.x - nodeX, y: item.y - nodeY }));
    onUpdateNodeLive(strokeId, {
      x: nodeX,
      y: nodeY,
      width: nodeWidth,
      height: nodeHeight,
      strokePoints: localPoints,
      strokeWidth: brushSize,
      strokeColor: brushColor,
      strokeShape: brushShape,
      opacity: brushOpacity,
    });
  };

  // Canvas panning / selection
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const targetElement = e.target as HTMLElement | null;
    if (
      targetElement?.closest(
        "button, input, select, textarea, label, [role='button'], [data-no-canvas-pointer]"
      )
    ) {
      return;
    }
    if (e.pointerType === "touch") {
      touchPointsRef.current.set(e.pointerId, getLocalPoint(e.clientX, e.clientY));
      if (touchPointsRef.current.size >= 2) {
        const points = Array.from(touchPointsRef.current.values()).slice(0, 2);
        const [a, b] = points;
        const startDistance = Math.hypot(b.x - a.x, b.y - a.y);
        const startCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinchStateRef.current = {
          startDistance: Math.max(1, startDistance),
          startScale: zoomLevelToScale(zoomLevel),
          startCenter,
          startCanvasPosition: { ...canvasPosition },
        };
        setIsDragging(false);
        setPendingDrag(null);
        setDraggingNodes(null);
        setSelectionRect(null);
        setIsBrushDrawing(false);
        setIsErasing(false);
        eraserTargetNodeIdRef.current = null;
        eraserPathIdRef.current = null;
        eraserModeRef.current = null;
        brushStrokeIdRef.current = null;
        brushPointsRef.current = [];
        activePointerIdRef.current = null;
        e.preventDefault();
        return;
      }
    }
    activePointerIdRef.current = e.pointerId;
    canvasRef.current?.setPointerCapture?.(e.pointerId);
    if (e.pointerType !== "mouse") {
      e.preventDefault();
    }
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-bg")) {
      const start = toCanvasPoint(e.clientX, e.clientY);
      if (!e.shiftKey && activeTool === "brush") {
        setToolMenu((prev) => ({ ...prev, visible: false }));
        onStrokeActionStart();
        strokeActionStartedRef.current = true;
        const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const startPadding = Math.max(2, brushSize / 2 + 2);
        brushStrokeIdRef.current = strokeId;
        brushPointsRef.current = [start];
        onCreateStroke({
          id: strokeId,
          type: "stroke",
          title: "Brush Stroke",
          x: start.x - startPadding,
          y: start.y - startPadding,
          width: Math.max(1, startPadding * 2),
          height: Math.max(1, startPadding * 2),
          visible: true,
          tags: [],
          description: "",
          altText: "",
          rotation: 0,
          invertColors: false,
          strokePoints: [{ x: startPadding, y: startPadding }],
          strokeWidth: brushSize,
          strokeColor: brushColor,
          strokeShape: brushShape,
          opacity: brushOpacity,
        });
        setIsBrushDrawing(true);
        return;
      }
      if (!e.shiftKey && activeTool === "eraser") {
        setToolMenu((prev) => ({ ...prev, visible: false }));
        setIsErasing(true);
        beginEraseAtPoint(start);
        return;
      }
      if (printFrame.enabled && !e.shiftKey) {
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

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, getLocalPoint(e.clientX, e.clientY));
      if (pinchStateRef.current && touchPointsRef.current.size >= 2) {
        const points = Array.from(touchPointsRef.current.values()).slice(0, 2);
        const [a, b] = points;
        const currentDistance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        const currentCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const pinch = pinchStateRef.current;
        const nextScale = pinch.startScale * (currentDistance / pinch.startDistance);
        const nextZoom = clampZoom(scaleToZoomLevel(nextScale));
        const resolvedScale = zoomLevelToScale(nextZoom);
        const anchorWorldX = (pinch.startCenter.x - pinch.startCanvasPosition.x) / pinch.startScale;
        const anchorWorldY = (pinch.startCenter.y - pinch.startCanvasPosition.y) / pinch.startScale;
        const nextCanvasPosition = {
          x: currentCenter.x - anchorWorldX * resolvedScale,
          y: currentCenter.y - anchorWorldY * resolvedScale,
        };
        onZoomChange(nextZoom);
        onCanvasPositionChange(nextCanvasPosition);
        e.preventDefault();
        return;
      }
    }
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && (activeTool === "brush" || activeTool === "eraser") && e.pointerType === "mouse") {
      setToolCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true,
      });
    }
    if (isBrushDrawing) {
      if (e.pointerType !== "mouse") e.preventDefault();
      updateBrushStroke(toCanvasPoint(e.clientX, e.clientY));
      return;
    }
    if (isErasing) {
      if (e.pointerType !== "mouse") e.preventDefault();
      continueEraseAtPoint(toCanvasPoint(e.clientX, e.clientY));
      return;
    }
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
        const { width, height } = getNodeSize(activeNode);
        const activeCenterX = activeUpdate.x + width / 2;
        const activeCenterY = activeUpdate.y + height / 2;
        const threshold = effectiveAlign / zoomScale;
        let alignX: number | null = null;
        let alignY: number | null = null;
        nodes.forEach((node) => {
          if (node.id === activeId) return;
          const size = getNodeSize(node);
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
      onCanvasPositionChange({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handlePointerUp = (pointerId?: number) => {
    const wasPinching = pinchStateRef.current !== null;
    if (pointerId !== undefined && touchPointsRef.current.has(pointerId)) {
      touchPointsRef.current.delete(pointerId);
    }
    if (wasPinching) {
      if (touchPointsRef.current.size < 2) {
        pinchStateRef.current = null;
      }
      activePointerIdRef.current = null;
      return;
    }
    if (pointerId !== undefined && activePointerIdRef.current !== null && pointerId !== activePointerIdRef.current) {
      return;
    }
    activePointerIdRef.current = null;
    setIsDragging(false);
    if (isBrushDrawing) {
      setIsBrushDrawing(false);
      brushStrokeIdRef.current = null;
      brushPointsRef.current = [];
    }
    if (isErasing) {
      setIsErasing(false);
      eraserTargetNodeIdRef.current = null;
      eraserPathIdRef.current = null;
      eraserModeRef.current = null;
    }
    strokeActionStartedRef.current = false;
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
          const { width, height } = getNodeSize(node);
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

  const handlePointerLeave = () => {
    setToolCursor((prev) => ({ ...prev, visible: false }));
    if (activePointerIdRef.current === null) {
      handlePointerUp();
    }
  };

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

  const handleFramePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (!printFrame.enabled) return;
    framePointerIdRef.current = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    setIsFrameDragging(true);
    frameStart.current = {
      x: printFrame.x,
      y: printFrame.y,
      width: printFrame.width,
      height: printFrame.height,
    };
    frameMouseStart.current = { x: event.clientX, y: event.clientY };
  };

  const handleFrameResizePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (!printFrame.enabled) return;
    framePointerIdRef.current = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
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
    const handleMove = (event: PointerEvent) => {
      if (framePointerIdRef.current !== null && event.pointerId !== framePointerIdRef.current) return;
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
    const handleUp = (event: PointerEvent) => {
      if (framePointerIdRef.current !== null && event.pointerId !== framePointerIdRef.current) return;
      framePointerIdRef.current = null;
      setIsFrameDragging(false);
      setIsFrameResizing(false);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isFrameDragging, isFrameResizing, printFrame, onPrintFrameChange, zoomScale, canvasPosition]);

  useEffect(() => {
    const handleWindowPointerDown = () => setToolMenu((prev) => ({ ...prev, visible: false }));
    const handleWindowEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("keydown", handleWindowEscape);
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("keydown", handleWindowEscape);
    };
  }, []);

  const handleToolContextMenu = (event: React.MouseEvent) => {
    if (activeTool !== "brush" && activeTool !== "eraser") return;
    event.preventDefault();
    setToolMenu({ x: event.clientX, y: event.clientY, visible: true });
  };

  return (
    <div
      ref={canvasRef}
      data-role="canvas"
      className={`relative w-full h-full overflow-hidden ${
        activeTool === "brush" || activeTool === "eraser" ? "cursor-none" : "cursor-grab active:cursor-grabbing"
      } ${
        canvasPreset !== "none" ? `canvas-preset-${canvasPreset}` : ""
      }`}
      style={{ background: backgroundColor, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => handlePointerUp(event.pointerId)}
      onPointerCancel={(event) => handlePointerUp(event.pointerId)}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      onContextMenu={handleToolContextMenu}
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
          transformOrigin: "top left",
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        {/* Nodes */}
        {nodes.map((node, index) => (
          <WorldNode
            key={node.id}
            node={node}
            isSelected={activeTool === "select" && selectedNodeIds.includes(node.id)}
            parallaxOffset={{ x: 0, y: 0 }}
            zIndex={index}
            zoomScale={zoomScale}
            disableInteraction={activeTool === "brush" || activeTool === "eraser"}
            onResizeStart={() => onResizeStart()}
            onResize={(target, size) => handleNodeResizeLive(target, size)}
            onUpdateNode={onUpdateNode}
            onPointerDown={(event, target) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              activePointerIdRef.current = event.pointerId;
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
            onPointerUp={(event, target) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
              activePointerIdRef.current = null;
              if (pendingDrag) {
                setPendingDrag(null);
              }
              if (draggingNodes) {
                setDraggingNodes(null);
                onMoveCommit();
                setGuideLines({ alignX: null, alignY: null, snapX: null, snapY: null });
              }
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

      {toolCursor.visible && (activeTool === "brush" || activeTool === "eraser") && (
        <div
          className="absolute pointer-events-none z-[75]"
          style={{
            left: toolCursor.x,
            top: toolCursor.y,
            width: activeTool === "brush" ? brushSize : eraserSize,
            height: activeTool === "brush" ? brushSize : eraserSize,
            transform: "translate(-50%, -50%)",
            border:
              activeTool === "brush"
                ? `1px solid ${brushColor}`
                : "1px dashed rgba(255,255,255,0.9)",
            borderRadius:
              (activeTool === "brush" ? brushShape : eraserFormat) === "round" ? "999px" : "0",
            clipPath:
              (activeTool === "brush" ? brushShape : eraserFormat) === "triangle"
                ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                : undefined,
            background: activeTool === "brush" ? brushColor : "rgba(255,255,255,0.18)",
            opacity: activeTool === "brush" ? Math.max(0.12, brushOpacity * 0.25) : Math.max(0.15, eraserOpacity * 0.2),
            boxShadow: activeTool === "brush" ? `0 0 0 1px ${brushColor}40` : "0 0 0 1px rgba(255,255,255,0.25)",
          }}
        />
      )}

      {toolMenu.visible && (
        <div
          className="fixed z-[80] w-56 border border-white/15 bg-[#0a0a0a] p-3 shadow-2xl"
          style={{ left: toolMenu.x + 8, top: toolMenu.y + 8 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {activeTool === "brush" ? (
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">Brush Settings</div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#737373]">Brush</label>
                <select
                  value={brushPreset}
                  onChange={(event) => {
                    const next = event.target.value as "ink" | "marker" | "chalk";
                    onBrushPresetChange(next);
                    onBrushSizeChange(brushPresetDefaults[next].size);
                    onBrushColorChange(brushPresetDefaults[next].color);
                  }}
                  className="h-8 w-full rounded-none border border-white/10 bg-[#0a0a0a] px-2 text-xs text-[#fafafa] focus:border-white/30 focus:outline-none"
                >
                  <option value="ink">Ink</option>
                  <option value="marker">Marker</option>
                  <option value="chalk">Chalk</option>
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#737373]">
                  <span>Size</span>
                  <span>{Math.round(brushSize)} px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="64"
                  value={brushSize}
                  onChange={(event) => onBrushSizeChange(Number(event.target.value))}
                  className="h-0.5 w-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white/80"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#737373]">
                  <span>Opacity</span>
                  <span>{Math.round(brushOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={Math.round(brushOpacity * 100)}
                  onChange={(event) => onBrushOpacityChange(Math.max(0.05, Math.min(1, Number(event.target.value) / 100)))}
                  className="h-0.5 w-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white/80"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#737373]">Color</label>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(event) => onBrushColorChange(event.target.value)}
                  className="h-8 w-full rounded-none border border-white/10 bg-transparent"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#737373]">Shape</label>
                <select
                  value={brushShape}
                  onChange={(event) => onBrushShapeChange(event.target.value as "round" | "square" | "triangle")}
                  className="h-8 w-full rounded-none border border-white/10 bg-[#0a0a0a] px-2 text-xs text-[#fafafa] focus:border-white/30 focus:outline-none"
                >
                  <option value="round">Round</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">Eraser Settings</div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#737373]">
                  <span>Size</span>
                  <span>{Math.round(eraserSize)} px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="72"
                  value={eraserSize}
                  onChange={(event) => onEraserSizeChange(Number(event.target.value))}
                  className="h-0.5 w-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white/80"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#737373]">
                  <span>Opacity</span>
                  <span>{Math.round(eraserOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={Math.round(eraserOpacity * 100)}
                  onChange={(event) => onEraserOpacityChange(Math.max(0.05, Math.min(1, Number(event.target.value) / 100)))}
                  className="h-0.5 w-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white/80"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#737373]">Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onEraserFormatChange("round")}
                    className={`h-8 rounded-none border text-[10px] uppercase tracking-wider ${
                      eraserFormat === "round"
                        ? "border-white/30 bg-white/10 text-[#fafafa]"
                        : "border-white/10 text-[#737373] hover:border-white/20 hover:text-[#fafafa]"
                    }`}
                  >
                    Round
                  </button>
                  <button
                    type="button"
                    onClick={() => onEraserFormatChange("square")}
                    className={`h-8 rounded-none border text-[10px] uppercase tracking-wider ${
                      eraserFormat === "square"
                        ? "border-white/30 bg-white/10 text-[#fafafa]"
                        : "border-white/10 text-[#737373] hover:border-white/20 hover:text-[#fafafa]"
                    }`}
                  >
                    Square
                  </button>
                  <button
                    type="button"
                    onClick={() => onEraserFormatChange("triangle")}
                    className={`h-8 rounded-none border text-[10px] uppercase tracking-wider ${
                      eraserFormat === "triangle"
                        ? "border-white/30 bg-white/10 text-[#fafafa]"
                        : "border-white/10 text-[#737373] hover:border-white/20 hover:text-[#fafafa]"
                    }`}
                  >
                    Triangle
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-4 right-4 pointer-events-auto z-50">
        <div className="flex items-center gap-2">
          {(showPrintArea || printFrame.enabled) && (
            <button
              type="button"
              onClick={onTogglePrintOrientation}
              className="h-8 px-2 rounded-none border border-white/25 bg-black/55 text-[10px] uppercase tracking-wider text-white/85 hover:border-white/45 hover:text-white transition-colors"
            >
              Page: {printOrientation === "landscape" ? "Landscape" : "Portrait"}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="h-8 w-8 rounded-none border border-white/25 bg-black/55 text-white/85 hover:border-white/45 hover:text-white transition-colors flex items-center justify-center"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3H3v6M15 21h6v-6M21 9V3h-6M3 15v6h6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {(showPrintArea || printFrame.enabled) && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <div
            className="absolute inset-0"
            style={{
              transform: isPrinting ? "none" : `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoomScale})`,
              transformOrigin: "top left",
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
                  PDF Page Area ({printOrientation === "landscape" ? "11 x 8.5" : "8.5 x 11"})
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
                onPointerDown={handleFramePointerDown}
              >
                <div className="absolute top-2 left-2 px-2 py-1 border border-white/30 bg-black/45 text-[10px] uppercase tracking-wider text-white/85 pointer-events-none">
                  Export Snip Area
                </div>
                <div
                  className="absolute bottom-2 right-2 h-5 w-5 border border-white/60 bg-white/25 text-white/90 flex items-center justify-center"
                  style={{ cursor: "nwse-resize" }}
                  onPointerDown={handleFrameResizePointerDown}
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
