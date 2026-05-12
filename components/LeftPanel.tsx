'use client';
import { useRef, useState } from 'react';
import { Upload, Move, ArrowLeftRight, Eraser, Lasso, PaintBucket, Pen } from 'lucide-react';
import type { Tool, FillMode, BitmapItem } from '@/lib/types';

interface LeftPanelProps {
  motifBitmaps: BitmapItem[]; fillBitmaps: BitmapItem[];
  motifBitmapIdx: number; fillBitmapIdx: number;
  onMotifBitmapSelect: (idx: number) => void;
  onFillBitmapSelect:  (idx: number) => void;
  onImageUpload: (file: File) => void;
  fillMode: FillMode; onFillModeChange: (v: FillMode) => void;
  vBorderLen: number; onVBorderLenChange: (v: number) => void;
  use8: boolean; onUse8Change: (v: boolean) => void;
  bndSkip: boolean; onBndSkipChange: (v: boolean) => void;
  bndSkipPx: number; onBndSkipPxChange: (v: number) => void;
  vertFloat: boolean; onVertFloatChange: (v: boolean) => void;
  vertFloatLen: number; onVertFloatLenChange: (v: number) => void;
  highlightActive: boolean; onHighlightChange: (v: boolean) => void;
  highlightLen: number; onHighlightLenChange: (v: number) => void;
  highlightColor: string; onHighlightColorChange: (v: string) => void;
  activeTool: Tool; onToolChange: (t: Tool) => void;
  penColorHex: string; onPenColorChange: (hex: string) => void;
  floatCountText: string;
}

const TOOLS: { key: Tool; icon: React.ReactNode; label: string; title: string }[] = [
  { key:'move',     icon:<Move size={18}/>,           label:'Move',    title:'Drag to pan canvas' },
  { key:'switch',   icon:<ArrowLeftRight size={18}/>, label:'Switch',  title:'Switch fill L↔R' },
  { key:'erase',    icon:<Eraser size={18}/>,         label:'Erase',   title:'Click motif to erase • Right-click restore' },
  { key:'polyline', icon:<Lasso size={18}/>,          label:'Lasso',   title:'Draw freehand lasso to erase area' },
  { key:'fill',     icon:<PaintBucket size={18}/>,    label:'Fill',    title:'Flood-fill with selected bitmap' },
  { key:'pen',      icon:<Pen size={18}/>,            label:'Pen',     title:'Left: paint • Right: remove' },
];

function ThumbSelect({ label, items, selectedIdx, onSelect }:{
  label: string; items: BitmapItem[]; selectedIdx: number; onSelect:(i:number)=>void;
}) {
  const [open, setOpen] = useState(false);
  const sel = items[selectedIdx];
  return (
    <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 7px', height: 28,
          background: 'var(--input-bg)',
          border: `1px solid ${open ? '#bfb8b0' : 'var(--border)'}`,
          borderRadius: 4, cursor: 'pointer', transition: 'border-color .12s',
        }}
      >
        {sel
          ? <img src={sel.dataUrl} alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated', borderRadius: 2, border: '1px solid var(--border)', flexShrink: 0 }} />
          : <div style={{ width: 22, height: 22, borderRadius: 2, border: '1px solid var(--border)', background: 'var(--background)', flexShrink: 0,
              backgroundImage: 'repeating-linear-gradient(45deg,var(--border) 0,var(--border) 1px,transparent 0,transparent 50%)', backgroundSize: '4px 4px' }} />
        }
        <span style={{ flex: 1, textAlign: 'left', fontSize: 9, fontFamily: "'Inter', 'Segoe UI', sans-serif", color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sel ? sel.name : label}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', left: 0, top: 'calc(100% + 2px)', zIndex: 50, width: '100%',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5,
            boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto',
          }}>
            <div onClick={() => { onSelect(-1); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer',
                fontSize: 9, fontFamily: "'Inter', 'Segoe UI', sans-serif", color: 'var(--text-secondary)', fontStyle: 'italic' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >— None —</div>
            {items.map((item, idx) => (
              <div key={idx} onClick={() => { onSelect(idx); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer',
                  fontSize: 9, fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  background: idx === selectedIdx ? 'var(--panel)' : undefined,
                }}
                onMouseEnter={e => { if(idx !== selectedIdx) e.currentTarget.style.background = 'var(--panel)'; }}
                onMouseLeave={e => { if(idx !== selectedIdx) e.currentTarget.style.background = ''; }}
              >
                <img src={item.dataUrl} alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated', border: '1px solid var(--border)', borderRadius: 2, flexShrink: 0 }} />
                <span style={{ color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 9, color: 'var(--text-secondary)' }}>No bitmaps in folder</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function LeftPanel({
  motifBitmaps, fillBitmaps, motifBitmapIdx, fillBitmapIdx,
  onMotifBitmapSelect, onFillBitmapSelect, onImageUpload,
  fillMode, onFillModeChange, vBorderLen, onVBorderLenChange,
  use8, onUse8Change, bndSkip, onBndSkipChange, bndSkipPx, onBndSkipPxChange,
  vertFloat, onVertFloatChange, vertFloatLen, onVertFloatLenChange,
  highlightActive, onHighlightChange, highlightLen, onHighlightLenChange,
  highlightColor, onHighlightColorChange,
  activeTool, onToolChange, penColorHex, onPenColorChange, floatCountText,
}: LeftPanelProps) {
  const uploadRef = useRef<HTMLInputElement>(null);

  /* ── helpers ── */
  const Num = (v: number, cb: (n:number)=>void, min=1, max=9999) => (
    <input type="number" value={v} min={min} max={max}
      onChange={e => cb(Math.max(min, Math.min(max, +e.target.value)))}
      style={{
        width: 38, height: 22, fontSize: 9.5,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        textAlign: 'center', background: 'var(--input-bg)',
        border: '1px solid var(--border)', borderRadius: 3,
        color: 'var(--foreground)', outline: 'none', padding: '0 2px',
      }}
    />
  );

  const Chk = ({ checked, onChange, label }:{checked:boolean; onChange:(v:boolean)=>void; label:string}) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
      fontSize: 9, fontWeight: 600, color: 'var(--foreground)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 12, height: 12, accentColor: '#7a6a55', cursor: 'pointer', flexShrink: 0 }} />
      {label}
    </label>
  );

  /* sec-title style — matching HTML */
  const SecTitle = ({ text }: { text: string }) => (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      fontSize: 7, fontWeight: 700, letterSpacing: '1.5px',
      color: '#bbb0a0', textTransform: 'uppercase',
      marginBottom: 5, paddingTop: 2,
    }}>
      {text}
    </div>
  );

  /* flabel style */
  const Lbl = ({ text }: { text: string }) => (
    <span style={{
      fontSize: 9, fontWeight: 600, color: '#8a8078',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", whiteSpace: 'nowrap',
    }}>{text}</span>
  );

  const Row = ({ children, between=false }: { children: React.ReactNode; between?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: between ? 'space-between' : undefined }}>
      {children}
    </div>
  );

  /* section divider */
  const Sec = ({ children }: { children: React.ReactNode }) => (
    <div style={{ padding: '5px 0', borderBottom: '1px solid #e4dfd8' }}>
      {children}
    </div>
  );

  const Div = () => <div style={{ height: 1, background: '#e4dfd8', margin: '5px 0' }} />;

  return (
    <div style={{
      width: 240, minWidth: 240, display: 'flex', flexDirection: 'column',
      overflowY: 'auto', borderRight: '1px solid #ddd8d0',
      padding: '3px 5px', gap: 0,
      background: '#f5f2ee', fontSize: 11,
    }}>

      {/* ── Upload ── */}
      <Sec>
        <button onClick={() => uploadRef.current?.click()}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 4,
            cursor: 'pointer', fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            fontWeight: 600, fontSize: 9.5, letterSpacing: '0.04em',
            color: '#3a3530', height: 26, transition: 'opacity .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Upload size={13} /> Upload Image
        </button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if(f){ onImageUpload(f); e.target.value=''; } }} />
      </Sec>

      {/* ── Bitmap Library ── */}
      <Sec>
        <SecTitle text="Bitmap Library" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Lbl text="Motif Weave" />
            <ThumbSelect label="— Select —" items={motifBitmaps} selectedIdx={motifBitmapIdx} onSelect={onMotifBitmapSelect} />
          </div>
          <Div />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Lbl text="Fill Tool Weave" />
            <ThumbSelect label="— Select —" items={fillBitmaps} selectedIdx={fillBitmapIdx} onSelect={onFillBitmapSelect} />
          </div>
        </div>
      </Sec>

      {/* ── Fill ── */}
      <Sec>
        <SecTitle text="Fill" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select value={fillMode} onChange={e => onFillModeChange(e.target.value as FillMode)}
            style={{
              width: '100%', height: 22, fontSize: 9.5, padding: '0 6px', borderRadius: 3,
              background: 'var(--input-bg)', border: '1px solid var(--border)',
              color: 'var(--foreground)', outline: 'none', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            }}>
            <option value="WHOLE">Whole</option>
            <option value="INNER">Inside</option>
            <option value="BORDER">Border</option>
            <option value="BORDER8">Vert Border ≥</option>
            <option value="INNER_BORDER8">Inside + Vert</option>
          </select>
          <Row between><Lbl text="Border Len" />{Num(vBorderLen, onVBorderLenChange, 1, 999)}</Row>
          <Chk checked={use8} onChange={onUse8Change} label="8-Connected" />
          <Div />
          <Row between><Chk checked={bndSkip} onChange={onBndSkipChange} label="Bnd Skip" />{Num(bndSkipPx, onBndSkipPxChange, 0, 99)}</Row>
          <Div />
          <Row between><Chk checked={vertFloat} onChange={onVertFloatChange} label="Float Fill" />{Num(vertFloatLen, onVertFloatLenChange, 1, 9999)}</Row>
          {floatCountText && (
            <div style={{ fontSize: 9, color: '#8a8078', fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>{floatCountText}</div>
          )}
        </div>
      </Sec>

      {/* ── Tools ── */}
      <Sec>
        <SecTitle text="Tools" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {TOOLS.map(({ key, icon, label, title }) => {
            const active = activeTool === key;
            return (
              <button key={key} onClick={() => onToolChange(key)} title={title}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '6px 4px', minHeight: 26, borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${active ? '#2a2520' : '#d4cfc8'}`,
                  background: active ? '#3a3530' : '#eceae6',
                  boxShadow: active ? 'inset 0 1px 3px rgba(0,0,0,.35)' : 'none',
                  transition: 'all .12s',
                  color: active ? '#ffffff' : '#3a3530',
                }}
              >
                {/* Clone icon with color override */}
                <span style={{ color: active ? '#ffffff' : '#3a3530', display: 'flex' }}>
                  {icon}
                </span>
                <span style={{
                  fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                  color: active ? '#ffffff' : '#8a8078',
                }}>{label}</span>
              </button>
            );
          })}
        </div>
      </Sec>

      {/* ── Pen Color ── */}
      <Sec>
        <SecTitle text="Pen Color" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: 3, background: penColorHex, border: '1px solid var(--border)', flexShrink: 0 }} />
          <input type="color" value={penColorHex} onChange={e => onPenColorChange(e.target.value)}
            style={{ width: 30, height: 22, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', outline: 'none' }} title="Pick pen color" />
          <span style={{ fontSize: 9, color: '#8a8078', fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>{penColorHex}</span>
        </div>
      </Sec>

      {/* ── Highlight Float ── */}
      <div style={{ padding: '5px 0' }}>
        <SecTitle text="Highlight Float" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row between><Chk checked={highlightActive} onChange={onHighlightChange} label="Show" />{Num(highlightLen, onHighlightLenChange, 1, 9999)}</Row>
          <Row>
            <Lbl text="Color" />
            <input type="color" value={highlightColor} onChange={e => onHighlightColorChange(e.target.value)}
              style={{ width: 30, height: 22, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', outline: 'none' }} />
            <span style={{ fontSize: 9, color: '#8a8078', fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>{highlightColor}</span>
          </Row>
        </div>
      </div>
    </div>
  );
}
