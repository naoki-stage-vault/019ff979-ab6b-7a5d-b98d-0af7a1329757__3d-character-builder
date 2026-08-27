"use client";

import type { GizmoMode } from "@/lib/types";
import { MODE_LABELS } from "@/lib/types";

interface Props {
  mode: GizmoMode;
  onMode: (mode: GizmoMode) => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  status: string | null;
  snapHint: boolean;
}

const KEYS: Record<GizmoMode, string> = { translate: "W", rotate: "E", scale: "R" };

export default function Toolbar({ mode, onMode, onSave, onLoad, onExport, status, snapHint }: Props) {
  const modes: GizmoMode[] = ["translate", "rotate", "scale"];
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🧊</span>
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          Editor 3D de Personajes
        </h1>
      </div>

      <div className="mx-2 h-6 w-px bg-zinc-800" />

      <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            title={`${MODE_LABELS[m]} (${KEYS[m]})`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
              mode === m
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {MODE_LABELS[m]}
            <kbd
              className={`rounded px-1 text-[9px] font-semibold ${
                mode === m ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {KEYS[m]}
            </kbd>
          </button>
        ))}
      </div>

      <span
        className={`hidden items-center gap-1 text-[10px] sm:flex ${
          snapHint ? "text-indigo-300" : "text-zinc-600"
        }`}
        title="Mantén Shift mientras arrastras para snapping"
      >
        ⇧ Shift = snap {snapHint ? "activo" : ""}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {status && (
          <span className="mr-1 hidden text-[11px] text-emerald-400 md:inline">{status}</span>
        )}
        <button
          type="button"
          onClick={onSave}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
        >
          💾 Guardar
        </button>
        <button
          type="button"
          onClick={onLoad}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
        >
          📂 Cargar
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
        >
          ⬇ Exportar .json
        </button>
      </div>
    </header>
  );
}
