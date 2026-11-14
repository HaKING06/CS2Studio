import * as THREE from 'three';
import {
  ARENA_WEAPON_LIST,
  getWeaponData,
  getCumulativeWallPoints,
} from '../utils/sprayPatterns.js';
import {
  FPS_POSES,
  inferModelKey,
  loadNormalizedWeapon,
  loadNormalizedWeaponFromFile,
} from '../utils/weaponModelLoader.js';
import {
  CROSSHAIR_COLOR_PRESETS,
  drawCrosshairOnCanvas,
  buildCrosshairMiniSvg,
  rgbToHex,
  hexToRgb,
} from '../utils/crosshairCanvas.js';
import { PRO_CROSSHAIRS, getProCrosshairById } from '../utils/proCrosshairs.js';
import { decodeAnyShareCode, encodeCrosshairCode } from '../utils/shareCode.js';
import { loadState, saveState } from '../utils/storage.js';
import { t, notify, attachGlbDropHandler } from './clientBridge.js';

const RECOIL_RAD_SCALE = 0.00055;
const EYE_HEIGHT = 1.65;
const MAX_DECALS = 90;

function createDust2WallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#d6b68a');
  grad.addColorStop(0.75, '#c6a273');
  grad.addColorStop(1, '#9d7c53');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(85, 62, 36, 0.24)';
  ctx.lineWidth = 2;
  const rows = 8;
  const rowH = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();

    const cols = 8;
    const colW = canvas.width / cols;
    const offset = (r % 2) * (colW / 2);
    for (let c = 0; c <= cols; c++) {
      const x = c * colW + offset;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowH);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,245,220,0.06)' : 'rgba(60,42,24,0.07)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = 'rgba(54, 42, 30, 0.45)';
  ctx.fillRect(0, canvas.height - 46, canvas.width, 46);

  ctx.save();
  ctx.fillStyle = 'rgba(139, 38, 29, 0.62)';
  ctx.font = 'bold 78px sans-serif';
  ctx.fillText('A', 64, 118);
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = 'rgba(55, 42, 28, 0.72)';
  ctx.fillText('CS2 STUDIO • SPRAY TEST RANGE', 64, 146);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createDust2FloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b4946c';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,235,205,0.06)' : 'rgba(70,50,30,0.08)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  ctx.strokeStyle = 'rgba(72, 54, 34, 0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 12);
  return tex;
}

function createTargetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 32; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 496);

  const rings = [
    { r: 190, stroke: 'rgba(148,163,184,0.45)', fill: 'rgba(30,41,59,0.45)' },
    { r: 120, stroke: 'rgba(34,211,238,0.65)', fill: 'rgba(8,145,178,0.16)' },
    { r: 62, stroke: '#fbbf24', fill: 'rgba(245,158,11,0.22)' },
    { r: 22, stroke: '#ef4444', fill: 'rgba(239,68,68,0.48)' },
  ];
  rings.forEach((ring) => {
    ctx.beginPath();
    ctx.arc(256, 256, ring.r, 0, Math.PI * 2);
    ctx.fillStyle = ring.fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ring.stroke;
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(256, 30);
  ctx.lineTo(256, 482);
  ctx.moveTo(30, 256);
  ctx.lineTo(482, 256);
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HEADSHOT ZONE', 256, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBulletDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
  grad.addColorStop(0, 'rgba(10, 10, 10, 0.98)');
  grad.addColorStop(0.28, 'rgba(28, 25, 23, 0.92)');
  grad.addColorStop(0.55, 'rgba(90, 75, 60, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class SynthAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playShot(weaponId) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const isSilenced = weaponId === 'm4a1s' || weaponId === 'usps';
    const isHeavy = weaponId === 'awp' || weaponId === 'deagle' || weaponId === 'ak47';

    const duration = isSilenced ? 0.06 : isHeavy ? 0.15 : 0.1;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = isSilenced ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(isSilenced ? 1800 : isHeavy ? 1400 : 2400, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + duration);

    const gain = ctx.createGain();
    const vol = isSilenced ? 0.14 : isHeavy ? 0.26 : 0.2;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeavy ? 145 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.08);
    oscGain.gain.setValueAtTime(isSilenced ? 0.08 : 0.22, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }
}

export function mountSprayArenaPage() {
  const stageEl = document.getElementById('arena-stage');
  const glCanvas = document.getElementById('arena-webgl');
  const hudCanvas = document.getElementById('arena-crosshair');
  if (!stageEl || !glCanvas || !hudCanvas) return;

  const state = loadState();
  const persist = () => saveState(state);

  const weaponSelectEl = document.getElementById('arena-weapon');
  const rangeBtns = document.querySelectorAll('[data-arena-range]');
  const modeBtns = document.querySelectorAll('[data-arena-mode]');
  const ghostToggleEl = document.getElementById('arena-ghost-toggle');
  const clearBtnEl = document.getElementById('btn-clear-decals');
  const resetStatsBtnEl = document.getElementById('btn-reset-stats');
  const pointerLockBtnEl = document.getElementById('btn-pointer-lock');
  const soundToggleEl = document.getElementById('btn-sound-toggle');

  const statShotsEl = document.getElementById('stat-shots');
  const statHitsEl = document.getElementById('stat-hits');
  const statAccuracyEl = document.getElementById('stat-accuracy');
  const magCounterEl = document.getElementById('arena-mag-counter');
  const weaponBadgeEl = document.getElementById('arena-weapon-badge');

  if (weaponSelectEl) {
    weaponSelectEl.innerHTML = ARENA_WEAPON_LIST.map((id) => {
      const w = getWeaponData(id);
      return `<option value="${w.id}">${w.name} (${w.category}) — $${w.price}</option>`;
    }).join('');
    weaponSelectEl.value = state.arena.weaponId || 'ak47';
  }

  // Three.js Scene
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#131b2c');
  scene.fog = new THREE.FogExp2('#161f33', 0.014);

  const camera = new THREE.PerspectiveCamera(Number(state.viewmodel.fov || 68), 16 / 9, 0.04, 150);
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight('#fde68a', '#1e293b', 1.15));
  const sunLight = new THREE.DirectionalLight('#fff1d0', 2.0);
  sunLight.position.set(12, 18, 10);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight('#38bdf8', 0.55);
  fillLight.position.set(-10, 8, 6);
  scene.add(fillLight);

  const wallTex = createDust2WallTexture();
  const floorTex = createDust2FloorTexture();
  const targetTex = createTargetTexture();
  const decalTex = createBulletDecalTexture();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 75),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -25);
  scene.add(floor);

  const crateMat = new THREE.MeshStandardMaterial({ color: '#8f6b47', roughness: 0.85 });
  const cratePositions = [
    [-4.6, 0.65, -7.5, 1.3, 1.3, 1.3],
    [-4.3, 1.9, -7.6, 1.1, 1.1, 1.1],
    [4.8, 0.8, -11.5, 1.6, 1.6, 1.6],
    [4.4, 0.55, -21.0, 1.1, 1.1, 1.1],
  ];
  cratePositions.forEach(([x, y, z, w, h, d]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  });

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 5.2, 65),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }),
  );
  leftWall.position.set(-6.8, 2.6, -24);
  scene.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.set(6.8, 2.6, -24);
  scene.add(rightWall);

  const targetWallGroup = new THREE.Group();
  targetWallGroup.position.set(0, 0, -Number(state.arena.distanceMeters || 20));
  scene.add(targetWallGroup);

  const mainWall = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 7.2, 0.5),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.88 }),
  );
  mainWall.position.set(0, 3.6, -0.25);
  targetWallGroup.add(mainWall);

  const targetPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 1.85),
    new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.75 }),
  );
  targetPlane.position.set(0, EYE_HEIGHT, 0.01);
  targetWallGroup.add(targetPlane);

  const ghostGroup = new THREE.Group();
  ghostGroup.position.set(0, EYE_HEIGHT, 0.02);
  targetWallGroup.add(ghostGroup);

  const guideDotMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.035, 0.06, 24),
    new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  guideDotMesh.position.set(0, 0, 0.01);
  ghostGroup.add(guideDotMesh);

  let ghostPathLine = null;
  function rebuildGhostPattern() {
    if (ghostPathLine) {
      ghostGroup.remove(ghostPathLine);
      ghostPathLine.geometry.dispose();
      ghostPathLine.material.dispose();
      ghostPathLine = null;
    }

    const wId = state.arena.weaponId || 'ak47';
    const dist = Number(state.arena.distanceMeters || 20);
    const pts = getCumulativeWallPoints(wId, 1);
    const isControl = state.arena.mode === 'control';

    const vertices = pts.map((pt) => {
      const sign = isControl ? -1 : 1;
      const yaw = sign * pt.cumX * RECOIL_RAD_SCALE;
      const pitch = sign * pt.cumY * RECOIL_RAD_SCALE;
      return new THREE.Vector3(Math.tan(yaw) * dist, Math.tan(pitch) * dist, 0.012);
    });

    const geom = new THREE.BufferGeometry().setFromPoints(vertices);
    const mat = new THREE.LineBasicMaterial({
      color: isControl ? '#22d3ee' : '#f59e0b',
      transparent: true,
      opacity: 0.55,
    });
    ghostPathLine = new THREE.Line(geom, mat);
    ghostGroup.add(ghostPathLine);
    ghostGroup.visible = Boolean(state.arena.showGhostGuide);
  }

  const decalsGroup = new THREE.Group();
  decalsGroup.position.set(0, 0, 0.015);
  targetWallGroup.add(decalsGroup);
  const decalPool = [];
  const tracers = [];
  const decalMat = new THREE.MeshBasicMaterial({
    map: decalTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const decalGeom = new THREE.PlaneGeometry(0.11, 0.11);

  function addBulletDecal(localX, localY) {
    const mesh = new THREE.Mesh(decalGeom, decalMat);
    mesh.position.set(localX, localY, 0.002 + decalPool.length * 0.00025);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    decalsGroup.add(mesh);
    decalPool.push(mesh);
    if (decalPool.length > MAX_DECALS) {
      decalsGroup.remove(decalPool.shift());
    }
  }

  function clearDecals() {
    while (decalPool.length) {
      decalsGroup.remove(decalPool.pop());
    }
  }

  function spawnTracer(startWorld, endWorld) {
    const geom = new THREE.BufferGeometry().setFromPoints([startWorld, endWorld]);
    const mat = new THREE.LineBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geom, mat);
    scene.add(line);
    tracers.push({ line, life: 0.075 });
  }

  const viewmodelRig = new THREE.Group();
  camera.add(viewmodelRig);

  const weaponContainer = new THREE.Group();
  viewmodelRig.add(weaponContainer);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0 }),
  );
  const muzzleLight = new THREE.PointLight('#fbbf24', 0, 4);
  weaponContainer.add(muzzleFlash);
  weaponContainer.add(muzzleLight);

  let currentWeaponMesh = null;
  let activeModelKey = 'ak47';

  function applyViewmodelTransform() {
    const vm = state.viewmodel;
    const pose = FPS_POSES[activeModelKey] || FPS_POSES.ak47;

    camera.fov = Math.max(54, Math.min(75, Number(vm.fov ?? 68)));
    camera.updateProjectionMatrix();

    const xShift = (Number(vm.offsetX ?? 2.5) - 2.5) * 0.025;
    const yShift = -(Number(vm.offsetY ?? 0)) * 0.036;
    const zShift = (Number(vm.offsetZ ?? -1.5) + 1.5) * 0.025;

    viewmodelRig.position.set(
      pose.pos[0] + xShift,
      pose.pos[1] + zShift,
      pose.pos[2] + yShift,
    );
    viewmodelRig.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
  }

  function mountWeaponObject(normalizedGroup, labelText) {
    if (currentWeaponMesh) {
      weaponContainer.remove(currentWeaponMesh);
    }
    currentWeaponMesh = normalizedGroup;
    weaponContainer.add(currentWeaponMesh);
    activeModelKey = normalizedGroup.userData?.modelKey || 'ak47';

    const muzzleObj = currentWeaponMesh.getObjectByName('Muzzle');
    if (muzzleObj) {
      muzzleFlash.position.copy(muzzleObj.position);
      muzzleLight.position.copy(muzzleObj.position);
    } else {
      muzzleFlash.position.set(0, 0.05, -0.45);
      muzzleLight.position.set(0, 0.05, -0.45);
    }

    if (weaponBadgeEl && labelText) {
      weaponBadgeEl.textContent = labelText;
    }
    applyViewmodelTransform();
  }

  async function equipWeapon(weaponId) {
    const data = getWeaponData(weaponId);
    activeModelKey = inferModelKey(data.modelUrl);
    if (weaponBadgeEl) {
      weaponBadgeEl.textContent = `${data.name} • $${data.price}`;
    }

    try {
      const normalized = await loadNormalizedWeapon(data.modelUrl);
      mountWeaponObject(normalized, `${data.name} • $${data.price}`);
    } catch {
      notify('error', `Could not load model: ${data.modelUrl}`);
    }

    resetWeaponBurst();
    rebuildGhostPattern();
    updateHudStats();
  }

  attachGlbDropHandler(stageEl, async (file) => {
    const normalized = await loadNormalizedWeaponFromFile(file);
    mountWeaponObject(normalized, file.name);
    notify('success', file.name);
  });

  // Firing & Recoil State
  const audio = new SynthAudio();
  const stats = { shots: 0, hits: 0, bullseyes: 0 };

  let isFiring = false;
  let isPointerLocked = false;
  let burstIndex = 0;
  let nextShotTime = 0;
  let recoilYaw = 0;
  let recoilPitch = 0;
  let aimYaw = 0;
  let aimPitch = 0;
  let kickOffset = 0;
  let dynamicSpreadPx = 0;
  let muzzleFlashTimer = 0;
  let lastPointer = { x: 0, y: 0 };

  function updateMagCounter() {
    const w = getWeaponData(state.arena.weaponId || 'ak47');
    if (magCounterEl) {
      magCounterEl.textContent = `${Math.max(0, w.magSize - burstIndex)} / ${w.magSize}`;
    }
  }

  function resetWeaponBurst() {
    burstIndex = 0;
    recoilYaw = 0;
    recoilPitch = 0;
    updateMagCounter();
  }

  function updateHudStats() {
    if (statShotsEl) statShotsEl.textContent = String(stats.shots);
    if (statHitsEl) statHitsEl.textContent = String(stats.hits);
    const pct = stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 100;
    if (statAccuracyEl) statAccuracyEl.textContent = `${pct}%`;
    updateMagCounter();
  }

  function fireSingleShot(nowMs) {
    const weaponId = state.arena.weaponId || 'ak47';
    const w = getWeaponData(weaponId);

    if (burstIndex >= w.magSize) {
      isFiring = false;
      return;
    }

    const step = w.pattern[Math.min(burstIndex, w.pattern.length - 1)] || { bulletDx: 0, bulletDy: 0, delayMs: w.fireIntervalMs };

    if (burstIndex === 0) {
      recoilYaw = 0;
      recoilPitch = 0;
    } else {
      recoilYaw += step.bulletDx * RECOIL_RAD_SCALE;
      recoilPitch += step.bulletDy * RECOIL_RAD_SCALE;
    }

    const spreadRad = w.spreadBase * (1 + burstIndex * 0.04);
    const randYaw = (Math.random() - 0.5) * spreadRad;
    const randPitch = (Math.random() - 0.5) * spreadRad;

    const effectiveYaw = (state.arena.mode === 'wall' ? 0 : aimYaw) + recoilYaw + randYaw;
    const effectivePitch = (state.arena.mode === 'wall' ? 0 : aimPitch) + recoilPitch + randPitch;

    const dist = Number(state.arena.distanceMeters || 20);
    const impactX = Math.tan(effectiveYaw) * dist;
    const impactY = EYE_HEIGHT + Math.tan(effectivePitch) * dist;

    addBulletDecal(impactX, impactY);

    const muzzleWorld = new THREE.Vector3();
    muzzleFlash.getWorldPosition(muzzleWorld);
    spawnTracer(muzzleWorld, new THREE.Vector3(impactX, impactY, -dist));

    const radialDist = Math.hypot(impactX, impactY - EYE_HEIGHT);
    stats.shots += 1;
    if (radialDist <= 0.44) {
      stats.hits += 1;
      if (radialDist <= 0.17) stats.bullseyes += 1;
    }

    if (state.arena.mode === 'control') {
      guideDotMesh.position.set(Math.tan(-recoilYaw) * dist, Math.tan(-recoilPitch) * dist, 0.015);
    } else {
      guideDotMesh.position.set(impactX, impactY - EYE_HEIGHT, 0.015);
    }

    kickOffset = Math.min(1.0, kickOffset + 0.55);
    dynamicSpreadPx = Math.min(18, dynamicSpreadPx + 4.5);
    muzzleFlashTimer = 0.045;
    audio.playShot(weaponId);

    burstIndex += 1;
    nextShotTime = nowMs + (step.delayMs || w.fireIntervalMs || 100);
    if (!w.auto) isFiring = false;
    updateHudStats();
  }

  glCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    audio.ensureCtx();
    lastPointer = { x: e.clientX, y: e.clientY };

    if (!isPointerLocked && state.arena.mode === 'control') {
      aimYaw = 0;
      aimPitch = 0;
      camera.rotation.y = 0;
      camera.rotation.x = 0;
    }
    if (burstIndex >= getWeaponData(state.arena.weaponId || 'ak47').magSize) {
      resetWeaponBurst();
    }
    isFiring = true;
    nextShotTime = performance.now();
    stageEl.classList.add('is-aiming');
  });

  window.addEventListener('pointermove', (e) => {
    if (!isFiring && !isPointerLocked) return;
    if (state.arena.mode !== 'control') return;
    const sens = Number(state.autoexecOpts.sensitivity ?? 1.85);
    const radPerPx = 0.00055 * (sens / 1.85);
    let dx = 0;
    let dy = 0;
    if (isPointerLocked) {
      dx = e.movementX || 0;
      dy = e.movementY || 0;
    } else {
      dx = e.clientX - lastPointer.x;
      dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };
    }
    aimYaw = THREE.MathUtils.clamp(aimYaw - dx * radPerPx, -0.35, 0.35);
    aimPitch = THREE.MathUtils.clamp(aimPitch - dy * radPerPx, -0.32, 0.32);
  });

  window.addEventListener('pointerup', () => {
    isFiring = false;
    if (!isPointerLocked) stageEl.classList.remove('is-aiming');
  });

  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === glCanvas;
    stageEl.classList.toggle('is-aiming', isPointerLocked);
    if (pointerLockBtnEl) {
      pointerLockBtnEl.classList.toggle('bg-cyan-500/30', isPointerLocked);
      pointerLockBtnEl.classList.toggle('border-cyan-400', isPointerLocked);
    }
  });

  pointerLockBtnEl?.addEventListener('click', () => {
    if (isPointerLocked) document.exitPointerLock?.();
    else glCanvas.requestPointerLock?.();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && document.activeElement?.tagName !== 'INPUT') {
      resetWeaponBurst();
      aimYaw = 0;
      aimPitch = 0;
    }
  });

  weaponSelectEl?.addEventListener('change', () => {
    state.arena.weaponId = weaponSelectEl.value;
    equipWeapon(state.arena.weaponId);
    persist();
  });

  function syncArenaControls() {
    rangeBtns.forEach((btn) => {
      const active = Number(state.arena.distanceMeters) === Number(btn.dataset.arenaRange);
      btn.classList.toggle('bg-cyan-500/20', active);
      btn.classList.toggle('border-cyan-400', active);
      btn.classList.toggle('text-cyan-200', active);
      btn.classList.toggle('border-slate-700', !active);
      btn.classList.toggle('text-slate-400', !active);
    });
    modeBtns.forEach((btn) => {
      const active = state.arena.mode === btn.dataset.arenaMode;
      btn.classList.toggle('bg-amber-500/20', active);
      btn.classList.toggle('border-amber-400', active);
      btn.classList.toggle('text-amber-200', active);
      btn.classList.toggle('border-slate-700', !active);
      btn.classList.toggle('text-slate-400', !active);
    });
    if (ghostToggleEl) ghostToggleEl.checked = Boolean(state.arena.showGhostGuide);
  }

  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arena.distanceMeters = Number(btn.dataset.arenaRange);
      targetWallGroup.position.z = -state.arena.distanceMeters;
      clearDecals();
      rebuildGhostPattern();
      syncArenaControls();
      persist();
    });
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arena.mode = btn.dataset.arenaMode;
      aimYaw = 0;
      aimPitch = 0;
      resetWeaponBurst();
      clearDecals();
      rebuildGhostPattern();
      syncArenaControls();
      persist();
    });
  });

  ghostToggleEl?.addEventListener('change', () => {
    state.arena.showGhostGuide = ghostToggleEl.checked;
    ghostGroup.visible = ghostToggleEl.checked;
    persist();
  });

  soundToggleEl?.addEventListener('click', () => {
    audio.muted = !audio.muted;
    soundToggleEl.classList.toggle('text-slate-500', audio.muted);
    soundToggleEl.classList.toggle('text-cyan-300', !audio.muted);
  });

  clearBtnEl?.addEventListener('click', () => {
    clearDecals();
    resetWeaponBurst();
  });

  resetStatsBtnEl?.addEventListener('click', () => {
    stats.shots = 0;
    stats.hits = 0;
    stats.bullseyes = 0;
    clearDecals();
    resetWeaponBurst();
    updateHudStats();
  });

  const hudCtx = hudCanvas.getContext('2d');
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
    hudCanvas.width = Math.round(stageWidth * dpr);
    hudCanvas.height = Math.round(stageHeight * dpr);
    hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  new ResizeObserver(handleResize).observe(stageEl);
  handleResize();

  // Crosshair Studio Controls + Pro Database wiring
  const proGridEl = document.getElementById('pro-crosshair-grid');
  const shareInputEl = document.getElementById('crosshair-share-code');
  const importBtnEl = document.getElementById('btn-import-crosshair');
  const copyBtnEl = document.getElementById('btn-copy-crosshair');

  const styleEl = document.getElementById('ch-style');
  const lengthEl = document.getElementById('ch-length');
  const thicknessEl = document.getElementById('ch-thickness');
  const gapEl = document.getElementById('ch-gap');
  const alphaEl = document.getElementById('ch-alpha');
  const outlineEl = document.getElementById('ch-outline');
  const dotEl = document.getElementById('ch-dot');
  const tStyleEl = document.getElementById('ch-tstyle');
  const followRecoilEl = document.getElementById('ch-follow-recoil');
  const sniperEl = document.getElementById('ch-sniper-width');
  const colorPickerEl = document.getElementById('ch-color-picker');
  const colorSwatchesEl = document.getElementById('ch-color-swatches');

  const valEls = {
    length: document.getElementById('val-ch-length'),
    thickness: document.getElementById('val-ch-thickness'),
    gap: document.getElementById('val-ch-gap'),
    alpha: document.getElementById('val-ch-alpha'),
    sniperWidth: document.getElementById('val-ch-sniper'),
  };

  function renderSwatches() {
    if (!colorSwatchesEl) return;
    colorSwatchesEl.innerHTML = CROSSHAIR_COLOR_PRESETS.map((preset) => {
      const active =
        Math.abs(state.crosshair.red - preset.r) < 8 &&
        Math.abs(state.crosshair.green - preset.g) < 8 &&
        Math.abs(state.crosshair.blue - preset.b) < 8;
      return `<button type="button" data-color-preset="${preset.id}" title="${preset.label}"
        class="w-7 h-7 rounded-lg border transition-transform hover:scale-110 cursor-pointer ${active ? 'border-white ring-2 ring-cyan-400/70 scale-105' : 'border-slate-600'}"
        style="background-color: rgb(${preset.r}, ${preset.g}, ${preset.b})"></button>`;
    }).join('');
  }

  function renderProGrid() {
    if (!proGridEl) return;
    proGridEl.innerHTML = PRO_CROSSHAIRS.map((pro) => {
      const isSelected = state.crosshair.activeProId === pro.id;
      return `<button type="button" data-pro-id="${pro.id}"
        class="pro-card group flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
          isSelected
            ? 'bg-cyan-500/15 border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.18)]'
            : 'bg-slate-900/70 border-slate-700/60 hover:border-cyan-400/50 hover:bg-slate-800/80'
        }">
        ${buildCrosshairMiniSvg(pro.settings)}
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-sm text-white truncate">${pro.player}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">${pro.tag}</span>
          </div>
          <div class="text-xs text-slate-400 truncate">${pro.team} • ${pro.role}</div>
          <div class="text-[10px] text-slate-500 font-mono truncate mt-0.5">${pro.resolution}</div>
        </div>
      </button>`;
    }).join('');
  }

  function syncCrosshairUi() {
    const ch = state.crosshair;
    if (styleEl) styleEl.value = String(ch.style);
    if (lengthEl) lengthEl.value = String(ch.length);
    if (thicknessEl) thicknessEl.value = String(ch.thickness);
    if (gapEl) gapEl.value = String(ch.gap);
    if (alphaEl) alphaEl.value = String(ch.alpha);
    if (outlineEl) outlineEl.value = String(ch.outlineMode);
    if (dotEl) dotEl.checked = Boolean(ch.centerDotEnabled);
    if (tStyleEl) tStyleEl.checked = Boolean(ch.tStyleEnabled);
    if (followRecoilEl) followRecoilEl.checked = Boolean(ch.followRecoil);
    if (sniperEl) sniperEl.value = String(ch.sniperWidth ?? 1);
    if (colorPickerEl) colorPickerEl.value = rgbToHex(ch.red, ch.green, ch.blue);

    if (valEls.length) valEls.length.textContent = String(ch.length);
    if (valEls.thickness) valEls.thickness.textContent = String(ch.thickness);
    if (valEls.gap) valEls.gap.textContent = String(ch.gap);
    if (valEls.alpha) valEls.alpha.textContent = String(ch.alpha);
    if (valEls.sniperWidth) valEls.sniperWidth.textContent = String(ch.sniperWidth ?? 1);
    if (shareInputEl) shareInputEl.value = encodeCrosshairCode(ch);
    renderSwatches();
    renderProGrid();
  }

  function updateCrosshair(patch) {
    Object.assign(state.crosshair, patch);
    syncCrosshairUi();
    persist();
  }

  styleEl?.addEventListener('change', () => updateCrosshair({ style: Number(styleEl.value), activeProId: null }));
  lengthEl?.addEventListener('input', () => updateCrosshair({ length: Number(lengthEl.value), activeProId: null }));
  thicknessEl?.addEventListener('input', () => updateCrosshair({ thickness: Number(thicknessEl.value), activeProId: null }));
  gapEl?.addEventListener('input', () => updateCrosshair({ gap: Number(gapEl.value), activeProId: null }));
  alphaEl?.addEventListener('input', () => updateCrosshair({ alpha: Number(alphaEl.value), activeProId: null }));
  outlineEl?.addEventListener('change', () => updateCrosshair({ outlineMode: Number(outlineEl.value), activeProId: null }));
  dotEl?.addEventListener('change', () => updateCrosshair({ centerDotEnabled: dotEl.checked, activeProId: null }));
  tStyleEl?.addEventListener('change', () => updateCrosshair({ tStyleEnabled: tStyleEl.checked, activeProId: null }));
  followRecoilEl?.addEventListener('change', () => updateCrosshair({ followRecoil: followRecoilEl.checked, activeProId: null }));
  sniperEl?.addEventListener('input', () => updateCrosshair({ sniperWidth: Number(sniperEl.value), activeProId: null }));
  colorPickerEl?.addEventListener('input', () => {
    const rgb = hexToRgb(colorPickerEl.value);
    if (rgb) updateCrosshair({ red: rgb.r, green: rgb.g, blue: rgb.b, activeProId: null });
  });

  colorSwatchesEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color-preset]');
    if (!btn) return;
    const preset = CROSSHAIR_COLOR_PRESETS.find((p) => p.id === btn.dataset.colorPreset);
    if (preset) updateCrosshair({ red: preset.r, green: preset.g, blue: preset.b, activeProId: null });
  });

  proGridEl?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-pro-id]');
    if (!card) return;
    const pro = getProCrosshairById(card.dataset.proId);
    if (!pro) return;
    updateCrosshair({ ...pro.settings, activeProId: pro.id });
    notify('success', t('arena.proApplied', { player: pro.player }));
  });

  importBtnEl?.addEventListener('click', () => {
    const code = shareInputEl?.value?.trim();
    if (!code) return;
    try {
      const parsed = decodeAnyShareCode(code);
      updateCrosshair({ ...parsed, activeProId: null });
      notify('success', t('arena.codeImported'));
    } catch {
      notify('error', t('arena.invalidCode'));
    }
  });

  copyBtnEl?.addEventListener('click', async () => {
    const code = encodeCrosshairCode(state.crosshair);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      notify('success', t('arena.codeCopied'));
    } catch {
      shareInputEl?.select();
    }
  });

  let lastFrame = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (isFiring && now >= nextShotTime) {
      fireSingleShot(now);
    } else if (!isFiring) {
      const recover = Math.exp(-8.5 * dt);
      recoilYaw *= recover;
      recoilPitch *= recover;
      if (Math.abs(recoilPitch) < 0.0004 && burstIndex > 0) {
        burstIndex = 0;
        updateMagCounter();
      }
    }

    dynamicSpreadPx *= Math.exp(-10 * dt);

    const camPunchScale = state.arena.mode === 'wall' ? 0.12 : 0.35;
    camera.rotation.y = aimYaw + recoilYaw * camPunchScale;
    camera.rotation.x = aimPitch + recoilPitch * camPunchScale;

    kickOffset *= Math.exp(-12 * dt);
    const breathe = Math.sin(now * 0.0018) * 0.0022;
    weaponContainer.position.set(0, breathe, kickOffset * 0.045);
    weaponContainer.rotation.x = kickOffset * 0.065;

    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer -= dt;
      muzzleFlash.material.opacity = 0.92;
      muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.6);
      muzzleLight.intensity = 3.5;
    } else {
      muzzleFlash.material.opacity = 0;
      muzzleLight.intensity = 0;
    }

    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr = tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        tracers.splice(i, 1);
      } else {
        tr.line.material.opacity = tr.life / 0.075;
      }
    }

    renderer.render(scene, camera);

    const pxPerRad = (stageHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const offsetX = -(recoilYaw * (1 - camPunchScale)) * pxPerRad;
    const offsetY = -(recoilPitch * (1 - camPunchScale)) * pxPerRad;

    drawCrosshairOnCanvas(
      hudCtx,
      stageWidth,
      stageHeight,
      state.crosshair,
      dynamicSpreadPx,
      { x: offsetX, y: offsetY },
      1.65,
    );
  }

  syncArenaControls();
  syncCrosshairUi();
  equipWeapon(state.arena.weaponId || 'ak47');
  updateHudStats();
  requestAnimationFrame(animate);
}
