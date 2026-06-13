import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

/** Merges Tailwind class names, resolving conflicts via clsx. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Formats an ISO timestamp as HH:mm (24-hour clock). */
export const formatTime = (iso?: string) => {
  if (!iso) return "";
  return format(new Date(iso), "HH:mm");
};

/**
 * Returns a compact human-readable time for chat previews:
 * today → HH:mm, yesterday → "Yesterday", older → dd/MM/yy.
 */
export const formatChatTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yy");
};

/** Returns a relative time string such as "3 minutes ago". */
export const formatRelative = (iso?: string) => {
  if (!iso) return "";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
};

/** Returns up to two uppercase initials from a display name, or "?" if none. */
export const initials = (name?: string) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};
