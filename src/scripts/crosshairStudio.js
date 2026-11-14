import {
  CROSSHAIR_COLOR_PRESETS,
  drawCrosshairOnCanvas,
  buildCrosshairMiniSvg,
  rgbToHex,
  hexToRgb,
} from '../utils/crosshairCanvas.js';
import { PRO_CROSSHAIRS, getProCrosshairById } from '../utils/proCrosshairs.js';
import {
  decodeAnyShareCode,
  encodeCrosshairCode,
  generateCrosshairConVars,
} from '../utils/shareCode.js';
import { DEFAULT_CROSSHAIR, loadState, saveState } from '../utils/storage.js';
import { notify, t } from './clientBridge.js';

const BACKGROUNDS = {
  dust2: {
    label: 'Dust2 Sand',
    render: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#a8c2dc');
      grad.addColorStop(0.42, '#d5c7ab');
      grad.addColorStop(0.75, '#bfa57c');
      grad.addColorStop(1, '#8c724d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(72, 54, 34, 0.16)';
      ctx.fillRect(w * 0.08, h * 0.44, w * 0.3, h * 0.34);
      ctx.fillRect(w * 0.65, h * 0.48, w * 0.24, h * 0.3);
      ctx.fillStyle = 'rgba(139, 38, 29, 0.42)';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('A', w * 0.12, h * 0.54);
    },
  },
  mirage: {
    label: 'Mirage Brick',
    render: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#9e7d58');
      grad.addColorStop(0.6, '#b8946b');
      grad.addColorStop(1, '#6f5538');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(40, 28, 18, 0.25)';
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 44) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    },
  },
  dark: {
    label: 'Dark Smoke',
    render: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#080b11');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
  },
  sky: {
    label: 'Bright Sky',
    render: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#60a5fa');
      grad.addColorStop(0.55, '#bae6fd');
      grad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
  },
};

export function mountCrosshairPage() {
  const stageEl = document.getElementById('ch-preview-stage');
  const bgCanvas = document.getElementById('ch-preview-bg');
  const hudCanvas = document.getElementById('ch-preview-hud');
  if (!stageEl || !bgCanvas || !hudCanvas) return;

  const state = loadState();
  const persist = () => saveState(state);

  const proGridEl = document.getElementById('pro-crosshair-grid');
  const shareInputEl = document.getElementById('crosshair-share-code');
  const importBtnEl = document.getElementById('btn-import-crosshair');
  const copyCodeBtnEl = document.getElementById('btn-copy-crosshair');
  const copyConVarsBtnEl = document.getElementById('btn-copy-convars');
  const resetBtnEl = document.getElementById('btn-ch-reset');
  const testSpreadEl = document.getElementById('ch-test-spread');
  const scopePreviewEl = document.getElementById('ch-scope-preview');
  const conVarsOutEl = document.getElementById('ch-convars-output');
  const bgBtns = document.querySelectorAll('[data-ch-bg]');

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

  let activeBg = 'dust2';
  let simulateBurst = false;
  let previewScope = false;

  const bgCtx = bgCanvas.getContext('2d');
  const hudCtx = hudCanvas.getContext('2d');
  let stageWidth = 720;
  let stageHeight = 405;

  function renderBackground() {
    const renderer = BACKGROUNDS[activeBg]?.render || BACKGROUNDS.dust2.render;
    renderer(bgCtx, stageWidth, stageHeight);

    bgBtns.forEach((btn) => {
      const isAct = btn.dataset.chBg === activeBg;
      btn.classList.toggle('bg-[#ff9d00]/20', isAct);
      btn.classList.toggle('border-[#ff9d00]', isAct);
      btn.classList.toggle('text-[#ff9d00]', isAct);
      btn.classList.toggle('border-slate-700', !isAct);
      btn.classList.toggle('text-slate-400', !isAct);
    });
  }

  function handleResize() {
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    stageWidth = rect.width;
    stageHeight = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = Math.round(stageWidth * dpr);
    bgCanvas.height = Math.round(stageHeight * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hudCanvas.width = Math.round(stageWidth * dpr);
    hudCanvas.height = Math.round(stageHeight * dpr);
    hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderBackground();
  }

  new ResizeObserver(handleResize).observe(stageEl);
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

  function renderProGrid() {
    if (!proGridEl) return;
    proGridEl.innerHTML = PRO_CROSSHAIRS.map((pro) => {
      const isSelected = state.crosshair.activeProId === pro.id;
      return `<button type="button" data-pro-id="${pro.id}"
        class="pro-card group flex items-center gap-3 p-2.5 rounded-sm border text-left transition-all cursor-pointer ${
          isSelected
            ? 'bg-[#ff9d00]/12 border-[#ff9d00] shadow-[0_0_18px_rgba(255,157,0,0.16)]'
            : 'bg-[#0b0f17] border-slate-800 hover:border-[#ff9d00]/60 hover:bg-slate-900'
        }">
        ${buildCrosshairMiniSvg(pro.settings)}
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-sm text-white truncate">${pro.player}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-[#ff9d00] border border-slate-700 shrink-0">${pro.tag}</span>
          </div>
          <div class="text-xs text-slate-400 truncate">${pro.team} • ${pro.role}</div>
          <div class="text-[10px] text-slate-500 font-mono truncate mt-0.5">${pro.resolution}</div>
        </div>
      </button>`;
    }).join('');
  }

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

    if (shareInputEl) shareInputEl.value = encodeCrosshairCode(ch);
    if (conVarsOutEl) conVarsOutEl.textContent = generateCrosshairConVars(ch);
    renderSwatches();
    renderProGrid();
  }

  function updateCrosshair(patch) {
    Object.assign(state.crosshair, patch);
    syncUi();
    persist();
  }

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

  copyCodeBtnEl?.addEventListener('click', async () => {
    const code = encodeCrosshairCode(state.crosshair);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      notify('success', t('arena.codeCopied'));
    } catch {
      shareInputEl?.select();
    }
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

  bgBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBg = btn.dataset.chBg || 'dust2';
      renderBackground();
    });
  });

  testSpreadEl?.addEventListener('change', () => {
    simulateBurst = testSpreadEl.checked;
  });

  scopePreviewEl?.addEventListener('change', () => {
    previewScope = scopePreviewEl.checked;
  });

  function renderFrame(now) {
    requestAnimationFrame(renderFrame);

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
  renderBackground();
  requestAnimationFrame(renderFrame);
}
