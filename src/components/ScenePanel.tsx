"use client";

import { useEffect, useRef, useState } from "react";
import type { HierarchyItem, Transform } from "@/lib/types";

const STYLE_ICON: Record<string, string> = {
  robot: "🤖",
  humanoide: "🧑",
  fantasia: "🧙",
  animal: "🐾",
};

function toDraft(t: Transform): string[] {
  const f = (v: number, d: number) =>
    Math.abs(v) < 1e-9 ? "0" : v.toFixed(d).replace(/\.?0+$/, "");
  return [
    f(t.pos[0], 2),
    f(t.pos[1], 2),
    f(t.pos[2], 2),
    f((t.rot[0] * 180) / Math.PI, 1),
    f((t.rot[1] * 180) / Math.PI, 1),
    f((t.rot[2] * 180) / Math.PI, 1),
    f(t.scale[0], 2),
    f(t.scale[1], 2),
    f(t.scale[2], 2),
  ];
}

function TransformFields({
  transform,
  onApply,
}: {
  transform: Transform;
  onApply: (field: "pos" | "rot" | "scale", axis: 0 | 1 | 2, value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string[]>(() => toDraft(transform));
  const prevJson = useRef(JSON.stringify(transform));

  useEffect(() => {
    const cur = JSON.stringify(transform);
    if (cur !== prevJson.current) {
      prevJson.current = cur;
      setDraft(toDraft(transform));
    }
  }, [transform]);

  const change = (idx: number, raw: string) => {
    setDraft((d) => {
      const next = [...d];
      next[idx] = raw;
      return next;
    });
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return;
    const field = idx < 3 ? "pos" : idx < 6 ? "rot" : "scale";
    const axis = (idx % 3) as 0 | 1 | 2;
    onApply(field, axis, field === "rot" ? (v * Math.PI) / 180 : v);
  };

  const labels = ["X", "Y", "Z"];
  const sections: Array<{ title: string; start: number }> = [
    { title: "Posición", start: 0 },
    { title: "Rotación (°)", start: 3 },
    { title: "Escala", start: 6 },
  ];

  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {s.title}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {labels.map((lbl, i) => {
              const idx = s.start + i;
              return (
                <label key={lbl} className="flex items-center gap-1">
                  <span className="w-3 text-[10px] text-zinc-500">{lbl}</span>
                  <input
                    type="number"
                    step={s.title === "Rotación (°)" ? 1 : 0.1}
                    value={draft[idx]}
                    onChange={(e) => change(idx, e.target.value)}
                    onBlur={() => setDraft(toDraft(transform))}
                    className="h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-200 outline-none focus:border-indigo-500"
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  characters: HierarchyItem[];
  selectedId: string | null;
  transform: Transform;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onApplyTransform: (field: "pos" | "rot" | "scale", axis: 0 | 1 | 2, value: number | null) => void;
}

export default function ScenePanel({
  characters,
  selectedId,
  transform,
  onSelect,
  onDuplicate,
  onDelete,
  onRename,
  onApplyTransform,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const selected = characters.find((c) => c.id === selectedId) ?? null;

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  };

  const commitRename = () => {
    if (renamingId) onRename(renamingId, renameValue);
    setRenamingId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Jerarquía */}
      <section className="min-h-0 flex-1 overflow-y-auto border-b border-zinc-800 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Escena ({characters.length})
        </h2>

        {characters.length === 0 && (
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Sin personajes todavía. Describe uno en el generador de arriba o
            carga una escena guardada.
          </p>
        )}

        <ul className="space-y-1">
          {characters.map((c) => {
            const active = c.id === selectedId;
            return (
              <li
                key={c.id}
                className={`group rounded border px-2 py-1.5 text-xs transition ${
                  active
                    ? "border-indigo-500/70 bg-indigo-950/50 text-indigo-100"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <span>{STYLE_ICON[c.estilo] ?? "🧍"}</span>
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 rounded border border-indigo-500 bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-100 outline-none"
                      />
                    ) : (
                      <span className="truncate">{c.name}</span>
                    )}
                  </button>
                  <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[9px] uppercase text-zinc-500">
                    {c.estilo}
                  </span>
                  <button
                    type="button"
                    title="Renombrar"
                    onClick={() => startRename(c.id, c.name)}
                    className="shrink-0 text-zinc-600 opacity-0 transition hover:text-zinc-200 group-hover:opacity-100"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    title="Duplicar"
                    onClick={() => onDuplicate(c.id)}
                    className="shrink-0 text-zinc-600 opacity-0 transition hover:text-zinc-200 group-hover:opacity-100"
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => onDelete(c.id)}
                    className="shrink-0 text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    🗑
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Propiedades */}
      <section className="shrink-0 overflow-y-auto p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Propiedades
        </h2>

        {!selected ? (
          <p className="text-[11px] text-zinc-600">
            Selecciona un personaje en la escena o en la lista.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Nombre
              </p>
              <p className="text-xs font-medium text-zinc-200">{selected.name}</p>
              {selected.accesorios.filter((a) => a !== "ninguno").length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selected.accesorios
                    .filter((a) => a !== "ninguno")
                    .map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] uppercase tracking-wide text-zinc-400"
                      >
                        {a}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <TransformFields transform={transform} onApply={onApplyTransform} />

            <button
              type="button"
              onClick={() => selectedId && onDuplicate(selectedId)}
              className="h-7 w-full rounded border border-zinc-700 bg-zinc-800 text-[11px] text-zinc-300 transition hover:bg-zinc-700"
            >
              ⧉ Duplicar
            </button>
            <button
              type="button"
              onClick={() => selectedId && startRename(selectedId, selected.name)}
              className="h-7 w-full rounded border border-zinc-700 bg-zinc-800 text-[11px] text-zinc-300 transition hover:bg-zinc-700"
            >
              ✎ Renombrar
            </button>
            <button
              type="button"
              onClick={() => selectedId && onDelete(selectedId)}
              className="h-7 w-full rounded border border-red-900/60 bg-red-950/30 text-[11px] text-red-300 transition hover:bg-red-950/60"
            >
              🗑 Eliminar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
