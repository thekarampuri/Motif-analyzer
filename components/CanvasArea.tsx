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

const MAX_SCALE = 32;

export default function CanvasArea({
  canvasRef, overlayRef, viewportRef,
  zoom, coordX, coordY, activeTool, hasImage,
  onFitCanvas, onZoom1x, onZoomStep, onZoomTo,
  onViewportMouseDown, onViewportMouseMove, onViewportDrop, onViewportDragOver,
  onOverlayMouseDown, onOverlayMouseMove, onOverlayMouseUp, onOverlayClick, onOverlayContextMenu,
}: CanvasAreaProps) {
  const isEdit = ['erase','switch','fill','pen','polyline'].includes(activeTool);

  /* ── zoom rail (right side) ─────────────────────────── */
  const ZoomRail = () => (
    <div style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      zIndex: 20, background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 7px', boxShadow: '0 2px 12px rgba(0,0,0,.18)',
    }}>
      {/* Zoom-in button */}
      <button
        onClick={() => onZoomStep(1)}
        title="Zoom In"
        style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 5,
          background: 'var(--input-bg)', color: 'var(--gold)', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, lineHeight: 1, display:'flex', alignItems:'center', justifyContent:'center' }}
      >+</button>

      {/* Vertical slider */}
      <input
        type="range" className="zoom-slider"
        min={1} max={MAX_SCALE} value={zoom}
        onChange={e => onZoomTo(+e.target.value)}
        title={`Zoom: ${zoom}×`}
      />

      {/* Zoom-out button */}
      <button
        onClick={() => onZoomStep(-1)}
        title="Zoom Out"
        style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 5,
          background: 'var(--input-bg)', color: 'var(--gold)', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, lineHeight: 1, display:'flex', alignItems:'center', justifyContent:'center' }}
      >−</button>

      {/* Divider */}
      <div style={{ width: 18, height: 1, background: 'var(--border)' }} />

      {/* FIT */}
      <button onClick={onFitCanvas} title="Fit to View"
        style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 5,
          background: 'var(--input-bg)', color: 'var(--text-secondary)', cursor: 'pointer',
          fontSize: 7, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, letterSpacing: '0.04em' }}
      >FIT</button>

      {/* 1:1 */}
      <button onClick={onZoom1x} title="1:1 Scale"
        style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 5,
          background: 'var(--input-bg)', color: 'var(--text-secondary)', cursor: 'pointer',
          fontSize: 7, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, letterSpacing: '0.04em' }}
      >1:1</button>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      background: 'var(--background)' }}>

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
            gap: 14, pointerEvents: 'none',
          }}>
            {/* Decorative woven grid */}
            <div style={{
              width: 80, height: 80, opacity: 0.12,
              backgroundImage: 'repeating-linear-gradient(0deg,var(--gold),var(--gold) 2px,transparent 2px,transparent 10px),repeating-linear-gradient(90deg,var(--gold),var(--gold) 2px,transparent 2px,transparent 10px)',
              borderRadius: 4,
            }} />
            <div style={{ fontSize: 32, color: 'var(--gold)', opacity: 0.3, lineHeight: 1 }}>◈</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
              Upload Image to Begin
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Drop an image here or use the panel
            </div>
          </div>
        </div>
      </div>

      {/* ── Zoom rail (right side) ── */}
      <ZoomRail />

      {/* ── Coordinate bar (bottom-left) ── */}
      <div style={{
        position: 'absolute', bottom: 10, left: 12, zIndex: 10,
        padding: '4px 10px', background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 6, fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
        color: 'var(--text-tertiary)', pointerEvents: 'none', letterSpacing: '0.05em',
      }}>
        {coordX} , {coordY} &nbsp;·&nbsp; {zoom}×
      </div>
    </div>
  );
}
