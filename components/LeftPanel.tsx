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
    <div style={{ position:'relative', width:'100%', userSelect:'none' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
          background:'var(--input-bg)', border:`1px solid ${open ? 'var(--gold)' : 'var(--border)'}`,
          borderRadius:6, cursor:'pointer', transition:'border-color .12s',
        }}
      >
        {sel
          ? <img src={sel.dataUrl} alt="" style={{ width:26, height:26, imageRendering:'pixelated', borderRadius:3, border:'1px solid var(--border)', flexShrink:0 }} />
          : <div style={{ width:26, height:26, borderRadius:3, border:'1px solid var(--border)', background:'var(--background)', flexShrink:0,
              backgroundImage:'repeating-linear-gradient(45deg,var(--border) 0,var(--border) 1px,transparent 0,transparent 50%)', backgroundSize:'4px 4px' }} />
        }
        <span style={{ flex:1, textAlign:'left', fontSize:12, fontWeight:600, color:'var(--foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {sel ? sel.name : label}
        </span>
        <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={() => setOpen(false)} />
          <div style={{
            position:'absolute', left:0, top:'calc(100% + 2px)', zIndex:50, width:'100%',
            background:'var(--card)', border:'1px solid var(--border)', borderRadius:7,
            boxShadow:'0 4px 20px rgba(0,0,0,.25)', maxHeight:240, overflowY:'auto',
          }}>
            <div onClick={() => { onSelect(-1); setOpen(false); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', fontSize:12, color:'var(--text-tertiary)', fontStyle:'italic' }}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--panel)')}
              onMouseLeave={e=>(e.currentTarget.style.background='')}
            >— None —</div>
            {items.map((item, idx) => (
              <div key={idx} onClick={() => { onSelect(idx); setOpen(false); }}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'6px 12px', cursor:'pointer', fontSize:12,
                  background: idx === selectedIdx ? 'var(--panel)' : undefined,
                }}
                onMouseEnter={e=>{ if(idx!==selectedIdx) e.currentTarget.style.background='var(--panel)'; }}
                onMouseLeave={e=>{ if(idx!==selectedIdx) e.currentTarget.style.background=''; }}
              >
                <img src={item.dataUrl} alt="" style={{ width:28, height:28, imageRendering:'pixelated', border:'1px solid var(--border)', borderRadius:3, flexShrink:0 }} />
                <span style={{ color:'var(--foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-tertiary)' }}>No bitmaps in folder</div>
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

  const Num = (v: number, cb: (n:number)=>void, min=1, max=9999) => (
    <input type="number" value={v} min={min} max={max}
      onChange={e => cb(Math.max(min, Math.min(max, +e.target.value)))}
      style={{ width:56, height:28, fontSize:12, fontFamily:'monospace', fontWeight:700,
        textAlign:'center', background:'var(--input-bg)', border:'1px solid var(--border)',
        borderRadius:4, color:'var(--foreground)', outline:'none', padding:'0 2px' }}
    />
  );

  const Chk = ({ checked, onChange, label }:{checked:boolean; onChange:(v:boolean)=>void; label:string}) => (
    <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13, fontWeight:500, color:'var(--foreground)' }}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}
        style={{ width:14, height:14, accentColor:'var(--gold)', cursor:'pointer', flexShrink:0 }} />
      {label}
    </label>
  );

  const SecHead = ({ text }: { text: string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:6, margin:'2px 0 8px' }}>
      <div style={{ height:1, flex:1, background:'var(--panel-border)' }} />
      <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:800, letterSpacing:'0.16em',
        textTransform:'uppercase', color:'var(--gold-dim)', flexShrink:0 }}>
        {text}
      </span>
      <div style={{ height:1, flex:1, background:'var(--panel-border)' }} />
    </div>
  );

  const Lbl = ({ text }: { text: string }) => (
    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{text}</span>
  );

  const Row = ({ children, between=false }: { children: React.ReactNode; between?: boolean }) => (
    <div style={{ display:'flex', alignItems:'center', gap:7, justifyContent: between ? 'space-between' : undefined }}>
      {children}
    </div>
  );

  const Div = () => <div style={{ height:1, background:'var(--panel-border)', margin:'7px 0' }} />;

  return (
    <div style={{
      width:270, minWidth:270, display:'flex', flexDirection:'column', overflowY:'auto',
      borderRight:'1px solid var(--panel-border)', padding:'8px 10px', gap:0,
      background:'var(--panel)',
    }}>

      {/* ── Upload ── */}
      <div style={{ paddingBottom:10, marginBottom:6, borderBottom:'1px solid var(--panel-border)' }}>
        <button onClick={() => uploadRef.current?.click()}
          style={{
            width:'100%', height:40, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            background:'var(--gold)', border:'none', borderRadius:7, cursor:'pointer',
            fontFamily:'monospace', fontWeight:800, fontSize:13, letterSpacing:'0.08em',
            color:'#0e0c08', transition:'opacity .12s', boxShadow:'0 1px 4px rgba(0,0,0,.2)',
          }}
          onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}
        >
          <Upload size={15} /> Upload Image
        </button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f=e.target.files?.[0]; if(f){onImageUpload(f); e.target.value='';} }} />
      </div>

      {/* ── Bitmap Library (no header) ── */}
      <div style={{ paddingBottom:10, marginBottom:6, borderBottom:'1px solid var(--panel-border)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <Lbl text="Motif Weave" />
            <ThumbSelect label="— Select —" items={motifBitmaps} selectedIdx={motifBitmapIdx} onSelect={onMotifBitmapSelect} />
          </div>
          <Div />
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <Lbl text="Fill Tool Weave" />
            <ThumbSelect label="— Select —" items={fillBitmaps} selectedIdx={fillBitmapIdx} onSelect={onFillBitmapSelect} />
          </div>
        </div>
      </div>

      {/* ── Fill (no header) ── */}
      <div style={{ paddingBottom:10, marginBottom:6, borderBottom:'1px solid var(--panel-border)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <select value={fillMode} onChange={e=>onFillModeChange(e.target.value as FillMode)}
            style={{ width:'100%', height:30, fontSize:12, padding:'0 8px', borderRadius:5,
              background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--foreground)',
              outline:'none', cursor:'pointer', fontFamily:'monospace', fontWeight:600 }}>
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
            <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'monospace' }}>{floatCountText}</div>
          )}
        </div>
      </div>

      {/* ── Tools ── */}
      <div style={{ paddingBottom:10, marginBottom:6, borderBottom:'1px solid var(--panel-border)' }}>
        <SecHead text="Tools" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {TOOLS.map(({ key, icon, label, title }) => {
            const active = activeTool === key;
            return (
              <button key={key} onClick={() => onToolChange(key)} title={title}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:4, padding:'8px 4px', minHeight:54, borderRadius:7, cursor:'pointer',
                  border:`1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                  background: active
                    ? 'linear-gradient(135deg,#2a1e0a,#1e1508)'
                    : 'var(--input-bg)',
                  boxShadow: active ? 'inset 0 1px 4px rgba(0,0,0,.4), 0 0 0 1px var(--gold-dim)' : 'none',
                  transition:'all .12s',
                  color: active ? 'var(--gold)' : 'var(--text-secondary)',
                }}
              >
                {icon}
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase',
                  color: active ? 'var(--gold)' : 'var(--text-tertiary)' }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pen Color ── */}
      <div style={{ paddingBottom:10, marginBottom:6, borderBottom:'1px solid var(--panel-border)' }}>
        <SecHead text="Pen Color" />
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:30, height:30, borderRadius:5, background:penColorHex, border:'1px solid var(--border)', flexShrink:0 }} />
          <input type="color" value={penColorHex} onChange={e=>onPenColorChange(e.target.value)}
            style={{ width:36, height:28, padding:0, border:0, background:'transparent', cursor:'pointer', outline:'none' }} title="Pick pen color" />
          <span style={{ fontSize:11, color:'var(--text-tertiary)', fontFamily:'monospace', letterSpacing:'0.06em' }}>{penColorHex}</span>
        </div>
      </div>

      {/* ── Highlight Float ── */}
      <div style={{ paddingBottom:10 }}>
        <SecHead text="Highlight Float" />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <Row between><Chk checked={highlightActive} onChange={onHighlightChange} label="Show" />{Num(highlightLen, onHighlightLenChange, 1, 9999)}</Row>
          <Row>
            <Lbl text="Color" />
            <input type="color" value={highlightColor} onChange={e=>onHighlightColorChange(e.target.value)}
              style={{ width:36, height:26, padding:0, border:0, background:'transparent', cursor:'pointer', outline:'none' }} />
            <span style={{ fontSize:11, color:'var(--text-tertiary)', fontFamily:'monospace' }}>{highlightColor}</span>
          </Row>
        </div>
      </div>
    </div>
  );
}
