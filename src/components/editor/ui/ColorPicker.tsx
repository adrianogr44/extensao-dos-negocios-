'use client';

import { cn } from '@/lib/editor/utils';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ label, value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-xs text-zinc-400 font-medium">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-zinc-700 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 w-20 focus:outline-none focus:border-purple-500"
        />
      </div>
    </div>
  );
}
