import FileSaver from 'file-saver';
import Swal from 'sweetalert2';
import { buildAutoexecText } from '../utils/autoexecCompiler.js';
import { encodeCrosshairCode } from '../utils/shareCode.js';
import { loadState, saveState, resetStoredState } from '../utils/storage.js';
import { t, notify } from './clientBridge.js';

const saveAs = FileSaver?.saveAs || FileSaver;

export function mountAutoexecPage() {
  const codeEl = document.getElementById('autoexec-output');
  if (!codeEl) return;

  let state = loadState();
  const persist = () => saveState(state);

  const sensEl = document.getElementById('cfg-sensitivity');
  const zoomSensEl = document.getElementById('cfg-zoom-sens');
  const fpsEl = document.getElementById('cfg-fps-max');
  const toggleLowLatency = document.getElementById('opt-low-latency');
  const toggleTelemetry = document.getElementById('opt-hud-telemetry');
  const toggleRadar = document.getElementById('opt-tactical-radar');
  const toggleAudio = document.getElementById('opt-comp-audio');
  const toggleMouse = document.getElementById('opt-clean-mouse');
  const toggleJump = document.getElementById('opt-jump-helpers');

  const summaryChEl = document.getElementById('summary-crosshair-code');
  const summaryVmEl = document.getElementById('summary-viewmodel-fov');
  const summaryBindsEl = document.getElementById('summary-buy-count');

  const copyBtn = document.getElementById('btn-copy-autoexec');
  const downloadBtn = document.getElementById('btn-download-autoexec');
  const resetBtn = document.getElementById('btn-reset-studio');

  function refreshOutput() {
    codeEl.textContent = buildAutoexecText(state);
    if (summaryChEl) summaryChEl.textContent = encodeCrosshairCode(state.crosshair) || 'Custom';
    if (summaryVmEl) summaryVmEl.textContent = `FOV ${state.viewmodel.fov} (${state.viewmodel.offsetX}, ${state.viewmodel.offsetY}, ${state.viewmodel.offsetZ})`;
    if (summaryBindsEl) summaryBindsEl.textContent = String(Object.keys(state.buyBinds || {}).length);
  }

  function syncUi() {
    const o = state.autoexecOpts;
    if (sensEl) sensEl.value = String(o.sensitivity);
    if (zoomSensEl) zoomSensEl.value = String(o.zoomSensitivity);
    if (fpsEl) fpsEl.value = String(o.fpsMax);
    if (toggleLowLatency) toggleLowLatency.checked = Boolean(o.lowLatency);
    if (toggleTelemetry) toggleTelemetry.checked = Boolean(o.hudTelemetry);
    if (toggleRadar) toggleRadar.checked = Boolean(o.tacticalRadar);
    if (toggleAudio) toggleAudio.checked = Boolean(o.compAudio);
    if (toggleMouse) toggleMouse.checked = Boolean(o.cleanMouse);
    if (toggleJump) toggleJump.checked = Boolean(o.jumpThrowHelpers);
    refreshOutput();
  }

  function updateOpt(patch) {
    Object.assign(state.autoexecOpts, patch);
    refreshOutput();
    persist();
  }

  sensEl?.addEventListener('input', () => updateOpt({ sensitivity: Number(sensEl.value) || 1.85 }));
  zoomSensEl?.addEventListener('input', () => updateOpt({ zoomSensitivity: Number(zoomSensEl.value) || 1.0 }));
  fpsEl?.addEventListener('input', () => updateOpt({ fpsMax: Number(fpsEl.value) || 0 }));

  toggleLowLatency?.addEventListener('change', () => updateOpt({ lowLatency: toggleLowLatency.checked }));
  toggleTelemetry?.addEventListener('change', () => updateOpt({ hudTelemetry: toggleTelemetry.checked }));
  toggleRadar?.addEventListener('change', () => updateOpt({ tacticalRadar: toggleRadar.checked }));
  toggleAudio?.addEventListener('change', () => updateOpt({ compAudio: toggleAudio.checked }));
  toggleMouse?.addEventListener('change', () => updateOpt({ cleanMouse: toggleMouse.checked }));
  toggleJump?.addEventListener('change', () => updateOpt({ jumpThrowHelpers: toggleJump.checked }));

  copyBtn?.addEventListener('click', async () => {
    const cfg = buildAutoexecText(state);
    try {
      await navigator.clipboard.writeText(cfg);
      notify('success', t('autoexec.copiedSuccess'));
    } catch {
      notify('error', 'Clipboard blocked');
    }
  });

  downloadBtn?.addEventListener('click', () => {
    const cfg = buildAutoexecText(state);
    const blob = new Blob([cfg], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'autoexec.cfg');
    Swal.fire({
      title: 'autoexec.cfg',
      text: t('autoexec.downloadSuccess'),
      icon: 'success',
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#06b6d4',
    });
  });

  resetBtn?.addEventListener('click', async () => {
    const res = await Swal.fire({
      title: t('autoexec.resetAll'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.cancel'),
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#ef4444',
    });
    if (res.isConfirmed) {
      state = resetStoredState();
      syncUi();
      notify('info', t('common.reset'));
    }
  });

  syncUi();
}
