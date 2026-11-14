export const CROSSHAIR_COLOR_PRESETS = [
  { id: 'cyan', label: 'Cyan', r: 0, g: 255, b: 247 },
  { id: 'green', label: 'Green', r: 0, g: 255, b: 68 },
  { id: 'yellow', label: 'Yellow', r: 255, g: 255, b: 0 },
  { id: 'white', label: 'White', r: 255, g: 255, b: 255 },
  { id: 'pink', label: 'Magenta', r: 255, g: 0, b: 200 },
  { id: 'red', label: 'Red', r: 255, g: 45, b: 45 },
];

export function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return null;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

/**
 * Draw any CS2 crosshair onto a 2D HTML5 Canvas.
 * Supports static, dynamic spread expansion, center dot, T-style, outlines,
 * and CS2 Follow Recoil screen displacement.
 */
export function drawCrosshairOnCanvas(
  ctx,
  width,
  height,
  ch,
  dynamicSpreadPx = 0,
  recoilOffsetPx = { x: 0, y: 0 },
  displayScale = 1.65,
) {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2 + (ch.followRecoil ? recoilOffsetPx.x : 0);
  const cy = height / 2 + (ch.followRecoil ? recoilOffsetPx.y : 0);

  const alpha = Math.max(0, Math.min(255, Number(ch.alpha ?? 255))) / 255;
  const fillStyle = `rgba(${ch.red}, ${ch.green}, ${ch.blue}, ${alpha})`;

  const isDynamic = [0, 1, 2, 3, 5, 7].includes(Number(ch.style));
  const extraGap = isDynamic ? dynamicSpreadPx : 0;

  const scale = displayScale;
  const armLen = Math.max(0, Number(ch.length ?? 2) * scale);
  const thickness = Math.max(1, Number(ch.thickness ?? 2) * scale);
  const gap = Number(ch.gap ?? 1) * scale + extraGap;
  const outlineMode = Number(ch.outlineMode ?? 0);
  const outlineWidth = outlineMode === 1 ? 1.4 : outlineMode === 2 ? 0.85 : 0;

  const drawRectWithOutline = (x, y, w, h) => {
    if (w <= 0 || h <= 0) return;
    const rx = Math.round(x * 2) / 2;
    const ry = Math.round(y * 2) / 2;
    if (outlineWidth > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, alpha * 0.92)})`;
      ctx.fillRect(rx - outlineWidth, ry - outlineWidth, w + outlineWidth * 2, h + outlineWidth * 2);
    }
    ctx.fillStyle = fillStyle;
    ctx.fillRect(rx, ry, w, h);
  };

  const halfT = thickness / 2;

  if (Number(ch.style) !== 6 && armLen > 0) {
    drawRectWithOutline(cx - gap - armLen, cy - halfT, armLen, thickness);
    drawRectWithOutline(cx + gap, cy - halfT, armLen, thickness);
    drawRectWithOutline(cx - halfT, cy + gap, thickness, armLen);
    if (!ch.tStyleEnabled) {
      drawRectWithOutline(cx - halfT, cy - gap - armLen, thickness, armLen);
    }
  }

  if (ch.centerDotEnabled || Number(ch.style) === 6) {
    const dotSize = Math.max(2, thickness);
    drawRectWithOutline(cx - dotSize / 2, cy - dotSize / 2, dotSize, dotSize);
  }
}

export function buildCrosshairMiniSvg(ch) {
  const size = 44;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 1.65;
  const len = Math.max(0, Math.min(14, (ch.length ?? 2) * scale));
  const thick = Math.max(1.2, Math.min(6, (ch.thickness ?? 2) * scale));
  const gap = Math.max(-2, Math.min(9, (ch.gap ?? 1) * scale));
  const halfT = thick / 2;
  const color = `rgba(${ch.red}, ${ch.green}, ${ch.blue}, ${(ch.alpha ?? 255) / 255})`;
  const strokeAttr = ch.outlineMode > 0 ? `stroke="rgba(0,0,0,0.9)" stroke-width="0.9"` : '';

  const rects = [];
  if (ch.style !== 6 && len > 0) {
    rects.push(`<rect x="${cx - gap - len}" y="${cy - halfT}" width="${len}" height="${thick}" fill="${color}" ${strokeAttr} />`);
    rects.push(`<rect x="${cx + gap}" y="${cy - halfT}" width="${len}" height="${thick}" fill="${color}" ${strokeAttr} />`);
    rects.push(`<rect x="${cx - halfT}" y="${cy + gap}" width="${thick}" height="${len}" fill="${color}" ${strokeAttr} />`);
    if (!ch.tStyleEnabled) {
      rects.push(`<rect x="${cx - halfT}" y="${cy - gap - len}" width="${thick}" height="${len}" fill="${color}" ${strokeAttr} />`);
    }
  }
  if (ch.centerDotEnabled || ch.style === 6) {
    const d = Math.max(2, thick);
    rects.push(`<rect x="${cx - d / 2}" y="${cy - d / 2}" width="${d}" height="${d}" fill="${color}" ${strokeAttr} />`);
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`;
}
