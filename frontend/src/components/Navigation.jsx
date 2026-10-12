import React from "react";
import { Download, Heart, Library, ListMusic, Search, AudioWaveform } from "lucide-react";

export const VIEWS = [
  { id: "search", label: "Search", icon: Search },
  { id: "library", label: "Library", icon: Library },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "downloads", label: "Downloads", icon: Download },
];

export function Sidebar({ view, go, activeDownloads, playlists, openPlaylist, openPlaylistId }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-bg border-r border-line">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <div className="w-8 h-8 rounded-[10px] bg-accent text-accent-ink flex items-center justify-center">
          <AudioWaveform size={18} strokeWidth={2.4} aria-hidden="true" />
        </div>
        <span className="text-[19px] font-bold tracking-tight">Tonal</span>
      </div>

      <nav aria-label="Main" className="px-3">
        <ul className="space-y-0.5">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = view === id && !(id === "playlists" && openPlaylistId);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => go(id)}
                  aria-current={active ? "page" : undefined}
                  aria-keyshortcuts={id === "search" ? "/" : undefined}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 h-10 text-[15px] font-medium transition-colors ${
                    active ? "bg-surface2 text-ink" : "text-ink2 hover:text-ink hover:bg-surface"
                  }`}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span className="flex-1 text-left">{label}</span>
                  {id === "downloads" && activeDownloads > 0 && (
                    <span className="num text-xs font-semibold bg-accent text-accent-ink rounded-full px-2 py-0.5" aria-label={`${activeDownloads} in progress`}>
                      {activeDownloads}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink2">Playlists</div>
      <nav aria-label="Playlists" className="mt-2 px-3 flex-1 overflow-y-auto scroll-thin">
        <ul className="space-y-0.5">
          {playlists.map((pl) => (
            <li key={pl.id}>
              <button
                type="button"
                onClick={() => openPlaylist(pl.id)}
                aria-current={openPlaylistId === pl.id ? "page" : undefined}
                className={`w-full truncate text-left rounded-xl px-3 h-9 text-[14px] ${
                  openPlaylistId === pl.id ? "bg-surface2 text-ink" : "text-ink2 hover:text-ink hover:bg-surface"
                }`}
              >
                {pl.name}
              </button>
            </li>
          ))}
          {playlists.length === 0 && <li className="px-3 py-2 text-sm text-ink2">Create one in Playlists</li>}
        </ul>
      </nav>
    </aside>
  );
}

export function TabBar({ view, go, activeDownloads }) {
  return (
    <nav aria-label="Main" className="md:hidden bg-surface border-t border-line">
      <ul className="grid grid-cols-5">
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => go(id)}
                aria-current={active ? "page" : undefined}
                className={`relative w-full min-h-14 pt-2 pb-1.5 flex flex-col items-center gap-1 text-[11px] font-medium ${
                  active ? "text-accent" : "text-ink2"
                }`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  {id === "downloads" && activeDownloads > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 num text-[10px] font-bold bg-accent text-accent-ink rounded-full min-w-4 h-4 px-1 flex items-center justify-center" aria-label={`${activeDownloads} in progress`}>
                      {activeDownloads}
                    </span>
                  )}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
