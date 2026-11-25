import React, { useEffect, useRef, useState } from 'react';
import type {
  CanvasElement,
  HandleType,
  Layer,
  ParallaxOffset,
  ParallaxSettings,
  Point,
  ToolType,
} from '../types/editor';
import {
  hitTestElement,
  hitTestHandle,
  normalizePointsToCenter,
  resizeElementWithHandle,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  simplifyPoints,
} from '../utils/geometry';
import { createId } from '../utils/layers';
import {
  displayToScenePoint,
  normalizePointerPosition,
  stepParallaxOffsets,
} from '../utils/parallax';
import { renderScene } from '../utils/renderer';

interface DrawingCanvasProps {
  layers: Layer[];
  activeLayer: Layer | undefined;
  activeTool: ToolType;
  isCutoutMode: boolean;
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
  shapeFilled: boolean;
  freehandClosed: boolean;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onAddElement: (el: CanvasElement) => void;
  onUpdateElement: (el: CanvasElement, pushHistory?: boolean) => void;
  parallaxSettings: ParallaxSettings;
  draftPolygonPoints: Point[];
  setDraftPolygonPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  onDismissPopovers: () => void;
  onNotify: (msg: string) => void;
}

type DragInteraction =
  | { mode: 'none' }
  | {
      mode: 'draw-shape';
      startScene: Point;
      kind: 'circle' | 'ellipse' | 'rect';
    }
  | {
      mode: 'draw-freehand';
      points: Point[];
      pressures: number[];
    }
  | {
      mode: 'transform';
      handle: HandleType;
      initialEl: CanvasElement;
      startScene: Point;
      latestEl: CanvasElement;
    };

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  layers,
  activeLayer,
  activeTool,
  isCutoutMode,
  strokeWidth,
  strokeColor,
  fillColor,
  shapeFilled,
  freehandClosed,
  selectedElementId,
  onSelectElement,
  onAddElement,
  onUpdateElement,
  parallaxSettings,
  draftPolygonPoints,
  setDraftPolygonPoints,
  onDismissPopovers,
  onNotify,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  // Mutable refs for 60fps parallax + drawing without React re-renders
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;
  const selectedIdRef = useRef(selectedElementId);
  selectedIdRef.current = selectedElementId;
  const parallaxRef = useRef(parallaxSettings);
  parallaxRef.current = parallaxSettings;
  const polygonRef = useRef(draftPolygonPoints);
  polygonRef.current = draftPolygonPoints;
  const isCutoutRef = useRef(isCutoutMode);
  isCutoutRef.current = isCutoutMode;

  const offsetsRef = useRef<Record<string, ParallaxOffset>>({});
  const pointerNormRef = useRef<Point>({ x: 0, y: 0 });
  const isPointerInsideRef = useRef<boolean>(false);
  const draftElementRef = useRef<CanvasElement | null>(null);
  const interactionRef = useRef<DragInteraction>({ mode: 'none' });
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    if (displayW <= 0 || displayH <= 0) return;

    const targetW = Math.round(displayW * dpr);
    const targetH = Math.round(displayH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // If transforming an existing element live, substitute it temporarily in render layers
    let renderLayers = layersRef.current;
    if (interactionRef.current.mode === 'transform') {
      const updatedEl = interactionRef.current.latestEl;
      const activeId = activeLayerRef.current?.id;
      renderLayers = layersRef.current.map((l) =>
        l.id === activeId
          ? {
              ...l,
              elements: l.elements.map((e) => (e.id === updatedEl.id ? updatedEl : e)),
            }
          : l
      );
    }

    offscreenRef.current = renderScene(ctx, displayW, displayH, {
      layers: renderLayers,
      activeLayerId: activeLayerRef.current?.id ?? '',
      selectedElementId: selectedIdRef.current,
      offsets: offsetsRef.current,
      draftElement: draftElementRef.current,
      draftPolygonPoints: polygonRef.current,
      isDraftHole: isCutoutRef.current,
      offscreenCanvas: offscreenRef.current,
      dpr,
      showSelectionOverlay: true,
    });
  };

  const scheduleAnimationLoop = () => {
    if (rafIdRef.current !== null) return;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      const { nextOffsets, isSettling } = stepParallaxOffsets(
        layersRef.current,
        offsetsRef.current,
        pointerNormRef.current,
        isPointerInsideRef.current,
        parallaxRef.current,
        dt
      );
      offsetsRef.current = nextOffsets;
      drawFrame();

      if (isSettling) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  };

  // Re-render immediately whenever React state (layers, selection, polygon, parallax) changes
  useEffect(() => {
    drawFrame();
    if (parallaxSettings.enabled || Object.keys(offsetsRef.current).length > 0) {
      scheduleAnimationLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, activeLayer?.id, selectedElementId, draftPolygonPoints, parallaxSettings, isCutoutMode]);

  // ResizeObserver keeps canvas sharp on layout/drawer changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      drawFrame();
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update cursor appearance on tool change
  useEffect(() => {
    if (activeTool === 'select') {
      setCursorStyle('default');
    } else {
      setCursorStyle('crosshair');
    }
  }, [activeTool]);

  const getScenePointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    const activeId = activeLayer?.id ?? '';
    const activeOffset = offsetsRef.current[activeId] ?? { x: 0, y: 0 };
    return displayToScenePoint(
      displayX,
      displayY,
      rect.width,
      rect.height,
      SCENE_WIDTH,
      SCENE_HEIGHT,
      activeOffset
    );
  };

  const commitPolygon = (pts: Point[]) => {
    if (pts.length < 3) return;
    const norm = normalizePointsToCenter(pts);
    const el: CanvasElement = {
      id: createId('el'),
      kind: 'polygon',
      x: norm.x,
      y: norm.y,
      width: norm.width,
      height: norm.height,
      rotation: 0,
      points: norm.points,
      closed: true,
      fillColor,
      filled: isCutoutMode ? true : shapeFilled,
      strokeColor,
      strokeWidth: isCutoutMode ? 0 : strokeWidth,
      opacity: 1,
      isHole: isCutoutMode,
    };
    onAddElement(el);
    setDraftPolygonPoints([]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    onDismissPopovers();
    if (e.button !== 0) return;

    const layer = activeLayer;
    if (!layer) return;

    if (!layer.visible) {
      onNotify('Le calque actif est masqué. Affichez-le pour dessiner.');
      return;
    }
    if (layer.locked) {
      onNotify('Le calque actif est verrouillé.');
      return;
    }

    const pt = getScenePointFromEvent(e);

    if (activeTool === 'select') {
      // 1. Check handles on currently selected element first
      if (selectedElementId) {
        const currentSel = layer.elements.find((el) => el.id === selectedElementId);
        if (currentSel) {
          const handle = hitTestHandle(pt, currentSel, 14);
          if (handle) {
            e.currentTarget.setPointerCapture(e.pointerId);
            interactionRef.current = {
              mode: 'transform',
              handle,
              initialEl: currentSel,
              startScene: pt,
              latestEl: currentSel,
            };
            return;
          }
        }
      }

      // 2. Hit test elements top-to-bottom on active layer
      let found: CanvasElement | null = null;
      for (let i = layer.elements.length - 1; i >= 0; i--) {
        if (hitTestElement(pt, layer.elements[i], 10)) {
          found = layer.elements[i];
          break;
        }
      }

      onSelectElement(found ? found.id : null);
      if (found) {
        e.currentTarget.setPointerCapture(e.pointerId);
        interactionRef.current = {
          mode: 'transform',
          handle: 'body',
          initialEl: found,
          startScene: pt,
          latestEl: found,
        };
      }
      return;
    }

    if (activeTool === 'polygon') {
      if (draftPolygonPoints.length >= 3) {
        const first = draftPolygonPoints[0];
        if (Math.hypot(pt.x - first.x, pt.y - first.y) <= 16) {
          commitPolygon(draftPolygonPoints);
          return;
        }
      }
      setDraftPolygonPoints((prev) => [...prev, pt]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'pen' || activeTool === 'brush') {
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      interactionRef.current = {
        mode: 'draw-freehand',
        points: [pt],
        pressures: [pressure],
      };
      const baseWidth = activeTool === 'brush' ? Math.max(6, strokeWidth * 2) : strokeWidth;
      draftElementRef.current = {
        id: 'draft',
        kind: 'freehand',
        x: pt.x,
        y: pt.y,
        width: 10,
        height: 10,
        rotation: 0,
        points: [{ x: 0, y: 0 }],
        closed: isCutoutMode ? freehandClosed : freehandClosed,
        fillColor,
        filled: isCutoutMode ? freehandClosed : shapeFilled && freehandClosed,
        strokeColor,
        strokeWidth: Math.max(2, baseWidth),
        opacity: activeTool === 'brush' && !isCutoutMode ? 0.88 : 1,
        isHole: isCutoutMode,
      };
      drawFrame();
      return;
    }

    if (activeTool === 'circle' || activeTool === 'ellipse' || activeTool === 'rect') {
      interactionRef.current = {
        mode: 'draw-shape',
        startScene: pt,
        kind: activeTool,
      };
      draftElementRef.current = {
        id: 'draft',
        kind: activeTool,
        x: pt.x,
        y: pt.y,
        width: 4,
        height: 4,
        rotation: 0,
        points: [],
        closed: true,
        fillColor,
        filled: isCutoutMode ? true : shapeFilled,
        strokeColor,
        strokeWidth: isCutoutMode ? 0 : strokeWidth,
        opacity: 1,
        cornerRadius: activeTool === 'rect' ? 12 : 0,
        isHole: isCutoutMode,
      };
      drawFrame();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Update normalized pointer for parallax
    pointerNormRef.current = normalizePointerPosition(e.clientX, e.clientY, rect);
    isPointerInsideRef.current = true;
    if (parallaxSettings.enabled) {
      scheduleAnimationLoop();
    }

    const pt = getScenePointFromEvent(e);
    const interaction = interactionRef.current;

    if (interaction.mode === 'none') {
      if (activeTool === 'select' && selectedElementId && activeLayer) {
        const sel = activeLayer.elements.find((el) => el.id === selectedElementId);
        if (sel) {
          const handle = hitTestHandle(pt, sel, 14);
          if (handle === 'rotate') setCursorStyle('grab');
          else if (handle === 'nw' || handle === 'se') setCursorStyle('nwse-resize');
          else if (handle === 'ne' || handle === 'sw') setCursorStyle('nesw-resize');
          else if (handle === 'n' || handle === 's') setCursorStyle('ns-resize');
          else if (handle === 'e' || handle === 'w') setCursorStyle('ew-resize');
          else if (handle === 'body') setCursorStyle('move');
          else setCursorStyle('default');
        }
      }
      return;
    }

    if (interaction.mode === 'transform') {
      const { handle, initialEl, startScene } = interaction;
      if (handle === 'body') {
        interaction.latestEl = {
          ...initialEl,
          x: initialEl.x + (pt.x - startScene.x),
          y: initialEl.y + (pt.y - startScene.y),
        };
      } else if (handle === 'rotate') {
        const angle = Math.atan2(pt.y - initialEl.y, pt.x - initialEl.x) + Math.PI / 2;
        interaction.latestEl = {
          ...initialEl,
          rotation: angle,
        };
      } else {
        interaction.latestEl = resizeElementWithHandle(
          initialEl,
          handle,
          pt,
          e.shiftKey || initialEl.kind === 'circle'
        );
      }
      drawFrame();
      return;
    }

    if (interaction.mode === 'draw-freehand') {
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      interaction.points.push({ x: pt.x, y: pt.y, pressure });
      interaction.pressures.push(pressure);

      const simplified = simplifyPoints(interaction.points, 2.5);
      const norm = normalizePointsToCenter(simplified);
      const avgPressure =
        interaction.pressures.reduce((a, b) => a + b, 0) / interaction.pressures.length;
      const baseWidth = activeTool === 'brush' ? Math.max(6, strokeWidth * 2) : strokeWidth;
      const pressureFactor = e.pointerType === 'pen' ? 0.65 + avgPressure * 0.75 : 1;

      draftElementRef.current = {
        id: 'draft',
        kind: 'freehand',
        x: norm.x,
        y: norm.y,
        width: norm.width,
        height: norm.height,
        rotation: 0,
        points: norm.points,
        closed: isCutoutMode ? freehandClosed : freehandClosed,
        fillColor,
        filled: isCutoutMode ? freehandClosed : shapeFilled && freehandClosed,
        strokeColor,
        strokeWidth: Math.max(2, Math.round(baseWidth * pressureFactor)),
        opacity: activeTool === 'brush' && !isCutoutMode ? 0.88 : 1,
        isHole: isCutoutMode,
      };
      drawFrame();
      return;
    }

    if (interaction.mode === 'draw-shape') {
      const dx = pt.x - interaction.startScene.x;
      const dy = pt.y - interaction.startScene.y;
      let w = Math.abs(dx);
      let h = Math.abs(dy);

      if (interaction.kind === 'circle' || e.shiftKey) {
        const size = Math.max(w, h);
        w = size;
        h = size;
      }

      const cx = interaction.startScene.x + (dx >= 0 ? w / 2 : -w / 2);
      const cy = interaction.startScene.y + (dy >= 0 ? h / 2 : -h / 2);

      draftElementRef.current = {
        id: 'draft',
        kind: interaction.kind,
        x: cx,
        y: cy,
        width: Math.max(4, w),
        height: Math.max(4, h),
        rotation: 0,
        points: [],
        closed: true,
        fillColor,
        filled: isCutoutMode ? true : shapeFilled,
        strokeColor,
        strokeWidth: isCutoutMode ? 0 : strokeWidth,
        opacity: 1,
        cornerRadius: interaction.kind === 'rect' ? 12 : 0,
        isHole: isCutoutMode,
      };
      drawFrame();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const interaction = interactionRef.current;
    if (interaction.mode === 'none') return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (interaction.mode === 'transform') {
      const changed =
        JSON.stringify(interaction.latestEl) !== JSON.stringify(interaction.initialEl);
      const committed = interaction.latestEl;
      interactionRef.current = { mode: 'none' };
      if (changed) {
        onUpdateElement(committed, true);
      } else {
        drawFrame();
      }
      return;
    }

    if (interaction.mode === 'draw-freehand') {
      const draft = draftElementRef.current;
      draftElementRef.current = null;
      interactionRef.current = { mode: 'none' };
      if (draft && interaction.points.length >= 2) {
        onAddElement({
          ...draft,
          id: createId('el'),
        });
      } else {
        drawFrame();
      }
      return;
    }

    if (interaction.mode === 'draw-shape') {
      const draft = draftElementRef.current;
      draftElementRef.current = null;
      interactionRef.current = { mode: 'none' };
      if (draft && (draft.width >= 6 || draft.height >= 6)) {
        onAddElement({
          ...draft,
          id: createId('el'),
        });
      } else {
        drawFrame();
      }
    }
  };

  const handlePointerLeave = () => {
    isPointerInsideRef.current = false;
    pointerNormRef.current = { x: 0, y: 0 };
    if (parallaxSettings.enabled) {
      scheduleAnimationLoop();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden checkerboard-bg">
      <canvas
        ref={canvasRef}
        data-testid="drawing-canvas"
        data-layer-count={layers.length}
        data-active-layer={activeLayer?.name ?? ''}
        data-active-tool={activeTool}
        data-cutout-mode={String(isCutoutMode)}
        data-parallax-enabled={String(parallaxSettings.enabled)}
        style={{ cursor: cursorStyle, touchAction: 'none' }}
        className="block w-full h-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={() => {
          if (activeTool === 'polygon' && draftPolygonPoints.length >= 3) {
            commitPolygon(draftPolygonPoints);
          }
        }}
      />
    </div>
  );
};
