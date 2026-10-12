import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListEnd, ListPlus, ListStart, Minus, Pencil, Trash2, Heart, X, TriangleAlert } from "lucide-react";
import { Sidebar, TabBar } from "./components/Navigation";
import PlayerBar from "./components/PlayerBar";
import NowPlaying from "./components/NowPlaying";
import QueueSheet from "./components/QueueSheet";
import SearchView from "./components/SearchView";
import LibraryView from "./components/LibraryView";
import PlaylistsView from "./components/PlaylistsView";
import DownloadsView from "./components/DownloadsView";
import { ConfirmDialog, EditTrackDialog, NameDialog, PreviewDialog } from "./components/Dialogs";
import { DownloadButton } from "./components/SearchView";
import { useLibrary } from "./hooks/useLibrary";
import { ACTIVE, useDownloads } from "./hooks/useDownloads";
import { usePlayer } from "./hooks/usePlayer";
import { usePersistentState } from "./hooks/usePersistentState";
import { loadValue } from "./lib/storage";

const isTyping = (el) =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function App() {
  const [view, setView] = useState("search");
  const [openPlaylistId, setOpenPlaylistId] = useState(null);
  const [nowOpen, setNowOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [nameDialog, setNameDialog] = useState(null); // {mode: 'create' | 'rename', playlist?}
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [favorites, setFavorites] = usePersistentState("favorites", []);
  const [playlists, setPlaylists] = usePersistentState("playlists", []);
  const [searchFocus, setSearchFocus] = useState(0);
  const [flash, setFlash] = useState(null);

  const { tracks, loading, error: libraryError, refresh: refreshLibrary, update, remove } = useLibrary();
  const { jobs, error: downloadsError, start, dismiss } = useDownloads(refreshLibrary);
  const player = usePlayer();
  const { state, actions, audioRef } = player;

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const libraryById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const activeJobs = jobs.filter((j) => ACTIVE.includes(j.status));

  // Latest job per video, so search results can show progress or failure.
  const jobByVideo = useMemo(() => {
    const map = new Map();
    jobs.forEach((j) => {
      const existing = map.get(j.video_id);
      if (!existing || (ACTIVE.includes(j.status) && !ACTIVE.includes(existing.status))) map.set(j.video_id, j);
    });
    return map;
  }, [jobs]);

  const notify = useCallback((message) => {
    setFlash({ message, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  // Resume the last song (paused) once the library has loaded.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || loading) return;
    restoredRef.current = true;
    const session = loadValue("session", null);
    const track = session && libraryById.get(session.trackId);
    if (track) actions.restore(track, session.time || 0);
  }, [loading, libraryById, actions]);

  // ---- navigation -------------------------------------------------------
  const go = (next) => {
    setView(next);
    setOpenPlaylistId(null);
    if (next !== "search") setPreview(null);
  };
  const openPlaylist = (id) => {
    setView("playlists");
    setOpenPlaylistId(id);
  };

  // ---- library and downloads -------------------------------------------
  const downloadVideo = async (video) => {
    try {
      const { track } = await start({
        id: video.id,
        title: video.title,
        channel: video.channel,
        duration: video.duration,
        thumbnail: video.thumbnail,
      });
      notify(track ? "Already in your library" : "Download started");
    } catch (err) {
      notify(err.message);
    }
  };

  const downloadStateFor = (videoId) => {
    if (libraryById.has(videoId)) return { status: "library" };
    const job = jobByVideo.get(videoId);
    if (!job) return { status: "idle" };
    if (ACTIVE.includes(job.status)) {
      return { status: "active", progress: job.progress, jobStatus: job.status };
    }
    if (job.status === "error") return { status: "error", error: job.error };
    return { status: "idle" };
  };

  const playTrackById = (id) => {
    const track = libraryById.get(id);
    if (track) actions.playList([track], 0);
  };

  const saveTrackInfo = async (id, patch) => {
    await update(id, patch);
    notify("Song info saved");
  };

  const deleteTrack = (track) => {
    setConfirmRequest({
      title: "Delete this song?",
      message: `“${track.title}” will be removed from your library and from every playlist. This can’t be undone.`,
      confirmLabel: "Delete song",
      onConfirm: async () => {
        try {
          await remove(track.id);
          setFavorites((list) => list.filter((id) => id !== track.id));
          setPlaylists((list) => list.map((p) => ({ ...p, trackIds: p.trackIds.filter((id) => id !== track.id) })));
          actions.purgeTrack(track.id);
          notify("Song deleted");
        } catch (err) {
          notify(err.message);
        }
      },
    });
  };

  // ---- favorites and playlists -----------------------------------------
  const toggleFavorite = (id) => {
    setFavorites((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const addToPlaylist = (playlistId, trackId) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl && pl.trackIds.includes(trackId)) {
      notify(`Already in “${pl.name}”`);
      return;
    }
    setPlaylists((list) => list.map((p) => (p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p)));
    if (pl) notify(`Added to “${pl.name}”`);
  };

  const removeFromPlaylist = (playlistId, trackId) => {
    setPlaylists((list) => list.map((p) => (p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p)));
    notify("Removed from playlist");
  };

  const createPlaylist = (name) => {
    const id = `pl_${Date.now().toString(36)}`;
    setPlaylists((list) => [...list, { id, name, trackIds: [], createdAt: new Date().toISOString() }]);
    setNameDialog(null);
    setOpenPlaylistId(id);
    setView("playlists");
  };

  const renamePlaylist = (id, name) => {
    setPlaylists((list) => list.map((p) => (p.id === id ? { ...p, name } : p)));
    setNameDialog(null);
  };

  const deletePlaylist = (pl) => {
    setConfirmRequest({
      title: "Delete this playlist?",
      message: `“${pl.name}” will be deleted. Its songs stay in your library.`,
      confirmLabel: "Delete playlist",
      onConfirm: () => {
        setPlaylists((list) => list.filter((p) => p.id !== pl.id));
        setOpenPlaylistId(null);
        notify("Playlist deleted");
      },
    });
  };

  // ---- playback helpers --------------------------------------------------
  const shuffleList = (list) => {
    if (!list.length) return;
    if (!state.shuffle) actions.toggleShuffle();
    actions.playList(list, Math.floor(Math.random() * list.length));
  };

  // Menu for a song in a list. `list` is the context the song plays from.
  const menuFor = (track, index, list, extra = {}) => {
    const inPlaylists = playlists.map((pl) => ({
      id: pl.id,
      label: pl.name,
      onSelect: () => addToPlaylist(pl.id, track.id),
    }));
    const items = [
      { id: "next", label: "Play next", icon: ListStart, onSelect: () => { actions.enqueue(track, true); notify("Playing next"); } },
      { id: "queue", label: "Add to queue", icon: ListEnd, onSelect: () => { actions.enqueue(track, false); notify("Added to queue"); } },
      { separator: true },
      { id: "playlist", label: "Add to playlist", icon: ListPlus, submenu: inPlaylists, emptyLabel: "No playlists yet. Create one in Playlists." },
      { id: "fav", label: favoriteSet.has(track.id) ? "Remove from favorites" : "Add to favorites", icon: Heart, onSelect: () => toggleFavorite(track.id) },
    ];
    if (extra.playlistId) {
      items.push({ id: "remove", label: "Remove from playlist", icon: Minus, onSelect: () => removeFromPlaylist(extra.playlistId, track.id) });
    }
    items.push(
      { separator: true },
      { id: "edit", label: "Edit info", icon: Pencil, onSelect: () => setEditing(track) },
      { id: "delete", label: "Delete from library", icon: Trash2, danger: true, onSelect: () => deleteTrack(track) }
    );
    return items;
  };

  const nowPlayingMenu = (track) => menuFor(track, -1, state.context);

  // ---- keyboard shortcuts ------------------------------------------------
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e.target)) return;
    const el = e.target;
    const onControl = el && (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute?.("role") === "slider");
    const audio = audioRef.current;
    const now = audio ? audio.currentTime : 0;
    switch (e.key) {
      case " ":
        if (onControl) return;
        e.preventDefault();
        actions.togglePlay();
        break;
      case "ArrowRight":
        if (el && el.type === "range") return;
        e.preventDefault();
        if (e.shiftKey) actions.next();
        else actions.seek(now + 5);
        break;
      case "ArrowLeft":
        if (el && el.type === "range") return;
        e.preventDefault();
        if (e.shiftKey) actions.previous();
        else actions.seek(now - 5);
        break;
      case "ArrowUp":
        if (el !== document.body) return;
        e.preventDefault();
        actions.setVolume(state.volume + 0.05);
        break;
      case "ArrowDown":
        if (el !== document.body) return;
        e.preventDefault();
        actions.setVolume(state.volume - 0.05);
        break;
      case "m":
      case "M":
        actions.toggleMute();
        break;
      case "s":
      case "S":
        actions.toggleShuffle();
        break;
      case "r":
      case "R":
        actions.cycleRepeat();
        break;
      case "/":
        e.preventDefault();
        go("search");
        setSearchFocus((n) => n + 1);
        break;
      default:
        break;
    }
  };
  useEffect(() => {
    const onKey = (e) => keyHandler.current(e);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- render -------------------------------------------------------------
  const currentId = state.current ? state.current.id : null;
  const playList = (list, index) => actions.playList(list, index);
  const errorText = state.error;
  const currentFav = state.current ? favoriteSet.has(state.current.id) : false;

  let content;
  if (view === "search") {
    content = (
      <SearchView
        focusKey={searchFocus}
        downloadStateFor={downloadStateFor}
        onDownload={downloadVideo}
        onPlay={playTrackById}
        onPreview={setPreview}
      />
    );
  } else if (view === "library" || view === "favorites") {
    content = (
      <LibraryView
        mode={view}
        tracks={tracks}
        loading={loading}
        error={libraryError}
        favorites={favoriteSet}
        currentId={currentId}
        isPlaying={state.playing}
        onPlayList={playList}
        onShuffle={shuffleList}
        onToggleFavorite={toggleFavorite}
        menuFor={menuFor}
        onGoSearch={() => go("search")}
        onRetry={refreshLibrary}
      />
    );
  } else if (view === "playlists") {
    content = (
      <PlaylistsView
        playlists={playlists}
        libraryById={libraryById}
        openId={openPlaylistId}
        setOpenId={setOpenPlaylistId}
        onCreate={() => setNameDialog({ mode: "create" })}
        onRename={(pl) => setNameDialog({ mode: "rename", playlist: pl })}
        onDelete={deletePlaylist}
        onPlayList={playList}
        onShuffle={shuffleList}
        currentId={currentId}
        isPlaying={state.playing}
        favorites={favoriteSet}
        onToggleFavorite={toggleFavorite}
        menuFor={menuFor}
        onGoSearch={() => go("search")}
      />
    );
  } else {
    content = (
      <DownloadsView
        jobs={jobs}
        onDismiss={dismiss}
        onRetry={(job) => downloadVideo({ id: job.video_id, title: job.title, channel: job.channel, duration: job.duration, thumbnail: job.thumbnail })}
        onClearFinished={() => jobs.filter((j) => j.status === "done" || j.status === "error").forEach((j) => dismiss(j.id))}
        onGoSearch={() => go("search")}
      />
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-ink">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          view={view}
          go={go}
          activeDownloads={activeJobs.length}
          playlists={playlists}
          openPlaylist={openPlaylist}
          openPlaylistId={view === "playlists" ? openPlaylistId : null}
        />
        <main id="main" className="flex-1 min-w-0 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-6xl px-4 md:px-8 pt-6 md:pt-8 pb-8">
            {(downloadsError || libraryError) && view !== "downloads" && (
              <p role="alert" className="mb-4 text-sm text-danger flex items-center gap-2">
                <TriangleAlert size={16} aria-hidden="true" /> {downloadsError || libraryError}
              </p>
            )}
            {content}
          </div>
        </main>
      </div>

      {errorText && (
        <div role="alert" className="mx-3 md:mx-5 mb-2 flex items-center gap-3 rounded-xl bg-surface2 border border-danger/40 px-4 py-2.5 text-sm">
          <TriangleAlert size={16} className="text-danger shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0">{errorText}</span>
          <button
            type="button"
            className="p-1 rounded-full text-ink2 hover:text-ink"
            aria-label="Dismiss message"
            onClick={() => {
              actions.clearError();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {flash && (
        <div role="status" key={flash.id} className="pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-28 md:bottom-32 z-50 rounded-full bg-ink text-bg px-4 py-2 text-sm font-semibold shadow-xl">
          {flash.message}
        </div>
      )}

      <PlayerBar
        state={state}
        actions={actions}
        openNowPlaying={() => setNowOpen(true)}
        openQueue={() => setQueueOpen(true)}
        isFavorite={currentFav}
        onToggleFavorite={toggleFavorite}
      />
      <TabBar view={view} go={go} activeDownloads={activeJobs.length} />

      {nowOpen && (
        <NowPlaying
          state={state}
          actions={actions}
          onClose={() => setNowOpen(false)}
          openQueue={() => setQueueOpen(true)}
          isFavorite={currentFav}
          onToggleFavorite={toggleFavorite}
          menuItems={nowPlayingMenu}
        />
      )}

      <QueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} state={state} actions={actions} />

      <PreviewDialog video={preview} onClose={() => setPreview(null)}>
        {preview && (
          <>
            <DownloadButton state={downloadStateFor(preview.id)} video={preview} onDownload={() => downloadVideo(preview)} onPlay={() => playTrackById(preview.id)} />
          </>
        )}
      </PreviewDialog>

      <EditTrackDialog track={editing} onClose={() => setEditing(null)} onSave={saveTrackInfo} />

      <NameDialog
        open={!!nameDialog}
        title={nameDialog?.mode === "rename" ? "Rename playlist" : "New playlist"}
        initial={nameDialog?.mode === "rename" ? nameDialog.playlist.name : ""}
        confirmLabel={nameDialog?.mode === "rename" ? "Rename" : "Create"}
        onClose={() => setNameDialog(null)}
        onSubmit={(name) => (nameDialog?.mode === "rename" ? renamePlaylist(nameDialog.playlist.id, name) : createPlaylist(name))}
      />

      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </div>
  );
}

