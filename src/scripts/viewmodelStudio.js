import * as THREE from 'three';
import {
  VIEWMODEL_PRESETS,
  generateViewmodelConVars,
} from '../utils/autoexecCompiler.js';
import { drawCrosshairOnCanvas } from '../utils/crosshairCanvas.js';
import {
  FPS_POSES,
  inferModelKey,
  loadNormalizedWeapon,
  loadNormalizedWeaponFromFile,
} from '../utils/weaponModelLoader.js';
import { DEFAULT_VIEWMODEL, loadState, saveState } from '../utils/storage.js';
import { attachGlbDropHandler, notify } from './clientBridge.js';

const VIEWMODEL_MODELS = [
  { id: 'ak47', label: 'AK-47', url: '/models/ak47.glb' },
  { id: 'm4a4', label: 'M4A4', url: '/models/m4a4.glb' },
  { id: 'm4a1s', label: 'M4A1-S', url: '/models/m4a1s.glb' },
  { id: 'awp', label: 'AWP', url: '/models/awp.glb' },
  { id: 'famas', label: 'FAMAS', url: '/models/famas.glb' },
  { id: 'galil', label: 'Galil AR', url: '/models/galil.glb' },
  { id: 'mp9', label: 'MP9', url: '/models/mp9.glb' },
  { id: 'deagle', label: 'Desert Eagle', url: '/models/deagle.glb' },
  { id: 'usps', label: 'USP-S', url: '/models/usps.glb' },
  { id: 'glock', label: 'Glock-18', url: '/models/glock.glb' },
];

export function mountViewmodelPage() {
  const stageEl = document.getElementById('vm-stage');
  const glCanvas = document.getElementById('vm-webgl');
  const hudCanvas = document.getElementById('vm-crosshair');
  if (!stageEl || !glCanvas) return;

  const state = loadState();
  const persist = () => saveState(state);

  const weaponSelectEl = document.getElementById('vm-weapon-select');
  const fovEl = document.getElementById('vm-fov');
  const xEl = document.getElementById('vm-offset-x');
  const yEl = document.getElementById('vm-offset-y');
  const zEl = document.getElementById('vm-offset-z');
  const presetBtns = document.querySelectorAll('[data-vm-preset]');
  const resetBtn = document.getElementById('btn-vm-reset');
  const copyBtn = document.getElementById('btn-vm-copy');
  const previewCodeEl = document.getElementById('vm-convars-preview');
  const modelLabelEl = document.getElementById('vm-model-label');

  const valEls = {
    fov: document.getElementById('val-vm-fov'),
    x: document.getElementById('val-vm-x'),
    y: document.getElementById('val-vm-y'),
    z: document.getElementById('val-vm-z'),
  };

  if (weaponSelectEl) {
    weaponSelectEl.innerHTML = VIEWMODEL_MODELS.map(
      (m) => `<option value="${m.id}">${m.label}</option>`,
    ).join('');
    const initId = VIEWMODEL_MODELS.some((m) => m.id === state.arena.weaponId) ? state.arena.weaponId : 'ak47';
    weaponSelectEl.value = initId;
  }

  // Three.js Viewmodel Stage (Dust2 corridor backdrop + interactive camera + weapon rig)
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#131b2e');
  scene.fog = new THREE.FogExp2('#161f33', 0.025);

  const camera = new THREE.PerspectiveCamera(Number(state.viewmodel.fov || 68), 16 / 9, 0.03, 80);
  camera.position.set(0, 1.65, 0);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight('#fde68a', '#1e293b', 1.25));
  const keyLight = new THREE.DirectionalLight('#fff2d6', 2.2);
  keyLight.position.set(8, 12, 8);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#38bdf8', 0.85);
  rimLight.position.set(-6, 5, 4);
  scene.add(rimLight);

  // Corridor floor & back wall to establish authentic CS2 FOV perspective
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 50),
    new THREE.MeshStandardMaterial({ color: '#9c7e59', roughness: 0.92 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -15);
  scene.add(floor);

  const grid = new THREE.GridHelper(30, 30, '#22d3ee', '#475569');
  grid.position.set(0, 0.01, -15);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#c4a174', roughness: 0.88 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.5), wallMat);
  backWall.position.set(0, 3, -18);
  scene.add(backWall);

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: '#7c5d3b', roughness: 0.85 }),
  );
  crate.position.set(-2.8, 0.7, -9);
  scene.add(crate);

  const viewmodelRig = new THREE.Group();
  camera.add(viewmodelRig);

  let currentWeaponMesh = null;
  let activeModelKey = 'ak47';

  function applyViewmodelTransform() {
    const vm = state.viewmodel;
    const pose = FPS_POSES[activeModelKey] || FPS_POSES.ak47;

    camera.fov = Math.max(54, Math.min(75, Number(vm.fov ?? 68)));
    camera.updateProjectionMatrix();

    const xShift = (Number(vm.offsetX ?? 2.5) - 2.5) * 0.028;
    const yShift = -(Number(vm.offsetY ?? 0)) * 0.038;
    const zShift = (Number(vm.offsetZ ?? -1.5) + 1.5) * 0.028;

    viewmodelRig.position.set(
      pose.pos[0] + xShift,
      pose.pos[1] + zShift,
      pose.pos[2] + yShift,
    );
    viewmodelRig.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
  }

  function mountWeapon(normalized, label) {
    if (currentWeaponMesh) viewmodelRig.remove(currentWeaponMesh);
    currentWeaponMesh = normalized;
    activeModelKey = normalized.userData?.modelKey || 'ak47';
    viewmodelRig.add(currentWeaponMesh);
    if (modelLabelEl) modelLabelEl.textContent = label;
    applyViewmodelTransform();
  }

  async function selectWeapon(id) {
    const entry = VIEWMODEL_MODELS.find((m) => m.id === id) || VIEWMODEL_MODELS[0];
    activeModelKey = inferModelKey(entry.url);
    try {
      const normalized = await loadNormalizedWeapon(entry.url);
      mountWeapon(normalized, `${entry.label} • HD`);
    } catch {
      notify('error', `Failed to load ${entry.url}`);
    }
  }

  attachGlbDropHandler(stageEl, async (file) => {
    const normalized = await loadNormalizedWeaponFromFile(file);
    mountWeapon(normalized, file.name);
    notify('success', file.name);
  });

  function syncUi() {
    const vm = state.viewmodel;
    if (fovEl) fovEl.value = String(vm.fov);
    if (xEl) xEl.value = String(vm.offsetX);
    if (yEl) yEl.value = String(vm.offsetY);
    if (zEl) zEl.value = String(vm.offsetZ);

    if (valEls.fov) valEls.fov.textContent = String(vm.fov);
    if (valEls.x) valEls.x.textContent = Number(vm.offsetX).toFixed(1);
    if (valEls.y) valEls.y.textContent = Number(vm.offsetY).toFixed(1);
    if (valEls.z) valEls.z.textContent = Number(vm.offsetZ).toFixed(1);

    presetBtns.forEach((btn) => {
      const isActive = Number(vm.presetpos) === Number(btn.dataset.vmPreset);
      btn.classList.toggle('border-amber-400', isActive);
      btn.classList.toggle('bg-amber-500/20', isActive);
      btn.classList.toggle('text-amber-200', isActive);
      btn.classList.toggle('border-slate-700', !isActive);
      btn.classList.toggle('bg-slate-900/70', !isActive);
    });

    if (previewCodeEl) {
      previewCodeEl.textContent = generateViewmodelConVars(vm);
    }
    applyViewmodelTransform();
  }

  function updateVm(patch) {
    Object.assign(state.viewmodel, patch);
    syncUi();
    persist();
  }

  weaponSelectEl?.addEventListener('change', () => {
    state.arena.weaponId = weaponSelectEl.value;
    persist();
    selectWeapon(weaponSelectEl.value);
  });

  fovEl?.addEventListener('input', () => updateVm({ fov: Number(fovEl.value), presetpos: 0 }));
  xEl?.addEventListener('input', () => updateVm({ offsetX: Number(xEl.value), presetpos: 0 }));
  yEl?.addEventListener('input', () => updateVm({ offsetY: Number(yEl.value), presetpos: 0 }));
  zEl?.addEventListener('input', () => updateVm({ offsetZ: Number(zEl.value), presetpos: 0 }));

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = VIEWMODEL_PRESETS[Number(btn.dataset.vmPreset)];
      if (preset) {
        updateVm({
          fov: preset.fov,
          offsetX: preset.offsetX,
          offsetY: preset.offsetY,
          offsetZ: preset.offsetZ,
          presetpos: preset.presetpos,
        });
      }
    });
  });

  resetBtn?.addEventListener('click', () => updateVm({ ...DEFAULT_VIEWMODEL }));

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(generateViewmodelConVars(state.viewmodel));
      notify('success', 'ConVars copied!');
    } catch {
      // ignore
    }
  });

  // Resize + Crosshair Center Overlay + Idle Breathing Sway
  const hudCtx = hudCanvas ? hudCanvas.getContext('2d') : null;
  let stageWidth = 800;
  let stageHeight = 450;

  function handleResize() {
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    stageWidth = rect.width;
    stageHeight = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(stageWidth, stageHeight, false);
    camera.aspect = stageWidth / stageHeight;
    camera.updateProjectionMatrix();
    if (hudCanvas && hudCtx) {
      hudCanvas.width = Math.round(stageWidth * dpr);
      hudCanvas.height = Math.round(stageHeight * dpr);
      hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  new ResizeObserver(handleResize).observe(stageEl);
  handleResize();

  function animate(now) {
    requestAnimationFrame(animate);
    if (currentWeaponMesh) {
      currentWeaponMesh.position.y = Math.sin(now * 0.0022) * 0.0025;
      currentWeaponMesh.rotation.z = Math.cos(now * 0.0014) * 0.003;
    }
    renderer.render(scene, camera);
    if (hudCtx) {
      drawCrosshairOnCanvas(hudCtx, stageWidth, stageHeight, state.crosshair, 0, { x: 0, y: 0 }, 1.65);
    }
  }

  syncUi();
  selectWeapon(weaponSelectEl?.value || 'ak47');
  requestAnimationFrame(animate);
}
