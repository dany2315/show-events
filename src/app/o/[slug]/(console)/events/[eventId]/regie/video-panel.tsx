"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Film,
  Link2,
  Loader2,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addVideoAction, deleteVideoAction, renameVideoAction, reorderVideosAction, type VideoActionResult } from "@/app/actions/videos";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LiveVideo } from "@/lib/live/types";
import { formatElapsed, MAX_EVENT_VIDEOS, MAX_VIDEO_TITLE_LENGTH, MAX_VIDEO_URL_LENGTH } from "@/lib/live/video";
import { parseVideoSource } from "@/lib/show/media";
import { formatBytes, uploadImage, UploadTooLargeError } from "@/lib/upload-client";
import type { EventVideoItem } from "@/lib/videos";
import { cn } from "@/lib/utils";

type Busy = string | null;

/** Pilotage de l'intermède vidéo : même canal que les autres commandes de la régie. */
async function sendVideoControl(eventId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/events/${eventId}/control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true as const };
  const data = (await res.json().catch(() => ({}))) as { code?: string };
  return { ok: false as const, code: data.code ?? String(res.status) };
}

function kindLabel(url: string, t: Dictionary) {
  const kind = parseVideoSource(url)?.kind ?? "file";
  return t.regie[`videoKind_${kind}`];
}

function actionError(result: Exclude<VideoActionResult, { ok: true }>, t: Dictionary) {
  if (result.error === "VIDEO_SOURCE") return t.regie.videoInvalidUrl;
  if (result.error === "LIMIT") return fmt(t.regie.videoLimit, { max: MAX_EVENT_VIDEOS });
  return t.common.errorGeneric;
}

/** Titre par défaut : nom du fichier importé, sinon la plateforme (« YouTube »…). */
function defaultTitle(url: string, t: Dictionary, fileName?: string) {
  const base = fileName?.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  return (base || kindLabel(url, t)).slice(0, MAX_VIDEO_TITLE_LENGTH);
}

export function VideoPanel({
  eventId,
  organizationId,
  blobEnabled,
  initialVideos,
  video,
  onControlSent,
}: {
  eventId: string;
  organizationId: string;
  blobEnabled: boolean;
  initialVideos: EventVideoItem[];
  video: LiveVideo | null;
  onControlSent: () => void;
}) {
  const { t } = useI18n();
  const [videos, setVideos] = useState<EventVideoItem[]>(initialVideos);
  const [busy, setBusy] = useState<Busy>(null);
  const [withSound, setWithSound] = useState(true);
  const [deleting, setDeleting] = useState<EventVideoItem | null>(null);

  async function control(key: string, body: Record<string, unknown>, success?: string) {
    setBusy(key);
    try {
      const result = await sendVideoControl(eventId, body);
      if (!result.ok) {
        toast.error(result.code === "VIDEO_SOURCE" ? t.regie.videoInvalidUrl : t.common.errorGeneric);
        return false;
      }
      if (success) toast.success(success);
      onControlSent();
      return true;
    } catch {
      toast.error(t.common.errorNetwork);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function mutate(key: string, run: () => Promise<VideoActionResult>, success?: string) {
    setBusy(key);
    try {
      const result = await run();
      if (!result.ok) {
        toast.error(actionError(result, t));
        return false;
      }
      setVideos(result.videos);
      if (success) toast.success(success);
      return true;
    } catch {
      toast.error(t.common.errorNetwork);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= videos.length) return;
    const next = [...videos];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setVideos(next);
    void mutate(`move:${videos[index]!.id}`, () => reorderVideosAction(eventId, next.map((v) => v.id)));
  };

  return (
    <div className="min-w-0 rounded-3xl border bg-card p-5" data-video-panel>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Clapperboard className="size-5 text-gold" />
        {t.regie.videoTitle}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t.regie.videoHelp}</p>

      {video && <ActiveVideo video={video} busy={busy} onMute={(muted) => control("mute", { action: "videoMute", muted })} onStop={() => control("stop", { action: "videoStop" }, t.regie.videoStopped)} />}

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          {withSound ? <Volume2 className="size-4 text-gold" /> : <VolumeX className="size-4 text-muted-foreground" />}
          {t.regie.videoWithSound}
        </span>
        <Switch checked={withSound} onCheckedChange={setWithSound} aria-label={t.regie.videoWithSound} />
      </label>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{t.regie.videoPrepared}</h3>
        {videos.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t.regie.videoEmpty}</p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-1.5" data-video-list>
            {videos.map((item, index) => (
              <PreparedVideo
                key={item.id}
                item={item}
                index={index}
                count={videos.length}
                playing={video?.refId === item.id}
                busy={busy}
                onLaunch={() => control(`launch:${item.id}`, { action: "videoStart", videoId: item.id, muted: !withSound }, t.regie.videoStarted)}
                onRename={(title) => mutate(`rename:${item.id}`, () => renameVideoAction(eventId, item.id, title))}
                onMove={(delta) => move(index, delta)}
                onDelete={() => setDeleting(item)}
              />
            ))}
          </ul>
        )}
      </div>

      <AddVideoForm
        organizationId={organizationId}
        blobEnabled={blobEnabled}
        busy={busy}
        full={videos.length >= MAX_EVENT_VIDEOS}
        onAdd={(title, url) => mutate("add", () => addVideoAction(eventId, { title, url }), t.regie.videoAdded)}
      />

      <LaunchLink busy={busy} onLaunch={(url) => control("launchUrl", { action: "videoStart", url, title: defaultTitle(url, t), muted: !withSound }, t.regie.videoStarted)} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.regie.videoDelete}</AlertDialogTitle>
            <AlertDialogDescription>{fmt(t.regie.videoDeleteConfirm, { title: deleting?.title ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && void mutate(`delete:${deleting.id}`, () => deleteVideoAction(eventId, deleting.id), t.regie.videoDeleted)}
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ElapsedClock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  if (now === null) return null;
  return <span data-video-elapsed>{formatElapsed(now - Date.parse(startedAt))}</span>;
}

function ActiveVideo({
  video,
  busy,
  onMute,
  onStop,
}: {
  video: LiveVideo;
  busy: Busy;
  onMute: (muted: boolean) => void;
  onStop: () => void;
}) {
  const { t } = useI18n();
  const title = video.title ?? t.regie.videoUntitled;
  const autoEnd = parseVideoSource(video.source)?.kind !== "dailymotion";
  return (
    <div className="mt-4 rounded-2xl border border-live/40 bg-live/[0.08] p-3.5" data-video-active role="status">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-live">
            <span className="live-dot !size-1.5" />
            {t.regie.videoPlaying}
          </div>
          <div className="mt-0.5 truncate font-semibold" data-video-active-title>
            {fmt(t.regie.videoPlayingTitle, { title })}
          </div>
        </div>
        <div className="tabular shrink-0 text-end text-xs text-muted-foreground">
          {t.regie.videoElapsed}
          <span className="block text-lg font-semibold text-foreground">
            <ElapsedClock startedAt={video.startedAt} />
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" data-video-sound={video.muted ? "off" : video.soundBlocked ? "blocked" : "on"}>
        {video.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        {video.muted ? t.regie.videoSoundOff : t.regie.videoSoundOn}
      </div>
      {video.soundBlocked && !video.muted && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-400/15 px-2.5 py-2 text-xs font-medium text-amber-200" data-video-sound-blocked>
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {t.regie.videoSoundBlocked}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-10 rounded-xl" onClick={() => onMute(!video.muted)} disabled={!!busy}>
          {busy === "mute" ? <Loader2 className="size-4 animate-spin" /> : video.muted ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {video.muted ? t.regie.videoUnmute : t.regie.videoMute}
        </Button>
        <Button variant="destructive" className="h-10 rounded-xl" onClick={onStop} disabled={!!busy}>
          {busy === "stop" ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
          {t.regie.videoStop}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{autoEnd ? t.regie.videoAutoEnd : t.regie.videoNoAutoEnd}</p>
    </div>
  );
}

function PreparedVideo({
  item,
  index,
  count,
  playing,
  busy,
  onLaunch,
  onRename,
  onMove,
  onDelete,
}: {
  item: EventVideoItem;
  index: number;
  count: number;
  playing: boolean;
  busy: Busy;
  onLaunch: () => void;
  onRename: (title: string) => Promise<boolean>;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  async function save() {
    const title = draft.trim();
    if (!title || title === item.title) {
      setEditing(false);
      setDraft(item.title);
      return;
    }
    if (await onRename(title)) setEditing(false);
  }

  return (
    <li className={cn("flex items-center gap-2 rounded-2xl px-2.5 py-2", playing ? "bg-live/[0.1] ring-1 ring-live/40" : "bg-muted/60")} data-video-item={item.title}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
        {playing ? <span className="live-dot !size-2" /> : <Film className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_VIDEO_TITLE_LENGTH}
              aria-label={t.regie.videoRename}
              autoFocus
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(item.title);
                }
              }}
            />
            <Button type="submit" size="icon-sm" variant="ghost" aria-label={t.common.save} disabled={!!busy}>
              <Check className="size-3.5" />
            </Button>
          </form>
        ) : (
          <>
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">{playing ? t.regie.videoPlaying : kindLabel(item.url, t)}</div>
          </>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0 || !!busy} aria-label={t.regie.videoMoveUp}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => onMove(1)} disabled={index === count - 1 || !!busy} aria-label={t.regie.videoMoveDown}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setDraft(item.title);
              setEditing(true);
            }}
            aria-label={t.regie.videoRename}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onDelete} disabled={!!busy} aria-label={t.regie.videoDelete}>
            <Trash2 className="size-3.5" />
          </Button>
          <Button size="sm" className="ms-1 h-8 rounded-full px-3" onClick={onLaunch} disabled={!!busy} aria-label={`${t.regie.videoLaunch} ${item.title}`}>
            {busy === `launch:${item.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {t.regie.videoLaunch}
          </Button>
        </div>
      )}
    </li>
  );
}

function AddVideoForm({
  organizationId,
  blobEnabled,
  busy,
  full,
  onAdd,
}: {
  organizationId: string;
  blobEnabled: boolean;
  busy: Busy;
  full: boolean;
  onAdd: (title: string, url: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = url.trim();
    if (!parseVideoSource(clean)) {
      setError(t.regie.videoInvalidUrl);
      return;
    }
    setError(null);
    if (await onAdd(title.trim() || defaultTitle(clean, t), clean)) {
      setTitle("");
      setUrl("");
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-2 border-t pt-4" data-video-add>
      <div className="grid gap-1.5">
        <Label htmlFor="video-title" className="text-xs text-muted-foreground">
          {t.regie.videoAddTitle}
        </Label>
        <Input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_VIDEO_TITLE_LENGTH} placeholder={t.regie.videoTitlePlaceholder} className="h-10" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="video-url" className="text-xs text-muted-foreground">
          {t.regie.videoUrlLabel}
        </Label>
        <Input
          id="video-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          maxLength={MAX_VIDEO_URL_LENGTH}
          placeholder={t.regie.videoUrlPlaceholder}
          dir="ltr"
          inputMode="url"
          autoComplete="off"
          className="h-10"
          aria-invalid={!!error}
        />
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="secondary" className="h-auto min-h-10 min-w-0 whitespace-normal rounded-xl py-2" disabled={!url.trim() || !!busy || full}>
          {busy === "add" && !uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {t.regie.videoAdd}
        </Button>
        <Button type="button" variant="outline" className="h-auto min-h-10 min-w-0 whitespace-normal rounded-xl py-2" disabled={uploading || !!busy || full} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? t.regie.videoUploading : t.regie.videoUpload}
        </Button>
      </div>
      {full && <p className="text-xs text-muted-foreground">{fmt(t.regie.videoLimit, { max: MAX_EVENT_VIDEOS })}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        data-video-file
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setUploading(true);
          try {
            const uploaded = await uploadImage(organizationId, file, { blobEnabled });
            await onAdd(title.trim() || defaultTitle(uploaded, t, file.name), uploaded);
            setTitle("");
          } catch (error) {
            toast.error(
              error instanceof UploadTooLargeError
                ? fmt(t.studio.fileTooBig, { max: formatBytes(error.maxBytes) })
                : error instanceof Error && error.message !== "upload"
                  ? error.message
                  : t.common.errorGeneric,
            );
          } finally {
            setUploading(false);
          }
        }}
      />
    </form>
  );
}

function LaunchLink({ busy, onLaunch }: { busy: Busy; onLaunch: (url: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = url.trim();
    if (!parseVideoSource(clean)) {
      setError(t.regie.videoInvalidUrl);
      return;
    }
    setError(null);
    if (await onLaunch(clean)) setUrl("");
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t pt-4" data-video-launch-link>
      <Label htmlFor="video-live-url" className="flex items-center gap-2">
        <Link2 className="size-4 text-muted-foreground" />
        {t.regie.videoLaunchNow}
      </Label>
      <p className="mt-1 text-xs text-muted-foreground">{t.regie.videoLaunchNowHelp}</p>
      <div className="mt-2 flex gap-2">
        <Input
          id="video-live-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          maxLength={MAX_VIDEO_URL_LENGTH}
          placeholder={t.regie.videoUrlPlaceholder}
          dir="ltr"
          inputMode="url"
          autoComplete="off"
          className="h-10"
          aria-invalid={!!error}
        />
        <Button type="submit" className="h-10 shrink-0 rounded-xl" disabled={!url.trim() || !!busy}>
          {busy === "launchUrl" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {t.regie.videoLaunch}
        </Button>
        {url && (
          <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={() => setUrl("")} aria-label={t.common.cancel}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert" data-video-link-error>
          {error}
        </p>
      )}
    </form>
  );
}
