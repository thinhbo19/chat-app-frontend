const HEX24 = /^[0-9a-fA-F]{24}$/;

/** So sánh hai ObjectId dạng chuỗi hex 24 ký tự (thứ tự ~ thời gian tạo). */
export function compareObjectIdStrings(a: string, b: string): number {
  if (a === b) return 0;
  if (HEX24.test(a) && HEX24.test(b)) {
    return a < b ? -1 : 1;
  }
  return a.localeCompare(b);
}

/** Người đọc đã xem tới ít nhất tin `messageId` nếu mốc đọc >= messageId. */
export function hasReadThrough(lastReadMessageId: string | null | undefined, messageId: string): boolean {
  if (!lastReadMessageId) return false;
  return compareObjectIdStrings(lastReadMessageId, messageId) >= 0;
}
