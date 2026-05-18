"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BASIC_TEMPLATE, BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { submitEntry } from "@/lib/server-actions/entries";
import { todayJST } from "@/lib/utils/date";
import { MoodInput } from "./MoodInput";
import { FreeTextInput } from "./FreeTextInput";
import { ProgressDots } from "./ProgressDots";
import { MoonPhase } from "@/components/MoonPhase";
import { AIQuestionStep } from "./AIQuestionStep";
import type { MoodOption, EntryWithAnswers } from "@/lib/types";

interface Props {
  initialEntry: EntryWithAnswers | null;
  date: string;
  displayDate: string;
}

export function QuestionFlow({ initialEntry, date, displayDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [bodySensation, setBodySensation] = useState<number | null>(
    initialEntry?.answers?.find((a) => a.question_position === 1)
      ?.value_number ?? null,
  );
  const [freeText, setFreeText] = useState<string>(
    initialEntry?.answers?.find((a) => a.question_position === 2)
      ?.value_text ?? "",
  );
  // ADR-014: Q3 now stored in value_text; fall back to value_choice for entries written under v0.
  const initialQ3 = initialEntry?.answers?.find((a) => a.question_position === 3);
  const [tomorrowMessage, setTomorrowMessage] = useState<string>(
    initialQ3?.value_text ?? initialQ3?.value_choice ?? "",
  );

  // ADR-012 AI follow-up:Q2 完了後に AI step に入る、完了 or skip で Q3 へ
  type AIStatus = "pending" | "active" | "done" | "skipped";
  const initialAiStatus: AIStatus =
    initialEntry?.answers?.some((a) => a.question_position === 4)
      ? "done"
      : "pending";
  const [aiStatus, setAiStatus] = useState<AIStatus>(initialAiStatus);
  const [aiQuestion, setAiQuestion] = useState<string | null>(
    initialEntry?.answers?.find((a) => a.question_position === 4)
      ?.question_text ?? null,
  );
  const [aiAnswer, setAiAnswer] = useState<string>(
    initialEntry?.answers?.find((a) => a.question_position === 4)
      ?.value_text ?? "",
  );

  const questions = BASIC_TEMPLATE.questions;
  const isComplete = step >= questions.length;

  function next() {
    // Q2 (step=1) 完了時、AI step が未到達なら AI に切替
    if (step === 1 && aiStatus === "pending") {
      setAiStatus("active");
      return;
    }
    // それ以外は通常通り次 step
    if (step < questions.length) {
      setStep(step + 1);
    }
  }

  // ADR-012:AI step の完了 callback。inline arrow だと AIQuestionStep の useEffect が
  // 毎 render で re-fetch するので useCallback で stable identity に。
  const handleAIComplete = useCallback((question: string | null, answer: string | null) => {
    setAiQuestion(question);
    setAiAnswer(answer ?? "");
    setAiStatus(question === null ? "skipped" : "done");
    setStep(2); // Q3 へ
  }, []);

  function back() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  function handleSubmit() {
    if (bodySensation === null || !freeText.trim() || !tomorrowMessage.trim()) return;

    startTransition(async () => {
      const result = await submitEntry({
        date,
        bodySensation,
        freeText: freeText.trim(),
        tomorrowMessage: tomorrowMessage.trim(),
        aiQuestion: aiQuestion ?? undefined,
        aiAnswer: aiAnswer.trim() ? aiAnswer.trim() : undefined,
      });
      if (result.success) {
        // issue #001: 今日 submit は /today/done で bloom ceremony、
        // 過去 submit は /calendar/[date] で quiet 確認に分岐(spec §3.3)
        const target =
          date === todayJST()
            ? `/today/done?streak=${result.streak.streak_days}&phase=${result.bodyPhase}&total=${result.totalEntries}`
            : `/calendar/${date}`;
        router.push(target);
      }
    });
  }

  // 各stepの入力可否判定
  const canAdvance = (() => {
    if (step === 0) return bodySensation !== null;
    if (step === 1) return freeText.trim().length > 0;
    if (step === 2) return tomorrowMessage.trim().length > 0;
    return false;
  })();

  if (isComplete) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6 space-y-4">
          <h2 className="font-medium text-neutral-900">{displayDate}のほしふみ</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 w-16">体</span>
              {bodySensation !== null && (
                <MoonPhase phase={bodySensation} className="w-7 h-7" />
              )}
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-500 w-16">できごと</span>
              <span className="text-neutral-800 flex-1 leading-relaxed">
                {freeText}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 w-16">明日へ</span>
              <span className="text-neutral-800">{tomorrowMessage}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep(0)}
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            修正する
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="flex-1 rounded-xl bg-primary-500 px-4 py-3 text-sm font-medium text-neutral-50 shadow-sm hover:bg-primary-600 disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>
    );
  }

  const q = questions[step];

  // AI step が active のとき、Q1/Q2/Q3 ではなく AIQuestionStep を render
  if (aiStatus === "active") {
    const bodyLabel =
      BODY_SENSATION_OPTIONS.find((o) => o.value === bodySensation)?.label ??
      "";
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={back}
            className="text-neutral-500 disabled:invisible flex items-center gap-1"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <ProgressDots current={2} total={questions.length + 1} />
          <div className="w-5" />
        </div>

        <AIQuestionStep
          bodySensationLabel={bodyLabel}
          freeText={freeText.trim()}
          onComplete={handleAIComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="text-neutral-500 disabled:invisible flex items-center gap-1"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <ProgressDots current={step} total={questions.length} />
        <div className="w-5" />
      </div>

      <div className="space-y-6 pt-4">
        <div className="space-y-2">
          {step === 2 && aiStatus === "skipped" && (
            <p className="text-xs text-neutral-500">今夜は静かに進みます</p>
          )}
          <p className="text-sm text-neutral-500">{step + 1}つめ</p>
          <h2 className="text-xl font-medium text-neutral-900 leading-relaxed">
            {q.text}
          </h2>
        </div>

        <div className="pt-2">
          {q.input_type === "mood_5" && (
            <MoodInput
              value={bodySensation}
              onChange={setBodySensation}
              options={q.options as MoodOption[]}
            />
          )}
          {q.input_type === "free_text" && step === 1 && (
            <FreeTextInput
              value={freeText}
              onChange={setFreeText}
              placeholder={q.placeholder}
            />
          )}
          {q.input_type === "free_text" && step === 2 && (
            <FreeTextInput
              value={tomorrowMessage}
              onChange={setTomorrowMessage}
              placeholder={q.placeholder}
            />
          )}
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={next}
          disabled={!canAdvance}
          className="w-full rounded-xl bg-primary-500 px-4 py-3.5 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step < questions.length - 1 ? "つぎへ" : "確認する"}
        </button>
      </div>
    </div>
  );
}
