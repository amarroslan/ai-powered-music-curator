import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerRow } from "../components/AnswerRow";
import { useQuiz } from "../hooks/useQuiz";

export default function QuizPage() {
  const quiz = useQuiz();
  const { phase, question, questionCount, error } = quiz;

  useEffect(() => {
    if (phase === "starting") void quiz.begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative flex min-h-full flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 size-[24rem] rounded-full bg-electric-violet/30 blur-[120px]"
      />

      <header className="relative z-10 px-6 pt-5 sm:px-10">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <span className="text-sm font-black tracking-tight">
            vibe<span className="text-neon-pink">check</span>
          </span>
          <span className="text-xs font-bold tracking-widest text-white/50 uppercase">
            Q{questionCount} / 20+
          </span>
        </div>
        <div className="mx-auto mt-3 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-neon-pink to-cyan-pop"
            animate={{ width: `${Math.min((questionCount / 20) * 100, 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        {phase === "starting" && (
          <p className="text-center text-lg font-bold text-white/60 animate-pulse">
            Tuning the first question…
          </p>
        )}

        {phase === "error" && (
          <div className="text-center">
            <p className="text-2xl font-black text-neon-pink">Record scratch.</p>
            <p className="mt-2 text-white/70">{error}</p>
            <button
              onClick={quiz.retry}
              className="mt-6 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold"
            >
              Run it back
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {question && (phase === "asking" || phase === "submitting") && (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-8"
            >
              <h1 className="text-3xl font-black leading-tight sm:text-4xl">
                {question.text}
              </h1>
              <AnswerRow
                question={question}
                disabled={phase === "submitting"}
                onAnswer={(answer) => void quiz.answer(answer)}
              />
              {phase === "submitting" && (
                <p className="animate-pulse text-sm font-bold text-white/50">
                  Reading your soul…
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
