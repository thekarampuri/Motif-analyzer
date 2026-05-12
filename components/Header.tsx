'use client';
import { useEffect, useState } from 'react';
import { Undo2, Redo2, Download, Trash2, RotateCcw, Moon, Sun } from 'lucide-react';
import type { StatusType } from '@/lib/types';

interface HeaderProps {
  statusMessage: string;
  statusType: StatusType;
  phaseStatus: string;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onClearFill: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function Header({
  statusMessage, statusType, phaseStatus,
  onUndo, onRedo, onExport, onClearFill, onReset,
  canUndo, canRedo,
}: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem('theme') || 'light') as 'light' | 'dark';
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function applyTheme(t: 'light' | 'dark') {
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', t);
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next); applyTheme(next);
  }

  if (!mounted) return null;

  const statusColor =
    statusType === 'ok'    ? 'var(--status-ok)' :
    statusType === 'busy'  ? 'var(--status-busy)' :
    statusType === 'error' ? 'var(--status-error)' :
    'var(--text-secondary)';

  const btn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    variant: 'default' | 'warn' | 'danger' | 'success' = 'default',
    disabled = false,
    title?: string
  ) => {
    const base: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '0 11px', height: 30, fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 600, border: '1px solid', borderRadius: 5, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1, transition: 'background .12s', whiteSpace: 'nowrap',
    };
    const styles: Record<string, React.CSSProperties> = {
      default: { background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' },
      warn:    { background: '#faf5e8', borderColor: '#d8b86a', color: '#7a5a18' },
      danger:  { background: '#faf0f0', borderColor: '#d8a0a0', color: '#7a2828' },
      success: { background: '#2c5c3c', borderColor: '#1e4a2c', color: '#d8f0e2' },
    };
    return (
      <button onClick={onClick} disabled={disabled} title={title} style={{ ...base, ...styles[variant] }}>
        {icon}
        {label}
      </button>
    );
  };

  const Sep = () => <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 3px' }} />;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 px-4 border-b border-border shadow-sm"
      style={{ height: 44, background: 'var(--card)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>◈</span>
        <span className="font-mono font-bold tracking-widest uppercase text-foreground" style={{ fontSize: 12 }}>Motif Analyzer</span>
      </div>

      {/* Status bar */}
      <div className="flex-1 overflow-hidden px-4">
        <div className="font-mono truncate" style={{ fontSize: 10, color: statusColor, letterSpacing: '.3px' }}>
          {phaseStatus || statusMessage}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 items-center flex-shrink-0">
        {btn('Undo', <Undo2 size={13} />, onUndo, 'default', !canUndo, 'Undo (Ctrl+Z)')}
        {btn('Redo', <Redo2 size={13} />, onRedo, 'default', !canRedo, 'Redo (Ctrl+Y)')}

        <Sep />

        {btn('Export', <Download size={13} />, onExport, 'default', false, 'Export as 8-bit BMP')}
        {btn('Clear Fill', <Trash2 size={13} />, onClearFill, 'warn', false, 'Clear all fills')}
        {btn('Reset', <RotateCcw size={13} />, onReset, 'danger', false, 'Reset everything')}

        <Sep />

        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--foreground)' }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </header>
  );
}
