'use client';
import type { RefObject } from 'react';
import type { Tool } from '@/lib/types';

interface CanvasAreaProps {
  canvasRef:    RefObject<HTMLCanvasElement | null>;
  overlayRef:   RefObject<HTMLCanvasElement | null>;
  viewportRef:  RefObject<HTMLDivElement    | null>;
  zoom: number;
  coordX: number;
  coordY: number;
  activeTool: Tool;
  hasImage: boolean;
  onFitCanvas:  () => void;
  onZoom1x:     () => void;
  onZoomStep:   (dir: number) => void;
  onZoomTo:     (v: number)   => void;
  onViewportMouseDown: (e: React.MouseEvent) => void;
  onViewportMouseMove: (e: React.MouseEvent) => void;
  onViewportDrop:      (e: React.DragEvent)  => void;
  onViewportDragOver:  (e: React.DragEvent)  => void;
  onOverlayMouseDown:  (e: React.MouseEvent) => void;
  onOverlayMouseMove:  (e: React.MouseEvent) => void;
  onOverlayMouseUp:    (e: React.MouseEvent) => void;
  onOverlayClick:      (e: React.MouseEvent) => void;
  onOverlayContextMenu:(e: React.MouseEvent) => void;
}

const CURSOR:         Record<Tool,string> = { move:'grab',     erase:'crosshair', switch:'pointer', polyline:'crosshair', fill:'cell',      pen:'crosshair' };
const OVERLAY_CURSOR: Record<Tool,string> = { move:'default',  erase:'crosshair', switch:'pointer', polyline:'crosshair', fill:'cell',      pen:'crosshair' };

/* zoom button shared style */
const zbtn: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 10px',
  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  fontSize: 11, fontWeight: 700,
  color: 'var(--foreground)',
  cursor: 'pointer',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  transition: 'background .1s',
};

export default function CanvasArea({
  canvasRef, overlayRef, viewportRef,
  zoom, coordX, coordY, activeTool, hasImage,
  onFitCanvas, onZoom1x, onZoomStep, onZoomTo,
  onViewportMouseDown, onViewportMouseMove, onViewportDrop, onViewportDragOver,
  onOverlayMouseDown, onOverlayMouseMove, onOverlayMouseUp, onOverlayClick, onOverlayContextMenu,
}: CanvasAreaProps) {
  const isEdit = ['erase','switch','fill','pen','polyline'].includes(activeTool);

  /* ── Horizontal zoom strip ── */
  const ZoomStrip = () => (
    <div style={{
      position: 'absolute', top: 8, right: 10, zIndex: 20,
      display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 5,
    }}>
      {/* − */}
      <button onClick={() => onZoomStep(-1)} title="Zoom Out" style={zbtn}>−</button>

      {/* Badge: Nx */}
      <div style={{
        ...zbtn, cursor: 'default', pointerEvents: 'none',
        minWidth: 52, textAlign: 'center',
      }}>
        {zoom}×
      </div>

      {/* + */}
      <button onClick={() => onZoomStep(1)} title="Zoom In" style={zbtn}>+</button>

      {/* 1:1 */}
      <button onClick={onZoom1x} title="1:1 Scale" style={zbtn}>1:1</button>

      {/* FIT */}
      <button onClick={onFitCanvas} title="Fit to View" style={zbtn}>FIT</button>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      background: 'var(--canvas-bg)' }}>

      {/* ── Viewport ── */}
      <div
        ref={viewportRef}
        style={{ flex: 1, overflow: 'auto', position: 'relative', userSelect: 'none', cursor: CURSOR[activeTool] }}
        onMouseDown={onViewportMouseDown}
        onMouseMove={onViewportMouseMove}
        onDrop={onViewportDrop}
        onDragOver={onViewportDragOver}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '100%', minHeight: '100%', padding: 20 }}>
          <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
            <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block' }} />
            <canvas
              ref={overlayRef}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                imageRendering: 'pixelated',
                pointerEvents: isEdit ? 'auto' : 'none',
                cursor: OVERLAY_CURSOR[activeTool],
              }}
              onMouseDown={onOverlayMouseDown}
              onMouseMove={onOverlayMouseMove}
              onMouseUp={onOverlayMouseUp}
              onClick={onOverlayClick}
              onContextMenu={onOverlayContextMenu}
            />
          </div>

          {/* Empty hint */}
          <div style={{
            display: hasImage ? 'none' : 'flex', position: 'absolute', inset: 0,
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 48, opacity: 0.25, color: 'inherit', lineHeight: 1 }}>◈</div>
            <div style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace", fontSize: 12, color: 'var(--text-tertiary)' }}>
              Upload an image to begin
            </div>
          </div>
        </div>
      </div>

      {/* ── Zoom strip (top-right) ── */}
      <ZoomStrip />

      {/* ── Coordinate bar (bottom-right) ── */}
      <div style={{
        position: 'absolute', bottom: 10, right: 12, zIndex: 10,
        padding: '3px 8px',
        background: 'var(--overlay-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: 3,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontSize: 10, fontWeight: 500,
        color: 'var(--foreground)', pointerEvents: 'none',
      }}>
        {coordX} , {coordY} &nbsp;·&nbsp; {zoom}×
      </div>
    </div>
  );
}
