import React from 'react';
import { Download, FileCode2, FileJson, Image, X } from 'lucide-react';
import type { Layer } from '../types/editor';
import { SCENE_HEIGHT, SCENE_WIDTH } from '../utils/geometry';
import { exportSceneToSVG, renderScene } from '../utils/renderer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  activeLayerId: string;
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  layers,
  activeLayerId,
}) => {
  if (!isOpen) return null;

  const handleExportPNG = () => {
    const exportCanvas = document.createElement('canvas');
    const scale = 2;
    exportCanvas.width = SCENE_WIDTH * scale;
    exportCanvas.height = SCENE_HEIGHT * scale;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    renderScene(ctx, SCENE_WIDTH, SCENE_HEIGHT, {
      layers,
      activeLayerId,
      selectedElementId: null,
      offsets: {},
      dpr: scale,
      showSelectionOverlay: false,
    });

    const dataUrl = exportCanvas.toDataURL('image/png');
    triggerDownload(dataUrl, 'strate-composition.png');
    onClose();
  };

  const handleExportSVG = () => {
    const svgString = exportSceneToSVG(layers);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'strate-decoupes.svg');
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleExportJSON = () => {
    const json = JSON.stringify({ version: 1, layers }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'strate-projet.json');
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-2xl p-5 text-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <h2 id="export-modal-title" className="text-base font-semibold">
            Exporter la composition
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d'exportation"
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleExportPNG}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
                <Image className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Image PNG (2400 × 1500)</div>
                <div className="text-xs text-zinc-500">
                  Rendu haute définition avec ombres et découpes
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>

          <button
            type="button"
            onClick={handleExportSVG}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0">
                <FileCode2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Vectoriel SVG</div>
                <div className="text-xs text-zinc-500">
                  Calques séparés avec masques de trous natifs
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0">
                <FileJson className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Projet JSON</div>
                <div className="text-xs text-zinc-500">
                  Sauvegarde complète de tous les calques et propriétés
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
