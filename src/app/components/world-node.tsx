import { motion } from "motion/react";
import { Image, Video, Hexagon, Type, MoveDiagonal2, RotateCw, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type NodeType = "image" | "video" | "interactive" | "text" | "stroke";
export type TextAlign = "left" | "center" | "right";

export interface NodeTextStyle {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  fontFamily?: string;
  color?: string;
}

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  visible?: boolean;
  width?: number;
  height?: number;
  tags: string[];
  description: string;
  mediaUrl?: string;
  thumbnail?: string;
  altText?: string;
  preset?: "zine" | "acid" | "retro" | "mono" | "neon" | "paper";
  opacity?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  invertColors?: boolean;
  motionReduced?: boolean;
  textStyle?: NodeTextStyle;
  strokePoints?: { x: number; y: number }[];
  strokeWidth?: number;
  strokeColor?: string;
  strokeShape?: "round" | "square" | "triangle";
  erasePaths?: {
    id: string;
    size: number;
    opacity: number;
    shape: "round" | "square" | "triangle";
    points: { x: number; y: number }[];
  }[];
}

interface WorldNodeProps {
  node: NodeData;
  isSelected: boolean;
  parallaxOffset: { x: number; y: number };
  onPointerDown: (event: React.PointerEvent, node: NodeData) => void;
  onPointerUp: (event: React.PointerEvent, node: NodeData) => void;
  onUpdateNode?: (id: string, updates: Partial<NodeData>) => void;
  onResizeStart?: (node: NodeData) => void;
  onResize?: (node: NodeData, size: { width: number; height: number }) => void;
  onResizeEnd?: (node: NodeData) => void;
  zoomScale: number;
  zIndex?: number;
  disableInteraction?: boolean;
}

export function WorldNode({
  node,
  isSelected,
  onPointerDown,
  onPointerUp,
  onUpdateNode,
  onResizeStart,
  onResize,
  onResizeEnd,
  zoomScale,
  zIndex,
  disableInteraction = false,
}: WorldNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(node.title);
  const [draftRotation, setDraftRotation] = useState<number | null>(null);
  const resizeState = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const rotationState = useRef<{
    startX: number;
    startRotation: number;
  } | null>(null);
  const liveRotationRef = useRef<number | null>(null);

  const getNodeShape = () => {
    switch (node.type) {
      case "video":
        return "rounded-none aspect-video";
      default:
        return "rounded-none";
    }
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case "image":
        return <Image className="w-6 h-6" />;
      case "video":
        return <Video className="w-6 h-6" />;
      case "interactive":
        return <Hexagon className="w-6 h-6" />;
      case "text":
        return <Type className="w-6 h-6" />;
      case "stroke":
        return <Pencil className="w-6 h-6" />;
    }
  };

  const getNodeSize = () => {
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
        return { width: node.width ?? 1, height: node.height ?? 1 };
      default:
        return { width: 192, height: 192 };
    }
  };

  const getPreviewSrc = () => {
    if (node.thumbnail) return node.thumbnail;
    if (!node.mediaUrl) return undefined;
    if (node.mediaUrl.startsWith("data:image/")) return node.mediaUrl;
    if (node.mediaUrl.startsWith("blob:")) return node.mediaUrl;
    if (/\.(png|jpe?g|gif|webp|avif)$/i.test(node.mediaUrl)) return node.mediaUrl;
    return undefined;
  };

  const previewSrc = getPreviewSrc();
  const size = getNodeSize();
  const minSize = 80;
  const textStyle = node.textStyle ?? {};
  const resolvedFontSize = Math.max(10, Math.min(512, textStyle.fontSize ?? 14));
  const resolvedTextAlign: TextAlign = textStyle.align ?? "center";
  const resolvedTextColor = textStyle.color ?? "#e6e6e6";
  const erasePaths = node.erasePaths ?? [];
  const hasEraseMask = erasePaths.length > 0;
  const maskId = `erase-mask-${node.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const justifyContentByAlign: Record<TextAlign, "flex-start" | "center" | "flex-end"> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };

  useEffect(() => {
    setDraftText(node.title);
  }, [node.title]);

  useEffect(() => {
    setDraftRotation(null);
    liveRotationRef.current = null;
  }, [node.rotation]);

  const handleResizePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (!onResize) return;
    onResizeStart?.(node);
    const pointerId = event.pointerId;
    resizeState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
    const stopResize = () => {
      if (!resizeState.current) return;
      resizeState.current = null;
      onResizeEnd?.(node);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("mouseup", handleMouseUpFallback);
      window.removeEventListener("blur", handleWindowBlur);
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!resizeState.current) return;
      if (moveEvent.pointerType === "mouse" && (moveEvent.buttons & 1) === 0) {
        stopResize();
        return;
      }
      const deltaX = (moveEvent.clientX - resizeState.current.startX) / zoomScale;
      const deltaY = (moveEvent.clientY - resizeState.current.startY) / zoomScale;
      const nextWidth = Math.max(minSize, resizeState.current.startWidth + deltaX);
      const nextHeight = Math.max(minSize, resizeState.current.startHeight + deltaY);
      onResize(node, { width: nextWidth, height: nextHeight });
    };
    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      stopResize();
    };
    const handleMouseUpFallback = () => stopResize();
    const handleWindowBlur = () => stopResize();
    (event.currentTarget as HTMLElement).setPointerCapture?.(pointerId);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    window.addEventListener("mouseup", handleMouseUpFallback);
    window.addEventListener("blur", handleWindowBlur);
  };

  const renderedRotation = draftRotation ?? (node.rotation ?? 0);

  const handleRotatePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const pointerId = event.pointerId;
    const startRotation = node.rotation ?? 0;
    rotationState.current = {
      startX: event.clientX,
      startRotation,
    };
    setDraftRotation(startRotation);
    liveRotationRef.current = startRotation;
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!rotationState.current) return;
      const deltaX = moveEvent.clientX - rotationState.current.startX;
      const sensitivity = moveEvent.shiftKey ? 0.1 : 0.35;
      const next = rotationState.current.startRotation - deltaX * sensitivity;
      setDraftRotation(next);
      liveRotationRef.current = next;
    };
    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      const finalRotation = liveRotationRef.current ?? startRotation;
      onUpdateNode?.(node.id, { rotation: Math.round(finalRotation * 10) / 10 });
      rotationState.current = null;
      setDraftRotation(null);
      liveRotationRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(pointerId);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  return (
    <motion.div
      className={`absolute ${disableInteraction ? "pointer-events-none" : "cursor-pointer"}`}
      style={{
        left: node.x,
        top: node.y,
        width: size.width,
        height: size.height,
        opacity: node.opacity ?? 1,
        zIndex,
      }}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: node.opacity ?? 1,
        scale: 1,
        rotate: renderedRotation,
      }}
      transition={{
        duration: draftRotation === null ? 0 : 0.06,
        ease: "easeOut",
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={(event) => {
        event.stopPropagation();
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        onPointerDown(event, node);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        onPointerUp(event, node);
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        onPointerUp(event, node);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (node.type !== "text") return;
        setIsEditingText(true);
      }}
    >
      <div
        className={`
          relative w-full h-full
          ${isSelected ? "bg-white/5 border border-white/30 shadow-lg" : "bg-transparent border border-transparent shadow-none"}
          ${getNodeShape()}
          ${node.preset ? `preset-${node.preset}` : ""}
          transition-colors duration-75
          overflow-hidden
        `}
        style={{
          boxSizing: "border-box",
          boxShadow: isSelected
            ? "inset 0 0 0 1px rgba(255, 255, 255, 0.14)"
            : "inset 0 0 0 1px rgba(255, 255, 255, 0)",
        }}
      >
        {node.type === "text" ? (
          isEditingText ? (
            <div
              className="w-full h-full flex items-center px-4"
              style={{ justifyContent: justifyContentByAlign[resolvedTextAlign] }}
            >
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onBlur={() => {
                  setIsEditingText(false);
                  const next = draftText.trim() || "Text";
                  if (next !== node.title) {
                    onUpdateNode?.(node.id, { title: next });
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    (event.target as HTMLTextAreaElement).blur();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraftText(node.title);
                    setIsEditingText(false);
                  }
                }}
                className="w-full h-full bg-transparent text-[#e6e6e6] resize-none focus:outline-none"
                style={{
                  color: resolvedTextColor,
                  fontSize: resolvedFontSize,
                  fontFamily: textStyle.fontFamily ?? "var(--font-sans)",
                  fontWeight: textStyle.bold ? 700 : 300,
                  fontStyle: textStyle.italic ? "italic" : "normal",
                  textDecoration: textStyle.underline ? "underline" : "none",
                  textAlign: resolvedTextAlign,
                }}
                autoFocus
              />
            </div>
          ) : hasEraseMask ? (
            <svg
              className="w-full h-full"
              viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
              preserveAspectRatio="none"
            >
              <defs>
                <mask id={maskId}>
                  <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                  {erasePaths.map((erasePath) =>
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
              <foreignObject x="0" y="0" width={size.width} height={size.height} mask={`url(#${maskId})`}>
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: justifyContentByAlign[resolvedTextAlign],
                    padding: "0 8px",
                    boxSizing: "border-box",
                    color: resolvedTextColor,
                    fontSize: `${resolvedFontSize}px`,
                    fontFamily: textStyle.fontFamily ?? "var(--font-sans)",
                    fontWeight: textStyle.bold ? 700 : 300,
                    fontStyle: textStyle.italic ? "italic" : "normal",
                    textDecoration: textStyle.underline ? "underline" : "none",
                    textAlign: resolvedTextAlign,
                  }}
                >
                  {node.title || "Text"}
                </div>
              </foreignObject>
            </svg>
          ) : (
            <div
              className="w-full h-full flex items-center px-4"
              style={{ justifyContent: justifyContentByAlign[resolvedTextAlign] }}
            >
              <div
                className="w-full"
                style={{
                  color: resolvedTextColor,
                  fontSize: resolvedFontSize,
                  fontFamily: textStyle.fontFamily ?? "var(--font-sans)",
                  fontWeight: textStyle.bold ? 700 : 300,
                  fontStyle: textStyle.italic ? "italic" : "normal",
                  textDecoration: textStyle.underline ? "underline" : "none",
                  textAlign: resolvedTextAlign,
                }}
              >
                {node.title || "Text"}
              </div>
            </div>
          )
        ) : node.type === "stroke" && (node.strokePoints?.length ?? 0) > 1 ? (
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
            preserveAspectRatio="none"
          >
            {hasEraseMask && (
              <defs>
                <mask id={maskId}>
                  <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                  {erasePaths.map((erasePath) =>
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
              strokeLinejoin={node.strokeShape === "triangle" ? "bevel" : node.strokeShape === "square" ? "miter" : "round"}
              vectorEffect="non-scaling-stroke"
              mask={hasEraseMask ? `url(#${maskId})` : undefined}
            />
          </svg>
        ) : previewSrc ? (
          hasEraseMask ? (
            <svg
              className="w-full h-full"
              viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
              preserveAspectRatio="none"
            >
              <defs>
                <mask id={maskId}>
                  <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                  {erasePaths.map((erasePath) =>
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
                href={previewSrc}
                x="0"
                y="0"
                width={size.width}
                height={size.height}
                preserveAspectRatio="xMidYMid meet"
                opacity="0.8"
                mask={`url(#${maskId})`}
                transform={`translate(${node.flipX ? size.width : 0} ${node.flipY ? size.height : 0}) scale(${node.flipX ? -1 : 1} ${node.flipY ? -1 : 1})`}
                style={{ filter: node.invertColors ? "invert(1)" : "none" }}
              />
            </svg>
          ) : (
            <img
              src={previewSrc}
              alt={node.title}
              draggable={false}
              className="w-full h-full object-contain opacity-80"
              style={{
                filter: node.invertColors ? "invert(1)" : "none",
                transform: `scale(${node.flipX ? -1 : 1}, ${node.flipY ? -1 : 1})`,
              }}
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#737373]">
            {getNodeIcon()}
          </div>
        )}

        {(isHovered || isSelected) && (
          <div className="absolute top-1 left-1 max-w-[70%] px-1.5 py-0.5 bg-black/60 border border-white/15">
            <p className="text-white text-[8px] font-light truncate leading-tight">{node.title || "Untitled"}</p>
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <div className="w-1.5 h-1.5 bg-white" />
          </div>
        )}

        {(isHovered || isSelected) && node.type !== "stroke" && (
          <button
            type="button"
            aria-label="Rotate layer"
            onPointerDown={handleRotatePointerDown}
            className="absolute bottom-2 left-2 h-5 w-5 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-ew-resize"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        )}

        {(isHovered || isSelected) && (
          <button
            type="button"
            aria-label="Resize layer"
            onPointerDown={handleResizePointerDown}
            className="absolute bottom-2 right-2 h-5 w-5 cursor-nwse-resize flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <MoveDiagonal2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Node metadata label */}
      {isHovered && (
        <div className="absolute -top-6 left-0 text-[10px] text-[#737373] font-mono uppercase tracking-wider">
          {node.type}
        </div>
      )}
    </motion.div>
  );
}

