import type { CanvasElement, Layer, ParallaxOffset, Point } from '../types/editor';
import { getElementHandles, getLocalHalfExtents, SCENE_HEIGHT, SCENE_WIDTH } from './geometry';

export interface RenderOptions {
  layers: Layer[];
  activeLayerId: string;
  selectedElementId: string | null;
  offsets: Record<string, ParallaxOffset>;
  draftElement?: CanvasElement | null;
  draftPolygonPoints?: Point[];
  isDraftHole?: boolean;
  /** Reusable offscreen buffer to minimize GC allocations during 60fps parallax */
  offscreenCanvas?: HTMLCanvasElement | null;
  dpr?: number;
  showSelectionOverlay?: boolean;
}

export function getSceneFitTransform(canvasWidth: number, canvasHeight: number) {
  const scale = Math.min(canvasWidth / SCENE_WIDTH, canvasHeight / SCENE_HEIGHT);
  const originX = (canvasWidth - SCENE_WIDTH * scale) / 2;
  const originY = (canvasHeight - SCENE_HEIGHT * scale) / 2;
  return { scale, originX, originY };
}

function traceSmoothFreehand(ctx: CanvasRenderingContext2D, points: Point[], closed: boolean) {
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, 0.5, 0, Math.PI * 2);
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    if (closed) ctx.closePath();
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  if (closed) {
    ctx.closePath();
  }
}

export function drawElementPath(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  ctx.beginPath();
  if (el.kind === 'circle' || el.kind === 'ellipse') {
    const rx = Math.max(2, Math.abs(el.width) / 2);
    const ry = Math.max(2, Math.abs(el.height) / 2);
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    return;
  }
  if (el.kind === 'rect') {
    const w = Math.max(4, Math.abs(el.width));
    const h = Math.max(4, Math.abs(el.height));
    const r = Math.min(el.cornerRadius ?? 0, w / 2, h / 2);
    if (r > 0 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(-w / 2, -h / 2, w, h, r);
    } else {
      ctx.rect(-w / 2, -h / 2, w, h);
    }
    return;
  }
  if (el.kind === 'polygon') {
    if (el.points.length === 0) return;
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
    }
    ctx.closePath();
    return;
  }
  traceSmoothFreehand(ctx, el.points, el.closed);
}

function paintElement(ctx: CanvasRenderingContext2D, el: CanvasElement, asMaskCutout: boolean) {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.rotation);

  if (asMaskCutout) {
    // destination-out punches alpha out proportionally to drawn alpha
    ctx.globalAlpha = Math.max(0.05, el.opacity);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawElementPath(ctx, el);
    if (el.kind !== 'freehand' || el.closed || el.filled) {
      ctx.fill();
    }
    if (el.strokeWidth > 0 && (el.kind === 'freehand' || !el.filled)) {
      ctx.lineWidth = el.kind === 'freehand' && !el.closed && !el.filled
        ? Math.max(6, el.strokeWidth)
        : el.strokeWidth;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.globalAlpha = el.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawElementPath(ctx, el);

  if (el.filled && (el.kind !== 'freehand' || el.closed)) {
    ctx.fillStyle = el.fillColor;
    ctx.fill();
  }
  if (el.strokeWidth > 0) {
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

export function renderScene(
  mainCtx: CanvasRenderingContext2D,
  displayWidth: number,
  displayHeight: number,
  options: RenderOptions
): HTMLCanvasElement | null {
  const dpr = options.dpr ?? 1;
  const bleed = 180;
  const bufW = Math.max(1, Math.round((displayWidth + bleed * 2) * dpr));
  const bufH = Math.max(1, Math.round((displayHeight + bleed * 2) * dpr));

  let offscreen = options.offscreenCanvas ?? null;
  if (!offscreen && typeof document !== 'undefined') {
    offscreen = document.createElement('canvas');
  }
  if (!offscreen) return null;

  if (offscreen.width !== bufW || offscreen.height !== bufH) {
    offscreen.width = bufW;
    offscreen.height = bufH;
  }
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return offscreen;

  const { scale, originX, originY } = getSceneFitTransform(displayWidth, displayHeight);

  // Clear main canvas (transparent so checkerboard / studio backdrop can show if all layers are cut through)
  mainCtx.save();
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.clearRect(0, 0, Math.round(displayWidth * dpr), Math.round(displayHeight * dpr));
  mainCtx.restore();

  // Render layers bottom-to-top
  for (const layer of options.layers) {
    if (!layer.visible) continue;

    const isActiveLayer = layer.id === options.activeLayerId;
    const allElements = [...layer.elements];
    if (isActiveLayer && options.draftElement) {
      allElements.push(options.draftElement);
    }

    // Fast path for completely empty layers
    if (allElements.length === 0) {
      if (!layer.hasBaseFill) {
        continue;
      }
      mainCtx.save();
      mainCtx.setTransform(1, 0, 0, 1, 0, 0);
      mainCtx.globalAlpha = layer.opacity;
      mainCtx.fillStyle = layer.color;
      mainCtx.fillRect(0, 0, Math.round(displayWidth * dpr), Math.round(displayHeight * dpr));
      mainCtx.restore();
      continue;
    }

    // 1. Render layer content + holes onto offscreen buffer
    offCtx.save();
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, bufW, bufH);

    offCtx.scale(dpr, dpr);
    offCtx.translate(bleed, bleed);

    if (layer.hasBaseFill) {
      offCtx.fillStyle = layer.color;
      offCtx.fillRect(-bleed, -bleed, displayWidth + bleed * 2, displayHeight + bleed * 2);
    }

    offCtx.save();
    offCtx.translate(originX, originY);
    offCtx.scale(scale, scale);

    // Paint normal shapes/strokes first
    for (const el of allElements) {
      if (!el.isHole) {
        paintElement(offCtx, el, false);
      }
    }

    // Punch out holes using destination-out so underlying layers reveal cleanly
    const holes = allElements.filter((el) => el.isHole);
    if (holes.length > 0) {
      offCtx.globalCompositeOperation = 'destination-out';
      for (const hole of holes) {
        paintElement(offCtx, hole, true);
      }
      offCtx.globalCompositeOperation = 'source-over';
    }

    offCtx.restore();
    offCtx.restore();

    // 2. Composite offscreen layer onto main canvas with opacity, shadow & parallax shift
    const offset = options.offsets[layer.id] ?? { x: 0, y: 0 };
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.globalAlpha = layer.opacity;

    if (layer.shadowEnabled) {
      mainCtx.shadowColor = `rgba(15, 23, 42, ${layer.shadowOpacity})`;
      mainCtx.shadowBlur = layer.shadowBlur * dpr * scale;
      mainCtx.shadowOffsetX = layer.shadowOffsetX * dpr * scale;
      mainCtx.shadowOffsetY = layer.shadowOffsetY * dpr * scale;
    }

    const drawX = (-bleed + offset.x * scale) * dpr;
    const drawY = (-bleed + offset.y * scale) * dpr;
    mainCtx.drawImage(offscreen, drawX, drawY);
    mainCtx.restore();
  }

  // 3. Selection / draft polygon overlay in active layer's parallax space
  const activeLayer = options.layers.find((l) => l.id === options.activeLayerId);
  if (activeLayer && activeLayer.visible && options.showSelectionOverlay !== false) {
    const activeOffset = options.offsets[activeLayer.id] ?? { x: 0, y: 0 };

    mainCtx.save();
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mainCtx.translate(originX + activeOffset.x * scale, originY + activeOffset.y * scale);
    mainCtx.scale(scale, scale);

    // Render in-progress polygon vertices & guide lines
    if (options.draftPolygonPoints && options.draftPolygonPoints.length > 0) {
      const pts = options.draftPolygonPoints;
      mainCtx.save();
      mainCtx.beginPath();
      mainCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        mainCtx.lineTo(pts[i].x, pts[i].y);
      }
      mainCtx.strokeStyle = options.isDraftHole ? '#EF4444' : '#18181B';
      mainCtx.lineWidth = 2 / scale;
      mainCtx.setLineDash([6 / scale, 4 / scale]);
      mainCtx.stroke();
      mainCtx.setLineDash([]);

      for (let i = 0; i < pts.length; i++) {
        mainCtx.beginPath();
        mainCtx.arc(pts[i].x, pts[i].y, i === 0 ? 6 / scale : 4.5 / scale, 0, Math.PI * 2);
        mainCtx.fillStyle = i === 0 ? '#EF4444' : '#FFFFFF';
        mainCtx.fill();
        mainCtx.strokeStyle = '#18181B';
        mainCtx.lineWidth = 1.5 / scale;
        mainCtx.stroke();
      }
      mainCtx.restore();
    }

    // Render selection frame + handles
    if (options.selectedElementId) {
      const selected = activeLayer.elements.find((e) => e.id === options.selectedElementId);
      if (selected) {
        renderSelectionBox(mainCtx, selected, scale);
      }
    }

    mainCtx.restore();
  }

  return offscreen;
}

function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  sceneScale: number
) {
  const { hw, hh } = getLocalHalfExtents(el);
  const inv = 1 / Math.max(0.25, sceneScale);

  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.rotation);

  // Dashed cutout outline or solid transform outline
  ctx.strokeStyle = el.isHole ? '#E11D48' : '#2563EB';
  ctx.lineWidth = 1.75 * inv;
  ctx.setLineDash(el.isHole ? [6 * inv, 4 * inv] : []);
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  ctx.setLineDash([]);

  // Rotation stem
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(0, -hh - 28);
  ctx.stroke();
  ctx.restore();

  // Handles in world scene coordinates
  const handles = getElementHandles(el);
  const handleEntries = Object.entries(handles) as Array<[string, Point]>;
  for (const [key, pt] of handleEntries) {
    ctx.save();
    ctx.beginPath();
    if (key === 'rotate') {
      ctx.arc(pt.x, pt.y, 5.5 * inv, 0, Math.PI * 2);
      ctx.fillStyle = el.isHole ? '#E11D48' : '#2563EB';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5 * inv;
      ctx.stroke();
    } else {
      const size = 8 * inv;
      ctx.rect(pt.x - size / 2, pt.y - size / 2, size, size);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = el.isHole ? '#E11D48' : '#2563EB';
      ctx.lineWidth = 1.75 * inv;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function elementToSvgPath(el: CanvasElement): string {
  const transform = `translate(${el.x.toFixed(2)} ${el.y.toFixed(2)}) rotate(${(
    (el.rotation * 180) /
    Math.PI
  ).toFixed(2)})`;

  if (el.kind === 'circle' || el.kind === 'ellipse') {
    const rx = Math.max(2, Math.abs(el.width) / 2);
    const ry = Math.max(2, Math.abs(el.height) / 2);
    return `<ellipse cx="0" cy="0" rx="${rx.toFixed(2)}" ry="${ry.toFixed(
      2
    )}" transform="${transform}"`;
  }
  if (el.kind === 'rect') {
    const w = Math.max(4, Math.abs(el.width));
    const h = Math.max(4, Math.abs(el.height));
    const r = Math.min(el.cornerRadius ?? 0, w / 2, h / 2);
    return `<rect x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}" width="${w.toFixed(
      2
    )}" height="${h.toFixed(2)}" rx="${r.toFixed(2)}" transform="${transform}"`;
  }
  if (el.points.length === 0) return '';
  let d = `M ${el.points[0].x.toFixed(2)} ${el.points[0].y.toFixed(2)}`;
  if (el.kind === 'polygon' || el.points.length === 2) {
    for (let i = 1; i < el.points.length; i++) {
      d += ` L ${el.points[i].x.toFixed(2)} ${el.points[i].y.toFixed(2)}`;
    }
  } else {
    for (let i = 1; i < el.points.length - 1; i++) {
      const mx = (el.points[i].x + el.points[i + 1].x) / 2;
      const my = (el.points[i].y + el.points[i + 1].y) / 2;
      d += ` Q ${el.points[i].x.toFixed(2)} ${el.points[i].y.toFixed(2)} ${mx.toFixed(
        2
      )} ${my.toFixed(2)}`;
    }
    const last = el.points[el.points.length - 1];
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  }
  if (el.kind === 'polygon' || el.closed) {
    d += ' Z';
  }
  return `<path d="${d}" transform="${transform}"`;
}

/**
 * Exports all visible layers into a multi-layer SVG with real <mask> cutouts and drop-shadow filters.
 */
export function exportSceneToSVG(layers: Layer[]): string {
  const defs: string[] = [];
  const body: string[] = [];

  layers.forEach((layer, idx) => {
    if (!layer.visible) return;
    const holes = layer.elements.filter((el) => el.isHole);
    const shapes = layer.elements.filter((el) => !el.isHole);

    let maskAttr = '';
    if (holes.length > 0) {
      const maskId = `cutout-mask-${idx}`;
      const holeEls = holes
        .map((h) => {
          const base = elementToSvgPath(h);
          if (!base) return '';
          const fill = h.kind !== 'freehand' || h.closed || h.filled ? 'black' : 'none';
          const sw = h.kind === 'freehand' && !h.closed && !h.filled ? Math.max(6, h.strokeWidth) : h.strokeWidth;
          return `${base} fill="${fill}" stroke="black" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`;
        })
        .join('\n      ');
      defs.push(
        `    <mask id="${maskId}">\n      <rect x="-200" y="-200" width="${SCENE_WIDTH + 400}" height="${SCENE_HEIGHT + 400}" fill="white" />\n      ${holeEls}\n    </mask>`
      );
      maskAttr = ` mask="url(#${maskId})"`;
    }

    let filterAttr = '';
    if (layer.shadowEnabled) {
      const filterId = `shadow-${idx}`;
      defs.push(
        `    <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">\n      <feDropShadow dx="${layer.shadowOffsetX}" dy="${layer.shadowOffsetY}" stdDeviation="${(
          layer.shadowBlur / 2
        ).toFixed(1)}" flood-color="#0f172a" flood-opacity="${layer.shadowOpacity}" />\n    </filter>`
      );
      filterAttr = ` filter="url(#${filterId})"`;
    }

    const baseRect = layer.hasBaseFill
      ? `<rect x="-200" y="-200" width="${SCENE_WIDTH + 400}" height="${SCENE_HEIGHT + 400}" fill="${layer.color}" />`
      : '';

    const shapeEls = shapes
      .map((el) => {
        const base = elementToSvgPath(el);
        if (!base) return '';
        const fill = el.filled && (el.kind !== 'freehand' || el.closed) ? el.fillColor : 'none';
        const stroke = el.strokeWidth > 0 ? el.strokeColor : 'none';
        return `${base} fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${el.opacity}" />`;
      })
      .join('\n      ');

    body.push(
      `  <g id="layer-${idx}" opacity="${layer.opacity}"${filterAttr}>\n    <g${maskAttr}>\n      ${baseRect}\n      ${shapeEls}\n    </g>\n  </g>`
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}" width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}">\n  <defs>\n${defs.join(
    '\n'
  )}\n  </defs>\n${body.join('\n')}\n</svg>`;
}
