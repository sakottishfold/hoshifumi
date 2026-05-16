"use client";

import { useState } from "react";
import { sendMagicLink } from "@/lib/server-actions/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const formData = new FormData();
    formData.set("email", email);
    const result = await sendMagicLink(formData);
    if (result.error) {
      setStatus("error");
      setErrorMessage(result.error);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <img src="/icon-mark.svg" alt="" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-neutral-900">ほしふみ</h1>
          <p className="text-sm text-neutral-600">
            寝る前の5分、自分を見つめ直す
          </p>
        </div>

        {status === "sent" ? (
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center space-y-2">
            <p className="font-medium text-neutral-900">メールを送りました</p>
            <p className="text-sm text-neutral-600">
              {email} 宛のリンクから
              <br />
              ログインしてください
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="text-sm font-medium text-neutral-700"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending" || !email}
              className="w-full rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "sending" ? "送信中…" : "ログインリンクを送る"}
            </button>

            {status === "error" && (
              <p className="text-sm text-red-600 text-center">{errorMessage}</p>
            )}

            <p className="text-xs text-neutral-500 text-center mt-6">
              アカウント作成も同じフォームから。
              <br />
              パスワードは不要です。
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
