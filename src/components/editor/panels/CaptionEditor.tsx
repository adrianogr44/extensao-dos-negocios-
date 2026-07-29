'use client';

import { useRef } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Input } from '@/components/editor/ui/Input';
import { ColorPicker } from '@/components/editor/ui/ColorPicker';
import { Select } from '@/components/editor/ui/Select';
import { Slider } from '@/components/editor/ui/Slider';
import { parseSRT, parseVTT } from '@/lib/editor/utils';
import type { CaptionAnimation } from '@/lib/editor/types';
import { Plus, Trash2, Upload, Sparkles } from 'lucide-react';

export function CaptionEditor() {
  const project = useEditorStore((s) => s.project);
  const selectedCaptionId = useEditorStore((s) => s.selectedCaptionId);
  const addCaption = useEditorStore((s) => s.addCaption);
  const updateCaption = useEditorStore((s) => s.updateCaption);
  const removeCaption = useEditorStore((s) => s.removeCaption);
  const setSelectedCaption = useEditorStore((s) => s.setSelectedCaption);
  const importCaptions = useEditorStore((s) => s.importCaptions);

  const fileRef = useRef<HTMLInputElement>(null);
  const captions = project?.captions || [];
  const sel = captions.find((c) => c.id === selectedCaptionId);

  const animOpts = [
    { value: 'none', label: 'Nenhuma' }, { value: 'fade', label: 'Fade' },
    { value: 'slideUp', label: 'Deslizar para Cima' }, { value: 'slideDown', label: 'Deslizar para Baixo' },
    { value: 'typewriter', label: 'Máquina de Escrever' }, { value: 'scale', label: 'Escala' },
  ];

  const fontOpts = [
    { value: 'Arial', label: 'Arial' }, { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Impact', label: 'Impact' }, { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Poppins', label: 'Poppins' }, { value: 'Oswald', label: 'Oswald' },
  ];

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ext = file.name.split('.').pop()?.toLowerCase();
    const entries = ext === 'srt' ? parseSRT(text) : ext === 'vtt' ? parseVTT(text) : null;
    if (!entries) return;
    importCaptions(entries.map((e) => ({
      text: e.text, startTime: e.startTime, endTime: e.endTime,
      x: 540, y: 1700, fontSize: 36, fontFamily: 'Arial', color: '#ffffff',
      strokeColor: '#000000', strokeWidth: 2, animation: 'none' as CaptionAnimation, alignment: 'center' as const,
    })));
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Legendas</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => addCaption({ text: 'Nova legenda', startTime: 0, endTime: 2, x: 540, y: 1700, fontSize: 36, fontFamily: 'Arial', color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, animation: 'none', alignment: 'center' })}>Adicionar</Button>
          <input ref={fileRef} type="file" accept=".srt,.vtt" className="hidden" onChange={handleImport} />
          <Button size="sm" variant="ghost" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>Importar</Button>
          <Button size="sm" variant="ghost" icon={<Sparkles size={14} />} onClick={() => importCaptions([{ text: 'Legenda gerada automaticamente', startTime: 0, endTime: project?.duration || 30, x: 540, y: 1700, fontSize: 36, fontFamily: 'Arial', color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, animation: 'fade', alignment: 'center' }])}>IA</Button>
        </div>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {captions.map((c, i) => (
          <div key={c.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors group ${selectedCaptionId === c.id ? 'bg-purple-600/20 text-white' : 'text-zinc-400 hover:bg-white/5'}`} onClick={() => setSelectedCaption(c.id)}>
            <span className="text-zinc-500 w-5">{i + 1}</span>
            <span className="flex-1 truncate">{c.text}</span>
            <span className="text-[10px] text-zinc-500">{c.startTime.toFixed(1)}s - {c.endTime.toFixed(1)}s</span>
            <button onClick={(e) => { e.stopPropagation(); removeCaption(c.id); }} className="p-0.5 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      {sel && (
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <Input label="Texto" value={sel.text} onChange={(e) => updateCaption(sel.id, { text: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Início" type="number" step={0.1} value={sel.startTime} onChange={(e) => updateCaption(sel.id, { startTime: Number(e.target.value) })} />
            <Input label="Fim" type="number" step={0.1} value={sel.endTime} onChange={(e) => updateCaption(sel.id, { endTime: Number(e.target.value) })} />
          </div>
          <Select label="Fonte" options={fontOpts} value={sel.fontFamily} onChange={(e) => updateCaption(sel.id, { fontFamily: e.target.value })} />
          <Slider label="Tamanho" value={sel.fontSize} onChange={(v) => updateCaption(sel.id, { fontSize: v })} min={12} max={120} />
          <ColorPicker label="Cor" value={sel.color} onChange={(v) => updateCaption(sel.id, { color: v })} />
          <ColorPicker label="Contorno" value={sel.strokeColor || '#000000'} onChange={(v) => updateCaption(sel.id, { strokeColor: v })} />
          <Slider label="Contorno (px)" value={sel.strokeWidth || 0} onChange={(v) => updateCaption(sel.id, { strokeWidth: v })} max={10} />
          <Select label="Animação" options={animOpts} value={sel.animation} onChange={(e) => updateCaption(sel.id, { animation: e.target.value as CaptionAnimation })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Posição X" type="number" value={Math.round(sel.x)} onChange={(e) => updateCaption(sel.id, { x: Number(e.target.value) })} />
            <Input label="Posição Y" type="number" value={Math.round(sel.y)} onChange={(e) => updateCaption(sel.id, { y: Number(e.target.value) })} />
          </div>
        </div>
      )}
    </div>
  );
}
