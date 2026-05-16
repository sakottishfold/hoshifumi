export type InputType =
  | "mood_5"
  | "scale_5"
  | "rating_4"
  | "short_choice"
  | "free_text";

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

export interface Template {
  name: string;
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
  question_position: 1 | 2 | 3;
  value_number: number | null;
  value_text: string | null;
  value_choice: string | null;
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
}
