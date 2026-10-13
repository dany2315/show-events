"use client";

import { useLayoutEffect } from "react";

/** Applique le thème sombre à tout le document (y compris les fenêtres en portail). */
export function ConsoleTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    return () => {
      root.classList.remove("dark");
      root.style.colorScheme = "";
    };
  }, []);
  return null;
}
