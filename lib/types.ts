export type Tool = 'move' | 'erase' | 'switch' | 'polyline' | 'fill' | 'pen';
export type FillMode = 'WHOLE' | 'INNER' | 'BORDER' | 'BORDER8' | 'INNER_BORDER8';
export type Side = 'LEFT' | 'RIGHT';
export type StatusType = 'ok' | 'busy' | 'error' | '';

export interface FillCache { data: Uint8ClampedArray; w: number; h: number; }
export interface BitmapItem { name: string; dataUrl: string; }
export interface PixelXY { x: number; y: number; }
export interface BakedPixel { x: number; y: number; r: number; g: number; b: number; }
export interface VertRun { pixels: PixelXY[]; len: number; }

export interface MotifResult {
  pixels: PixelXY[]; border: PixelXY[];
  borderSet: Set<string>; pixelSet: Set<string>;
  vertRuns: VertRun[]; side: Side; _origSide: Side;
}

export interface ManualFillRegion {
  pixelSet: Set<string>; pixels: BakedPixel[];
  pixelsFlipped: BakedPixel[]; side: Side;
}

export interface BakedFloatRegion {
  motif: MotifResult; pixelSet: Set<string>;
  pixels: BakedPixel[]; pixelsFlipped: BakedPixel[];
  isFillTool: boolean; side: Side;
}

export interface EngineSnapshot {
  processedImage: ImageData | null; motifOnlyImage: ImageData | null;
  erasedSet: Set<string>; manualFillRegions: ManualFillRegion[];
  bakedFloatRegions: Omit<BakedFloatRegion, 'motif'> & { motifIdx: number }[];
  motifSides: Side[]; penEdits: Map<string, { r: number; g: number; b: number }>;
}

export interface ProjectFileMFR {
  pixelSet: string[]; pixels: BakedPixel[]; pixelsFlipped: BakedPixel[]; side: Side;
}

export interface ProjectFileBFR {
  motifIdx: number; pixelSet: string[]; pixels: BakedPixel[];
  pixelsFlipped: BakedPixel[]; isFillTool: boolean; side: Side;
}

export interface ProjectSettings {
  fillMode: FillMode; vBorderLen: number; use8: boolean;
  bndSkip: boolean; bndSkipPx: number; vertFloat: boolean; vertFloatLen: number;
  highlightLen: number; highlightActive: boolean; highlightColor: string; penColorHex: string;
}

export interface ProjectFile {
  version: 1; image: string; erasedSet: string[]; motifSides: Side[];
  manualFillRegions: ProjectFileMFR[]; bakedFloatRegions: ProjectFileBFR[];
  penEdits: [string, { r: number; g: number; b: number }][]; settings: ProjectSettings;
}

export interface ElectronAPI {
  requestBitmaps: () => void;
  onBitmapsUpdated: (cb: (data: { motif: BitmapItem[]; fill: BitmapItem[] }) => void) => () => void;
  saveBmp: (fileName: string, buffer: ArrayBuffer) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveFile: (fileName: string, buffer: ArrayBuffer) => Promise<{ success: boolean; path?: string; error?: string }>;
  showSaveDialog: (defaultName: string) => Promise<{ canceled: boolean; filePath?: string }>;
  showSaveDialogFormat: (defaultName: string, format: 'png' | 'tiff' | 'maf') => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenProjectDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
  saveProject: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>;
  loadProject: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
}

declare global {
  interface Window { electronAPI?: ElectronAPI; }
}
