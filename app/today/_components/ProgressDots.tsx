import { cn } from "@/lib/utils/cn";

interface Props {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i < current
              ? "bg-primary-500 w-6"
              : i === current
                ? "bg-primary-500 w-6"
                : "bg-neutral-200 w-6",
          )}
        />
      ))}
    </div>
  );
}
