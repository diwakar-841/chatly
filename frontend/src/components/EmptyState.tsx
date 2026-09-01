import type { LucideIcon } from "lucide-react";


export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 text-muted">
      <div className="w-16 h-16 rounded-full bg-bg-panel flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-white font-medium mb-1">{title}</h3>
      {description && <p className="text-sm max-w-xs">{description}</p>}
    </div>
  );
}
