"use client";

import { useCallback, useRef, useState } from "react";

const LIMIT = 60;

/** Historique annuler / rétablir, avec regroupement des saisies rapides (texte, curseurs). */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const lastKey = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback((updater: (current: T) => T, coalesceKey?: string) => {
    setState((s) => {
      const next = updater(s.present);
      if (next === s.present) return s;
      const now = Date.now();
      const coalesce = coalesceKey && lastKey.current?.key === coalesceKey && now - lastKey.current.at < 800;
      lastKey.current = coalesceKey ? { key: coalesceKey, at: now } : null;
      return {
        past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const reset = useCallback((value: T) => {
    lastKey.current = null;
    setState((s) => ({ past: [...s.past, s.present].slice(-LIMIT), present: value, future: [] }));
  }, []);

  const undo = useCallback(() => {
    lastKey.current = null;
    setState((s) => (s.past.length === 0 ? s : { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }));
  }, []);

  const redo = useCallback(() => {
    lastKey.current = null;
    setState((s) => (s.future.length === 0 ? s : { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }));
  }, []);

  return { value: state.present, set, reset, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
