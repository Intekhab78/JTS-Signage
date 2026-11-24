const MEDIA_CACHE_NAME = "vms-media-cache-v1";
const PLAYLIST_STORAGE_PREFIX = "vms_offline_playlist_";

export const cachePlaylistMedia = async (urls = []) => {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    await Promise.all(
      urls
        .filter(Boolean)
        .map(async (url) => {
          try {
            const existing = await cache.match(url);
            if (!existing) {
              const res = await fetch(url, { mode: "cors" });
              if (res.ok && res.status === 200) {
                await cache.put(url, res);
              }
            }
          } catch {
            // Skip individual uncacheable items safely
          }
        })
    );
  } catch {
    // Ignore CacheStorage unavailability
  }
};

export const getCachedMediaUrl = async (url) => {
  if (!url) return { url: "", isObjectUrl: false };
  if (typeof window === "undefined" || !("caches" in window)) {
    return { url, isObjectUrl: false };
  }

  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      return { url: URL.createObjectURL(blob), isObjectUrl: true };
    }
  } catch {
    // Fallback to direct URL
  }

  return { url, isObjectUrl: false };
};

export const saveOfflinePlaylist = (token, data) => {
  if (!token) return;
  try {
    localStorage.setItem(
      `${PLAYLIST_STORAGE_PREFIX}${token}`,
      JSON.stringify({ ...data, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage quota errors
  }
};

export const loadOfflinePlaylist = (token) => {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(`${PLAYLIST_STORAGE_PREFIX}${token}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearMediaCache = async (token) => {
  if (token) {
    try {
      localStorage.removeItem(`${PLAYLIST_STORAGE_PREFIX}${token}`);
    } catch {
      // Ignore
    }
  }
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      await window.caches.delete(MEDIA_CACHE_NAME);
    } catch {
      // Ignore
    }
  }
};
