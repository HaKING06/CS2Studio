import { buildCrosshairMiniSvg } from '../utils/crosshairCanvas.js';
import { encodeCrosshairCode } from '../utils/shareCode.js';
import { loadState } from '../utils/storage.js';

export function mountHomeDashboard() {
  const chBox = document.getElementById('dash-crosshair-preview');
  const chCodeEl = document.getElementById('dash-crosshair-code');
  const vmSummaryEl = document.getElementById('dash-viewmodel-summary');
  const bindsCountEl = document.getElementById('dash-binds-count');

  if (!chBox && !chCodeEl && !vmSummaryEl && !bindsCountEl) return;

  const state = loadState();
  if (chBox) {
    chBox.innerHTML = buildCrosshairMiniSvg(state.crosshair);
  }
  if (chCodeEl) {
    chCodeEl.textContent = encodeCrosshairCode(state.crosshair) || 'Custom';
  }
  if (vmSummaryEl) {
    const vm = state.viewmodel;
    vmSummaryEl.textContent = `FOV ${vm.fov} • X ${vm.offsetX} / Y ${vm.offsetY} / Z ${vm.offsetZ}`;
  }
  if (bindsCountEl) {
    const count = Object.values(state.buyBinds || {}).filter((v) => Array.isArray(v) && v.length > 0).length;
    bindsCountEl.textContent = `${count} binds`;
  }
}
