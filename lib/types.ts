export type InputType =
  | "mood_5"
  | "scale_5"
  | "rating_4"
  | "short_choice"
  | "free_text"
  | "chip_with_text"; // ADR-023: Q3 hybrid chip + text escape

// Generic 5-tap option (originally for mood, now also used for body sensation per ADR-013).
// Kept under the MoodOption name for backward compat with widget naming (MoodInput).
export interface MoodOption {
  value: number;
  emoji: string;
  label: string;
}

export interface Question {
  position: 1 | 2 | 3;
  text: string;
  input_type: InputType;
  placeholder?: string;
  options?: MoodOption[] | string[];
}

export type TemplateName =
  | "basic"
  | "work"
  | "parenting"
  | "making"
  | "gratitude";

export interface Template {
  name: TemplateName;
  /** UI 表示名(内部 name と分離)*/
  displayName: string;
  emoji: string;
  description: string;
  questions: Question[];
}

export interface Entry {
  id: string;
  user_id: string;
  entry_date: string;
  template_name: string;
  completed_at: string | null;
  created_at: string;
}

export interface Answer {
  id: string;
  entry_id: string;
  /** 1=body sensation, 2=event free text, 3=tomorrow message, 4-6=ADR-024 AI follow-up 対話ターン */
  question_position: 1 | 2 | 3 | 4 | 5 | 6;
  value_number: number | null;
  value_text: string | null;
  value_choice: string | null;
  /** ADR-012/024: AI 生成質問本文(question_position>=4 のときのみ非 null) */
  question_text: string | null;
}

/** ADR-024: AI follow-up 対話の1往復(問い + ユーザー回答)。 */
export interface FollowUpTurn {
  question: string;
  answer: string;
}

export interface EntryWithAnswers extends Entry {
  answers: Answer[];
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  notification_time: string;
  notification_enabled: boolean;
  timezone: string;
  plan: "free" | "pro" | "premium";
  streak_days: number;
  longest_streak: number;
  last_entry_at: string | null;
  /** ADR-025: ユーザーが選んだ日記テンプレ。NULL = onboarding 未完了。 */
  template_name: string | null;
}
