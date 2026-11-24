const MEDIA_CACHE = "vms-media-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_MEDIA_CACHE") {
    event.waitUntil(caches.delete(MEDIA_CACHE));
  }
});

const buildPartialResponse = async (cached, rangeHeader) => {
  const blob = await cached.blob();
  if (!blob.size) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  let start = 0;
  let end = blob.size - 1;

  if (match) {
    if (match[1] === "" && match[2] !== "") {
      const suffix = parseInt(match[2], 10);
      start = Math.max(0, blob.size - suffix);
    } else {
      if (match[1] !== "") start = parseInt(match[1], 10);
      if (match[2] !== "") end = parseInt(match[2], 10);
    }
  }

  start = Math.max(0, Math.min(start, blob.size - 1));
  end = Math.max(start, Math.min(end, blob.size - 1));
  const sliced = blob.slice(start, end + 1);

  return new Response(sliced, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(sliced.size),
      "Content-Type": cached.headers.get("Content-Type") || "video/mp4",
    },
  });
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/uploads/")) return;

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(request.url);
        if (cached) {
          const partial = await buildPartialResponse(cached, rangeHeader);
          if (partial) return partial;
        }
        return fetch(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.open(MEDIA_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })
  );
});
