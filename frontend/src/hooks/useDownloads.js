import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export const ACTIVE = ["queued", "downloading", "converting"];

// Polls the backend while jobs are running. `onFinished` runs when a job completes,
// so the library can pick up the new track.
export function useDownloads(onFinished) {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const previous = useRef({});
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const refresh = useCallback(async () => {
    try {
      const list = await api.listDownloads();
      const prev = previous.current;
      const justFinished = list.some((j) => j.status === "done" && prev[j.id] && ACTIVE.includes(prev[j.id]));
      previous.current = Object.fromEntries(list.map((j) => [j.id, j.status]));
      setJobs(list);
      if (justFinished && finishedRef.current) finishedRef.current();
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [refresh]);

  const start = useCallback(
    async (video) => {
      setError(null);
      const { job, track } = await api.startDownload(video);
      if (job) setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)]);
      if (track && finishedRef.current) finishedRef.current();
      refresh();
      return { job, track };
    },
    [refresh]
  );

  const dismiss = useCallback(async (id) => {
    await api.dismissDownload(id);
    setJobs((list) => list.filter((j) => j.id !== id));
  }, []);

  return { jobs, error, start, dismiss, refresh };
}
