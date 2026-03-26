/** Nối class Tailwind, bỏ qua giá trị falsy. */
export function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}
