import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { buildCharacter, disposeObject } from "./characterBuilder";
import type {
  CharacterSpec,
  GizmoMode,
  HierarchyItem,
  SceneCharacterRecord,
  Transform,
  Vec3,
} from "./types";

export interface EditorCallbacks {
  onSelect: (id: string | null) => void;
  onHierarchy: (items: HierarchyItem[]) => void;
  onTransform: (id: string | null, t: Transform) => void;
  onModeChange: (mode: GizmoMode) => void;
  onDragChange: (dragging: boolean) => void;
}

const POS_SNAP = 1; // 1 unidad = celda del grid
const ROT_SNAP = THREE.MathUtils.degToRad(15);
const SCALE_SNAP = 0.1;

function uid(): string {
  return `chr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class EditorScene {
  private container: HTMLElement;
  private cb: EditorCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orbit: OrbitControls;
  private gizmo: TransformControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downPos = { x: 0, y: 0 };
  private downTime = 0;
  private characters: THREE.Group[] = [];
  private selectedId: string | null = null;
  private raf = 0;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private snapEnabled = false;

  constructor(container: HTMLElement, callbacks: EditorCallbacks) {
    this.container = container;
    this.cb = callbacks;

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101319);
    this.scene.fog = new THREE.Fog(0x101319, 30, 60);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(6.5, 5.2, 8.5);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 1, 0);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 1.5;
    this.orbit.maxDistance = 40;
    this.orbit.maxPolarAngle = Math.PI * 0.495;

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.9);
    this.gizmo.addEventListener("objectChange", () => this.emitTransform());
    this.gizmo.addEventListener("dragging-changed", (ev) => {
      const dragging = (ev as { value: boolean }).value;
      this.orbit.enabled = !dragging;
      this.cb.onDragChange(dragging);
      const obj = this.gizmo.object as THREE.Group | null;
      if (obj && obj.userData.isCharacter) {
        obj.userData.dragging = dragging;
        if (!dragging) obj.userData.baseY = obj.position.y;
      }
    });
    this.scene.add(this.gizmo.getHelper());

    this.setupWorld();

    // Eventos de ratón sobre el canvas (el gizmo vive en su propio overlay).
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.loop();
  }

  private setupWorld(): void {
    // Luces
    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2e36, 0.75);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.7);
    dir.position.set(6, 10, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -9;
    dir.shadow.camera.right = 9;
    dir.shadow.camera.top = 9;
    dir.shadow.camera.bottom = -9;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 30;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);

    // Suelo
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.95, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(24, 24, 0x4a545f, 0x2b313a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.65;
    grid.position.y = 0.002;
    this.scene.add(grid);
  }

  // ---------- Ciclo de render ----------
  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    for (const g of this.characters) {
      if (g.userData.dragging) continue;
      g.position.y =
        (g.userData.baseY as number) +
        Math.sin(t * 1.6 + (g.userData.idlePhase as number)) * 0.03;
    }
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------- Selección por raycasting ----------
  private onPointerDown = (e: PointerEvent): void => {
    this.downPos = { x: e.clientX, y: e.clientY };
    this.downTime = performance.now();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    const quick = performance.now() - this.downTime < 500;
    if (moved > 5 || !quick || this.gizmo.dragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.characters, true);
    if (hits.length === 0) {
      this.select(null);
      return;
    }
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.isCharacter) obj = obj.parent;
    if (obj && obj.userData.isCharacter) {
      this.select(obj.userData.id as string);
    } else {
      this.select(null);
    }
  };

  // ---------- Teclado ----------
  private isTypingTarget(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    );
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Shift") {
      this.snapEnabled = true;
      this.applySnap();
      return;
    }
    if (this.isTypingTarget()) return;
    const k = e.key.toLowerCase();
    if (k === "w") this.setMode("translate");
    else if (k === "e") this.setMode("rotate");
    else if (k === "r") this.setMode("scale");
    else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      if (this.selectedId) this.removeCharacter(this.selectedId);
    } else if (k === "Escape") {
      this.select(null);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Shift") {
      this.snapEnabled = false;
      this.applySnap();
    }
  };

  private applySnap(): void {
    this.gizmo.setTranslationSnap(this.snapEnabled ? POS_SNAP : null);
    this.gizmo.setRotationSnap(this.snapEnabled ? ROT_SNAP : null);
    this.gizmo.setScaleSnap(this.snapEnabled ? SCALE_SNAP : null);
  }

  // ---------- API pública ----------
  setMode(mode: GizmoMode): void {
    this.gizmo.setMode(mode);
    this.cb.onModeChange(mode);
  }

  addCharacter(
    spec: CharacterSpec,
    opts?: { id?: string; name?: string; transform?: Transform; prompt?: string },
  ): string {
    const id = opts?.id ?? uid();
    const group = buildCharacter(spec, id);
    if (opts?.name) group.name = opts.name;
    group.userData.prompt = opts?.prompt;

    const t = opts?.transform;
    if (t) {
      group.position.set(...t.pos);
      group.rotation.set(...t.rot);
      group.scale.set(...t.scale);
      group.userData.baseY = t.pos[1];
    } else {
      // Apilar nuevos personajes en el origen con un pequeño offset.
      const x = (this.characters.length % 6) * 0.7;
      group.position.set(x, 0, 0);
      group.userData.baseY = 0;
    }

    this.scene.add(group);
    this.characters.push(group);
    this.emitHierarchy();
    this.select(id);
    return id;
  }

  duplicateCharacter(id: string): string | null {
    const src = this.characters.find((g) => g.userData.id === id);
    if (!src) return null;
    const spec = src.userData.spec as CharacterSpec;
    const pos: Vec3 = [
      src.position.x + 0.7,
      src.position.y,
      src.position.z + 0.7,
    ];
    const newId = this.addCharacter(spec, {
      transform: { pos, rot: [src.rotation.x, src.rotation.y, src.rotation.z], scale: [src.scale.x, src.scale.y, src.scale.z] },
      prompt: src.userData.prompt,
      name: `${src.name} copia`,
    });
    return newId;
  }

  removeCharacter(id: string): void {
    const idx = this.characters.findIndex((g) => g.userData.id === id);
    if (idx === -1) return;
    const group = this.characters[idx];
    this.scene.remove(group);
    disposeObject(group);
    this.characters.splice(idx, 1);
    if (this.selectedId === id) this.select(null);
    this.emitHierarchy();
  }

  renameCharacter(id: string, name: string): void {
    const g = this.characters.find((c) => c.userData.id === id);
    if (!g || !name.trim()) return;
    g.name = name.trim().slice(0, 40);
    this.emitHierarchy();
  }

  regenerateCharacter(id: string, spec: CharacterSpec): void {
    const idx = this.characters.findIndex((g) => g.userData.id === id);
    if (idx === -1) return;
    const old = this.characters[idx];
    const wasSelected = this.selectedId === id;
    const name = old.name;
    const prompt = old.userData.prompt;
    const transform: Transform = {
      pos: [old.position.x, old.position.y, old.position.z],
      rot: [old.rotation.x, old.rotation.y, old.rotation.z],
      scale: [old.scale.x, old.scale.y, old.scale.z],
    };
    this.scene.remove(old);
    disposeObject(old);
    this.characters.splice(idx, 1);

    const group = buildCharacter(spec, id);
    group.name = name;
    group.userData.prompt = prompt;
    group.position.set(...transform.pos);
    group.rotation.set(...transform.rot);
    group.scale.set(...transform.scale);
    group.userData.baseY = transform.pos[1];

    this.scene.add(group);
    this.characters.push(group);
    this.emitHierarchy();
    if (wasSelected) this.select(id);
  }

  select(id: string | null): void {
    if (this.selectedId === id) return;
    this.gizmo.detach();
    this.selectedId = id;
    if (id) {
      const g = this.characters.find((c) => c.userData.id === id);
      if (g) this.gizmo.attach(g);
    }
    this.cb.onSelect(id);
    this.emitTransform();
  }

  getSpec(id: string): CharacterSpec | null {
    const g = this.characters.find((c) => c.userData.id === id);
    return g ? (g.userData.spec as CharacterSpec) : null;
  }

  getTransform(id: string): Transform | null {
    const g = this.characters.find((c) => c.userData.id === id);
    if (!g) return null;
    return {
      pos: [g.position.x, g.position.y, g.position.z],
      rot: [g.rotation.x, g.rotation.y, g.rotation.z],
      scale: [g.scale.x, g.scale.y, g.scale.z],
    };
  }

  applyTransform(id: string, t: Partial<Transform>): void {
    const g = this.characters.find((c) => c.userData.id === id);
    if (!g) return;
    if (t.pos) {
      g.position.set(t.pos[0], t.pos[1], t.pos[2]);
      g.userData.baseY = t.pos[1];
    }
    if (t.rot) g.rotation.set(t.rot[0], t.rot[1], t.rot[2]);
    if (t.scale) g.scale.set(t.scale[0], t.scale[1], t.scale[2]);
    this.emitTransform();
  }

  private emitTransform(): void {
    if (!this.selectedId) {
      this.cb.onTransform(null, { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] });
      return;
    }
    const t = this.getTransform(this.selectedId);
    if (t) this.cb.onTransform(this.selectedId, t);
  }

  private emitHierarchy(): void {
    const items: HierarchyItem[] = this.characters.map((g) => ({
      id: g.userData.id as string,
      name: g.name,
      estilo: (g.userData.spec as CharacterSpec).estilo,
      accesorios: (g.userData.spec as CharacterSpec).accesorios,
    }));
    this.cb.onHierarchy(items);
  }

  // ---------- Persistencia ----------
  saveScene(): SceneCharacterRecord[] {
    return this.characters.map((g) => ({
      id: g.userData.id as string,
      nombre: g.name,
      spec: g.userData.spec as CharacterSpec,
      prompt: g.userData.prompt,
      pos: [g.position.x, g.position.y, g.position.z],
      rot: [g.rotation.x, g.rotation.y, g.rotation.z],
      scale: [g.scale.x, g.scale.y, g.scale.z],
    }));
  }

  loadScene(records: SceneCharacterRecord[]): void {
    this.clearAll();
    for (const r of records) {
      this.addCharacter(r.spec, {
        id: r.id,
        name: r.nombre,
        prompt: r.prompt,
        transform: { pos: r.pos, rot: r.rot, scale: r.scale },
      });
    }
    this.select(null);
    this.emitHierarchy();
  }

  clearAll(): void {
    for (const g of this.characters) {
      this.scene.remove(g);
      disposeObject(g);
    }
    this.characters = [];
    this.gizmo.detach();
    this.selectedId = null;
    this.cb.onSelect(null);
    this.cb.onTransform(null, { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] });
  }

  count(): number {
    return this.characters.length;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.clearAll();
    this.gizmo.dispose();
    this.orbit.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
