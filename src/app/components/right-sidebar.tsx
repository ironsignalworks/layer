import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ScrollArea } from "../components/ui/scroll-area";
import { NodeData, NodeTextStyle, TextAlign } from "./world-node";
import { Eye, Trash2, Copy, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

const GOOGLE_FONTS_METADATA_URL = "https://fonts.google.com/metadata/fonts";
const FALLBACK_GOOGLE_FONTS = [
  "IBM Plex Mono",
  "IBM Plex Sans",
  "Special Elite",
  "Roboto",
  "Roboto Mono",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Oswald",
  "Playfair Display",
  "Merriweather",
  "Poppins",
  "Nunito",
  "Inter",
  "Source Sans 3",
  "Source Serif 4",
  "Source Code Pro",
  "Work Sans",
  "Manrope",
  "Raleway",
  "PT Sans",
  "PT Serif",
  "Fira Sans",
  "Fira Code",
  "Inconsolata",
  "JetBrains Mono",
  "DM Sans",
  "DM Serif Display",
  "Bebas Neue",
  "Anton",
  "Archivo",
  "Barlow",
  "Barlow Condensed",
  "Cabin",
  "Karla",
  "Rubik",
  "Heebo",
  "Hind",
  "Mukta",
  "Quicksand",
  "Lexend",
  "Space Grotesk",
  "Space Mono",
  "Cormorant Garamond",
  "Crimson Text",
  "Libre Baskerville",
  "Libre Franklin",
  "Alegreya",
  "Alegreya Sans",
  "Bitter",
  "Arvo",
  "Lora",
  "Tinos",
  "Noto Sans",
  "Noto Serif",
  "Noto Sans Mono",
  "Syne",
  "Sora",
  "Public Sans",
  "Red Hat Display",
  "Red Hat Text",
  "Overpass",
  "Ubuntu",
  "Ubuntu Mono",
  "M PLUS 1",
  "M PLUS Rounded 1c",
  "Cinzel",
  "Alfa Slab One",
  "Righteous",
  "Orbitron",
  "Press Start 2P",
  "VT323",
  "Caveat",
  "Permanent Marker",
  "Shadows Into Light",
  "Bangers",
  "Pacifico",
];
let cachedGoogleFonts: string[] | null = null;

const buildGoogleFontHref = (fontFamily: string) => {
  const family = fontFamily.trim();
  const encoded = encodeURIComponent(family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap`;
};

const ensureGoogleFontLoaded = (fontFamily: string) => {
  const family = fontFamily.trim();
  if (!family) return;
  const id = `google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = buildGoogleFontHref(family);
  document.head.appendChild(link);
};

const fetchGoogleFontFamilies = async (): Promise<string[]> => {
  try {
    const response = await fetch(GOOGLE_FONTS_METADATA_URL);
    if (!response.ok) throw new Error("Failed to fetch Google Fonts metadata.");
    const raw = await response.text();
    const json = raw.replace(/^\)\]\}'\n?/, "");
    const parsed = JSON.parse(json) as { familyMetadataList?: Array<{ family?: string }> };
    const names = (parsed.familyMetadataList ?? [])
      .map((item) => item.family?.trim())
      .filter((family): family is string => Boolean(family));
    if (names.length === 0) return FALLBACK_GOOGLE_FONTS;
    return names.sort((a, b) => a.localeCompare(b));
  } catch {
    return FALLBACK_GOOGLE_FONTS;
  }
};

interface RightSidebarProps {
  selectedNode: NodeData | null;
  onUpdateNode: (id: string, updates: Partial<NodeData>) => void;
  onDeleteNode: () => void;
  onDuplicateNode: () => void;
  onOpenPreview: () => void;
  onUpdateOpacity: (opacity: number) => void;
  onImportFile: (file: File) => Promise<void> | void;
}

export function RightSidebar({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onOpenPreview,
  onUpdateOpacity,
  onImportFile,
}: RightSidebarProps) {
  if (!selectedNode) {
    return (
      <div className="w-full lg:w-80 h-full bg-[#0a0a0a] border-l border-white/5 flex items-center justify-center">
        <div className="text-center text-[#737373] text-sm font-light px-8">
          <Eye className="w-6 h-6 mx-auto mb-3 opacity-30" />
          No layer selected
          <div className="mt-2 text-[10px] uppercase tracking-wider">
            Click a layer or drag to box-select
          </div>
          <label className="mt-4 inline-flex h-8 px-3 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors items-center cursor-pointer text-[10px] uppercase tracking-wider">
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
        </div>
      </div>
    );
  }

  const [title, setTitle] = useState(selectedNode.title);
  const [description, setDescription] = useState(selectedNode.description);
  const [thumbnail, setThumbnail] = useState(selectedNode.thumbnail ?? "");
  const [mediaUrl, setMediaUrl] = useState(selectedNode.mediaUrl ?? "");
  const [tags, setTags] = useState(selectedNode.tags.join(", "));
  const [altText, setAltText] = useState(selectedNode.altText ?? "");
  const [opacity, setOpacity] = useState(selectedNode.opacity ?? 1);
  const [invertColors, setInvertColors] = useState(Boolean(selectedNode.invertColors));
  const [textSize, setTextSize] = useState(selectedNode.textStyle?.fontSize ?? 14);
  const [textBold, setTextBold] = useState(Boolean(selectedNode.textStyle?.bold));
  const [textItalic, setTextItalic] = useState(Boolean(selectedNode.textStyle?.italic));
  const [textUnderline, setTextUnderline] = useState(Boolean(selectedNode.textStyle?.underline));
  const [textAlign, setTextAlign] = useState<TextAlign>(selectedNode.textStyle?.align ?? "center");
  const [textFontFamily, setTextFontFamily] = useState(selectedNode.textStyle?.fontFamily ?? "");
  const [textColor, setTextColor] = useState(selectedNode.textStyle?.color ?? "#e6e6e6");
  const [googleFontFamilies, setGoogleFontFamilies] = useState<string[]>(cachedGoogleFonts ?? FALLBACK_GOOGLE_FONTS);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [highlightedFontIndex, setHighlightedFontIndex] = useState(0);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);
  const fontOptions = ["", ...googleFontFamilies];

  useEffect(() => {
    setTitle(selectedNode.title);
    setDescription(selectedNode.description);
    setThumbnail(selectedNode.thumbnail ?? "");
    setMediaUrl(selectedNode.mediaUrl ?? "");
    setTags(selectedNode.tags.join(", "));
    setAltText(selectedNode.altText ?? "");
    setOpacity(selectedNode.opacity ?? 1);
    setInvertColors(Boolean(selectedNode.invertColors));
    setTextSize(selectedNode.textStyle?.fontSize ?? 14);
    setTextBold(Boolean(selectedNode.textStyle?.bold));
    setTextItalic(Boolean(selectedNode.textStyle?.italic));
    setTextUnderline(Boolean(selectedNode.textStyle?.underline));
    setTextAlign(selectedNode.textStyle?.align ?? "center");
    setTextFontFamily(selectedNode.textStyle?.fontFamily ?? "");
    setTextColor(selectedNode.textStyle?.color ?? "#e6e6e6");
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode.type !== "text") return;
    const family = selectedNode.textStyle?.fontFamily?.trim();
    if (family) ensureGoogleFontLoaded(family);
  }, [selectedNode.type, selectedNode.textStyle?.fontFamily]);

  useEffect(() => {
    if (selectedNode.type !== "text") return;
    if (cachedGoogleFonts) {
      setGoogleFontFamilies(cachedGoogleFonts);
      return;
    }
    let active = true;
    void fetchGoogleFontFamilies().then((families) => {
      if (!active) return;
      cachedGoogleFonts = families;
      setGoogleFontFamilies(families);
    });
    return () => {
      active = false;
    };
  }, [selectedNode.type]);

  useEffect(() => {
    if (!isFontMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!fontMenuRef.current?.contains(target)) {
        setIsFontMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFontMenuOpen]);

  useEffect(() => {
    if (!isFontMenuOpen) return;
    const selectedIndex = Math.max(0, fontOptions.findIndex((family) => family === textFontFamily));
    setHighlightedFontIndex(selectedIndex);
  }, [isFontMenuOpen, textFontFamily, fontOptions]);

  const applyFontSelection = (family: string) => {
    if (family) {
      ensureGoogleFontLoaded(family);
      setTextFontFamily(family);
      updateTextStyle({ fontFamily: family });
    } else {
      setTextFontFamily("");
      updateTextStyle({ fontFamily: undefined });
    }
  };

  const moveFontHighlight = (direction: -1 | 1, applySelection = false) => {
    const count = fontOptions.length;
    if (count === 0) return;
    setHighlightedFontIndex((prev) => {
      const nextIndex = (prev + direction + count) % count;
      if (applySelection) {
        const family = fontOptions[nextIndex] ?? "";
        applyFontSelection(family);
      }
      requestAnimationFrame(() => {
        const option = fontMenuRef.current?.querySelector<HTMLButtonElement>(`[data-font-index="${nextIndex}"]`);
        option?.scrollIntoView({ block: "nearest" });
      });
      return nextIndex;
    });
  };

  const handleFontMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isFontMenuOpen) {
        setIsFontMenuOpen(true);
      }
      moveFontHighlight(event.key === "ArrowDown" ? 1 : -1, true);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!isFontMenuOpen) {
        setIsFontMenuOpen(true);
        return;
      }
      const family = fontOptions[highlightedFontIndex] ?? "";
      applyFontSelection(family);
      setIsFontMenuOpen(false);
      return;
    }
    if (event.key === "Escape" && isFontMenuOpen) {
      event.preventDefault();
      setIsFontMenuOpen(false);
    }
  };

  const commitTags = () => {
    const nextTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onUpdateNode(selectedNode.id, { tags: nextTags });
  };

  const updateTextStyle = (updates: Partial<NodeTextStyle>) => {
    onUpdateNode(selectedNode.id, {
      textStyle: {
        fontSize: selectedNode.textStyle?.fontSize ?? 14,
        bold: Boolean(selectedNode.textStyle?.bold),
        italic: Boolean(selectedNode.textStyle?.italic),
        underline: Boolean(selectedNode.textStyle?.underline),
        align: selectedNode.textStyle?.align ?? "center",
        fontFamily: selectedNode.textStyle?.fontFamily ?? undefined,
        color: selectedNode.textStyle?.color ?? "#e6e6e6",
        ...updates,
      },
    });
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

  const handleFileUpload = async (file: File) => {
    if (file.size > maxFileSize) {
      window.alert("File is too large. Please use a file under 5MB.");
      return;
    }
    try {
      if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
        window.alert("Only image and text imports are enabled.");
        return;
      }
      const isImage = file.type.startsWith("image/");
      const isText = file.type === "text/plain" || file.type === "application/json";
      if (!isImage && !isText) {
        window.alert("Only image and text imports are enabled.");
        return;
      }
      if (isText) {
        const text = await readFileAsText(file);
        setDescription(text);
        onUpdateNode(selectedNode.id, { description: text });
      }
      const dataUrl = await readFileAsDataUrl(file);
      if (isImage) {
        setThumbnail(dataUrl);
        setMediaUrl(dataUrl);
        onUpdateNode(selectedNode.id, { mediaUrl: dataUrl, thumbnail: dataUrl });
      } else {
        setMediaUrl(dataUrl);
        onUpdateNode(selectedNode.id, { mediaUrl: dataUrl });
      }
    } catch {
      window.alert("Failed to load file.");
    }
  };

  const previewSrc =
    thumbnail ||
    (mediaUrl.startsWith("data:image/") ||
    mediaUrl.startsWith("blob:") ||
    /\.(png|jpe?g|gif|webp|avif)$/i.test(mediaUrl)
      ? mediaUrl
      : "");

  return (
      <div className="w-full lg:w-80 h-full min-h-0 bg-[#0a0a0a] border-l border-white/5 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-[#737373] uppercase tracking-wider">Inspector</div>
            <div className="text-[#fafafa] text-base font-light truncate">
              {title || "Untitled"}
            </div>
            <div className="text-[10px] text-[#737373] uppercase tracking-wider mt-1">
              {selectedNode.type}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="h-8 px-2 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-wider">
              Import
              <input
                type="file"
                accept="image/*,text/plain,application/json,.csv,.md"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await handleFileUpload(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              onClick={onDuplicateNode}
              className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
            aria-label="Duplicate layer"
            >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDeleteNode}
            className="h-8 w-8 rounded-none border border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors flex items-center justify-center"
            aria-label="Delete layer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 border-b border-white/5">
          {selectedNode.type !== "text" && (
            <>
              <div className="text-[10px] text-[#737373] mb-3 uppercase tracking-wider font-light">
                Preview
              </div>
              <button
                type="button"
                onClick={onOpenPreview}
                className="w-full aspect-video bg-white/5 border border-white/5 rounded-none flex items-center justify-center overflow-hidden hover:border-white/20 transition-colors cursor-zoom-in"
                aria-label="Open preview"
              >
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt={altText || title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-[#737373] text-xs font-light">No thumbnail</div>
                )}
              </button>
            </>
          )}
          {selectedNode.type === "image" && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[#737373] block font-light">
                  Transparency
                </label>
                <span className="text-[10px] text-[#737373] tabular-nums">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(opacity * 100)}
                onChange={(event) => {
                  const nextOpacity = Math.max(0, Math.min(1, Number(event.target.value) / 100));
                  setOpacity(nextOpacity);
                  onUpdateOpacity(nextOpacity);
                }}
                className="w-full h-0.5 bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white/80 [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="mt-4 flex items-center justify-between">
                <label className="text-xs text-[#737373] block font-light">
                  Invert Colors
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !invertColors;
                    setInvertColors(next);
                    onUpdateNode(selectedNode.id, { invertColors: next });
                  }}
                  className={`h-7 px-2 rounded-none border text-[10px] uppercase tracking-wider transition-colors ${
                    invertColors
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                >
                  {invertColors ? "On" : "Off"}
                </button>
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="text-xs text-[#737373] mb-1.5 block font-light">
              Layer Preset
            </label>
            <select
              value={selectedNode.preset ?? "none"}
              onChange={(event) =>
                onUpdateNode(selectedNode.id, {
                  preset:
                    event.target.value === "none"
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
          {selectedNode.type === "text" && (
            <div className="mt-5 border-t border-white/10 pt-4 space-y-4">
              <div className="text-[10px] text-[#737373] uppercase tracking-wider font-light">
                Text
              </div>
              <div>
                <div className="relative" ref={fontMenuRef} onKeyDown={handleFontMenuKeyDown}>
                  <button
                    type="button"
                    onClick={() => setIsFontMenuOpen((prev) => !prev)}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors text-left"
                    style={{ fontFamily: textFontFamily ? `"${textFontFamily}", var(--font-sans)` : "var(--font-sans)" }}
                  >
                    {textFontFamily || "Default Font"}
                  </button>
                  {isFontMenuOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto border border-white/10 bg-[#0a0a0a] z-20">
                      <button
                        type="button"
                        onMouseEnter={() => setHighlightedFontIndex(0)}
                        onClick={() => {
                          applyFontSelection("");
                          setIsFontMenuOpen(false);
                        }}
                        data-font-index={0}
                        className={`w-full px-3 py-2 text-left text-sm text-[#fafafa] transition-colors ${
                          highlightedFontIndex === 0 ? "bg-white/15" : "hover:bg-white/10"
                        }`}
                      >
                        Default Font
                      </button>
                      {googleFontFamilies.map((family, index) => (
                        <button
                          key={family}
                          type="button"
                          onMouseEnter={() => {
                            ensureGoogleFontLoaded(family);
                            setHighlightedFontIndex(index + 1);
                          }}
                          onFocus={() => ensureGoogleFontLoaded(family)}
                          onClick={() => {
                            applyFontSelection(family);
                            setIsFontMenuOpen(false);
                          }}
                          data-font-index={index + 1}
                          className={`w-full px-3 py-2 text-left text-sm text-[#fafafa] transition-colors ${
                            highlightedFontIndex === index + 1 ? "bg-white/15" : "hover:bg-white/10"
                          }`}
                          style={{ fontFamily: `"${family}", var(--font-sans)` }}
                        >
                          {family}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#737373] block font-light">Color</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(event) => {
                      const next = event.target.value;
                      setTextColor(next);
                      updateTextStyle({ color: next });
                    }}
                    className="h-8 w-10 rounded-none border border-white/10 bg-transparent p-1 cursor-pointer"
                    aria-label="Text color"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(event) => {
                      const next = event.target.value;
                      setTextColor(next);
                    }}
                    onBlur={() => {
                      const normalized = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(textColor)
                        ? textColor
                        : "#e6e6e6";
                      setTextColor(normalized);
                      updateTextStyle({ color: normalized });
                    }}
                    className="flex-1 bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
                    placeholder="#e6e6e6"
                    aria-label="Text color hex"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#737373] block font-light">Size</label>
                  <span className="text-[10px] text-[#737373] tabular-nums">{textSize}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="512"
                  value={textSize}
                  onChange={(event) => {
                    const nextSize = Math.max(10, Math.min(512, Number(event.target.value) || 14));
                    setTextSize(nextSize);
                    updateTextStyle({ fontSize: nextSize });
                  }}
                  className="w-full h-0.5 bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white/80 [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !textBold;
                    setTextBold(next);
                    updateTextStyle({ bold: next });
                  }}
                  className={`h-8 w-8 rounded-none border transition-colors flex items-center justify-center ${
                    textBold
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                  aria-label="Toggle bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !textItalic;
                    setTextItalic(next);
                    updateTextStyle({ italic: next });
                  }}
                  className={`h-8 w-8 rounded-none border transition-colors flex items-center justify-center ${
                    textItalic
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                  aria-label="Toggle italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !textUnderline;
                    setTextUnderline(next);
                    updateTextStyle({ underline: next });
                  }}
                  className={`h-8 w-8 rounded-none border transition-colors flex items-center justify-center ${
                    textUnderline
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                  aria-label="Toggle underline"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTextAlign("left");
                    updateTextStyle({ align: "left" });
                  }}
                  className={`h-8 w-8 rounded-none border transition-colors flex items-center justify-center ${
                    textAlign === "left"
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                  aria-label="Align left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTextAlign("center");
                    updateTextStyle({ align: "center" });
                  }}
                  className={`h-8 w-8 rounded-none border transition-colors flex items-center justify-center ${
                    textAlign === "center"
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                  aria-label="Align center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTextAlign("right");
                    updateTextStyle({ align: "right" });
                  }}
                  className={`h-8 w-8 rounded-none border transition-colors flex items-center justify-center ${
                    textAlign === "right"
                      ? "border-white/30 text-[#fafafa] bg-white/10"
                      : "border-white/10 text-[#737373] hover:text-[#fafafa] hover:border-white/20"
                  }`}
                  aria-label="Align right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-b border-white/5">
          <div className="text-[10px] text-[#737373] mb-3 uppercase tracking-wider font-light">
            Metadata
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#737373] mb-1.5 block font-light">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => onUpdateNode(selectedNode.id, { title: title.trim() || "Untitled" })}
                className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1.5 block font-light">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => onUpdateNode(selectedNode.id, { description })}
                className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1.5 block font-light">Thumbnail URL</label>
              <input
                type="url"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                onBlur={() => onUpdateNode(selectedNode.id, { thumbnail: thumbnail.trim() })}
                className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1.5 block font-light">Media URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                onBlur={() => onUpdateNode(selectedNode.id, { mediaUrl: mediaUrl.trim() })}
                className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="px-2.5 py-1.5 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors cursor-pointer">
                  Import File
                  <input
                    type="file"
                    accept="image/*,text/plain,application/json,.csv,.md"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await handleFileUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={() => {
                    setMediaUrl("");
                    onUpdateNode(selectedNode.id, { mediaUrl: "" });
                  }}
                  className="px-2.5 py-1.5 rounded-none border border-white/10 text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#fafafa] hover:border-white/20 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#737373] mb-1.5 block font-light">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onBlur={commitTags}
                className="mt-2 w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light focus:border-white/20 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="p-6 pb-8">
          <div className="text-[10px] text-[#737373] mb-3 uppercase tracking-wider font-light">
            Accessibility
          </div>
          <div>
            <label className="text-xs text-[#737373] mb-1.5 block font-light">Alt Text</label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={() => onUpdateNode(selectedNode.id, { altText })}
              className="w-full bg-transparent border border-white/10 text-[#fafafa] px-3 py-2 rounded-none text-sm font-light placeholder:text-[#737373] focus:border-white/20 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}


