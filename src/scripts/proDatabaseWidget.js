import { buildCrosshairMiniSvg } from '../utils/crosshairCanvas.js';
import { filterProCrosshairs, getProCrosshairById } from '../utils/proCrosshairs.js';
import { decodeAnyShareCode, encodeCrosshairCode } from '../utils/shareCode.js';
import { notify, t } from './clientBridge.js';

const PAGE_SIZE = 20;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function teamBadgeHtml(pro) {
  const monogram = (pro.team || 'CS')
    .replace(/Team\s+/i, '')
    .slice(0, 2)
    .toUpperCase();
  const color = pro.teamColor || '#ff9d00';
  return `<span class="inline-flex items-center justify-center w-5 h-5 rounded-sm text-[9px] font-mono font-black shrink-0 border" style="background:${color}1f;border-color:${color}55;color:${color}">${escapeHtml(monogram)}</span>`;
}

function playerAvatarHtml(pro) {
  const initials = escapeHtml((pro.player || '?').slice(0, 2).toUpperCase());
  const color = pro.teamColor || '#ff9d00';
  if (!pro.avatar) {
    return `<div class="w-9 h-9 rounded-sm flex items-center justify-center font-display font-bold text-sm border shrink-0" style="background:${color}22;border-color:${color}66;color:${color}">${initials}</div>`;
  }
  return `<div class="relative w-9 h-9 shrink-0">
    <img src="${escapeHtml(pro.avatar)}" alt="${escapeHtml(pro.player)}" width="36" height="36" loading="lazy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
      class="w-9 h-9 rounded-sm object-cover border border-slate-700 bg-slate-900" />
    <div style="display:none;background:${color}22;border-color:${color}66;color:${color}"
      class="w-9 h-9 rounded-sm items-center justify-center font-display font-bold text-sm border">${initials}</div>
  </div>`;
}

/**
 * Shared esports Pro Crosshair Database controller used cleanly on both /crosshair and /spray-arena.
 */
export function mountProDatabase({ state, onApplyCrosshair }) {
  const tbodyEl = document.getElementById('pro-db-tbody');
  const searchEl = document.getElementById('pro-db-search');
  const yearBtns = document.querySelectorAll('[data-pro-year]');
  const teamSelectEl = document.getElementById('pro-db-team');
  const countEl = document.getElementById('pro-db-count');
  const prevBtnEl = document.getElementById('pro-db-prev');
  const nextBtnEl = document.getElementById('pro-db-next');
  const pageEl = document.getElementById('pro-db-page');

  const shareInputEl = document.getElementById('crosshair-share-code');
  const importBtnEl = document.getElementById('btn-import-crosshair');
  const copyCodeBtnEl = document.getElementById('btn-copy-crosshair');

  let activeYear = 'all';
  let searchQuery = '';
  let activeTeam = 'all';
  let page = 1;
  let expandedId = null;

  function renderTable() {
    if (!tbodyEl) return;
    const filtered = filterProCrosshairs({ search: searchQuery, year: activeYear, team: activeTeam });
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    if (countEl) {
      countEl.textContent = total
        ? `${start + 1}–${Math.min(start + PAGE_SIZE, total)} / ${total}`
        : '0 / 0';
    }
    if (pageEl) pageEl.textContent = `${page} / ${totalPages}`;
    if (prevBtnEl) prevBtnEl.disabled = page <= 1;
    if (nextBtnEl) nextBtnEl.disabled = page >= totalPages;

    yearBtns.forEach((btn) => {
      const isAct = btn.dataset.proYear === activeYear;
      btn.classList.toggle('bg-[#ff9d00]/20', isAct);
      btn.classList.toggle('border-[#ff9d00]', isAct);
      btn.classList.toggle('text-[#ff9d00]', isAct);
      btn.classList.toggle('bg-[#0b0f17]', !isAct);
      btn.classList.toggle('border-slate-700', !isAct);
      btn.classList.toggle('text-slate-400', !isAct);
    });

    if (!slice.length) {
      tbodyEl.innerHTML = `<tr><td colspan="5" class="py-8 px-4 text-center text-slate-500 font-mono">${escapeHtml(t('arena.noResults') || 'No matching pros found.')}</td></tr>`;
      return;
    }

    tbodyEl.innerHTML = slice
      .map((pro) => {
        const isSelected = state.crosshair.activeProId === pro.id || state.crosshair.activeProId === pro.slug;
        const isExpanded = expandedId === pro.id;
        const specs = [
          pro.resolution,
          pro.edpi ? `${pro.edpi} eDPI` : null,
          `S${pro.settings.style}·L${pro.settings.length}·G${pro.settings.gap}`,
        ]
          .filter(Boolean)
          .join(' · ');

        const rowHtml = `<tr data-pro-id="${escapeHtml(pro.id)}"
          class="group cursor-pointer transition-colors ${
            isSelected
              ? 'bg-[#ff9d00]/12 hover:bg-[#ff9d00]/18'
              : 'hover:bg-slate-900/75'
          }">
          <td class="py-2 px-3">
            <div class="flex items-center gap-2.5 min-w-0">
              ${playerAvatarHtml(pro)}
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-sm ${isSelected ? 'text-[#ff9d00]' : 'text-white'} group-hover:text-[#ff9d00] truncate">${escapeHtml(pro.player)}</span>
                  ${pro.hltvRank ? `<span class="text-[9px] font-mono px-1 py-0.5 rounded-sm bg-[#ff9d00]/15 text-[#ff9d00] border border-[#ff9d00]/30">#${pro.hltvRank}</span>` : ''}
                </div>
                <div class="text-[10px] font-mono text-slate-400 truncate">${escapeHtml(specs)}</div>
              </div>
            </div>
          </td>
          <td class="py-2 px-3">
            <div class="flex items-center gap-2">
              ${teamBadgeHtml(pro)}
              <div class="min-w-0">
                <div class="text-xs text-slate-200 font-medium truncate">${escapeHtml(pro.team)}</div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="inline-block text-[10px] font-mono px-1.5 py-0.2 rounded-sm bg-slate-800 border border-slate-700 text-[#ff9d00]">${escapeHtml(pro.year)}</span>
                  <span class="text-[10px] text-slate-500 truncate hidden lg:inline">${escapeHtml(pro.tag)}</span>
                </div>
              </div>
            </div>
          </td>
          <td class="py-2 px-3 text-center">
            <div class="inline-flex items-center justify-center">
              ${buildCrosshairMiniSvg(pro.settings)}
            </div>
          </td>
          <td class="py-2 px-3 hidden sm:table-cell">
            <div class="flex items-center gap-1.5">
              <code class="font-mono text-[11px] text-slate-300 bg-[#0b0f17] px-1.5 py-0.5 rounded-sm border border-slate-800 max-w-[165px] truncate" title="${escapeHtml(pro.shareCode)}">${escapeHtml(pro.shareCode)}</code>
              <button type="button" data-copy-code="${escapeHtml(pro.id)}" title="Copy Share Code"
                class="px-1.5 py-0.5 rounded-sm border border-slate-700 bg-[#0b0f17] hover:border-[#ff9d00] text-[10px] font-mono text-slate-300 hover:text-[#ff9d00] cursor-pointer">
                Copy
              </button>
            </div>
          </td>
          <td class="py-2 px-3 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" data-copy-cmds="${escapeHtml(pro.id)}"
                class="px-2 py-1 rounded-sm border border-slate-700 bg-[#0b0f17] hover:border-[#ff9d00] text-[10px] font-mono text-slate-300 hover:text-[#ff9d00] cursor-pointer">
                ${escapeHtml(t('arena.copyCmds') || 'ConVars')}
              </button>
              <button type="button" data-toggle-cmds="${escapeHtml(pro.id)}" title="View Console Commands"
                class="px-2 py-1 rounded-sm border ${isExpanded ? 'border-[#ff9d00] text-[#ff9d00]' : 'border-slate-700 text-slate-400'} bg-[#0b0f17] hover:text-white text-[10px] font-mono cursor-pointer">
                { }
              </button>
            </div>
          </td>
        </tr>`;

        if (!isExpanded) return rowHtml;

        return (
          rowHtml +
          `<tr class="bg-[#05080d]">
            <td colspan="5" class="p-3 border-t border-slate-800/80">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <span class="text-[11px] font-mono uppercase text-[#ff9d00] font-bold">${escapeHtml(pro.player)} (${escapeHtml(pro.year)}) · Console Commands</span>
                <span class="text-[11px] font-mono text-slate-400">CSGO: <code class="text-slate-200">${escapeHtml(pro.shareCode)}</code></span>
              </div>
              <pre dir="ltr" class="bg-[#0b0f17] border border-slate-800 rounded-sm p-2.5 text-[11px] font-mono text-amber-200 overflow-x-auto whitespace-pre-wrap">${escapeHtml(pro.commands)}</pre>
            </td>
          </tr>`
        );
      })
      .join('');
  }

  function syncShareCodeField() {
    if (shareInputEl) {
      const activePro = state.crosshair.activeProId
        ? getProCrosshairById(state.crosshair.activeProId)
        : null;
      shareInputEl.value = activePro?.shareCode || encodeCrosshairCode(state.crosshair);
    }
    renderTable();
  }

  let searchTimer = null;
  searchEl?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value || '';
      page = 1;
      renderTable();
    }, 80);
  });

  yearBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeYear = btn.dataset.proYear || 'all';
      page = 1;
      renderTable();
    });
  });

  teamSelectEl?.addEventListener('change', () => {
    activeTeam = teamSelectEl.value || 'all';
    page = 1;
    renderTable();
  });

  prevBtnEl?.addEventListener('click', () => {
    if (page > 1) {
      page--;
      renderTable();
    }
  });

  nextBtnEl?.addEventListener('click', () => {
    page++;
    renderTable();
  });

  tbodyEl?.addEventListener('click', async (e) => {
    const copyCodeBtn = e.target.closest('[data-copy-code]');
    if (copyCodeBtn) {
      e.stopPropagation();
      const pro = getProCrosshairById(copyCodeBtn.dataset.copyCode);
      if (pro) {
        try {
          await navigator.clipboard.writeText(pro.shareCode);
          notify('success', t('arena.codeCopied'));
        } catch {
          // ignore
        }
      }
      return;
    }

    const copyCmdsBtn = e.target.closest('[data-copy-cmds]');
    if (copyCmdsBtn) {
      e.stopPropagation();
      const pro = getProCrosshairById(copyCmdsBtn.dataset.copyCmds);
      if (pro?.commands) {
        try {
          await navigator.clipboard.writeText(pro.commands);
          notify('success', t('arena.cmdsCopied') || 'Console commands copied!');
        } catch {
          // ignore
        }
      }
      return;
    }

    const toggleCmdsBtn = e.target.closest('[data-toggle-cmds]');
    if (toggleCmdsBtn) {
      e.stopPropagation();
      const id = toggleCmdsBtn.dataset.toggleCmds;
      expandedId = expandedId === id ? null : id;
      renderTable();
      return;
    }

    const row = e.target.closest('tr[data-pro-id]');
    if (!row) return;
    const pro = getProCrosshairById(row.dataset.proId);
    if (!pro) return;
    onApplyCrosshair({ ...pro.settings, activeProId: pro.id });
    if (shareInputEl) shareInputEl.value = pro.shareCode;
    notify('success', t('arena.proApplied', { player: `${pro.player} (${pro.year})` }));
  });

  importBtnEl?.addEventListener('click', () => {
    const code = shareInputEl?.value?.trim();
    if (!code) return;
    try {
      const parsed = decodeAnyShareCode(code);
      onApplyCrosshair({ ...parsed, activeProId: null });
      notify('success', t('arena.codeImported'));
    } catch {
      notify('error', t('arena.invalidCode'));
    }
  });

  copyCodeBtnEl?.addEventListener('click', async () => {
    const code = shareInputEl?.value?.trim() || encodeCrosshairCode(state.crosshair);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      notify('success', t('arena.codeCopied'));
    } catch {
      shareInputEl?.select();
    }
  });

  renderTable();
  return { sync: syncShareCodeField };
}
