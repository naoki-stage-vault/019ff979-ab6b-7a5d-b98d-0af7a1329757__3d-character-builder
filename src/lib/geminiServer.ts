import type {
  Accesorio,
  CharacterSpec,
  ColorPalette,
  Estilo,
} from "./types";
import { ACCESORIOS_VALIDOS, ESTILOS } from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Se intentan en orden; ante un 404 (modelo no disponible) se cae al siguiente.
// Nota: gemini-2.5-flash / 2.0-flash ya no están disponibles para keys nuevas (error sugiere 3.6-flash).
const MODEL_ORDER = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

const HEX_COLOR_SCHEMA = {
  type: "STRING",
  description: "Color en formato hexadecimal, ej: #3b6ea5",
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
    nombre: { type: "STRING", description: "Nombre corto y creativo del personaje" },
    colores: COLOR_SCHEMA,
    proporciones: {
      type: "OBJECT",
      properties: {
        alturaTorso: { type: "NUMBER", description: "Entre 0.4 y 1.6" },
        alturaPiernas: { type: "NUMBER", description: "Entre 0.4 y 1.8" },
        anchoHombros: { type: "NUMBER", description: "Entre 0.4 y 1.6" },
        tamanoCabeza: { type: "NUMBER", description: "Entre 0.25 y 0.9" },
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
        "Lista de accesorios del personaje. Usa ['ninguno'] si no lleva accesorios.",
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
        : "Personaje",
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
    throw new Error("GEMINI_KEY no está configurada en el servidor.");
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
        lastError = new Error(`El modelo ${model} no está disponible.`);
        continue; // probar el siguiente modelo
      }

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body?.error?.message ?? detail;
        } catch {
          /* sin cuerpo JSON */
        }
        const err = new Error(detail);
        // Errores de auth/schema no se resuelven cambiando de modelo.
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
        throw new Error("La API respondió sin contenido.");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("La API devolvió JSON inválido.");
      }
      return { value: parsed as T, model };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("No se pudo conectar con la API de Gemini.");
}

function buildCharacterPrompt(prompt: string): string {
  return [
    `Genera un personaje para un editor 3D low-poly a partir de esta descripción: "${prompt}".`,
    "Responde ÚNICAMENTE con JSON válido según el schema indicado.",
    "- nombre: nombre corto y creativo en español.",
    "- colores: hexadecimals con '#' (ej: #3b6ea5).",
    "- proporciones: números dentro de los rangos indicados.",
    "- accesorios: usa valores de la lista; ['ninguno'] si no aplica.",
    "- estilo: uno de la lista.",
  ].join(" ");
}

function buildLookPrompt(spec: CharacterSpec): string {
  return [
    `Mantén el personaje "${spec.nombre}" (estilo ${spec.estilo}) pero cambia su look:`,
    "- Varía la paleta de colores (colores coherentes con el estilo).",
    "- Cambia la lista de accesorios (puede quedar igual si encaja).",
    "NO cambies nombre, estilo ni proporciones.",
    "Responde ÚNICAMENTE con JSON válido con los campos colores y accesorios según el schema.",
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
      return "API key de Gemini inválida o sin permisos (HTTP 403). Revisa GEMINI_KEY en el servidor.";
    }
    if (/401/.test(m)) return "API key de Gemini inválida (HTTP 401).";
    if (/429/.test(m)) return "Límite de peticiones de Gemini superado (HTTP 429). Espera un momento.";
    if (/404/.test(m)) return "El modelo de Gemini no está disponible. Intenta de nuevo más tarde.";
    if (/JSON inválido/.test(m)) return "Gemini respondió con JSON inválido. Intenta de nuevo.";
    if (/sin contenido/.test(m)) return "Gemini no devolvió contenido. Intenta de nuevo.";
    if (/GEMINI_KEY/.test(m)) return m;
    return m;
  }
  return "Error inesperado al generar el personaje.";
}
