import type { Layer, ParallaxOffset, ParallaxSettings, Point } from '../types/editor';

/**
 * Computes normalized pointer coordinates in [-1, 1] relative to canvas center.
 */
export function normalizePointerPosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
  return {
    x: Math.max(-1, Math.min(1, nx)),
    y: Math.max(-1, Math.min(1, ny)),
  };
}

/**
 * Calculates target parallax displacement (in logical scene pixels) for a single layer.
 * Foreground layers (higher depth) move more; background layers move less.
 */
export function computeTargetOffsetForLayer(
  pointerNorm: Point,
  isPointerInside: boolean,
  layerDepth: number,
  settings: ParallaxSettings
): ParallaxOffset {
  if (!settings.enabled || !isPointerInside) {
    return { x: 0, y: 0 };
  }
  // Subtle natural counter-perspective: moving mouse right shifts foreground layers slightly left/right.
  // Using positive proportional shift gives a direct window-box depth feel.
  return {
    x: pointerNorm.x * settings.intensity * layerDepth,
    y: pointerNorm.y * settings.intensity * layerDepth,
  };
}

/**
 * Advances current parallax offsets smoothly toward targets using exponential damping.
 * Returns updated map and whether any offset is still settling.
 */
export function stepParallaxOffsets(
  layers: Layer[],
  currentOffsets: Record<string, ParallaxOffset>,
  pointerNorm: Point,
  isPointerInside: boolean,
  settings: ParallaxSettings,
  dtSeconds = 1 / 60
): { nextOffsets: Record<string, ParallaxOffset>; isSettling: boolean } {
  const nextOffsets: Record<string, ParallaxOffset> = {};
  let isSettling = false;

  // Frame-rate independent smoothing factor derived from sensitivity (0.04..0.35)
  const clampedSens = Math.max(0.02, Math.min(0.6, settings.sensitivity));
  const alpha = 1 - Math.pow(1 - clampedSens, Math.max(0.25, dtSeconds * 60));

  for (const layer of layers) {
    const target = computeTargetOffsetForLayer(
      pointerNorm,
      isPointerInside,
      layer.depth,
      settings
    );
    const prev = currentOffsets[layer.id] ?? { x: 0, y: 0 };
    const dx = target.x - prev.x;
    const dy = target.y - prev.y;

    if (Math.abs(dx) < 0.03 && Math.abs(dy) < 0.03) {
      nextOffsets[layer.id] = { x: target.x, y: target.y };
    } else {
      isSettling = true;
      nextOffsets[layer.id] = {
        x: prev.x + dx * alpha,
        y: prev.y + dy * alpha,
      };
    }
  }

  return { nextOffsets, isSettling };
}

/**
 * Converts a canvas display pixel coordinate into scene coordinates,
 * compensating for both viewport fit scaling and the active layer's current parallax offset
 * so drawing & selection always stay exact under the cursor.
 */
export function displayToScenePoint(
  displayX: number,
  displayY: number,
  canvasWidth: number,
  canvasHeight: number,
  sceneWidth: number,
  sceneHeight: number,
  layerOffset: ParallaxOffset = { x: 0, y: 0 }
): Point {
  const scale = Math.min(canvasWidth / sceneWidth, canvasHeight / sceneHeight);
  const originX = (canvasWidth - sceneWidth * scale) / 2;
  const originY = (canvasHeight - sceneHeight * scale) / 2;
  return {
    x: (displayX - originX) / scale - layerOffset.x,
    y: (displayY - originY) / scale - layerOffset.y,
  };
}
