/** URL đầy đủ cho media lưu kiểu `/uploads/...` khi API chạy khác origin với frontend. */
export function resolveMediaUrl(mediaUrl: string, apiBase: string): string {
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    return mediaUrl;
  }
  const base = apiBase.replace(/\/+$/, "");
  const path = mediaUrl.startsWith("/") ? mediaUrl : `/${mediaUrl}`;
  return `${base}${path}`;
}
