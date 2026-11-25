import { useCallback, useEffect, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { ExportModal } from './components/ExportModal';
import { LayersPanel } from './components/LayersPanel';
import { SelectionInspector } from './components/SelectionInspector';
import { PRESET_COLORS, TopToolbar, type ActivePopover } from './components/TopToolbar';
import { createDemoLayers } from './data/demoScene';
import type {
  CanvasElement,
  Layer,
  ParallaxSettings,
  Point,
  ToolType,
} from './types/editor';
import { normalizePointsToCenter } from './utils/geometry';
import {
  createId,
  createLayer,
  deleteLayerById,
  duplicateLayer,
  getDefaultDepthForIndex,
  moveElementInLayer,
  moveLayerBackward,
  moveLayerForward,
  reorderLayer,
  updateLayerById,
} from './utils/layers';

export default function App() {
  const [initialLayers] = useState<Layer[]>(() => createDemoLayers());
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [activeLayerId, setActiveLayerId] = useState<string>(
    () => initialLayers[initialLayers.length - 1].id
  );

  // Undo/redo history
  const [history, setHistory] = useState<Layer[][]>([initialLayers]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Tool & style state
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [isCutoutMode, setIsCutoutMode] = useState<boolean>(false);
  const [strokeWidth, setStrokeWidth] = useState<number>(8);
  const [strokeColor, setStrokeColor] = useState<string>('#18181B');
  const [fillColor, setFillColor] = useState<string>('#F4F1DE');
  const [shapeFilled, setShapeFilled] = useState<boolean>(true);
  const [freehandClosed, setFreehandClosed] = useState<boolean>(true);

  // Selection & polygon draft state
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draftPolygonPoints, setDraftPolygonPoints] = useState<Point[]>([]);

  // Panels & popovers
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Parallax settings
  const [parallaxSettings, setParallaxSettings] = useState<ParallaxSettings>({
    enabled: true,
    intensity: 28,
    sensitivity: 0.14,
  });

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[layers.length - 1];
  const selectedElement =
    activeLayer?.elements.find((e) => e.id === selectedElementId) ?? null;

  const commitLayers = useCallback(
    (nextLayers: Layer[], recordHistory = true) => {
      setLayers(nextLayers);
      if (recordHistory) {
        setHistory((prev) => {
          const truncated = prev.slice(0, historyIndex + 1);
          const next = [...truncated, nextLayers];
          return next.slice(-40);
        });
        setHistoryIndex((prev) => Math.min(prev + 1, 39));
      }
    },
    [historyIndex]
  );

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    const restored = history[nextIdx];
    setHistoryIndex(nextIdx);
    setLayers(restored);
    setSelectedElementId(null);
    if (!restored.some((l) => l.id === activeLayerId)) {
      setActiveLayerId(restored[restored.length - 1]?.id ?? '');
    }
  }, [activeLayerId, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    const restored = history[nextIdx];
    setHistoryIndex(nextIdx);
    setLayers(restored);
    setSelectedElementId(null);
    if (!restored.some((l) => l.id === activeLayerId)) {
      setActiveLayerId(restored[restored.length - 1]?.id ?? '');
    }
  }, [activeLayerId, history, historyIndex]);

  const handleAddElement = useCallback(
    (el: CanvasElement) => {
      if (!activeLayer) return;
      const next = updateLayerById(layers, activeLayer.id, (layer) => ({
        ...layer,
        elements: [...layer.elements, el],
      }));
      commitLayers(next, true);
    },
    [activeLayer, commitLayers, layers]
  );

  const handleUpdateElement = useCallback(
    (el: CanvasElement, pushHistory = true) => {
      if (!activeLayer) return;
      const next = updateLayerById(layers, activeLayer.id, (layer) => ({
        ...layer,
        elements: layer.elements.map((item) => (item.id === el.id ? el : item)),
      }));
      commitLayers(next, pushHistory);
    },
    [activeLayer, commitLayers, layers]
  );

  const handleDeleteSelectedElement = useCallback(() => {
    if (!activeLayer || !selectedElementId) return;
    const next = updateLayerById(layers, activeLayer.id, (layer) => ({
      ...layer,
      elements: layer.elements.filter((e) => e.id !== selectedElementId),
    }));
    setSelectedElementId(null);
    commitLayers(next, true);
  }, [activeLayer, commitLayers, layers, selectedElementId]);

  const handleDuplicateSelectedElement = useCallback(() => {
    if (!activeLayer || !selectedElement) return;
    const copy: CanvasElement = {
      ...selectedElement,
      id: createId('el'),
      x: selectedElement.x + 24,
      y: selectedElement.y + 24,
      points: selectedElement.points.map((p) => ({ ...p })),
    };
    const next = updateLayerById(layers, activeLayer.id, (layer) => ({
      ...layer,
      elements: [...layer.elements, copy],
    }));
    commitLayers(next, true);
    setSelectedElementId(copy.id);
  }, [activeLayer, commitLayers, layers, selectedElement]);

  const handleFinishPolygon = useCallback(() => {
    if (draftPolygonPoints.length < 3 || !activeLayer) return;
    const norm = normalizePointsToCenter(draftPolygonPoints);
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
    handleAddElement(el);
    setDraftPolygonPoints([]);
  }, [
    activeLayer,
    draftPolygonPoints,
    fillColor,
    handleAddElement,
    isCutoutMode,
    shapeFilled,
    strokeColor,
    strokeWidth,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          handleDeleteSelectedElement();
        }
        return;
      }

      if (e.key === 'Escape') {
        setDraftPolygonPoints([]);
        setActivePopover(null);
        setSelectedElementId(null);
        return;
      }

      if (e.key === 'Enter' && draftPolygonPoints.length >= 3) {
        e.preventDefault();
        handleFinishPolygon();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') {
        setActiveTool('select');
        setIsCutoutMode(false);
      } else if (key === 'p') {
        setActiveTool('pen');
      } else if (key === 'b') {
        setActiveTool('brush');
      } else if (key === 'c') {
        setActiveTool('circle');
      } else if (key === 'e') {
        setActiveTool('ellipse');
      } else if (key === 'r') {
        setActiveTool('rect');
      } else if (key === 'g') {
        setActiveTool('polygon');
      } else if (key === 'h') {
        setIsCutoutMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    draftPolygonPoints.length,
    handleDeleteSelectedElement,
    handleFinishPolygon,
    handleRedo,
    handleUndo,
    selectedElementId,
  ]);

  // Layer actions
  const handleAddLayer = () => {
    const color = PRESET_COLORS[layers.length % PRESET_COLORS.length];
    const newLayer = createLayer(`Calque ${layers.length + 1}`, color, {
      depth: getDefaultDepthForIndex(layers.length, layers.length + 1),
      hasBaseFill: false,
      shadowEnabled: true,
    });
    const next = [...layers, newLayer];
    commitLayers(next, true);
    setActiveLayerId(newLayer.id);
    setSelectedElementId(null);
  };

  const handleDeleteLayer = (id: string) => {
    const res = deleteLayerById(layers, id, activeLayerId);
    commitLayers(res.layers, true);
    setActiveLayerId(res.nextActiveId);
    setSelectedElementId(null);
  };

  const handleDuplicateLayer = (id: string) => {
    const res = duplicateLayer(layers, id);
    if (res.duplicatedId) {
      commitLayers(res.layers, true);
      setActiveLayerId(res.duplicatedId);
      setSelectedElementId(null);
    }
  };

  const handleUpdateLayer = (id: string, patch: Partial<Layer>) => {
    const next = updateLayerById(layers, id, (l) => ({ ...l, ...patch }));
    commitLayers(next, true);
  };

  const handleReorderLayer = (fromIndex: number, toIndex: number) => {
    const next = reorderLayer(layers, fromIndex, toIndex);
    commitLayers(next, true);
  };

  const handleMoveBackward = () => {
    if (!activeLayer) return;
    if (selectedElementId) {
      const next = updateLayerById(layers, activeLayer.id, (l) =>
        moveElementInLayer(l, selectedElementId, 'backward')
      );
      commitLayers(next, true);
    } else {
      const next = moveLayerBackward(layers, activeLayer.id);
      commitLayers(next, true);
    }
  };

  const handleMoveForward = () => {
    if (!activeLayer) return;
    if (selectedElementId) {
      const next = updateLayerById(layers, activeLayer.id, (l) =>
        moveElementInLayer(l, selectedElementId, 'forward')
      );
      commitLayers(next, true);
    } else {
      const next = moveLayerForward(layers, activeLayer.id);
      commitLayers(next, true);
    }
  };

  const handleClearAllShapes = () => {
    const freshLayer = createLayer('Calque 1', '#E4E4E7', {
      hasBaseFill: true,
      shadowEnabled: false,
      depth: 0.5,
    });
    commitLayers([freshLayer], true);
    setActiveLayerId(freshLayer.id);
    setSelectedElementId(null);
    setDraftPolygonPoints([]);
  };

  const handleResetDemo = () => {
    const demo = createDemoLayers();
    commitLayers(demo, true);
    setActiveLayerId(demo[demo.length - 1].id);
    setSelectedElementId(null);
    setDraftPolygonPoints([]);
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#F4F4F5] text-zinc-900">
      <TopToolbar
        activeTool={activeTool}
        setActiveTool={(tool) => {
          setActiveTool(tool);
          if (tool !== 'polygon') setDraftPolygonPoints([]);
          if (tool !== 'select') setSelectedElementId(null);
        }}
        isCutoutMode={isCutoutMode}
        setIsCutoutMode={setIsCutoutMode}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        strokeColor={strokeColor}
        setStrokeColor={setStrokeColor}
        fillColor={fillColor}
        setFillColor={setFillColor}
        shapeFilled={shapeFilled}
        setShapeFilled={setShapeFilled}
        freehandClosed={freehandClosed}
        setFreehandClosed={setFreehandClosed}
        activeLayer={activeLayer}
        onUpdateActiveLayer={(patch) =>
          activeLayer && handleUpdateLayer(activeLayer.id, patch)
        }
        onMoveBackward={handleMoveBackward}
        onMoveForward={handleMoveForward}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onOpenExport={() => setIsExportOpen(true)}
        onClearAllShapes={handleClearAllShapes}
        onResetDemo={handleResetDemo}
        activePopover={activePopover}
        setActivePopover={setActivePopover}
      />

      {/* Main Canvas Stage (framed cleanly like the wireframe) */}
      <main className="relative flex-1 px-4 sm:px-6 pb-5 min-h-0">
        <div className="relative w-full h-full rounded-sm border border-zinc-300/80 shadow-xs overflow-hidden bg-[#E4E4E7]">
          <DrawingCanvas
            layers={layers}
            activeLayer={activeLayer}
            activeTool={activeTool}
            isCutoutMode={isCutoutMode}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            fillColor={fillColor}
            shapeFilled={shapeFilled}
            freehandClosed={freehandClosed}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onAddElement={handleAddElement}
            onUpdateElement={handleUpdateElement}
            parallaxSettings={parallaxSettings}
            draftPolygonPoints={draftPolygonPoints}
            setDraftPolygonPoints={setDraftPolygonPoints}
            onDismissPopovers={() => setActivePopover(null)}
            onNotify={showNotice}
          />

          {/* Top-right Calques pill & collapsible vertical Layers Panel */}
          <LayersPanel
            isOpen={isLayersOpen}
            onToggleOpen={() => setIsLayersOpen((prev) => !prev)}
            layers={layers}
            activeLayerId={activeLayer?.id ?? ''}
            onSelectLayer={(id) => {
              setActiveLayerId(id);
              setSelectedElementId(null);
            }}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onDuplicateLayer={handleDuplicateLayer}
            onUpdateLayer={handleUpdateLayer}
            onReorderLayer={handleReorderLayer}
            parallaxSettings={parallaxSettings}
            onUpdateParallaxSettings={(patch) =>
              setParallaxSettings((prev) => ({ ...prev, ...patch }))
            }
          />

          {/* Bottom quick mode switcher & contextual element inspector */}
          <SelectionInspector
            activeTool={activeTool}
            setActiveTool={(tool) => {
              setActiveTool(tool);
              if (tool !== 'polygon') setDraftPolygonPoints([]);
              if (tool !== 'select') setSelectedElementId(null);
            }}
            isCutoutMode={isCutoutMode}
            setIsCutoutMode={setIsCutoutMode}
            selectedElement={selectedElement}
            onUpdateSelectedElement={(patch) =>
              selectedElement &&
              handleUpdateElement({ ...selectedElement, ...patch }, true)
            }
            onDuplicateSelectedElement={handleDuplicateSelectedElement}
            onDeleteSelectedElement={handleDeleteSelectedElement}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            parallaxSettings={parallaxSettings}
            onToggleParallax={() =>
              setParallaxSettings((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            draftPolygonCount={draftPolygonPoints.length}
            onFinishPolygon={handleFinishPolygon}
            onCancelPolygon={() => setDraftPolygonPoints([])}
            isLayersOpen={isLayersOpen}
          />

          {/* Subtle transient notification (locked/hidden layer feedback) */}
          {notice && (
            <div
              role="status"
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-zinc-900/90 text-white text-xs font-medium shadow-md"
            >
              {notice}
            </div>
          )}
        </div>
      </main>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        layers={layers}
        activeLayerId={activeLayer?.id ?? ''}
      />
    </div>
  );
}
