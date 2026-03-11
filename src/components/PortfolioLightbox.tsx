import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";

interface LightboxProps {
  before: string | null;
  after: string | null;
  title: string;
  onClose: () => void;
}

export function PortfolioLightbox({ before, after, title, onClose }: LightboxProps) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

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
          <button
            onClick={onClose}
            className="p-2 border border-border hover:border-orange hover:text-orange transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slider or single image */}
        {before && after ? (
          <BeforeAfterSlider before={before} after={after} height="h-[60vh]" />
        ) : (
          <img
            src={after || before || ""}
            alt={title}
            className="w-full max-h-[70vh] object-contain bg-muted"
          />
        )}

        {/* Footer hint */}
        <div className="px-5 py-3 border-t-2 border-border flex justify-between items-center">
          <span className="font-mono text-xs text-muted-foreground">Перетащите ползунок для сравнения</span>
          <span className="font-mono text-xs text-muted-foreground">ESC — закрыть</span>
        </div>
      </div>
    </div>
  );
}
