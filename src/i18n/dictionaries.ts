import { fr } from "./fr";
import { he } from "./he";

export type Dictionary = typeof fr;

export const dictionaries: Record<"fr" | "he", Dictionary> = { fr, he };
