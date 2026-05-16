"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EntryWithAnswers, MoodOption } from "@/lib/types";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { MoonPhase } from "@/components/MoonPhase";
import { cn } from "@/lib/utils/cn";

interface Props {
  year: number;
  month: number;
  entries: EntryWithAnswers[];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function CalendarGrid({ year, month, entries }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // 月の初日と末日
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay(); // 0=日曜
  const daysInMonth = lastDay.getDate();

  // エントリをdate→body sensation optionにマップ (Q1 = 体の感じ per ADR-013)
  const bodyByDate = new Map<string, MoodOption>();
  for (const entry of entries) {
    const bodyAnswer = entry.answers?.find((a) => a.question_position === 1);
    if (bodyAnswer?.value_number) {
      const body = BODY_SENSATION_OPTIONS.find(
        (m) => m.value === bodyAnswer.value_number,
      );
      if (body) bodyByDate.set(entry.entry_date, body);
    }
  }

  // グリッド配列を構築
  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, day: d });
  }
  // 末尾を6×7=42までは詰めない、最後の週まででOK

  function navMonth(delta: number) {
    let newYear = year;
    let newMonth = month + delta;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    const params = new URLSearchParams(searchParams);
    params.set("y", String(newYear));
    params.set("m", String(newMonth));
    router.push(`/calendar?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navMonth(-1)}
          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
          aria-label="前の月"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-neutral-900">
          {year}年{month}月
        </h2>
        <button
          onClick={() => navMonth(1)}
          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
          aria-label="次の月"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className={cn(
              "text-xs py-1 font-medium",
              i === 0 && "text-red-500",
              i === 6 && "text-blue-500",
              i !== 0 && i !== 6 && "text-neutral-500",
            )}
          >
            {wd}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} />;
          }
          const body = bodyByDate.get(cell.date);
          const isToday = cell.date === todayStr;
          const isFuture = cell.date > todayStr;
          const weekday = idx % 7;

          return (
            <Link
              key={cell.date}
              href={isFuture ? "#" : `/calendar/${cell.date}`}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center transition relative",
                isFuture
                  ? "text-neutral-300 cursor-not-allowed"
                  : "hover:bg-neutral-100 cursor-pointer",
                isToday && !body && "bg-primary-50 text-primary-700 font-bold",
                body && "bg-primary-50",
              )}
              onClick={(e) => {
                if (isFuture) e.preventDefault();
              }}
            >
              <span
                className={cn(
                  "text-xs",
                  weekday === 0 && !isFuture && "text-red-500",
                  weekday === 6 && !isFuture && "text-blue-500",
                )}
              >
                {cell.day}
              </span>
              {body && (
                <MoonPhase phase={body.value} className="w-3.5 h-3.5 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-neutral-500 text-center pt-4">
        日付をタップで詳細表示
      </p>
    </div>
  );
}
