import Sortable from 'sortablejs';
import Swal from 'sweetalert2';
import { generateBuyBindLines } from '../utils/autoexecCompiler.js';
import { loadState, saveState } from '../utils/storage.js';
import { t, notify } from './clientBridge.js';

export const BUY_ITEMS = [
  { id: 'ak47', name: 'AK-47', short: 'AK', price: 2700, category: 'rifles', icon: '/assets/weapons/ak47.svg' },
  { id: 'm4a1', name: 'M4A4', short: 'M4A4', price: 3000, category: 'rifles', icon: '/assets/weapons/m4a4.svg' },
  { id: 'm4a1_silencer', name: 'M4A1-S', short: 'M4S', price: 2900, category: 'rifles', icon: '/assets/weapons/m4a1s.svg' },
  { id: 'awp', name: 'AWP', short: 'AWP', price: 4750, category: 'rifles', icon: '/assets/weapons/awp.svg' },
  { id: 'ssg08', name: 'SSG 08', short: 'SCOUT', price: 1700, category: 'rifles', icon: '/assets/weapons/ssg08.svg' },
  { id: 'famas', name: 'FAMAS', short: 'FAMAS', price: 1950, category: 'rifles', icon: '/assets/weapons/famas.svg' },
  { id: 'galilar', name: 'Galil AR', short: 'GALIL', price: 1800, category: 'rifles', icon: '/assets/weapons/galil.svg' },

  { id: 'mp9', name: 'MP9', short: 'MP9', price: 1250, category: 'smg', icon: '/assets/weapons/mp9.svg' },
  { id: 'mac10', name: 'MAC-10', short: 'MAC10', price: 1050, category: 'smg', icon: '/assets/weapons/mac10.svg' },

  { id: 'deagle', name: 'Desert Eagle', short: 'DEAG', price: 700, category: 'pistols', icon: '/assets/weapons/deagle.svg' },
  { id: 'p250', name: 'P250', short: 'P250', price: 300, category: 'pistols', icon: '/assets/weapons/p250.svg' },
  { id: 'fiveseven', name: 'Five-SeveN', short: '5-7', price: 500, category: 'pistols', icon: '/assets/weapons/fiveseven.svg' },
  { id: 'tec9', name: 'Tec-9', short: 'TEC9', price: 500, category: 'pistols', icon: '/assets/weapons/tec9.svg' },
  { id: 'usp_silencer', name: 'USP-S', short: 'USP', price: 200, category: 'pistols', icon: '/assets/weapons/usp.svg' },
  { id: 'glock', name: 'Glock-18', short: 'GLOCK', price: 200, category: 'pistols', icon: '/assets/weapons/glock.svg' },

  { id: 'vesthelm', name: 'Kevlar + Helmet', short: 'ARMOR+', price: 1000, category: 'utility', icon: '/assets/weapons/vesthelm.svg' },
  { id: 'vest', name: 'Kevlar Vest', short: 'VEST', price: 650, category: 'utility', icon: '/assets/weapons/vest.svg' },
  { id: 'defuser', name: 'Defuse Kit', short: 'KIT', price: 400, category: 'utility', icon: '/assets/weapons/defuser.svg' },
  { id: 'hegrenade', name: 'HE Grenade', short: 'HE', price: 300, category: 'utility', icon: '/assets/weapons/hegrenade.svg' },
  { id: 'flashbang', name: 'Flashbang', short: 'FLASH', price: 200, category: 'utility', icon: '/assets/weapons/flashbang.svg' },
  { id: 'smokegrenade', name: 'Smoke Grenade', short: 'SMOKE', price: 300, category: 'utility', icon: '/assets/weapons/smokegrenade.svg' },
  { id: 'molotov', name: 'Molotov', short: 'MOLLY', price: 400, category: 'utility', icon: '/assets/weapons/molotov.svg' },
  { id: 'incgrenade', name: 'Incendiary', short: 'INC', price: 500, category: 'utility', icon: '/assets/weapons/molotov.svg' },
  { id: 'decoy', name: 'Decoy', short: 'DECOY', price: 50, category: 'utility', icon: '/assets/weapons/decoy.svg' },
  { id: 'taser', name: 'Zeus x27', short: 'ZEUS', price: 200, category: 'utility', icon: '/assets/weapons/taser.svg' },
];

const ITEM_MAP = Object.fromEntries(BUY_ITEMS.map((item) => [item.id, item]));

const KEYBOARD_F_ROW = Array.from({ length: 12 }, (_, i) => ({ code: `f${i + 1}`, label: `F${i + 1}` }));
const KEYBOARD_NAV_CLUSTER = [
  { code: 'ins', label: 'INS' }, { code: 'home', label: 'HOME' }, { code: 'pgup', label: 'PGUP' },
  { code: 'del', label: 'DEL' }, { code: 'end', label: 'END' }, { code: 'pgdn', label: 'PGDN' },
];
const KEYBOARD_ARROWS = [
  { code: null, label: '' }, { code: 'uparrow', label: '▲' }, { code: null, label: '' },
  { code: 'leftarrow', label: '◀' }, { code: 'downarrow', label: '▼' }, { code: 'rightarrow', label: '▶' },
];
const KEYBOARD_NUMPAD = [
  { code: 'numlock', label: 'NUM', locked: true },
  { code: 'kp_divide', label: '/' }, { code: 'kp_multiply', label: '*' }, { code: 'kp_minus', label: '-' },
  { code: 'kp_7', label: '7' }, { code: 'kp_8', label: '8' }, { code: 'kp_9', label: '9' },
  { code: 'kp_plus', label: '+', rowSpan: 2 },
  { code: 'kp_4', label: '4' }, { code: 'kp_5', label: '5' }, { code: 'kp_6', label: '6' },
  { code: 'kp_1', label: '1' }, { code: 'kp_2', label: '2' }, { code: 'kp_3', label: '3' },
  { code: 'kp_enter', label: 'ENT', rowSpan: 2 },
  { code: 'kp_0', label: '0', colSpan: 2 }, { code: 'kp_del', label: '.' },
];

const BUY_PRESETS = {
  proNumpad: {
    kp_7: ['ak47', 'm4a1', 'm4a1_silencer'],
    kp_8: ['famas', 'galilar'],
    kp_9: ['awp'],
    kp_4: ['mp9', 'mac10'],
    kp_5: ['deagle'],
    kp_6: ['ssg08'],
    kp_1: ['p250'],
    kp_2: ['fiveseven', 'tec9'],
    kp_0: ['vesthelm'],
    kp_del: ['vest'],
    kp_enter: ['defuser'],
    kp_plus: ['hegrenade'],
    kp_minus: ['flashbang'],
    kp_multiply: ['smokegrenade'],
    kp_divide: ['molotov', 'incgrenade'],
  },
  fKeys: {
    f1: ['ak47', 'm4a1', 'm4a1_silencer'],
    f2: ['awp'],
    f3: ['deagle'],
    f4: ['vesthelm', 'defuser'],
    f5: ['flashbang'],
    f6: ['smokegrenade'],
    f7: ['hegrenade'],
    f8: ['molotov', 'incgrenade'],
  },
};

export function mountBuyBindsPage() {
  const paletteEl = document.getElementById('buy-palette-list');
  if (!paletteEl) return;

  const state = loadState();
  const persist = () => saveState(state);

  const fRowEl = document.getElementById('kb-f-row');
  const navClusterEl = document.getElementById('kb-nav-cluster');
  const arrowClusterEl = document.getElementById('kb-arrow-cluster');
  const numpadEl = document.getElementById('kb-numpad-grid');
  const previewEl = document.getElementById('buy-binds-preview');
  const countEl = document.getElementById('buy-bind-count');
  const catTabs = document.querySelectorAll('[data-buy-cat]');
  const presetNumpadBtn = document.getElementById('btn-preset-numpad');
  const presetFKeysBtn = document.getElementById('btn-preset-fkeys');
  const clearAllBtn = document.getElementById('btn-clear-binds');
  const copyBindsBtn = document.getElementById('btn-copy-binds');

  let activeCategory = 'all';
  let selectedPaletteItemId = 'ak47';
  let paletteSortable = null;
  const keySortables = [];

  function assignItemToKey(keyCode, itemId) {
    if (!keyCode || keyCode === 'numlock' || !ITEM_MAP[itemId]) return;
    const current = Array.isArray(state.buyBinds[keyCode]) ? [...state.buyBinds[keyCode]] : [];
    if (!current.includes(itemId)) current.push(itemId);
    state.buyBinds[keyCode] = current;
    renderKeyboard();
    persist();
    notify('success', t('buyBinds.assigned', { item: ITEM_MAP[itemId].name, key: keyCode.toUpperCase() }));
  }

  function clearKey(keyCode) {
    if (!state.buyBinds[keyCode]?.length) return;
    delete state.buyBinds[keyCode];
    renderKeyboard();
    persist();
    notify('info', t('buyBinds.cleared', { key: keyCode.toUpperCase() }));
  }

  function renderPalette() {
    const items = activeCategory === 'all' ? BUY_ITEMS : BUY_ITEMS.filter((i) => i.category === activeCategory);
    paletteEl.innerHTML = items.map((item) => {
      const isSelected = selectedPaletteItemId === item.id;
      return `<div data-buy-item="${item.id}" draggable="true"
          isSelected
          ? 'bg-[#ff9d00]/15 border-[#ff9d00] shadow-[0_0_15px_rgba(255,157,0,0.16)]'
          : 'bg-[#0b0f17] border-slate-800 hover:border-[#ff9d00]/50 hover:bg-slate-900'
    }">
    < div class= "flex items-center gap-2.5 min-w-0" >
          <div class="w-11 h-7 rounded-sm bg-[#080b11] border border-slate-800 flex items-center justify-center p-1 shrink-0">
            <img src="${item.icon}" alt="${item.name}" class="max-w-full max-h-full object-contain pointer-events-none brightness-0 invert opacity-90" loading="lazy" />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-white truncate">${item.name}</div>
            <div class="text-[10px] font-mono text-slate-400">buy ${item.id}</div>
          </div>
        </div>
        <span class="text-[11px] font-mono font-bold text-[#ff9d00] shrink-0">$${item.price}</span>
      </div > `;
    }).join('');

    catTabs.forEach((tab) => {
      const active = tab.dataset.buyCat === activeCategory;
      tab.classList.toggle('bg-[#ff9d00]/20', active);
      tab.classList.toggle('border-[#ff9d00]', active);
      tab.classList.toggle('text-[#ff9d00]', active);
      tab.classList.toggle('border-slate-700', !active);
      tab.classList.toggle('text-slate-400', !active);
    });

    if (paletteSortable) paletteSortable.destroy();
    paletteSortable = Sortable.create(paletteEl, {
      group: { name: 'cs2buy', pull: 'clone', put: false },
      sort: false,
      animation: 150,
      ghostClass: 'opacity-40',
    });
  }

  function buildKeyHtml(keyDef) {
    if (!keyDef.code) return `< div class= "pointer-events-none" ></div > `;
    const assignedIds = state.buyBinds[keyDef.code] || [];
    const primary = assignedIds[0] ? ITEM_MAP[assignedIds[0]] : null;
    const hasBind = assignedIds.length > 0;
    const spanClasses = [
      keyDef.colSpan === 2 ? 'col-span-2' : '',
      keyDef.rowSpan === 2 ? 'row-span-2' : '',
    ].filter(Boolean).join(' ');

    if (keyDef.locked) {
      return `<div class="mech-keycap flex flex-col items-center justify-center rounded-sm border border-slate-800 bg-[#080b11] text-slate-600 text-[10px] font-mono select-none p-1.5 min-h-[58px] ${spanClasses}">
        <span>${keyDef.label}</span>
      </div>`;
  }

  const titleText = hasBind
    ? `${keyDef.code.toUpperCase()}: ${assignedIds.map((id) => ITEM_MAP[id]?.name || id).join(' + ')}`
    : keyDef.code.toUpperCase();

  return `<div data-key-code="${keyDef.code}" title="${titleText}"
        hasBind
      ? 'bg-gradient-to-b from-slate-800/95 to-slate-900/95 border-[#ff9d00] shadow-[0_4px_0_0_rgba(234,88,12,0.55),0_0_16px_rgba(255,157,0,0.18)]'
      : 'bg-gradient-to-b from-slate-900/95 to-[#080b11] border-slate-700/80 shadow-[0_4px_0_0_rgba(8,11,17,0.95)] hover:border-[#ff9d00]/60'
} ">
  < div class="flex items-center justify-between gap-1 w-full" >
<span class="text-[10px] font-mono font-bold ${hasBind ? 'text-[#ff9d00]' : 'text-slate-400'}">${keyDef.label}</span>
        ${ assignedIds.length > 1 ? `<span class="text-[9px] font-mono px-1 rounded-sm bg-[#ff9d00]/20 text-[#ff9d00] border border-[#ff9d00]/40">+${assignedIds.length - 1}</span>` : '' }
      </div >
      <div class="flex-1 flex items-center justify-center my-0.5 overflow-hidden">
        ${primary
          ? `<img src="${primary.icon}" alt="${primary.name}" class="max-h-5 max-w-[90%] object-contain brightness-0 invert drop-shadow-[0_0_6px_rgba(255,157,0,0.55)] pointer-events-none" />`
          : `<span class="text-[9px] text-slate-600 font-mono opacity-60 group-hover:opacity-100">+</span>`}
      </div>
      <div class="text-[9px] font-mono truncate text-center ${hasBind ? 'text-slate-200 font-semibold' : 'text-slate-600'}">
        ${primary ? primary.short : keyDef.code}
      </div>
    </div > `;
  }

  function renderKeyboard() {
    while (keySortables.length) keySortables.pop()?.destroy();
    if (fRowEl) fRowEl.innerHTML = KEYBOARD_F_ROW.map((k) => buildKeyHtml(k)).join('');
    if (navClusterEl) navClusterEl.innerHTML = KEYBOARD_NAV_CLUSTER.map((k) => buildKeyHtml(k)).join('');
    if (arrowClusterEl) arrowClusterEl.innerHTML = KEYBOARD_ARROWS.map((k) => buildKeyHtml(k)).join('');
    if (numpadEl) numpadEl.innerHTML = KEYBOARD_NUMPAD.map((k) => buildKeyHtml(k)).join('');

    document.querySelectorAll('[data-key-code]').forEach((keyEl) => {
      const keyCode = keyEl.dataset.keyCode;
      keySortables.push(Sortable.create(keyEl, {
        group: { name: 'cs2buy', pull: false, put: ['cs2buy'] },
        sort: false,
        onAdd(evt) {
          const draggedItemId = evt.item?.dataset?.buyItem;
          evt.item?.remove();
          if (draggedItemId) assignItemToKey(keyCode, draggedItemId);
        },
      }));

      keyEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        keyEl.classList.add('ring-2', 'ring-amber-400');
      });
      keyEl.addEventListener('dragleave', () => keyEl.classList.remove('ring-2', 'ring-amber-400'));
      keyEl.addEventListener('drop', (e) => {
        e.preventDefault();
        keyEl.classList.remove('ring-2', 'ring-amber-400');
        const itemId = e.dataTransfer?.getData('text/plain');
        if (itemId && ITEM_MAP[itemId]) assignItemToKey(keyCode, itemId);
      });
      keyEl.addEventListener('click', () => {
        const hasBind = (state.buyBinds[keyCode] || []).length > 0;
        if (!hasBind && selectedPaletteItemId) {
          assignItemToKey(keyCode, selectedPaletteItemId);
        } else if (hasBind) {
          if (state.buyBinds[keyCode].includes(selectedPaletteItemId)) clearKey(keyCode);
          else assignItemToKey(keyCode, selectedPaletteItemId);
        }
      });
      keyEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        clearKey(keyCode);
      });
    });

    const lines = generateBuyBindLines(state.buyBinds);
    if (previewEl) previewEl.textContent = lines.length ? lines.join('\n') : '// Drag a weapon onto any key to create a bind';
    if (countEl) countEl.textContent = String(lines.length);
  }

  paletteEl.addEventListener('dragstart', (e) => {
    const itemEl = e.target.closest('[data-buy-item]');
    if (!itemEl) return;
    selectedPaletteItemId = itemEl.dataset.buyItem;
    e.dataTransfer?.setData('text/plain', selectedPaletteItemId);
  });

  paletteEl.addEventListener('click', (e) => {
    const itemEl = e.target.closest('[data-buy-item]');
    if (!itemEl) return;
    selectedPaletteItemId = itemEl.dataset.buyItem;
    renderPalette();
  });

  catTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.buyCat;
      renderPalette();
    });
  });

  presetNumpadBtn?.addEventListener('click', () => {
    state.buyBinds = structuredClone(BUY_PRESETS.proNumpad);
    renderKeyboard();
    persist();
    notify('success', t('buyBinds.presetProNumpad'));
  });

  presetFKeysBtn?.addEventListener('click', () => {
    state.buyBinds = structuredClone(BUY_PRESETS.fKeys);
    renderKeyboard();
    persist();
    notify('success', t('buyBinds.presetFKeys'));
  });

  clearAllBtn?.addEventListener('click', async () => {
    const res = await Swal.fire({
      title: t('buyBinds.clearAll'),
      text: t('buyBinds.confirmClear'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.cancel'),
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#ef4444',
    });
    if (res.isConfirmed) {
      state.buyBinds = {};
      renderKeyboard();
      persist();
    }
  });

  copyBindsBtn?.addEventListener('click', async () => {
    const lines = generateBuyBindLines(state.buyBinds).join('\n');
    if (!lines) return;
    try {
      await navigator.clipboard.writeText(lines);
      notify('success', t('autoexec.copiedSuccess'));
    } catch {
      // ignore
    }
  });

  renderPalette();
  renderKeyboard();
}
