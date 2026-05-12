'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ThumbDropdownProps {
  label: string;
  selectedImage: HTMLImageElement | null;
  options: HTMLImageElement[];
  onSelect: (image: HTMLImageElement) => void;
}

export default function ThumbDropdown({
  label,
  selectedImage,
  options,
  onSelect,
}: ThumbDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (img: HTMLImageElement) => {
    onSelect(img);
    setIsOpen(false);
  };

  const getThumbCanvas = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 22;
    canvas.height = 22;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 22, 22);
    return canvas;
  };

  return (
    <div className="w-full min-w-0">
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2.5 bg-input-bg border border-border rounded-lg cursor-pointer hover:bg-panel hover:border-gold transition-all box-border"
      >
        {selectedImage ? (
          <>
            <canvas
              width={28}
              height={28}
              ref={(el) => {
                if (el && selectedImage) {
                  const ctx = el.getContext('2d')!;
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(selectedImage, 0, 0, 28, 28);
                }
              }}
              className="w-7 h-7 border border-border rounded flex-shrink-0"
              style={{ imageRendering: 'pixelated' }}
            />
            <span className="text-sm font-medium text-foreground flex-1 truncate">
              Pattern Selected
            </span>
          </>
        ) : (
          <span className="text-sm text-text-secondary flex-1">{label}</span>
        )}
        <ChevronDown size={12} className={`transition-transform flex-shrink-0 text-text-tertiary ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="fixed bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto z-[9999] top-auto left-0 w-56"
          style={{
            top: triggerRef.current
              ? `${triggerRef.current.getBoundingClientRect().bottom + 6}px`
              : 'auto',
            left: triggerRef.current
              ? `${triggerRef.current.getBoundingClientRect().left}px`
              : 'auto',
          }}
        >
          {options.length === 0 ? (
            <div className="px-4 py-6 text-sm italic text-text-tertiary text-center">
              No patterns available yet
            </div>
          ) : (
            options.map((img, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(img)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-panel transition-colors border-b border-panel-border last:border-b-0 group"
              >
                <canvas
                  width={32}
                  height={32}
                  ref={(el) => {
                    if (el) {
                      const ctx = el.getContext('2d')!;
                      ctx.imageSmoothingEnabled = false;
                      ctx.drawImage(img, 0, 0, 32, 32);
                    }
                  }}
                  className="w-8 h-8 border border-border rounded flex-shrink-0 group-hover:border-gold"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-gold">
                  Pattern {idx + 1}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
