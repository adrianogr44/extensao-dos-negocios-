'use client';

import { useRef, useCallback, useMemo } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { cn } from '@/lib/editor/utils';
import { Play, Square } from 'lucide-react';

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const selectElement = useEditorStore((s) => s.selectElement);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);

  const duration = project?.duration || 30;
  const pps = 20;
  const timelineWidth = duration * pps + 100;

  const tracks = useMemo(() => {
    if (!project) return [];
    const types = ['video', 'overlay', 'caption', 'audio', 'image'] as const;
    return types.map((type) => ({
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      elements: project.elements.filter((el) => el.type === type),
    }));
  }, [project]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const time = Math.max(0, (e.clientX - rect.left - 100) / pps);
    setCurrentTime(Math.min(duration, time));
  }, [duration, setCurrentTime]);

  const markers = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= duration; i++) arr.push(i);
    return arr;
  }, [duration]);

  if (!project) return null;

  return (
    <div className="h-48 bg-zinc-900 border-t border-zinc-800 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPlaying(!isPlaying)}
            className={cn('p-1.5 rounded transition-colors', isPlaying ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5')}>
            {isPlaying ? <Square size={14} /> : <Play size={14} />}
          </button>
          <span className="text-xs font-mono text-zinc-100">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')} / {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}.0
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full">
          <div className="w-24 shrink-0 border-r border-zinc-800">
            <div className="h-6 border-b border-zinc-800" />
            {tracks.map((track) => (
              <div key={track.type} className="h-8 flex items-center px-2 border-b border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-medium truncate">{track.label}</span>
              </div>
            ))}
          </div>
          <div ref={containerRef} className="flex-1 relative cursor-pointer" style={{ minWidth: timelineWidth }} onClick={handleTimelineClick}>
            <div className="h-6 border-b border-zinc-800 flex">
              {markers.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l border-zinc-800/30" style={{ left: 100 + t * pps }}>
                  {t % 5 === 0 && <span className="text-[9px] text-zinc-500 pl-1">{Math.floor(t / 60)}:{(t % 60).toString().padStart(2, '0')}</span>}
                </div>
              ))}
            </div>
            {tracks.map((track) => (
              <div key={track.type} className="h-8 relative border-b border-zinc-800">
                {track.elements.map((el) => {
                  const left = 100 + el.startTime * pps;
                  const width = Math.max(4, (el.endTime - el.startTime) * pps);
                  const isSelected = selectedElementIds.includes(el.id);
                  return (
                    <div key={el.id} className={cn('absolute top-1 h-6 rounded flex items-center px-2 cursor-pointer transition-all', isSelected ? 'bg-purple-600 ring-1 ring-white' : 'bg-zinc-800 hover:bg-zinc-700')}
                      style={{ left, width }}
                      onClick={(e) => { e.stopPropagation(); selectElement(el.id); setCurrentTime(el.startTime); }}>
                      <span className="text-[9px] text-white truncate">{el.name || el.type}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-50 pointer-events-none" style={{ left: 100 + currentTime * pps }}>
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-purple-500 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
