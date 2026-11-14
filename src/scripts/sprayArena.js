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
  loadDust2Map,
  setupDust2Lighting,
  computeDust2RangeLayout,
} from '../utils/dust2MapLoader.js';
import {
  CROSSHAIR_COLOR_PRESETS,
  drawCrosshairOnCanvas,
  rgbToHex,
  hexToRgb,
} from '../utils/crosshairCanvas.js';
import { DEFAULT_FALLBACK_BACKDROP } from '../utils/mapBackdrops.js';
import { loadState, saveState } from '../utils/storage.js';
import { attachGlbDropHandler } from './clientBridge.js';
import { mountProDatabase } from './proDatabaseWidget.js';

const RECOIL_RAD_SCALE = 0.00055;
const MAX_DECALS = 90;

function createTargetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = 'rgba(11, 15, 23, 0.56)';
  ctx.beginPath();
  ctx.arc(256, 256, 224, 0, Math.PI * 2);
  ctx.fill();

  const rings = [
    { r: 210, stroke: 'rgba(255, 157, 0, 0.48)', fill: 'rgba(15, 23, 42, 0.22)', lw: 3 },
    { r: 140, stroke: 'rgba(255, 255, 255, 0.35)', fill: 'rgba(15, 23, 42, 0.14)', lw: 2 },
    { r: 74, stroke: '#ff9d00', fill: 'rgba(255, 157, 0, 0.14)', lw: 3 },
    { r: 26, stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.45)', lw: 3 },
  ];
  rings.forEach((ring) => {
    ctx.beginPath();
    ctx.arc(256, 256, ring.r, 0, Math.PI * 2);
    ctx.fillStyle = ring.fill;
    ctx.fill();
    ctx.lineWidth = ring.lw;
    ctx.strokeStyle = ring.stroke;
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(256, 38);
  ctx.lineTo(256, 474);
  ctx.moveTo(38, 256);
  ctx.lineTo(474, 256);
  ctx.stroke();

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
      this.ctx.resume().catch(() => { });
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
  const fallbackImg = document.getElementById('arena-fallback-bg');
  const hudCanvas = document.getElementById('arena-crosshair');
  if (!stageEl || !glCanvas || !hudCanvas) return;

  const showScreenshotBackdrop = () => {
    if (fallbackImg) {
      fallbackImg.src = DEFAULT_FALLBACK_BACKDROP;
      fallbackImg.classList.remove('hidden');
    }
  };

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
  const mapBadgeEl = document.getElementById('arena-map-badge');

  if (weaponSelectEl) {
    weaponSelectEl.innerHTML = ARENA_WEAPON_LIST.map((id) => {
      const w = getWeaponData(id);
      return `<option value="${w.id}">${w.name} (${w.category}) — $${w.price}</option>`;
    }).join('');
    weaponSelectEl.value = state.arena.weaponId || 'ak47';
  }

  // Three.js Scene + Authentic Dust2 Daylight Rig (falls back to HD CS2 screenshot if WebGL fails)
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  } catch {
    showScreenshotBackdrop();
    glCanvas.classList.add('hidden');
  }

  const scene = new THREE.Scene();
  const { maxAniso } = setupDust2Lighting(scene, renderer);
  if (!renderer) {
    scene.background = null;
  }

  const camera = new THREE.PerspectiveCamera(Number(state.viewmodel.fov || 68), 16 / 9, 0.04, 180);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  let mapMeshes = [];
  let rangeLayout = {
    cameraPos: new THREE.Vector3(-4.08, 1.62, -7.2),
    wallPoint: new THREE.Vector3(15.92, 1.62, -7.2),
    wallNormal: new THREE.Vector3(-1, 0, 0),
    yaw: -Math.PI / 2,
    pitch: 0,
    actualDistance: Number(state.arena.distanceMeters || 20),
  };

  camera.position.copy(rangeLayout.cameraPos);
  camera.rotation.set(0, rangeLayout.yaw, 0);

  const targetTex = createTargetTexture();
  const decalTex = createBulletDecalTexture();

  const targetWallGroup = new THREE.Group();
  scene.add(targetWallGroup);

  const targetPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.75),
    new THREE.MeshBasicMaterial({ map: targetTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  targetWallGroup.add(targetPlane);

  const ghostGroup = new THREE.Group();
  ghostGroup.position.set(0, 0, 0.015);
  targetWallGroup.add(ghostGroup);

  const guideDotMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.036, 0.062, 24),
    new THREE.MeshBasicMaterial({ color: '#ff9d00', transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  guideDotMesh.position.set(0, 0, 0.02);
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
    const dist = rangeLayout.actualDistance || Number(state.arena.distanceMeters || 20);
    const pts = getCumulativeWallPoints(wId, 1);
    const isControl = state.arena.mode === 'control';

    const vertices = pts.map((pt) => {
      const sign = isControl ? -1 : 1;
      const dxRad = sign * pt.cumX * RECOIL_RAD_SCALE;
      const dyRad = sign * pt.cumY * RECOIL_RAD_SCALE;
      return new THREE.Vector3(Math.tan(dxRad) * dist, Math.tan(dyRad) * dist, 0.014);
    });

    const geom = new THREE.BufferGeometry().setFromPoints(vertices);
    const mat = new THREE.LineBasicMaterial({
      color: isControl ? '#ff9d00' : '#fbbf24',
      transparent: true,
      opacity: 0.72,
    });
    ghostPathLine = new THREE.Line(geom, mat);
    ghostGroup.add(ghostPathLine);
    ghostGroup.visible = Boolean(state.arena.showGhostGuide);
  }

  function applyRangePosition() {
    rangeLayout = computeDust2RangeLayout(mapMeshes, Number(state.arena.distanceMeters || 20));
    camera.position.copy(rangeLayout.cameraPos);

    targetWallGroup.position
      .copy(rangeLayout.wallPoint)
      .addScaledVector(rangeLayout.wallNormal, 0.018);
    targetWallGroup.lookAt(
      rangeLayout.wallPoint.clone().addScaledVector(rangeLayout.wallNormal, 2),
    );
    rebuildGhostPattern();
  }

  // Load real de_dust2_slice.glb asynchronously; fall back to HD CS2 in-game screenshot if missing
  loadDust2Map(scene, maxAniso).then((res) => {
    mapMeshes = res.mapMeshes;
    applyRangePosition();
    if (res.isFallback) {
      scene.background = null;
      renderer?.setClearColor(0x000000, 0);
      showScreenshotBackdrop();
    }
    if (mapBadgeEl) {
      mapBadgeEl.textContent = res.isFallback
          ? 'CS2 1080p · de_dust2'
          : 'de_dust2 • Long A';
      if (res.isFallback) {
        mapBadgeEl.classList.add('text-amber-300', 'border-amber-500/40');
      }
    }
  });

  const decalsWorldGroup = new THREE.Group();
  scene.add(decalsWorldGroup);
  const decalPool = [];
  const tracers = [];
  const decalMat = new THREE.MeshBasicMaterial({
    map: decalTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const decalGeom = new THREE.PlaneGeometry(0.11, 0.11);

  function addBulletDecalWorld(worldPt, worldNormal) {
    const mesh = new THREE.Mesh(decalGeom, decalMat);
    mesh.position.copy(worldPt).addScaledVector(worldNormal, 0.012 + decalPool.length * 0.0003);
    mesh.lookAt(worldPt.clone().add(worldNormal));
    mesh.rotateZ(Math.random() * Math.PI * 2);
    decalsWorldGroup.add(mesh);
    decalPool.push(mesh);
    if (decalPool.length > MAX_DECALS) {
      decalsWorldGroup.remove(decalPool.shift());
    }
  }

  function clearDecals() {
    while (decalPool.length) {
      decalsWorldGroup.remove(decalPool.pop());
    }
  }

  function spawnTracer(startWorld, endWorld) {
    const geom = new THREE.BufferGeometry().setFromPoints([startWorld, endWorld]);
    const mat = new THREE.LineBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.88 });
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
  const shotRaycaster = new THREE.Raycaster();

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
      recoilYaw -= step.bulletDx * RECOIL_RAD_SCALE;
      recoilPitch += step.bulletDy * RECOIL_RAD_SCALE;
    }

    const spreadRad = w.spreadBase * (1 + burstIndex * 0.04);
    const randYaw = (Math.random() - 0.5) * spreadRad;
    const randPitch = (Math.random() - 0.5) * spreadRad;

    const effectiveYaw = (state.arena.mode === 'wall' ? 0 : aimYaw) + recoilYaw + randYaw;
    const effectivePitch = (state.arena.mode === 'wall' ? 0 : aimPitch) + recoilPitch + randPitch;

    const shootEuler = new THREE.Euler(effectivePitch, rangeLayout.yaw + effectiveYaw, 0, 'YXZ');
    const shootDir = new THREE.Vector3(0, 0, -1).applyEuler(shootEuler).normalize();

    shotRaycaster.set(camera.position, shootDir);
    const rayTargets = mapMeshes.length ? [...mapMeshes] : [targetPlane];
    const hits = shotRaycaster.intersectObjects(rayTargets, false);

    const dist = rangeLayout.actualDistance || Number(state.arena.distanceMeters || 20);
    let hitPoint = camera.position.clone().addScaledVector(shootDir, dist);
    let hitNormal = rangeLayout.wallNormal.clone();

    if (hits.length > 0) {
      hitPoint = hits[0].point.clone();
      if (hits[0].face) {
        hitNormal
          .copy(hits[0].face.normal)
          .transformDirection(hits[0].object.matrixWorld)
          .normalize();
      }
    }

    addBulletDecalWorld(hitPoint, hitNormal);

    const muzzleWorld = new THREE.Vector3();
    muzzleFlash.getWorldPosition(muzzleWorld);
    spawnTracer(muzzleWorld, hitPoint);

    const localImpact = targetWallGroup.worldToLocal(hitPoint.clone());
    const radialDist = Math.hypot(localImpact.x, localImpact.y);
    stats.shots += 1;
    if (radialDist <= 0.44) {
      stats.hits += 1;
      if (radialDist <= 0.17) stats.bullseyes += 1;
    }

    if (state.arena.mode === 'control') {
      guideDotMesh.position.set(Math.tan(recoilYaw) * dist, Math.tan(-recoilPitch) * dist, 0.02);
    } else {
      guideDotMesh.position.set(localImpact.x, localImpact.y, 0.02);
    }

    kickOffset = Math.min(1.0, kickOffset + 0.55);
    const limitScale = Math.max(0.2, Math.min(2.2, Number(state.crosshair.dynamicSpreadLimit ?? 227) / 140));
    dynamicSpreadPx = Math.min(24 * limitScale, dynamicSpreadPx + 4.5);
    muzzleFlashTimer = 0.045;
    audio.playShot(weaponId);

    burstIndex += 1;
    nextShotTime = nowMs + (step.delayMs || w.fireIntervalMs || 100);
    if (!w.auto) isFiring = false;
    updateHudStats();
  }

    stageEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      audio.ensureCtx();
      lastPointer = { x: e.clientX, y: e.clientY };

      if (!isPointerLocked && state.arena.mode === 'control') {
        aimYaw = 0;
        aimPitch = 0;
        camera.rotation.y = rangeLayout.yaw;
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
        pointerLockBtnEl.classList.toggle('bg-[#ff9d00]/20', isPointerLocked);
        pointerLockBtnEl.classList.toggle('border-[#ff9d00]', isPointerLocked);
        pointerLockBtnEl.classList.toggle('text-[#ff9d00]', isPointerLocked);
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
        btn.classList.toggle('bg-[#ff9d00]/20', active);
        btn.classList.toggle('border-[#ff9d00]', active);
        btn.classList.toggle('text-[#ff9d00]', active);
        btn.classList.toggle('border-slate-700', !active);
        btn.classList.toggle('text-slate-400', !active);
      });
      modeBtns.forEach((btn) => {
        const active = state.arena.mode === btn.dataset.arenaMode;
        btn.classList.toggle('bg-[#ff9d00]/20', active);
        btn.classList.toggle('border-[#ff9d00]', active);
        btn.classList.toggle('text-[#ff9d00]', active);
        btn.classList.toggle('border-slate-700', !active);
        btn.classList.toggle('text-slate-400', !active);
      });
      if (ghostToggleEl) ghostToggleEl.checked = Boolean(state.arena.showGhostGuide);
    }

    rangeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.arena.distanceMeters = Number(btn.dataset.arenaRange);
        clearDecals();
        applyRangePosition();
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
      soundToggleEl.classList.toggle('text-[#ff9d00]', !audio.muted);
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
      if (renderer) {
        renderer.setSize(stageWidth, stageHeight, false);
      }
      camera.aspect = stageWidth / stageHeight;
      camera.updateProjectionMatrix();
      hudCanvas.width = Math.round(stageWidth * dpr);
      hudCanvas.height = Math.round(stageHeight * dpr);
      hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    new ResizeObserver(handleResize).observe(stageEl);
    handleResize();

    // Crosshair Studio Controls + Shared Esports Pro Database wiring
    const styleEl = document.getElementById('ch-style');
    const lengthEl = document.getElementById('ch-length');
    const thicknessEl = document.getElementById('ch-thickness');
    const gapEl = document.getElementById('ch-gap');
    const alphaEl = document.getElementById('ch-alpha');
    const outlineEl = document.getElementById('ch-outline');
    const outlineThicknessEl = document.getElementById('ch-outline-thickness');
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
      outlineThickness: document.getElementById('val-ch-outline-thickness'),
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
        class="w-7 h-7 rounded-sm border transition-transform hover:scale-110 cursor-pointer ${active ? 'border-white ring-2 ring-[#ff9d00]/80 scale-105' : 'border-slate-700'}"
        style="background-color: rgb(${preset.r}, ${preset.g}, ${preset.b})"></button>`;
      }).join('');
    }

    let proDbCtrl = null;

      function syncCrosshairUi() {
        const ch = state.crosshair;
        if (styleEl) styleEl.value = String(ch.style);
        if (lengthEl) lengthEl.value = String(ch.length);
        if (thicknessEl) thicknessEl.value = String(ch.thickness);
        if (gapEl) gapEl.value = String(ch.gap);
        if (alphaEl) alphaEl.value = String(ch.alpha);
        if (outlineEl) outlineEl.value = String(ch.outlineMode);
        if (outlineThicknessEl) outlineThicknessEl.value = String(ch.outlineThickness ?? 1);
        if (dotEl) dotEl.checked = Boolean(ch.centerDotEnabled);
        if (tStyleEl) tStyleEl.checked = Boolean(ch.tStyleEnabled);
        if (followRecoilEl) followRecoilEl.checked = Boolean(ch.followRecoil);
        if (sniperEl) sniperEl.value = String(ch.sniperWidth ?? 1);
        if (colorPickerEl) colorPickerEl.value = rgbToHex(ch.red, ch.green, ch.blue);

      if (valEls.length) valEls.length.textContent = String(ch.length);
      if (valEls.thickness) valEls.thickness.textContent = String(ch.thickness);
      if (valEls.gap) valEls.gap.textContent = String(ch.gap);
      if (valEls.alpha) valEls.alpha.textContent = String(ch.alpha);
      if (valEls.outlineThickness) valEls.outlineThickness.textContent = Number(ch.outlineThickness ?? 1).toFixed(1);
      if (valEls.sniperWidth) valEls.sniperWidth.textContent = String(ch.sniperWidth ?? 1);
      renderSwatches();
      proDbCtrl?.sync();
    }

    function updateCrosshair(patch) {
      Object.assign(state.crosshair, patch);
      syncCrosshairUi();
      persist();
    }

    proDbCtrl = mountProDatabase({
      state,
      onApplyCrosshair: (patch) => updateCrosshair(patch),
    });

    styleEl?.addEventListener('change', () => updateCrosshair({ style: Number(styleEl.value), activeProId: null }));
    lengthEl?.addEventListener('input', () => updateCrosshair({ length: Number(lengthEl.value), activeProId: null }));
    thicknessEl?.addEventListener('input', () => updateCrosshair({ thickness: Number(thicknessEl.value), activeProId: null }));
    gapEl?.addEventListener('input', () => updateCrosshair({ gap: Number(gapEl.value), activeProId: null }));
    alphaEl?.addEventListener('input', () => updateCrosshair({ alpha: Number(alphaEl.value), activeProId: null }));
    outlineEl?.addEventListener('change', () => updateCrosshair({ outlineMode: Number(outlineEl.value), activeProId: null }));
    outlineThicknessEl?.addEventListener('input', () => updateCrosshair({ outlineThickness: Number(outlineThicknessEl.value), activeProId: null }));
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
      camera.rotation.y = rangeLayout.yaw + aimYaw + recoilYaw * camPunchScale;
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

      renderer?.render(scene, camera);

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
