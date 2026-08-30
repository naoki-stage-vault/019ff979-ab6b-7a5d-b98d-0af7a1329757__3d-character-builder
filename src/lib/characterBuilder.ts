import * as THREE from "three";
import type { CharacterSpec, PartId } from "./types";

/**
 * Construye proceduralmente un personaje low-poly a partir de un CharacterSpec.
 * Cabeza = box (robot) / sphere, torso = box, brazos/piernas = cylinders,
 * más meshes extra según "accesorios". Devuelve un THREE.Group listo para la escena.
 * Cada mesh queda etiquetado con userData.partId para poder moldear por partes.
 */
export function buildCharacter(spec: CharacterSpec, id: string): THREE.Group {
  const group = new THREE.Group();
  group.name = spec.nombre;
  group.userData.isCharacter = true;
  group.userData.id = id;
  group.userData.spec = spec;
  group.userData.baseY = 0;
  group.userData.dragging = false;
  group.userData.idlePhase = Math.random() * Math.PI * 2;

  const mat = (
    color: string,
    opts?: Partial<THREE.MeshStandardMaterialParameters>,
  ) =>
    new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.65,
      metalness: spec.estilo === "robot" ? 0.45 : 0.08,
      ...opts,
    });

  const P = spec.proporciones;
  const C = spec.colores;

  // Normalizar para que la altura total sea ~2.2 unidades.
  const total =
    P.alturaPiernas + P.alturaTorso + P.tamanoCabeza * 0.75 + 0.15;
  const k = 2.2 / total;
  const legH = P.alturaPiernas * k;
  const torsoH = P.alturaTorso * k;
  const shoulderW = P.anchoHombros * k;
  const headS = P.tamanoCabeza * k;
  const torsoDepth = shoulderW * 0.42;

  const add = (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    partId: PartId,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.partId = partId;
    group.add(mesh);
    return mesh;
  };

  const matTorso = mat(C.torso);
  const matPiernas = mat(C.piernas);
  const matCabeza = mat(C.cabeza);
  const matPiel = mat(C.piel);
  const matAcc = mat(C.accesorio);

  const pelvisY = legH;
  const shouldersY = pelvisY + torsoH;
  const headCY = shouldersY + headS * 0.62;
  const shoulderY = shouldersY - torsoH * 0.12;
  const armLen = torsoH * 0.85;

  // Torso
  add(new THREE.BoxGeometry(shoulderW, torsoH, torsoDepth), matTorso, "torso", 0, pelvisY + torsoH * 0.5, 0);
  // Cadera
  add(
    new THREE.BoxGeometry(shoulderW * 0.92, legH * 0.2, torsoDepth * 0.95),
    matPiernas,
    "torso",
    0,
    pelvisY - legH * 0.1,
    0,
  );

  // Piernas + pies
  const legR = shoulderW * 0.14;
  add(new THREE.CylinderGeometry(legR, legR * 0.85, legH, 8), matPiernas, "legL", shoulderW * 0.24, legH * 0.5, 0);
  add(new THREE.CylinderGeometry(legR, legR * 0.85, legH, 8), matPiernas, "legR", -shoulderW * 0.24, legH * 0.5, 0);
  add(
    new THREE.BoxGeometry(shoulderW * 0.26, legH * 0.12, torsoDepth * 0.7),
    matPiernas,
    "legL",
    shoulderW * 0.24,
    legH * 0.06,
    torsoDepth * 0.12,
  );
  add(
    new THREE.BoxGeometry(shoulderW * 0.26, legH * 0.12, torsoDepth * 0.7),
    matPiernas,
    "legR",
    -shoulderW * 0.24,
    legH * 0.06,
    torsoDepth * 0.12,
  );

  // Brazos
  const armR = shoulderW * 0.11;
  add(new THREE.CylinderGeometry(armR, armR * 0.85, armLen, 8), matPiel, "armL", shoulderW * 0.55, shoulderY - armLen * 0.5, 0);
  add(new THREE.CylinderGeometry(armR, armR * 0.85, armLen, 8), matPiel, "armR", -shoulderW * 0.55, shoulderY - armLen * 0.5, 0);

  // Cabeza
  if (spec.estilo === "robot") {
    add(new THREE.BoxGeometry(headS, headS * 0.92, headS * 0.9), matCabeza, "head", 0, headCY, 0);
  } else {
    add(new THREE.SphereGeometry(headS * 0.52, 12, 10), matCabeza, "head", 0, headCY, 0);
  }

  if (spec.estilo === "animal") {
    // Hocico, orejas y cola
    add(
      new THREE.BoxGeometry(headS * 0.4, headS * 0.28, headS * 0.42),
      matCabeza,
      "head",
      0,
      headCY - headS * 0.08,
      headS * 0.56,
    );
    const ear = new THREE.ConeGeometry(headS * 0.15, headS * 0.42, 6);
    add(ear, matCabeza, "head", headS * 0.34, headCY + headS * 0.55, 0);
    add(ear, matCabeza, "head", -headS * 0.34, headCY + headS * 0.55, 0);
    add(
      new THREE.ConeGeometry(shoulderW * 0.08, torsoH * 0.55, 6),
      mat(C.piernas),
      "torso",
      0,
      pelvisY + torsoH * 0.35,
      -torsoDepth * 0.95,
      Math.PI * 0.32,
      0,
      0,
    );
  } else {
    // Ojos
    const eyeMat = mat("#181c22", { roughness: 0.35, metalness: 0.2 });
    add(new THREE.SphereGeometry(headS * 0.09, 8, 6), eyeMat, "head", headS * 0.17, headCY + headS * 0.08, headS * 0.46);
    add(new THREE.SphereGeometry(headS * 0.09, 8, 6), eyeMat, "head", -headS * 0.17, headCY + headS * 0.08, headS * 0.46);
  }

  // ---- Accesorios ----
  const accSet = new Set(spec.accesorios.filter((a) => a !== "ninguno"));

  if (accSet.has("casco")) {
    add(new THREE.BoxGeometry(headS * 1.12, headS * 0.42, headS * 1.12), matAcc, "head", 0, headCY + headS * 0.52, 0);
    add(new THREE.BoxGeometry(headS * 1.18, headS * 0.12, headS * 0.42), matAcc, "head", 0, headCY + headS * 0.14, headS * 0.5);
  }

  if (accSet.has("antenas")) {
    const tipMat = mat("#ff3b30", {
      emissive: new THREE.Color("#ff3b30"),
      emissiveIntensity: 0.7,
    });
    add(new THREE.CylinderGeometry(0.02, 0.03, headS * 0.6, 6), matAcc, "head", headS * 0.18, headCY + headS * 0.9, 0);
    add(new THREE.SphereGeometry(headS * 0.07, 8, 6), tipMat, "head", headS * 0.18, headCY + headS * 1.22, 0);
    add(new THREE.CylinderGeometry(0.02, 0.03, headS * 0.6, 6), matAcc, "head", -headS * 0.18, headCY + headS * 0.9, 0);
    add(new THREE.SphereGeometry(headS * 0.07, 8, 6), tipMat, "head", -headS * 0.18, headCY + headS * 1.22, 0);
  }

  if (spec.estilo === "fantasia" && !accSet.has("casco")) {
    // Sombrero de mago
    add(new THREE.ConeGeometry(headS * 0.62, headS * 0.85, 8), matAcc, "head", 0, headCY + headS * 0.72, 0);
    add(new THREE.CylinderGeometry(headS * 0.66, headS * 0.66, headS * 0.1, 8), matAcc, "head", 0, headCY + headS * 0.34, 0);
  }

  if (accSet.has("capa")) {
    // Capa: cono apuntando hacia abajo detrás del torso
    add(
      new THREE.ConeGeometry(shoulderW * 0.95, torsoH * 1.2, 6),
      matAcc,
      "torso",
      0,
      shouldersY - torsoH * 0.55,
      -torsoDepth * 0.55,
      Math.PI,
      0,
      0,
    );
  }

  if (accSet.has("espada")) {
    const sx = shoulderW * 0.62;
    const sy = shoulderY - armLen * 0.78;
    const sz = torsoDepth * 0.35;
    const tilt = 0.28;
    add(
      new THREE.BoxGeometry(0.1, torsoH * 0.7, 0.03),
      mat("#dfe4ea", { metalness: 0.7, roughness: 0.3 }),
      "torso",
      sx,
      sy + torsoH * 0.35,
      sz,
      0,
      0,
      tilt,
    );
    add(new THREE.BoxGeometry(0.26, 0.05, 0.08), matAcc, "torso", sx, sy, sz, 0, 0, tilt);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), matAcc, "torso", sx, sy - 0.14, sz, 0, 0, tilt);
  }

  if (accSet.has("escudo")) {
    const shX = -shoulderW * 0.62;
    const shY = shoulderY - armLen * 0.6;
    const shZ = torsoDepth * 0.42;
    add(
      new THREE.CylinderGeometry(shoulderW * 0.26, shoulderW * 0.22, torsoH * 0.5, 12),
      matAcc,
      "torso",
      shX,
      shY,
      shZ,
      Math.PI / 2,
      0,
      0,
    );
    add(
      new THREE.CylinderGeometry(shoulderW * 0.18, shoulderW * 0.16, 0.05, 12),
      mat(C.piel),
      "torso",
      shX,
      shY,
      shZ - 0.035,
      Math.PI / 2,
      0,
      0,
    );
  }

  return group;
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const m = obj.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m?.dispose();
    }
  });
}
