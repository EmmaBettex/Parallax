import React from 'react';
import {
  Check,
  Copy,
  MousePointer2,
  PenTool,
  Redo2,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { CanvasElement, ParallaxSettings, ToolType } from '../types/editor';

interface SelectionInspectorProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isCutoutMode: boolean;
  setIsCutoutMode: (v: boolean) => void;
  selectedElement: CanvasElement | null;
  onUpdateSelectedElement: (patch: Partial<CanvasElement>) => void;
  onDuplicateSelectedElement: () => void;
  onDeleteSelectedElement: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  parallaxSettings: ParallaxSettings;
  onToggleParallax: () => void;
  draftPolygonCount: number;
  onFinishPolygon: () => void;
  onCancelPolygon: () => void;
  isLayersOpen: boolean;
}

export const SelectionInspector: React.FC<SelectionInspectorProps> = ({
  activeTool,
  setActiveTool,
  isCutoutMode,
  setIsCutoutMode,
  selectedElement,
  onUpdateSelectedElement,
  onDuplicateSelectedElement,
  onDeleteSelectedElement,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  parallaxSettings,
  onToggleParallax,
  draftPolygonCount,
  onFinishPolygon,
  onCancelPolygon,
  isLayersOpen,
}) => {
  return (
    <>
      {/* Discreet Bottom-Left Quick Mode & Parallax Pill */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 p-1 rounded-xl bg-white/90 backdrop-blur-md border border-zinc-200/90 shadow-sm text-zinc-800">
        <button
          type="button"
          onClick={() => {
            setActiveTool('select');
            setIsCutoutMode(false);
          }}
          aria-label="Outil Sélection"
          title="Sélectionner et transformer (V)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTool === 'select'
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <MousePointer2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sélection</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeTool === 'select') setActiveTool('pen');
            setIsCutoutMode(false);
          }}
          aria-label="Dessiner une forme ou un trait"
          title="Dessiner (P)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTool !== 'select' && !isCutoutMode
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dessin</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeTool === 'select') setActiveTool('circle');
            setIsCutoutMode(true);
          }}
          aria-label="Percer un trou"
          title="Mode découpe / trou (H)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTool !== 'select' && isCutoutMode
              ? 'bg-rose-600 text-white'
              : 'text-rose-700 hover:bg-rose-50'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Trou</span>
        </button>

        <div className="w-px h-4 bg-zinc-200 mx-0.5" aria-hidden="true" />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Annuler la dernière action"
          title="Annuler (Ctrl+Z)"
          className="p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Rétablir"
          title="Rétablir (Ctrl+Y)"
          className="p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-200 mx-0.5" aria-hidden="true" />

        <button
          type="button"
          onClick={onToggleParallax}
          aria-label="Basculer l'effet de parallaxe"
          aria-pressed={parallaxSettings.enabled}
          title="Activer ou désactiver la parallaxe"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            parallaxSettings.enabled
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-400 hover:bg-zinc-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            Parallaxe {parallaxSettings.enabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Polygon In-Progress Action Prompt */}
      {draftPolygonCount > 0 && (
        <div
          className={`absolute bottom-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 text-white shadow-md text-xs ${
            isLayersOpen ? 'right-[324px]' : 'right-3'
          }`}
        >
          <span className="font-mono-tabular">{draftPolygonCount} pts</span>
          {draftPolygonCount >= 3 && (
            <button
              type="button"
              onClick={onFinishPolygon}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white text-zinc-900 font-medium cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Fermer</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCancelPolygon}
            aria-label="Annuler le polygone"
            className="p-1 rounded-md text-zinc-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Element Contextual Inspector */}
      {selectedElement && draftPolygonCount === 0 && (
        <div
          className={`absolute bottom-3 z-20 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-zinc-200 shadow-md text-zinc-800 ${
            isLayersOpen ? 'right-[324px]' : 'right-3'
          }`}
        >
          <button
            type="button"
            onClick={() =>
              onUpdateSelectedElement({ isHole: !selectedElement.isHole })
            }
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              selectedElement.isHole
                ? 'bg-rose-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>{selectedElement.isHole ? 'Trou (découpe)' : 'Forme'}</span>
          </button>

          {!selectedElement.isHole && (
            <>
              <label
                className="flex items-center gap-1 text-[11px] text-zinc-600 cursor-pointer"
                title="Couleur de remplissage"
              >
                <span>Fond</span>
                <input
                  type="color"
                  aria-label="Couleur de fond de l'élément"
                  value={selectedElement.fillColor}
                  onChange={(e) =>
                    onUpdateSelectedElement({
                      fillColor: e.target.value,
                      filled: true,
                    })
                  }
                  className="w-6 h-6 rounded border border-zinc-200 cursor-pointer"
                />
              </label>

              <label
                className="flex items-center gap-1 text-[11px] text-zinc-600 cursor-pointer"
                title="Couleur du contour"
              >
                <span>Contour</span>
                <input
                  type="color"
                  aria-label="Couleur du contour de l'élément"
                  value={selectedElement.strokeColor}
                  onChange={(e) =>
                    onUpdateSelectedElement({ strokeColor: e.target.value })
                  }
                  className="w-6 h-6 rounded border border-zinc-200 cursor-pointer"
                />
              </label>
            </>
          )}

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="selected-stroke-width"
              className="text-[11px] text-zinc-500"
            >
              Trait
            </label>
            <input
              id="selected-stroke-width"
              type="range"
              min={0}
              max={40}
              value={selectedElement.strokeWidth}
              onChange={(e) =>
                onUpdateSelectedElement({ strokeWidth: Number(e.target.value) })
              }
              className="w-16 accent-zinc-900"
            />
            <span className="text-[11px] font-mono-tabular w-7">
              {selectedElement.strokeWidth}px
            </span>
          </div>

          <div className="w-px h-4 bg-zinc-200" aria-hidden="true" />

          <button
            type="button"
            aria-label="Dupliquer l'élément"
            title="Dupliquer"
            onClick={onDuplicateSelectedElement}
            className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            aria-label="Supprimer l'élément sélectionné"
            title="Supprimer (Suppr)"
            onClick={onDeleteSelectedElement}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
