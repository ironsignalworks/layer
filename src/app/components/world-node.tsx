import { motion } from "motion/react";
import { Image, Video, Hexagon, Type, MoveDiagonal2, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type NodeType = "image" | "video" | "interactive" | "text";
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
  invertColors?: boolean;
  motionReduced?: boolean;
  textStyle?: NodeTextStyle;
}

interface WorldNodeProps {
  node: NodeData;
  isSelected: boolean;
  parallaxOffset: { x: number; y: number };
  onMouseDown: (event: React.MouseEvent, node: NodeData) => void;
  onClick: (event: React.MouseEvent, node: NodeData) => void;
  onUpdateNode?: (id: string, updates: Partial<NodeData>) => void;
  onResizeStart?: (node: NodeData) => void;
  onResize?: (node: NodeData, size: { width: number; height: number }) => void;
  zoomScale: number;
  zIndex?: number;
}

export function WorldNode({
  node,
  isSelected,
  onMouseDown,
  onClick,
  onUpdateNode,
  onResizeStart,
  onResize,
  zoomScale,
  zIndex,
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

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!onResize) return;
    onResizeStart?.(node);
    resizeState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
    const handleMove = (moveEvent: MouseEvent) => {
      if (!resizeState.current) return;
      const deltaX = (moveEvent.clientX - resizeState.current.startX) / zoomScale;
      const deltaY = (moveEvent.clientY - resizeState.current.startY) / zoomScale;
      const nextWidth = Math.max(minSize, resizeState.current.startWidth + deltaX);
      const nextHeight = Math.max(minSize, resizeState.current.startHeight + deltaY);
      onResize(node, { width: nextWidth, height: nextHeight });
    };
    const handleUp = () => {
      resizeState.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const renderedRotation = draftRotation ?? (node.rotation ?? 0);

  const handleRotateMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const startRotation = node.rotation ?? 0;
    rotationState.current = {
      startX: event.clientX,
      startRotation,
    };
    setDraftRotation(startRotation);
    liveRotationRef.current = startRotation;
    const handleMove = (moveEvent: MouseEvent) => {
      if (!rotationState.current) return;
      const deltaX = moveEvent.clientX - rotationState.current.startX;
      const sensitivity = moveEvent.shiftKey ? 0.1 : 0.35;
      const next = rotationState.current.startRotation - deltaX * sensitivity;
      setDraftRotation(next);
      liveRotationRef.current = next;
    };
    const handleUp = () => {
      const finalRotation = liveRotationRef.current ?? startRotation;
      onUpdateNode?.(node.id, { rotation: Math.round(finalRotation * 10) / 10 });
      rotationState.current = null;
      setDraftRotation(null);
      liveRotationRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <motion.div
      className="absolute cursor-pointer"
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
        duration: draftRotation === null ? 0.3 : 0.06,
        ease: "easeOut",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(event) => {
        event.stopPropagation();
        onMouseDown(event, node);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event, node);
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
          transition-all duration-200
          overflow-hidden
        `}
        style={{
          boxShadow: isSelected
            ? "0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)"
            : "none",
        }}
      >
        {node.type === "text" ? (
          <div
            className="w-full h-full flex items-center px-4"
            style={{ justifyContent: justifyContentByAlign[resolvedTextAlign] }}
          >
            {isEditingText ? (
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
            ) : (
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
            )}
          </div>
        ) : previewSrc ? (
          <img
            src={previewSrc}
            alt={node.title}
            draggable={false}
            className="w-full h-full object-contain opacity-80"
            style={{ filter: node.invertColors ? "invert(1)" : "none" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#737373]">
            {getNodeIcon()}
          </div>
        )}

        {(isHovered || isSelected) && (
          <div className="absolute top-2 left-2 max-w-[70%] px-2 py-1 bg-black/60 border border-white/15">
            <p className="text-white text-[10px] font-light truncate">{node.title || "Untitled"}</p>
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <div className="w-1.5 h-1.5 bg-white" />
          </div>
        )}

        {(isHovered || isSelected) && (
          <button
            type="button"
            aria-label="Rotate layer"
            onMouseDown={handleRotateMouseDown}
            className="absolute bottom-2 left-2 h-5 w-5 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-ew-resize"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        )}

        {(isHovered || isSelected) && (
          <button
            type="button"
            aria-label="Resize layer"
            onMouseDown={handleResizeMouseDown}
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

