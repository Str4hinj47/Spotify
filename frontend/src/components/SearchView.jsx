import React, { useEffect, useRef, useState } from "react";
import { Check, Download, Eye, Play, RotateCw, Search, TriangleAlert, X, Youtube } from "lucide-react";
import { Button, EmptyState, SectionHeader } from "./ui";
import { api } from "../lib/api";
import { formatDuration } from "../lib/format";

const SUGGESTIONS = ["lofi hip hop", "jazz piano", "acoustic covers", "80s synth pop", "ambient focus music"];

export function DownloadButton({ state, video, onDownload, onPlay, className = "" }) {
  const { status } = state;
  if (status === "library") {
    return (
      <Button variant="secondary" className={`flex-1 ${className}`} onClick={onPlay}>
        <Check size={17} aria-hidden="true" /> In library
        <span className="sr-only">, play {video.title}</span>
      </Button>
    );
  }
  if (status === "active") {
    const pct = Math.round((state.progress || 0) * 100);
    const label = state.jobStatus === "queued" ? "Waiting…" : state.jobStatus === "converting" ? "Converting to MP3…" : `Downloading ${pct}%`;
    return (
      <div className={`relative flex-1 h-10 rounded-full overflow-hidden bg-surface2 ${className}`} role="status" aria-live="polite">
        <span className="absolute inset-y-0 left-0 bg-accent/35 transition-[width] duration-300" style={{ width: `${pct}%` }} aria-hidden="true" />
        <span className="relative h-full flex items-center justify-center gap-2 text-sm font-semibold num">{label}</span>
        <span
          className="sr-only"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`Download progress for ${video.title}`}
        />
      </div>
    );
  }
  if (status === "error") {
    return (
      <Button variant="secondary" className={`flex-1 ${className}`} onClick={onDownload} title={state.error}>
        <RotateCw size={16} aria-hidden="true" /> Try again
      </Button>
    );
  }
  return (
    <Button variant="primary" className={`flex-1 ${className}`} onClick={onDownload}>
      <Download size={17} aria-hidden="true" /> Download MP3
    </Button>
  );
}

function ResultCard({ video, state, onDownload, onPlay, onPreview }) {
  return (
    <article className="flex flex-col bg-surface rounded-card overflow-hidden border border-line/70">
      <button type="button" onClick={() => onPreview(video)} className="group relative aspect-video bg-surface2 text-left" aria-label={`Preview ${video.title}`}>
        <img src={video.thumbnail} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" aria-hidden="true" />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" aria-hidden="true">
          <span className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <Play size={20} fill="currentColor" className="translate-x-[1px]" />
          </span>
        </span>
        {video.duration ? (
          <span className="absolute bottom-2 right-2 num text-xs font-semibold bg-black/75 rounded-md px-1.5 py-0.5">{formatDuration(video.duration)}</span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug line-clamp-2">{video.title}</h3>
          {video.channel && <p className="mt-1 text-sm text-ink2 truncate">{video.channel}</p>}
        </div>
        <div className="mt-auto flex items-center gap-2">
          <DownloadButton state={state} video={video} onDownload={() => onDownload(video)} onPlay={() => onPlay(video.id)} />
          <Button variant="ghost" onClick={() => onPreview(video)} aria-label={`Preview ${video.title} on YouTube`} className="px-3">
            <Eye size={18} aria-hidden="true" />
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger flex gap-2 items-start">
            <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{state.error}</span>
          </p>
        )}
      </div>
    </article>
  );
}

export default function SearchView({ focusKey, downloadStateFor, onDownload, onPlay, onPreview }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMessage, setErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (focusKey) inputRef.current?.focus();
  }, [focusKey]);

  const runSearch = async (text) => {
    const q = text.trim();
    if (!q) {
      setStatus("idle");
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    setStatus("loading");
    setSubmitted(q);
    try {
      const list = await api.search(q, 12);
      if (id !== requestId.current) return; // a newer search started
      setResults(list);
      setErrorMessage("");
      setStatus("done");
    } catch (err) {
      if (id !== requestId.current) return;
      setErrorMessage(err.message);
      setStatus("error");
    }
  };

  // Search as you type, but not on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 450);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div>
      <SectionHeader title="Search" />

      <form role="search" onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="relative">
        <label htmlFor="yt-search" className="sr-only">Search YouTube for a song or video</label>
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink2" aria-hidden="true" />
        <input
          id="yt-search"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search YouTube"
          autoComplete="off"
          spellCheck={false}
          aria-keyshortcuts="/"
          className="w-full h-12 rounded-2xl bg-surface2 border border-line pl-12 pr-12 text-[16px] placeholder:text-ink2 focus:outline-none focus:border-accent focus-visible:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-ink2 hover:text-ink hover:bg-line flex items-center justify-center">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </form>

      <p className="mt-3 text-xs text-ink2">
        Download only what you have the right to use. Respect creators’ copyrights and YouTube’s terms.
      </p>

      <div className="mt-6" aria-live="polite">
        {status === "idle" && (
          <EmptyState icon={Youtube} title="Find something to keep">
            Search YouTube, preview the video, then save its audio as an MP3 in your library.
            <span className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => { setQuery(s); }} className="h-9 px-4 rounded-full bg-surface2 text-sm hover:bg-line">
                  {s}
                </button>
              ))}
            </span>
          </EmptyState>
        )}
        {status === "loading" && (
          <p className="text-sm text-ink2 mb-4">Searching for “{submitted}”…</p>
        )}
        {status === "error" && (
          <EmptyState icon={TriangleAlert} title="Search didn’t work">
            {errorMessage}
            <span className="mt-4 block">
              <Button variant="secondary" onClick={() => runSearch(query)}>Try again</Button>
            </span>
          </EmptyState>
        )}
        {status === "done" && results.length === 0 && (
          <EmptyState icon={Search} title={`No results for “${submitted}”`}>
            Try different words, or check the spelling.
          </EmptyState>
        )}
        {status === "done" && results.length > 0 && (
          <>
            <p className="text-sm text-ink2 mb-4">Results for “{submitted}”</p>
            <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
              {results.map((video) => (
                <ResultCard
                  key={video.id}
                  video={video}
                  state={downloadStateFor(video.id)}
                  onDownload={onDownload}
                  onPlay={onPlay}
                  onPreview={onPreview}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
