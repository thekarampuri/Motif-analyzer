'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Tool, FillMode, BitmapItem } from '@/lib/types';

interface LeftPanelProps {
  motifBitmaps: BitmapItem[];
  fillBitmaps: BitmapItem[];
  motifBitmapIdx: number;
  fillBitmapIdx: number;
  onMotifBitmapSelect: (idx: number) => void;
  onFillBitmapSelect:  (idx: number) => void;
  onImageUpload: (file: File) => void;
  fillMode: FillMode;
  onFillModeChange: (v: FillMode) => void;
  vBorderLen: number;
  onVBorderLenChange: (v: number) => void;
  use8: boolean;
  onUse8Change: (v: boolean) => void;
  bndSkip: boolean;
  onBndSkipChange: (v: boolean) => void;
  bndSkipPx: number;
  onBndSkipPxChange: (v: number) => void;
  vertFloat: boolean;
  onVertFloatChange: (v: boolean) => void;
  vertFloatLen: number;
  onVertFloatLenChange: (v: number) => void;
  highlightActive: boolean;
  onHighlightChange: (v: boolean) => void;
  highlightLen: number;
  onHighlightLenChange: (v: number) => void;
  highlightColor: string;
  onHighlightColorChange: (v: string) => void;
  activeTool: Tool;
  onToolChange: (t: Tool) => void;
  penColorHex: string;
  onPenColorChange: (hex: string) => void;
  floatCountText: string;
}

const TOOLS: { key: Tool; label: string; title: string }[] = [
  { key: 'move',     label: '✥ Move',   title: 'Drag to pan canvas' },
  { key: 'switch',   label: '⇄ Switch', title: 'Switch fill L↔R' },
  { key: 'erase',    label: '✕ Erase',  title: 'Click motif to erase • Right-click restore' },
  { key: 'polyline', label: '⬡ Lasso',  title: 'Draw freehand lasso to erase area' },
  { key: 'fill',     label: '▦ Fill',   title: 'Flood-fill with selected bitmap' },
  { key: 'pen',      label: '✏ Pen',    title: 'Left: paint • Right: remove' },
];

function ThumbSelect({
  label,
  items,
  selectedIdx,
  onSelect,
}: {
  label: string;
  items: BitmapItem[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = items[selectedIdx];

  return (
    <div className="relative w-full select-none">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 border border-border rounded-md text-foreground hover:border-gold transition-colors"
        style={{ background: 'var(--input-bg)', fontSize: 11 }}
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <img src={selected.dataUrl} alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated', borderRadius: 2, border: '1px solid var(--border)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 22, height: 22, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 2, flexShrink: 0 }} />
        )}
        <span className="flex-1 text-left truncate" style={{ color: 'var(--foreground)', fontWeight: 500 }}>
          {selected ? selected.name : label}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-0.5 z-50 border border-border rounded-md shadow-lg overflow-y-auto" style={{ background: 'var(--card)', maxHeight: 240, minWidth: 180, width: '100%' }}>
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-panel text-xs italic"
              style={{ color: 'var(--text-tertiary)', fontSize: 11 }}
              onClick={() => { onSelect(-1); setOpen(false); }}
            >
              — None —
            </div>
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-panel"
                style={{ background: idx === selectedIdx ? 'var(--panel)' : undefined, fontSize: 11 }}
                onClick={() => { onSelect(idx); setOpen(false); }}
              >
                <img src={item.dataUrl} alt="" style={{ width: 26, height: 26, imageRendering: 'pixelated', border: '1px solid var(--border)', borderRadius: 2, flexShrink: 0 }} />
                <span className="truncate" style={{ color: 'var(--foreground)' }}>{item.name}</span>
              </div>
            ))}
            {items.length === 0 && (
              <div className="px-3 py-2" style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                No bitmaps in folder
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function LeftPanel({
  motifBitmaps, fillBitmaps, motifBitmapIdx, fillBitmapIdx,
  onMotifBitmapSelect, onFillBitmapSelect,
  onImageUpload,
  fillMode, onFillModeChange,
  vBorderLen, onVBorderLenChange,
  use8, onUse8Change,
  bndSkip, onBndSkipChange,
  bndSkipPx, onBndSkipPxChange,
  vertFloat, onVertFloatChange,
  vertFloatLen, onVertFloatLenChange,
  highlightActive, onHighlightChange,
  highlightLen, onHighlightLenChange,
  highlightColor, onHighlightColorChange,
  activeTool, onToolChange,
  penColorHex, onPenColorChange,
  floatCountText,
}: LeftPanelProps) {
  const mainUploadRef = useRef<HTMLInputElement>(null);

  const handleMainUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { onImageUpload(file); e.target.value = ''; }
  };

  const numInput = (v: number, onChange: (n: number) => void, min = 1, max = 9999) => (
    <input
      type="number"
      value={v}
      min={min} max={max}
      onChange={e => onChange(Math.max(min, Math.min(max, +e.target.value)))}
      className="font-mono text-center border border-border rounded text-foreground outline-none"
      style={{ width: 46, height: 26, fontSize: 11, padding: '0 2px', background: 'var(--input-bg)' }}
    />
  );

  const SectionTitle = ({ text }: { text: string }) => (
    <span className="font-mono font-bold tracking-widest uppercase" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.12em' }}>
      {text}
    </span>
  );

  const Label = ({ text }: { text: string }) => (
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{text}</span>
  );

  const CheckRow = ({ checked, onChange, text }: { checked: boolean; onChange: (v: boolean) => void; text: string }) => (
    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground)' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="cursor-pointer flex-shrink-0"
        style={{ width: 13, height: 13, accentColor: 'var(--gold)' }}
      />
      {text}
    </label>
  );

  const Divider = () => <hr style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '4px 0' }} />;

  return (
    <div
      className="flex flex-col gap-0 overflow-y-auto border-r"
      style={{ width: 200, minWidth: 200, background: 'var(--panel)', borderColor: 'var(--panel-border)', padding: '4px 8px' }}
    >
      {/* ── Image upload ── */}
      <div className="py-2 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <button
          onClick={() => mainUploadRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border border-border rounded cursor-pointer"
          style={{
            height: 32, background: 'var(--input-bg)', color: 'var(--foreground)',
            fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
          }}
        >
          <Upload size={13} />
          Upload Image
        </button>
        <input ref={mainUploadRef} type="file" accept="image/*" onChange={handleMainUpload} className="hidden" />
      </div>

      {/* ── Bitmap Library ── */}
      <div className="flex flex-col gap-2 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <SectionTitle text="Bitmap Library" />

        <div className="flex flex-col gap-1">
          <Label text="Motif Weave" />
          <ThumbSelect label="— Select —" items={motifBitmaps} selectedIdx={motifBitmapIdx} onSelect={onMotifBitmapSelect} />
        </div>

        <Divider />

        <div className="flex flex-col gap-1">
          <Label text="Fill Tool Weave" />
          <ThumbSelect label="— Select —" items={fillBitmaps} selectedIdx={fillBitmapIdx} onSelect={onFillBitmapSelect} />
        </div>

        <p style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
          Drop images in C:\MotifAnalyzer\MotifWeave\ or FillToolWeave\
        </p>
      </div>

      {/* ── Fill settings ── */}
      <div className="flex flex-col gap-2 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <SectionTitle text="Fill" />

        <select
          value={fillMode}
          onChange={e => onFillModeChange(e.target.value as FillMode)}
          className="border border-border rounded text-foreground outline-none cursor-pointer"
          style={{ width: '100%', height: 26, fontSize: 11, padding: '0 4px', background: 'var(--input-bg)' }}
        >
          <option value="WHOLE">Whole</option>
          <option value="INNER">Inside</option>
          <option value="BORDER">Border</option>
          <option value="BORDER8">Vert Border ≥</option>
          <option value="INNER_BORDER8">Inside + Vert</option>
        </select>

        <div className="flex items-center justify-between">
          <Label text="Border Len" />
          {numInput(vBorderLen, onVBorderLenChange, 1, 999)}
        </div>

        <CheckRow checked={use8} onChange={onUse8Change} text="8-Connected" />

        <Divider />

        <div className="flex items-center justify-between">
          <CheckRow checked={bndSkip} onChange={onBndSkipChange} text="Bnd Skip" />
          {numInput(bndSkipPx, onBndSkipPxChange, 0, 99)}
        </div>

        <Divider />

        <div className="flex items-center justify-between">
          <CheckRow checked={vertFloat} onChange={onVertFloatChange} text="Float Fill" />
          {numInput(vertFloatLen, onVertFloatLenChange, 1, 9999)}
        </div>

        {floatCountText && (
          <p style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
            {floatCountText}
          </p>
        )}
      </div>

      {/* ── Tools ── */}
      <div className="flex flex-col gap-2 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <SectionTitle text="Tools" />
        <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {TOOLS.map(({ key, label, title }) => {
            const active = activeTool === key;
            return (
              <button
                key={key}
                onClick={() => onToolChange(key)}
                title={title}
                className="flex items-center justify-center font-mono"
                style={{
                  padding: '5px 4px',
                  minHeight: 32,
                  fontSize: 10,
                  borderRadius: 5,
                  border: '1px solid',
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  transition: 'background .12s, border-color .12s',
                  background:   active ? '#3a3530' : 'var(--input-bg)',
                  borderColor:  active ? '#2a2520' : 'var(--border)',
                  color:        active ? '#fff'    : 'var(--foreground)',
                  boxShadow:    active ? 'inset 0 1px 3px rgba(0,0,0,.3)' : 'none',
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pen Color ── */}
      <div className="flex flex-col gap-2 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <SectionTitle text="Pen Color" />
        <div className="flex items-center gap-2">
          <div style={{ width: 24, height: 24, borderRadius: 4, background: penColorHex, border: '1px solid var(--border)', flexShrink: 0 }} />
          <input
            type="color"
            value={penColorHex}
            onChange={e => onPenColorChange(e.target.value)}
            className="cursor-pointer border-0 outline-none bg-transparent"
            style={{ width: 32, height: 24, padding: 0 }}
            title="Pick pen color"
          />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>{penColorHex}</span>
        </div>
      </div>

      {/* ── Highlight Float ── */}
      <div className="flex flex-col gap-2 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <SectionTitle text="Highlight Float" />
        <div className="flex items-center justify-between">
          <CheckRow checked={highlightActive} onChange={onHighlightChange} text="Show" />
          {numInput(highlightLen, onHighlightLenChange, 1, 9999)}
        </div>
        <div className="flex items-center gap-2">
          <Label text="Color" />
          <input
            type="color"
            value={highlightColor}
            onChange={e => onHighlightColorChange(e.target.value)}
            className="cursor-pointer border-0 outline-none bg-transparent"
            style={{ width: 32, height: 24, padding: 0 }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>{highlightColor}</span>
        </div>
      </div>

    </div>
  );
}
