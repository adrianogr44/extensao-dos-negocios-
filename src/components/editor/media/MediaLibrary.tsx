'use client';

import { useRef, useCallback } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Upload, Image, Film, Music, Trash2 } from 'lucide-react';

export function MediaLibrary() {
  const library = useEditorStore((s) => s.mediaLibrary);
  const add = useEditorStore((s) => s.addMediaItem);
  const remove = useEditorStore((s) => s.removeMediaItem);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      add({ type: type as 'video' | 'image' | 'audio', name: file.name, url, size: file.size, thumbnail: type === 'video' ? undefined : url });
    });
    if (inputRef.current) inputRef.current.value = '';
  }, [add]);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Biblioteca</h3>
        <input ref={inputRef} type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={handleUpload} />
        <Button size="sm" variant="ghost" icon={<Upload size={14} />} onClick={() => inputRef.current?.click()}>Upload</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {library.map((item) => (
          <div key={item.id} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-purple-500/50 transition-all cursor-pointer"
            draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.url); e.dataTransfer.setData('application/type', item.type); }}>
            <div className="aspect-[9/16] flex items-center justify-center bg-black/40">
              {item.type === 'video' ? <div className="flex flex-col items-center gap-1 text-zinc-500"><Film size={24} /><span className="text-[10px]">MP4</span></div>
                : item.type === 'audio' ? <div className="flex flex-col items-center gap-1 text-zinc-500"><Music size={24} /><span className="text-[10px]">MP3</span></div>
                : <img src={item.url} alt={item.name} className="w-full h-full object-cover" />}
            </div>
            <div className="p-1.5">
              <p className="text-[10px] text-zinc-400 truncate">{item.name}</p>
              <p className="text-[9px] text-zinc-500">{(item.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={() => remove(item.id)} className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      {library.length === 0 && (
        <div className="text-center py-8">
          <Upload size={32} className="mx-auto text-zinc-500 mb-2" />
          <p className="text-xs text-zinc-500">Arraste arquivos ou clique em Upload</p>
        </div>
      )}
    </div>
  );
}
