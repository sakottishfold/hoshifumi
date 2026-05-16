"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FreeTextInput({ value, onChange, placeholder }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={5}
      className="w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
    />
  );
}
