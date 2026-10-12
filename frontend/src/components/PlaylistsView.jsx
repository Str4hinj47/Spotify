import React from "react";
import { ChevronLeft, ListMusic, Pencil, Play, Plus, Shuffle, Trash2 } from "lucide-react";
import { Button, Cover, EmptyState, IconButton, MoreMenu, SectionHeader } from "./ui";
import TrackList from "./TrackList";
import { formatTotal, pluralize } from "../lib/format";
import { coverUrl } from "../lib/api";

function PlaylistCard({ playlist, tracks, onOpen }) {
  const first = tracks[0];
  return (
    <button type="button" onClick={onOpen} className="group text-left bg-surface rounded-card p-3 border border-line/70 hover:border-line transition-colors">
      <div className="aspect-square rounded-xl bg-surface2 overflow-hidden mb-3 flex items-center justify-center">
        {first ? <Cover src={coverUrl(first)} className="w-full h-full" /> : <ListMusic size={34} className="text-ink2" aria-hidden="true" />}
      </div>
      <p className="font-semibold truncate">{playlist.name}</p>
      <p className="text-sm text-ink2 num">{pluralize(tracks.length, "song")}</p>
    </button>
  );
}

export default function PlaylistsView({
  playlists, libraryById, openId, setOpenId, onCreate, onRename, onDelete,
  onPlayList, onShuffle, currentId, isPlaying, favorites, onToggleFavorite, menuFor, onGoSearch,
}) {
  const open = openId ? playlists.find((p) => p.id === openId) : null;

  if (open) {
    const tracks = open.trackIds.map((id) => libraryById.get(id)).filter(Boolean);
    const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    return (
      <div>
        <button type="button" onClick={() => setOpenId(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink2 hover:text-ink">
          <ChevronLeft size={18} aria-hidden="true" /> Playlists
        </button>
        <SectionHeader title={open.name}>
          <span className="text-sm text-ink2 mr-2 num">{tracks.length ? `${pluralize(tracks.length, "song")} · ${formatTotal(total)}` : "Empty"}</span>
          <Button variant="primary" onClick={() => onPlayList(tracks, 0)} disabled={!tracks.length}>
            <Play size={16} fill="currentColor" aria-hidden="true" /> Play
          </Button>
          <Button variant="secondary" onClick={() => onShuffle(tracks)} disabled={!tracks.length}>
            <Shuffle size={16} aria-hidden="true" /> Shuffle
          </Button>
          <MoreMenu
            label="Playlist options"
            items={[
              { id: "rename", label: "Rename playlist", icon: Pencil, onSelect: () => onRename(open) },
              { separator: true },
              { id: "delete", label: "Delete playlist", icon: Trash2, danger: true, onSelect: () => onDelete(open) },
            ]}
          />
        </SectionHeader>

        {tracks.length ? (
          <TrackList
            tracks={tracks}
            currentId={currentId}
            isPlaying={isPlaying}
            favorites={favorites}
            onPlay={(index) => onPlayList(tracks, index)}
            onToggleFavorite={onToggleFavorite}
            menuFor={(track, index) => menuFor(track, index, tracks, { playlistId: open.id })}
            showAlbum
          />
        ) : (
          <EmptyState icon={ListMusic} title="This playlist is empty">
            Use the ⋯ menu on any song and choose “Add to playlist”.
            <span className="mt-5 block"><Button variant="secondary" onClick={onGoSearch}>Find music</Button></span>
          </EmptyState>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Playlists">
        <Button variant="primary" onClick={onCreate}>
          <Plus size={17} aria-hidden="true" /> New playlist
        </Button>
      </SectionHeader>
      {playlists.length ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {playlists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              tracks={pl.trackIds.map((id) => libraryById.get(id)).filter(Boolean)}
              onOpen={() => setOpenId(pl.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={ListMusic} title="No playlists yet">
          Group songs for a workout, a commute, or a mood.
          <span className="mt-5 block"><Button variant="primary" onClick={onCreate}>Create a playlist</Button></span>
        </EmptyState>
      )}
    </div>
  );
}
