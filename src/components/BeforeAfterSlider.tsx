import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BeforeAfterSliderProps {
  before: string;
  after: string;
  height?: string;
}

export function BeforeAfterSlider({ before, after, height = "h-72" }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pos);
  }, []);

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // Touch handlers — passive: false to allow preventDefault on divider only
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    // Only prevent scroll when actively dragging the slider
    e.stopPropagation();
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  const onTouchEnd = useCallback(() => { isDragging.current = false; }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${height} overflow-hidden cursor-ew-resize select-none`}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* After (base layer) */}
      <img
        src={after}
        alt="После"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* Before (clipped overlay) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={before}
          alt="До"
          className="absolute inset-0 h-full object-cover pointer-events-none"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100vw" }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-orange z-10 pointer-events-none"
        style={{ left: `${position}%` }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-orange shadow-lg flex items-center justify-center z-20 pointer-events-auto cursor-ew-resize"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <ChevronLeft className="w-3 h-3 text-primary-foreground" />
          <ChevronRight className="w-3 h-3 text-primary-foreground" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-2 left-2 font-mono text-xs bg-background/80 backdrop-blur-sm px-2 py-0.5 pointer-events-none z-10">ДО</span>
      <span className="absolute top-2 right-2 font-mono text-xs bg-orange text-primary-foreground px-2 py-0.5 pointer-events-none z-10">ПОСЛЕ</span>
    </div>
  );
}
