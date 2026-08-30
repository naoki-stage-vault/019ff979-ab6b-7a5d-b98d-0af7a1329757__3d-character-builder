"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorScene } from "@/lib/EditorScene";
import { friendlyGeminiError, generateCharacter, generateLook } from "@/lib/gemini";
import type { GizmoMode, HierarchyItem, PartId, Transform, Vec3 } from "@/lib/types";
import Toolbar from "./Toolbar";
import GeneratorPanel from "./GeneratorPanel";
import MoldPanel from "./MoldPanel";
import ScenePanel from "./ScenePanel";

const STORAGE_KEY = "3d-character-builder:scene-v1";

const IDENTITY: Transform = { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] };

export default function Editor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<EditorScene | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const selectedPartRef = useRef<PartId | null>(null);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<HierarchyItem[]>([]);
  const [mode, setMode] = useState<GizmoMode>("translate");
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [moldTool, setMoldTool] = useState<"param" | "sculpt">("param");
  const [selectedPart, setSelectedPart] = useState<PartId | null>(null);
  const [partScale, setPartScale] = useState<Vec3 | null>(null);
  const [brushSize, setBrushSize] = useState(0.25);
  const [brushStrength, setBrushStrength] = useState(0.6);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    selectedPartRef.current = selectedPart;
  }, [selectedPart]);

  const refreshPartScale = useCallback((id: string | null, partId: PartId | null) => {
    const scene = sceneRef.current;
    if (!scene || !id || !partId) {
      setPartScale(null);
      return;
    }
    setPartScale(scene.getPartScale(id, partId));
  }, []);

  // --- Mount the 3D scene once ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new EditorScene(el, {
      onSelect: (id) => {
        setSelectedId(id);
        if (id) sceneRef.current?.selectPart(selectedPartRef.current);
        refreshPartScale(id, selectedPartRef.current);
      },
      onPartSelect: (p) => {
        const changed = p !== selectedPartRef.current;
        setSelectedPart(p);
        if (changed) refreshPartScale(selectedIdRef.current, p);
      },
      onHierarchy: (items) => setCharacters(items),
      onTransform: (id, t) => {
        if (id === selectedIdRef.current) setTransform(t);
      },
      onModeChange: (m) => setMode(m),
      onDragChange: (d) => setDragging(d),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [refreshPartScale]);

  // Sync molding tool and brush with the scene.
  useEffect(() => {
    sceneRef.current?.setMoldTool(moldTool);
  }, [moldTool]);

  useEffect(() => {
    sceneRef.current?.setBrush(brushSize, brushStrength);
  }, [brushSize, brushStrength]);

  // --- Actions ---
  const handleGenerate = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene || !prompt.trim()) return;
    setLoading(true);
    setGenError(null);
    try {
      const { spec, model } = await generateCharacter(prompt.trim());
      scene.addCharacter(spec, { prompt: prompt.trim() });
      setLastModel(model);
      setPrompt("");
      setStatus(`Character "${spec.nombre}" created (${model})`);
      window.setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setGenError(friendlyGeminiError(err));
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const handleRegenerateLook = useCallback(async () => {
    const scene = sceneRef.current;
    const id = selectedIdRef.current;
    if (!scene || !id) return;
    const current = scene.getSpec(id);
    if (!current) return;
    setRegenLoading(true);
    setGenError(null);
    try {
      const { spec, model } = await generateLook(current);
      scene.regenerateCharacter(id, spec);
      refreshPartScale(id, selectedPartRef.current);
      setLastModel(model);
      setStatus(`Look for "${spec.nombre}" regenerated (${model})`);
      window.setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setGenError(friendlyGeminiError(err));
    } finally {
      setRegenLoading(false);
    }
  }, [refreshPartScale]);

  const handleSave = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene.saveScene()));
      setStatus("Scene saved to localStorage ✓");
      window.setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus("Error saving to localStorage");
    }
  }, []);

  const handleLoad = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("No saved scene");
      window.setTimeout(() => setStatus(null), 3000);
      return;
    }
    try {
      const records = JSON.parse(raw) as Parameters<typeof scene.loadScene>[0];
      if (!Array.isArray(records)) throw new Error("invalid format");
      scene.loadScene(records);
      setStatus(`Scene loaded (${records.length} characters) ✓`);
      window.setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus("Saved scene is invalid");
    }
  }, []);

  const handleExport = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const data = JSON.stringify(scene.saveScene(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scene-3d-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(".json file exported ✓");
    window.setTimeout(() => setStatus(null), 3000);
  }, []);

  const handleDuplicate = useCallback(
    (id: string) => {
      sceneRef.current?.duplicateCharacter(id);
    },
    [],
  );

  const handleDelete = useCallback(
    (id: string) => {
      sceneRef.current?.removeCharacter(id);
    },
    [],
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      sceneRef.current?.renameCharacter(id, name);
    },
    [],
  );

  const handleSelect = useCallback(
    (id: string) => {
      sceneRef.current?.select(id);
    },
    [],
  );

  const handleMode = useCallback(
    (m: GizmoMode) => {
      sceneRef.current?.setMode(m);
    },
    [],
  );

  const handleMoldTool = useCallback((t: "param" | "sculpt") => setMoldTool(t), []);

  const handleSelectPart = useCallback(
    (p: PartId) => {
      setSelectedPart(p);
      sceneRef.current?.selectPart(p);
      refreshPartScale(selectedIdRef.current, p);
    },
    [refreshPartScale],
  );

  const handlePartScale = useCallback(
    (axis: 0 | 1 | 2, value: number) => {
      const scene = sceneRef.current;
      const id = selectedIdRef.current;
      const p = selectedPartRef.current;
      if (!scene || !id || !p) return;
      scene.setPartScale(id, p, axis, value);
      setPartScale((prev) => {
        if (!prev) return prev;
        const next = [...prev] as Vec3;
        next[axis] = value;
        return next;
      });
    },
    [],
  );

  const handleResetPart = useCallback(() => {
    const scene = sceneRef.current;
    const id = selectedIdRef.current;
    const p = selectedPartRef.current;
    if (!scene || !id || !p) return;
    scene.resetPart(id, p);
    setPartScale([1, 1, 1]);
  }, []);

  const handleResetAll = useCallback(() => {
    const scene = sceneRef.current;
    const id = selectedIdRef.current;
    if (!scene || !id) return;
    scene.resetMold(id);
    setPartScale([1, 1, 1]);
  }, []);

  const handleBrushSize = useCallback((v: number) => setBrushSize(v), []);
  const handleBrushStrength = useCallback((v: number) => setBrushStrength(v), []);

  const handleApplyTransform = useCallback(
    (field: "pos" | "rot" | "scale", axis: 0 | 1 | 2, value: number | null) => {
      const scene = sceneRef.current;
      const id = selectedIdRef.current;
      if (!scene || !id || value === null) return;
      const current = scene.getTransform(id);
      if (!current) return;
      const key = field === "pos" ? "pos" : field === "rot" ? "rot" : "scale";
      const next = [...current[key]] as Vec3;
      next[axis] = value;
      scene.applyTransform(id, { [key]: next } as Partial<Transform>);
    },
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 text-zinc-900">
      <Toolbar
        mode={mode}
        onMode={handleMode}
        onSave={handleSave}
        onLoad={handleLoad}
        onExport={handleExport}
        status={status}
        snapHint={dragging}
      />

      <div className="flex min-h-0 flex-1">
        {/* Viewport (dark canvas) */}
        <div ref={containerRef} className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-zinc-400 backdrop-blur">
            <p>
              <b className="text-zinc-200">W</b> move · <b className="text-zinc-200">E</b> rotate ·{" "}
              <b className="text-zinc-200">R</b> scale
            </p>
            <p>
              <b className="text-zinc-200">Shift</b> + drag = snapping ·{" "}
              <b className="text-zinc-200">Del</b> delete · <b className="text-zinc-200">Esc</b>{" "}
              deselect
            </p>
            {moldTool === "sculpt" && (
              <p className="text-sky-300">
                🖌 Sculpt mode: drag over the figure to mold it
              </p>
            )}
            {moldTool === "param" && selectedId !== null && (
              <p className="text-indigo-300">
                Click a body part to adjust its proportions
              </p>
            )}
          </div>
        </div>

        {/* Side panel (light) */}
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-zinc-200 bg-white">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <GeneratorPanel
              prompt={prompt}
              onPrompt={setPrompt}
              loading={loading}
              error={genError}
              onGenerate={handleGenerate}
              onRegenerateLook={handleRegenerateLook}
              canRegenerate={selectedId !== null}
              regenLoading={regenLoading}
              lastModel={lastModel}
            />

            <MoldPanel
              selected={selectedId !== null}
              moldTool={moldTool}
              onMoldTool={handleMoldTool}
              selectedPart={selectedPart}
              onSelectPart={handleSelectPart}
              partScale={partScale}
              onPartScale={handlePartScale}
              brushSize={brushSize}
              brushStrength={brushStrength}
              onBrushSize={handleBrushSize}
              onBrushStrength={handleBrushStrength}
              onResetPart={handleResetPart}
              onResetAll={handleResetAll}
            />
          </div>
          <ScenePanel
            characters={characters}
            selectedId={selectedId}
            transform={transform}
            onSelect={handleSelect}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onRename={handleRename}
            onApplyTransform={handleApplyTransform}
          />
        </aside>
      </div>
    </div>
  );
}
