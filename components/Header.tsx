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

  /* abtn base style */
  const abtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', height: 26,
    fontSize: 9, fontFamily: "'JetBrains Mono', 'Consolas', monospace", fontWeight: 600,
    border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
    letterSpacing: '0.04em', whiteSpace: 'nowrap', transition: 'all .12s',
    background: 'var(--input-bg)', color: '#3a3530',
  };

  const Btn = ({ label, icon, onClick, variant='default', disabled=false, title }:{
    label:string; icon:React.ReactNode; onClick:()=>void;
    variant?:'default'|'warn'|'danger'|'theme'; disabled?:boolean; title?:string;
  }) => {
    const v: Record<string, React.CSSProperties> = {
      default: { background: 'var(--input-bg)', borderColor: 'var(--border)', color: '#3a3530' },
      warn:    { background: '#faf5e8', borderColor: '#d8b86a', color: '#7a5a18' },
      danger:  { background: '#faf0f0', borderColor: '#d8a0a0', color: '#7a2828' },
      theme:   { background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' },
    };
    return (
      <button onClick={onClick} disabled={disabled} title={title}
        style={{ ...abtn, ...v[variant], opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {icon}{label}
      </button>
    );
  };

  const Sep = () => (
    <div style={{ width: 1, alignSelf: 'stretch', margin: '5px 2px', background: 'var(--border)' }} />
  );

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 38,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      padding: '0 10px',
      background: '#ffffff',
      borderBottom: '1px solid #d8d2c8',
      boxShadow: '0 1px 4px rgba(0,0,0,.07)',
    }}>

      {/* ── Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ fontSize: 16, color: '#7a6a55', lineHeight: 1 }}>◈</span>
        <span style={{
          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
          fontWeight: 700, fontSize: 11,
          letterSpacing: '2px', color: '#3a3530',
        }}>
          Motif Analyzer
        </span>
      </div>

      {/* ── Phase / Status ── */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 12px' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
          fontSize: 9, color: '#a09080',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          ...(statusType !== 'idle' && statusType !== undefined
            ? { color: statusColor }
            : {}),
        }}>
          {phaseStatus || statusMessage}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>

        {/* Project */}
        <Btn label="Save" icon={<Save size={12}/>} onClick={onSaveProject} title="Save project (.maf)" />
        <Btn label="Open" icon={<FolderOpen size={12}/>} onClick={onLoadProject} title="Open project (.maf)" />

        <Sep />

        {/* History */}
        <Btn label="Undo" icon={<Undo2 size={12}/>} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
        <Btn label="Redo" icon={<Redo2 size={12}/>} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" />

        <Sep />

        {/* Export dropdown */}
        <div style={{ position: 'relative' }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setExportOpen(false); }}>
          <button
            onClick={() => setExportOpen(o => !o)}
            style={{ ...abtn, borderColor: exportOpen ? '#bfb8b0' : 'var(--border)', gap: 4 }}
          >
            <Download size={12} />
            Export
            <ChevronDown size={11} style={{ opacity: 0.6, marginLeft: 1 }} />
          </button>
          {exportOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
              background: '#ffffff', border: '1px solid var(--border)', borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,.15)', minWidth: 130, overflow: 'hidden',
            }}>
              {(['bmp','png','tiff'] as const).map(fmt => (
                <button key={fmt} onClick={() => { onExport(fmt); setExportOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                    padding: '8px 14px', background: 'transparent', border: 'none',
                    color: '#2c2a26', cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textAlign: 'left',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f2ee')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 9, color: '#8a8078', fontWeight: 700, letterSpacing: '0.1em',
                    background: '#eceae6', border: '1px solid #d4cfc8', borderRadius: 3, padding: '1px 5px' }}>
                    {fmt.toUpperCase()}
                  </span>
                  {fmt === 'bmp' ? '8-bit BMP' : fmt === 'png' ? 'PNG Image' : 'TIFF Image'}
                </button>
              ))}
            </div>
          )}
        </div>

        <Btn label="Clear Fill" icon={<Trash2 size={12}/>} onClick={onClearFill} variant="warn"   title="Clear all fills" />
        <Btn label="Reset"      icon={<RotateCcw size={12}/>} onClick={onReset}  variant="danger" title="Reset everything" />

        <Sep />

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          style={{ ...abtn, padding: '4px 8px' }}>
          {theme === 'light' ? <Moon size={12}/> : <Sun size={12}/>}
        </button>
      </div>
    </header>
  );
}
