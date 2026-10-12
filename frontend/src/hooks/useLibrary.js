import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export function useLibrary() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setTracks(await api.listTracks());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (id, patch) => {
    const updated = await api.updateTrack(id, patch);
    setTracks((list) => list.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await api.deleteTrack(id);
    setTracks((list) => list.filter((t) => t.id !== id));
  }, []);

  return { tracks, loading, error, refresh, update, remove };
}
