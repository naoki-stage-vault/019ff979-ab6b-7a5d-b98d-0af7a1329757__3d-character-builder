export type Estilo = "robot" | "humanoide" | "fantasia" | "animal";

export type Accesorio =
  | "casco"
  | "capa"
  | "espada"
  | "escudo"
  | "antenas"
  | "ninguno";

export interface ColorPalette {
  piel: string;
  torso: string;
  piernas: string;
  cabeza: string;
  accesorio: string;
}

export interface Proporciones {
  alturaTorso: number;
  alturaPiernas: number;
  anchoHombros: number;
  tamanoCabeza: number;
}

export interface CharacterSpec {
  nombre: string;
  colores: ColorPalette;
  proporciones: Proporciones;
  accesorios: Accesorio[];
  estilo: Estilo;
}

export type Vec3 = [number, number, number];

export interface Transform {
  pos: Vec3;
  rot: Vec3; // radianes
  scale: Vec3;
}

export interface SceneCharacterRecord {
  id: string;
  nombre: string;
  spec: CharacterSpec;
  prompt?: string;
  pos: Vec3;
  rot: Vec3; // radianes
  scale: Vec3;
  /** Deformación de partes (proporciones + esculpido) para persistir. */
  mold?: MoldData;
}

// ---------- Moldeado de partes ----------

/** Partes canónicas del cuerpo. Los accesorios se anclan a su parte cercana. */
export type PartId = "head" | "torso" | "armL" | "armR" | "legL" | "legR";

export const PART_IDS: PartId[] = ["head", "torso", "armL", "armR", "legL", "legR"];

export const PART_LABELS: Record<PartId, string> = {
  head: "Cabeza",
  torso: "Torso",
  armL: "Brazo izq.",
  armR: "Brazo der.",
  legL: "Pierna izq.",
  legR: "Pierna der.",
};

export const PART_AXIS_LABELS = ["Ancho (X)", "Alto (Y)", "Grosor (Z)"] as const;

/**
 * Moldeado serializado de un personaje.
 * - scale: factor de escala paramétrico por parte (alrededor del centro de la parte).
 * - sculpt: deltas por vértice. Cada entrada es [meshIdx, vertIdx, dx, dy, dz],
 *   donde meshIdx es el índice del mesh dentro de la parte (orden de traverse,
 *   estable para un mismo spec) y vertIdx el índice de vértice (geometrías no indexadas).
 */
export interface MoldData {
  scale?: Partial<Record<PartId, Vec3>>;
  sculpt?: Partial<Record<PartId, Array<[number, number, number, number, number]>>>;
}

export interface HierarchyItem {
  id: string;
  name: string;
  estilo: Estilo;
  accesorios: Accesorio[];
}

export type GizmoMode = "translate" | "rotate" | "scale";

export const ESTILOS: Estilo[] = ["robot", "humanoide", "fantasia", "animal"];

export const ACCESORIOS_VALIDOS: Accesorio[] = [
  "casco",
  "capa",
  "espada",
  "escudo",
  "antenas",
  "ninguno",
];

export const MODE_LABELS: Record<GizmoMode, string> = {
  translate: "Mover",
  rotate: "Rotar",
  scale: "Escalar",
};
