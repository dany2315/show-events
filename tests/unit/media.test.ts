import { describe, expect, it } from "vitest";
import { chromeBand, embedUrl, parseVideoSource } from "@/lib/show/media";

describe("sources vidéo", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube"],
    ["https://vimeo.com/123456789", "vimeo"],
    ["https://www.dailymotion.com/video/x8abc12", "dailymotion"],
    ["https://dai.ly/x8abc12", "dailymotion"],
    ["https://exemple.org/clip.mp4", "file"],
    ["/api/media/abcdef1234567890", "file"],
  ])("%s → %s", (url, kind) => {
    expect(parseVideoSource(url)?.kind).toBe(kind);
  });

  it.each(["http://exemple.org/clip.mp4", "https://exemple.org/page.html", "javascript:alert(1)", "", null])("refuse %s", (url) => {
    expect(parseVideoSource(url as string)).toBeNull();
  });

  it("intègre YouTube en lecture automatique, muette et en boucle", () => {
    const src = embedUrl({ kind: "youtube", id: "dQw4w9WgXcQ" }, { muted: true, loop: true });
    expect(src).toContain("autoplay=1");
    expect(src).toContain("mute=1");
    expect(src).toContain("loop=1");
    expect(src).toContain("youtube-nocookie.com");
  });

  it("vidéo épurée : aucune interface de la plateforme", () => {
    const yt = embedUrl({ kind: "youtube", id: "dQw4w9WgXcQ" }, { muted: false, loop: true });
    for (const p of ["controls=0", "rel=0", "fs=0", "disablekb=1", "iv_load_policy=3", "cc_load_policy=0", "playsinline=1"]) expect(yt).toContain(p);
    expect(embedUrl({ kind: "vimeo", id: "123456789" }, { muted: true, loop: true })).toContain("background=1");
    const vimeoSound = embedUrl({ kind: "vimeo", id: "123456789" }, { muted: false, loop: true });
    expect(vimeoSound).not.toContain("background=1");
    for (const p of ["title=0", "byline=0", "portrait=0", "controls=0"]) expect(vimeoSound).toContain(p);
    const dm = embedUrl({ kind: "dailymotion", id: "x8abc12" }, { muted: true, loop: true });
    for (const p of ["ui-logo=0", "ui-start-screen-info=0", "queue-enable=0", "sharing-enable=0"]) expect(dm).toContain(p);
  });

  it("rogne les bandeaux d'interface, sauf en mode arrière-plan Vimeo", () => {
    expect(chromeBand({ kind: "youtube", id: "dQw4w9WgXcQ" }, true)).toBeGreaterThan(0);
    expect(chromeBand({ kind: "vimeo", id: "123456789" }, true)).toBe(0);
    expect(chromeBand({ kind: "vimeo", id: "123456789" }, false)).toBeGreaterThan(0);
  });
});
