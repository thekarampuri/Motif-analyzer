'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  Tool, FillMode, Side, StatusType, FillCache,
  MotifResult, ManualFillRegion, BakedFloatRegion, EngineSnapshot,
  BitmapItem, BakedPixel, PixelXY,
} from '@/lib/types';
import {
  buildCleanBW, binarise, findComponents, getBorder, skeletonize,
  buildFillCache, buildFillCacheFlipped, buildMotifResult, getInside,
  getPhase1Pixels, computeFloatPixelSet, computeFloatData,
  computeHighlightPixels, canvasToBMP, canvasToTIFF, bresenhamLine, pointInPolygon,
} from '@/lib/motifEngine';
import type { ProjectFile } from '@/lib/types';

const MAX_HISTORY = 100;
const MAX_SCALE   = 32;

// ── Mutable engine state (no re-renders) ──
interface EngineState {
  originalImage: ImageData | null;
  processedImage: ImageData | null;
  motifOnlyImage: ImageData | null;
  motifResults: MotifResult[];
  erasedSet: Set<string>;
  allMotifPixelSet: Set<string>;
  manualFillRegions: ManualFillRegion[];
  bakedFloatRegions: BakedFloatRegion[];
  penEdits: Map<string, { r: number; g: number; b: number }>;
  undoStack: EngineSnapshot[];
  redoStack: EngineSnapshot[];
  leftFillCache: FillCache | null;
  rightFillCache: FillCache | null;
  fillToolCache: FillCache | null;
  fillToolCacheFlipped: FillCache | null;
  highlightPixelSet: Set<string>;
  highlightActive: boolean;
  scale: number;
  polyPoints: PixelXY[];
  polyMousePt: PixelXY | null;
  lassoDrawing: boolean;
  panDragging: boolean;
  panLastX: number;
  panLastY: number;
  wasDragging: boolean;
  overlayDragStart: { x: number; y: number } | null;
  penButton: number;
  spaceToolPrev: Tool | null;
  cursorCanvasX: number;
  cursorCanvasY: number;
  penColor: { r: number; g: number; b: number };
}

function createInitialState(): EngineState {
  return {
    originalImage: null, processedImage: null, motifOnlyImage: null,
    motifResults: [], erasedSet: new Set(), allMotifPixelSet: new Set(),
    manualFillRegions: [], bakedFloatRegions: [], penEdits: new Map(),
    undoStack: [], redoStack: [],
    leftFillCache: null, rightFillCache: null, fillToolCache: null, fillToolCacheFlipped: null,
    highlightPixelSet: new Set(), highlightActive: false,
    scale: 1,
    polyPoints: [], polyMousePt: null, lassoDrawing: false,
    panDragging: false, panLastX: 0, panLastY: 0, wasDragging: false,
    overlayDragStart: null, penButton: 0, spaceToolPrev: null,
    cursorCanvasX: -1, cursorCanvasY: -1,
    penColor: { r: 255, g: 255, b: 255 },
  };
}

export function useMotifEngine() {
  const eng = useRef<EngineState>(createInitialState());
  const pendingRestoreRef = useRef<ProjectFile | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // ── UI state (triggers re-render) ──
  const [status,       setStatus]      = useState('No image loaded');
  const [statusType,   setStatusType]  = useState<StatusType>('');
  const [zoom,         setZoom]        = useState(1);         // integer scale 1..32
  const [activeTool,   setActiveToolSt] = useState<Tool>('move');
  const [canUndo,      setCanUndo]     = useState(false);
  const [canRedo,      setCanRedo]     = useState(false);
  const [coordX,       setCoordX]      = useState(0);
  const [coordY,       setCoordY]      = useState(0);
  const [fillMode,     setFillMode]    = useState<FillMode>('INNER');
  const [vBorderLen,   setVBorderLen]  = useState(8);
  const [use8,         setUse8]        = useState(true);
  const [bndSkip,      setBndSkip]     = useState(false);
  const [bndSkipPx,    setBndSkipPx]   = useState(1);
  const [vertFloat,    setVertFloat]   = useState(false);
  const [vertFloatLen, setVertFloatLen] = useState(8);
  const [highlightLen, setHighlightLen] = useState(8);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightColor,  setHighlightColor]  = useState('#ff003c');
  const [penColorHex, setPenColorHex] = useState('#ffffff');
  const [floatCountText, setFloatCountText] = useState('');
  const [phaseStatus,    setPhaseStatus]    = useState('Upload image to begin');
  const [hasImage,       setHasImage]       = useState(false);

  // Keep refs for values used inside event handlers (avoid stale closures)
  const uploadDirRef    = useRef('');
  const fillModeRef     = useRef(fillMode);
  const vBorderLenRef   = useRef(vBorderLen);
  const use8Ref         = useRef(use8);
  const bndSkipRef      = useRef(bndSkip);
  const bndSkipPxRef    = useRef(bndSkipPx);
  const vertFloatRef    = useRef(vertFloat);
  const vertFloatLenRef = useRef(vertFloatLen);
  const highlightLenRef = useRef(highlightLen);
  const highlightColorRef = useRef(highlightColor);
  const activeToolRef   = useRef<Tool>('move');

  useEffect(() => { fillModeRef.current = fillMode; }, [fillMode]);
  useEffect(() => { vBorderLenRef.current = vBorderLen; }, [vBorderLen]);
  useEffect(() => { use8Ref.current = use8; }, [use8]);
  useEffect(() => { bndSkipRef.current = bndSkip; }, [bndSkip]);
  useEffect(() => { bndSkipPxRef.current = bndSkipPx; }, [bndSkipPx]);
  useEffect(() => { vertFloatRef.current = vertFloat; }, [vertFloat]);
  useEffect(() => { vertFloatLenRef.current = vertFloatLen; }, [vertFloatLen]);
  useEffect(() => { highlightLenRef.current = highlightLen; }, [highlightLen]);
  useEffect(() => { highlightColorRef.current = highlightColor; }, [highlightColor]);

  // ── Helpers ──
  const st = (msg: string, type: StatusType = 'ok') => { setStatus(msg); setStatusType(type); };

  const ctx  = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  const octx = () => overlayRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

  function syncOverlay() {
    const c = canvasRef.current, o = overlayRef.current;
    if (!c || !o) return;
    o.width = c.width; o.height = c.height;
  }

  function clearOverlay() {
    const oc = octx();
    if (!oc || !overlayRef.current) return;
    oc.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (eng.current.highlightActive && eng.current.highlightPixelSet.size) drawHighlightOverlay();
  }

  function drawHighlightOverlay() {
    const e = eng.current;
    if (!overlayRef.current || !e.highlightPixelSet.size) return;
    const oc = octx(); if (!oc) return;
    const w = overlayRef.current.width, h = overlayRef.current.height;
    const hex = highlightColorRef.current;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const imgData = oc.createImageData(w,h);
    const d = imgData.data;
    for (const key of e.highlightPixelSet) {
      const [x,y] = key.split(',').map(Number);
      if (x<0||x>=w||y<0||y>=h) continue;
      const i=(y*w+x)*4; d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=255;
    }
    oc.putImageData(imgData,0,0);
  }

  function applyScale(s?: number) {
    const e = eng.current;
    const sc = s ?? e.scale;
    const c = canvasRef.current, o = overlayRef.current;
    if (!c) return;
    c.style.width  = (c.width  * sc) + 'px';
    c.style.height = (c.height * sc) + 'px';
    if (o) { o.style.width = c.style.width; o.style.height = c.style.height; }
    setZoom(sc);
  }

  function updateUndoButtons() {
    setCanUndo(eng.current.undoStack.length > 0);
    setCanRedo(eng.current.redoStack.length > 0);
  }

  // ── Undo/Redo ──
  function cloneState(): EngineSnapshot {
    const e = eng.current;
    return {
      processedImage: e.processedImage ? new ImageData(new Uint8ClampedArray(e.processedImage.data), e.processedImage.width, e.processedImage.height) : null,
      motifOnlyImage: e.motifOnlyImage ? new ImageData(new Uint8ClampedArray(e.motifOnlyImage.data), e.motifOnlyImage.width, e.motifOnlyImage.height) : null,
      erasedSet: new Set(e.erasedSet),
      manualFillRegions: e.manualFillRegions.map(r => ({
        pixelSet: new Set(r.pixelSet), pixels: r.pixels.slice(), pixelsFlipped: r.pixelsFlipped.slice(), side: r.side
      })),
      bakedFloatRegions: e.bakedFloatRegions.map(r => ({
        motifIdx: e.motifResults.indexOf(r.motif),
        pixelSet: new Set(r.pixelSet), pixels: r.pixels.slice(), pixelsFlipped: r.pixelsFlipped.slice(),
        isFillTool: r.isFillTool, side: r.side
      })),
      motifSides: e.motifResults.map(m => m.side),
      penEdits: new Map(e.penEdits),
    };
  }

  function restoreState(snap: EngineSnapshot) {
    const e = eng.current;
    e.processedImage    = snap.processedImage;
    e.motifOnlyImage    = snap.motifOnlyImage;
    e.erasedSet         = snap.erasedSet;
    e.manualFillRegions = snap.manualFillRegions;
    e.bakedFloatRegions = snap.bakedFloatRegions.map(r => ({
      ...r,
      motif: e.motifResults[r.motifIdx] ?? e.motifResults[0],
    }));
    snap.motifSides.forEach((s,i) => { if (e.motifResults[i]) e.motifResults[i].side = s; });
    e.penEdits = snap.penEdits ?? new Map();
  }

  function pushUndo() {
    const e = eng.current;
    e.undoStack.push(cloneState());
    if (e.undoStack.length > MAX_HISTORY) e.undoStack.shift();
    e.redoStack = [];
    updateUndoButtons();
  }

  const undo = useCallback(() => {
    const e = eng.current;
    if (!e.undoStack.length) return;
    e.redoStack.push(cloneState());
    restoreState(e.undoStack.pop()!);
    redraw();
    updateUndoButtons();
    st('Undo', '');
  }, []);

  const redo = useCallback(() => {
    const e = eng.current;
    if (!e.redoStack.length) return;
    e.undoStack.push(cloneState());
    restoreState(e.redoStack.pop()!);
    redraw();
    updateUndoButtons();
    st('Redo', '');
  }, []);

  // ── Paint manual fills ──
  function paintManualFills(outData: Uint8ClampedArray, w: number) {
    for (const region of eng.current.manualFillRegions) {
      const pixels = (region.side === 'RIGHT' && region.pixelsFlipped)
        ? region.pixelsFlipped : region.pixels;
      for (const fp of pixels) {
        const di = (fp.y*w + fp.x)*4;
        outData[di]=fp.r; outData[di+1]=fp.g; outData[di+2]=fp.b; outData[di+3]=255;
      }
    }
  }

  // ── Phase 1 ──
  function applyPhase1() {
    const e = eng.current; if (!e.originalImage) return;
    const c = ctx(); if (!c) return;
    const mode = fillModeRef.current;
    const w = canvasRef.current!.width, h = canvasRef.current!.height;
    const outData = new Uint8ClampedArray(e.originalImage.data);
    const vLen = Math.max(1, vBorderLenRef.current);

    let floatPixelSet: Set<string> | null = null;
    if (mode === 'INNER_BORDER8' && vertFloatRef.current) {
      const minLen = Math.max(1, vertFloatLenRef.current);
      floatPixelSet = computeFloatPixelSet(w, minLen, outData, e.motifResults, e.erasedSet);
    }

    const manualPixelKeySet = new Set<string>();
    for (const region of e.manualFillRegions) {
      for (const fp of region.pixels) manualPixelKeySet.add(fp.x+','+fp.y);
    }

    for (const m of e.motifResults) {
      const cache = m.side === 'LEFT' ? e.leftFillCache : e.rightFillCache;
      if (!cache) continue;
      const { data:fd, w:fw, h:fh } = cache;
      const pixels = getPhase1Pixels(m, mode, vLen, floatPixelSet);
      for (const p of pixels) {
        if (e.erasedSet.has(p.x+','+p.y)) continue;
        if (manualPixelKeySet.has(p.x+','+p.y)) continue;
        const si = ((p.y%fh)*fw+(p.x%fw))*4, di=(p.y*w+p.x)*4;
        outData[di]=fd[si]; outData[di+1]=fd[si+1]; outData[di+2]=fd[si+2]; outData[di+3]=fd[si+3];
      }
    }
    for (const region of e.bakedFloatRegions) {
      const pixels = (region.side === 'RIGHT' && region.pixelsFlipped)
        ? region.pixelsFlipped : region.pixels;
      for (const p of pixels) {
        if (e.erasedSet.has(p.x+','+p.y)) continue;
        const di=(p.y*w+p.x)*4;
        outData[di]=p.r; outData[di+1]=p.g; outData[di+2]=p.b; outData[di+3]=255;
      }
    }
    e.motifOnlyImage = new ImageData(new Uint8ClampedArray(outData), w, h);
    paintManualFills(outData, w);
    e.processedImage = new ImageData(new Uint8ClampedArray(outData), w, h);
  }

  // ── Redraw ──
  function redraw() {
    const e = eng.current; if (!e.originalImage) return;
    const c = ctx(); if (!c) return;
    const canvas = canvasRef.current!;
    const w = canvas.width, h = canvas.height;
    const mode    = fillModeRef.current;
    const vLen    = Math.max(1, vBorderLenRef.current);
    const floatOn = vertFloatRef.current;
    const minLen  = Math.max(1, vertFloatLenRef.current);

    let outData: Uint8ClampedArray;
    if (e.processedImage) {
      outData = new Uint8ClampedArray(e.processedImage.data);
    } else {
      outData = new Uint8ClampedArray(e.originalImage.data);
      let floatPixelSet: Set<string> | null = null;
      if (mode === 'INNER_BORDER8' && floatOn) {
        floatPixelSet = computeFloatPixelSet(w, minLen, outData, e.motifResults, e.erasedSet);
      }
      for (const m of e.motifResults) {
        const cache = m.side === 'LEFT' ? e.leftFillCache : e.rightFillCache;
        if (!cache) continue;
        const { data:fd, w:fw, h:fh } = cache;
        const pixels = getPhase1Pixels(m, mode, vLen, floatPixelSet);
        for (const p of pixels) {
          if (e.erasedSet.has(p.x+','+p.y)) continue;
          const si=((p.y%fh)*fw+(p.x%fw))*4, di=(p.y*w+p.x)*4;
          outData[di]=fd[si]; outData[di+1]=fd[si+1]; outData[di+2]=fd[si+2]; outData[di+3]=fd[si+3];
        }
      }
    }

    let floatData: { m: MotifResult; pixels: PixelXY[] }[] = [];
    let totalFloatPx = 0;

    if (floatOn && e.motifResults.length && mode !== 'INNER_BORDER8') {
      const srcData = e.motifOnlyImage ? e.motifOnlyImage.data : e.originalImage.data;
      const manualPxSideMap = new Map<string, Side>();
      for (const region of e.manualFillRegions) {
        const s = region.side || 'LEFT';
        for (const fp of region.pixels) manualPxSideMap.set(fp.x+','+fp.y, s);
      }
      const ftCacheN = e.fillToolCache || e.leftFillCache || e.rightFillCache;
      const ftCacheF = ftCacheN ? (e.fillToolCacheFlipped || buildFillCacheFlipped(ftCacheN)) : null;

      const bakedFloatKeySet = new Set<string>();
      for (const bfr of e.bakedFloatRegions) for (const k of bfr.pixelSet) bakedFloatKeySet.add(k);

      floatData = computeFloatData(w, minLen, srcData, e.motifResults, e.erasedSet);
      for (const { m, pixels } of floatData) {
        const motifCache = m.side === 'LEFT' ? e.leftFillCache : e.rightFillCache;
        for (const p of pixels) {
          if (e.erasedSet.has(p.x+','+p.y)) continue;
          if (manualPxSideMap.has(p.x+','+p.y)) continue;
          if (bakedFloatKeySet.has(p.x+','+p.y)) continue;
          const neighbors = [p.x+','+(p.y-1), p.x+','+(p.y+1), (p.x-1)+','+p.y, (p.x+1)+','+p.y];
          let adjSide: Side | null = null;
          for (const nk of neighbors) { if (manualPxSideMap.has(nk)) { adjSide = manualPxSideMap.get(nk)!; break; } }
          let cache: FillCache | null;
          if (adjSide !== null) {
            cache = (adjSide === 'RIGHT' && ftCacheF) ? ftCacheF : ftCacheN;
          } else {
            cache = motifCache;
          }
          if (!cache) continue;
          const { data:fd, w:fw, h:fh } = cache;
          const si=((p.y%fh)*fw+(p.x%fw))*4, di=(p.y*w+p.x)*4;
          outData[di]=fd[si]; outData[di+1]=fd[si+1]; outData[di+2]=fd[si+2]; outData[di+3]=fd[si+3];
          totalFloatPx++;
        }
      }
    } else if (floatOn && e.motifResults.length && mode === 'INNER_BORDER8' && !e.processedImage) {
      const floatSet = computeFloatPixelSet(w, minLen, e.originalImage.data, e.motifResults, e.erasedSet);
      totalFloatPx = floatSet.size;
      floatData = [{ m: e.motifResults[0], pixels: [] }];
    }

    paintManualFills(outData, w);

    if (e.penEdits.size) {
      for (const [key, col] of e.penEdits) {
        const [x,y] = key.split(',').map(Number);
        if (x<0||x>=w||y<0||y>=h) continue;
        const di=(y*w+x)*4;
        outData[di]=col.r; outData[di+1]=col.g; outData[di+2]=col.b; outData[di+3]=255;
      }
    }

    c.putImageData(new ImageData(outData, w, h), 0, 0);

    if (e.highlightActive) {
      const hlLen = Math.max(1, highlightLenRef.current);
      e.highlightPixelSet = computeHighlightPixels(outData, w, h, hlLen, e.penEdits);
    }
    clearOverlay();

    if (floatOn && floatData.length) {
      const label = mode === 'INNER_BORDER8' ? 'merged' : 'float';
      setFloatCountText(`${label}  •  ${totalFloatPx} px`);
      setPhaseStatus(`Float preview: ${totalFloatPx} px`);
    } else {
      setFloatCountText('');
      if (e.processedImage) setPhaseStatus('');
    }
  }

  // ── Analysis ──
  function runAnalysis() {
    const e = eng.current;
    if (!e.originalImage) return;
    const canvas = canvasRef.current!;
    const w = canvas.width, h = canvas.height;
    const bin   = binarise(e.originalImage, w, h);
    const comps = findComponents(bin, w, h);
    const skelBin = skeletonize(bin.slice(), w, h);

    e.motifResults = comps.map(comp => {
      const border = getBorder(comp, w, h, bin, use8Ref.current);
      return buildMotifResult(comp, border, skelBin, w, use8Ref.current);
    });

    e.allMotifPixelSet = new Set();
    e.motifResults.forEach(m => m.pixels.forEach(p => e.allMotifPixelSet.add(p.x+','+p.y)));

    e.erasedSet.clear();
    e.manualFillRegions = [];
    e.bakedFloatRegions = [];
    e.processedImage = null;
    e.motifOnlyImage = null;

    const c = ctx();
    if (c && e.originalImage) c.putImageData(e.originalImage, 0, 0);
    clearOverlay();
    setFloatCountText('');
    setPhaseStatus('⬤ Ready');
    st(`${w}×${h} px  |  ${e.motifResults.length} motif(s) detected`, 'ok');
    syncOverlay();

    setTimeout(() => {
      applyPhase1(); redraw(); setPhaseStatus('⬤ Ready');
      if (pendingRestoreRef.current) {
        _applyProjectRestore(pendingRestoreRef.current);
        pendingRestoreRef.current = null;
      }
    }, 0);
  }

  // ── Load image ──
  const handleImageFile = useCallback((file: File) => {
    const fullPath: string = (file as any).path || '';
    if (fullPath) {
      const sep = fullPath.includes('\\') ? '\\' : '/';
      uploadDirRef.current = fullPath.substring(0, fullPath.lastIndexOf(sep));
    }
    st('Loading image…', 'busy');
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width; canvas.height = img.height;
      const c = canvas.getContext('2d', { willReadFrequently: true })!;
      c.drawImage(img, 0, 0);
      const rawData = c.getImageData(0, 0, img.width, img.height);
      const e = eng.current;
      e.originalImage = buildCleanBW(rawData, img.width, img.height);
      c.putImageData(e.originalImage, 0, 0);
      e.undoStack = []; e.redoStack = []; updateUndoButtons();
      setHasImage(true);
      st(`${img.width}×${img.height} px — analysing…`, 'busy');
      setPhaseStatus('⬤ Processing…');
      fitCanvas();
      syncOverlay();
      setTimeout(runAnalysis, 40);
    };
    img.onerror = () => st('Error loading image', 'error');
    img.src = URL.createObjectURL(file);
  }, []);

  // ── Fit canvas ──
  function fitCanvas() {
    const canvas = canvasRef.current, vp = viewportRef.current;
    if (!canvas || !vp || !canvas.width || !canvas.height) return;
    const sx = Math.floor((vp.clientWidth-32)/canvas.width);
    const sy = Math.floor((vp.clientHeight-32)/canvas.height);
    const s  = Math.max(1, Math.min(sx, sy, MAX_SCALE));
    eng.current.scale = s;
    applyScale(s);
    requestAnimationFrame(() => {
      vp.scrollLeft = Math.max(0, (vp.scrollWidth-vp.clientWidth)/2);
      vp.scrollTop  = Math.max(0, (vp.scrollHeight-vp.clientHeight)/2);
    });
  }

  // ── Bitmap handling ──
  const setMotifBitmap = useCallback(async (dataUrl: string | null) => {
    const e = eng.current;
    if (!dataUrl) {
      e.leftFillCache = null; e.rightFillCache = null;
    } else {
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      e.leftFillCache  = buildFillCache(img);
      e.rightFillCache = buildFillCacheFlipped(e.leftFillCache);
    }
    applyPhase1(); redraw();
  }, []);

  const setFillToolBitmap = useCallback(async (dataUrl: string | null) => {
    const e = eng.current;
    if (!dataUrl) {
      e.fillToolCache = null; e.fillToolCacheFlipped = null;
    } else {
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      const cache = buildFillCache(img);
      e.fillToolCache        = cache;
      e.fillToolCacheFlipped = buildFillCacheFlipped(cache);
    }
    applyPhase1(); redraw();
  }, []);

  // ── Tools ──
  function evToCanvas(e: MouseEvent | React.MouseEvent): PixelXY {
    const cr = canvasRef.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX-cr.left)/eng.current.scale), y: Math.floor((e.clientY-cr.top)/eng.current.scale) };
  }

  const setActiveTool = useCallback((t: Tool) => {
    const e = eng.current;
    e.polyPoints = []; e.polyMousePt = null;
    activeToolRef.current = t;
    setActiveToolSt(t);
    clearOverlay();
    if (t !== 'polyline') redraw();
  }, []);

  // ── Erase ──
  function eraseMotifAt(cx: number, cy: number, restore: boolean) {
    const e = eng.current;
    const clickKey = cx+','+cy;
    let found = false;

    for (const m of e.motifResults) {
      if (m.borderSet.has(clickKey) || m.pixelSet.has(clickKey)) {
        pushUndo();
        if (restore) {
          for (const p of m.pixels) e.erasedSet.delete(p.x+','+p.y);
        } else {
          for (const p of m.pixels) e.erasedSet.add(p.x+','+p.y);
          e.manualFillRegions = e.manualFillRegions.filter(r => {
            for (const key of m.pixelSet) if (r.pixelSet.has(key)) return false; return true;
          });
          e.bakedFloatRegions = e.bakedFloatRegions.filter(r => {
            for (const key of m.pixelSet) if (r.pixelSet.has(key)) return false; return true;
          });
        }
        found = true; break;
      }
    }

    if (!found) {
      for (let i = e.manualFillRegions.length-1; i >= 0; i--) {
        const region = e.manualFillRegions[i];
        if (!region.pixelSet.has(clickKey)) continue;
        pushUndo();
        if (!restore) {
          e.manualFillRegions.splice(i, 1);
          e.bakedFloatRegions = e.bakedFloatRegions.filter(bfr => {
            if (!bfr.isFillTool) return true;
            const [smallSet, bigSet] = bfr.motif.pixelSet.size < region.pixelSet.size
              ? [bfr.motif.pixelSet, region.pixelSet] : [region.pixelSet, bfr.motif.pixelSet];
            for (const key of smallSet) if (bigSet.has(key)) { for (const k of bfr.pixelSet) e.erasedSet.add(k); return false; }
            return true;
          });
        }
        found = true; break;
      }
    }

    if (!found) {
      for (let i = e.bakedFloatRegions.length-1; i >= 0; i--) {
        const region = e.bakedFloatRegions[i];
        if (!region.pixelSet.has(clickKey)) continue;
        pushUndo();
        if (restore) {
          for (const key of region.pixelSet) { const [x,y]=key.split(',').map(Number); e.erasedSet.delete(x+','+y); }
        } else {
          for (const key of region.pixelSet) { const [x,y]=key.split(',').map(Number); e.erasedSet.add(x+','+y); }
        }
        found = true; break;
      }
    }

    if (!found) return;
    if (e.processedImage) applyPhase1();
    redraw();
  }

  // ── Switch ──
  function switchMotifAt(cx: number, cy: number) {
    const e = eng.current;
    const clickKey = cx+','+cy;

    for (let i = e.manualFillRegions.length-1; i >= 0; i--) {
      const region = e.manualFillRegions[i];
      if (!region.pixelSet.has(clickKey)) continue;
      pushUndo();
      const newSide: Side = region.side === 'RIGHT' ? 'LEFT' : 'RIGHT';
      region.side = newSide;
      for (const bfr of e.bakedFloatRegions) {
        if (!bfr.isFillTool) continue;
        const [s,b] = bfr.motif.pixelSet.size < region.pixelSet.size
          ? [bfr.motif.pixelSet, region.pixelSet] : [region.pixelSet, bfr.motif.pixelSet];
        let linked = false; for (const key of s) if (b.has(key)) { linked=true; break; }
        if (linked) bfr.side = newSide;
      }
      if (e.processedImage) applyPhase1(); redraw(); return;
    }

    for (const m of e.motifResults) {
      if (m.borderSet.has(clickKey) || m.pixelSet.has(clickKey)) {
        pushUndo();
        m.side = m.side === 'LEFT' ? 'RIGHT' : 'LEFT';
        for (const bfr of e.bakedFloatRegions) {
          if (!bfr.isFillTool && bfr.motif === m) bfr.side = m.side;
        }
        applyPhase1(); redraw(); return;
      }
    }

    for (const region of e.bakedFloatRegions) {
      if (!region.pixelSet.has(clickKey)) continue;
      pushUndo();
      if (region.isFillTool) {
        const newSide: Side = region.side === 'RIGHT' ? 'LEFT' : 'RIGHT';
        region.side = newSide;
        for (const mfr of e.manualFillRegions) {
          const [s,b] = region.motif.pixelSet.size < mfr.pixelSet.size
            ? [region.motif.pixelSet, mfr.pixelSet] : [mfr.pixelSet, region.motif.pixelSet];
          let linked=false; for (const k of s) if (b.has(k)) { linked=true; break; }
          if (linked) mfr.side = newSide;
        }
        for (const bfr of e.bakedFloatRegions) {
          if (bfr !== region && bfr.isFillTool && bfr.motif === region.motif) bfr.side = newSide;
        }
      } else {
        const m = region.motif;
        m.side = m.side === 'LEFT' ? 'RIGHT' : 'LEFT';
        for (const bfr of e.bakedFloatRegions) {
          if (!bfr.isFillTool && bfr.motif === m) bfr.side = m.side;
        }
      }
      if (e.processedImage) applyPhase1(); redraw(); return;
    }
  }

  // ── Flood Fill ──
  function floodFillAt(cx: number, cy: number) {
    const e = eng.current;
    const cache = e.fillToolCache || e.leftFillCache || e.rightFillCache;
    if (!cache) { st('Select a bitmap first', 'error'); return; }
    const canvas = canvasRef.current!;
    const { data:fd, w:fw, h:fh } = cache;
    const w = canvas.width, h = canvas.height;
    const use8val = use8Ref.current;
    const DIRS4 = [[1,0],[-1,0],[0,1],[0,-1]] as const;
    const DIRS8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
    const DIRS  = use8val ? DIRS8 : DIRS4;

    const clickKey = cx+','+cy;
    let filled: PixelXY[] = [];
    let _autoEraseMotif: typeof e.motifResults[0] | null = null;
    for (const m of e.motifResults) {
      if (m.pixelSet.has(clickKey)) {
        filled = m.pixels.slice();
        _autoEraseMotif = m;
        break;
      }
    }

    if (_autoEraseMotif) {
      for (const p of _autoEraseMotif.pixels) e.erasedSet.add(p.x+','+p.y);
      e.bakedFloatRegions = e.bakedFloatRegions.filter(region => {
        for (const key of _autoEraseMotif!.pixelSet) {
          if (region.pixelSet.has(key)) return false;
        }
        return true;
      });
      applyPhase1();
    }

    if (!filled.length) {
      const floodBase = e.originalImage!.data;
      const ti = (cy*w+cx)*4;
      const tr=floodBase[ti], tg=floodBase[ti+1], tb=floodBase[ti+2];
      const visited = new Uint8Array(w*h);
      const queue = [cy*w+cx];
      visited[cy*w+cx] = 1;
      while (queue.length) {
        const p = queue.shift()!;
        const x = p%w, y = Math.floor(p/w);
        filled.push({ x, y });
        for (const [dx,dy] of DIRS) {
          const nx=x+dx, ny=y+dy;
          if (nx<0||nx>=w||ny<0||ny>=h) continue;
          const ni = ny*w+nx;
          if (visited[ni]) continue; visited[ni]=1;
          const ii=ni*4;
          if (Math.abs(floodBase[ii]-tr)<=30 && Math.abs(floodBase[ii+1]-tg)<=30 && Math.abs(floodBase[ii+2]-tb)<=30)
            queue.push(ni);
        }
      }
    }

    if (!filled.length) { st('Nothing to fill', 'error'); return; }

    const mode  = fillModeRef.current;
    const vLen  = Math.max(1, vBorderLenRef.current);
    const floodSet = new Set(filled.map(p => p.x+','+p.y));

    function isBorder(x: number, y: number): boolean {
      if (use8val) { for (const [dx,dy] of DIRS8) if (!floodSet.has((x+dx)+','+(y+dy))) return true; return false; }
      return !floodSet.has((x-1)+','+y)||!floodSet.has((x+1)+','+y)||!floodSet.has(x+','+(y-1))||!floodSet.has(x+','+(y+1));
    }

    let paintPixels: PixelXY[];
    if (mode === 'WHOLE') {
      paintPixels = filled.slice();
    } else if (mode === 'INNER') {
      paintPixels = filled.filter(({x,y}) => !isBorder(x,y));
    } else if (mode === 'BORDER') {
      paintPixels = filled.filter(({x,y}) => isBorder(x,y));
    } else {
      const borderPx = filled.filter(({x,y}) => isBorder(x,y));
      const byCol: Record<number,number[]> = {};
      for (const {x,y} of borderPx) { if (!byCol[x]) byCol[x]=[]; byCol[x].push(y); }
      const vertKeep: PixelXY[] = [];
      for (const xStr of Object.keys(byCol)) {
        const x=+xStr, ys=byCol[x].sort((a,b)=>a-b);
        let i=0;
        while (i<ys.length) {
          const run=[ys[i]];
          while (i+1<ys.length&&ys[i+1]===ys[i]+1){i++;run.push(ys[i]);}
          if (run.length>=vLen) for (const y of run) vertKeep.push({x,y});
          i++;
        }
      }
      paintPixels = mode==='INNER_BORDER8'
        ? filled.filter(({x,y})=>!isBorder(x,y)).concat(vertKeep)
        : vertKeep;
    }

    const doBnd = bndSkipRef.current, bndPxVal = Math.max(0, bndSkipPxRef.current);
    if (doBnd && bndPxVal > 0 && paintPixels.length) {
      let currentSet = new Set(paintPixels.map(p=>p.x+','+p.y));
      for (let iter=0; iter<bndPxVal; iter++) {
        const toRemove = new Set<string>();
        for (const key of currentSet) {
          const [x,y] = key.split(',').map(Number);
          let onEdge=false;
          for (const [dx,dy] of DIRS) { if (!currentSet.has((x+dx)+','+(y+dy))) { onEdge=true; break; } }
          if (onEdge) toRemove.add(key);
        }
        if (toRemove.size===currentSet.size) break;
        for (const k of toRemove) currentSet.delete(k);
      }
      paintPixels = paintPixels.filter(p => currentSet.has(p.x+','+p.y));
    }

    if (!paintPixels.length) { st('No pixels after boundary skip', 'error'); return; }

    pushUndo();
    e.manualFillRegions = e.manualFillRegions.filter(r => {
      for (const key of r.pixelSet) if (floodSet.has(key)) return false; return true;
    });

    for (const bfr of e.bakedFloatRegions) {
      if (!bfr.isFillTool) continue;
      let linked=false;
      for (const key of bfr.pixelSet) {
        if (floodSet.has(key)) { linked=true; break; }
        const [x,y]=key.split(',').map(Number);
        if (floodSet.has((x-1)+','+y)||floodSet.has((x+1)+','+y)||floodSet.has(x+','+(y-1))||floodSet.has(x+','+(y+1))) { linked=true; break; }
      }
      if (linked) for (const key of bfr.pixelSet) e.erasedSet.delete(key);
    }
    for (const key of floodSet) e.erasedSet.delete(key);

    const newPixels: BakedPixel[] = paintPixels.map(({x,y}) => {
      const si=((y%fh)*fw+(x%fw))*4;
      return { x,y, r:fd[si], g:fd[si+1], b:fd[si+2] };
    });
    const flipCache = e.fillToolCacheFlipped || buildFillCacheFlipped(cache)!;
    const { data:fdf, w:fwf, h:fhf } = flipCache;
    const newPixelsFlipped: BakedPixel[] = paintPixels.map(({x,y}) => {
      const si=((y%fhf)*fwf+(x%fwf))*4;
      return { x,y, r:fdf[si], g:fdf[si+1], b:fdf[si+2] };
    });
    e.manualFillRegions.push({ pixelSet: floodSet, pixels: newPixels, pixelsFlipped: newPixelsFlipped, side: 'LEFT' });

    // Step 7: if Float Fill is on, immediately bake float pixels for the clicked motif
    if (vertFloatRef.current && e.motifOnlyImage && mode !== 'INNER_BORDER8') {
      const minLenFF = Math.max(1, vertFloatLenRef.current);
      const wFF = canvas.width;
      const manualPxSideMapFF = new Map<string, Side>();
      for (const region of e.manualFillRegions) {
        const s = region.side || 'LEFT';
        for (const fp of region.pixels) manualPxSideMapFF.set(fp.x+','+fp.y, s);
      }
      e.bakedFloatRegions = e.bakedFloatRegions.filter(bfr => {
        if (!bfr.isFillTool) return true;
        for (const k of bfr.pixelSet) { if (floodSet.has(k)) return false; }
        return true;
      });
      const floatDataFF = computeFloatData(wFF, minLenFF, e.motifOnlyImage.data, e.motifResults, e.erasedSet);
      const ftCacheN = cache;
      const ftCacheF = e.fillToolCacheFlipped || buildFillCacheFlipped(ftCacheN)!;
      for (const { m, pixels } of floatDataFF) {
        if (!m.pixelSet.has(clickKey)) continue;
        const ftPixelSet = new Set<string>(), ftPixels: PixelXY[] = [];
        for (const p of pixels) {
          if (e.erasedSet.has(p.x+','+p.y)) continue;
          const neighbors = [p.x+','+(p.y-1), p.x+','+(p.y+1), (p.x-1)+','+p.y, (p.x+1)+','+p.y];
          let adjToFill = false;
          for (const nk of neighbors) {
            if (floodSet.has(nk) || manualPxSideMapFF.has(nk)) { adjToFill = true; break; }
          }
          if (!adjToFill) continue;
          ftPixelSet.add(p.x+','+p.y);
          ftPixels.push(p);
        }
        if (ftPixelSet.size === 0) continue;
        const { data:fft, w:fwft, h:fhft } = ftCacheN;
        const { data:fftf, w:fwftf, h:fhftf } = ftCacheF;
        const ftBaked: BakedPixel[] = ftPixels.map(p => {
          const si = ((p.y%fhft)*fwft+(p.x%fwft))*4;
          return { x:p.x, y:p.y, r:fft[si], g:fft[si+1], b:fft[si+2] };
        });
        const ftBakedFlip: BakedPixel[] = ftPixels.map(p => {
          const si = ((p.y%fhftf)*fwftf+(p.x%fwftf))*4;
          return { x:p.x, y:p.y, r:fftf[si], g:fftf[si+1], b:fftf[si+2] };
        });
        e.bakedFloatRegions.push({ motif:m, pixelSet:ftPixelSet, pixels:ftBaked, pixelsFlipped:ftBakedFlip, isFillTool:true, side:'LEFT' });
      }
    }

    applyPhase1();
    redraw();
    const skipNote = (doBnd && bndPxVal>0) ? ` skip:${bndPxVal}px` : '';
    st(`Filled ${paintPixels.length} px [${mode}${skipNote}]`, 'ok');
  }

  // ── Pen ──
  function penPaintAt(cx: number, cy: number, button: number) {
    const e = eng.current; if (!e.originalImage) return;
    const canvas = canvasRef.current!;
    if (cx<0||cx>=canvas.width||cy<0||cy>=canvas.height) return;
    pushUndo();
    if (button === 2) {
      e.penEdits.delete(cx+','+cy);
    } else {
      e.penEdits.set(cx+','+cy, { ...e.penColor });
    }
    redraw();
  }

  // ── Poly ──
  function drawPolyOverlay() {
    const e = eng.current;
    if (!overlayRef.current) return;
    const oc = octx(); if (!oc) return;
    clearOverlay();
    if (!e.polyPoints.length) return;
    const w = overlayRef.current.width, h = overlayRef.current.height;
    const imgData = oc.createImageData(w,h);
    const d = imgData.data;
    function plot(x: number, y: number) {
      if (x<0||x>=w||y<0||y>=h) return;
      const i=(y*w+x)*4; d[i]=255; d[i+1]=0; d[i+2]=0; d[i+3]=255;
    }
    const pts = e.polyMousePt ? [...e.polyPoints, e.polyMousePt] : e.polyPoints;
    for (let i=0; i<pts.length-1; i++) {
      bresenhamLine(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, plot);
    }
    oc.putImageData(imgData,0,0);
  }

  function polyBounds(pts: PixelXY[]) {
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const p of pts) { if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; }
    return { minX, minY, maxX, maxY };
  }

  function commitPolyErase() {
    const e = eng.current;
    if (e.polyPoints.length < 3) { e.polyPoints=[]; clearOverlay(); return; }
    const { minX, minY, maxX, maxY } = polyBounds(e.polyPoints);
    const canvas = canvasRef.current!;
    const w = canvas.width, h = canvas.height;
    pushUndo();

    const insideSet = new Set<string>();
    for (let y=Math.max(0,minY); y<=Math.min(h-1,maxY); y++) {
      for (let x=Math.max(0,minX); x<=Math.min(w-1,maxX); x++) {
        if (pointInPolygon(x+0.5, y+0.5, e.polyPoints)) {
          const key = x+','+y; insideSet.add(key);
          for (const m of e.motifResults) if (m.pixelSet.has(key)) e.erasedSet.add(key);
        }
      }
    }

    const fullyRemoved: ManualFillRegion[] = [];
    for (let i=e.manualFillRegions.length-1; i>=0; i--) {
      const region = e.manualFillRegions[i];
      const newPixels = region.pixels.filter(p => !insideSet.has(p.x+','+p.y));
      const newPixSet = new Set([...region.pixelSet].filter(k => !insideSet.has(k)));
      if (newPixels.length === 0) { fullyRemoved.push(region); e.manualFillRegions.splice(i,1); }
      else if (newPixels.length < region.pixels.length) { region.pixels = newPixels; region.pixelSet = newPixSet; }
    }

    e.bakedFloatRegions = e.bakedFloatRegions.filter(bfr => {
      if (bfr.isFillTool) {
        for (const removedRgn of fullyRemoved) {
          const [s,b] = bfr.motif.pixelSet.size < removedRgn.pixelSet.size
            ? [bfr.motif.pixelSet, removedRgn.pixelSet] : [removedRgn.pixelSet, bfr.motif.pixelSet];
          for (const key of s) if (b.has(key)) { for (const k of bfr.pixelSet) e.erasedSet.add(k); return false; }
        }
      }
      for (const key of bfr.pixelSet) if (insideSet.has(key)) { for (const k of bfr.pixelSet) e.erasedSet.add(k); return false; }
      return true;
    });

    if (e.processedImage) applyPhase1();
    e.polyPoints=[]; e.polyMousePt=null;
    clearOverlay(); redraw();
  }

  // ── Process / Bake Float ──
  const runProcess = useCallback(() => {
    const e = eng.current;
    if (!e.originalImage) { setPhaseStatus('No image loaded'); return; }
    pushUndo();
    applyPhase1();

    if (!vertFloatRef.current || !e.motifResults.length) {
      const c = ctx();
      if (c && e.processedImage) c.putImageData(e.processedImage, 0, 0);
      clearOverlay(); setFloatCountText('');
      return;
    }

    const canvas = canvasRef.current!;
    const w = canvas.width;
    const minLen = Math.max(1, vertFloatLenRef.current);
    const mode   = fillModeRef.current;
    const c      = ctx(); if (!c) return;

    if (mode === 'INNER_BORDER8') {
      const floatSet = computeFloatPixelSet(w, minLen, e.originalImage.data, e.motifResults, e.erasedSet);
      setVertFloat(false);
      setFloatCountText('');
      if (e.processedImage) c.putImageData(e.processedImage, 0, 0);
      clearOverlay();
      setPhaseStatus(`Phase 1 ✔ → Float merged in Inside+Vert  •  ${floatSet.size} float px`);
    } else {
      const floatData = computeFloatData(w, minLen, e.motifOnlyImage!.data, e.motifResults, e.erasedSet);
      let totalFloatPx = 0;
      const outData = new Uint8ClampedArray(e.motifOnlyImage!.data);
      const manualPxSideMap = new Map<string, Side>();
      for (const region of e.manualFillRegions) {
        const s = region.side || 'LEFT';
        for (const fp of region.pixels) manualPxSideMap.set(fp.x+','+fp.y, s);
      }
      e.bakedFloatRegions = [];

      for (const { m, pixels } of floatData) {
        const motifCache = m.side==='LEFT' ? e.leftFillCache : e.rightFillCache;
        const normPixelSet=new Set<string>(), normPixels: PixelXY[]=[];
        const ftPixelSet  =new Set<string>(), ftPixels  : PixelXY[]=[];

        for (const p of pixels) {
          if (e.erasedSet.has(p.x+','+p.y)) continue;
          const neighbors=[p.x+','+(p.y-1),p.x+','+(p.y+1),(p.x-1)+','+p.y,(p.x+1)+','+p.y];
          let adjSide: Side|null=null;
          for (const nk of neighbors) if (manualPxSideMap.has(nk)) { adjSide=manualPxSideMap.get(nk)!; break; }
          const adjacentToManual = adjSide !== null;
          const activeFillCache  = e.fillToolCache || motifCache;
          const cache = adjacentToManual ? activeFillCache : motifCache;
          if (!cache) continue;
          const {data:fd,w:fw,h:fh}=cache;
          const si=((p.y%fh)*fw+(p.x%fw))*4, di=(p.y*w+p.x)*4;
          outData[di]=fd[si]; outData[di+1]=fd[si+1]; outData[di+2]=fd[si+2]; outData[di+3]=fd[si+3];
          totalFloatPx++;
          if (adjacentToManual) { ftPixelSet.add(p.x+','+p.y); ftPixels.push(p); }
          else { normPixelSet.add(p.x+','+p.y); normPixels.push(p); }
        }

        if (normPixelSet.size > 0 && motifCache) {
          const normFlip = buildFillCacheFlipped(motifCache)!;
          const {data:fn,w:fwn,h:fhn}=motifCache;
          const {data:fnf,w:fwnf,h:fhnf}=normFlip;
          const normBaked    = normPixels.map(p=>{const si=((p.y%fhn)*fwn+(p.x%fwn))*4;return{x:p.x,y:p.y,r:fn[si],g:fn[si+1],b:fn[si+2]};});
          const normBakedFlip= normPixels.map(p=>{const si=((p.y%fhnf)*fwnf+(p.x%fwnf))*4;return{x:p.x,y:p.y,r:fnf[si],g:fnf[si+1],b:fnf[si+2]};});
          e.bakedFloatRegions.push({motif:m,pixelSet:normPixelSet,pixels:normBaked,pixelsFlipped:normBakedFlip,isFillTool:false,side:'LEFT'});
        }
        if (ftPixelSet.size > 0) {
          const ftCacheN = e.fillToolCache || motifCache;
          const ftCacheF = e.fillToolCacheFlipped || buildFillCacheFlipped(ftCacheN);
          if (ftCacheN && ftCacheF) {
            const {data:fft,w:fwft,h:fhft}=ftCacheN, {data:fftf,w:fwftf,h:fhftf}=ftCacheF;
            const ftBaked    = ftPixels.map(p=>{const si=((p.y%fhft)*fwft+(p.x%fwft))*4;return{x:p.x,y:p.y,r:fft[si],g:fft[si+1],b:fft[si+2]};});
            const ftBakedFlip= ftPixels.map(p=>{const si=((p.y%fhftf)*fwftf+(p.x%fwftf))*4;return{x:p.x,y:p.y,r:fftf[si],g:fftf[si+1],b:fftf[si+2]};});
            e.bakedFloatRegions.push({motif:m,pixelSet:ftPixelSet,pixels:ftBaked,pixelsFlipped:ftBakedFlip,isFillTool:true,side:'LEFT'});
          }
        }
      }

      e.motifOnlyImage = new ImageData(new Uint8ClampedArray(outData), w, canvas.height);
      paintManualFills(outData, w);
      e.processedImage = new ImageData(new Uint8ClampedArray(outData), w, canvas.height);
      setVertFloat(false);
      setFloatCountText('');
      c.putImageData(e.processedImage, 0, 0); clearOverlay();
      setPhaseStatus(`Phase 1 ✔ → Phase 2→3 ✔ baked  •  ${totalFloatPx} float px filled`);
    }
  }, []);

  // ── Clear Fill ──
  const clearFill = useCallback(() => {
    const e = eng.current; if (!e.originalImage) return;
    pushUndo();
    e.erasedSet.clear(); e.manualFillRegions=[]; e.bakedFloatRegions=[]; e.penEdits.clear();
    e.motifResults.forEach(m => { if (m._origSide) m.side=m._origSide; });
    e.processedImage=null; e.motifOnlyImage=null;
    const c = ctx();
    if (c && e.originalImage) c.putImageData(e.originalImage, 0, 0);
    clearOverlay(); setFloatCountText('');
    setPhaseStatus('⬤ Ready');
    st('Fill cleared', 'ok');
  }, []);

  // ── Reset All ──
  const resetAll = useCallback(() => {
    const e = eng.current;
    e.undoStack=[]; e.redoStack=[]; updateUndoButtons();
    const canvas = canvasRef.current;
    if (canvas) { const c = ctx(); if (c) c.clearRect(0,0,canvas.width,canvas.height); canvas.width=0; canvas.height=0; }
    e.originalImage=null; e.processedImage=null; e.motifOnlyImage=null; e.motifResults=[];
    e.erasedSet.clear(); e.allMotifPixelSet.clear(); e.manualFillRegions=[]; e.bakedFloatRegions=[];
    e.polyPoints=[]; e.polyMousePt=null;
    e.penEdits.clear(); e.highlightPixelSet.clear(); e.highlightActive=false;
    setHighlightActive(false);
    clearOverlay(); setActiveTool('move');
    setPhaseStatus('Upload image to begin'); setFloatCountText('');
    setHasImage(false);
    st('No image loaded', '');
  }, []);

  // ── Export ──
  const exportBMP = useCallback(async (fileName?: string) => {
    const e = eng.current; if (!e.originalImage) { st('No image to export', 'error'); return; }
    const c = ctx(); if (!c) return;
    const canvas = canvasRef.current!;
    st('Building 8-bit BMP…', 'busy');
    const name = (fileName || 'motif_export') + '.bmp';

    if (window.electronAPI) {
      const result = await window.electronAPI.showSaveDialog(name, uploadDirRef.current || undefined);
      if (result.canceled || !result.filePath) { st('Export cancelled', ''); return; }
      const bmpBytes = canvasToBMP(c, canvas.width, canvas.height);
      const res = await window.electronAPI.saveBmp(result.filePath, bmpBytes.buffer);
      if (res.success) st(`Saved: ${result.filePath}`, 'ok');
      else st(`Export error: ${res.error}`, 'error');
    } else {
      const bmpBytes = canvasToBMP(c, canvas.width, canvas.height);
      const blob = new Blob([bmpBytes], { type: 'image/bmp' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      st(`Downloaded: ${name}`, 'ok');
    }
  }, []);

  // ── Zoom to specific value ──
  const zoomTo = useCallback((v: number) => {
    const e = eng.current; if (!e.originalImage) return;
    const vp = viewportRef.current; const canvas = canvasRef.current; if (!vp || !canvas) return;
    const clamped = Math.max(1, Math.min(MAX_SCALE, v));
    const cx = vp.scrollLeft + vp.clientWidth  / 2;
    const cy = vp.scrollTop  + vp.clientHeight / 2;
    const oldScale = e.scale;
    e.scale = clamped;
    applyScale(clamped);
    const ratio = clamped / oldScale;
    vp.scrollLeft = cx * ratio - vp.clientWidth  / 2;
    vp.scrollTop  = cy * ratio - vp.clientHeight / 2;
  }, []);

  // ── Export PNG ──
  const exportPNG = useCallback(async (fileName?: string) => {
    const e = eng.current; if (!e.originalImage) { st('No image to export', 'error'); return; }
    const canvas = canvasRef.current!;
    const name = (fileName || 'motif_export') + '.png';
    st('Building PNG…', 'busy');
    canvas.toBlob(async (blob) => {
      if (!blob) { st('PNG export failed', 'error'); return; }
      const buf = await blob.arrayBuffer();
      if (window.electronAPI) {
        const result = await window.electronAPI.showSaveDialogFormat(name, 'png', uploadDirRef.current || undefined);
        if (result.canceled || !result.filePath) { st('Export cancelled', ''); return; }
        const res = await window.electronAPI.saveFile(result.filePath, buf);
        if (res.success) st(`Saved: ${result.filePath}`, 'ok');
        else st(`Export error: ${res.error}`, 'error');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        st(`Downloaded: ${name}`, 'ok');
      }
    }, 'image/png');
  }, []);

  // ── Export TIFF ──
  const exportTIFF = useCallback(async (fileName?: string) => {
    const e = eng.current; if (!e.originalImage) { st('No image to export', 'error'); return; }
    const c = ctx(); if (!c) return;
    const canvas = canvasRef.current!;
    const name = (fileName || 'motif_export') + '.tiff';
    st('Building TIFF…', 'busy');
    const tiffBytes = canvasToTIFF(c, canvas.width, canvas.height);
    if (window.electronAPI) {
      const result = await window.electronAPI.showSaveDialogFormat(name, 'tiff', uploadDirRef.current || undefined);
      if (result.canceled || !result.filePath) { st('Export cancelled', ''); return; }
      const res = await window.electronAPI.saveFile(result.filePath, tiffBytes.buffer);
      if (res.success) st(`Saved: ${result.filePath}`, 'ok');
      else st(`Export error: ${res.error}`, 'error');
    } else {
      const blob = new Blob([tiffBytes], { type: 'image/tiff' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      st(`Downloaded: ${name}`, 'ok');
    }
  }, []);

  // ── Save project ──
  const saveProject = useCallback(async () => {
    const e = eng.current; if (!e.originalImage) { st('No image to save', 'error'); return; }
    const canvas = canvasRef.current!;
    st('Saving project…', 'busy');
    const tmpC = document.createElement('canvas');
    tmpC.width = canvas.width; tmpC.height = canvas.height;
    tmpC.getContext('2d')!.putImageData(e.originalImage, 0, 0);
    const imageB64 = tmpC.toDataURL('image/png');
    const payload: ProjectFile = {
      version: 1,
      image: imageB64,
      erasedSet:   [...e.erasedSet],
      motifSides:  e.motifResults.map(m => m.side),
      manualFillRegions: e.manualFillRegions.map(r => ({
        pixelSet: [...r.pixelSet], pixels: r.pixels, pixelsFlipped: r.pixelsFlipped, side: r.side,
      })),
      bakedFloatRegions: e.bakedFloatRegions.map(r => ({
        motifIdx: e.motifResults.indexOf(r.motif),
        pixelSet: [...r.pixelSet], pixels: r.pixels, pixelsFlipped: r.pixelsFlipped,
        isFillTool: r.isFillTool, side: r.side,
      })),
      penEdits: [...e.penEdits.entries()],
      settings: {
        fillMode: fillModeRef.current, vBorderLen: vBorderLenRef.current,
        use8: use8Ref.current, bndSkip: bndSkipRef.current, bndSkipPx: bndSkipPxRef.current,
        vertFloat: vertFloatRef.current, vertFloatLen: vertFloatLenRef.current,
        highlightLen: highlightLenRef.current, highlightActive: e.highlightActive,
        highlightColor: highlightColorRef.current, penColorHex: penColorHex,
      },
    };
    const json = JSON.stringify(payload);
    if (window.electronAPI) {
      const result = await window.electronAPI.showSaveDialogFormat('project.maf', 'maf');
      if (result.canceled || !result.filePath) { st('Save cancelled', ''); return; }
      const res = await window.electronAPI.saveProject(result.filePath, json);
      if (res.success) st(`Project saved: ${result.filePath}`, 'ok');
      else st(`Save error: ${res.error}`, 'error');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'project.maf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      st('Project downloaded', 'ok');
    }
  }, [penColorHex]);

  // ── Load project ──
  const loadProject = useCallback(async () => {
    if (window.electronAPI) {
      const pick = await window.electronAPI.showOpenProjectDialog();
      if (pick.canceled || !pick.filePath) return;
      const res = await window.electronAPI.loadProject(pick.filePath);
      if (!res.success || !res.data) { st(`Load error: ${res.error}`, 'error'); return; }
      _loadProjectFromJSON(res.data);
    } else {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.maf,application/json';
      input.onchange = () => {
        const file = input.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { if (e.target?.result) _loadProjectFromJSON(e.target.result as string); };
        reader.readAsText(file);
      };
      input.click();
    }
  }, []);

  function _loadProjectFromJSON(json: string) {
    try {
      const data: ProjectFile = JSON.parse(json);
      if (data.version !== 1) { st('Unsupported project version', 'error'); return; }
      pendingRestoreRef.current = data;
      // Restore settings immediately so analysis uses them
      setFillMode(data.settings.fillMode); fillModeRef.current = data.settings.fillMode;
      setVBorderLen(data.settings.vBorderLen); vBorderLenRef.current = data.settings.vBorderLen;
      setUse8(data.settings.use8); use8Ref.current = data.settings.use8;
      setBndSkip(data.settings.bndSkip); bndSkipRef.current = data.settings.bndSkip;
      setBndSkipPx(data.settings.bndSkipPx); bndSkipPxRef.current = data.settings.bndSkipPx;
      setVertFloat(data.settings.vertFloat); vertFloatRef.current = data.settings.vertFloat;
      setVertFloatLen(data.settings.vertFloatLen); vertFloatLenRef.current = data.settings.vertFloatLen;
      setHighlightLen(data.settings.highlightLen); highlightLenRef.current = data.settings.highlightLen;
      setHighlightColor(data.settings.highlightColor); highlightColorRef.current = data.settings.highlightColor;
      updatePenColor(data.settings.penColorHex);
      // Load image — analysis runs, then pendingRestoreRef is applied
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        canvas.width = img.width; canvas.height = img.height;
        const c = canvas.getContext('2d', { willReadFrequently: true })!;
        c.drawImage(img, 0, 0);
        const e = eng.current;
        e.originalImage = new ImageData(new Uint8ClampedArray(c.getImageData(0,0,img.width,img.height).data), img.width, img.height);
        c.putImageData(e.originalImage, 0, 0);
        e.undoStack = []; e.redoStack = []; updateUndoButtons();
        setHasImage(true);
        st(`${img.width}×${img.height} px — restoring…`, 'busy');
        setPhaseStatus('⬤ Restoring…');
        fitCanvas(); syncOverlay();
        setTimeout(runAnalysis, 40);
      };
      img.onerror = () => st('Error loading project image', 'error');
      img.src = data.image;
    } catch {
      st('Invalid project file', 'error');
    }
  }

  function _applyProjectRestore(data: ProjectFile) {
    const e = eng.current;
    e.erasedSet = new Set(data.erasedSet);
    data.motifSides.forEach((s, i) => { if (e.motifResults[i]) e.motifResults[i].side = s; });
    e.manualFillRegions = data.manualFillRegions.map(r => ({
      pixelSet: new Set(r.pixelSet), pixels: r.pixels, pixelsFlipped: r.pixelsFlipped, side: r.side,
    }));
    e.bakedFloatRegions = data.bakedFloatRegions.map(r => ({
      motif: e.motifResults[r.motifIdx] ?? e.motifResults[0],
      pixelSet: new Set(r.pixelSet), pixels: r.pixels, pixelsFlipped: r.pixelsFlipped,
      isFillTool: r.isFillTool, side: r.side,
    }));
    e.penEdits = new Map(data.penEdits);
    if (data.settings.highlightActive) {
      e.highlightActive = true; setHighlightActive(true);
    }
    applyPhase1(); redraw(); setPhaseStatus('⬤ Ready');
    st('Project loaded', 'ok');
  }

  // ── Reanalyse ──
  const reanalyse = useCallback(() => {
    if (!eng.current.originalImage) return;
    setPhaseStatus('Re-analysing…');
    setTimeout(runAnalysis, 40);
  }, []);

  // ── Highlight ──
  const toggleHighlight = useCallback((active: boolean) => {
    const e = eng.current;
    e.highlightActive = active;
    setHighlightActive(active);
    if (active) {
      const canvas = canvasRef.current; if (!canvas) return;
      const c = ctx(); if (!c) return;
      const data = c.getImageData(0,0,canvas.width,canvas.height).data;
      e.highlightPixelSet = computeHighlightPixels(data, canvas.width, canvas.height, highlightLenRef.current, e.penEdits);
      clearOverlay();
    } else {
      e.highlightPixelSet.clear(); clearOverlay();
    }
  }, []);

  // ── Pen color ──
  const updatePenColor = useCallback((hex: string) => {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    eng.current.penColor = { r, g, b };
    setPenColorHex(hex);
  }, []);

  // ── Zoom wheel ──
  const onViewportWheel = useCallback((e: WheelEvent) => {
    const eng2 = eng.current; if (!eng2.originalImage) return;
    e.preventDefault();
    const canvas  = canvasRef.current; if (!canvas) return;
    const vp      = viewportRef.current; if (!vp) return;
    const vr      = vp.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    const imgX    = (e.clientX - cr.left) / eng2.scale;
    const imgY    = (e.clientY - cr.top)  / eng2.scale;
    const cvScrollX = cr.left - vr.left + vp.scrollLeft;
    const cvScrollY = cr.top  - vr.top  + vp.scrollTop;
    const mouseVpX  = e.clientX - vr.left, mouseVpY = e.clientY - vr.top;
    const oldScale  = eng2.scale;
    if (e.deltaY < 0) { if (eng2.scale < MAX_SCALE) eng2.scale++; }
    else { if (eng2.scale > 1) eng2.scale--; }
    if (eng2.scale === oldScale) return;
    applyScale(eng2.scale);
    const ratio = eng2.scale / oldScale;
    vp.scrollLeft = cvScrollX*ratio + imgX*eng2.scale - mouseVpX;
    vp.scrollTop  = cvScrollY*ratio + imgY*eng2.scale - mouseVpY;
  }, []);

  // ── Viewport pan (mouse-button 1 or move tool) ──
  const onViewportMouseDown = useCallback((e: React.MouseEvent) => {
    const isPan = (e.button===0 && activeToolRef.current==='move') || e.button===1;
    if (!isPan) return;
    const eng2 = eng.current;
    eng2.panDragging=true; eng2.panLastX=e.clientX; eng2.panLastY=e.clientY;
    if (viewportRef.current) viewportRef.current.style.cursor='grabbing';
    e.preventDefault();
  }, []);

  const onWindowMouseMove = useCallback((e: MouseEvent) => {
    const eng2 = eng.current;
    if (!eng2.panDragging) return;
    const vp = viewportRef.current; if (!vp) return;
    vp.scrollLeft -= (e.clientX - eng2.panLastX);
    vp.scrollTop  -= (e.clientY - eng2.panLastY);
    eng2.panLastX = e.clientX; eng2.panLastY = e.clientY;
  }, []);

  const onWindowMouseUp = useCallback((e: MouseEvent) => {
    const eng2 = eng.current;
    if (eng2.panDragging) eng2.wasDragging = true;
    eng2.panDragging = false;
    if (viewportRef.current) viewportRef.current.style.cursor = activeToolRef.current === 'move' ? 'grab' : 'crosshair';

    if (activeToolRef.current === 'polyline' && eng2.lassoDrawing) {
      eng2.lassoDrawing = false;
      if (eng2.polyPoints.length >= 3) commitPolyErase();
      else { eng2.polyPoints=[]; clearOverlay(); }
    }
  }, []);

  // ── Viewport mousemove (coordinates + cursor tracking) ──
  const onViewportMouseMove = useCallback((e: React.MouseEvent) => {
    const eng2 = eng.current; if (!eng2.originalImage) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    const x  = Math.floor((e.clientX-cr.left)/eng2.scale);
    const y  = Math.floor((e.clientY-cr.top) /eng2.scale);
    if (x>=0&&x<canvas.width&&y>=0&&y<canvas.height) {
      eng2.cursorCanvasX=x; eng2.cursorCanvasY=y;
      setCoordX(x); setCoordY(y);
    } else {
      eng2.cursorCanvasX=-1; eng2.cursorCanvasY=-1;
    }
  }, []);

  // ── Overlay events ──
  const onOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    const eng2 = eng.current; if (!eng2.originalImage) return;
    eng2.panLastX=e.clientX; eng2.panLastY=e.clientY; eng2.wasDragging=false;

    if (activeToolRef.current==='polyline' && e.button===0) {
      eng2.lassoDrawing=true; eng2.polyPoints=[]; eng2.polyMousePt=null;
      const pt=evToCanvas(e); eng2.polyPoints.push(pt);
      e.preventDefault(); return;
    }
    if (['erase','switch','fill','pen'].includes(activeToolRef.current)) {
      if (e.button===0||e.button===2) {
        eng2.overlayDragStart={x:e.clientX,y:e.clientY};
        eng2.penButton=e.button;
        if (e.button===2) e.preventDefault();
      }
    }
  }, []);

  const onOverlayMouseMove = useCallback((e: React.MouseEvent) => {
    const eng2 = eng.current; if (!eng2.originalImage) return;

    if (activeToolRef.current==='polyline' && eng2.lassoDrawing) {
      const pt=evToCanvas(e);
      const last=eng2.polyPoints[eng2.polyPoints.length-1];
      if (Math.abs(pt.x-last.x)>=1||Math.abs(pt.y-last.y)>=1) {
        eng2.polyPoints.push(pt); drawPolyOverlay();
      }
      return;
    }

    if (eng2.overlayDragStart && ['erase','switch','fill','pen'].includes(activeToolRef.current)) {
      const dx=Math.abs(e.clientX-eng2.overlayDragStart.x), dy=Math.abs(e.clientY-eng2.overlayDragStart.y);
      if ((dx>5||dy>5) && !eng2.panDragging) { eng2.panDragging=true; if(viewportRef.current) viewportRef.current.style.cursor='grabbing'; }
      if (eng2.panDragging) {
        const vp=viewportRef.current; if(vp){ vp.scrollLeft-=(e.clientX-eng2.panLastX); vp.scrollTop-=(e.clientY-eng2.panLastY); }
        eng2.panLastX=e.clientX; eng2.panLastY=e.clientY;
        e.stopPropagation(); return;
      }
    }
  }, []);

  const onOverlayMouseUp = useCallback((e: React.MouseEvent) => {
    const eng2=eng.current; if(!eng2.originalImage) return;
    if (activeToolRef.current==='polyline' && eng2.lassoDrawing && e.button===0) {
      eng2.lassoDrawing=false;
      if (eng2.polyPoints.length>=3) commitPolyErase();
      else { eng2.polyPoints=[]; clearOverlay(); }
    }
  }, []);

  const onOverlayClick = useCallback((e: React.MouseEvent) => {
    const eng2=eng.current; if(!eng2.originalImage) return;
    if (activeToolRef.current==='polyline') return;
    if (eng2.panDragging||eng2.wasDragging) {
      eng2.panDragging=false; eng2.wasDragging=false; eng2.overlayDragStart=null;
      e.stopPropagation(); return;
    }
    eng2.overlayDragStart=null;
    const pt=evToCanvas(e);
    if (activeToolRef.current==='switch') { switchMotifAt(pt.x,pt.y); return; }
    if (activeToolRef.current==='erase')  { eraseMotifAt(pt.x,pt.y,false); return; }
    if (activeToolRef.current==='fill')   { floodFillAt(pt.x,pt.y); return; }
    if (activeToolRef.current==='pen')    { penPaintAt(pt.x,pt.y,eng2.penButton); return; }
  }, []);

  const onOverlayContextMenu = useCallback((e: React.MouseEvent) => {
    const eng2=eng.current; if(!eng2.originalImage) return;
    e.preventDefault();
    if (activeToolRef.current==='pen') { const pt=evToCanvas(e); penPaintAt(pt.x,pt.y,2); return; }
    if (activeToolRef.current==='erase') { const pt=evToCanvas(e); eraseMotifAt(pt.x,pt.y,true); return; }
    if (activeToolRef.current==='polyline') { eng2.lassoDrawing=false; eng2.polyPoints=[]; clearOverlay(); }
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))) { e.preventDefault(); redo(); return; }

      if (e.code==='Space'&&!e.repeat) {
        if (document.activeElement&&(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA')) return;
        e.preventDefault();
        const eng2=eng.current;

        if (activeToolRef.current==='pen'&&eng2.cursorCanvasX>=0&&eng2.cursorCanvasY>=0&&eng2.originalImage) {
          const c=ctx(); if(!c) return;
          const px=c.getImageData(eng2.cursorCanvasX,eng2.cursorCanvasY,1,1).data;
          const r=px[0],g=px[1],b=px[2];
          eng2.penColor={r,g,b};
          const hex='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
          setPenColorHex(hex); return;
        }

        if (eng2.spaceToolPrev===null) {
          eng2.spaceToolPrev=activeToolRef.current;
          setActiveTool('move');
        }
        return;
      }

      if (e.key==='Escape') {
        const eng2=eng.current;
        if (activeToolRef.current==='polyline') { eng2.lassoDrawing=false; eng2.polyPoints=[]; clearOverlay(); }
        else setActiveTool('move');
        return;
      }
      if (e.key==='Enter') {
        const eng2=eng.current;
        if (activeToolRef.current==='polyline'&&eng2.polyPoints.length>=3) { eng2.lassoDrawing=false; commitPolyErase(); }
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code==='Space') {
        const eng2=eng.current;
        if (eng2.spaceToolPrev!==null) {
          const prev=eng2.spaceToolPrev; eng2.spaceToolPrev=null;
          setActiveTool(prev);
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    return () => { document.removeEventListener('keydown',onKeyDown); document.removeEventListener('keyup',onKeyUp); };
  }, [undo, redo, setActiveTool]);

  // ── Global mouse events ──
  useEffect(() => {
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup',   onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup',   onWindowMouseUp);
    };
  }, [onWindowMouseMove, onWindowMouseUp]);

  // ── Viewport wheel ──
  useEffect(() => {
    const vp = viewportRef.current; if (!vp) return;
    vp.addEventListener('wheel', onViewportWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onViewportWheel);
  }, [onViewportWheel]);

  // ── Drag-drop on viewport ──
  const onViewportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  }, [handleImageFile]);

  const onViewportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  }, []);

  // ── Settings handlers that trigger redraw ──
  const handleFillModeChange = useCallback((v: FillMode) => {
    setFillMode(v); fillModeRef.current = v;
    applyPhase1(); redraw();
  }, []);
  const handleVBorderLenChange = useCallback((v: number) => {
    setVBorderLen(v); vBorderLenRef.current = v;
    applyPhase1(); redraw();
  }, []);
  const handleUse8Change = useCallback((v: boolean) => {
    setUse8(v); use8Ref.current = v; reanalyse();
  }, [reanalyse]);
  const handleVertFloatChange = useCallback((v: boolean) => {
    setVertFloat(v); vertFloatRef.current = v; redraw();
  }, []);
  const handleVertFloatLenChange = useCallback((v: number) => {
    setVertFloatLen(v); vertFloatLenRef.current = v; redraw();
  }, []);
  const handleHighlightChange = useCallback((active: boolean) => {
    toggleHighlight(active);
  }, [toggleHighlight]);
  const handleHighlightLenChange = useCallback((v: number) => {
    setHighlightLen(v); highlightLenRef.current = v;
    if (eng.current.highlightActive) toggleHighlight(true);
  }, [toggleHighlight]);

  return {
    // Refs
    canvasRef, overlayRef, viewportRef,
    // UI state
    status, statusType, zoom, activeTool, canUndo, canRedo,
    coordX, coordY, fillMode, vBorderLen, use8, bndSkip, bndSkipPx,
    vertFloat, vertFloatLen, highlightLen, highlightActive, highlightColor,
    penColorHex, floatCountText, phaseStatus,
    // Actions
    setActiveTool, undo, redo, clearFill, resetAll,
    exportBMP, exportPNG, exportTIFF,
    saveProject, loadProject,
    handleImageFile, setMotifBitmap, setFillToolBitmap, reanalyse,
    updatePenColor, toggleHighlight,
    // Settings setters
    setBndSkip, setBndSkipPx,
    setHighlightColor: (v: string) => { setHighlightColor(v); highlightColorRef.current = v; if (eng.current.highlightActive) { clearOverlay(); } },
    handleFillModeChange, handleVBorderLenChange, handleUse8Change,
    handleVertFloatChange, handleVertFloatLenChange,
    handleHighlightChange, handleHighlightLenChange,
    // Canvas event handlers
    onViewportMouseDown, onViewportMouseMove, onViewportDrop, onViewportDragOver,
    onOverlayMouseDown, onOverlayMouseMove, onOverlayMouseUp, onOverlayClick, onOverlayContextMenu,
    // Utilities
    hasImage,
    fitCanvas: () => fitCanvas(),
    zoomTo,
    zoom1x: () => {
      const e = eng.current; if (!e.originalImage) return;
      e.scale = 1; applyScale(1);
    },
    zoomStep: (dir: number) => {
      const e = eng.current; if (!e.originalImage) return;
      const vp = viewportRef.current; const canvas = canvasRef.current; if (!vp||!canvas) return;
      const oldScale=e.scale;
      if (dir>0){if(e.scale<MAX_SCALE)e.scale++;}else{if(e.scale>1)e.scale--;}
      const cx=vp.scrollLeft+vp.clientWidth/2, cy=vp.scrollTop+vp.clientHeight/2;
      applyScale(e.scale);
      const ratio=e.scale/oldScale;
      vp.scrollLeft=cx*ratio-vp.clientWidth/2; vp.scrollTop=cy*ratio-vp.clientHeight/2;
    },
  };
}
