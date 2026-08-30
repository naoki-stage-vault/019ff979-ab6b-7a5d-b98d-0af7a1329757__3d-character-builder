import * as THREE from "three";
import type { MoldData, PartId, Vec3 } from "./types";

/**
 * Sistema de moldeado por partes.
 *
 * Cada mesh de un personaje queda etiquetado con userData.partId y guarda en
 * group.userData.mold un registro de deformación por parte:
 *
 *   parts[partId] = {
 *     scale: Vec3,                          // factor paramétrico por eje
 *     meshes: [{ mesh, base, deltas }]      // base = posiciones originales,
 *                                           // deltas = esculpido por vértice
 *   }
 *
 * La posición final de cada vértice es:  base * scale + deltas.
 * Así los sliders (paramétrico) y el pincel (esculpido) conviven sin pisarse:
 * al cambiar la escala, los bultos esculpidos se escalan proporcionalmente.
 */

export interface MeshMold {
  mesh: THREE.Mesh;
  base: Float32Array;
  deltas: Float32Array;
}

export interface PartMold {
  scale: Vec3;
  meshes: MeshMold[];
}

export interface CharacterMold {
  parts: Partial<Record<PartId, PartMold>>;
}

export function getMold(group: THREE.Object3D): CharacterMold | null {
  return (group.userData.mold as CharacterMold | undefined) ?? null;
}

/** Inicializa el moldeado del grupo. Convierte geometrías a no-indexadas. */
export function initMold(group: THREE.Group, mold?: MoldData): void {
  const parts: Partial<Record<PartId, PartMold>> = {};

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const partId = obj.userData.partId as PartId | undefined;
    if (!partId) return;

    let geo = obj.geometry;
    if (geo.index) {
      geo = geo.toNonIndexed();
      obj.geometry.dispose();
      obj.geometry = geo;
    }
    const arr = geo.attributes.position.array as Float32Array;
    const pm = (parts[partId] ??= { scale: [1, 1, 1], meshes: [] });
    pm.meshes.push({
      mesh: obj,
      base: new Float32Array(arr),
      deltas: new Float32Array(arr.length),
    });
  });

  group.userData.mold = { parts };

  if (mold) {
    if (mold.scale) {
      for (const pid of Object.keys(mold.scale) as PartId[]) {
        const s = mold.scale[pid];
        const pm = parts[pid];
        if (pm && s) pm.scale = [s[0], s[1], s[2]];
      }
    }
    if (mold.sculpt) {
      for (const pid of Object.keys(mold.sculpt) as PartId[]) {
        const entries = mold.sculpt[pid] as
          | Array<[number, number, number, number, number]>
          | undefined;
        const pm = parts[pid];
        if (!pm || !entries) continue;
        for (const [meshIdx, vertIdx, dx, dy, dz] of entries) {
          const mm = pm.meshes[meshIdx];
          if (!mm) continue;
          const i = vertIdx * 3;
          if (i + 2 >= mm.deltas.length) continue;
          mm.deltas[i] = dx;
          mm.deltas[i + 1] = dy;
          mm.deltas[i + 2] = dz;
        }
      }
    }
  }

  applyAll(group);
}

export function applyPartDeform(pm: PartMold): void {
  const s = pm.scale;
  for (const mm of pm.meshes) {
    const pos = mm.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const { base, deltas } = mm;
    for (let i = 0; i < base.length; i += 3) {
      pos.setXYZ(
        i / 3,
        base[i] * s[0] + deltas[i],
        base[i + 1] * s[1] + deltas[i + 1],
        base[i + 2] * s[2] + deltas[i + 2],
      );
    }
    pos.needsUpdate = true;
    mm.mesh.geometry.computeVertexNormals();
  }
}

function applyAll(group: THREE.Group): void {
  const mold = getMold(group);
  if (!mold) return;
  for (const pid of Object.keys(mold.parts) as PartId[]) {
    const pm = mold.parts[pid];
    if (pm) applyPartDeform(pm);
  }
}

export function setPartScale(
  group: THREE.Group,
  partId: PartId,
  axis: 0 | 1 | 2,
  value: number,
): void {
  const mold = getMold(group);
  const pm = mold?.parts[partId];
  if (!pm) return;
  const old = pm.scale[axis];
  if (old === 0) return;
  const ratio = value / old;
  pm.scale[axis] = value;
  // Escalar los deltas proporcionalmente para que los bultos sigan a la parte.
  for (const mm of pm.meshes) {
    const d = mm.deltas;
    for (let i = axis; i < d.length; i += 3) d[i] *= ratio;
  }
  applyPartDeform(pm);
}

export function resetPart(group: THREE.Group, partId: PartId): void {
  const mold = getMold(group);
  const pm = mold?.parts[partId];
  if (!pm) return;
  pm.scale = [1, 1, 1];
  for (const mm of pm.meshes) mm.deltas.fill(0);
  applyPartDeform(pm);
}

export function resetAll(group: THREE.Group): void {
  const mold = getMold(group);
  if (!mold) return;
  for (const pid of Object.keys(mold.parts) as PartId[]) {
    const pm = mold.parts[pid];
    if (!pm) continue;
    pm.scale = [1, 1, 1];
    for (const mm of pm.meshes) mm.deltas.fill(0);
  }
  applyAll(group);
}

/**
 * Aplica un trazo "grab" del pincel: los vértices dentro del radio siguen al
 * cursor (desplazamiento arrastrado), con caída suave hacia el borde.
 * El trabajo se hace en el espacio local del mesh, sobre las posiciones
 * mostradas (base * scale + deltas).
 */
export function applySculptGrab(
  mm: MeshMold,
  scale: Vec3,
  centerLocal: THREE.Vector3,
  radiusLocal: number,
  dragLocal: THREE.Vector3,
  strength: number,
): void {
  if (radiusLocal <= 0) return;
  const pos = mm.mesh.geometry.attributes.position as THREE.BufferAttribute;
  const { base, deltas } = mm;
  const r2 = radiusLocal * radiusLocal;
  const drag = dragLocal.clone();
  const maxStep = 0.12;
  if (drag.length() > maxStep) drag.setLength(maxStep);
  drag.multiplyScalar(strength);

  for (let i = 0; i < base.length; i += 3) {
    const vx = base[i] * scale[0] + deltas[i];
    const vy = base[i + 1] * scale[1] + deltas[i + 1];
    const vz = base[i + 2] * scale[2] + deltas[i + 2];
    const dx = vx - centerLocal.x;
    const dy = vy - centerLocal.y;
    const dz = vz - centerLocal.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2) continue;
    const f = 1 - Math.sqrt(d2) / radiusLocal;
    const w = f * f;
    deltas[i] += drag.x * w;
    deltas[i + 1] += drag.y * w;
    deltas[i + 2] += drag.z * w;
    pos.setXYZ(
      i / 3,
      base[i] * scale[0] + deltas[i],
      base[i + 1] * scale[1] + deltas[i + 1],
      base[i + 2] * scale[2] + deltas[i + 2],
    );
  }
  pos.needsUpdate = true;
  mm.mesh.geometry.computeVertexNormals();
}

/** Serializa el moldeado del grupo (solo lo que difiere de la identidad). */
export function serializeMold(group: THREE.Group): MoldData | undefined {
  const mold = getMold(group);
  if (!mold) return undefined;

  const scale: Partial<Record<PartId, Vec3>> = {};
  let hasScale = false;
  for (const pid of Object.keys(mold.parts) as PartId[]) {
    const pm = mold.parts[pid];
    if (!pm) continue;
    const [x, y, z] = pm.scale;
    if (x !== 1 || y !== 1 || z !== 1) {
      scale[pid] = [x, y, z];
      hasScale = true;
    }
  }

  const sculpt: Partial<Record<PartId, Array<[number, number, number, number, number]>>> = {};
  let hasSculpt = false;
  for (const pid of Object.keys(mold.parts) as PartId[]) {
    const pm = mold.parts[pid];
    if (!pm) continue;
    const entries: Array<[number, number, number, number, number]> = [];
    pm.meshes.forEach((mm, meshIdx) => {
      for (let i = 0; i < mm.deltas.length; i += 3) {
        const dx = mm.deltas[i];
        const dy = mm.deltas[i + 1];
        const dz = mm.deltas[i + 2];
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          entries.push([meshIdx, i / 3, dx, dy, dz]);
        }
      }
    });
    if (entries.length > 0) {
      sculpt[pid] = entries;
      hasSculpt = true;
    }
  }

  if (!hasScale && !hasSculpt) return undefined;
  return { ...(hasScale ? { scale } : {}), ...(hasSculpt ? { sculpt } : {}) };
}
