import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";


export const cn = (...inputs: ClassValue[]) => {
  return clsx(inputs);
};


export const formatTime = (iso?: string) => {
  if (!iso) {
    return "";
  }
  return format(new Date(iso), "HH:mm");
};


export const formatChatTime = (iso?: string) => {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (isToday(d)) {
    return format(d, "HH:mm");
  }
  if (isYesterday(d)) {
    return "Yesterday";
  }
  return format(d, "dd/MM/yy");
};


export const formatRelative = (iso?: string) => {
  if (!iso) {
    return "";
  }
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
};


export const initials = (name?: string) => {
  if (!name) {
    return "?";
  }
  return name
    .split(" ")
    .map(p => {
      return p[0];
    })
    .slice(0, 2)
    .join("")
    .toUpperCase();
};
