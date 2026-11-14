const STORAGE_KEY = 'cs2studio_state_v1';

export const DEFAULT_CROSSHAIR = {
  style: 4, // 4 = Classic Static, 2 = Classic Dynamic, 0 = Classic Hybrid, 5 = Shot Feedback, 6 = Dot Only
  length: 2,
  thickness: 2,
  gap: 1,
  outlineMode: 0, // 0 = Off, 1 = Full Outline, 2 = Half Outline
  outlineThickness: 1,
  centerDotEnabled: false,
  tStyleEnabled: false,
  followRecoil: false,
  red: 0,
  green: 255,
  blue: 247,
  alpha: 255,
  sniperWidth: 1,
  screenHeight: 960,
  splitDistance: 6,
  innerSplitAlpha: 1,
  outerSplitAlpha: 0.5,
  splitSizeRatio: 0.3,
  dynamicSpreadLimit: 227,
  activeProId: 'donk-2026',
};

export const DEFAULT_VIEWMODEL = {
  fov: 68,
  offsetX: 2.5,
  offsetY: 0,
  offsetZ: -1.5,
  presetpos: 2, // 1=Desktop, 2=Couch, 3=Classic, 0=Custom
};

export const DEFAULT_BUY_BINDS = {
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
};

export const DEFAULT_AUTOEXEC_OPTS = {
  sensitivity: 1.85,
  zoomSensitivity: 1.0,
  fpsMax: 400,
  jumpThrowHelpers: true,
  hudTelemetry: true,
  lowLatency: true,
  compAudio: true,
  tacticalRadar: true,
  cleanMouse: true,
};

export const DEFAULT_ARENA_SETTINGS = {
  weaponId: 'ak47',
  distanceMeters: 20,
  mode: 'control', // 'control' | 'wall'
  showGhostGuide: true,
};

export function getDefaultState() {
  return {
    version: '0.0.4',
    crosshair: { ...DEFAULT_CROSSHAIR },
    viewmodel: { ...DEFAULT_VIEWMODEL },
    buyBinds: structuredClone(DEFAULT_BUY_BINDS),
    autoexecOpts: { ...DEFAULT_AUTOEXEC_OPTS },
    arena: { ...DEFAULT_ARENA_SETTINGS },
  };
}

export function loadState() {
  const defaults = getDefaultState();
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      version: '0.0.4',
      crosshair: { ...defaults.crosshair, ...(parsed.crosshair || {}) },
      viewmodel: { ...defaults.viewmodel, ...(parsed.viewmodel || {}) },
      buyBinds: parsed.buyBinds && typeof parsed.buyBinds === 'object' ? parsed.buyBinds : defaults.buyBinds,
      autoexecOpts: { ...defaults.autoexecOpts, ...(parsed.autoexecOpts || {}) },
      arena: { ...defaults.arena, ...(parsed.arena || {}) },
    };
  } catch {
    return defaults;
  }
}

export function saveState(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

export function resetStoredState() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  return getDefaultState();
}
