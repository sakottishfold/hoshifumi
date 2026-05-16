"use client";

import type { MoodOption } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { MoonPhase } from "@/components/MoonPhase";

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  options: MoodOption[];
}

export function MoodInput({ value, onChange, options }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition active:scale-95",
            value === opt.value
              ? "border-primary-500 bg-primary-50"
              : "border-neutral-200 bg-neutral-50 hover:border-neutral-300",
          )}
        >
          <MoonPhase phase={opt.value} className="w-10 h-10" />
          <span className="text-[10px] mt-1 text-neutral-600 leading-tight">
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
