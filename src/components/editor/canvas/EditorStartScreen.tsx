'use client';

import { useRef, useCallback, useState } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { Button } from '@/components/editor/ui/Button';
import { Film, Image, Upload, ArrowRight, Check, Play, Beaker } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export function EditorStartScreen({ onComplete }: Props) {
  const project = useEditorStore((s) => s.project);
  const addMediaItem = useEditorStore((s) => s.addMediaItem);
  const addElement = useEditorStore((s) => s.addElement);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'welcome' | 'select-video' | 'select-overlay' | 'ready'>('welcome');
  const [videoFile, setVideoFile] = useState<{ name: string; url: string } | null>(null);
  const [overlayFile, setOverlayFile] = useState<{ name: string; url: string } | null>(null);

  const duration = project?.duration || 30;

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoFile({ name: file.name, url });
    addMediaItem({ type: 'video', name: file.name, url, size: file.size });
    addElement({
      type: 'video', name: 'Vídeo', x: 0, y: 0,
      width: 1080, height: 1920,
      rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 0, startTime: 0, endTime: duration, src: url,
    });
    setStep('select-overlay');
  }, [addMediaItem, addElement, duration]);

  const handleOverlaySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOverlayFile({ name: file.name, url });
    addMediaItem({ type: 'overlay', name: file.name, url, size: file.size });
    addElement({
      type: 'overlay', name: 'Overlay', x: 0, y: 0,
      width: 1080, height: 1920,
      rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: true,
      zIndex: 1, startTime: 0, endTime: duration, src: url,
    });
    setStep('ready');
  }, [addMediaItem, addElement, duration]);

  const skipOverlay = useCallback(() => setStep('ready'), []);

  const loadDemo = useCallback(() => {
    const store = useEditorStore.getState();
    store.setProject({
      id: store.project?.id || crypto.randomUUID(),
      name: 'Projeto Demo',
      width: 1080, height: 1920, duration: 30,
      elements: [], captions: [],
      removeOverlayBlack: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    store.addElement({
      type: 'video', name: 'Vídeo', x: 0, y: 0,
      width: 1080, height: 1920, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 0, startTime: 0, endTime: duration, src: '/demo-video.mp4',
    });
    store.addElement({
      type: 'overlay', name: 'Overlay', x: 0, y: 0,
      width: 1080, height: 1920, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 0.3, visible: true, locked: true,
      zIndex: 1, startTime: 0, endTime: duration, fill: '#a855f7',
    });
    store.addElement({
      type: 'profile', name: 'Perfil', x: 40, y: 60,
      width: 80, height: 80, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 2, startTime: 0, endTime: duration, fill: '#3b82f6', cornerRadius: 40,
    });
    store.addElement({
      type: 'handle', name: '@usuário', x: 140, y: 72,
      width: 300, height: 40, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 3, startTime: 0, endTime: duration,
      content: '@canalfutebol', fill: '#ffffff', fontSize: 28, fontFamily: 'Arial',
    });
    store.addElement({
      type: 'text', name: 'Título', x: 80, y: 900,
      width: 920, height: 100, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 4, startTime: 0, endTime: duration,
      content: 'MOMENTO HISTÓRICO', fill: '#ffffff', fontSize: 72, fontFamily: 'Impact',
      stroke: '#000000', strokeWidth: 4,
    });
    store.addElement({
      type: 'text', name: 'Descrição', x: 80, y: 1020,
      width: 920, height: 60, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 5, startTime: 0, endTime: duration,
      content: 'O melhor momento da partida! 🔥', fill: '#ffffff', fontSize: 32, fontFamily: 'Arial',
      stroke: '#000000', strokeWidth: 2,
    });
    store.addElement({
      type: 'stats', name: 'Stats', x: 80, y: 1760,
      width: 920, height: 50, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, locked: false,
      zIndex: 6, startTime: 0, endTime: duration,
      content: '❤️ 12.5K   💬 843   🔄 2.1K', fill: '#ffffff', fontSize: 30, fontFamily: 'Arial',
      stroke: '#000000', strokeWidth: 2,
    });
    store.addCaption({
      text: 'ELE FEZ O GOL DO TÍTULO! 🏆', startTime: 2, endTime: 6,
      x: 540, y: 1500, fontSize: 44, fontFamily: 'Impact', color: '#ffffff',
      strokeColor: '#000000', strokeWidth: 3, animation: 'fade', alignment: 'center',
    });
    store.addCaption({
      text: 'QUE JOGADA INCRÍVEL', startTime: 7, endTime: 11,
      x: 540, y: 1500, fontSize: 40, fontFamily: 'Arial', color: '#ffdd00',
      strokeColor: '#000000', strokeWidth: 3, animation: 'slideUp', alignment: 'center',
    });
    setIsPlaying(true);
    onComplete();
  }, [duration, onComplete, setIsPlaying]);

  const handleReady = () => {
    setIsPlaying(true);
    onComplete();
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
      <input ref={overlayInputRef} type="file" accept="image/*" className="hidden" onChange={handleOverlaySelect} />

      {step === 'welcome' && (
        <div className="max-w-lg w-full mx-6 animate-slide-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Film size={32} className="text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Editor de Vídeos em Massa</h1>
            <p className="text-zinc-400 text-sm">Adicione vídeo, overlay, textos e legendas — depois exporte centenas de cópias</p>
          </div>
          <div className="space-y-3 mb-8">
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0"><span className="text-purple-400 font-bold">1</span></div>
              <div><h3 className="text-sm font-medium text-white">Selecione um vídeo</h3><p className="text-xs text-zinc-500">MP4, MOV — seu conteúdo base</p></div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0"><span className="text-purple-400 font-bold">2</span></div>
              <div><h3 className="text-sm font-medium text-white">Adicione uma overlay</h3><p className="text-xs text-zinc-500">PNG com fundo preto ou qualquer imagem</p></div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0"><span className="text-purple-400 font-bold">3</span></div>
              <div><h3 className="text-sm font-medium text-white">Edite e exporte em massa</h3><p className="text-xs text-zinc-500">Posicione elementos, legendas, exporte centenas</p></div>
            </div>
          </div>
          <Button size="lg" variant="primary" className="w-full mb-3" icon={<Upload size={18} />}
            onClick={() => { setStep('select-video'); setTimeout(() => videoInputRef.current?.click(), 100); }}>
            Selecionar Vídeo
          </Button>
          <Button size="lg" variant="secondary" className="w-full" icon={<Beaker size={18} />} onClick={loadDemo}>
            Testar com Demo
          </Button>
          <p className="text-xs text-zinc-600 text-center mt-4">Use o painel à esquerda para adicionar elementos manualmente</p>
        </div>
      )}

      {step === 'select-video' && (
        <div className="max-w-md w-full mx-6 animate-slide-up">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4"><Film size={36} className="text-purple-400" /></div>
            <h2 className="text-lg font-semibold text-white mb-2">Selecionar Vídeo</h2>
            <p className="text-sm text-zinc-400 mb-6">Clique para escolher o vídeo base do seu Reel/Short</p>
            <Button size="lg" variant="primary" className="w-full" icon={<Upload size={18} />} onClick={() => videoInputRef.current?.click()}>Escolher Vídeo</Button>
            <Button size="sm" variant="ghost" className="w-full mt-2" onClick={loadDemo}>Ou testar com demo</Button>
          </div>
        </div>
      )}

      {step === 'select-overlay' && (
        <div className="max-w-md w-full mx-6 animate-slide-up">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center"><Check size={20} className="text-green-400" /></div>
              <ArrowRight size={20} className="text-zinc-600" />
              <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center"><Image size={36} className="text-purple-400" /></div>
            </div>
            <p className="text-sm text-green-400 mb-1 font-medium">Vídeo selecionado</p>
            <p className="text-xs text-zinc-500 mb-4 truncate">{videoFile?.name}</p>
            <h2 className="text-lg font-semibold text-white mb-2">Adicionar Overlay</h2>
            <p className="text-sm text-zinc-400 mb-6">Escolha um PNG para sobrepor ao vídeo</p>
            <div className="flex gap-2">
              <Button size="lg" variant="primary" className="flex-1" icon={<Image size={18} />} onClick={() => overlayInputRef.current?.click()}>Escolher Overlay</Button>
              <Button size="lg" variant="ghost" className="flex-1" onClick={skipOverlay}>Pular</Button>
            </div>
          </div>
        </div>
      )}

      {step === 'ready' && (
        <div className="max-w-md w-full mx-6 animate-slide-up">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-green-400" /></div>
            <h2 className="text-lg font-semibold text-white mb-2">Tudo pronto!</h2>
            <p className="text-sm text-zinc-400 mb-1">{videoFile?.name ? 'Vídeo carregado' : 'Demo carregada'}</p>
            <p className="text-xs text-zinc-500 mb-6">Agora edite os elementos, ajuste posições e exporte</p>
            <Button size="lg" variant="primary" className="w-full" icon={<Play size={18} />} onClick={handleReady}>
              Começar a Editar
            </Button>
            <p className="text-xs text-zinc-600 mt-3">Selecione elementos no canvas ou no painel à esquerda</p>
          </div>
        </div>
      )}
    </div>
  );
}
