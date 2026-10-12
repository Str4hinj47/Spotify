import React from "react";
import { Heart, Pause, Play } from "lucide-react";
import { Cover, IconButton, MoreMenu } from "./ui";
import { formatDuration } from "../lib/format";
import { coverUrl } from "../lib/api";

// One row per song. The row's main area plays it; heart and menu are separate controls.
export default function TrackList({ tracks, currentId, isPlaying, favorites, onPlay, onToggleFavorite, menuFor, showAlbum = false }) {
  return (
    <ul className="divide-y divide-line/70 border-y border-line/70" aria-label="Songs">
      {tracks.map((track, index) => {
        const isCurrent = track.id === currentId;
        const isFav = favorites.has(track.id);
        return (
          <li key={track.id} className="group flex items-center gap-2 md:gap-3 pr-1 md:pr-2 hover:bg-surface/80 rounded-xl">
            <button
              type="button"
              onClick={() => onPlay(index)}
              aria-current={isCurrent ? "true" : undefined}
              aria-label={`Play ${track.title} by ${track.artist}`}
              className="flex flex-1 min-w-0 items-center gap-3 md:gap-4 py-2.5 pl-2 md:pl-3 text-left"
            >
              <span className="relative w-5 shrink-0 text-center text-ink2 num text-sm" aria-hidden="true">
                {isCurrent && isPlaying ? (
                  <span className="inline-flex items-end justify-center gap-[2px] h-4 text-accent">
                    <span className="eq-bar" />
                    <span className="eq-bar" style={{ animationDelay: "-0.4s" }} />
                    <span className="eq-bar" style={{ animationDelay: "-0.8s" }} />
                  </span>
                ) : isCurrent ? (
                  <Pause size={16} className="inline text-accent" />
                ) : (
                  <span className="group-hover:hidden">{index + 1}</span>
                )}
                {!isCurrent && <Play size={16} className="hidden group-hover:inline text-ink" />}
              </span>
              <Cover src={coverUrl(track)} className="w-11 h-11 rounded-lg shrink-0" iconSize={18} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] font-medium ${isCurrent ? "text-accent" : "text-ink"}`}>
                  {track.title}
                </span>
                <span className="block truncate text-sm text-ink2">{track.artist}</span>
              </span>
              {showAlbum && track.album && (
                <span className="hidden lg:block w-44 truncate text-sm text-ink2">{track.album}</span>
              )}
              <span className="hidden sm:block w-12 text-right text-sm text-ink2 num">{formatDuration(track.duration)}</span>
            </button>
            <IconButton
              label={isFav ? `Remove ${track.title} from favorites` : `Add ${track.title} to favorites`}
              icon={Heart}
              size={18}
              active={isFav}
              aria-pressed={isFav}
              onClick={() => onToggleFavorite(track.id)}
              iconProps={{ fill: isFav ? "currentColor" : "none" }}
              className={isFav ? "" : "opacity-60 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"}
            />
            <MoreMenu label={`More actions for ${track.title}`} items={menuFor(track, index)} size={18} />
          </li>
        );
      })}
    </ul>
  );
}
