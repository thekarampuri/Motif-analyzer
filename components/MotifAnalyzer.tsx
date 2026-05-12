'use client';
import { useEffect, useState } from 'react';
import { useMotifEngine } from '@/hooks/useMotifEngine';
import Header from './Header';
import LeftPanel from './LeftPanel';
import CanvasArea from './CanvasArea';
import type { BitmapItem } from '@/lib/types';

export default function MotifAnalyzer() {
  const engine = useMotifEngine();
  const [motifBitmaps, setMotifBitmaps] = useState<BitmapItem[]>([]);
  const [fillBitmaps,  setFillBitmaps]  = useState<BitmapItem[]>([]);
  const [motifBitmapIdx, setMotifBitmapIdx] = useState(-1);
  const [fillBitmapIdx,  setFillBitmapIdx]  = useState(-1);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.requestBitmaps();
    const cleanup = window.electronAPI.onBitmapsUpdated(({ motif, fill }) => {
      setMotifBitmaps(motif);
      setFillBitmaps(fill);
      setMotifBitmapIdx(prev => (prev >= motif.length ? (motif.length > 0 ? 0 : -1) : prev));
      setFillBitmapIdx (prev => (prev >= fill.length  ? (fill.length  > 0 ? 0 : -1) : prev));
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const item = motifBitmaps[motifBitmapIdx];
    engine.setMotifBitmap(item ? item.dataUrl : null);
  }, [motifBitmapIdx, motifBitmaps]);

  useEffect(() => {
    const item = fillBitmaps[fillBitmapIdx];
    engine.setFillToolBitmap(item ? item.dataUrl : null);
  }, [fillBitmapIdx, fillBitmaps]);

  function handleExport(fmt: 'bmp' | 'png' | 'tiff') {
    if (fmt === 'bmp')  engine.exportBMP('motif_export');
    if (fmt === 'png')  engine.exportPNG('motif_export');
    if (fmt === 'tiff') engine.exportTIFF('motif_export');
  }

  return (
    <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden',
      background:'var(--background)', color:'var(--foreground)' }}>
      <Header
        statusMessage={engine.status}
        statusType={engine.statusType}
        phaseStatus={engine.phaseStatus}
        onUndo={engine.undo}
        onRedo={engine.redo}
        onExport={handleExport}
        onClearFill={engine.clearFill}
        onReset={engine.resetAll}
        onSaveProject={engine.saveProject}
        onLoadProject={engine.loadProject}
        canUndo={engine.canUndo}
        canRedo={engine.canRedo}
      />
      <div style={{ display:'flex', flex:1, overflow:'hidden', marginTop:46 }}>
        <LeftPanel
          motifBitmaps={motifBitmaps}
          fillBitmaps={fillBitmaps}
          motifBitmapIdx={motifBitmapIdx}
          fillBitmapIdx={fillBitmapIdx}
          onMotifBitmapSelect={setMotifBitmapIdx}
          onFillBitmapSelect={setFillBitmapIdx}
          onImageUpload={engine.handleImageFile}
          fillMode={engine.fillMode}
          onFillModeChange={engine.handleFillModeChange}
          vBorderLen={engine.vBorderLen}
          onVBorderLenChange={engine.handleVBorderLenChange}
          use8={engine.use8}
          onUse8Change={engine.handleUse8Change}
          bndSkip={engine.bndSkip}
          onBndSkipChange={engine.setBndSkip}
          bndSkipPx={engine.bndSkipPx}
          onBndSkipPxChange={engine.setBndSkipPx}
          vertFloat={engine.vertFloat}
          onVertFloatChange={engine.handleVertFloatChange}
          vertFloatLen={engine.vertFloatLen}
          onVertFloatLenChange={engine.handleVertFloatLenChange}
          highlightActive={engine.highlightActive}
          onHighlightChange={engine.handleHighlightChange}
          highlightLen={engine.highlightLen}
          onHighlightLenChange={engine.handleHighlightLenChange}
          highlightColor={engine.highlightColor}
          onHighlightColorChange={engine.setHighlightColor}
          activeTool={engine.activeTool}
          onToolChange={engine.setActiveTool}
          penColorHex={engine.penColorHex}
          onPenColorChange={engine.updatePenColor}
          floatCountText={engine.floatCountText}
        />
        <CanvasArea
          canvasRef={engine.canvasRef}
          overlayRef={engine.overlayRef}
          viewportRef={engine.viewportRef}
          zoom={engine.zoom}
          coordX={engine.coordX}
          coordY={engine.coordY}
          activeTool={engine.activeTool}
          hasImage={engine.hasImage}
          onFitCanvas={engine.fitCanvas}
          onZoom1x={engine.zoom1x}
          onZoomStep={engine.zoomStep}
          onZoomTo={engine.zoomTo}
          onViewportMouseDown={engine.onViewportMouseDown}
          onViewportMouseMove={engine.onViewportMouseMove}
          onViewportDrop={engine.onViewportDrop}
          onViewportDragOver={engine.onViewportDragOver}
          onOverlayMouseDown={engine.onOverlayMouseDown}
          onOverlayMouseMove={engine.onOverlayMouseMove}
          onOverlayMouseUp={engine.onOverlayMouseUp}
          onOverlayClick={engine.onOverlayClick}
          onOverlayContextMenu={engine.onOverlayContextMenu}
        />
      </div>
    </div>
  );
}
