import { encodeCrosshairCode, generateCrosshairConVars } from './shareCode.js';

export const VIEWMODEL_PRESETS = {
  1: { name: 'Desktop', fov: 60, offsetX: 1, offsetY: 1, offsetZ: -1, presetpos: 1 },
  2: { name: 'Couch', fov: 54, offsetX: 0, offsetY: 0, offsetZ: 0, presetpos: 2 },
  3: { name: 'Classic', fov: 68, offsetX: 2.5, offsetY: 0, offsetZ: -1.5, presetpos: 3 },
};

export function generateViewmodelConVars(vm) {
  return [
    `viewmodel_fov "${Number(vm.fov ?? 68).toFixed(0)}"`,
    `viewmodel_offset_x "${Number(vm.offsetX ?? 2.5).toFixed(2)}"`,
    `viewmodel_offset_y "${Number(vm.offsetY ?? 0).toFixed(2)}"`,
    `viewmodel_offset_z "${Number(vm.offsetZ ?? -1.5).toFixed(2)}"`,
    `viewmodel_presetpos "${Number(vm.presetpos ?? 0)}"`,
  ].join('\n');
}

export function generateBuyBindLines(buyBinds) {
  const lines = [];
  for (const [key, items] of Object.entries(buyBinds || {})) {
    if (!Array.isArray(items) || items.length === 0) continue;
    const cmds = items.map((id) => `buy ${id};`).join(' ');
    lines.push(`bind "${key}" "${cmds}"`);
  }
  return lines;
}

export function buildAutoexecText(state) {
  const opts = state.autoexecOpts;
  const shareCode = encodeCrosshairCode(state.crosshair);
  const crosshairLines = generateCrosshairConVars(state.crosshair);
  const viewmodelLines = generateViewmodelConVars(state.viewmodel);
  const buyBindLines = generateBuyBindLines(state.buyBinds);

  const sections = [
    `// ============================================================================`,
    `// CS2 STUDIO v${state.version || '0.0.1'} — Competitive Counter-Strike 2 Config`,
    `// Generated at https://cs2studio.haking.tr | Support: cs2studio@haking.tr`,
    `// Place in: Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\autoexec.cfg`,
    `// Launch Option: +exec autoexec.cfg`,
    `// ============================================================================`,
    ``,
    `// --- 1. ENGINE & PERFORMANCE ---`,
    `fps_max "${Math.max(0, Math.round(Number(opts.fpsMax ?? 400)))}"`,
    `fps_max_ui "120"`,
  ];

  if (opts.lowLatency) {
    sections.push(
      `engine_low_latency_sleep_after_client_tick "1"`,
      `r_drawtracers_firstperson "1"`,
      `cl_predict_body_shot_fx "0"`,
      `cl_predict_head_shot_fx "0"`,
      `cl_predict_kill_ragdolls "0"`,
    );
  }

  if (opts.hudTelemetry) {
    sections.push(
      `cl_hud_telemetry_frametime_show "2"`,
      `cl_hud_telemetry_ping_show "2"`,
      `cl_hud_telemetry_net_misdelivery_show "1"`,
      `cl_showfps "0"`,
    );
  }

  sections.push(
    ``,
    `// --- 2. MOUSE & SENSITIVITY ---`,
    `sensitivity "${Number(opts.sensitivity ?? 1.85).toFixed(3)}"`,
    `zoom_sensitivity_ratio "${Number(opts.zoomSensitivity ?? 1.0).toFixed(2)}"`,
  );

  if (opts.cleanMouse) {
    sections.push(
      `cl_autowepswitch "0"`,
      `cl_use_opens_buy_menu "0"`,
      `cl_silencer_mode "0"`,
    );
  }

  if (opts.tacticalRadar) {
    sections.push(
      ``,
      `// --- 3. TACTICAL RADAR ---`,
      `cl_radar_always_centered "0"`,
      `cl_radar_scale "0.45"`,
      `cl_radar_icon_scale_min "0.7"`,
      `cl_hud_radar_scale "1.15"`,
      `cl_radar_rotate "1"`,
    );
  }

  if (opts.compAudio) {
    sections.push(
      ``,
      `// --- 4. COMPETITIVE AUDIO ---`,
      `snd_menumusic_volume "0"`,
      `snd_roundstart_volume "0"`,
      `snd_roundend_volume "0"`,
      `snd_mapobjective_volume "0.04"`,
      `snd_tensecondwarning_volume "0.18"`,
      `snd_deathcamera_volume "0"`,
      `snd_mvp_volume "0.08"`,
      `snd_headphone_eq "1"`,
    );
  }

  sections.push(
    ``,
    `// --- 5. CROSSHAIR (Share Code: ${shareCode || 'custom'}) ---`,
    crosshairLines,
    ``,
    `// --- 6. VIEWMODEL ---`,
    viewmodelLines,
  );

  if (opts.jumpThrowHelpers) {
    sections.push(
      ``,
      `// --- 7. CS2 UTILITY & QUICK SWITCH HELPERS ---`,
      `alias "+knife_switch" "slot3"`,
      `alias "-knife_switch" "lastinv"`,
      `bind "q" "+knife_switch"`,
      `bind "c" "use weapon_c4; drop"`,
    );
  }

  sections.push(
    ``,
    `// --- 8. VISUAL BUY BINDS ---`,
    buyBindLines.length ? buyBindLines.join('\n') : `// No buy binds configured`,
    ``,
    `// --- 9. SAVE CONFIG TO DISK ---`,
    `host_writeconfig`,
    `echo ">>> CS2 Studio autoexec.cfg loaded successfully! <<<"`,
    ``,
  );

  return sections.join('\n');
}
