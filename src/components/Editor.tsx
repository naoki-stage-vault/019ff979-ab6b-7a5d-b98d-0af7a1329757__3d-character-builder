"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorScene } from "@/lib/EditorScene";
import { friendlyGeminiError, generateCharacter, generateLook } from "@/lib/gemini";
import type { GizmoMode, HierarchyItem, Transform, Vec3 } from "@/lib/types";
import Toolbar from "./Toolbar";
import GeneratorPanel from "./GeneratorPanel";
import ScenePanel from "./ScenePanel";

const STORAGE_KEY = "3d-character-builder:scene-v1";

const IDENTITY: Transform = { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] };

export default function Editor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<EditorScene | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [apiKey, setApiKey] = useState("");
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

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // --- Montar la escena 3D una sola vez ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new EditorScene(el, {
      onSelect: (id) => setSelectedId(id),
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
  }, []);

  // --- Acciones ---
  const handleGenerate = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene || !apiKey.trim() || !prompt.trim()) return;
    setLoading(true);
    setGenError(null);
    try {
      const { spec, model } = await generateCharacter(prompt.trim(), apiKey.trim());
      scene.addCharacter(spec, { prompt: prompt.trim() });
      setLastModel(model);
      setPrompt("");
      setStatus(`Personaje "${spec.nombre}" creado (${model})`);
      window.setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setGenError(friendlyGeminiError(err));
    } finally {
      setLoading(false);
    }
  }, [apiKey, prompt]);

  const handleRegenerateLook = useCallback(async () => {
    const scene = sceneRef.current;
    const id = selectedIdRef.current;
    if (!scene || !id || !apiKey.trim()) return;
    const current = scene.getSpec(id);
    if (!current) return;
    setRegenLoading(true);
    setGenError(null);
    try {
      const { spec, model } = await generateLook(current, apiKey.trim());
      scene.regenerateCharacter(id, spec);
      setLastModel(model);
      setStatus(`Look de "${spec.nombre}" regenerado (${model})`);
      window.setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setGenError(friendlyGeminiError(err));
    } finally {
      setRegenLoading(false);
    }
  }, [apiKey]);

  const handleSave = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene.saveScene()));
      setStatus("Escena guardada en localStorage ✓");
      window.setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus("Error al guardar en localStorage");
    }
  }, []);

  const handleLoad = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("No hay escena guardada");
      window.setTimeout(() => setStatus(null), 3000);
      return;
    }
    try {
      const records = JSON.parse(raw) as Parameters<typeof scene.loadScene>[0];
      if (!Array.isArray(records)) throw new Error("formato inválido");
      scene.loadScene(records);
      setStatus(`Escena cargada (${records.length} personajes) ✓`);
      window.setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus("La escena guardada es inválida");
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
    a.download = `escena-3d-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Archivo .json exportado ✓");
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
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 text-zinc-200">
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
        {/* Viewport */}
        <div ref={containerRef} className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-zinc-400 backdrop-blur">
            <p>
              <b className="text-zinc-200">W</b> mover · <b className="text-zinc-200">E</b> rotar ·{" "}
              <b className="text-zinc-200">R</b> escalar
            </p>
            <p>
              <b className="text-zinc-200">Shift</b> + arrastrar = snapping ·{" "}
              <b className="text-zinc-200">Supr</b> eliminar · <b className="text-zinc-200">Esc</b>{" "}
              deseleccionar
            </p>
          </div>
        </div>

        {/* Panel lateral */}
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <GeneratorPanel
              apiKey={apiKey}
              onApiKey={setApiKey}
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
