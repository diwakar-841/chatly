import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Spinner = ({ className }: { className?: string }) => {
  return <Loader2 className={cn("animate-spin text-accent", className)} size={20} />;
};

export const FullScreenLoader = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <Spinner className="w-8 h-8" />
    </div>
  );
};
