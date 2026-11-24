import { SOCKET_BASE_URL } from "../config";

export const getMediaUrl = (videoPath) => {
  if (!videoPath) return "";
  if (/^https?:\/\//i.test(videoPath)) return videoPath;
  return `${SOCKET_BASE_URL}${videoPath.startsWith("/") ? "" : "/"}${videoPath}`;
};
