import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline spinning loader icon; accent-coloured by default. */
export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn("animate-spin text-accent", className)} size={20} />
);

/** Full-screen centred spinner used during initial auth bootstrapping. */
export const FullScreenLoader = () => (
  <div className="flex items-center justify-center h-screen bg-bg">
    <Spinner className="w-8 h-8" />
  </div>
);
