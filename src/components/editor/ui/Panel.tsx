'use client';

import { useState } from 'react';
import { cn } from '@/lib/editor/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PanelProps {
  side: 'left' | 'right';
  width: number;
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  children: React.ReactNode;
  header?: React.ReactNode;
}

export function Panel({
  side,
  width,
  onResize,
  minWidth = 280,
  maxWidth = 500,
  children,
  header,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = side === 'left' ? e.clientX : window.innerWidth - e.clientX;
      onResize(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={cn(
        'h-full flex flex-col bg-zinc-900 border-l border-zinc-800 relative transition-all duration-200',
        collapsed ? (side === 'left' ? 'w-0 overflow-hidden' : 'w-0 overflow-hidden') : '',
        isResizing && 'select-none'
      )}
      style={{ width: collapsed ? 0 : width }}
    >
      {!collapsed && (
        <>
          {header && (
            <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 shrink-0">
              {header}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </>
      )}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors z-10 rounded',
          side === 'left' ? '-right-3' : '-left-3'
        )}
      >
        {side === 'left' ? (collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />) :
          collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
      <div
        className={cn('absolute top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-purple-500 transition-colors',
          side === 'left' ? '-right-0.5' : '-left-0.5'
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
