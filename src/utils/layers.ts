import type { CanvasElement, Layer } from '../types/editor';

let idCounter = 1;
export function createId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function getDefaultDepthForIndex(index: number, total: number): number {
  if (total <= 1) return 0.5;
  // Index 0 is bottom-most (background), index total-1 is top-most (foreground)
  const ratio = index / (total - 1);
  return Number((0.15 + ratio * 1.05).toFixed(2));
}

export function createLayer(
  name: string,
  color: string,
  options: Partial<Omit<Layer, 'id' | 'name' | 'color'>> = {}
): Layer {
  return {
    id: createId('layer'),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    color,
    hasBaseFill: options.hasBaseFill ?? true,
    shadowEnabled: options.shadowEnabled ?? true,
    shadowBlur: options.shadowBlur ?? 26,
    shadowOffsetX: options.shadowOffsetX ?? 0,
    shadowOffsetY: options.shadowOffsetY ?? 10,
    shadowOpacity: options.shadowOpacity ?? 0.28,
    depth: options.depth ?? 0.6,
    elements: options.elements ? options.elements.map((el) => ({ ...el })) : [],
  };
}

/**
 * Moves a layer one step forward (towards top of stack / higher index).
 * In our data model, index 0 = bottom-most background, index length-1 = top-most foreground.
 */
export function moveLayerForward(layers: Layer[], layerId: string): Layer[] {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1 || idx >= layers.length - 1) return layers;
  const next = [...layers];
  const [item] = next.splice(idx, 1);
  next.splice(idx + 1, 0, item);
  return next;
}

/**
 * Moves a layer one step backward (towards bottom of stack / index 0).
 */
export function moveLayerBackward(layers: Layer[], layerId: string): Layer[] {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx <= 0) return layers;
  const next = [...layers];
  const [item] = next.splice(idx, 1);
  next.splice(idx - 1, 0, item);
  return next;
}

/**
 * Reorders a layer from `fromIndex` to `toIndex` in the stack array.
 */
export function reorderLayer(layers: Layer[], fromIndex: number, toIndex: number): Layer[] {
  if (
    fromIndex < 0 ||
    fromIndex >= layers.length ||
    toIndex < 0 ||
    toIndex >= layers.length ||
    fromIndex === toIndex
  ) {
    return layers;
  }
  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Deeply duplicates a layer and inserts the duplicate right above the original.
 */
export function duplicateLayer(layers: Layer[], layerId: string): {
  layers: Layer[];
  duplicatedId: string | null;
} {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return { layers, duplicatedId: null };
  const source = layers[idx];
  const copyId = createId('layer');
  const clonedElements: CanvasElement[] = source.elements.map((el) => ({
    ...el,
    id: createId('el'),
    points: el.points.map((p) => ({ ...p })),
  }));
  const copy: Layer = {
    ...source,
    id: copyId,
    name: `${source.name} (copie)`,
    elements: clonedElements,
  };
  const next = [...layers];
  next.splice(idx + 1, 0, copy);
  return { layers: next, duplicatedId: copyId };
}

/**
 * Updates properties of a specific layer immutably.
 */
export function updateLayerById(
  layers: Layer[],
  layerId: string,
  updater: (layer: Layer) => Layer
): Layer[] {
  return layers.map((layer) => (layer.id === layerId ? updater(layer) : layer));
}

/**
 * Deletes a layer by ID. Returns updated layers and a safe fallback activeLayerId.
 */
export function deleteLayerById(
  layers: Layer[],
  layerId: string,
  currentActiveId: string
): { layers: Layer[]; nextActiveId: string } {
  if (layers.length <= 1) {
    return { layers, nextActiveId: currentActiveId };
  }
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return { layers, nextActiveId: currentActiveId };
  const next = layers.filter((l) => l.id !== layerId);
  let nextActiveId = currentActiveId;
  if (currentActiveId === layerId) {
    const fallbackIdx = Math.min(idx, next.length - 1);
    nextActiveId = next[fallbackIdx].id;
  }
  return { layers: next, nextActiveId };
}

/**
 * Moves an element forward or backward inside a layer's element list.
 */
export function moveElementInLayer(
  layer: Layer,
  elementId: string,
  direction: 'forward' | 'backward'
): Layer {
  const idx = layer.elements.findIndex((e) => e.id === elementId);
  if (idx === -1) return layer;
  const targetIdx = direction === 'forward' ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= layer.elements.length) return layer;
  const nextEls = [...layer.elements];
  const [moved] = nextEls.splice(idx, 1);
  nextEls.splice(targetIdx, 0, moved);
  return { ...layer, elements: nextEls };
}
