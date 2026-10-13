"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitScale, STAGE_HEIGHT, STAGE_WIDTH } from "@/lib/show/config";

/**
 * Met la surface 1920×1080 à l'échelle de son conteneur (letterbox).
 * La mise à l'échelle par `transform` garde un texte net en Full HD comme en 4K.
 */
export function ShowViewport({
  children,
  className,
  background = "#000",
  onScale,
}: {
  children: React.ReactNode | ((scale: number) => React.ReactNode);
  className?: string;
  background?: string;
  onScale?: (scale: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fitScale(box.w, box.h);
  useLayoutEffect(() => {
    if (scale > 0) onScale?.(scale);
  }, [scale, onScale]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className ?? ""}`} style={{ background }}>
      {scale > 0 && (
        <div
          className="absolute"
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            left: (box.w - STAGE_WIDTH * scale) / 2,
            top: (box.h - STAGE_HEIGHT * scale) / 2,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {typeof children === "function" ? children(scale) : children}
        </div>
      )}
    </div>
  );
}
