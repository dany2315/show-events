"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitScale, REFERENCE_STAGE, type StageSize } from "@/lib/show/config";

/**
 * Met la surface du show (1920 × 1080 par défaut, ou celle du format d'écran) à l'échelle
 * de son conteneur (letterbox). La mise à l'échelle par `transform` garde un texte net
 * en Full HD comme en 4K.
 */
export function ShowViewport({
  children,
  className,
  style,
  background = "#000",
  stage = REFERENCE_STAGE,
  onScale,
}: {
  children: React.ReactNode | ((scale: number) => React.ReactNode);
  className?: string;
  style?: React.CSSProperties;
  background?: string;
  /** Dimensions de la surface (format d'écran). */
  stage?: StageSize;
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

  const scale = fitScale(box.w, box.h, stage);
  useLayoutEffect(() => {
    if (scale > 0) onScale?.(scale);
  }, [scale, onScale]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className ?? ""}`} style={{ background, ...style }}>
      {scale > 0 && (
        <div
          className="absolute"
          style={{
            width: stage.width,
            height: stage.height,
            left: (box.w - stage.width * scale) / 2,
            top: (box.h - stage.height * scale) / 2,
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
