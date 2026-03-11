import { useEffect, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";

interface LightboxProps {
  images: { url: string; label?: string }[];
  before?: string | null;
  after?: string | null;
  title: string;
  initialIndex?: number;
  onClose: () => void;
}

export function PortfolioLightbox({ images, before, after, title, initialIndex = 0, onClose }: LightboxProps) {
  const hasSlider = !!(before && after);
  const allItems = [
    ...(hasSlider ? [{ type: "slider" as const }] : []),
    ...images.map((img) => ({ type: "image" as const, ...img })),
  ];

  const [current, setCurrent] = useState(hasSlider ? 0 : initialIndex);

  const prev = useCallback(() => setCurrent((c) => (c > 0 ? c - 1 : allItems.length - 1)), [allItems.length]);
  const next = useCallback(() => setCurrent((c) => (c < allItems.length - 1 ? c + 1 : 0)), [allItems.length]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }, [onClose, prev, next]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  const item = allItems[current];

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-surface border-2 border-border shadow-brutal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-border">
          <span className="font-display text-lg tracking-wider truncate">{title}</span>
          <div className="flex items-center gap-2">
            {allItems.length > 1 && (
              <span className="font-mono text-xs text-muted-foreground">{current + 1} / {allItems.length}</span>
            )}
            <button
              onClick={onClose}
              className="p-2 border border-border hover:border-orange hover:text-orange transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {item?.type === "slider" && before && after ? (
          <BeforeAfterSlider before={before} after={after} height="h-[60vh]" />
        ) : item?.type === "image" ? (
          <div className="flex items-center justify-center bg-muted" style={{ height: "60vh" }}>
            <img
              src={(item as any).url}
              alt={(item as any).label || title}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : null}

        {/* Navigation arrows */}
        {allItems.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 border border-border hover:border-orange hover:text-orange transition-colors z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 border border-border hover:border-orange hover:text-orange transition-colors z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-border flex justify-between items-center">
          <span className="font-mono text-xs text-muted-foreground">
            {item?.type === "slider" ? "Перетащите ползунок для сравнения" : (item as any)?.label || ""}
          </span>
          <span className="font-mono text-xs text-muted-foreground">← → навигация · ESC — закрыть</span>
        </div>
      </div>
    </div>
  );
}
