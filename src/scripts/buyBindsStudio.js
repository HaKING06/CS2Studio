import Sortable from 'sortablejs';
import Swal from 'sweetalert2';
import { generateBuyBindLines } from '../utils/autoexecCompiler.js';
import { loadState, saveState } from '../utils/storage.js';
import { t, notify } from './clientBridge.js';

export const BUY_ITEMS = [
  { id: 'ak47', name: 'AK-47', short: 'AK', price: 2700, category: 'rifles', icon: '/assets/weapons/ak47.svg', tip: 'T-side 1-tap primary rifle ($2700)' },
  { id: 'm4a1', name: 'M4A4', short: 'M4A4', price: 3000, category: 'rifles', icon: '/assets/weapons/m4a4.svg', tip: 'CT primary 30-round rifle ($3000)' },
  { id: 'm4a1_silencer', name: 'M4A1-S', short: 'M4S', price: 2900, category: 'rifles', icon: '/assets/weapons/m4a1s.svg', tip: 'CT suppressed laser rifle ($2900)' },
  { id: 'awp', name: 'AWP', short: 'AWP', price: 4750, category: 'rifles', icon: '/assets/weapons/awp.svg', tip: 'High-impact 1-shot sniper ($4750)' },
  { id: 'ssg08', name: 'SSG 08', short: 'SCOUT', price: 1700, category: 'rifles', icon: '/assets/weapons/ssg08.svg', tip: 'Fast mobility scout sniper ($1700)' },
  { id: 'famas', name: 'FAMAS', short: 'FAMAS', price: 1950, category: 'rifles', icon: '/assets/weapons/famas.svg', tip: 'CT force-buy rifle ($1950)' },
  { id: 'galilar', name: 'Galil AR', short: 'GALIL', price: 1800, category: 'rifles', icon: '/assets/weapons/galil.svg', tip: 'T force-buy 35-round rifle ($1800)' },

  { id: 'mp9', name: 'MP9', short: 'MP9', price: 1250, category: 'smg', icon: '/assets/weapons/mp9.svg', tip: 'CT high fire-rate anti-eco SMG ($1250)' },
  { id: 'mac10', name: 'MAC-10', short: 'MAC10', price: 1050, category: 'smg', icon: '/assets/weapons/mac10.svg', tip: 'T budget rush SMG ($1050)' },

  { id: 'deagle', name: 'Desert Eagle', short: 'DEAG', price: 700, category: 'pistols', icon: '/assets/weapons/deagle.svg', tip: 'High-caliber eco sidearm ($700)' },
  { id: 'p250', name: 'P250', short: 'P250', price: 300, category: 'pistols', icon: '/assets/weapons/p250.svg', tip: 'Low-cost armor penetration pistol ($300)' },
  { id: 'fiveseven', name: 'Five-SeveN', short: '5-7', price: 500, category: 'pistols', icon: '/assets/weapons/fiveseven.svg', tip: 'CT 20-round high-pen pistol ($500)' },
  { id: 'tec9', name: 'Tec-9', short: 'TEC9', price: 500, category: 'pistols', icon: '/assets/weapons/tec9.svg', tip: 'T run-and-gun pistol ($500)' },
  { id: 'usp_silencer', name: 'USP-S', short: 'USP', price: 200, category: 'pistols', icon: '/assets/weapons/usp.svg', tip: 'CT suppressed starter pistol ($200)' },
  { id: 'glock', name: 'Glock-18', short: 'GLOCK', price: 200, category: 'pistols', icon: '/assets/weapons/glock.svg', tip: 'T 20-round starter pistol ($200)' },

  { id: 'vesthelm', name: 'Kevlar + Helmet', short: 'ARMOR+', price: 1000, category: 'utility', icon: '/assets/weapons/vesthelm.svg', tip: 'Full body armor + head protection ($1000)' },
  { id: 'vest', name: 'Kevlar Vest', short: 'VEST', price: 650, category: 'utility', icon: '/assets/weapons/vest.svg', tip: 'Chest Kevlar vs CT rifles ($650)' },
  { id: 'defuser', name: 'Defuse Kit', short: 'KIT', price: 400, category: 'utility', icon: '/assets/weapons/defuser.svg', tip: 'Halves C4 defuse time to 5s ($400)' },
  { id: 'hegrenade', name: 'HE Grenade', short: 'HE', price: 300, category: 'utility', icon: '/assets/weapons/hegrenade.svg', tip: 'High-explosive frag grenade ($300)' },
  { id: 'flashbang', name: 'Flashbang', short: 'FLASH', price: 200, category: 'utility', icon: '/assets/weapons/flashbang.svg', tip: 'Pop-flash utility grenade ($200)' },
  { id: 'smokegrenade', name: 'Smoke Grenade', short: 'SMOKE', price: 300, category: 'utility', icon: '/assets/weapons/smokegrenade.svg', tip: 'Volumetric tactical smoke screen ($300)' },
  { id: 'molotov', name: 'Molotov', short: 'MOLLY', price: 400, category: 'utility', icon: '/assets/weapons/molotov.svg', tip: 'T incendiary area denial ($400)' },
  { id: 'incgrenade', name: 'Incendiary', short: 'INC', price: 500, category: 'utility', icon: '/assets/weapons/molotov.svg', tip: 'CT incendiary area denial ($500)' },
  { id: 'decoy', name: 'Decoy', short: 'DECOY', price: 50, category: 'utility', icon: '/assets/weapons/decoy.svg', tip: 'Fake sound decoy grenade ($50)' },
  { id: 'taser', name: 'Zeus x27', short: 'ZEUS', price: 200, category: 'utility', icon: '/assets/weapons/taser.svg', tip: 'Rechargeable stun taser ($200)' },
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

function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined && textContent !== null) el.textContent = String(textContent);
  return el;
}

function createPaletteItemNode(item, isSelected) {
  const card = createEl(
    'div',
    [
      'group flex items-center justify-between gap-2.5 p-2.5 rounded-sm border transition-all duration-150 cursor-grab active:cursor-grabbing select-none',
      isSelected
        ? 'bg-[#ff9d00]/15 border-[#ff9d00] shadow-[0_0_16px_rgba(255,157,0,0.18)]'
        : 'bg-[#0b0f17] border-slate-800 hover:border-[#ff9d00]/60 hover:bg-slate-900/90',
    ].join(' '),
  );
  card.dataset.buyItem = item.id;
  card.title = `${item.tip} • bind KEY "buy ${item.id};"`;
  card.draggable = true;

  const left = createEl('div', 'flex items-center gap-2.5 min-w-0');
  const iconBox = createEl(
    'div',
    'w-12 h-8 rounded-sm bg-[#080b11] border border-slate-800/90 flex items-center justify-center p-1 shrink-0 group-hover:border-[#ff9d00]/40 transition-colors',
  );
  const img = createEl('img', 'max-w-full max-h-full object-contain pointer-events-none brightness-0 invert opacity-90 group-hover:opacity-100');
  img.src = item.icon;
  img.alt = item.name;
  img.loading = 'lazy';
  iconBox.appendChild(img);

  const meta = createEl('div', 'min-w-0');
  meta.appendChild(createEl('div', 'text-xs font-semibold text-white truncate', item.name));
  meta.appendChild(createEl('div', 'text-[10px] font-mono text-slate-400', `buy ${item.id}`));

  left.append(iconBox, meta);
  card.append(left, createEl('span', 'text-[11px] font-mono font-bold text-[#ff9d00] shrink-0', `$${item.price}`));
  return card;
}

function createKeycapNode(keyDef, assignedIds) {
  if (!keyDef.code) {
    return createEl('div', 'pointer-events-none min-h-[58px]');
  }

  const spanClasses = [
    keyDef.colSpan === 2 ? 'col-span-2' : '',
    keyDef.rowSpan === 2 ? 'row-span-2 min-h-[124px]' : 'min-h-[58px] sm:min-h-[62px]',
  ]
    .filter(Boolean)
    .join(' ');

  if (keyDef.locked) {
    const lockedCap = createEl(
      'div',
      `mech-keycap is-locked flex flex-col items-center justify-center rounded-sm border border-slate-800 bg-[#080b11] text-slate-600 text-[10px] font-mono select-none p-1.5 ${spanClasses}`,
    );
    lockedCap.appendChild(createEl('span', 'tracking-wider', keyDef.label));
    return lockedCap;
  }

  const primary = assignedIds[0] ? ITEM_MAP[assignedIds[0]] : null;
  const hasBind = assignedIds.length > 0;

  const keycap = createEl(
    'div',
    [
      'mech-keycap group relative flex flex-col justify-between rounded-sm border p-1.5 select-none cursor-pointer transition-all duration-150 overflow-visible',
      hasBind ? 'is-bound' : '',
      spanClasses,
    ]
      .filter(Boolean)
      .join(' '),
  );
  keycap.dataset.keyCode = keyDef.code;
  keycap.dataset.tooltip = hasBind
    ? `bind "${keyDef.code}" "${assignedIds.map((id) => `buy ${id};`).join(' ')}" • Click/Right-click`
    : `${keyDef.code.toUpperCase()} — Drop or click item to bind`;

  // Top backlit LED accent bar on bound mechanical switches
  const ledBar = createEl(
    'span',
    hasBind
      ? 'block h-[2px] w-full rounded-full bg-[#ff9d00] shadow-[0_0_8px_rgba(255,157,0,0.85)] mb-1'
      : 'block h-[2px] w-4 rounded-full bg-slate-700/60 mb-1 group-hover:bg-[#ff9d00]/50 transition-colors',
  );
  keycap.appendChild(ledBar);

  // Header: Key label + stacked count badge
  const topRow = createEl('div', 'flex items-center justify-between gap-1 w-full');
  topRow.appendChild(
    createEl(
      'span',
      `text-[10px] font-mono font-bold leading-none ${hasBind ? 'text-[#ff9d00]' : 'text-slate-400 group-hover:text-slate-200'}`,
      keyDef.label,
    ),
  );
  if (assignedIds.length > 1) {
    topRow.appendChild(
      createEl(
        'span',
        'text-[9px] font-mono px-1 py-0.5 leading-none rounded-sm bg-[#ff9d00]/20 text-[#ff9d00] border border-[#ff9d00]/45',
        `+${assignedIds.length - 1}`,
      ),
    );
  }
  keycap.appendChild(topRow);

  // Center: Weapon SVG icon or '+' switch stem hint
  const center = createEl('div', 'flex-1 flex items-center justify-center my-0.5 overflow-hidden');
  if (primary) {
    const img = createEl(
      'img',
      'max-h-5 max-w-[90%] object-contain brightness-0 invert drop-shadow-[0_0_6px_rgba(255,157,0,0.65)] pointer-events-none',
    );
    img.src = primary.icon;
    img.alt = primary.name;
    center.appendChild(img);
  } else {
    center.appendChild(
      createEl('span', 'text-[10px] text-slate-600 font-mono opacity-55 group-hover:opacity-100 group-hover:text-[#ff9d00] transition-opacity', '+'),
    );
  }
  keycap.appendChild(center);

  // Footer: Short weapon name or key code
  keycap.appendChild(
    createEl(
      'div',
      `text-[9px] font-mono truncate text-center leading-tight ${hasBind ? 'text-slate-100 font-bold' : 'text-slate-600'}`,
      primary ? primary.short : keyDef.code,
    ),
  );

  return keycap;
}

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
    paletteEl.replaceChildren(...items.map((item) => createPaletteItemNode(item, selectedPaletteItemId === item.id)));

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
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      ghostClass: 'cs2-dnd-ghost',
      chosenClass: 'cs2-dnd-chosen',
      dragClass: 'cs2-dnd-drag',
      fallbackTolerance: 3,
    });
  }

  function renderKeyCluster(container, keyDefs) {
    if (!container) return;
    container.replaceChildren(
      ...keyDefs.map((k) => createKeycapNode(k, k.code ? state.buyBinds[k.code] || [] : [])),
    );
  }

  function renderKeyboard() {
    while (keySortables.length) keySortables.pop()?.destroy();

    renderKeyCluster(fRowEl, KEYBOARD_F_ROW);
    renderKeyCluster(navClusterEl, KEYBOARD_NAV_CLUSTER);
    renderKeyCluster(arrowClusterEl, KEYBOARD_ARROWS);
    renderKeyCluster(numpadEl, KEYBOARD_NUMPAD);

    document.querySelectorAll('[data-key-code]').forEach((keyEl) => {
      const keyCode = keyEl.dataset.keyCode;
      keySortables.push(
        Sortable.create(keyEl, {
          group: { name: 'cs2buy', pull: false, put: ['cs2buy'] },
          sort: false,
          animation: 150,
          ghostClass: 'cs2-dnd-ghost',
          onAdd(evt) {
            const draggedItemId = evt.item?.dataset?.buyItem;
            evt.item?.remove();
            if (draggedItemId) assignItemToKey(keyCode, draggedItemId);
          },
        }),
      );

      keyEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        keyEl.classList.add('ring-2', 'ring-[#ff9d00]');
      });
      keyEl.addEventListener('dragleave', () => keyEl.classList.remove('ring-2', 'ring-[#ff9d00]'));
      keyEl.addEventListener('drop', (e) => {
        e.preventDefault();
        keyEl.classList.remove('ring-2', 'ring-[#ff9d00]');
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
