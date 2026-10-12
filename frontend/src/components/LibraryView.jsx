import React, { useMemo, useState } from "react";
import { Download, Heart, Library, Play, Search, Shuffle, TriangleAlert } from "lucide-react";
import { Button, EmptyState, SectionHeader } from "./ui";
import TrackList from "./TrackList";
import { formatTotal, pluralize } from "../lib/format";

const SORTS = {
  added: { label: "Recently added", fn: null },
  title: { label: "Title", fn: (a, b) => a.title.localeCompare(b.title) },
  artist: { label: "Artist", fn: (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title) },
  duration: { label: "Length", fn: (a, b) => (a.duration || 0) - (b.duration || 0) },
};

// Used for both "Library" (all songs) and "Favorites" (filtered by the user's hearts).
export default function LibraryView({ mode, tracks, loading, error, favorites, currentId, isPlaying, onPlayList, onShuffle, onToggleFavorite, menuFor, onGoSearch, onRetry }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("added");
  const isFavorites = mode === "favorites";

  const visible = useMemo(() => {
    let list = isFavorites ? tracks.filter((t) => favorites.has(t.id)) : tracks;
    const q = filter.trim().toLowerCase();
    if (q) list = list.filter((t) => `${t.title} ${t.artist} ${t.album || ""}`.toLowerCase().includes(q));
    const cmp = SORTS[sort].fn;
    return cmp ? [...list].sort(cmp) : list;
  }, [tracks, favorites, filter, sort, isFavorites]);

  const totalSeconds = visible.reduce((sum, t) => sum + (t.duration || 0), 0);
  const title = isFavorites ? "Favorites" : "Library";

  if (error && !tracks.length) {
    return (
      <div>
        <SectionHeader title={title} />
        <EmptyState icon={TriangleAlert} title="Couldn’t load your library">
          {error}
          <span className="mt-4 block"><Button variant="secondary" onClick={onRetry}>Try again</Button></span>
        </EmptyState>
      </div>
    );
  }

  if (!loading && !tracks.length) {
    return (
      <div>
        <SectionHeader title={title} />
        <EmptyState icon={Library} title="Your library is empty">
          Songs you download show up here. Start by searching YouTube for something you want to keep.
          <span className="mt-5 block"><Button variant="primary" onClick={onGoSearch}><Search size={17} aria-hidden="true" /> Find music</Button></span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title={title}>
        <span className="text-sm text-ink2 mr-2 num">
          {visible.length ? `${pluralize(visible.length, "song")} · ${formatTotal(totalSeconds)}` : ""}
        </span>
        <Button variant="primary" onClick={() => onPlayList(visible, 0)} disabled={!visible.length}>
          <Play size={16} fill="currentColor" aria-hidden="true" /> Play
        </Button>
        <Button variant="secondary" onClick={() => onShuffle(visible)} disabled={!visible.length}>
          <Shuffle size={16} aria-hidden="true" /> Shuffle
        </Button>
      </SectionHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <label htmlFor={`filter-${mode}`} className="sr-only">Filter {title.toLowerCase()}</label>
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2" aria-hidden="true" />
          <input
            id={`filter-${mode}`}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isFavorites ? "Filter favorites" : "Filter songs, artists"}
            className="w-full h-10 rounded-xl bg-surface2 border border-line pl-10 pr-3 text-[15px] placeholder:text-ink2 focus:outline-none focus:border-accent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink2">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 rounded-xl bg-surface2 border border-line px-3 text-[15px] text-ink focus:outline-none focus:border-accent"
          >
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && !tracks.length ? (
        <ul className="space-y-3" aria-label="Loading songs">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-14 rounded-xl bg-surface animate-pulse" />
          ))}
        </ul>
      ) : visible.length ? (
        <TrackList
          tracks={visible}
          currentId={currentId}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={(index) => onPlayList(visible, index)}
          onToggleFavorite={onToggleFavorite}
          menuFor={(track, index) => menuFor(track, index, visible)}
          showAlbum
        />
      ) : isFavorites && !filter ? (
        <EmptyState icon={Heart} title="No favorites yet">
          Tap the heart next to a song to keep it here.
        </EmptyState>
      ) : (
        <EmptyState icon={Download} title="No matches">
          Nothing in your {title.toLowerCase()} matches “{filter}”.
        </EmptyState>
      )}
    </div>
  );
}
