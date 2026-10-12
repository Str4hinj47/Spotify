import React, { useEffect, useState } from "react";
import { Button, Dialog } from "./ui";

export function EditTrackDialog({ track, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist);
      setError("");
    }
  }, [track]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the song a title.");
      return;
    }
    setSaving(true);
    try {
      await onSave(track.id, { title, artist });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!track} onClose={onClose} title="Edit song info">
      {track && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink2">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-11 rounded-xl bg-surface2 border border-line px-3 text-[16px] text-ink focus:outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink2">
            Artist
            <input value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} className="h-11 rounded-xl bg-surface2 border border-line px-3 text-[16px] text-ink focus:outline-none focus:border-accent" />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function NameDialog({ open, title, initial = "", confirmLabel, onClose, onSubmit }) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim().slice(0, 80));
  };
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink2">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name your playlist" className="h-11 rounded-xl bg-surface2 border border-line px-3 text-[16px] text-ink placeholder:text-ink2 focus:outline-none focus:border-accent" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!name.trim()}>{confirmLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// Destructive actions always ask first and default to Cancel.
export function ConfirmDialog({ request, onClose }) {
  return (
    <Dialog open={!!request} onClose={onClose} title={request?.title || ""}>
      {request && (
        <div className="flex flex-col gap-5">
          <p className="text-[15px] text-ink2 leading-relaxed">{request.message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} autoFocus>Cancel</Button>
            <button
              type="button"
              onClick={() => {
                request.onConfirm();
                onClose();
              }}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full font-semibold bg-danger text-accent-ink hover:brightness-110"
            >
              {request.confirmLabel || "Delete"}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function PreviewDialog({ video, onClose, children }) {
  return (
    <Dialog open={!!video} onClose={onClose} title={video ? video.title : ""} size="lg">
      {video && (
        <div className="flex flex-col gap-4">
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
            <iframe
              key={video.id}
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
              title={`YouTube preview: ${video.title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink2 truncate">{video.channel}</p>
            </div>
            <div className="flex gap-2 sm:w-[320px]">{children}</div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
