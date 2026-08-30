import type {
  Accesorio,
  CharacterSpec,
  ColorPalette,
  Estilo,
} from "./types";
import { ACCESORIOS_VALIDOS, ESTILOS } from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order; on a 404 (model unavailable) it falls back to the next one.
// Note: gemini-2.5-flash / 2.0-flash are no longer available for new keys (error suggests 3.6-flash).
const MODEL_ORDER = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

const HEX_COLOR_SCHEMA = {
  type: "STRING",
  description: "Color in hexadecimal format, e.g. #3b6ea5",
};

const COLOR_SCHEMA = {
  type: "OBJECT",
  properties: {
    piel: HEX_COLOR_SCHEMA,
    torso: HEX_COLOR_SCHEMA,
    piernas: HEX_COLOR_SCHEMA,
    cabeza: HEX_COLOR_SCHEMA,
    accesorio: HEX_COLOR_SCHEMA,
  },
  required: ["piel", "torso", "piernas", "cabeza", "accesorio"],
};

const CHARACTER_SCHEMA = {
  type: "OBJECT",
  properties: {
    nombre: { type: "STRING", description: "Short creative name for the character" },
    colores: COLOR_SCHEMA,
    proporciones: {
      type: "OBJECT",
      properties: {
        alturaTorso: { type: "NUMBER", description: "Between 0.4 and 1.6" },
        alturaPiernas: { type: "NUMBER", description: "Between 0.4 and 1.8" },
        anchoHombros: { type: "NUMBER", description: "Between 0.4 and 1.6" },
        tamanoCabeza: { type: "NUMBER", description: "Between 0.25 and 0.9" },
      },
      required: ["alturaTorso", "alturaPiernas", "anchoHombros", "tamanoCabeza"],
    },
    accesorios: {
      type: "ARRAY",
      items: {
        type: "STRING",
        enum: ["casco", "capa", "espada", "escudo", "antenas", "ninguno"],
      },
      description:
        "Character accessories. Use ['ninguno'] (none) if the character wears no accessories.",
    },
    estilo: {
      type: "STRING",
      enum: ["robot", "humanoide", "fantasia", "animal"],
    },
  },
  required: ["nombre", "colores", "proporciones", "accesorios", "estilo"],
};

const LOOK_SCHEMA = {
  type: "OBJECT",
  properties: {
    colores: COLOR_SCHEMA,
    accesorios: CHARACTER_SCHEMA.properties.accesorios,
  },
  required: ["colores", "accesorios"],
};

export const DEFAULT_PALETTE: ColorPalette = {
  piel: "#e8b98a",
  torso: "#3b6ea5",
  piernas: "#2c3e50",
  cabeza: "#e8b98a",
  accesorio: "#c0392b",
};

export const DEFAULT_PROPS = {
  alturaTorso: 1.0,
  alturaPiernas: 1.0,
  anchoHombros: 0.9,
  tamanoCabeza: 0.5,
};

function toHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  let c = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(c)) c = c.split("").map((ch) => ch + ch).join("");
  if (/^[0-9a-f]{6}$/i.test(c)) return `#${c.toLowerCase()}`;
  return fallback;
}

function toNum(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizePalette(raw: unknown): ColorPalette {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    piel: toHex(o.piel, DEFAULT_PALETTE.piel),
    torso: toHex(o.torso, DEFAULT_PALETTE.torso),
    piernas: toHex(o.piernas, DEFAULT_PALETTE.piernas),
    cabeza: toHex(o.cabeza, DEFAULT_PALETTE.cabeza),
    accesorio: toHex(o.accesorio, DEFAULT_PALETTE.accesorio),
  };
}

function sanitizeAccesorios(raw: unknown): Accesorio[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["ninguno"];
  const seen = new Set<Accesorio>();
  const out: Accesorio[] = [];
  for (const item of raw) {
    const a = ACCESORIOS_VALIDOS.find((v) => v === item);
    if (a && !seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out.length > 0 ? out : ["ninguno"];
}

function sanitizeEstilo(raw: unknown): Estilo {
  return ESTILOS.includes(raw as Estilo) ? (raw as Estilo) : "humanoide";
}

export function sanitizeSpec(raw: unknown): CharacterSpec {
  const o = (raw ?? {}) as Record<string, unknown>;
  const p = (o.proporciones ?? {}) as Record<string, unknown>;
  return {
    nombre:
      typeof o.nombre === "string" && o.nombre.trim().length > 0
        ? o.nombre.trim().slice(0, 40)
        : "Character",
    colores: sanitizePalette(o.colores),
    proporciones: {
      alturaTorso: toNum(p.alturaTorso, DEFAULT_PROPS.alturaTorso, 0.4, 1.6),
      alturaPiernas: toNum(p.alturaPiernas, DEFAULT_PROPS.alturaPiernas, 0.4, 1.8),
      anchoHombros: toNum(p.anchoHombros, DEFAULT_PROPS.anchoHombros, 0.4, 1.6),
      tamanoCabeza: toNum(p.tamanoCabeza, DEFAULT_PROPS.tamanoCabeza, 0.25, 0.9),
    },
    accesorios: sanitizeAccesorios(o.accesorios),
    estilo: sanitizeEstilo(o.estilo),
  };
}

interface GeminiResult<T> {
  value: T;
  model: string;
}

function getApiKey(): string {
  const key = process.env.GEMINI_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error("GEMINI_KEY is not set on the server.");
  }
  return key.trim();
}

async function callGemini<T>(
  promptText: string,
  schema: unknown,
): Promise<GeminiResult<T>> {
  const apiKey = getApiKey();
  let lastError: Error | null = null;

  for (const model of MODEL_ORDER) {
    try {
      const res = await fetch(
        `${BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 1,
            },
          }),
        },
      );

      if (res.status === 404) {
        lastError = new Error(`Model ${model} is not available.`);
        continue; // try the next model
      }

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body?.error?.message ?? detail;
        } catch {
          /* no JSON body */
        }
        const err = new Error(detail);
        // Auth/schema errors will not be fixed by switching models.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw err;
        }
        lastError = err;
        continue;
      }

      const data = await res.json();
      const parts: Array<{ text?: string }> =
        data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => typeof p.text === "string")
        .map((p) => p.text)
        .join("");
      if (!text) {
        throw new Error("The API returned no content.");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("The API returned invalid JSON.");
      }
      return { value: parsed as T, model };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Could not connect to the Gemini API.");
}

function buildCharacterPrompt(prompt: string): string {
  return [
    `Generate a character for a low-poly 3D editor from this description: "${prompt}".`,
    "Respond ONLY with valid JSON matching the provided schema.",
    "- nombre: short, creative name in English.",
    "- colores: hex colors with '#' (e.g. #3b6ea5).",
    "- proporciones: numbers within the indicated ranges.",
    "- accesorios: use values from the list; ['ninguno'] if none apply.",
    "- estilo: one of the values from the list.",
  ].join(" ");
}

function buildLookPrompt(spec: CharacterSpec): string {
  return [
    `Keep the character "${spec.nombre}" (style ${spec.estilo}) but change its look:`,
    "- Vary the color palette (colors consistent with the style).",
    "- Change the accessory list (it may stay the same if it fits).",
    "DO NOT change name, style or proportions.",
    "Respond ONLY with valid JSON with the colores and accesorios fields per the schema.",
  ].join(" ");
}

export async function generateCharacter(
  prompt: string,
): Promise<{ spec: CharacterSpec; model: string }> {
  const { value, model } = await callGemini<unknown>(
    buildCharacterPrompt(prompt),
    CHARACTER_SCHEMA,
  );
  return { spec: sanitizeSpec(value), model };
}

export async function generateLook(
  spec: CharacterSpec,
): Promise<{ spec: CharacterSpec; model: string }> {
  const { value, model } = await callGemini<unknown>(
    buildLookPrompt(spec),
    LOOK_SCHEMA,
  );
  const o = (value ?? {}) as Record<string, unknown>;
  const merged: CharacterSpec = {
    ...spec,
    colores: sanitizePalette(o.colores),
    accesorios: sanitizeAccesorios(o.accesorios),
  };
  return { spec: merged, model };
}

export function serverErrorToMessage(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    if (/API key|api key|403/.test(m)) {
      return "Invalid or unauthorized Gemini API key (HTTP 403). Check GEMINI_KEY on the server.";
    }
    if (/401/.test(m)) return "Invalid Gemini API key (HTTP 401).";
    if (/429/.test(m)) return "Gemini rate limit exceeded (HTTP 429). Try again in a moment.";
    if (/404/.test(m)) return "The Gemini model is not available. Try again later.";
    if (/invalid JSON/.test(m)) return "Gemini responded with invalid JSON. Try again.";
    if (/no content/.test(m)) return "Gemini returned no content. Try again.";
    if (/GEMINI_KEY/.test(m)) return m;
    return m;
  }
  return "Unexpected error while generating the character.";
}
