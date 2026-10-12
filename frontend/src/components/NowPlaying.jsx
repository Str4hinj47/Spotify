import React, { useEffect, useState } from "react";
import { Heart, ListMusic, ChevronDown } from "lucide-react";
import { Cover, IconButton, MoreMenu } from "./ui";
import { SeekBar, SpeedButton, TransportControls, VolumeControl } from "./PlayerBar";
import { coverUrl } from "../lib/api";
import { dominantColor } from "../lib/color";

// Full-screen player. The backdrop is tinted by the artwork: the only place colour
// from the content is allowed to lead.
export default function NowPlaying({ state, actions, onClose, openQueue, isFavorite, onToggleFavorite, menuItems }) {
  const track = state.current;
  const src = track ? coverUrl(track) : null;
  const [tint, setTint] = useState(null);

  useEffect(() => {
    let alive = true;
    dominantColor(src).then((c) => alive && setTint(c));
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Darken the sampled colour so white text keeps at least 4.5:1 across the gradient.
  const [r, g, b] = (tint || [60, 52, 40]).map((v) => Math.round(v * 0.55));
  const backdrop = {
    background: `radial-gradient(120% 70% at 30% 0%, rgba(${r},${g},${b},0.95) 0%, rgba(${r},${g},${b},0.35) 55%, #0E0E10 100%)`,
  };

  if (!track) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Now playing" className="fixed inset-0 z-40 flex flex-col text-ink overflow-y-auto" style={backdrop}>
      <div className="flex items-center justify-between px-4 pt-4 md:px-8">
        <IconButton label="Close now playing" icon={ChevronDown} size={26} onClick={onClose} shortcut="Escape" />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink2">Now playing</span>
        <MoreMenu label="More actions for this song" items={menuItems(track)} />
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 px-6 md:px-16 py-6 max-w-6xl w-full mx-auto">
        <Cover
          src={src}
          alt={`Cover art for ${track.title}`}
          iconSize={72}
          className={`w-[min(72vw,380px)] md:w-[min(34vw,420px)] aspect-square rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] transition-transform duration-500 ease-out ${state.playing ? "motion-safe:scale-100" : "motion-safe:scale-[0.94]"}`}
        />

        <div className="w-full max-w-[420px] flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight truncate">{track.title}</h2>
              <p className="text-lg text-ink/80 truncate mt-1">{track.artist}</p>
            </div>
            <IconButton
              label={isFavorite ? `Remove ${track.title} from favorites` : `Add ${track.title} to favorites`}
              icon={Heart}
              size={24}
              active={isFavorite}
              aria-pressed={isFavorite}
              iconProps={{ fill: isFavorite ? "currentColor" : "none" }}
              onClick={() => onToggleFavorite(track.id)}
              className="mt-1"
            />
          </div>

          <SeekBar time={state.time} duration={state.duration} onSeek={actions.seek} label="Seek" />
          <TransportControls state={state} actions={actions} large />

          <div className="flex items-center justify-between gap-3 pt-1">
            <SpeedButton rate={state.rate} setRate={actions.setRate} />
            <VolumeControl state={state} actions={actions} className="flex-1 max-w-[180px] justify-center" />
            <IconButton label="Up next" icon={ListMusic} active={state.upNext.length > 0} onClick={openQueue} />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-danger">{state.error}</p>
          )}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{state.playing ? "Playing" : "Paused"}</span>
    </div>
  );
}


