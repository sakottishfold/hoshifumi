"use client";

// ADR-012 AI follow-up question UI。
// QuestionFlow から Q2 完了後に render される。
// AI を await して質問取得 → user 回答入力 → onComplete で QuestionFlow に通知。
// 失敗時は onComplete(null, null) で silent skip 通知。

import { useEffect, useState } from "react";
import { generateFollowUpQuestion } from "@/lib/server-actions/ai-followup";

interface Props {
  bodySensationLabel: string;
  freeText: string;
  /** AI 完了 or skip 通知。aiQuestion=null = silent skip */
  onComplete: (aiQuestion: string | null, aiAnswer: string | null) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "answering"; question: string }
  | { kind: "skipped" };

export function AIQuestionStep({ bodySensationLabel, freeText, onComplete }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await generateFollowUpQuestion({ bodySensationLabel, freeText });
      if (cancelled) return;
      if ("error" in result) {
        setState({ kind: "skipped" });
        // 即時 silent skip 通知(skip 時は AI 質問なしで Q3 へ)
        onComplete(null, null);
      } else {
        setState({ kind: "answering", question: result.question });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bodySensationLabel, freeText, onComplete]);

  if (state.kind === "loading") {
    return (
      <div className="space-y-6 pt-4">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-12 h-12 rounded-full bg-primary-500/30 animate-pulse" />
          <p className="text-sm text-neutral-500">ひと呼吸…</p>
        </div>
      </div>
    );
  }

  // state.kind === "skipped" の場合は onComplete で QuestionFlow が次 step に進む、
  // 本 component は unmount される。fallback render として何も出さない。
  if (state.kind === "skipped") {
    return null;
  }

  // state.kind === "answering"
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    if (state.kind === "answering") {
      onComplete(state.question, answer.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6 space-y-2">
        <p className="text-xs font-medium text-primary-700">AI からの問い</p>
        <p className="text-base text-neutral-800 leading-relaxed">
          {state.question}
        </p>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        placeholder="思ったままを書く"
        className="w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
      />

      <button
        type="submit"
        disabled={!answer.trim() || submitting}
        className="w-full rounded-xl bg-primary-500 px-4 py-3.5 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        つぎへ
      </button>
    </form>
  );
}
