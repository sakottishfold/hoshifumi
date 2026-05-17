"use client";

import { useState } from "react";
import { sendMagicLink, signInWithGoogle } from "@/lib/server-actions/auth";

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

  async function handleGoogle() {
    setStatus("sending");
    const result = await signInWithGoogle();
    // Success branch never returns (redirect() throws NEXT_REDIRECT and the browser navigates)
    if (result?.error) {
      setStatus("error");
      setErrorMessage(result.error);
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
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={status === "sending"}
              className="w-full rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <GoogleG />
              {status === "sending" ? "Google に転送中…" : "Google でログイン"}
            </button>

            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <div className="flex-1 border-t border-neutral-200" />
              <span>または</span>
              <div className="flex-1 border-t border-neutral-200" />
            </div>

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
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "送信中…" : "メールでログインリンクを送る"}
              </button>

              {status === "error" && (
                <p className="text-sm text-red-600 text-center">{errorMessage}</p>
              )}
            </form>

            <p className="text-xs text-neutral-500 text-center">
              はじめてでも、いつもの自分でも。
              <br />
              パスワード不要。
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg
      className="w-5 h-5 bg-neutral-50 rounded-full p-0.5"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
