'use client';

import { useEditorStore } from '@/lib/editor/store';
import { Input } from '@/components/editor/ui/Input';
import { Select } from '@/components/editor/ui/Select';
import { ColorPicker } from '@/components/editor/ui/ColorPicker';
import { Slider } from '@/components/editor/ui/Slider';
import { Button } from '@/components/editor/ui/Button';
import { Trash2, Lock, Unlock } from 'lucide-react';

export function PropertiesPanel() {
  const project = useEditorStore((s) => s.project);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const updateElement = useEditorStore((s) => s.updateElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const el = project?.elements.find((e) => e.id === selectedElementIds[0]);

  if (!el) return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Propriedades</h3>
      <p className="text-xs text-zinc-500 text-center py-8">Selecione um elemento para editar</p>
    </div>
  );

  const fontOptions = [
    { value: 'Arial', label: 'Arial' }, { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' }, { value: 'Georgia', label: 'Georgia' },
    { value: 'Courier New', label: 'Courier New' }, { value: 'Verdana', label: 'Verdana' },
    { value: 'Impact', label: 'Impact' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Propriedades</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => updateElement(el.id, { locked: !el.locked })}>{el.locked ? <Lock size={14} /> : <Unlock size={14} />}</Button>
          <Button size="sm" variant="ghost" onClick={() => removeElement(el.id)}><Trash2 size={14} className="text-red-400" /></Button>
        </div>
      </div>
      <Input label="Nome" value={el.name} onChange={(e) => updateElement(el.id, { name: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="X" type="number" value={Math.round(el.x)} onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })} />
        <Input label="Y" type="number" value={Math.round(el.y)} onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })} />
        <Input label="Largura" type="number" value={Math.round(el.width)} onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })} />
        <Input label="Altura" type="number" value={Math.round(el.height)} onChange={(e) => updateElement(el.id, { height: Number(e.target.value) })} />
      </div>
      <Slider label="Rotação" value={el.rotation} onChange={(v) => updateElement(el.id, { rotation: v })} min={-360} max={360} suffix="°" />
      <Slider label="Opacidade" value={Math.round(el.opacity * 100)} onChange={(v) => updateElement(el.id, { opacity: v / 100 })} suffix="%" />
      {(el.type === 'text' || el.type === 'handle' || el.type === 'stats') && (
        <>
          <Input label="Conteúdo" value={el.content || ''} onChange={(e) => updateElement(el.id, { content: e.target.value })} />
          <Select label="Fonte" options={fontOptions} value={el.fontFamily || 'Arial'} onChange={(e) => updateElement(el.id, { fontFamily: e.target.value })} />
          <Slider label="Tamanho" value={el.fontSize || 24} onChange={(v) => updateElement(el.id, { fontSize: v })} min={8} max={200} />
          <ColorPicker label="Cor" value={el.fill || '#ffffff'} onChange={(v) => updateElement(el.id, { fill: v })} />
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Início" type="number" step={0.1} value={el.startTime} onChange={(e) => updateElement(el.id, { startTime: Number(e.target.value) })} />
        <Input label="Fim" type="number" step={0.1} value={el.endTime} onChange={(e) => updateElement(el.id, { endTime: Number(e.target.value) })} />
      </div>
    </div>
  );
}
