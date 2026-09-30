import type { Answer, Question } from "@curator/shared";

interface AnswerRowProps {
  question: Question;
  disabled: boolean;
  onAnswer: (answer: Answer) => void;
}

function chipClasses(selected: boolean): string {
  return [
    "group flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left text-base font-bold transition-all",
    selected
      ? "border-neon-pink bg-gradient-to-r from-neon-pink/20 to-electric-violet/20 text-white"
      : "border-white/15 bg-white/5 text-white/90 hover:border-neon-pink/60 hover:bg-white/10",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");
}

/** The answer area for whichever question type is on screen. */
export function AnswerRow({ question, disabled, onAnswer }: AnswerRowProps) {
  if (question.type === "single_choice" || question.type === "multi_choice") {
    const options = question.options ?? [];
    return (
      <div className="grid w-full gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            className={chipClasses(false)}
            onClick={() =>
              onAnswer(
                question.type === "single_choice"
                  ? { type: "single_choice", questionId: question.id, optionId: opt.id }
                  : { type: "multi_choice", questionId: question.id, optionIds: [opt.id] },
              )
            }
          >
            <span className="text-2xl" aria-hidden>
              {opt.emoji ?? "🎵"}
            </span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "scale") {
    const scale = question.scale ?? { min: 1, max: 10, minLabel: "?", maxLabel: "?" };
    const values = Array.from(
      { length: scale.max - scale.min + 1 },
      (_, i) => scale.min + i,
    );
    return (
      <div className="w-full">
        <div className="grid grid-cols-10 gap-1.5">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              className="aspect-square rounded-xl border border-white/15 bg-white/5 text-sm font-black text-white/90 transition-all hover:scale-110 hover:border-neon-pink hover:bg-neon-pink/20 disabled:opacity-60"
              onClick={() =>
                onAnswer({ type: "scale", questionId: question.id, value: v })
              }
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs font-semibold tracking-wide text-white/50 uppercase">
          <span>{scale.minLabel}</span>
          <span>{scale.maxLabel}</span>
        </div>
      </div>
    );
  }

  // free_text
  return (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("answer");
        if (input instanceof HTMLTextAreaElement && input.value.trim()) {
          onAnswer({
            type: "free_text",
            questionId: question.id,
            text: input.value.trim(),
          });
        }
      }}
    >
      <textarea
        name="answer"
        rows={3}
        maxLength={500}
        placeholder={question.placeholder ?? "Type away…"}
        className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-base text-white placeholder:text-white/35 focus:border-neon-pink focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled}
        className="self-end rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold text-white disabled:opacity-60"
      >
        Send it →
      </button>
    </form>
  );
}
