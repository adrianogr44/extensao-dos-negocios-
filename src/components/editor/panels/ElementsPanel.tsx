'use client';

import { useRef, useCallback } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Type, Image, Film, Square, User, AtSign, Eye, EyeOff, Lock, Unlock, Trash2, Copy, ArrowUp, ArrowDown, Upload, Plus } from 'lucide-react';

export function ElementsPanel() {
  const project = useEditorStore((s) => s.project);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const selectElement = useEditorStore((s) => s.selectElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const duplicateElements = useEditorStore((s) => s.duplicateElements);
  const addElement = useEditorStore((s) => s.addElement);
  const addMediaItem = useEditorStore((s) => s.addMediaItem);
  const reorderElement = useEditorStore((s) => s.reorderElement);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const elements = project?.elements || [];
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const hasVideo = elements.some(el => el.type === 'video');
  const hasOverlay = elements.some(el => el.type === 'overlay');
  const duration = project?.duration || 30;

  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addMediaItem({ type: 'video', name: file.name, url, size: file.size });
    const existingVideo = elements.find(el => el.type === 'video');
    if (existingVideo) {
      updateElement(existingVideo.id, { src: url });
    } else {
      addElement({
        type: 'video', name: 'Vídeo', x: 0, y: 0, width: 1080, height: 1920,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
        zIndex: 0, startTime: 0, endTime: duration, src: url,
      });
    }
  }, [addMediaItem, addElement, updateElement, elements, duration]);

  const handleOverlayUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addMediaItem({ type: 'overlay', name: file.name, url, size: file.size });
    addElement({
      type: 'overlay', name: 'Overlay', x: 0, y: 0, width: 1080, height: 1920,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: true,
      zIndex: elements.length, startTime: 0, endTime: duration, src: url,
    });
  }, [addMediaItem, addElement, elements.length, duration]);

  const icon = (t: string) => {
    switch (t) {
      case 'text': return <Type size={14} />;
      case 'image': return <Image size={14} />;
      case 'video': return <Film size={14} />;
      case 'overlay': return <Square size={14} />;
      case 'profile': return <User size={14} />;
      case 'handle': return <AtSign size={14} />;
      default: return <Square size={14} />;
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {elements.length === 0 ? 'Comece aqui' : 'Elementos'}
        </h3>
        <span className="text-[10px] text-zinc-500">{elements.length}</span>
      </div>

      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
      <input ref={overlayInputRef} type="file" accept="image/*" className="hidden" onChange={handleOverlayUpload} />

      {!hasVideo && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-dashed border-purple-500/40 hover:border-purple-500 transition-all cursor-pointer text-center"
          onClick={() => videoInputRef.current?.click()}>
          <Film size={28} className="mx-auto text-purple-400 mb-2" />
          <p className="text-sm font-medium text-white mb-1">Envie um vídeo</p>
          <p className="text-[10px] text-zinc-500">Clique para selecionar MP4, MOV...</p>
        </div>
      )}

      {hasVideo && !hasOverlay && (
        <div className="bg-zinc-900 rounded-xl p-3 border border-dashed border-zinc-700 hover:border-purple-500/50 transition-all cursor-pointer text-center"
          onClick={() => overlayInputRef.current?.click()}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Image size={18} className="text-zinc-400" />
            <span className="text-xs text-zinc-400">Adicionar Overlay PNG</span>
          </div>
          <p className="text-[10px] text-zinc-600">Clique para selecionar uma imagem</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {hasVideo && (
          <>
            <Button size="sm" variant="ghost" icon={<Type size={14} />} onClick={() => addElement({
              type: 'text', name: 'Texto', x: 200, y: 800, width: 600, height: 80, rotation: 0,
              scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
              zIndex: elements.length, startTime: 0, endTime: duration,
              content: 'Digite seu texto', fill: '#ffffff', fontSize: 64, fontFamily: 'Arial',
            })}>Texto</Button>
            <Button size="sm" variant="ghost" icon={<User size={14} />} onClick={() => addElement({
              type: 'profile', name: 'Perfil', x: 60, y: 80, width: 80, height: 80, rotation: 0,
              scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
              zIndex: elements.length, startTime: 0, endTime: duration, cornerRadius: 40,
            })}>Perfil</Button>
            <Button size="sm" variant="ghost" icon={<AtSign size={14} />} onClick={() => addElement({
              type: 'handle', name: '@', x: 160, y: 95, width: 300, height: 40, rotation: 0,
              scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
              zIndex: elements.length, startTime: 0, endTime: duration,
              content: '@usuario', fill: '#ffffff', fontSize: 28, fontFamily: 'Arial',
            })}>@</Button>
            <Button size="sm" variant="ghost" icon={<Image size={14} />} onClick={() => overlayInputRef.current?.click()}>Overlay</Button>
          </>
        )}
      </div>

      {elements.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-zinc-600 font-medium px-1">Camadas:</p>
          {sorted.map((el, i) => (
            <div key={el.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors group ${selectedElementIds.includes(el.id) ? 'bg-purple-600/20 text-white' : 'text-zinc-400 hover:bg-white/5'}`} onClick={() => selectElement(el.id)}>
              <span className="text-zinc-500 w-4">{icon(el.type)}</span>
              <span className="flex-1 truncate">{el.name || el.type}</span>
              {el.type === 'video' && <span className="text-[9px] text-zinc-600">BASE</span>}
              <button onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }} className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${el.visible ? 'text-zinc-400' : 'text-zinc-500'}`}>{el.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
              <button onClick={(e) => { e.stopPropagation(); updateElement(el.id, { locked: !el.locked }); }} className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${el.locked ? 'text-purple-400' : 'text-zinc-400'}`}>{el.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); reorderElement(el.id, i - 1); }} className="p-0.5 hover:text-white"><ArrowUp size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); reorderElement(el.id, i + 1); }} className="p-0.5 hover:text-white"><ArrowDown size={12} /></button>
              </div>
              {el.type !== 'video' && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); duplicateElements([el.id]); }} className="p-0.5 hover:text-white"><Copy size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="p-0.5 hover:text-red-500"><Trash2 size={12} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {elements.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-zinc-600 mb-3">Depois de enviar um vídeo, você poderá:</p>
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center"><Type size={10} className="text-purple-400" /></div>
              Adicionar textos e títulos
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center"><User size={10} className="text-purple-400" /></div>
              Inserir foto de perfil e @
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center"><Square size={10} className="text-purple-400" /></div>
              Sobrepor overlay com chroma key
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center"><span className="text-[10px] text-purple-400">SRT</span></div>
              Importar legendas SRT/VTT
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
