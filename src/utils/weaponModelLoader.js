import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const glbTemplateCache = new Map();

// Target normalized weapon lengths in viewmodel / 3D meters
const TARGET_LENGTH_BY_KEY = {
  awp: 1.05,
  m4a1s: 0.96,
  m4a4: 0.90,
  ak47: 0.88,
  galil: 0.85,
  famas: 0.80,
  mp9: 0.56,
  usps: 0.44,
  deagle: 0.38,
  glock: 0.34,
};

// Camera-space FPS right-handed poses after normalizing barrel to -Z, +Y up
export const FPS_POSES = {
  ak47:   { pos: [0.18, -0.22, -0.44], rot: [0.02, 0.04, -0.015] },
  m4a4:   { pos: [0.18, -0.22, -0.45], rot: [0.02, 0.04, -0.015] },
  m4a1s:  { pos: [0.18, -0.22, -0.46], rot: [0.02, 0.04, -0.015] },
  galil:  { pos: [0.18, -0.22, -0.44], rot: [0.02, 0.04, -0.015] },
  famas:  { pos: [0.18, -0.22, -0.44], rot: [0.02, 0.04, -0.015] },
  mp9:    { pos: [0.17, -0.20, -0.41], rot: [0.02, 0.04, -0.01] },
  awp:    { pos: [0.18, -0.23, -0.48], rot: [0.02, 0.035, -0.015] },
  deagle: { pos: [0.16, -0.17, -0.37], rot: [0.01, 0.02, -0.01] },
  usps:   { pos: [0.16, -0.17, -0.39], rot: [0.01, 0.02, -0.01] },
  glock:  { pos: [0.16, -0.17, -0.36], rot: [0.01, 0.02, -0.01] },
};

export function inferModelKey(urlOrName = '') {
  const s = String(urlOrName).toLowerCase();
  if (s.includes('m4a1')) return 'm4a1s';
  if (s.includes('m4a4')) return 'm4a4';
  if (s.includes('galil')) return 'galil';
  if (s.includes('famas')) return 'famas';
  if (s.includes('awp')) return 'awp';
  if (s.includes('mp9')) return 'mp9';
  if (s.includes('deagle')) return 'deagle';
  if (s.includes('usp')) return 'usps';
  if (s.includes('glock')) return 'glock';
  return 'ak47';
}

/**
 * Strips Source 2 `body_legacy` duplicate layer (if present alongside `body_hd`),
 * centers geometry at origin, scales to realistic CS2 length, and aligns barrel (+X in Source GLBs)
 * to point downrange along -Z while keeping +Y up.
 */
export function normalizeWeaponScene(rawScene, modelKey = 'ak47') {
  const root = rawScene.clone(true);

  // Strip body_legacy mesh when body_hd exists (Valve Source 2 GLB exports contain both)
  if (root.children && root.children.length >= 2) {
    const legacyNodes = root.children.filter((ch) =>
      String(ch.name || '').toLowerCase().includes('legacy'),
    );
    if (legacyNodes.length > 0 && legacyNodes.length < root.children.length) {
      legacyNodes.forEach((n) => root.remove(n));
    } else if (root.children.length === 2) {
      root.remove(root.children[0]);
    }
  }

  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          mat.metalness = Math.min(0.88, (mat.metalness ?? 0.35) + 0.15);
          mat.roughness = Math.max(0.24, Math.min(0.68, mat.roughness ?? 0.45));
          mat.envMapIntensity = 1.25;
        });
      }
    }
  });

  root.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  rawBox.getSize(size);
  rawBox.getCenter(center);

  // Source 2 GLBs have longest barrel dimension along local X (+X forward barrel, +Y up)
  const majorDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetLength = TARGET_LENGTH_BY_KEY[modelKey] ?? 0.85;
  const scale = targetLength / majorDim;

  const centeredHolder = new THREE.Group();
  root.position.set(-center.x, -center.y, -center.z);
  centeredHolder.add(root);

  const normalizedGroup = new THREE.Group();
  normalizedGroup.scale.setScalar(scale);

  // Orient +X barrel -> -Z downrange in Three.js view space
  if (size.x >= size.z) {
    normalizedGroup.rotation.y = Math.PI / 2;
  }
  normalizedGroup.add(centeredHolder);
  normalizedGroup.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(normalizedGroup);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);

  // Attach synthetic Muzzle anchor at front tip (-Z) and upper receiver height (+Y)
  const muzzle = new THREE.Object3D();
  muzzle.name = 'Muzzle';
  muzzle.position.set(0, finalSize.y * 0.14, -finalSize.z * 0.49);
  normalizedGroup.add(muzzle);

  normalizedGroup.userData.modelKey = modelKey;
  normalizedGroup.userData.size = finalSize;
  return normalizedGroup;
}

export async function loadNormalizedWeapon(modelUrl) {
  const key = inferModelKey(modelUrl);
  if (glbTemplateCache.has(modelUrl)) {
    return normalizeWeaponScene(glbTemplateCache.get(modelUrl), key);
  }

  const gltfScene = await new Promise((resolve, reject) => {
    loader.load(
      modelUrl,
      (gltf) => resolve(gltf.scene),
      undefined,
      reject,
    );
  });

  glbTemplateCache.set(modelUrl, gltfScene);
  return normalizeWeaponScene(gltfScene, key);
}

export async function loadNormalizedWeaponFromFile(file) {
  const buffer = await file.arrayBuffer();
  const key = inferModelKey(file.name);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });
  return normalizeWeaponScene(gltf.scene, key);
}
