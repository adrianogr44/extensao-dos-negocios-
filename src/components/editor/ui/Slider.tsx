'use client';

import { cn } from '@/lib/editor/utils';

interface SliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  suffix?: string;
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, className, suffix }: SliderProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        {label && <label className="text-xs text-zinc-400 font-medium">{label}</label>}
        <span className="text-xs text-zinc-500">{value}{suffix}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1.5 bg-zinc-900 rounded-full appearance-none cursor-pointer accent-purple-500"
      />
    </div>
  );
}
