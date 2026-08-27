"use client";

import { useState } from "react";

interface Props {
  apiKey: string;
  onApiKey: (key: string) => void;
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
  apiKey,
  onApiKey,
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
  const [showKey, setShowKey] = useState(false);

  return (
    <section className="border-b border-zinc-800 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Generar personaje con IA
      </h2>

      <label className="mb-1 block text-[11px] text-zinc-500">
        API key de Gemini (solo se guarda en memoria)
      </label>
      <div className="mb-3 flex gap-1">
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onApiKey(e.target.value)}
          placeholder="AIza…"
          autoComplete="off"
          spellCheck={false}
          className="h-8 w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          title={showKey ? "Ocultar key" : "Mostrar key"}
          className="h-8 shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-400 hover:bg-zinc-700"
        >
          {showKey ? "🙈" : "👁"}
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
        }}
        rows={3}
        placeholder='Ej: "robot samurái azul con capa roja"'
        className="mb-2 w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500"
      />

      <button
        type="button"
        onClick={onGenerate}
        disabled={loading || !apiKey.trim() || !prompt.trim()}
        className="flex h-8 w-full items-center justify-center gap-2 rounded bg-indigo-600 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Generando…
          </>
        ) : (
          "✨ Generar personaje"
        )}
      </button>

      <button
        type="button"
        onClick={onRegenerateLook}
        disabled={!canRegenerate || regenLoading || !apiKey.trim()}
        className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded border border-indigo-700/60 bg-indigo-950/40 text-xs font-medium text-indigo-300 transition hover:bg-indigo-900/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {regenLoading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
            Regenerando look…
          </>
        ) : (
          "🎨 Regenerar look del seleccionado"
        )}
      </button>

      {!apiKey.trim() && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-500/90">
          Necesitas una API key de Google AI Studio para generar personajes.
          Se guarda solo en memoria durante esta sesión.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded border border-red-900/60 bg-red-950/40 px-2 py-1.5 text-[11px] leading-relaxed text-red-300">
          ⚠️ {error}
        </p>
      )}

      {lastModel && !error && (
        <p className="mt-2 text-[10px] text-zinc-600">
          Última respuesta con {lastModel}
        </p>
      )}
    </section>
  );
}
