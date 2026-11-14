import * as THREE from 'three';
import {
  CROSSHAIR_COLOR_PRESETS,
  drawCrosshairOnCanvas,
  rgbToHex,
  hexToRgb,
} from '../utils/crosshairCanvas.js';
import {
loadDust2Map,
  setupDust2Lighting,
  getDust2ViewPose,
} from '../utils/dust2MapLoader.js';
import { CS2_MAP_BACKDROPS, DEFAULT_FALLBACK_BACKDROP } from '../utils/mapBackdrops.js';
import { FPS_POSES, loadNormalizedWeapon } from '../utils/weaponModelLoader.js';
import { generateCrosshairConVars } from '../utils/shareCode.js';
import { DEFAULT_CROSSHAIR, loadState, saveState } from '../utils/storage.js';
import { notify, t } from './clientBridge.js';
import { mountProDatabase } from './proDatabaseWidget.js';

export function mountCrosshairPage() {
  const stageEl = document.getElementById('ch-preview-stage');
  const glCanvas = document.getElementById('ch-preview-webgl');
  const backdropImg = document.getElementById('ch-preview-backdrop');
  const hudCanvas = document.getElementById('ch-preview-hud');
  if (!stageEl || !hudCanvas) return;

  const state = loadState();
  const persist = () => saveState(state);

  const copyConVarsBtnEl = document.getElementById('btn-copy-convars');
  const resetBtnEl = document.getElementById('btn-ch-reset');
  const testSpreadEl = document.getElementById('ch-test-spread');
  const scopePreviewEl = document.getElementById('ch-scope-preview');
  const weaponToggleEl = document.getElementById('ch-show-weapon');
  const conVarsOutEl = document.getElementById('ch-convars-output');
  const viewBadgeEl = document.getElementById('ch-viewport-badge');
  const viewBtns = document.querySelectorAll('[data-ch-view]');
  const mapSelectEl = document.getElementById('ch-map-select');

  const styleEl = document.getElementById('ch-style');
  const lengthEl = document.getElementById('ch-length');
  const thicknessEl = document.getElementById('ch-thickness');
  const gapEl = document.getElementById('ch-gap');
  const alphaEl = document.getElementById('ch-alpha');
  const outlineEl = document.getElementById('ch-outline');
  const outlineThickEl = document.getElementById('ch-outline-thickness');
  const dotEl = document.getElementById('ch-dot');
  const tStyleEl = document.getElementById('ch-tstyle');
  const followRecoilEl = document.getElementById('ch-follow-recoil');
  const sniperEl = document.getElementById('ch-sniper-width');
  const splitDistEl = document.getElementById('ch-split-dist');
  const innerAlphaEl = document.getElementById('ch-inner-alpha');
  const outerAlphaEl = document.getElementById('ch-outer-alpha');
  const splitRatioEl = document.getElementById('ch-split-ratio');
  const spreadLimitEl = document.getElementById('ch-spread-limit');
  const colorPickerEl = document.getElementById('ch-color-picker');
  const colorSwatchesEl = document.getElementById('ch-color-swatches');

  const valEls = {
    length: document.getElementById('val-ch-length'),
    thickness: document.getElementById('val-ch-thickness'),
    gap: document.getElementById('val-ch-gap'),
    alpha: document.getElementById('val-ch-alpha'),
    outlineThickness: document.getElementById('val-ch-outline-thickness'),
    sniperWidth: document.getElementById('val-ch-sniper'),
    splitDistance: document.getElementById('val-ch-split-dist'),
    innerSplitAlpha: document.getElementById('val-ch-inner-alpha'),
    outerSplitAlpha: document.getElementById('val-ch-outer-alpha'),
    splitSizeRatio: document.getElementById('val-ch-split-ratio'),
    dynamicSpreadLimit: document.getElementById('val-ch-spread-limit'),
  };

  let simulateBurst = false;
  let previewScope = false;
  let showWeapon = Boolean(weaponToggleEl?.checked ?? true);
  let activeMode = '3d-long-wall'; // '3d-*' = Option A (.GLB 3D), 'img-*' = Option B (1080p CS2 WebP)
  let webglAvailable = false;

  const hudCtx = hudCanvas.getContext('2d');
  let stageWidth = 720;
  let stageHeight = 405;

    // Option A: Real Three.js 3D Dust2 (.GLB) Viewport + Fallback to Option B Real 1080p CS2 Screenshot
    let renderer = null;
    let scene = null;
    let camera = null;
    let mapMeshes = [];
    let baseYaw = -Math.PI / 2;
    let basePitch = 0;
    let lookYawOffset = 0;
    let lookPitchOffset = 0;
    let weaponRig = null;

      function applyViewportMode() {
        const isScreenshot = activeMode.startsWith('img-') || !webglAvailable;
        if (isScreenshot) {
          const entry =
            CS2_MAP_BACKDROPS.find((m) => m.id === activeMode) || CS2_MAP_BACKDROPS[0];
          if (backdropImg) {
            backdropImg.src = entry.src || DEFAULT_FALLBACK_BACKDROP;
            backdropImg.classList.remove('hidden');
          }
          glCanvas?.classList.add('hidden');
          if (mapSelectEl && activeMode.startsWith('img-')) {
            mapSelectEl.value = entry.id;
          }
          if (viewBadgeEl) {
            viewBadgeEl.textContent = `CS2 1080p · ${entry.label}`;
          }
        } else {
          backdropImg?.classList.add('hidden');
          glCanvas?.classList.remove('hidden');
          if (mapSelectEl) mapSelectEl.value = '';
          if (camera) {
            const pose = getDust2ViewPose(mapMeshes, activeMode);
            camera.position.copy(pose.pos);
            baseYaw = pose.yaw;
            basePitch = pose.pitch;
            lookYawOffset = 0;
            lookPitchOffset = 0;
          }
          if (viewBadgeEl) {
            const btn = Array.from(viewBtns).find((b) => b.dataset.chView === activeMode);
            viewBadgeEl.textContent = btn?.textContent?.trim() || '3D Dust2 (.GLB)';
          }
        }

        viewBtns.forEach((btn) => {
          const isAct = !isScreenshot && btn.dataset.chView === activeMode;
          btn.classList.toggle('bg-[#ff9d00]/20', isAct);
          btn.classList.toggle('border-[#ff9d00]', isAct);
          btn.classList.toggle('text-[#ff9d00]', isAct);
          btn.classList.toggle('bg-[#0b0f17]', !isAct);
          btn.classList.toggle('border-slate-700', !isAct);
          btn.classList.toggle('text-slate-400', !isAct);
        });
      }

      function initWebGL3D() {
        if (!glCanvas) return;
        try {
          renderer = new THREE.WebGLRenderer({
            canvas: glCanvas,
            antialias: true,
            powerPreference: 'high-performance',
          });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;

          scene = new THREE.Scene();
          const { maxAniso } = setupDust2Lighting(scene, renderer);

          camera = new THREE.PerspectiveCamera(Number(state.viewmodel?.fov || 68), 16 / 9, 0.04, 180);
          camera.rotation.order = 'YXZ';
          scene.add(camera);

          weaponRig = new THREE.Group();
          scene.add(weaponRig);
          camera.add(weaponRig);
          const vm = state.viewmodel || { offsetX: 2.5, offsetY: 0, offsetZ: -1.5 };
          const pose = FPS_POSES.ak47;
          weaponRig.position.set(
            pose.pos[0] + (vm.offsetX - 2.5) * 0.025,
            pose.pos[1] + vm.offsetZ * 0.02,
            pose.pos[2] - vm.offsetY * 0.03,
          );
          weaponRig.rotation.set(...pose.rot);
          weaponRig.visible = showWeapon;

          loadNormalizedWeapon('ak47').then(({ root }) => {
            if (weaponRig && root) weaponRig.add(root);
          });

          webglAvailable = true;
          applyViewportMode();

          loadDust2Map(scene, maxAniso).then((res) => {
            if (res.isFallback) {
              // Real HD 1080p CS2 screenshot fallback when GLB cannot load
              webglAvailable = false;
              activeMode = CS2_MAP_BACKDROPS[0].id;
              applyViewportMode();
              return;
            }
            mapMeshes = res.mapMeshes;
            applyViewportMode();
          });

          // Subtle mouse-drag orbit look inside the 3D Dust2 scene
          let dragging = false;
          let lastX = 0;
          let lastY = 0;
          glCanvas.addEventListener('pointerdown', (e) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            glCanvas.setPointerCapture?.(e.pointerId);
          });
          glCanvas.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            lookYawOffset -= dx * 0.0035;
            lookPitchOffset = Math.max(-0.55, Math.min(0.55, lookPitchOffset - dy * 0.003));
          });
          const stopDrag = () => { dragging = false; };
          glCanvas.addEventListener('pointerup', stopDrag);
          glCanvas.addEventListener('pointercancel', stopDrag);
        } catch {
          webglAvailable = false;
          activeMode = CS2_MAP_BACKDROPS[0].id;
          applyViewportMode();
        }
      }

      function handleResize() {
        const rect = stageEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        stageWidth = rect.width;
        stageHeight = rect.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (renderer && camera) {
          renderer.setSize(stageWidth, stageHeight, false);
          camera.aspect = stageWidth / stageHeight;
          camera.updateProjectionMatrix();
        }
        hudCanvas.width = Math.round(stageWidth * dpr);
        hudCanvas.height = Math.round(stageHeight * dpr);
        hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      new ResizeObserver(handleResize).observe(stageEl);
      initWebGL3D();
      handleResize();

      function renderSwatches() {
        if (!colorSwatchesEl) return;
        colorSwatchesEl.innerHTML = CROSSHAIR_COLOR_PRESETS.map((preset) => {
          const active =
            Math.abs(state.crosshair.red - preset.r) < 8 &&
            Math.abs(state.crosshair.green - preset.g) < 8 &&
            Math.abs(state.crosshair.blue - preset.b) < 8;
          return `<button type="button" data-color-preset="${preset.id}" title="${preset.label}"
        class="w-7 h-7 rounded-sm border transition-transform hover:scale-110 cursor-pointer ${active ? 'border-white ring-2 ring-[#ff9d00] scale-105' : 'border-slate-700'}"
        style="background-color: rgb(${preset.r}, ${preset.g}, ${preset.b})"></button>`;
        }).join('');
      }

      let proDbCtrl = null;

      function syncUi() {
        const ch = state.crosshair;
        if (styleEl) styleEl.value = String(ch.style);
        if (lengthEl) lengthEl.value = String(ch.length);
        if (thicknessEl) thicknessEl.value = String(ch.thickness);
        if (gapEl) gapEl.value = String(ch.gap);
        if (alphaEl) alphaEl.value = String(ch.alpha);
        if (outlineEl) outlineEl.value = String(ch.outlineMode);
        if (outlineThickEl) outlineThickEl.value = String(ch.outlineThickness ?? 1);
        if (dotEl) dotEl.checked = Boolean(ch.centerDotEnabled);
        if (tStyleEl) tStyleEl.checked = Boolean(ch.tStyleEnabled);
        if (followRecoilEl) followRecoilEl.checked = Boolean(ch.followRecoil);
        if (sniperEl) sniperEl.value = String(ch.sniperWidth ?? 1);
        if (splitDistEl) splitDistEl.value = String(ch.splitDistance ?? 6);
        if (innerAlphaEl) innerAlphaEl.value = String(ch.innerSplitAlpha ?? 1);
        if (outerAlphaEl) outerAlphaEl.value = String(ch.outerSplitAlpha ?? 0.5);
        if (splitRatioEl) splitRatioEl.value = String(ch.splitSizeRatio ?? 0.3);
        if (spreadLimitEl) spreadLimitEl.value = String(ch.dynamicSpreadLimit ?? 227);
        if (colorPickerEl) colorPickerEl.value = rgbToHex(ch.red, ch.green, ch.blue);

        if (valEls.length) valEls.length.textContent = String(ch.length);
        if (valEls.thickness) valEls.thickness.textContent = String(ch.thickness);
        if (valEls.gap) valEls.gap.textContent = String(ch.gap);
        if (valEls.alpha) valEls.alpha.textContent = String(ch.alpha);
        if (valEls.outlineThickness) valEls.outlineThickness.textContent = Number(ch.outlineThickness ?? 1).toFixed(1);
        if (valEls.sniperWidth) valEls.sniperWidth.textContent = String(ch.sniperWidth ?? 1);
        if (valEls.splitDistance) valEls.splitDistance.textContent = String(ch.splitDistance ?? 6);
        if (valEls.innerSplitAlpha) valEls.innerSplitAlpha.textContent = Number(ch.innerSplitAlpha ?? 1).toFixed(2);
        if (valEls.outerSplitAlpha) valEls.outerSplitAlpha.textContent = Number(ch.outerSplitAlpha ?? 0.5).toFixed(2);
        if (valEls.splitSizeRatio) valEls.splitSizeRatio.textContent = Number(ch.splitSizeRatio ?? 0.3).toFixed(2);
        if (valEls.dynamicSpreadLimit) valEls.dynamicSpreadLimit.textContent = String(ch.dynamicSpreadLimit ?? 227);

        if (conVarsOutEl) conVarsOutEl.textContent = generateCrosshairConVars(ch);
        renderSwatches();
        proDbCtrl?.sync();
      }

      function updateCrosshair(patch) {
        Object.assign(state.crosshair, patch);
        syncUi();
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
      outlineThickEl?.addEventListener('input', () => updateCrosshair({ outlineThickness: Number(outlineThickEl.value), activeProId: null }));
      dotEl?.addEventListener('change', () => updateCrosshair({ centerDotEnabled: dotEl.checked, activeProId: null }));
      tStyleEl?.addEventListener('change', () => updateCrosshair({ tStyleEnabled: tStyleEl.checked, activeProId: null }));
      followRecoilEl?.addEventListener('change', () => updateCrosshair({ followRecoil: followRecoilEl.checked, activeProId: null }));
      sniperEl?.addEventListener('input', () => updateCrosshair({ sniperWidth: Number(sniperEl.value), activeProId: null }));
      splitDistEl?.addEventListener('input', () => updateCrosshair({ splitDistance: Number(splitDistEl.value), activeProId: null }));
      innerAlphaEl?.addEventListener('input', () => updateCrosshair({ innerSplitAlpha: Number(innerAlphaEl.value), activeProId: null }));
      outerAlphaEl?.addEventListener('input', () => updateCrosshair({ outerSplitAlpha: Number(outerAlphaEl.value), activeProId: null }));
      splitRatioEl?.addEventListener('input', () => updateCrosshair({ splitSizeRatio: Number(splitRatioEl.value), activeProId: null }));
      spreadLimitEl?.addEventListener('input', () => updateCrosshair({ dynamicSpreadLimit: Number(spreadLimitEl.value), activeProId: null }));

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

      copyConVarsBtnEl?.addEventListener('click', async () => {
        const text = generateCrosshairConVars(state.crosshair);
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          notify('success', t('arena.conVarsCopied'));
        } catch {
          // ignore
        }
      });

      resetBtnEl?.addEventListener('click', () => {
        updateCrosshair({ ...DEFAULT_CROSSHAIR });
      });

        viewBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            if (!webglAvailable) return;
            activeMode = btn.dataset.chView || '3d-long-wall';
            applyViewportMode();
          });
        });

        mapSelectEl?.addEventListener('change', () => {
          const val = mapSelectEl.value;
          if (!val) {
            if (webglAvailable) activeMode = '3d-long-wall';
          } else {
            activeMode = val;
          }
          applyViewportMode();
        });

        testSpreadEl?.addEventListener('change', () => {
          simulateBurst = testSpreadEl.checked;
        });

        scopePreviewEl?.addEventListener('change', () => {
          previewScope = scopePreviewEl.checked;
        });

        weaponToggleEl?.addEventListener('change', () => {
          showWeapon = weaponToggleEl.checked;
          if (weaponRig) weaponRig.visible = showWeapon;
        });

        function renderFrame(now) {
          requestAnimationFrame(renderFrame);

          if (webglAvailable && renderer && scene && camera && activeMode.startsWith('3d-')) {
            camera.rotation.y = baseYaw + lookYawOffset;
            camera.rotation.x = basePitch + lookPitchOffset;
            renderer.render(scene, camera);
          }

          if (previewScope) {
            hudCtx.clearRect(0, 0, stageWidth, stageHeight);
            const r = Math.min(stageWidth, stageHeight) * 0.42;
            hudCtx.fillStyle = 'rgba(0, 0, 0, 0.94)';
            hudCtx.beginPath();
            hudCtx.rect(0, 0, stageWidth, stageHeight);
            hudCtx.arc(stageWidth / 2, stageHeight / 2, r, 0, Math.PI * 2, true);
            hudCtx.fill();

            const lw = Math.max(1, Number(state.crosshair.sniperWidth ?? 1));
            hudCtx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
            hudCtx.lineWidth = lw;
            hudCtx.beginPath();
            hudCtx.moveTo(0, stageHeight / 2);
            hudCtx.lineTo(stageWidth, stageHeight / 2);
            hudCtx.moveTo(stageWidth / 2, 0);
            hudCtx.lineTo(stageWidth / 2, stageHeight);
            hudCtx.stroke();
            return;
          }

          const phase = (now * 0.004) % (Math.PI * 2);
          const limitScale = Math.max(0.25, Math.min(2.2, Number(state.crosshair.dynamicSpreadLimit ?? 227) / 140));
          const simSpread = simulateBurst ? ((Math.sin(phase) * 0.5 + 0.5) * 14 * limitScale) : 0;
          const simRecoil = simulateBurst
            ? {
              x: Math.sin(phase * 1.5) * 16,
              y: -Math.abs(Math.sin(phase)) * 28,
            }
            : { x: 0, y: 0 };

          drawCrosshairOnCanvas(
            hudCtx,
            stageWidth,
            stageHeight,
            state.crosshair,
            simSpread,
            simRecoil,
            1.85,
          );
        }

        syncUi();
        requestAnimationFrame(renderFrame);
      }
