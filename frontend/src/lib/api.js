// All backend calls go through /api, which the dev server (or a reverse proxy) forwards to FastAPI.
const BASE = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* body was not JSON */
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  search: (query, limit = 12) =>
    request(`/search?q=${encodeURIComponent(query)}&limit=${limit}`).then((d) => d.results),
  listTracks: () => request("/library").then((d) => d.tracks),
  updateTrack: (id, body) => request(`/library/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTrack: (id) => request(`/library/${id}`, { method: "DELETE" }),
  listDownloads: () => request("/downloads").then((d) => d.jobs),
  startDownload: (video) => request("/downloads", { method: "POST", body: JSON.stringify(video) }),
  dismissDownload: (id) => request(`/downloads/${id}`, { method: "DELETE" }),
};

export const streamUrl = (track) => `${BASE}${track.audio_url}`;
export const coverUrl = (track) => (track.cover_url ? `${BASE}${track.cover_url}` : track.fallback_cover_url || null);
