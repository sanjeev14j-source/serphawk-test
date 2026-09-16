"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Star, CheckCircle } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";

export default function SurveyPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score === null) return;
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/nps/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, feedback }),
    });
    setDone(true);
    setSubmitting(false);
  }

  const getLabel = (s: number) =>
    s <= 6 ? "😞 Needs Improvement" : s <= 8 ? "😊 Good" : "🤩 Excellent!";

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Thank you!</h1>
          <p className="text-gray-500">Your feedback helps us improve our services.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg">
        <h1 className="text-2xl font-black text-gray-900 mb-2">How are we doing?</h1>
        <p className="text-gray-500 mb-8">
          On a scale of 0–10, how likely are you to recommend SerpHawk to a friend or colleague?
        </p>

        <form onSubmit={submit} className="space-y-6">
          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={cn(
                  "w-10 h-10 rounded-xl font-black text-sm border-2 transition-all",
                  score === i
                    ? i <= 6 ? "bg-red-500 text-white border-red-500"
                      : i <= 8 ? "bg-amber-500 text-white border-amber-500"
                      : "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                )}
              >{i}</button>
            ))}
          </div>

          {score !== null && (
            <p className="text-center text-sm font-semibold text-gray-600">{getLabel(score)}</p>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
              What's the main reason for your score?
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Your feedback (optional)..."
            />
          </div>

          <button
            type="submit"
            disabled={score === null || submitting}
            className="w-full py-3 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
