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
