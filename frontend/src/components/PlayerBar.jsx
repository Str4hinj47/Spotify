import React from "react";
import { Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { Cover, IconButton } from "./ui";
import { formatTime } from "../lib/format";
import { coverUrl } from "../lib/api";
import { RATES } from "../hooks/usePlayer";

const rangeStyle = (value, max) => ({ "--fill": `${max ? Math.min(100, (value / max) * 100) : 0}%` });

export function volumeIconFor(volume, muted) {
  if (muted || volume === 0) return VolumeX;
  return volume < 0.5 ? Volume1 : Volume2;
}

export function repeatLabel(repeat) {
  return ["Repeat: off", "Repeat: all", "Repeat: one"][repeat];
}

export function SeekBar({ time, duration, onSeek, label = "Seek" }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <span className="num text-xs text-ink2 w-11 text-right">{formatTime(time)}</span>
      <input
        type="range"
        className="range flex-1"
        min={0}
        max={duration || 0}
        step="0.1"
        value={Math.min(time, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
        style={rangeStyle(time, duration)}
        disabled={!duration}
      />
      <span className="num text-xs text-ink2 w-11">{duration ? formatTime(duration) : "--:--"}</span>
    </div>
  );
}

export function TransportControls({ state, actions, large = false }) {
  const hasTrack = !!state.current;
  const playSize = large ? "w-16 h-16" : "w-10 h-10";
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3">
      <IconButton label="Shuffle" icon={Shuffle} active={state.shuffle} aria-pressed={state.shuffle} onClick={actions.toggleShuffle} disabled={!state.context.length} shortcut="S" className="hidden sm:inline-flex" />
      <IconButton label="Previous" icon={SkipBack} size={large ? 26 : 20} onClick={actions.previous} disabled={!hasTrack} shortcut="Shift+ArrowLeft" className={large ? "h-12 w-12" : ""} />
      <button
        type="button"
        onClick={actions.togglePlay}
        disabled={!hasTrack}
        aria-label={state.playing ? "Pause" : "Play"}
        aria-keyshortcuts="Space"
        className={`${playSize} rounded-full bg-accent text-accent-ink flex items-center justify-center hover:brightness-110 active:scale-95 transition disabled:opacity-40 shrink-0`}
      >
        {state.playing ? <Pause size={large ? 30 : 18} fill="currentColor" aria-hidden="true" /> : <Play size={large ? 30 : 18} fill="currentColor" className="translate-x-[1px]" aria-hidden="true" />}
      </button>
      <IconButton label="Next" icon={SkipForward} size={large ? 26 : 20} onClick={actions.next} disabled={!hasTrack} shortcut="Shift+ArrowRight" className={large ? "h-12 w-12" : ""} />
      <IconButton label={repeatLabel(state.repeat)} icon={state.repeat === 2 ? Repeat1 : Repeat} active={state.repeat !== 0} aria-pressed={state.repeat !== 0} onClick={actions.cycleRepeat} shortcut="R" className="hidden sm:inline-flex" />
    </div>
  );
}

export function VolumeControl({ state, actions, className = "" }) {
  const volume = state.muted ? 0 : state.volume;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <IconButton label={state.muted ? "Unmute" : "Mute"} icon={volumeIconFor(state.volume, state.muted)} onClick={actions.toggleMute} shortcut="M" />
      <input
        type="range"
        className="range w-24"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        aria-label="Volume"
        aria-valuetext={`${Math.round(volume * 100)} percent`}
        onChange={(e) => actions.setVolume(Number(e.target.value))}
        style={rangeStyle(volume, 1)}
      />
    </div>
  );
}

export function SpeedButton({ rate, setRate }) {
  const next = () => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length] || 1);
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Playback speed ${rate}×. Change speed`}
      className="num h-9 min-w-12 px-2 rounded-full text-sm font-semibold text-ink2 hover:text-ink hover:bg-surface2"
    >
      {rate === 1 ? "1×" : `${rate}×`}
    </button>
  );
}

export default function PlayerBar({ state, actions, openNowPlaying, openQueue, isFavorite, onToggleFavorite }) {
  const track = state.current;
  const cover = track ? coverUrl(track) : null;
  return (
    <>
      {/* Desktop: full player bar */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-6 h-24 px-5 bg-surface border-t border-line">
        <div className="min-w-0 flex items-center gap-3">
          {track ? (
            <button type="button" onClick={openNowPlaying} className="flex items-center gap-3 min-w-0 text-left rounded-xl p-1 -m-1 hover:bg-surface2" aria-label={`Open now playing: ${track.title}`}>
              <Cover src={cover} className="w-14 h-14 rounded-lg shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{track.title}</span>
                <span className="block truncate text-sm text-ink2">{track.artist}</span>
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 text-ink2 text-sm">
              <div className="w-14 h-14 rounded-lg bg-surface2" aria-hidden="true" />
              Nothing playing
            </div>
          )}
          {track && (
            <IconButton
              label={isFavorite ? `Remove ${track.title} from favorites` : `Add ${track.title} to favorites`}
              icon={Heart}
              size={18}
              active={isFavorite}
              aria-pressed={isFavorite}
              className="hidden lg:inline-flex"
              iconProps={{ fill: isFavorite ? "currentColor" : "none" }}
              onClick={() => onToggleFavorite(track.id)}
            />
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <TransportControls state={state} actions={actions} />
          <SeekBar time={state.time} duration={state.duration} onSeek={actions.seek} label="Seek" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <SpeedButton rate={state.rate} setRate={actions.setRate} />
          <VolumeControl state={state} actions={actions} className="hidden lg:flex" />
          <IconButton label="Queue" icon={ListMusic} active={state.upNext.length > 0} onClick={openQueue} />
        </div>
      </div>

      {/* Mobile: mini player above the tab bar */}
      <div className="md:hidden relative bg-surface border-t border-line">
        <div className="absolute top-0 left-0 h-[2px] bg-accent" style={{ width: `${(state.duration ? state.time / state.duration : 0) * 100}%` }} aria-hidden="true" />
        <div className="flex items-center gap-2 pl-3 pr-1 h-16">
          <button type="button" onClick={track ? openNowPlaying : undefined} disabled={!track} className="flex flex-1 min-w-0 items-center gap-3 text-left" aria-label={track ? `Open now playing: ${track.title}` : "Nothing playing"}>
            <Cover src={cover} className="w-11 h-11 rounded-md shrink-0" iconSize={16} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{track ? track.title : "Nothing playing"}</span>
              <span className="block truncate text-sm text-ink2">{track ? track.artist : "Pick a song to start"}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={actions.togglePlay}
            disabled={!track}
            aria-label={state.playing ? "Pause" : "Play"}
            className="w-11 h-11 flex items-center justify-center rounded-full text-ink disabled:opacity-40"
          >
            {state.playing ? <Pause size={24} fill="currentColor" aria-hidden="true" /> : <Play size={24} fill="currentColor" aria-hidden="true" />}
          </button>
          <button type="button" onClick={actions.next} disabled={!track} aria-label="Next" className="w-11 h-11 flex items-center justify-center text-ink disabled:opacity-40">
            <SkipForward size={22} fill="currentColor" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
