import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { coverUrl, streamUrl } from "../lib/api";
import { loadValue, saveValue } from "../lib/storage";

export const RATES = [0.75, 1, 1.25, 1.5, 2];
const RESTART_THRESHOLD = 3; // seconds: "previous" restarts the song after this point

function shuffleOrder(length, first) {
  const rest = [];
  for (let i = 0; i < length; i++) if (i !== first) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 ? [first, ...rest] : rest;
}

const identity = (length) => Array.from({ length }, (_, i) => i);

function initialState() {
  const prefs = loadValue("prefs", {});
  return {
    context: [], // tracks in the list being played
    order: [], // indices into context; shuffled when shuffle is on
    pos: -1, // position inside order
    upNext: [], // tracks queued by the user; they play before the context continues
    current: null,
    playing: false,
    time: 0,
    duration: 0,
    volume: typeof prefs.volume === "number" ? prefs.volume : 0.8,
    muted: !!prefs.muted,
    rate: prefs.rate || 1,
    repeat: prefs.repeat || 0, // 0 off, 1 all, 2 one
    shuffle: !!prefs.shuffle,
    error: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "start": {
      const { tracks, index } = action;
      const order = state.shuffle ? shuffleOrder(tracks.length, index) : identity(tracks.length);
      return {
        ...state,
        context: tracks,
        order,
        pos: state.shuffle ? 0 : index,
        current: tracks[index],
        playing: true,
        time: 0,
        duration: 0,
        error: null,
      };
    }
    case "restore":
      return {
        ...state,
        context: [action.track],
        order: [0],
        pos: 0,
        current: action.track,
        playing: false,
        time: action.time || 0,
        duration: 0,
        error: null,
      };
    case "next": {
      if (state.upNext.length) {
        const [track, ...rest] = state.upNext;
        return { ...state, current: track, upNext: rest, playing: true, time: 0, duration: 0, error: null };
      }
      let pos = state.pos + 1;
      if (pos >= state.order.length) {
        if (state.repeat !== 1 || !state.order.length) {
          return { ...state, playing: false, time: 0 };
        }
        pos = 0; // repeat all: wrap around
      }
      return {
        ...state,
        pos,
        current: state.context[state.order[pos]],
        playing: true,
        time: 0,
        duration: 0,
        error: null,
      };
    }
    case "previous": {
      if (state.pos <= 0) return state;
      const pos = state.pos - 1;
      return { ...state, pos, current: state.context[state.order[pos]], playing: true, time: 0, duration: 0 };
    }
    case "enqueue": {
      if (!state.current) {
        return { ...state, current: action.track, playing: true, time: 0, duration: 0, error: null };
      }
      const upNext = action.front ? [action.track, ...state.upNext] : [...state.upNext, action.track];
      return { ...state, upNext };
    }
    case "removeUpNext":
      return { ...state, upNext: state.upNext.filter((_, i) => i !== action.index) };
    case "clearUpNext":
      return { ...state, upNext: [] };
    case "purgeTrack":
      return { ...state, upNext: state.upNext.filter((t) => t.id !== action.id) };
    case "playUpNext": {
      const track = state.upNext[action.index];
      if (!track) return state;
      return {
        ...state,
        current: track,
        upNext: state.upNext.filter((_, i) => i !== action.index),
        playing: true,
        time: 0,
        duration: 0,
        error: null,
      };
    }
    case "toggle":
      return { ...state, playing: !state.playing };
    case "setPlaying":
      return state.playing === action.value ? state : { ...state, playing: action.value };
    case "time":
      return { ...state, time: action.time };
    case "duration":
      return { ...state, duration: action.duration };
    case "volume":
      return { ...state, volume: action.volume, muted: action.volume === 0 ? true : state.muted };
    case "toggleMute":
      return { ...state, muted: !state.muted };
    case "rate":
      return { ...state, rate: action.rate };
    case "cycleRepeat":
      return { ...state, repeat: (state.repeat + 1) % 3 };
    case "toggleShuffle": {
      if (!state.context.length) return { ...state, shuffle: !state.shuffle };
      if (!state.shuffle) {
        const first = state.pos >= 0 ? state.order[state.pos] : -1;
        return { ...state, shuffle: true, order: shuffleOrder(state.context.length, first), pos: first >= 0 ? 0 : -1 };
      }
      const currentIndex = state.pos >= 0 ? state.order[state.pos] : -1;
      return { ...state, shuffle: false, order: identity(state.context.length), pos: currentIndex };
    }
    case "error":
      return { ...state, playing: false, error: action.message };
    case "clearError":
      return { ...state, error: null };
    default:
      return state;
  }
}

export function usePlayer() {
  const [state, dispatch] = useReducer(reducer, null, initialState);
  const stateRef = useRef(state);
  const audioRef = useRef(null);
  const pendingSeek = useRef(null);
  const actionsRef = useRef(null);
  useEffect(() => {
    stateRef.current = state;
  });

  // One <audio> element for the whole app. Its events feed the reducer.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onPlayFailure = (err) => {
      if (err && err.name === "AbortError") return; // superseded by another load
      dispatch({ type: "error", message: "Playback was blocked. Press play to try again." });
    };
    audio.__onPlayFailure = onPlayFailure;

    const handlers = {
      timeupdate: () => dispatch({ type: "time", time: audio.currentTime }),
      durationchange: () =>
        dispatch({ type: "duration", duration: Number.isFinite(audio.duration) ? audio.duration : 0 }),
      loadedmetadata: () => {
        if (pendingSeek.current !== null) {
          audio.currentTime = Math.min(pendingSeek.current, audio.duration || pendingSeek.current);
          pendingSeek.current = null;
        }
      },
      play: () => dispatch({ type: "setPlaying", value: true }),
      pause: () => {
        // Changing src can fire a stray pause while we are about to play; only a real pause counts.
        if (audio.paused && !audio.ended) dispatch({ type: "setPlaying", value: false });
      },
      ended: () => {
        const s = stateRef.current;
        if (s.repeat === 2) {
          audio.currentTime = 0;
          audio.play().catch(onPlayFailure);
        } else {
          dispatch({ type: "next" });
        }
      },
      error: () => {
        if (audio.getAttribute("src")) {
          dispatch({ type: "error", message: "This file could not be played. It may be damaged." });
        }
      },
    };
    Object.entries(handlers).forEach(([name, fn]) => audio.addEventListener(name, fn));

    return () => {
      Object.entries(handlers).forEach(([name, fn]) => audio.removeEventListener(name, fn));
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  const currentId = state.current ? state.current.id : null;

  // Load the new track. Autoplay only when the reducer says we are playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = stateRef.current.current;
    if (!track) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    audio.src = streamUrl(track);
    audio.playbackRate = stateRef.current.rate;
    if (stateRef.current.playing) {
      audio.play().catch(audio.__onPlayFailure);
    }
  }, [currentId]);

  // Play or pause the element when the reducer's playing flag changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.getAttribute("src")) return;
    if (state.playing && audio.paused) {
      audio.play().catch(audio.__onPlayFailure);
    } else if (!state.playing && !audio.paused) {
      audio.pause();
    }
  }, [state.playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.volume;
    audio.muted = state.muted;
  }, [state.volume, state.muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = state.rate;
  }, [state.rate]);

  useEffect(() => {
    saveValue("prefs", {
      volume: state.volume,
      muted: state.muted,
      rate: state.rate,
      repeat: state.repeat,
      shuffle: state.shuffle,
    });
  }, [state.volume, state.muted, state.rate, state.repeat, state.shuffle]);

  // Remember the current track and roughly where it was, so a reload resumes it paused.
  const saveTime = Math.floor(state.time / 5);
  useEffect(() => {
    if (currentId) saveValue("session", { trackId: currentId, time: stateRef.current.time });
  }, [currentId, saveTime]);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio || !audio.getAttribute("src")) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : time;
    audio.currentTime = Math.max(0, Math.min(time, max));
    dispatch({ type: "time", time: audio.currentTime });
  }, []);

  const next = useCallback(() => dispatch({ type: "next" }), []);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    const s = stateRef.current;
    if (audio && audio.currentTime > RESTART_THRESHOLD) {
      seek(0);
    } else if (s.pos > 0) {
      dispatch({ type: "previous" });
    } else {
      seek(0);
    }
  }, [seek]);

  const playList = useCallback(
    (tracks, index = 0) => {
      const track = tracks[index];
      if (!track) return;
      if (stateRef.current.current && stateRef.current.current.id === track.id) {
        seek(0);
        dispatch({ type: "setPlaying", value: true });
        return;
      }
      dispatch({ type: "start", tracks, index });
    },
    [seek]
  );

  const togglePlay = useCallback(() => {
    if (!stateRef.current.current) return;
    dispatch({ type: "toggle" });
  }, []);

  const restore = useCallback((track, time) => {
    pendingSeek.current = time || null;
    dispatch({ type: "restore", track, time });
  }, []);

  const actions = useMemo(() => ({
    playList,
    togglePlay,
    next,
    previous,
    seek,
    restore,
    setVolume: (volume) => dispatch({ type: "volume", volume: Math.max(0, Math.min(1, volume)) }),
    toggleMute: () => dispatch({ type: "toggleMute" }),
    setRate: (rate) => dispatch({ type: "rate", rate }),
    cycleRepeat: () => dispatch({ type: "cycleRepeat" }),
    toggleShuffle: () => dispatch({ type: "toggleShuffle" }),
    enqueue: (track, front = false) => dispatch({ type: "enqueue", track, front }),
    removeUpNext: (index) => dispatch({ type: "removeUpNext", index }),
    clearUpNext: () => dispatch({ type: "clearUpNext" }),
    playUpNext: (index) => dispatch({ type: "playUpNext", index }),
    clearError: () => dispatch({ type: "clearError" }),
    purgeTrack: (id) => dispatch({ type: "purgeTrack", id }),
  }), [playList, togglePlay, next, previous, seek, restore]);
  actionsRef.current = actions;

  // Keep the OS-level now-playing info and media keys in sync.
  const track = state.current;
  const artwork = track ? coverUrl(track) : null;
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const t = stateRef.current.current;
    if (!t || typeof window.MediaMetadata === "undefined") {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album || "Tonal",
      artwork: artwork ? [{ src: artwork, sizes: "512x512", type: "image/jpeg" }] : [],
    });
  }, [currentId, artwork]);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state.playing ? "playing" : "paused";
  }, [state.playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers = {
      play: () => dispatch({ type: "setPlaying", value: true }),
      pause: () => dispatch({ type: "setPlaying", value: false }),
      previoustrack: () => actionsRef.current.previous(),
      nexttrack: () => actionsRef.current.next(),
      seekbackward: (d) => actionsRef.current.seek((audioRef.current?.currentTime || 0) - (d.seekOffset || 10)),
      seekforward: (d) => actionsRef.current.seek((audioRef.current?.currentTime || 0) + (d.seekOffset || 10)),
      seekto: (d) => actionsRef.current.seek(d.seekTime || 0),
    };
    Object.entries(handlers).forEach(([action, fn]) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* action not supported by this browser */
      }
    });
  }, []);

  useEffect(() => {
    document.title = track ? `${track.title} · Tonal` : "Tonal";
  }, [track]);

  return {
    state,
    actions,
    audioRef,
    progress: state.duration ? state.time / state.duration : 0,
  };
}
