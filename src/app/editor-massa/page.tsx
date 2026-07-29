'use client';

import { useEditorStore } from '@/lib/editor/store';
import { EditorHeader } from '@/components/editor/layout/Header';
import { Panel } from '@/components/editor/ui/Panel';
import { EditorCanvas } from '@/components/editor/canvas/EditorCanvas';
import { Timeline } from '@/components/editor/timeline/Timeline';
import { ElementsPanel } from '@/components/editor/panels/ElementsPanel';
import { OverlayEditorPanel } from '@/components/editor/panels/OverlayEditorPanel';
import { CaptionEditor } from '@/components/editor/panels/CaptionEditor';
import { MediaLibrary } from '@/components/editor/media/MediaLibrary';
import { TemplateManager } from '@/components/editor/template/TemplateManager';
import { BatchExport } from '@/components/editor/export/BatchExport';
import { CSVImport } from '@/components/editor/automation/CSVImport';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Type, Library, Download, FileSpreadsheet, LayoutTemplate } from 'lucide-react';

type Tab = 'elements' | 'captions' | 'media' | 'templates' | 'export' | 'automation';

export default function EditorMassaPage() {
  const router = useRouter();
  const project = useEditorStore((s) => s.project);
  const panelWidths = useEditorStore((s) => s.panelWidths);
  const setPanelWidth = useEditorStore((s) => s.setPanelWidth);
  const [tab, setTab] = useState<Tab>('elements');

  useEffect(() => { if (!project) router.push('/dashboard'); }, [project, router]);
  if (!project) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'elements', label: 'Elementos', icon: <Layers size={16} /> },
    { id: 'captions', label: 'Legendas', icon: <Type size={16} /> },
    { id: 'media', label: 'Mídia', icon: <Library size={16} /> },
    { id: 'templates', label: 'Templates', icon: <LayoutTemplate size={16} /> },
    { id: 'export', label: 'Exportar', icon: <Download size={16} /> },
    { id: 'automation', label: 'CSV', icon: <FileSpreadsheet size={16} /> },
  ];

  const renderPanel = () => {
    switch (tab) {
      case 'elements': return <ElementsPanel />;
      case 'captions': return <CaptionEditor />;
      case 'media': return <MediaLibrary />;
      case 'templates': return <TemplateManager />;
      case 'export': return <BatchExport />;
      case 'automation': return <CSVImport />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <EditorHeader />
      <div className="flex-1 flex overflow-hidden">
        <Panel side="left" width={panelWidths.left} onResize={(w) => setPanelWidth('left', w)} minWidth={280} maxWidth={500}
          header={
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`p-1.5 rounded transition-colors ${tab === t.id ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} title={t.label}>
                  {t.icon}
                </button>
              ))}
            </div>
          }>
          {renderPanel()}
        </Panel>
        <div className="flex-1 flex flex-col min-w-0">
          <EditorCanvas />
          <Timeline />
        </div>
        <Panel side="right" width={panelWidths.right} onResize={(w) => setPanelWidth('right', w)} minWidth={300} maxWidth={500}
          header={<span className="text-sm font-medium text-white">Overlay</span>}>
          <OverlayEditorPanel />
        </Panel>
      </div>
    </div>
  );
}
