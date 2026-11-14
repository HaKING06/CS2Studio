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
 * Supports static, CS2 dynamic spread + style 2 split tips, outline thickness,
 * center dot, T-style, alpha, and cl_crosshair_recoil screen displacement.
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

  const baseAlpha = Math.max(0, Math.min(255, Number(ch.alpha ?? 255))) / 255;
  const styleNum = Number(ch.style ?? 4);
  const isDynamic = [0, 1, 2, 3, 5, 7].includes(styleNum);
  const extraGap = isDynamic ? dynamicSpreadPx : 0;

  const scale = displayScale;
  const armLen = Math.max(0, Number(ch.length ?? 2) * scale);
  const thickness = Math.max(1, Number(ch.thickness ?? 2) * scale);
  const baseGap = Number(ch.gap ?? 1) * scale;
  const gap = baseGap + (styleNum === 2 ? extraGap * 0.28 : extraGap);
  const outlineMode = Number(ch.outlineMode ?? 0);
  const customOutline = Number(ch.outlineThickness ?? 1);
  const outlineWidth =
    outlineMode === 1
      ? Math.max(0.6, Math.min(3, customOutline) * 1.15)
      : outlineMode === 2
        ? Math.max(0.5, Math.min(3, customOutline) * 0.65)
        : 0;

    const drawRectWithOutline = (x, y, w, h, partAlpha = 1) => {
      if (w <= 0 || h <= 0 || partAlpha <= 0.01) return;
      const rx = Math.round(x * 2) / 2;
      const ry = Math.round(y * 2) / 2;
      const finalAlpha = Math.max(0, Math.min(1, baseAlpha * partAlpha));
      if (outlineWidth > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, finalAlpha * 0.92)})`;
        ctx.fillRect(
          rx - outlineWidth,
          ry - outlineWidth,
          w + outlineWidth * 2,
          h + outlineWidth * 2,
        );
      }
      ctx.fillStyle = `rgba(${ch.red}, ${ch.green}, ${ch.blue}, ${finalAlpha})`;
      ctx.fillRect(rx, ry, w, h);
    };

    const halfT = thickness / 2;

        if (styleNum !== 6 && armLen > 0) {
          if (styleNum === 2) {
            const innerAlpha = Math.max(0, Math.min(1, Number(ch.innerSplitAlpha ?? 1)));
            const outerAlpha = Math.max(0, Math.min(1, Number(ch.outerSplitAlpha ?? 0.5)));
            const ratio = Math.max(0, Math.min(1, Number(ch.splitSizeRatio ?? 0.3)));
            const splitDist = Math.max(1, Number(ch.splitDistance ?? 6)) * (scale * 0.65) + extraGap;

            const innerLen = Math.max(0.5, armLen * (1 - ratio * 0.45));
            const outerLen = Math.max(1, armLen * Math.max(0.25, ratio));
            const outerStart = gap + splitDist;

            drawRectWithOutline(cx - gap - innerLen, cy - halfT, innerLen, thickness, innerAlpha);
            drawRectWithOutline(cx + gap, cy - halfT, innerLen, thickness, innerAlpha);
            drawRectWithOutline(cx - halfT, cy + gap, thickness, innerLen, innerAlpha);
            if (!ch.tStyleEnabled) {
              drawRectWithOutline(cx - halfT, cy - gap - innerLen, thickness, innerLen, innerAlpha);
            }

            drawRectWithOutline(cx - outerStart - outerLen, cy - halfT, outerLen, thickness, outerAlpha);
            drawRectWithOutline(cx + outerStart, cy - halfT, outerLen, thickness, outerAlpha);
            drawRectWithOutline(cx - halfT, cy + outerStart, thickness, outerLen, outerAlpha);
            if (!ch.tStyleEnabled) {
              drawRectWithOutline(cx - halfT, cy - outerStart - outerLen, thickness, outerLen, outerAlpha);
            }
          } else {
            drawRectWithOutline(cx - gap - armLen, cy - halfT, armLen, thickness, 1);
            drawRectWithOutline(cx + gap, cy - halfT, armLen, thickness, 1);
            drawRectWithOutline(cx - halfT, cy + gap, thickness, armLen, 1);
            if (!ch.tStyleEnabled) {
              drawRectWithOutline(cx - halfT, cy - gap - armLen, thickness, armLen, 1);
            }
          }
        }

          if (ch.centerDotEnabled || styleNum === 6) {
            const dotSize = Math.max(2, thickness);
            drawRectWithOutline(cx - dotSize / 2, cy - dotSize / 2, dotSize, dotSize, 1);
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
