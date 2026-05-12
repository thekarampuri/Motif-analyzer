import type { FillCache, MotifResult, PixelXY, BakedPixel, VertRun, Side } from './types';

// ── Threshold: lum < 180 → black pixel ──
export function buildCleanBW(rawData: ImageData, w: number, h: number): ImageData {
  const src = rawData.data;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = out[i+1] = out[i+2] = 255; out[i+3] = 255; }
  for (let i = 0; i < w * h; i++) {
    const lum = (src[i*4] + src[i*4+1] + src[i*4+2]) / 3;
    if (lum < 180) { out[i*4] = out[i*4+1] = out[i*4+2] = 0; out[i*4+3] = 255; }
  }
  return new ImageData(out, w, h);
}

export function binarise(imgData: ImageData, w: number, h: number): Uint8Array {
  const d = imgData.data;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = (d[i*4] + d[i*4+1] + d[i*4+2]) / 3 < 180 ? 1 : 0;
  return bin;
}

export const wrap = (x: number, m: number): number => x < 0 ? m - 1 : x >= m ? 0 : x;

// 8-connected flood fill with wrap-around edges
export function findComponents(bin: Uint8Array, w: number, h: number): number[][] {
  const seen = new Uint8Array(bin.length);
  const comps: number[][] = [];
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || seen[i]) continue;
    const stack = [i], comp: number[] = [];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen[p]) continue;
      seen[p] = 1; comp.push(p);
      const x = p % w, y = Math.floor(p / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const n = wrap(y + dy, h) * w + wrap(x + dx, w);
        if (bin[n] && !seen[n]) stack.push(n);
      }
    }
    comps.push(comp);
  }
  return comps;
}

export function getBorder(comp: number[], w: number, h: number, bin: Uint8Array, use8: boolean): PixelXY[] {
  const edges: PixelXY[] = [];
  for (const p of comp) {
    const x = p % w, y = Math.floor(p / w);
    let isBorder = false;
    if (use8) {
      outer: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!bin[wrap(y+dy,h)*w + wrap(x+dx,w)]) { isBorder = true; break outer; }
      }
    } else {
      if (!(bin[wrap(y-1,h)*w+x] && bin[wrap(y+1,h)*w+x] && bin[y*w+wrap(x-1,w)] && bin[y*w+wrap(x+1,w)])) isBorder = true;
    }
    if (isBorder) edges.push({ x, y });
  }
  return edges;
}

export function getInside(m: MotifResult): PixelXY[] {
  return m.pixels.filter(pt => !m.borderSet.has(pt.x + ',' + pt.y));
}

// Zhang-Suen skeletonization
export function skeletonize(img: Uint8Array, w: number, h: number): Uint8Array {
  const nb = (x: number, y: number) => {
    const g = (xx: number, yy: number) => img[wrap(yy,h)*w + wrap(xx,w)];
    return [g(x,y-1),g(x+1,y-1),g(x+1,y),g(x+1,y+1),g(x,y+1),g(x-1,y+1),g(x-1,y),g(x-1,y-1)];
  };
  let changed: boolean;
  do {
    changed = false;
    [0,1].forEach(s => {
      const rem: number[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!img[y*w+x]) continue;
        const n = nb(x,y);
        const B = n.reduce((a,v) => a+v, 0);
        const A = n.reduce((a,v,i) => a + (!v && n[(i+1)%8] ? 1 : 0), 0);
        if (B>=2 && B<=6 && A===1 &&
            (s ? (!n[2]||!n[4]||!n[6]) : (!n[0]||!n[2]||!n[4])) &&
            (s ? (!n[0]||!n[4]||!n[6]) : (!n[2]||!n[4]||!n[6]))) rem.push(y*w+x);
      }
      rem.forEach(p => img[p] = 0);
      if (rem.length) changed = true;
    });
  } while (changed);
  return img;
}

export function classifyDir(pts: PixelXY[]): Side {
  let L = 0, R = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (dx > 0) R += d; else if (dx < 0) L += d;
  }
  return R > L ? 'RIGHT' : 'LEFT';
}

export function buildFillCache(img: HTMLImageElement): FillCache | null {
  if (!img || !img.width) return null;
  const oc = document.createElement('canvas');
  oc.width = img.width; oc.height = img.height;
  const ox = oc.getContext('2d', { willReadFrequently: true })!;
  ox.imageSmoothingEnabled = false;
  ox.drawImage(img, 0, 0);
  const id = ox.getImageData(0, 0, img.width, img.height);
  return { data: id.data, w: img.width, h: img.height };
}

export function buildFillCacheFromDataUrl(dataUrl: string): Promise<FillCache | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(buildFillCache(img));
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function buildFillCacheFlipped(cache: FillCache | null): FillCache | null {
  if (!cache) return null;
  const { data: src, w, h } = cache;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y*w + (w-1-x)) * 4, di = (y*w+x) * 4;
    out[di] = src[si]; out[di+1] = src[si+1]; out[di+2] = src[si+2]; out[di+3] = src[si+3];
  }
  return { data: out, w, h };
}

// Build a MotifResult from a component list
export function buildMotifResult(
  comp: number[],
  border: PixelXY[],
  skelBin: Uint8Array,
  w: number,
  use8: boolean
): MotifResult {
  const borderSet = new Set(border.map(p => p.x + ',' + p.y));
  const pixelSet  = new Set(comp.map(p => (p%w) + ',' + Math.floor(p/w)));
  const pts = comp
    .filter(p => skelBin[p])
    .map(p => ({ x: p%w, y: Math.floor(p/w) }))
    .sort((a,b) => a.y - b.y || a.x - b.x);

  // Build vertical runs on border pixels
  const byCol: Record<number, number[]> = {};
  for (const p of border) {
    if (!byCol[p.x]) byCol[p.x] = [];
    byCol[p.x].push(p.y);
  }
  const vertRuns: VertRun[] = [];
  for (const xStr of Object.keys(byCol)) {
    const x = +xStr, ys = byCol[x].sort((a,b) => a-b);
    let i = 0;
    while (i < ys.length) {
      const rp: PixelXY[] = [{ x, y: ys[i] }];
      while (i+1 < ys.length && ys[i+1] === ys[i]+1) { i++; rp.push({ x, y: ys[i] }); }
      vertRuns.push({ pixels: rp, len: rp.length }); i++;
    }
  }

  const detectedSide = classifyDir(pts);
  return {
    side: detectedSide,
    _origSide: detectedSide,
    pixels: comp.map(p => ({ x: p%w, y: Math.floor(p/w) })),
    border,
    borderSet,
    pixelSet,
    vertRuns,
  };
}

// ── BMP Export ──

export function nearestPalIdx(r: number, g: number, b: number, pal: {r:number,g:number,b:number}[]): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dr = r - pal[i].r, dg = g - pal[i].g, db = b - pal[i].b;
    const d = dr*dr + dg*dg + db*db;
    if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
  }
  return best;
}

export function medianCutPalette(
  uniq: { r: number; g: number; b: number; count: number }[],
  maxColors: number
): { r: number; g: number; b: number }[] {
  if (uniq.length <= maxColors) {
    const pal = uniq.map(c => ({ r: c.r, g: c.g, b: c.b }));
    while (pal.length < maxColors) pal.push({ r: 0, g: 0, b: 0 });
    return pal;
  }
  let buckets = [uniq.slice()];
  while (buckets.length < maxColors) {
    let bi = 0, bestR = 0;
    for (let i = 0; i < buckets.length; i++) {
      const bk = buckets[i];
      let mn = [255,255,255], mx = [0,0,0];
      for (const {r,g,b} of bk) {
        if (r<mn[0]) mn[0]=r; if (r>mx[0]) mx[0]=r;
        if (g<mn[1]) mn[1]=g; if (g>mx[1]) mx[1]=g;
        if (b<mn[2]) mn[2]=b; if (b>mx[2]) mx[2]=b;
      }
      const rng = Math.max(mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]);
      if (rng > bestR) { bestR = rng; bi = i; }
    }
    if (bestR === 0) break;
    const bk = buckets.splice(bi, 1)[0];
    let mn = [255,255,255], mx = [0,0,0];
    for (const {r,g,b} of bk) {
      if (r<mn[0]) mn[0]=r; if (r>mx[0]) mx[0]=r;
      if (g<mn[1]) mn[1]=g; if (g>mx[1]) mx[1]=g;
      if (b<mn[2]) mn[2]=b; if (b>mx[2]) mx[2]=b;
    }
    const ranges = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
    const ch = (['r','g','b'] as const)[ranges.indexOf(Math.max(...ranges))];
    bk.sort((a,b2) => a[ch] - b2[ch]);
    let total = bk.reduce((s,c) => s+c.count, 0), half = 0, mid = 0;
    for (let i = 0; i < bk.length; i++) {
      half += bk[i].count;
      if (half * 2 >= total) { mid = i+1; break; }
    }
    if (mid === 0 || mid === bk.length) mid = Math.floor(bk.length / 2);
    buckets.push(bk.slice(0, mid), bk.slice(mid));
  }
  return buckets.filter(b => b.length > 0).map(bk => {
    let sr=0, sg=0, sb=0, sc=0;
    for (const {r,g,b,count} of bk) { sr+=r*count; sg+=g*count; sb+=b*count; sc+=count; }
    return { r: Math.round(sr/sc), g: Math.round(sg/sc), b: Math.round(sb/sc) };
  });
}

export function canvasToBMP(ctx: CanvasRenderingContext2D, w: number, h: number): Uint8Array {
  const px = ctx.getImageData(0, 0, w, h).data;
  const nPx = w * h;

  const cntMap = new Map<number, number>();
  for (let i = 0; i < nPx * 4; i += 4) {
    const key = (px[i] << 16) | (px[i+1] << 8) | px[i+2];
    cntMap.set(key, (cntMap.get(key) || 0) + 1);
  }
  const uniq = Array.from(cntMap.entries()).map(([k, count]) => ({
    r: (k >> 16) & 0xff, g: (k >> 8) & 0xff, b: k & 0xff, count
  }));

  const palette = medianCutPalette(uniq, 256);
  const exactMap = new Map<number, number>();
  palette.forEach((c,i) => exactMap.set((c.r<<16)|(c.g<<8)|c.b, i));
  const nearCache = new Map<number, number>();
  function getIdx(r: number, g: number, b: number): number {
    const key = (r<<16)|(g<<8)|b;
    let idx = exactMap.get(key);
    if (idx !== undefined) return idx;
    idx = nearCache.get(key);
    if (idx !== undefined) return idx;
    idx = nearestPalIdx(r, g, b, palette);
    nearCache.set(key, idx);
    return idx;
  }

  const rowStride = Math.ceil(w/4)*4;
  const pixelBytes = rowStride * h;
  const dataOffset = 14 + 40 + 256*4;
  const fileSize   = dataOffset + pixelBytes;

  const buf = new ArrayBuffer(fileSize);
  const dv  = new DataView(buf);
  const u8  = new Uint8Array(buf);

  u8[0] = 0x42; u8[1] = 0x4D;
  dv.setUint32(2,  fileSize,   true);
  dv.setUint32(6,  0,          true);
  dv.setUint32(10, dataOffset, true);

  dv.setUint32(14, 40,          true);
  dv.setInt32 (18, w,           true);
  dv.setInt32 (22, h,           true);
  dv.setUint16(26, 1,           true);
  dv.setUint16(28, 8,           true);
  dv.setUint32(30, 0,           true);
  dv.setUint32(34, pixelBytes,  true);
  dv.setInt32 (38, 3780,        true);
  dv.setInt32 (42, 3780,        true);
  dv.setUint32(46, 256,         true);
  dv.setUint32(50, 0,           true);

  let off = 54;
  for (const {r,g,b} of palette) { u8[off++]=b; u8[off++]=g; u8[off++]=r; u8[off++]=0; }

  off = dataOffset;
  for (let y = h-1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const si = (y*w+x)*4;
      u8[off++] = getIdx(px[si], px[si+1], px[si+2]);
    }
    for (let p = w; p < rowStride; p++) u8[off++] = 0;
  }

  return u8;
}

// ── Phase 1 pixel selection ──
export function getPhase1Pixels(
  m: MotifResult,
  mode: string,
  vLen: number,
  floatPixelSet: Set<string> | null
): PixelXY[] {
  if (mode === 'WHOLE')  return m.pixels;
  if (mode === 'INNER')  return getInside(m);
  if (mode === 'BORDER') return m.border;

  const keep: PixelXY[] = [];
  for (const run of m.vertRuns) if (run.len >= vLen) for (const p of run.pixels) keep.push(p);
  if (mode === 'BORDER8') return keep;

  // INNER_BORDER8: Inside + Vert Border + Float Fill pixels
  const base = getInside(m).concat(keep);
  if (!floatPixelSet || !floatPixelSet.size) return base;
  const baseKeys = new Set(base.map(p => p.x + ',' + p.y));
  for (const key of floatPixelSet) {
    if (m.pixelSet.has(key) && !baseKeys.has(key)) {
      const [x, y] = key.split(',').map(Number);
      base.push({ x, y });
    }
  }
  return base;
}

// ── Float fill pixel set computation ──
export function computeFloatPixelSet(
  w: number,
  minLen: number,
  srcData: Uint8ClampedArray,
  motifResults: MotifResult[],
  erasedSet: Set<string>
): Set<string> {
  const result = new Set<string>();
  for (const m of motifResults) {
    const byCol: Record<number, number[]> = {};
    for (const p of m.pixels) {
      if (erasedSet.has(p.x + ',' + p.y)) continue;
      const di = (p.y * w + p.x) * 4;
      const lum = (srcData[di] + srcData[di+1] + srcData[di+2]) / 3;
      if (lum >= 180) continue;
      if (!byCol[p.x]) byCol[p.x] = [];
      byCol[p.x].push(p.y);
    }
    for (const xStr of Object.keys(byCol)) {
      const x = +xStr, ys = byCol[x].sort((a,b) => a-b);
      let i = 0;
      while (i < ys.length) {
        const runYs = [ys[i]];
        while (i+1 < ys.length && ys[i+1] === ys[i]+1) { i++; runYs.push(ys[i]); } i++;
        if (runYs.length >= minLen) {
          const topIsEdge = !m.pixelSet.has(x + ',' + (runYs[0]-1));
          const botIsEdge = !m.pixelSet.has(x + ',' + (runYs[runYs.length-1]+1));
          const start = topIsEdge ? 2 : 0, end = botIsEdge ? runYs.length-2 : runYs.length;
          for (let j = start; j < end; j++) result.add(x + ',' + runYs[j]);
        }
      }
    }
  }
  return result;
}

// ── Float data for baking ──
export function computeFloatData(
  w: number,
  minLen: number,
  srcData: Uint8ClampedArray,
  motifResults: MotifResult[],
  erasedSet: Set<string>
): { m: MotifResult; pixels: PixelXY[] }[] {
  const floatData: { m: MotifResult; pixels: PixelXY[] }[] = [];
  for (const m of motifResults) {
    const byCol: Record<number, number[]> = {};
    for (const p of m.pixels) {
      if (erasedSet.has(p.x + ',' + p.y)) continue;
      const di = (p.y * w + p.x) * 4;
      const lum = (srcData[di] + srcData[di+1] + srcData[di+2]) / 3;
      if (lum >= 180) continue;
      if (!byCol[p.x]) byCol[p.x] = [];
      byCol[p.x].push(p.y);
    }
    const qualified: PixelXY[] = [];
    for (const xStr of Object.keys(byCol)) {
      const x = +xStr, ys = byCol[x].sort((a,b) => a-b);
      let i = 0;
      while (i < ys.length) {
        const runYs = [ys[i]];
        while (i+1 < ys.length && ys[i+1] === ys[i]+1) { i++; runYs.push(ys[i]); } i++;
        if (runYs.length >= minLen) {
          const topIsEdge = !m.pixelSet.has(x + ',' + (runYs[0]-1));
          const botIsEdge = !m.pixelSet.has(x + ',' + (runYs[runYs.length-1]+1));
          const start = topIsEdge ? 2 : 0, end = botIsEdge ? runYs.length-2 : runYs.length;
          for (let j = start; j < end; j++) qualified.push({ x, y: runYs[j] });
        }
      }
    }
    if (qualified.length) floatData.push({ m, pixels: qualified });
  }
  return floatData;
}

// ── Highlight float pixels scan ──
export function computeHighlightPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  minLen: number,
  penEdits: Map<string, {r:number;g:number;b:number}>
): Set<string> {
  const result = new Set<string>();
  for (let x = 0; x < w; x++) {
    let runStart = -1;
    for (let y = 0; y <= h; y++) {
      let isBlack = false;
      if (y < h) {
        if (penEdits.has(x + ',' + y)) {
          isBlack = false;
        } else {
          const i = (y*w+x)*4;
          isBlack = (data[i]+data[i+1]+data[i+2])/3 < 128;
        }
      }
      if (isBlack) {
        if (runStart < 0) runStart = y;
      } else {
        if (runStart >= 0) {
          if (y - runStart >= minLen) {
            for (let ry = runStart; ry < y; ry++) result.add(x + ',' + ry);
          }
          runStart = -1;
        }
      }
    }
  }
  return result;
}

// ── Bresenham line ──
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number, fn: (x:number,y:number)=>void): void {
  x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
  const dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  const sx=x0<x1?1:-1, sy=y0<y1?1:-1;
  let err=dx-dy;
  while (true) {
    fn(x0,y0);
    if (x0===x1 && y0===y1) break;
    const e2=2*err;
    if (e2>-dy){err-=dy;x0+=sx;}
    if (e2<dx) {err+=dx;y0+=sy;}
  }
}

// ── Point-in-polygon (ray casting) ──
export function pointInPolygon(px: number, py: number, pts: PixelXY[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length-1; i < pts.length; j = i++) {
    const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
    if (((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside = !inside;
  }
  return inside;
}
