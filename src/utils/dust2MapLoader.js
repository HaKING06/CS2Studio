import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const DUST2_MAP_PATH = '/models/de_dust2_slice.glb';

/**
 * Configure authentic Dust2 A-site/Long daylight sky, fog, and directional sun lighting.
 */
export function setupDust2Lighting(scene, renderer) {
  scene.background = new THREE.Color('#b9cde2');
  scene.fog = new THREE.FogExp2('#d7cdb8', 0.0085);

  const hemiLight = new THREE.HemisphereLight(0x8aa6cf, 0x807868, 0.82);
  scene.add(hemiLight);

  const sunDir = new THREE.Vector3(0.78, 0.80, 0.62).normalize().multiplyScalar(42);
  const sunLight = new THREE.DirectionalLight(0xffe6c8, 3.85);
  sunLight.position.copy(sunDir);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 110;
  sunLight.shadow.camera.left = -35;
  sunLight.shadow.camera.right = 35;
  sunLight.shadow.camera.top = 35;
  sunLight.shadow.camera.bottom = -35;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const rimFill = new THREE.AmbientLight(0xdbe6f2, 0.35);
  scene.add(rimFill);

  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  return { maxAniso: Math.min(8, maxAniso) };
}

function tuneMapMaterials(root, maxAniso) {
  const mapMeshes = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const name = (obj.name || '').toLowerCase();
    const isGround = name.includes('ground') || name.includes('road') || name.includes('sand') || name.includes('cobble');
    obj.receiveShadow = true;
    obj.castShadow = !isGround;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (name.includes('barrel') || name.includes('iron')) {
        mat.metalness = 0.55;
      }
      if (mat.normalMap && mat.normalScale) {
        mat.normalScale.set(isGround ? 0.75 : 0.55, isGround ? 0.75 : 0.55);
      }
      for (const key of ['map', 'normalMap', 'roughnessMap']) {
        if (mat[key]) {
          mat[key].anisotropy = maxAniso;
          mat[key].minFilter = THREE.LinearMipmapLinearFilter;
          mat[key].needsUpdate = true;
        }
      }
      mat.needsUpdate = true;
    }

    mapMeshes.push(obj);
  });
  return mapMeshes;
}

function createEmergencyDustPlane() {
  const grp = new THREE.Group();
  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc2ab84, roughness: 0.92 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  const wallGeo = new THREE.BoxGeometry(1, 10, 26);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd4be98, roughness: 0.88 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(16, 5, -7.2);
  wall.receiveShadow = true;

  grp.add(floor, wall);
  return { root: grp, mapMeshes: [floor, wall], isFallback: true };
}

/**
 * Load the authentic de_dust2_slice.glb map model into the scene.
 * Logs a styled manual drop warning to DevTools console if the GLB cannot be loaded.
 */
export async function loadDust2Map(scene, maxAniso = 8) {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(DUST2_MAP_PATH);
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const mapMeshes = tuneMapMaterials(root, maxAniso);
    scene.add(root);
    return { root, mapMeshes, isFallback: false };
  } catch (err) {
    console.error(
      '%c[CS2 STUDIO] Missing or unreachable Dust2 map GLB (/models/de_dust2_slice.glb).%c\nDrop your authentic "de_dust2_slice.glb" file directly into /public/models/de_dust2_slice.glb and refresh.',
      'background:#ff9d00;color:#0b0f17;font-weight:900;padding:4px 8px;border-radius:3px;',
      'color:#fbbf24;font-weight:600;',
      err,
    );
    const emergency = createEmergencyDustPlane();
    scene.add(emergency.root);
    return emergency;
  }
}

/**
 * Compute authentic raycasted shooter & wall-target coordinates along Dust2 Long -> A-Site East Goose lane (Z = -7.2, facing +X).
 */
export function computeDust2RangeLayout(mapMeshes, distanceMeters = 20) {
  const laneZ = -7.2;
  const eastWallFallbackX = 15.92;
  const dist = Math.max(8, Math.min(42, Number(distanceMeters || 20)));
  const raycaster = new THREE.Raycaster();

  // First probe the exact East Goose sandstone wall surface from x = 5 along +X
  let wallX = eastWallFallbackX;
  const wallProbeOrigin = new THREE.Vector3(5, 1.62, laneZ);
  const viewDir = new THREE.Vector3(1, 0, 0);
  raycaster.set(wallProbeOrigin, viewDir);
  const wallHits = raycaster.intersectObjects(mapMeshes, false);
  const forwardWall = wallHits.find((h) => h.distance > 2);
  if (forwardWall) {
    wallX = forwardWall.point.x;
  }

  const shooterX = wallX - dist;

  // Raycast downward at shooterX, laneZ to stand solidly on Dust2 sand/road floor
  raycaster.set(new THREE.Vector3(shooterX, 10, laneZ), new THREE.Vector3(0, -1, 0));
  const floorHits = raycaster.intersectObjects(mapMeshes, false);
  const floorY = floorHits.length > 0 ? floorHits[0].point.y : 0;

  const eyeY = floorY + 1.62;
  const cameraPos = new THREE.Vector3(shooterX, eyeY, laneZ);

  // Confirm final raycast target directly from eye position toward +X wall
  raycaster.set(cameraPos, viewDir);
  const targetHits = raycaster.intersectObjects(mapMeshes, false);
  const firstWallHit = targetHits.find((h) => h.distance > 3);
  const wallPoint = firstWallHit
    ? firstWallHit.point.clone()
    : new THREE.Vector3(wallX, eyeY, laneZ);

  const wallNormal = new THREE.Vector3(-1, 0, 0);
  if (firstWallHit?.face) {
    wallNormal
      .copy(firstWallHit.face.normal)
      .transformDirection(firstWallHit.object.matrixWorld)
      .normalize();
  }

  return {
    cameraPos,
    wallPoint,
    wallNormal,
    yaw: -Math.PI / 2, // Facing East (+X) down Long A toward Goose wall
    pitch: 0,
    actualDistance: cameraPos.distanceTo(wallPoint),
  };
}
