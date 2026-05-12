'use client';
import { useEffect, useState } from 'react';
import { Undo2, Redo2, Download, Trash2, RotateCcw, Moon, Sun, Save, FolderOpen, ChevronDown } from 'lucide-react';
import type { StatusType } from '@/lib/types';

interface HeaderProps {
  statusMessage: string;
  statusType:    StatusType;
  phaseStatus:   string;
  onUndo:        () => void;
  onRedo:        () => void;
  onExport:      (fmt: 'bmp' | 'png' | 'tiff') => void;
  onClearFill:   () => void;
  onReset:       () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function Header({
  statusMessage, statusType, phaseStatus,
  onUndo, onRedo, onExport, onClearFill, onReset,
  onSaveProject, onLoadProject,
  canUndo, canRedo,
}: HeaderProps) {
  const [theme,   setTheme]   = useState<'light'|'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem('theme') || 'light') as 'light'|'dark';
    setTheme(saved); applyTheme(saved);
  }, []);

  function applyTheme(t: 'light'|'dark') {
    if (t === 'dark') document.documentElement.classList.add('dark');
    else              document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', t);
  }
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next); applyTheme(next);
  }

  if (!mounted) return null;

  const statusColor =
    statusType === 'ok'    ? 'var(--status-ok)'    :
    statusType === 'busy'  ? 'var(--status-busy)'  :
    statusType === 'error' ? 'var(--status-error)' : 'var(--text-secondary)';

  const S: React.CSSProperties = {
    display:'flex', alignItems:'center', gap:6, padding:'0 12px', height:34,
    fontSize:12, fontFamily:'monospace', fontWeight:700,
    border:'1px solid', borderRadius:6, cursor:'pointer',
    letterSpacing:'0.06em', whiteSpace:'nowrap', transition:'all .12s',
  };

  const Btn = ({ label, icon, onClick, variant='default', disabled=false, title }:{
    label:string; icon:React.ReactNode; onClick:()=>void;
    variant?:'default'|'warn'|'danger'|'accent'; disabled?:boolean; title?:string;
  }) => {
    const v: Record<string,React.CSSProperties> = {
      default: { background:'var(--input-bg)', borderColor:'var(--border)', color:'var(--foreground)' },
      warn:    { background:'#2a1e08', borderColor:'#6a4a18', color:'#d4a050' },
      danger:  { background:'#1e0a0a', borderColor:'#6a2020', color:'#d06060' },
      accent:  { background:'var(--gold)', borderColor:'var(--gold)', color:'#0e0c08' },
    };
    return (
      <button onClick={onClick} disabled={disabled} title={title}
        style={{ ...S, ...v[variant], opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {icon}{label}
      </button>
    );
  };

  const Sep = () => (
    <div style={{ width:1, alignSelf:'stretch', margin:'6px 2px', background:'var(--border)' }} />
  );

  return (
    <header style={{
      position:'fixed', top:0, left:0, right:0, zIndex:50, height:56,
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:6,
      padding:'0 16px',
      background:'var(--card)',
      borderBottom:'1px solid var(--border)',
      boxShadow:'0 1px 0 var(--border), 0 2px 8px rgba(0,0,0,.15)',
    }}>

      {/* Decorative thread accent line at very top */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        background:`repeating-linear-gradient(90deg, var(--gold) 0px, var(--gold) 6px, transparent 6px, transparent 12px)`,
        opacity: 0.6,
      }} />

      {/* ── Logo ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {/* Loom-inspired icon: woven grid */}
          <div style={{
            width:30, height:30, borderRadius:5, overflow:'hidden', flexShrink:0,
            backgroundImage:'repeating-linear-gradient(0deg,var(--gold),var(--gold) 2px,transparent 2px,transparent 6px),repeating-linear-gradient(90deg,var(--gold),var(--gold) 2px,transparent 2px,transparent 6px)',
            backgroundSize:'6px 6px', opacity:0.85,
            border:'1px solid var(--gold-dim)',
          }} />
          <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:15, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--foreground)' }}>
            Motif Analyzer
          </span>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div style={{ flex:1, overflow:'hidden', padding:'0 12px' }}>
        <div style={{
          fontFamily:'monospace', fontSize:12, letterSpacing:'0.04em',
          color: statusColor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>
          {phaseStatus || statusMessage}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>

        {/* Project */}
        <Btn label="Save" icon={<Save size={13}/>} onClick={onSaveProject} title="Save project (.maf)" />
        <Btn label="Open" icon={<FolderOpen size={13}/>} onClick={onLoadProject} title="Open project (.maf)" />

        <Sep />

        {/* History */}
        <Btn label="Undo" icon={<Undo2 size={13}/>} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
        <Btn label="Redo" icon={<Redo2 size={13}/>} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" />

        <Sep />

        {/* Export dropdown */}
        <div style={{ position:'relative' }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setExportOpen(false); }}>
          <button
            onClick={() => setExportOpen(o => !o)}
            style={{ ...S, background:'var(--input-bg)', borderColor: exportOpen ? 'var(--gold)' : 'var(--border)', color:'var(--foreground)', gap:4 }}
          >
            <Download size={13} />
            Export
            <ChevronDown size={12} style={{ opacity:0.6, marginLeft:1 }} />
          </button>
          {exportOpen && (
            <div style={{
              position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:100,
              background:'var(--card)', border:'1px solid var(--border)', borderRadius:7,
              boxShadow:'0 4px 20px rgba(0,0,0,.3)', minWidth:130, overflow:'hidden',
            }}>
              {(['bmp','png','tiff'] as const).map(fmt => (
                <button key={fmt} onClick={() => { onExport(fmt); setExportOpen(false); }}
                  style={{
                    display:'flex', alignItems:'center', gap:9, width:'100%',
                    padding:'9px 16px', background:'transparent', border:'none',
                    color:'var(--foreground)', cursor:'pointer', fontFamily:'monospace',
                    fontSize:12, fontWeight:600, letterSpacing:'0.06em', textAlign:'left',
                    transition:'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background='var(--panel)')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                >
                  <span style={{ fontSize:10, color:'var(--text-tertiary)', fontWeight:700, letterSpacing:'0.1em', background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:3, padding:'1px 6px' }}>{fmt.toUpperCase()}</span>
                  {fmt === 'bmp'  ? '8-bit BMP'    : fmt === 'png' ? 'PNG Image' : 'TIFF Image'}
                </button>
              ))}
            </div>
          )}
        </div>

        <Btn label="Clear" icon={<Trash2 size={13}/>} onClick={onClearFill} variant="warn"   title="Clear all fills" />
        <Btn label="Reset" icon={<RotateCcw size={13}/>} onClick={onReset}  variant="danger" title="Reset everything" />

        <Sep />

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          style={{ ...S, padding:'0 10px', background:'var(--input-bg)', borderColor:'var(--border)', color:'var(--gold)' }}>
          {theme === 'light' ? <Moon size={15}/> : <Sun size={15}/>}
        </button>
      </div>
    </header>
  );
}
