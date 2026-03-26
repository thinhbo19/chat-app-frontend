/** Hiển thị phụ đề dưới tên chat 1-1: online hoặc offline bao lâu. */
export function formatChatHeaderPresence(
  status: "online" | "offline" | undefined,
  lastSeenAt: string | undefined,
): string {
  if (status === "online") {
    return "Đang hoạt động";
  }
  if (!lastSeenAt) {
    return "Ngoại tuyến";
  }
  const ms = Date.now() - new Date(lastSeenAt).getTime();
  if (ms < 0) return "Ngoại tuyến";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Ngoại tuyến (vừa xong)";
  if (minutes < 60) {
    return `Ngoại tuyến ${minutes} phút trước`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `Ngoại tuyến ${hours} giờ trước`;
  }
  const days = Math.floor(hours / 24);
  return `Ngoại tuyến ${days} ngày trước`;
}
