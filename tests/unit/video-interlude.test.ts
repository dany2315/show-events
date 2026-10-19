import { describe, expect, it } from "vitest";
import { formatElapsed, interludeRecap, MAX_VIDEO_TITLE_LENGTH, parseLiveVideo, videoTitleSchema, videoUrlSchema } from "@/lib/live/video";
import { badgeSize, pickBadgeSlot, placeBadge, type Rect } from "@/lib/show/badge";
import { chromeBand, embedUrl } from "@/lib/show/media";
import { controlSchema, screenVideoReportSchema } from "@/lib/validation";
import { blockToPixels, defaultShowConfig, stageSize } from "@/lib/show/config";
import { FORMAT_IDS } from "@/lib/show/formats";
import { formatBlocks } from "@/lib/show/smart-layout";

const video = {
  id: "run1",
  source: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "Film de l'association",
  refId: null,
  startedAt: "2026-10-19T20:00:00.000Z",
  muted: false,
  soundBlocked: false,
  startTotal: 1000,
  startCount: 4,
};

describe("intermède vidéo : état de pilotage", () => {
  it("lit un intermède valide", () => {
    expect(parseLiveVideo(video)).toEqual(video);
  });

  it("refuse une source non reconnue ou un objet incomplet", () => {
    expect(parseLiveVideo({ ...video, source: "javascript:alert(1)" })).toBeNull();
    expect(parseLiveVideo({ ...video, source: "http://exemple.org/clip.mp4" })).toBeNull();
    expect(parseLiveVideo({ source: video.source })).toBeNull();
    expect(parseLiveVideo(null)).toBeNull();
    expect(parseLiveVideo("video")).toBeNull();
  });

  it("complète les champs facultatifs d'un ancien état", () => {
    const { muted: _m, soundBlocked: _s, startTotal: _t, startCount: _c, ...old } = video;
    void _m;
    void _s;
    void _t;
    void _c;
    expect(parseLiveVideo(old)).toMatchObject({ muted: false, soundBlocked: false, startTotal: 0, startCount: 0 });
  });

  it("récapitulatif : uniquement si des promesses sont arrivées pendant la vidéo", () => {
    expect(interludeRecap(video, 1350, 7)).toEqual({ count: 3, amount: 350 });
    expect(interludeRecap(video, 1000, 4)).toBeNull();
    // Suppressions compensant les ajouts : pas de récapitulatif trompeur.
    expect(interludeRecap(video, 900, 5)).toBeNull();
  });

  it("durée écoulée", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
    expect(formatElapsed(-5000)).toBe("0:00");
  });

  it("valide les titres et les liens des vidéos préparées", () => {
    expect(videoTitleSchema.safeParse("  Film  ").data).toBe("Film");
    expect(videoTitleSchema.safeParse("   ").success).toBe(false);
    expect(videoTitleSchema.safeParse("x".repeat(MAX_VIDEO_TITLE_LENGTH + 1)).success).toBe(false);
    for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/123456789", "https://dai.ly/x8abc12", "https://exemple.org/clip.mp4", "/api/media/abcdef1234567890"]) {
      expect(videoUrlSchema.safeParse(url).success, url).toBe(true);
    }
    for (const url of ["https://exemple.org/page.html", "http://exemple.org/clip.mp4", "javascript:alert(1)", ""]) {
      expect(videoUrlSchema.safeParse(url).success, url).toBe(false);
    }
  });

  it("commandes de la régie et signalements de l'écran", () => {
    expect(controlSchema.parse({ action: "videoStart", videoId: "abc", muted: true }).action).toBe("videoStart");
    expect(controlSchema.parse({ action: "videoStart", url: " https://youtu.be/dQw4w9WgXcQ ", title: "Clip" }).url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(controlSchema.parse({ action: "videoMute", muted: false }).muted).toBe(false);
    expect(controlSchema.parse({ action: "videoStop" }).action).toBe("videoStop");
    expect(controlSchema.safeParse({ action: "videoPlayEverywhere" }).success).toBe(false);
    expect(screenVideoReportSchema.safeParse({ action: "ended", runId: "run1" }).success).toBe(true);
    expect(screenVideoReportSchema.safeParse({ action: "stop", runId: "run1" }).success).toBe(false);
    expect(screenVideoReportSchema.safeParse({ action: "ended", runId: "" }).success).toBe(false);
  });
});

describe("intermède vidéo : lecteur", () => {
  it("lit la vidéo une seule fois (sans boucle) et sans interface", () => {
    const yt = embedUrl({ kind: "youtube", id: "dQw4w9WgXcQ" }, { muted: false, loop: false });
    expect(yt).toContain("youtube-nocookie.com");
    expect(yt).toContain("loop=0");
    expect(yt).toContain("mute=0");
    expect(yt).toContain("enablejsapi=1");
    expect(yt).toContain("controls=0");
  });

  it("Vimeo : le mode arrière-plan (muet en boucle) n'est pas utilisé pour un intermède", () => {
    // Le mode arrière-plan impose la boucle : la fin de la vidéo ne serait jamais signalée.
    expect(embedUrl({ kind: "vimeo", id: "123456789" }, { muted: true, loop: false })).not.toContain("background=1");
    expect(embedUrl({ kind: "vimeo", id: "123456789" }, { muted: true, loop: true })).toContain("background=1");
    expect(chromeBand({ kind: "vimeo", id: "123456789" }, false)).toBeGreaterThan(0);
  });
});

describe("badge MODE TEST de l'écran", () => {
  const stage = { width: 1920, height: 1080 };
  const size = badgeSize("MODE TEST", 24);
  const overlaps = (a: Rect, b: Rect) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

  it("préfère le haut centré quand il est libre", () => {
    const slot = pickBadgeSlot([], stage, size);
    expect(slot.top).toBe(12);
    expect(Math.round(slot.left + slot.width / 2)).toBe(960);
  });

  it("évite un bloc placé en haut au centre", () => {
    const blocks = [{ left: 600, top: 0, width: 720, height: 200 }];
    const slot = pickBadgeSlot(blocks, stage, size);
    expect(blocks.some((b) => overlaps(slot, b))).toBe(false);
  });

  it("ne recouvre aucun bloc, dans aucun format et aucun modèle (mises en page par défaut)", () => {
    for (const theme of ["gala", "velours", "jerusalem", "moderne", "minimal"] as const) {
      const config = defaultShowConfig(theme);
      for (const format of FORMAT_IDS) {
        for (const rtl of [false, true]) {
          const surface = stageSize(format);
          const rects = formatBlocks(config, format, rtl)
            .filter((b) => b.visible)
            .map((b) => blockToPixels(b, surface));
          for (const label of ["MODE TEST", "APERÇU — collecte non ouverte"]) {
            const slot = placeBadge(label, rects, surface, 24);
            expect(slot.fontSize).toBeGreaterThanOrEqual(14);
            expect(
              rects.some((r) => overlaps(slot, r)),
              `${theme} ${format} ${rtl ? "rtl" : "ltr"} ${label}`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
