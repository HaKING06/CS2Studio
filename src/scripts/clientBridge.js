import Swal from 'sweetalert2';
import { translateKey } from '../utils/i18n.js';

export function t(key, vars = {}) {
  const dict = typeof window !== 'undefined' && window.__CS2_I18N__ ? window.__CS2_I18N__ : {};
  return translateKey(dict, key, vars);
}

export function notify(icon, title) {
  Swal.fire({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 2300,
    timerProgressBar: true,
    background: '#0b0f17',
    color: '#f8fafc',
    customClass: {
      popup: 'border border-[#ff9d00]/60 shadow-[0_0_25px_rgba(255,157,0,0.2)] rounded-sm text-sm',
    },
    icon,
    title,
  });
}

export function attachGlbDropHandler(dropZoneEl, onLoaded) {
  if (!dropZoneEl || typeof onLoaded !== 'function') return;

  dropZoneEl.addEventListener('dragover', (e) => {
    const hasFiles = e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files');
    if (hasFiles) {
      e.preventDefault();
      dropZoneEl.classList.add('ring-2', 'ring-[#ff9d00]');
    }
  });

  dropZoneEl.addEventListener('dragleave', () => {
    dropZoneEl.classList.remove('ring-2', 'ring-[#ff9d00]');
  });

  dropZoneEl.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    dropZoneEl.classList.remove('ring-2', 'ring-[#ff9d00]');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) return;
    e.preventDefault();
    try {
      await onLoaded(file);
    } catch {
      notify('error', `Failed to load ${file.name}`);
    }
  });
}
