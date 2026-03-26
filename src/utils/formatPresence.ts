/** Hien thi phu de duoi ten chat 1-1: online hoac offline bao lau. */
export function formatChatHeaderPresence(
  status: "online" | "offline" | undefined,
  lastSeenAt: string | undefined,
): string {
  if (status === "online") {
    return "Online";
  }
  if (!lastSeenAt) {
    return "Offline";
  }
  const ms = Date.now() - new Date(lastSeenAt).getTime();
  if (ms < 0) return "Offline";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Offline (vua moi)";
  if (minutes < 60) {
    return `Offline ${minutes} phut truoc`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `Offline ${hours} gio truoc`;
  }
  const days = Math.floor(hours / 24);
  return `Offline ${days} ngay truoc`;
}
