import React from "react";
import { ListEnd, Play, X } from "lucide-react";
import { Cover, Dialog, IconButton } from "./ui";
import { coverUrl } from "../lib/api";
import { formatDuration } from "../lib/format";

function Row({ track, index, actions, removable }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Cover src={coverUrl(track)} className="w-10 h-10 rounded-md shrink-0" iconSize={16} />
      <button type="button" onClick={() => (removable ? actions.playUpNext(index) : null)} disabled={!removable} className="min-w-0 flex-1 text-left disabled:cursor-default" aria-label={removable ? `Play ${track.title} next` : undefined}>
        <span className="block truncate text-[15px] font-medium">{track.title}</span>
        <span className="block truncate text-sm text-ink2">{track.artist}</span>
      </button>
      <span className="num text-sm text-ink2 hidden sm:block">{formatDuration(track.duration)}</span>
      {removable ? (
        <>
          <IconButton label={`Play ${track.title} now`} icon={Play} size={16} onClick={() => actions.playUpNext(index)} />
          <IconButton label={`Remove ${track.title} from queue`} icon={X} size={16} onClick={() => actions.removeUpNext(index)} />
        </>
      ) : null}
    </li>
  );
}

// Shows what is playing, the songs the user queued by hand, and what comes next from the list.
export default function QueueSheet({ open, onClose, state, actions }) {
  const upcoming = [];
  if (state.context.length) {
    for (let p = state.pos + 1; p < state.order.length && upcoming.length < 50; p++) {
      upcoming.push(state.context[state.order[p]]);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Queue" size="md">
      {state.current && (
        <section className="mb-6" aria-label="Now playing">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink2 mb-2">Now playing</h3>
          <ul><Row track={state.current} index={-1} actions={actions} removable={false} /></ul>
        </section>
      )}
      <section className="mb-6" aria-label="Up next">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink2">Up next</h3>
          {state.upNext.length > 0 && (
            <button type="button" onClick={actions.clearUpNext} className="text-sm font-medium text-accent hover:underline">Clear</button>
          )}
        </div>
        {state.upNext.length ? (
          <ul className="divide-y divide-line/70">
            {state.upNext.map((t, i) => <Row key={`${t.id}-${i}`} track={t} index={i} actions={actions} removable />)}
          </ul>
        ) : (
          <p className="text-sm text-ink2 flex items-center gap-2"><ListEnd size={16} aria-hidden="true" /> Add songs with “Play next” or “Add to queue”.</p>
        )}
      </section>
      {upcoming.length > 0 && (
        <section aria-label="Continues from the list">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink2 mb-2">Continues from the list</h3>
          <ul className="divide-y divide-line/70">
            {upcoming.slice(0, 20).map((t) => (
              <li key={`ctx-${t.id}`} className="flex items-center gap-3 py-2">
                <Cover src={coverUrl(t)} className="w-10 h-10 rounded-md shrink-0" iconSize={16} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{t.title}</span>
                  <span className="block truncate text-sm text-ink2">{t.artist}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}
