'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Input } from '@/components/editor/ui/Input';
import { Select } from '@/components/editor/ui/Select';
import { getTemplateCategoryLabel, getTemplateCategoryColor } from '@/lib/editor/utils';
import type { TemplateCategory } from '@/lib/editor/types';
import { Save, Trash2, Play, Grid } from 'lucide-react';

export function TemplateManager() {
  const templates = useEditorStore((s) => s.templates);
  const saveAsTemplate = useEditorStore((s) => s.saveAsTemplate);
  const removeTemplate = useEditorStore((s) => s.removeTemplate);
  const applyTemplate = useEditorStore((s) => s.applyTemplate);

  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('personalizado');
  const [filter, setFilter] = useState('all');

  const catOpts = [
    { value: 'all', label: 'Todos' }, { value: 'futebol', label: 'Futebol' },
    { value: 'noticias', label: 'Notícias' }, { value: 'motivacional', label: 'Motivacional' },
    { value: 'curiosidades', label: 'Curiosidades' }, { value: 'dark', label: 'Dark' },
    { value: 'personalizado', label: 'Personalizado' },
  ];

  const filtered = filter === 'all' ? templates : templates.filter((t) => t.category === filter);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Templates</h3>
        <Button size="sm" variant="ghost" icon={<Save size={14} />} onClick={() => setDialog(true)}>Salvar como</Button>
      </div>
      <Select options={catOpts} value={filter} onChange={(e) => setFilter(e.target.value)} />
      {dialog && (
        <div className="bg-zinc-900 rounded-lg p-3 space-y-3 border border-zinc-800">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Meu Template" />
          <Select label="Categoria" options={catOpts.filter((c) => c.value !== 'all')} value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { if (name.trim()) { saveAsTemplate(name.trim(), category); setDialog(false); setName(''); } }}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filtered.map((t) => (
          <div key={t.id} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 hover:border-purple-500/50 transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-white truncate">{t.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: getTemplateCategoryColor(t.category), color: '#fff' }}>{getTemplateCategoryLabel(t.category)}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">{t.elements.length} elementos · {t.captions.length} legendas · usado {t.usageCount}x</p>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="primary" icon={<Play size={12} />} onClick={() => applyTemplate(t.id)}>Aplicar</Button>
              <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => removeTemplate(t.id)} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <Grid size={24} className="mx-auto text-zinc-500 mb-2" />
            <p className="text-xs text-zinc-500">Nenhum template ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
