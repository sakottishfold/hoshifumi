"use client";

// ADR-023 Q3 hybrid chip + text escape UI。
// default = chip grid + 「自由に書く」link、escape mode = textarea + 「← chip に戻る」link。
// state は親(QuestionFlow)で集約、本 component は presentation + event 通知のみ。

interface Props {
  chips: string[];
  /** chip 選択時の current value、未選択は null */
  selectedChip: string | null;
  /** text escape mode の current value */
  textValue: string;
  /** "chip" | "text" のどちらが active か */
  mode: "chip" | "text";
  onChipSelect: (chip: string) => void;
  onTextChange: (text: string) => void;
  onModeToggle: (mode: "chip" | "text") => void;
}

export function ChipWithTextEscape({
  chips,
  selectedChip,
  textValue,
  mode,
  onChipSelect,
  onTextChange,
  onModeToggle,
}: Props) {
  if (mode === "text") {
    return (
      <div className="space-y-4">
        <textarea
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          rows={3}
          placeholder="思ったままに"
          className="w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
        />
        <button
          type="button"
          onClick={() => onModeToggle("chip")}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← chip に戻る
        </button>
      </div>
    );
  }

  // mode === "chip"
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {chips.map((chip) => {
          const isSelected = selectedChip === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onChipSelect(chip)}
              className={
                isSelected
                  ? "rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm transition active:scale-[0.99]"
                  : "rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-100 transition active:scale-[0.99]"
              }
            >
              {chip}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onModeToggle("text")}
        className="text-sm text-neutral-500 hover:text-neutral-700"
      >
        自由に書く
      </button>
    </div>
  );
}
