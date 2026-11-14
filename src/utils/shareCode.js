import {
  decodeCrosshairShareCode,
  encodeCrosshair,
  crosshairToConVars,
} from 'csgo-sharecode';

const LEGACY_COLOR_PRESETS = {
  0: [255, 50, 50],
  1: [50, 250, 50],
  2: [250, 250, 50],
  3: [80, 120, 255],
  4: [0, 255, 255],
};

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function toCs2ShareStruct(ch) {
  return {
    format: 'cs2-v1',
    style: clamp(Math.round(Number(ch.style ?? 4)), 0, 9),
    followRecoil: Boolean(ch.followRecoil),
    centerDotEnabled: Boolean(ch.centerDotEnabled),
    tStyleEnabled: Boolean(ch.tStyleEnabled),
    outlineMode: clamp(Math.round(Number(ch.outlineMode ?? 0)), 0, 2),
    red: clamp(Math.round(Number(ch.red ?? 0)), 0, 255),
    green: clamp(Math.round(Number(ch.green ?? 255)), 0, 255),
    blue: clamp(Math.round(Number(ch.blue ?? 247)), 0, 255),
    alpha: clamp(Math.round(Number(ch.alpha ?? 255)), 0, 255),
    outlineRed: 0,
    outlineGreen: 0,
    outlineBlue: 0,
    outlineAlpha: 255,
    gap: clamp(Math.round(Number(ch.gap ?? 1)), -3840, 3840),
    length: clamp(Math.round(Number(ch.length ?? 2)), 0, 255),
    thickness: clamp(Math.round(Number(ch.thickness ?? 2)), 0, 32),
    dynamicSpreadLimit: clamp(Math.round(Number(ch.dynamicSpreadLimit ?? 227)), 0, 255),
    splitDistance: clamp(Math.round(Number(ch.splitDistance ?? 3)), 0, 127),
    innerSplitAlpha: clamp(Number(ch.innerSplitAlpha ?? 0), 0, 1),
    outerSplitAlpha: clamp(Number(ch.outerSplitAlpha ?? 1), 0.3, 1),
    splitSizeRatio: clamp(Number(ch.splitSizeRatio ?? 1), 0, 1),
    screenHeight: clamp(Math.round(Number(ch.screenHeight ?? 960)), 240, 65535),
    scopeDotScale: clamp(Number(ch.sniperWidth ?? 1), 0.1, 2),
    scopeDotUseCrosshairColor: false,
  };
}

export function encodeCrosshairCode(ch) {
  try {
    return encodeCrosshair(toCs2ShareStruct(ch));
  } catch {
    return '';
  }
}

export function generateCrosshairConVars(ch) {
  try {
    const struct = toCs2ShareStruct(ch);
    const rawLines = crosshairToConVars(struct)
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    const hasOutlineThickness = rawLines.some((l) => l.startsWith('cl_crosshair_outlinethickness'));
    if (!hasOutlineThickness) {
      const outlineThick =
        Number(ch.outlineMode ?? 0) === 0
          ? 0
          : clamp(Number(ch.outlineThickness ?? 1), 0, 3);
      rawLines.push(`cl_crosshair_outlinethickness "${outlineThick.toFixed(1)}"`);
    }
    rawLines.push(`cl_crosshair_sniper_width "${clamp(Number(ch.sniperWidth ?? 1), 1, 5)}"`);
    return rawLines.join('\n');
  } catch {
    return '';
  }
}

export function decodeAnyShareCode(rawCode) {
  const cleaned = String(rawCode || '').trim();
  const decoded = decodeCrosshairShareCode(cleaned);

  if (decoded.format === 'cs2-v1') {
    return {
      style: decoded.style,
      length: decoded.length,
      thickness: decoded.thickness,
      gap: decoded.gap,
      outlineMode: decoded.outlineMode,
      outlineThickness: decoded.outlineMode === 2 ? 0.5 : decoded.outlineMode === 1 ? 1 : 0,
      centerDotEnabled: decoded.centerDotEnabled,
      tStyleEnabled: decoded.tStyleEnabled,
      followRecoil: decoded.followRecoil,
      red: decoded.red,
      green: decoded.green,
      blue: decoded.blue,
      alpha: decoded.alpha,
      sniperWidth: decoded.scopeDotScale || 1,
      screenHeight: decoded.screenHeight || 960,
      splitDistance: decoded.splitDistance,
      innerSplitAlpha: decoded.innerSplitAlpha,
      outerSplitAlpha: decoded.outerSplitAlpha,
      splitSizeRatio: decoded.splitSizeRatio,
      dynamicSpreadLimit: decoded.dynamicSpreadLimit,
    };
  }

  if (decoded.format === 'legacy-v1') {
    const presetRgb = LEGACY_COLOR_PRESETS[decoded.color];
    const [r, g, b] = decoded.color === 5 || !presetRgb
      ? [decoded.red, decoded.green, decoded.blue]
      : presetRgb;
    return {
      style: decoded.style,
      length: Math.max(0, Math.round(decoded.length * 2)),
      thickness: Math.max(1, Math.round(decoded.thickness * 2) || 1),
      gap: Math.round(decoded.gap + 5),
      outlineMode: decoded.outlineEnabled ? (decoded.outline >= 1 ? 1 : 2) : 0,
      outlineThickness: decoded.outlineEnabled ? decoded.outline : 0,
      centerDotEnabled: decoded.centerDotEnabled,
      tStyleEnabled: decoded.tStyleEnabled,
      followRecoil: Boolean(decoded.followRecoil),
      red: r,
      green: g,
      blue: b,
      alpha: decoded.alphaEnabled ? decoded.alpha : 255,
      sniperWidth: 1,
      screenHeight: 1080,
      splitDistance: decoded.splitDistance ?? 3,
      innerSplitAlpha: decoded.innerSplitAlpha ?? 0,
      outerSplitAlpha: decoded.outerSplitAlpha ?? 1,
      splitSizeRatio: decoded.splitSizeRatio ?? 1,
      dynamicSpreadLimit: 227,
    };
  }

  const outlineMode =
    decoded.format === 'legacy-v4'
      ? decoded.outlineMode
      : decoded.outlineEnabled
        ? 1
        : 0;

  return {
    style: decoded.style,
    length: decoded.length,
    thickness: decoded.thickness,
    gap: decoded.gap,
    outlineMode,
    outlineThickness: outlineMode === 1 ? 1 : outlineMode === 2 ? 0.5 : 0,
    centerDotEnabled: decoded.centerDotEnabled,
    tStyleEnabled: decoded.tStyleEnabled,
    followRecoil: Boolean(decoded.followRecoil),
    red: decoded.red,
    green: decoded.green,
    blue: decoded.blue,
    alpha: decoded.alpha,
    sniperWidth: 1,
    screenHeight: decoded.screenHeight || 1080,
    splitDistance: decoded.splitDistance ?? 3,
    innerSplitAlpha: decoded.innerSplitAlpha ?? 0,
    outerSplitAlpha: decoded.outerSplitAlpha ?? 1,
    splitSizeRatio: decoded.splitSizeRatio ?? 1,
    dynamicSpreadLimit: decoded.dynamicSpreadLimit ?? 227,
  };
}
