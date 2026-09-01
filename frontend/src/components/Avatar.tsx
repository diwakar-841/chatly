import { initials, cn } from "@/lib/utils";

interface Props {
  src?: string;
  name?: string;
  size?: number;
  online?: boolean;
  className?: string;
}


export function Avatar({ src, name, size = 44, online, className }: Props) {
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full w-full h-full bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center text-white font-semibold"
          style={{ fontSize: size * 0.4 }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-accent border-2 border-bg-elevated rounded-full" />
      )}
    </div>
  );
}
