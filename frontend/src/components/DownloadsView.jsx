import React from "react";
import { Check, Download, RotateCw, TriangleAlert, X } from "lucide-react";
import { Button, Cover, EmptyState, IconButton, SectionHeader } from "./ui";
import { pluralize } from "../lib/format";

const LABELS = {
  queued: "Waiting for a free slot…",
  downloading: "Downloading",
  converting: "Converting to MP3…",
  done: "Added to your library",
  error: "Couldn’t download",
};

function JobRow({ job, onDismiss, onRetry }) {
  const pct = Math.round((job.progress || 0) * 100);
  const active = ["queued", "downloading", "converting"].includes(job.status);
  return (
    <li className="flex gap-4 py-4 border-b border-line/70 last:border-0">
      <Cover src={job.thumbnail} className="w-24 h-14 rounded-lg shrink-0" iconSize={18} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{job.title}</p>
        <p className="text-sm text-ink2 truncate">{job.channel}</p>
        <div className="mt-2 flex items-center gap-3">
          {active && (
            <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${job.title} progress`}>
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${job.status === "queued" ? 0 : pct}%` }} />
            </div>
          )}
          <p className={`text-sm num whitespace-nowrap flex items-center gap-1.5 ${job.status === "error" ? "text-danger" : job.status === "done" ? "text-success" : "text-ink2"}`}>
            {job.status === "done" && <Check size={15} aria-hidden="true" />}
            {job.status === "error" && <TriangleAlert size={15} aria-hidden="true" />}
            {active && job.status === "downloading" ? `${LABELS.downloading} ${pct}%` : LABELS[job.status] || job.status}
          </p>
        </div>
        {job.status === "error" && job.error && <p className="mt-1 text-sm text-danger break-words">{job.error}</p>}
        {job.status === "error" && (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => onRetry(job)} className="h-9 px-3 text-sm">
              <RotateCw size={15} aria-hidden="true" /> Try again
            </Button>
          </div>
        )}
      </div>
      {!active && (
        <IconButton label={`Remove ${job.title} from downloads`} icon={X} size={18} onClick={() => onDismiss(job.id)} />
      )}
    </li>
  );
}

export default function DownloadsView({ jobs, onDismiss, onRetry, onClearFinished, onGoSearch }) {
  const finished = jobs.filter((j) => j.status === "done" || j.status === "error");
  return (
    <div>
      <SectionHeader title="Downloads">
        {finished.length > 0 && (
          <Button variant="ghost" onClick={onClearFinished}>Clear finished</Button>
        )}
      </SectionHeader>
      {jobs.length ? (
        <>
          <p className="text-sm text-ink2 mb-2">{pluralize(jobs.length, "download")}</p>
          <ul>{jobs.map((job) => <JobRow key={job.id} job={job} onDismiss={onDismiss} onRetry={onRetry} />)}</ul>
        </>
      ) : (
        <EmptyState icon={Download} title="No downloads yet">
          When you save a song from Search, its progress appears here.
          <span className="mt-5 block"><Button variant="secondary" onClick={onGoSearch}>Search YouTube</Button></span>
        </EmptyState>
      )}
    </div>
  );
}
