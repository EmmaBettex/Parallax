import React, { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Brush,
  Circle,
  Download,
  Eraser,
  Layers,
  MousePointer2,
  Palette,
  PenTool,
  Pentagon,
  Redo2,
  Scissors,
  Square,
  SunMedium,
  Trash2,
  Undo2,
  CircleDot,
} from 'lucide-react';
import type { Layer, ToolType } from '../types/editor';

export const PRESET_COLORS = [
  '#1D2D44',
  '#3D5A80',
  '#E07A5F',
  '#F5B841',
  '#2A9D8F',
  '#264653',
  '#8D99AE',
  '#D90429',
  '#F4F1DE',
  '#18181B',
  '#FFFFFF',
];

export type ActivePopover = 'tools' | 'color' | 'shadow' | 'cutout' | 'clear' | null;

interface TopToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isCutoutMode: boolean;
  setIsCutoutMode: (val: boolean) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  strokeColor: string;
  setStrokeColor: (c: string) => void;
  fillColor: string;
  setFillColor: (c: string) => void;
  shapeFilled: boolean;
  setShapeFilled: (v: boolean) => void;
  freehandClosed: boolean;
  setFreehandClosed: (v: boolean) => void;
  activeLayer: Layer | undefined;
  onUpdateActiveLayer: (patch: Partial<Layer>) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenExport: () => void;
  onClearAllShapes: () => void;
  onResetDemo: () => void;
  activePopover: ActivePopover;
  setActivePopover: (p: ActivePopover) => void;
}

const TOOL_OPTIONS: Array<{ id: ToolType; label: string; icon: React.ReactNode }> = [
  { id: 'select', label: 'Sélection', icon: <MousePointer2 className="w-4 h-4" /> },
  { id: 'pen', label: 'Plume', icon: <PenTool className="w-4 h-4" /> },
  { id: 'brush', label: 'Pinceau', icon: <Brush className="w-4 h-4" /> },
  { id: 'circle', label: 'Cercle', icon: <Circle className="w-4 h-4" /> },
  { id: 'ellipse', label: 'Ellipse', icon: <CircleDot className="w-4 h-4" /> },
  { id: 'rect', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
  { id: 'polygon', label: 'Forme libre', icon: <Pentagon className="w-4 h-4" /> },
];

export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeTool,
  setActiveTool,
  isCutoutMode,
  setIsCutoutMode,
  strokeWidth,
  setStrokeWidth,
  strokeColor,
  setStrokeColor,
  fillColor,
  setFillColor,
  shapeFilled,
  setShapeFilled,
  freehandClosed,
  setFreehandClosed,
  activeLayer,
  onUpdateActiveLayer,
  onMoveBackward,
  onMoveForward,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenExport,
  onClearAllShapes,
  onResetDemo,
  activePopover,
  setActivePopover,
}) => {
  const [confirmMode, setConfirmMode] = useState<'empty' | 'demo'>('empty');

  const togglePopover = (name: ActivePopover) => {
    setActivePopover(activePopover === name ? null : name);
  };

  const activeToolIcon =
    TOOL_OPTIONS.find((t) => t.id === activeTool)?.icon ?? <PenTool className="w-4 h-4" />;

  return (
    <header className="relative z-30 flex items-center justify-between gap-4 px-4 sm:px-6 h-16 bg-[#F4F4F5] select-none shrink-0">
      {/* Zone 1: Logo pill (Left) */}
      <div className="flex items-center gap-2.5 px-4 h-10 rounded-full bg-[#E4E4E7] border border-zinc-300/80 shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-zinc-800 shrink-0"
        >
          <rect x="3" y="3" width="14" height="14" rx="3" fill="currentColor" opacity="0.25" />
          <rect x="6" y="6" width="14" height="14" rx="3" fill="currentColor" opacity="0.55" />
          <path
            d="M7 10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-8Zm7 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-semibold tracking-tight text-zinc-900 whitespace-nowrap">
          Strate
        </span>
      </div>

      {/* Zone 2: Center 6-button wireframe toolbar pill */}
      <div className="relative flex items-center">
        <div
          role="toolbar"
          aria-label="Outils de dessin et de découpe"
          className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#E4E4E7] border border-zinc-300/80 shadow-xs"
        >
          {/* 1. Plume / Pinceau / Formes / Sélection */}
          <button
            type="button"
            aria-label="Outils de dessin, plume et formes"
            aria-expanded={activePopover === 'tools'}
            title="Plume, pinceau, formes et sélection"
            onClick={() => togglePopover('tools')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activePopover === 'tools' || activeTool !== 'select'
                ? 'bg-[#71717A] text-white shadow-xs'
                : 'bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white'
            }`}
          >
            {activeToolIcon}
          </button>

          {/* 2. Couleur du calque */}
          <button
            type="button"
            aria-label="Couleur du calque actif"
            aria-expanded={activePopover === 'color'}
            title="Couleur du calque"
            onClick={() => togglePopover('color')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer relative ${
              activePopover === 'color'
                ? 'bg-[#71717A] text-white'
                : 'bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            {activeLayer && (
              <span
                className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-white shadow-xs"
                style={{ backgroundColor: activeLayer.color }}
              />
            )}
          </button>

          {/* 3. Ombre */}
          <button
            type="button"
            aria-label="Ombre du calque"
            aria-expanded={activePopover === 'shadow'}
            title="Ombre de profondeur du calque"
            onClick={() => togglePopover('shadow')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activePopover === 'shadow' || activeLayer?.shadowEnabled
                ? 'bg-[#71717A] text-white'
                : 'bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white'
            }`}
          >
            <SunMedium className="w-4 h-4" />
          </button>

          {/* 4. Mode Trou / Découpe (et transparence du calque) */}
          <button
            type="button"
            aria-label="Mode découpe : percer un trou dans le calque"
            aria-pressed={isCutoutMode}
            title="Découpe / Trou (percer le calque actif)"
            onClick={() => {
              const next = !isCutoutMode;
              setIsCutoutMode(next);
              if (next && activeTool === 'select') {
                setActiveTool('circle');
              }
              setActivePopover('cutout');
            }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isCutoutMode
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white'
            }`}
          >
            <Scissors className="w-4 h-4" />
          </button>

          {/* 5. En arrière */}
          <button
            type="button"
            aria-label="Envoyer en arrière"
            title="Envoyer en arrière (élément ou calque)"
            onClick={onMoveBackward}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
          </button>

          {/* 6. En avant */}
          <button
            type="button"
            aria-label="Mettre en avant"
            title="Mettre en avant (élément ou calque)"
            onClick={onMoveForward}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowUpFromLine className="w-4 h-4" />
          </button>
        </div>

        {/* Popover 1: Plume, Pinceau, Formes & Propriétés */}
        {activePopover === 'tools' && (
          <div className="absolute top-13 left-0 w-[340px] bg-white rounded-xl border border-zinc-200 shadow-lg p-3.5 z-50 text-zinc-900">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-zinc-700">
                Outils & Formes
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Annuler"
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="p-1.5 rounded-md text-zinc-600 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Rétablir"
                  disabled={!canRedo}
                  onClick={onRedo}
                  className="p-1.5 rounded-md text-zinc-600 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setActiveTool(tool.id);
                    if (tool.id === 'select') {
                      setIsCutoutMode(false);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    activeTool === tool.id
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {tool.icon}
                  <span className="whitespace-nowrap truncate max-w-full">{tool.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsCutoutMode(!isCutoutMode);
                  if (!isCutoutMode && activeTool === 'select') {
                    setActiveTool('pen');
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  isCutoutMode
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <Eraser className="w-4 h-4" />
                <span className="whitespace-nowrap">Trou</span>
              </button>
            </div>

            <div className="space-y-2.5 border-t border-zinc-100 pt-2.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="tool-stroke-width" className="text-xs text-zinc-600">
                  Épaisseur
                </label>
                <div className="flex items-center gap-2 flex-1 max-w-[190px]">
                  <input
                    id="tool-stroke-width"
                    type="range"
                    min={0}
                    max={48}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="w-full accent-zinc-900"
                  />
                  <span className="text-xs font-mono-tabular text-zinc-700 w-9 text-right">
                    {strokeWidth}px
                  </span>
                </div>
              </div>

              {!isCutoutMode && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-600">Remplissage</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShapeFilled(!shapeFilled)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                          shapeFilled
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {shapeFilled ? 'Plein' : 'Contour'}
                      </button>
                      <input
                        aria-label="Couleur de remplissage"
                        type="color"
                        value={fillColor}
                        onChange={(e) => setFillColor(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border border-zinc-200"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-600">Couleur contour</span>
                    <input
                      aria-label="Couleur du contour"
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-zinc-200"
                    />
                  </div>
                </>
              )}

              {(activeTool === 'pen' || activeTool === 'brush') && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-600">Tracé libre</span>
                  <button
                    type="button"
                    onClick={() => setFreehandClosed(!freehandClosed)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                      freehandClosed
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {freehandClosed ? 'Forme fermée' : 'Trait ouvert'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Popover 2: Couleur & surface du calque */}
        {activePopover === 'color' && activeLayer && (
          <div className="absolute top-13 left-10 w-[264px] bg-white rounded-xl border border-zinc-200 shadow-lg p-3.5 z-50 text-zinc-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700 truncate max-w-[180px]">
                Couleur · {activeLayer.name}
              </span>
              <input
                aria-label="Sélecteur de couleur du calque"
                type="color"
                value={activeLayer.color}
                onChange={(e) => onUpdateActiveLayer({ color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border border-zinc-200"
              />
            </div>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  onClick={() => onUpdateActiveLayer({ color: c })}
                  className={`w-8 h-8 rounded-lg border transition-transform hover:scale-105 cursor-pointer ${
                    activeLayer.color.toLowerCase() === c.toLowerCase()
                      ? 'ring-2 ring-zinc-900 border-white'
                      : 'border-zinc-200'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="border-t border-zinc-100 pt-2.5 flex items-center justify-between">
              <span className="text-xs text-zinc-600">Surface du calque</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateActiveLayer({ hasBaseFill: !activeLayer.hasBaseFill })
                }
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  activeLayer.hasBaseFill
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {activeLayer.hasBaseFill ? 'Feuille pleine' : 'Transparente'}
              </button>
            </div>
          </div>
        )}

        {/* Popover 3: Ombre du calque */}
        {activePopover === 'shadow' && activeLayer && (
          <div className="absolute top-13 left-20 w-[264px] bg-white rounded-xl border border-zinc-200 shadow-lg p-3.5 z-50 text-zinc-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700">
                Ombre de profondeur
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateActiveLayer({ shadowEnabled: !activeLayer.shadowEnabled })
                }
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  activeLayer.shadowEnabled
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {activeLayer.shadowEnabled ? 'Activée' : 'Désactivée'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="shadow-blur" className="text-xs text-zinc-600">
                Flou
              </label>
              <input
                id="shadow-blur"
                type="range"
                min={0}
                max={60}
                value={activeLayer.shadowBlur}
                disabled={!activeLayer.shadowEnabled}
                onChange={(e) =>
                  onUpdateActiveLayer({ shadowBlur: Number(e.target.value) })
                }
                className="w-32 accent-zinc-900"
              />
              <span className="text-xs font-mono-tabular w-8 text-right">
                {activeLayer.shadowBlur}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="shadow-offset-y" className="text-xs text-zinc-600">
                Décalage
              </label>
              <input
                id="shadow-offset-y"
                type="range"
                min={-30}
                max={40}
                value={activeLayer.shadowOffsetY}
                disabled={!activeLayer.shadowEnabled}
                onChange={(e) =>
                  onUpdateActiveLayer({ shadowOffsetY: Number(e.target.value) })
                }
                className="w-32 accent-zinc-900"
              />
              <span className="text-xs font-mono-tabular w-8 text-right">
                {activeLayer.shadowOffsetY}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="shadow-opacity" className="text-xs text-zinc-600">
                Intensité
              </label>
              <input
                id="shadow-opacity"
                type="range"
                min={5}
                max={80}
                value={Math.round(activeLayer.shadowOpacity * 100)}
                disabled={!activeLayer.shadowEnabled}
                onChange={(e) =>
                  onUpdateActiveLayer({ shadowOpacity: Number(e.target.value) / 100 })
                }
                className="w-32 accent-zinc-900"
              />
              <span className="text-xs font-mono-tabular w-8 text-right">
                {Math.round(activeLayer.shadowOpacity * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Popover 4: Découpe / Trou */}
        {activePopover === 'cutout' && activeLayer && (
          <div className="absolute top-13 right-0 w-[290px] bg-white rounded-xl border border-zinc-200 shadow-lg p-3.5 z-50 text-zinc-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800">
                Mode découpe (trous)
              </span>
              <button
                type="button"
                onClick={() => setIsCutoutMode(!isCutoutMode)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  isCutoutMode
                    ? 'bg-rose-600 text-white'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {isCutoutMode ? 'Actif' : 'Inactif'}
              </button>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Dessinez une forme ou un tracé pour percer le calque actif et révéler les couches en dessous.
            </p>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {(
                [
                  { id: 'pen', label: 'Libre', icon: <PenTool className="w-3.5 h-3.5" /> },
                  { id: 'circle', label: 'Cercle', icon: <Circle className="w-3.5 h-3.5" /> },
                  { id: 'ellipse', label: 'Ellipse', icon: <CircleDot className="w-3.5 h-3.5" /> },
                  { id: 'polygon', label: 'Polygone', icon: <Pentagon className="w-3.5 h-3.5" /> },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIsCutoutMode(true);
                    setActiveTool(item.id);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer ${
                    isCutoutMode && activeTool === item.id
                      ? 'bg-rose-600 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-zinc-100 pt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Calque transparent
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateActiveLayer({ hasBaseFill: !activeLayer.hasBaseFill })
                }
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  !activeLayer.hasBaseFill
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {!activeLayer.hasBaseFill ? 'Oui' : 'Non'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zone 3: Right 2-button wireframe utility pill (Exporter + Tout supprimer) */}
      <div className="relative flex items-center shrink-0">
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#E4E4E7] border border-zinc-300/80 shadow-xs">
          <button
            type="button"
            aria-label="Exporter l'image"
            title="Exporter (PNG, SVG, Projet)"
            onClick={() => {
              setActivePopover(null);
              onOpenExport();
            }}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#A1A1AA]/70 text-zinc-800 hover:bg-[#71717A] hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="Tout supprimer"
            aria-expanded={activePopover === 'clear'}
            title="Tout supprimer ou réinitialiser"
            onClick={() => togglePopover('clear')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activePopover === 'clear'
                ? 'bg-rose-600 text-white'
                : 'bg-[#A1A1AA]/70 text-zinc-800 hover:bg-rose-600 hover:text-white'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {activePopover === 'clear' && (
          <div className="absolute top-13 right-0 w-[260px] bg-white rounded-xl border border-zinc-200 shadow-lg p-3.5 z-50 text-zinc-900 space-y-2.5">
            <p className="text-xs font-semibold text-zinc-800">
              Réinitialiser l&apos;atelier ?
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmMode('empty');
                  onClearAllShapes();
                  setActivePopover(null);
                }}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left cursor-pointer ${
                  confirmMode === 'empty'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Tout supprimer (canevas vierge)
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmMode('demo');
                  onResetDemo();
                  setActivePopover(null);
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-left bg-zinc-100 text-zinc-800 hover:bg-zinc-200 cursor-pointer"
              >
                Restaurer la scène d&apos;exemple
              </button>
              <button
                type="button"
                onClick={() => setActivePopover(null)}
                className="w-full px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
