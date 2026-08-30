"use client";

import type { PartId, Vec3 } from "@/lib/types";
import { PART_AXIS_LABELS, PART_IDS, PART_LABELS } from "@/lib/types";

interface Props {
  selected: boolean;
  moldTool: "param" | "sculpt";
  onMoldTool: (t: "param" | "sculpt") => void;
  selectedPart: PartId | null;
  onSelectPart: (p: PartId) => void;
  partScale: Vec3 | null;
  onPartScale: (axis: 0 | 1 | 2, value: number) => void;
  brushSize: number;
  brushStrength: number;
  onBrushSize: (v: number) => void;
  onBrushStrength: (v: number) => void;
  onResetPart: () => void;
  onResetAll: () => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-indigo-500"
      />
    </label>
  );
}

export default function MoldPanel({
  selected,
  moldTool,
  onMoldTool,
  selectedPart,
  onSelectPart,
  partScale,
  onPartScale,
  brushSize,
  brushStrength,
  onBrushSize,
  onBrushStrength,
  onResetPart,
  onResetAll,
}: Props) {
  return (
    <section className="border-b border-zinc-200 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Part molding
      </h2>

      {!selected ? (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Select or generate a character to mold each part of its body.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Tool */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5">
            <button
              type="button"
              onClick={() => onMoldTool("param")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] transition ${
                moldTool === "param"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              📐 Proportions
            </button>
            <button
              type="button"
              onClick={() => onMoldTool("sculpt")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] transition ${
                moldTool === "sculpt"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              🖌 Sculpt
            </button>
          </div>

          {/* Parts */}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Part
            </p>
            <div className="grid grid-cols-2 gap-1">
              {PART_IDS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelectPart(p)}
                  className={`rounded border px-2 py-1 text-[11px] transition ${
                    selectedPart === p
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {PART_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {moldTool === "param" ? (
            <div className="space-y-2">
              {partScale ? (
                <>
                  {PART_AXIS_LABELS.map((label, i) => (
                    <Slider
                      key={label}
                      label={label}
                      value={partScale[i]}
                      min={0.5}
                      max={1.5}
                      step={0.01}
                      onChange={(v) => onPartScale(i as 0 | 1 | 2, v)}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={onResetPart}
                    className="h-7 w-full rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 transition hover:bg-zinc-100"
                  >
                    ↺ Reset part
                  </button>
                </>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Select a part to adjust its proportions.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Slider
                label="Brush size"
                value={brushSize}
                min={0.05}
                max={0.6}
                step={0.01}
                onChange={onBrushSize}
              />
              <Slider
                label="Strength"
                value={brushStrength}
                min={0.05}
                max={1}
                step={0.01}
                onChange={onBrushStrength}
              />
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Drag over the figure to push the surface you touch — only the
                vertices on the visible side move. Click a part to select it.
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onResetPart}
                  className="h-7 flex-1 rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 transition hover:bg-zinc-100"
                >
                  ↺ Part
                </button>
                <button
                  type="button"
                  onClick={onResetAll}
                  className="h-7 flex-1 rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 transition hover:bg-zinc-100"
                >
                  ↺ All
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-zinc-400">
            Molding is saved with the scene. Regenerating the look rebuilds the
            character and resets its molding.
          </p>
        </div>
      )}
    </section>
  );
}
