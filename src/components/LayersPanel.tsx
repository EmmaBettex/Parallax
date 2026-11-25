import React, { useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  SunMedium,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type { Layer, ParallaxSettings } from '../types/editor';

interface LayersPanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onReorderLayer: (fromIndex: number, toIndex: number) => void;
  parallaxSettings: ParallaxSettings;
  onUpdateParallaxSettings: (patch: Partial<ParallaxSettings>) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  isOpen,
  onToggleOpen,
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onUpdateLayer,
  onReorderLayer,
  parallaxSettings,
  onUpdateParallaxSettings,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Display top-most layer first (reverse order of bottom-to-top render array)
  const displayLayers = [...layers]
    .map((layer, arrayIndex) => ({ layer, arrayIndex }))
    .reverse();

  const startRename = (layer: Layer) => {
    setEditingId(layer.id);
    setDraftName(layer.name);
  };

  const commitRename = (id: string) => {
    const trimmed = draftName.trim();
    if (trimmed) {
      onUpdateLayer(id, { name: trimmed });
    }
    setEditingId(null);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        aria-label="Ouvrir le panneau des calques"
        className="absolute top-3 right-3 z-20 px-4 py-1.5 rounded-xl bg-[#52525B]/90 hover:bg-[#3F3F46] text-white text-xs font-medium shadow-sm transition-colors cursor-pointer backdrop-blur-xs"
      >
        calques
      </button>
    );
  }

  return (
    <aside
      aria-label="Panneau des calques et parallaxe"
      className="absolute top-0 right-0 bottom-0 z-20 w-[308px] max-w-[88vw] bg-[#52525B]/95 backdrop-blur-md text-zinc-100 flex flex-col border-l border-zinc-600/60 shadow-xl"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-400/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-tight text-white">
            Calques
          </span>
          <span className="text-[11px] font-mono-tabular text-zinc-300">
            {layers.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddLayer}
            aria-label="Ajouter un nouveau calque"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau</span>
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            aria-label="Fermer le panneau des calques"
            className="p-1.5 rounded-lg text-zinc-200 hover:bg-zinc-600/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Stack of Layer Cards (Wireframe State 2 Stack) */}
      <div className="flex-1 overflow-y-auto studio-scroll p-2.5 space-y-2">
        {displayLayers.map(({ layer, arrayIndex }) => {
          const isActive = layer.id === activeLayerId;
          const holesCount = layer.elements.filter((e) => e.isHole).length;
          const shapesCount = layer.elements.length - holesCount;

          return (
            <div
              key={layer.id}
              draggable={editingId !== layer.id}
              onDragStart={() => setDraggedIndex(arrayIndex)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(arrayIndex);
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== arrayIndex) {
                  onReorderLayer(draggedIndex, arrayIndex);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`rounded-xl transition-all ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-sm ring-2 ring-zinc-900/90'
                  : 'bg-[#D4D4D8] text-zinc-800 hover:bg-[#E4E4E7]'
              } ${
                dragOverIndex === arrayIndex && draggedIndex !== arrayIndex
                  ? 'ring-2 ring-sky-400'
                  : ''
              }`}
            >
              {/* Main Layer Row */}
              <div className="flex items-center gap-1.5 px-2.5 py-2">
                <span
                  title="Glisser pour réorganiser"
                  className="text-zinc-500 cursor-grab active:cursor-grabbing shrink-0"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>

                {/* Color Swatch Picker */}
                <label
                  className="relative w-5 h-5 rounded-md border border-zinc-400/60 shrink-0 cursor-pointer overflow-hidden"
                  title="Modifier la couleur du calque"
                  style={{
                    backgroundColor: layer.hasBaseFill ? layer.color : 'transparent',
                  }}
                >
                  {!layer.hasBaseFill && (
                    <span className="absolute inset-0 checkerboard-bg opacity-80" />
                  )}
                  <input
                    type="color"
                    aria-label={`Couleur du calque ${layer.name}`}
                    value={layer.color}
                    onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </label>

                {/* Layer Name / Select Trigger */}
                <div className="flex-1 min-w-0">
                  {editingId === layer.id ? (
                    <input
                      type="text"
                      value={draftName}
                      autoFocus
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => commitRename(layer.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(layer.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-1.5 py-0.5 text-xs font-medium bg-white border border-zinc-400 rounded text-zinc-900 focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectLayer(layer.id)}
                      onDoubleClick={() => startRename(layer)}
                      className="w-full text-left cursor-pointer group"
                    >
                      <div className="text-xs font-semibold truncate leading-snug">
                        {layer.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono-tabular flex items-center gap-1 mt-0.5 truncate">
                        <span>{Math.round(layer.opacity * 100)}%</span>
                        <span aria-hidden="true">·</span>
                        <span>P:{layer.depth.toFixed(2)}</span>
                        {(holesCount > 0 || shapesCount > 0) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {holesCount > 0 ? `${holesCount}T` : ''}
                              {holesCount > 0 && shapesCount > 0 ? '/' : ''}
                              {shapesCount > 0 ? `${shapesCount}F` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )}
                </div>

                {/* Quick Layer Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`Renommer ${layer.name}`}
                    title="Renommer"
                    onClick={() => startRename(layer)}
                    className="p-1 rounded hover:bg-zinc-900/10 text-zinc-600 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      layer.visible
                        ? `Masquer ${layer.name}`
                        : `Afficher ${layer.name}`
                    }
                    title={layer.visible ? 'Masquer' : 'Afficher'}
                    onClick={() =>
                      onUpdateLayer(layer.id, { visible: !layer.visible })
                    }
                    className={`p-1 rounded hover:bg-zinc-900/10 cursor-pointer ${
                      layer.visible ? 'text-zinc-700' : 'text-zinc-400'
                    }`}
                  >
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={
                      layer.locked
                        ? `Déverrouiller ${layer.name}`
                        : `Verrouiller ${layer.name}`
                    }
                    title={layer.locked ? 'Déverrouiller' : 'Verrouiller'}
                    onClick={() =>
                      onUpdateLayer(layer.id, { locked: !layer.locked })
                    }
                    className={`p-1 rounded hover:bg-zinc-900/10 cursor-pointer ${
                      layer.locked ? 'text-amber-600' : 'text-zinc-600'
                    }`}
                  >
                    {layer.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Dupliquer ${layer.name}`}
                    title="Dupliquer le calque"
                    onClick={() => onDuplicateLayer(layer.id)}
                    className="p-1 rounded hover:bg-zinc-900/10 text-zinc-600 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${layer.name}`}
                    title="Supprimer le calque"
                    disabled={layers.length <= 1}
                    onClick={() => onDeleteLayer(layer.id)}
                    className="p-1 rounded hover:bg-rose-100 text-zinc-600 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Active Layer Expanded Controls (Opacity, Depth, Sheet Mode, Shadow) */}
              {isActive && (
                <div className="px-3 pb-2.5 pt-1 border-t border-zinc-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`opacity-${layer.id}`}
                      className="text-[11px] text-zinc-600"
                    >
                      Opacité
                    </label>
                    <input
                      id={`opacity-${layer.id}`}
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layer.opacity * 100)}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, {
                          opacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-32 accent-zinc-900"
                    />
                    <span className="text-[11px] font-mono-tabular text-zinc-700 w-8 text-right">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`depth-${layer.id}`}
                      className="text-[11px] text-zinc-600"
                    >
                      Profondeur
                    </label>
                    <input
                      id={`depth-${layer.id}`}
                      type="range"
                      min={0}
                      max={200}
                      value={Math.round(layer.depth * 100)}
                      onChange={(e) =>
                        onUpdateLayer(layer.id, {
                          depth: Number(e.target.value) / 100,
                        })
                      }
                      className="w-32 accent-zinc-900"
                    />
                    <span className="text-[11px] font-mono-tabular text-zinc-700 w-8 text-right">
                      {layer.depth.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateLayer(layer.id, { hasBaseFill: !layer.hasBaseFill })
                      }
                      className={`flex-1 py-1 px-2 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                        layer.hasBaseFill
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                      }`}
                    >
                      {layer.hasBaseFill ? 'Feuille pleine' : 'Transparent'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateLayer(layer.id, {
                          shadowEnabled: !layer.shadowEnabled,
                        })
                      }
                      className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                        layer.shadowEnabled
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                      }`}
                    >
                      <SunMedium className="w-3 h-3" />
                      <span>Ombre</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Parallax Global Settings Section */}
      <div className="border-t border-zinc-400/20 bg-zinc-800/45 px-3.5 py-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            Parallaxe
          </span>
          <button
            type="button"
            aria-label="Activer ou désactiver la parallaxe"
            aria-pressed={parallaxSettings.enabled}
            onClick={() =>
              onUpdateParallaxSettings({ enabled: !parallaxSettings.enabled })
            }
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              parallaxSettings.enabled
                ? 'bg-white text-zinc-900'
                : 'bg-zinc-600 text-zinc-300'
            }`}
          >
            {parallaxSettings.enabled ? 'Activée' : 'Désactivée'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label htmlFor="parallax-intensity" className="text-[11px] text-zinc-300">
            Intensité
          </label>
          <input
            id="parallax-intensity"
            type="range"
            min={0}
            max={75}
            value={parallaxSettings.intensity}
            disabled={!parallaxSettings.enabled}
            onChange={(e) =>
              onUpdateParallaxSettings({ intensity: Number(e.target.value) })
            }
            className="w-32 accent-white"
          />
          <span className="text-[11px] font-mono-tabular text-zinc-200 w-9 text-right">
            {parallaxSettings.intensity}px
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label htmlFor="parallax-sensitivity" className="text-[11px] text-zinc-300">
            Sensibilité
          </label>
          <input
            id="parallax-sensitivity"
            type="range"
            min={4}
            max={35}
            value={Math.round(parallaxSettings.sensitivity * 100)}
            disabled={!parallaxSettings.enabled}
            onChange={(e) =>
              onUpdateParallaxSettings({
                sensitivity: Number(e.target.value) / 100,
              })
            }
            className="w-32 accent-white"
          />
          <span className="text-[11px] font-mono-tabular text-zinc-200 w-9 text-right">
            {Math.round(parallaxSettings.sensitivity * 100)}%
          </span>
        </div>
      </div>
    </aside>
  );
};
