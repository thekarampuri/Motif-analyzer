'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
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

const TOOLS: { key: Tool; label: string; icon: string; title: string }[] = [
  { key:'move',     icon:'✥', label:'Move',    title:'Drag to pan canvas' },
  { key:'switch',   icon:'⇄', label:'Switch',  title:'Switch fill L↔R' },
  { key:'erase',    icon:'✕', label:'Erase',   title:'Click motif to erase • Right-click restore' },
  { key:'polyline', icon:'⬡', label:'Lasso',   title:'Draw freehand lasso to erase area' },
  { key:'fill',     icon:'▦', label:'Fill',    title:'Flood-fill with selected bitmap' },
  { key:'pen',      icon:'✏', label:'Pen',     title:'Left: paint • Right: remove' },
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
          width:'100%', display:'flex', alignItems:'center', gap:7, padding:'5px 8px',
          background:'var(--input-bg)', border:`1px solid ${open ? 'var(--gold)' : 'var(--border)'}`,
          borderRadius:6, cursor:'pointer', transition:'border-color .12s',
        }}
      >
        {sel
          ? <img src={sel.dataUrl} alt="" style={{ width:20, height:20, imageRendering:'pixelated', borderRadius:2, border:'1px solid var(--border)', flexShrink:0 }} />
          : <div style={{ width:20, height:20, borderRadius:2, border:'1px solid var(--border)', background:'var(--background)', flexShrink:0,
              backgroundImage:'repeating-linear-gradient(45deg,var(--border) 0,var(--border) 1px,transparent 0,transparent 50%)', backgroundSize:'4px 4px' }} />
        }
        <span style={{ flex:1, textAlign:'left', fontSize:10, fontWeight:600, color:'var(--foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {sel ? sel.name : label}
        </span>
        <span style={{ fontSize:8, color:'var(--text-tertiary)' }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={() => setOpen(false)} />
          <div style={{
            position:'absolute', left:0, top:'calc(100% + 2px)', zIndex:50, width:'100%',
            background:'var(--card)', border:'1px solid var(--border)', borderRadius:7,
            boxShadow:'0 4px 20px rgba(0,0,0,.25)', maxHeight:220, overflowY:'auto',
          }}>
            <div onClick={() => { onSelect(-1); setOpen(false); }}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', cursor:'pointer', fontSize:10, color:'var(--text-tertiary)', fontStyle:'italic' }}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--panel)')}
              onMouseLeave={e=>(e.currentTarget.style.background='')}
            >— None —</div>
            {items.map((item, idx) => (
              <div key={idx} onClick={() => { onSelect(idx); setOpen(false); }}
                style={{
                  display:'flex', alignItems:'center', gap:8, padding:'5px 10px', cursor:'pointer', fontSize:10,
                  background: idx === selectedIdx ? 'var(--panel)' : undefined,
                }}
                onMouseEnter={e=>{ if(idx!==selectedIdx) e.currentTarget.style.background='var(--panel)'; }}
                onMouseLeave={e=>{ if(idx!==selectedIdx) e.currentTarget.style.background=''; }}
              >
                <img src={item.dataUrl} alt="" style={{ width:24, height:24, imageRendering:'pixelated', border:'1px solid var(--border)', borderRadius:3, flexShrink:0 }} />
                <span style={{ color:'var(--foreground)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ padding:'10px 12px', fontSize:10, color:'var(--text-tertiary)' }}>No bitmaps in folder</div>
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
      style={{ width:46, height:24, fontSize:10, fontFamily:'monospace', fontWeight:700,
        textAlign:'center', background:'var(--input-bg)', border:'1px solid var(--border)',
        borderRadius:4, color:'var(--foreground)', outline:'none', padding:'0 2px' }}
    />
  );

  const Chk = ({ checked, onChange, label }:{checked:boolean; onChange:(v:boolean)=>void; label:string}) => (
    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, fontWeight:500, color:'var(--foreground)' }}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}
        style={{ width:12, height:12, accentColor:'var(--gold)', cursor:'pointer', flexShrink:0 }} />
      {label}
    </label>
  );

  /* Section header with decorative rule */
  const SecHead = ({ text }: { text: string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:6, margin:'2px 0 6px' }}>
      <div style={{ height:1, flex:1, background:'var(--panel-border)' }} />
      <span style={{ fontSize:8, fontFamily:'monospace', fontWeight:800, letterSpacing:'0.16em',
        textTransform:'uppercase', color:'var(--gold-dim)', flexShrink:0 }}>
        {text}
      </span>
      <div style={{ height:1, flex:1, background:'var(--panel-border)' }} />
    </div>
  );

  const Lbl = ({ text }: { text: string }) => (
    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{text}</span>
  );

  const Row = ({ children, between=false }: { children: React.ReactNode; between?: boolean }) => (
    <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent: between ? 'space-between' : undefined }}>
      {children}
    </div>
  );

  const Div = () => <div style={{ height:1, background:'var(--panel-border)', margin:'6px 0' }} />;

  const panelBg: React.CSSProperties = {
    background: 'var(--panel)',
    backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,var(--weave-line) 3px,var(--weave-line) 4px),repeating-linear-gradient(90deg,transparent,transparent 3px,var(--weave-line) 3px,var(--weave-line) 4px)',
  };

  return (
    <div style={{
      width:206, minWidth:206, display:'flex', flexDirection:'column', overflowY:'auto',
      borderRight:'1px solid var(--panel-border)', padding:'6px 8px', gap:0,
      ...panelBg,
    }}>

      {/* ── Upload ── */}
      <div style={{ paddingBottom:8, marginBottom:4, borderBottom:'1px solid var(--panel-border)' }}>
        <button onClick={() => uploadRef.current?.click()}
          style={{
            width:'100%', height:34, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            background:'var(--gold)', border:'none', borderRadius:6, cursor:'pointer',
            fontFamily:'monospace', fontWeight:800, fontSize:11, letterSpacing:'0.08em',
            color:'#0e0c08', transition:'opacity .12s', boxShadow:'0 1px 4px rgba(0,0,0,.2)',
          }}
          onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}
        >
          <Upload size={13} /> Upload Image
        </button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f=e.target.files?.[0]; if(f){onImageUpload(f); e.target.value='';} }} />
      </div>

      {/* ── Bitmap Library ── */}
      <div style={{ paddingBottom:8, marginBottom:4, borderBottom:'1px solid var(--panel-border)' }}>
        <SecHead text="Bitmap Library" />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <Lbl text="Motif Weave" />
            <ThumbSelect label="— Select —" items={motifBitmaps} selectedIdx={motifBitmapIdx} onSelect={onMotifBitmapSelect} />
          </div>
          <Div />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <Lbl text="Fill Tool Weave" />
            <ThumbSelect label="— Select —" items={fillBitmaps} selectedIdx={fillBitmapIdx} onSelect={onFillBitmapSelect} />
          </div>
          <div style={{ fontSize:8, color:'var(--text-tertiary)', fontFamily:'monospace', lineHeight:1.5 }}>
            Drop images into:<br/>C:\MotifAnalyzer\MotifWeave\<br/>C:\MotifAnalyzer\FillToolWeave\
          </div>
        </div>
      </div>

      {/* ── Fill ── */}
      <div style={{ paddingBottom:8, marginBottom:4, borderBottom:'1px solid var(--panel-border)' }}>
        <SecHead text="Fill" />
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <select value={fillMode} onChange={e=>onFillModeChange(e.target.value as FillMode)}
            style={{ width:'100%', height:26, fontSize:10, padding:'0 6px', borderRadius:5,
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
            <div style={{ fontSize:9, color:'var(--text-secondary)', fontFamily:'monospace' }}>{floatCountText}</div>
          )}
        </div>
      </div>

      {/* ── Tools ── */}
      <div style={{ paddingBottom:8, marginBottom:4, borderBottom:'1px solid var(--panel-border)' }}>
        <SecHead text="Tools" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {TOOLS.map(({ key, icon, label, title }) => {
            const active = activeTool === key;
            return (
              <button key={key} onClick={() => onToolChange(key)} title={title}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:3, padding:'7px 4px', minHeight:46, borderRadius:7, cursor:'pointer',
                  border:`1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                  background: active
                    ? 'linear-gradient(135deg,#2a1e0a,#1e1508)'
                    : 'var(--input-bg)',
                  boxShadow: active ? 'inset 0 1px 4px rgba(0,0,0,.4), 0 0 0 1px var(--gold-dim)' : 'none',
                  transition:'all .12s',
                  fontFamily:'monospace',
                }}
              >
                <span style={{ fontSize:16, lineHeight:1, color: active ? 'var(--gold)' : 'var(--text-secondary)' }}>{icon}</span>
                <span style={{ fontSize:8, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase',
                  color: active ? 'var(--gold)' : 'var(--text-tertiary)' }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pen Color ── */}
      <div style={{ paddingBottom:8, marginBottom:4, borderBottom:'1px solid var(--panel-border)' }}>
        <SecHead text="Pen Color" />
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:5, background:penColorHex, border:'1px solid var(--border)', flexShrink:0 }} />
          <input type="color" value={penColorHex} onChange={e=>onPenColorChange(e.target.value)}
            style={{ width:32, height:26, padding:0, border:0, background:'transparent', cursor:'pointer', outline:'none' }} title="Pick pen color" />
          <span style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:'monospace', letterSpacing:'0.06em' }}>{penColorHex}</span>
        </div>
      </div>

      {/* ── Highlight Float ── */}
      <div style={{ paddingBottom:8 }}>
        <SecHead text="Highlight Float" />
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <Row between><Chk checked={highlightActive} onChange={onHighlightChange} label="Show" />{Num(highlightLen, onHighlightLenChange, 1, 9999)}</Row>
          <Row>
            <Lbl text="Color" />
            <input type="color" value={highlightColor} onChange={e=>onHighlightColorChange(e.target.value)}
              style={{ width:32, height:22, padding:0, border:0, background:'transparent', cursor:'pointer', outline:'none' }} />
            <span style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:'monospace' }}>{highlightColor}</span>
          </Row>
        </div>
      </div>
    </div>
  );
}
