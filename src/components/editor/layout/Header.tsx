'use client';

import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Input } from '@/components/editor/ui/Input';
import { Undo2, Redo2, Copy, ClipboardPaste, ArrowLeft, Play, Square } from 'lucide-react';
import { useEffect } from 'react';
import Link from 'next/link';

export function EditorHeader() {
  const project = useEditorStore((s) => s.project);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const copySelected = useEditorStore((s) => s.copySelected);
  const pasteClipboard = useEditorStore((s) => s.pasteClipboard);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const removeElement = useEditorStore((s) => s.removeElement);
  const updateProject = useEditorStore((s) => s.updateProject);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copySelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteClipboard(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedElementIds.length > 0) selectedElementIds.forEach((id) => removeElement(id)); }
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(!isPlaying); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, undo, redo, copySelected, pasteClipboard, selectedElementIds, removeElement, setIsPlaying]);

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
          <span className="font-bold text-sm text-white">MassVideo</span>
        </Link>
        <Input value={project?.name || ''} onChange={(e) => updateProject({ name: e.target.value })} className="h-7 w-48 text-sm bg-transparent border-transparent hover:border-zinc-800 focus:border-purple-500" />
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={undo}><Undo2 size={16} /></Button>
        <Button size="sm" variant="ghost" onClick={redo}><Redo2 size={16} /></Button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <Button size="sm" variant="ghost" onClick={copySelected}><Copy size={16} /></Button>
        <Button size="sm" variant="ghost" onClick={pasteClipboard}><ClipboardPaste size={16} /></Button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <Button size="sm" variant={isPlaying ? 'primary' : 'ghost'} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Square size={16} /> : <Play size={16} />}
        </Button>
      </div>
    </header>
  );
}
