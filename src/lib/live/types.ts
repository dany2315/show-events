import type { AppLocale, CurrencyCode, EventStatusCode } from "../constants";
import type { ShowConfig } from "../show/config";
import type { PublicCategory } from "../categories";

/** Une promesse telle que vue par le public : aucune distinction réel / fictif. */
export type PublicDonation = {
  id: string;
  donorName: string;
  amount: number;
  createdAt: string;
  /** Catégorie de donateurs (facultative, absente des anciens messages). */
  categoryId?: string | null;
};

/** Partie d'une promesse qui compte dans les totaux par catégorie (avant correction / suppression). */
export type DonationShare = { amount: number; categoryId: string | null };

/**
 * Intermède vidéo en cours : la vidéo occupe tout l'écran géant, la scène continue
 * de recevoir les promesses en arrière-plan.
 */
export type LiveVideo = {
  /** Identifiant de ce lancement (une même vidéo relancée reçoit un nouvel identifiant). */
  id: string;
  /** Lien YouTube / Vimeo / Dailymotion, fichier https ou média importé (/api/media/…). */
  source: string;
  title: string | null;
  /** Vidéo préparée d'origine (null pour un lien lancé en direct). */
  refId: string | null;
  startedAt: string;
  /** Son coupé à la demande de la régie. */
  muted: boolean;
  /** L'écran a dû lire la vidéo sans le son (navigateur non « armé » par un clic). */
  soundBlocked: boolean;
  /** Total et nombre de promesses au lancement : récapitulatif affiché au retour sur la scène. */
  startTotal: number;
  startCount: number;
};

export type LiveControl = {
  /** Animations en pause : les promesses continuent d'arriver, sans effets. */
  paused: boolean;
  /** Message affiché en surimpression sur l'écran géant. */
  overlay: string | null;
  overlayAt: string | null;
  /** Intermède vidéo plein écran (absent des anciens messages). */
  video?: LiveVideo | null;
};

export const EMPTY_CONTROL: LiveControl = { paused: false, overlay: null, overlayAt: null, video: null };

export type LiveEventInfo = {
  id: string;
  name: string;
  date: string;
  currency: CurrencyCode;
  locale: AppLocale;
  goalAmount: number;
  status: EventStatusCode;
  logoUrl: string | null;
  organizationName: string;
  /** Catégories de donateurs et leurs totaux (hors promesses supprimées), mis à jour en direct. */
  categories?: PublicCategory[];
};

export type LiveSnapshot = {
  seq: number;
  event: LiveEventInfo;
  total: number;
  count: number;
  donations: PublicDonation[];
  control: LiveControl;
  layout: ShowConfig;
  layoutVersion: number;
  formUrl: string | null;
};

export type LiveCommand = "celebrate" | "goal";

export type LiveMessage =
  | { seq: number; type: "donation.created"; donation: PublicDonation; total: number; count: number }
  | { seq: number; type: "donation.updated"; donation: PublicDonation; previous?: DonationShare; total: number; count: number }
  | { seq: number; type: "donation.deleted"; donationId: string; removed?: DonationShare; total: number; count: number }
  | { seq: number; type: "control"; control: LiveControl; command: LiveCommand | null }
  | { seq: number; type: "layout.updated"; version: number }
  | { seq: number; type: "event.updated" };

export type LiveMessageType = LiveMessage["type"];

/** Charge utile d'un message sans son numéro de séquence (assigné par l'outbox). */
export type LiveMessageInput = LiveMessage extends infer M ? (M extends { seq: number } ? Omit<M, "seq"> : never) : never;

export type LiveEventsResponse =
  | { mode: "events"; seq: number; messages: LiveMessage[] }
  | { mode: "resync"; snapshot: LiveSnapshot };

export function channelName(eventId: string) {
  return `live:${eventId}`;
}
