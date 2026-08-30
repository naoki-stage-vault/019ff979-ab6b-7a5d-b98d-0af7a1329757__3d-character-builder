"use client";

import { useState } from "react";

interface Props {
  prompt: string;
  onPrompt: (p: string) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerateLook: () => void;
  canRegenerate: boolean;
  regenLoading: boolean;
  lastModel: string | null;
}

export default function GeneratorPanel({
  prompt,
  onPrompt,
  loading,
  error,
  onGenerate,
  onRegenerateLook,
  canRegenerate,
  regenLoading,
  lastModel,
}: Props) {
  return (
    <section className="border-b border-zinc-200 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Generate character with AI
      </h2>

      <textarea
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
        }}
        rows={3}
        placeholder='e.g. "blue samurai robot with a red cape"'
        className="mb-2 w-full resize-none rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-500"
      />

      <button
        type="button"
        onClick={onGenerate}
        disabled={loading || !prompt.trim()}
        className="flex h-8 w-full items-center justify-center gap-2 rounded bg-indigo-600 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Generating…
          </>
        ) : (
          "✨ Generate character"
        )}
      </button>

      <button
        type="button"
        onClick={onRegenerateLook}
        disabled={!canRegenerate || regenLoading}
        className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded border border-indigo-300 bg-indigo-50 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {regenLoading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-700" />
            Regenerating look…
          </>
        ) : (
          "🎨 Regenerate look of selected"
        )}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        The Gemini API key is managed by the server (environment variable{" "}
        <code className="rounded bg-zinc-100 px-1 text-zinc-600">GEMINI_KEY</code>);
        it never reaches the browser.
      </p>

      {error && (
        <p className="mt-2 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] leading-relaxed text-red-700">
          ⚠️ {error}
        </p>
      )}

      {lastModel && !error && (
        <p className="mt-2 text-[10px] text-zinc-500">
          Last response with {lastModel}
        </p>
      )}
    </section>
  );
}
