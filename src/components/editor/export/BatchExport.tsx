'use client';

import { useState, useRef } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Select } from '@/components/editor/ui/Select';
import { Slider } from '@/components/editor/ui/Slider';
import { Download, Upload, Settings, CheckCircle, XCircle, Clock } from 'lucide-react';

export function BatchExport() {
  const project = useEditorStore((s) => s.project);
  const batchJobs = useEditorStore((s) => s.batchJobs);
  const addBatchJob = useEditorStore((s) => s.addBatchJob);
  const exportSettings = useEditorStore((s) => s.exportSettings);

  const [videos, setVideos] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setVideos((prev) => [...prev, ...Array.from(files).map((f) => URL.createObjectURL(f))]);
  };

  const handleExport = () => {
    if (videos.length === 0 || !project) return;
    addBatchJob({ name: `Exportação - ${new Date().toLocaleString()}`, status: 'pending', templateId: project.id, inputVideos: videos, totalItems: videos.length });
    setVideos([]);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Exportação em Massa</h3>
        <Settings size={14} className="text-zinc-500" />
      </div>
      <div className="bg-zinc-900 rounded-lg p-3 space-y-3 border border-zinc-800">
        <h4 className="text-xs font-medium text-white">Configurações</h4>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Formato" options={[{ value: 'mp4', label: 'MP4' }, { value: 'mov', label: 'MOV' }, { value: 'gif', label: 'GIF' }]} value={exportSettings.format} />
          <Select label="Qualidade" options={[{ value: 'low', label: 'Baixa' }, { value: 'medium', label: 'Média' }, { value: 'high', label: 'Alta' }]} value={exportSettings.quality} />
        </div>
        <Slider label="Jobs paralelos" value={exportSettings.parallelJobs} onChange={(v) => useEditorStore.setState({ exportSettings: { ...exportSettings, parallelJobs: v } })} min={1} max={8} />
      </div>
      <div className="bg-zinc-900 rounded-lg p-3 space-y-3 border border-zinc-800">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-white">Vídeos</h4>
          <input ref={inputRef} type="file" multiple accept="video/*" className="hidden" onChange={handleSelect} />
          <Button size="sm" variant="ghost" icon={<Upload size={14} />} onClick={() => inputRef.current?.click()}>Adicionar</Button>
        </div>
        {videos.length > 0 && <p className="text-xs text-zinc-400">{videos.length} vídeo(s)</p>}
        <Button size="lg" variant="primary" className="w-full" icon={<Download size={16} />} onClick={handleExport} disabled={videos.length === 0}>
          Exportar {videos.length > 0 ? `${videos.length} vídeos` : ''}
        </Button>
      </div>
      {batchJobs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-white">Exportações</h4>
          {batchJobs.map((job) => (
            <div key={job.id} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{job.name}</p>
                  <p className="text-[10px] text-zinc-500">{job.completedItems}/{job.totalItems} concluídos</p>
                </div>
                {job.status === 'processing' ? <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${(job.completedItems / job.totalItems) * 100}%` }} /></div>
                  : job.status === 'completed' ? <CheckCircle size={16} className="text-green-500" />
                  : job.status === 'error' ? <XCircle size={16} className="text-red-500" />
                  : <Clock size={16} className="text-zinc-500" />}
              </div>
              {job.errors.length > 0 && <p className="text-[10px] text-red-400 mt-1">{job.errors.length} erro(s)</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
