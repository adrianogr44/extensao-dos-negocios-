'use client';

import { useRef, useCallback } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Upload, Table, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export function CSVImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setAutomationData = useEditorStore((s) => s.setAutomationData);
  const batchJobs = useEditorStore((s) => s.batchJobs);
  const ds = batchJobs[0]?.dataSource;

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
    if (data.length === 0) return;
    setAutomationData({ type: file.name.endsWith('.csv') ? 'csv' : 'excel', columns: Object.keys(data[0]), rows: data, mapping: {} });
  }, [setAutomationData]);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Automação CSV/Excel</h3>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
      <div className="bg-zinc-900 rounded-lg p-4 border border-dashed border-zinc-800 hover:border-purple-500/50 transition-all cursor-pointer text-center" onClick={() => inputRef.current?.click()}>
        <Upload size={24} className="mx-auto text-zinc-500 mb-2" />
        <p className="text-xs text-zinc-400">Clique para importar CSV ou Excel</p>
        <p className="text-[10px] text-zinc-500 mt-1">Cada linha = um vídeo na exportação</p>
      </div>
      {ds && (
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <div className="flex items-center gap-2 mb-2"><Table size={14} className="text-purple-400" /><span className="text-xs text-white font-medium">{ds.rows.length} linhas</span></div>
          <div className="text-xs text-zinc-400 space-y-1">
            <p className="font-medium mb-1">Colunas disponíveis:</p>
            {ds.columns.map((col) => (
              <div key={col} className="flex items-center gap-2 px-2 py-1 bg-zinc-950 rounded">
                <span className="text-zinc-500">{col}</span>
                <span className="text-[10px] text-zinc-500">→ mapear para elemento</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1"><AlertCircle size={10} />Os dados serão aplicados na exportação em massa</div>
        </div>
      )}
    </div>
  );
}
