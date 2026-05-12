'use client';
import type { RefObject } from 'react';
import type { Tool } from '@/lib/types';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface CanvasAreaProps {
  canvasRef:  RefObject<HTMLCanvasElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  coordX: number;
  coordY: number;
  activeTool: Tool;
  hasImage: boolean;
  onFitCanvas: () => void;
  onZoom1x: () => void;
  onZoomStep: (dir: number) => void;
  onViewportMouseDown: (e: React.MouseEvent) => void;
  onViewportMouseMove: (e: React.MouseEvent) => void;
  onViewportDrop: (e: React.DragEvent) => void;
  onViewportDragOver: (e: React.DragEvent) => void;
  onOverlayMouseDown: (e: React.MouseEvent) => void;
  onOverlayMouseMove: (e: React.MouseEvent) => void;
  onOverlayMouseUp: (e: React.MouseEvent) => void;
  onOverlayClick: (e: React.MouseEvent) => void;
  onOverlayContextMenu: (e: React.MouseEvent) => void;
}

const CURSOR_MAP: Record<Tool, string> = {
  move:     'grab',
  erase:    'crosshair',
  switch:   'pointer',
  polyline: 'crosshair',
  fill:     'cell',
  pen:      'crosshair',
};

const OVERLAY_CURSOR_MAP: Record<Tool, string> = {
  move:     'default',
  erase:    'crosshair',
  switch:   'pointer',
  polyline: 'crosshair',
  fill:     'cell',
  pen:      'crosshair',
};

export default function CanvasArea({
  canvasRef, overlayRef, viewportRef,
  zoom, coordX, coordY, activeTool, hasImage,
  onFitCanvas, onZoom1x, onZoomStep,
  onViewportMouseDown, onViewportMouseMove, onViewportDrop, onViewportDragOver,
  onOverlayMouseDown, onOverlayMouseMove, onOverlayMouseUp, onOverlayClick, onOverlayContextMenu,
}: CanvasAreaProps) {
  const isEditTool = activeTool === 'erase' || activeTool === 'switch' || activeTool === 'fill' || activeTool === 'pen' || activeTool === 'polyline';
  const overlayCursor = OVERLAY_CURSOR_MAP[activeTool];
  const viewportCursor = CURSOR_MAP[activeTool];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Viewport */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-auto relative select-none"
        style={{ cursor: viewportCursor }}
        onMouseDown={onViewportMouseDown}
        onMouseMove={onViewportMouseMove}
        onDrop={onViewportDrop}
        onDragOver={onViewportDragOver}
      >
        <div
          className="inline-flex items-center justify-center min-w-full min-h-full"
          style={{ padding: '16px' }}
        >
          {/* Canvas container */}
          <div id="canvasContainer" style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
            <canvas
              ref={canvasRef}
              id="canvas"
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
            {/* Overlay canvas */}
            <canvas
              ref={overlayRef}
              id="overlayCanvas"
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                imageRendering: 'pixelated',
                pointerEvents: isEditTool ? 'auto' : 'none',
                cursor: overlayCursor,
              }}
              onMouseDown={onOverlayMouseDown}
              onMouseMove={onOverlayMouseMove}
              onMouseUp={onOverlayMouseUp}
              onClick={onOverlayClick}
              onContextMenu={onOverlayContextMenu}
            />
          </div>

          {/* Empty hint — shown when no canvas content */}
          <div
            id="emptyHint"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
            style={{ display: hasImage ? 'none' : 'flex' }}
          >
            <div style={{ fontSize: 48, opacity: 0.2 }}>◈</div>
            <div className="font-mono text-sm tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              UPLOAD IMAGE TO BEGIN
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Drop an image here or use the panel
            </div>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5 items-center bg-card border border-border rounded-lg px-2 py-1.5 shadow-md">
        <button
          onClick={() => onZoomStep(-1)}
          className="p-1.5 hover:bg-panel rounded transition-all"
          title="Zoom Out"
        >
          <ZoomOut size={14} className="text-foreground" />
        </button>

        <div className="px-2 py-1 bg-input-bg border border-border rounded font-mono text-xs font-semibold text-foreground min-w-12 text-center">
          {zoom}x
        </div>

        <button
          onClick={() => onZoomStep(1)}
          className="p-1.5 hover:bg-panel rounded transition-all"
          title="Zoom In"
        >
          <ZoomIn size={14} className="text-foreground" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        <button
          onClick={onFitCanvas}
          className="px-2 py-1 bg-input-bg border border-border rounded text-xs font-mono font-bold text-foreground hover:bg-panel hover:border-gold transition-all"
          title="Fit to View"
        >
          FIT
        </button>

        <button
          onClick={onZoom1x}
          className="px-2 py-1 bg-input-bg border border-border rounded text-xs font-mono font-bold text-foreground hover:bg-panel hover:border-gold transition-all"
          title="1:1 Scale"
        >
          1:1
        </button>
      </div>

      {/* Coordinate bar */}
      <div className="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-card border border-border rounded-lg font-mono text-xs font-semibold pointer-events-none shadow-md" style={{ color: 'var(--text-tertiary)' }}>
        x:{coordX}  y:{coordY}  {zoom}x
      </div>
    </div>
  );
}
