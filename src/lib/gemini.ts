import type { CharacterSpec } from "./types";

/**
 * Editor client: calls the /api/generate route handler on this Next.js
 * server, which is the one that holds GEMINI_KEY (it never reaches the
 * browser).
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
    throw new Error("Network error: could not reach the editor server.");
  }

  let data: GenerateResponse;
  try {
    data = (await res.json()) as GenerateResponse;
  } catch {
    throw new Error("The server responded with an invalid format.");
  }

  if (!res.ok || !data.spec) {
    throw new Error(data.error ?? `Server error (HTTP ${res.status}).`);
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
  return "Unexpected error while generating the character.";
}
