import type { CharacterSpec } from "./types";

/**
 * Cliente del editor: llama al route handler /api/generate del propio
 * servidor Next.js, que es quien guarda GEMINI_KEY (nunca llega al navegador).
 */

interface GenerateResponse {
  spec?: CharacterSpec;
  model?: string;
  error?: string;
}

async function postGenerate(body: unknown): Promise<GenerateResponse> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Error de red: no se pudo contactar el servidor del editor.",
    );
  }

  let data: GenerateResponse;
  try {
    data = (await res.json()) as GenerateResponse;
  } catch {
    throw new Error("El servidor respondió con un formato inválido.");
  }

  if (!res.ok || !data.spec) {
    throw new Error(data.error ?? `Error del servidor (HTTP ${res.status}).`);
  }
  return data;
}

export async function generateCharacter(
  prompt: string,
): Promise<{ spec: CharacterSpec; model: string }> {
  const data = await postGenerate({ mode: "character", prompt });
  return { spec: data.spec as CharacterSpec, model: data.model ?? "gemini" };
}

export async function generateLook(
  spec: CharacterSpec,
): Promise<{ spec: CharacterSpec; model: string }> {
  const data = await postGenerate({ mode: "look", spec });
  return { spec: data.spec as CharacterSpec, model: data.model ?? "gemini" };
}

export function friendlyGeminiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Error inesperado al generar el personaje.";
}
