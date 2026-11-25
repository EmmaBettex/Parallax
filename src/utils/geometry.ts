import type { Bounds, CanvasElement, HandleType, Point } from '../types/editor';

export const SCENE_WIDTH = 1200;
export const SCENE_HEIGHT = 750;
export const SHEET_BLEED = 180;

/**
 * Computes the local (unrotated) bounding box around (0,0) for any CanvasElement,
 * and returns world-aligned axis bounds around its (x, y) center.
 */
export function getLocalHalfExtents(el: CanvasElement): { hw: number; hh: number } {
  if (el.kind === 'freehand' || el.kind === 'polygon') {
    if (el.points.length === 0) {
      return { hw: 10, hh: 10 };
    }
    let maxAbsX = 4;
    let maxAbsY = 4;
    for (const p of el.points) {
      maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
      maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
    }
    const pad = Math.max(4, el.strokeWidth / 2);
    return { hw: maxAbsX + pad, hh: maxAbsY + pad };
  }
  return {
    hw: Math.max(4, Math.abs(el.width) / 2),
    hh: Math.max(4, Math.abs(el.height) / 2),
  };
}

export function getElementBounds(el: CanvasElement): Bounds {
  const { hw, hh } = getLocalHalfExtents(el);
  return {
    minX: el.x - hw,
    minY: el.y - hh,
    maxX: el.x + hw,
    maxY: el.y + hh,
    width: hw * 2,
    height: hh * 2,
    cx: el.x,
    cy: el.y,
  };
}

/**
 * Transforms a world/scene point into the element's local unrotated coordinate space.
 */
export function worldToElementLocal(pt: Point, el: CanvasElement): Point {
  const dx = pt.x - el.x;
  const dy = pt.y - el.y;
  const cos = Math.cos(-el.rotation);
  const sin = Math.sin(-el.rotation);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

/**
 * Transforms an element-local point back to scene coordinates.
 */
export function elementLocalToWorld(pt: Point, el: CanvasElement): Point {
  const cos = Math.cos(el.rotation);
  const sin = Math.sin(el.rotation);
  return {
    x: el.x + pt.x * cos - pt.y * sin,
    y: el.y + pt.x * sin + pt.y * cos,
  };
}

/**
 * Point-in-polygon ray casting in local coordinates.
 */
export function isPointInPolygon(pt: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Distance from point p to line segment ab.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Accurate hit test for any CanvasElement (including holes!).
 */
export function hitTestElement(pt: Point, el: CanvasElement, tolerance = 8): boolean {
  const local = worldToElementLocal(pt, el);
  const { hw, hh } = getLocalHalfExtents(el);

  if (el.kind === 'circle' || el.kind === 'ellipse') {
    const rx = Math.max(4, hw + tolerance * 0.5);
    const ry = Math.max(4, hh + tolerance * 0.5);
    return (local.x * local.x) / (rx * rx) + (local.y * local.y) / (ry * ry) <= 1;
  }

  if (el.kind === 'rect') {
    return (
      Math.abs(local.x) <= hw + tolerance * 0.5 &&
      Math.abs(local.y) <= hh + tolerance * 0.5
    );
  }

  if (el.kind === 'polygon') {
    if (el.points.length >= 3 && isPointInPolygon(local, el.points)) {
      return true;
    }
    for (let i = 0; i < el.points.length; i++) {
      const next = el.points[(i + 1) % el.points.length];
      if (distanceToSegment(local, el.points[i], next) <= Math.max(tolerance, el.strokeWidth / 2)) {
        return true;
      }
    }
    return false;
  }

  // Freehand
  if ((el.closed || el.filled || el.isHole) && el.points.length >= 3) {
    if (isPointInPolygon(local, el.points)) {
      return true;
    }
  }
  const hitRadius = Math.max(tolerance, el.strokeWidth / 2 + 4);
  for (let i = 0; i < el.points.length - 1; i++) {
    if (distanceToSegment(local, el.points[i], el.points[i + 1]) <= hitRadius) {
      return true;
    }
  }
  if (el.points.length === 1) {
    return Math.hypot(local.x - el.points[0].x, local.y - el.points[0].y) <= hitRadius;
  }
  return false;
}

/**
 * Returns positions of the 8 resize handles + rotation handle in scene space.
 */
export function getElementHandles(el: CanvasElement): Record<Exclude<HandleType, 'body'>, Point> {
  const { hw, hh } = getLocalHalfExtents(el);
  const localHandles: Record<Exclude<HandleType, 'body'>, Point> = {
    nw: { x: -hw, y: -hh },
    n: { x: 0, y: -hh },
    ne: { x: hw, y: -hh },
    e: { x: hw, y: 0 },
    se: { x: hw, y: hh },
    s: { x: 0, y: hh },
    sw: { x: -hw, y: hh },
    w: { x: -hw, y: 0 },
    rotate: { x: 0, y: -hh - 28 },
  };
  const worldHandles = {} as Record<Exclude<HandleType, 'body'>, Point>;
  (Object.keys(localHandles) as Array<Exclude<HandleType, 'body'>>).forEach((key) => {
    worldHandles[key] = elementLocalToWorld(localHandles[key], el);
  });
  return worldHandles;
}

/**
 * Hit-tests selection handles around a selected element.
 */
export function hitTestHandle(
  pt: Point,
  el: CanvasElement,
  handleRadius = 11
): HandleType | null {
  const handles = getElementHandles(el);
  const keys: Array<Exclude<HandleType, 'body'>> = [
    'rotate',
    'nw',
    'ne',
    'se',
    'sw',
    'n',
    'e',
    's',
    'w',
  ];
  for (const key of keys) {
    const h = handles[key];
    if (Math.hypot(pt.x - h.x, pt.y - h.y) <= handleRadius) {
      return key;
    }
  }
  if (hitTestElement(pt, el)) {
    return 'body';
  }
  return null;
}

/**
 * Normalizes a list of raw scene points into a centered CanvasElement-ready
 * coordinate set (x, y center and relative points).
 */
export function normalizePointsToCenter(rawPoints: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
  points: Point[];
} {
  if (rawPoints.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0, points: [] };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of rawPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: cx,
    y: cy,
    width: Math.max(12, maxX - minX),
    height: Math.max(12, maxY - minY),
    points: rawPoints.map((p) => ({
      x: p.x - cx,
      y: p.y - cy,
      pressure: p.pressure,
    })),
  };
}

/**
 * Resizes an element based on a handle drag in scene coordinates.
 */
export function resizeElementWithHandle(
  initialEl: CanvasElement,
  handle: Exclude<HandleType, 'body' | 'rotate'>,
  pointerScene: Point,
  preserveAspect = false
): CanvasElement {
  const localPtr = worldToElementLocal(pointerScene, initialEl);
  const { hw: initHw, hh: initHh } = getLocalHalfExtents(initialEl);

  let minX = -initHw;
  let maxX = initHw;
  let minY = -initHh;
  let maxY = initHh;

  if (handle.includes('w')) minX = Math.min(maxX - 12, localPtr.x);
  if (handle.includes('e')) maxX = Math.max(minX + 12, localPtr.x);
  if (handle.includes('n')) minY = Math.min(maxY - 12, localPtr.y);
  if (handle.includes('s')) maxY = Math.max(minY + 12, localPtr.y);

  let newWidth = Math.max(12, maxX - minX);
  let newHeight = Math.max(12, maxY - minY);

  if (preserveAspect || initialEl.kind === 'circle') {
    const size = Math.max(newWidth, newHeight);
    if (handle === 'n' || handle === 's') {
      newWidth = newHeight;
    } else if (handle === 'e' || handle === 'w') {
      newHeight = newWidth;
    } else {
      newWidth = size;
      newHeight = size;
      if (handle.includes('w')) minX = maxX - size;
      else maxX = minX + size;
      if (handle.includes('n')) minY = maxY - size;
      else maxY = minY + size;
    }
  }

  const localCenterShift = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
  const cos = Math.cos(initialEl.rotation);
  const sin = Math.sin(initialEl.rotation);
  const newX = initialEl.x + localCenterShift.x * cos - localCenterShift.y * sin;
  const newY = initialEl.y + localCenterShift.x * sin + localCenterShift.y * cos;

  const scaleX = newWidth / Math.max(12, initHw * 2);
  const scaleY = newHeight / Math.max(12, initHh * 2);

  if (initialEl.kind === 'freehand' || initialEl.kind === 'polygon') {
    return {
      ...initialEl,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      points: initialEl.points.map((p) => ({
        ...p,
        x: p.x * scaleX,
        y: p.y * scaleY,
      })),
    };
  }

  return {
    ...initialEl,
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Simplifies/smooths overly dense pointer points using minimum spacing threshold.
 */
export function simplifyPoints(points: Point[], minDistance = 3.5): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= minDistance) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}
