'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Text, Image, Transformer } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '@/lib/editor/store';
import { EditorStartScreen } from './EditorStartScreen';
import { ZoomIn, ZoomOut, RotateCcw, Type, User, Trash2, Square, Circle } from 'lucide-react';

function useMediaLoader(project: any) {
  const [media, setMedia] = useState<Record<string, HTMLImageElement | HTMLVideoElement>>({});
  const loadingRef = useRef<Set<string>>(new Set());
  const videosRef = useRef<HTMLVideoElement[]>([]);

  useEffect(() => {
    return () => {
      videosRef.current.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
      videosRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!project) return;
    for (const el of project.elements || []) {
      if (!el.src || loadingRef.current.has(el.src)) continue;
      loadingRef.current.add(el.src);
      if (el.type === 'video') {
        const video = document.createElement('video');
        video.muted = true; video.loop = true; video.playsInline = true;
        video.crossOrigin = 'anonymous'; video.preload = 'auto';
        videosRef.current.push(video);
        video.addEventListener('loadeddata', () => { setMedia((prev) => ({ ...prev, [el.src!]: video })); video.play().catch(() => {}); }, { once: true });
        video.addEventListener('error', () => setMedia((prev) => ({ ...prev, [el.src!]: video })), { once: true });
        video.src = el.src; video.load();
      } else {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setMedia((prev) => ({ ...prev, [el.src!]: img }));
        img.onerror = () => setMedia((prev) => ({ ...prev, [el.src!]: img }));
        img.src = el.src;
      }
    }
  }, [project?.elements]);

  return media;
}

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const canvasCtxRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
  const [stageSize, setStageSize] = useState({ width: 600, height: 800 });
  const [showStart, setShowStart] = useState(true);

  const project = useEditorStore((s) => s.project);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const zoom = useEditorStore((s) => s.zoom);
  const panOffset = useEditorStore((s) => s.panOffset);
  const selectElement = useEditorStore((s) => s.selectElement);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const updateElement = useEditorStore((s) => s.updateElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPanOffset = useEditorStore((s) => s.setPanOffset);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const addElement = useEditorStore((s) => s.addElement);

  const media = useMediaLoader(project);

  const hasVideo = project?.elements.some((el) => el.type === 'video' && el.src);
  const videoEl = project?.elements.find((el) => el.type === 'video' && el.src);

  const canvasWidth = project?.width || 1080;
  const canvasHeight = project?.height || 1920;
  const scale = Math.min((stageSize.width - 40) / canvasWidth, (stageSize.height - 40) / canvasHeight);
  const offsetX = (stageSize.width - canvasWidth * scale) / 2;
  const offsetY = (stageSize.height - canvasHeight * scale) / 2;
  canvasCtxRef.current = { offsetX, offsetY, scale };

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) { const { width, height } = entry.contentRect; setStageSize({ width: Math.floor(width), height: Math.floor(height) }); }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const selected = stage.find((node: Konva.Node) => selectedElementIds.includes(node.id()));
    transformerRef.current.nodes(selected);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedElementIds, project?.elements]);

  useEffect(() => {
    if (!videoEl?.src) return;
    const v = media[videoEl.src];
    if (!v || !(v instanceof HTMLVideoElement)) return;
    if (Math.abs(v.currentTime - currentTime) > 0.5) v.currentTime = currentTime;
  }, [currentTime, videoEl?.src, media]);

  useEffect(() => {
    const v = videoEl?.src ? media[videoEl.src] : undefined;
    if (!v || !(v instanceof HTMLVideoElement)) return;
    if (isPlaying) { v.play().catch(() => {}); } else { v.pause(); }
  }, [isPlaying, videoEl?.src, media]);

  const lastFrameRef = useRef<number>(-1);
  const rafRef = useRef<number>(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const videoSrc = videoEl?.src;
    if (!videoSrc || !isPlaying) return;
    const v = media[videoSrc];
    if (!v || !(v instanceof HTMLVideoElement)) return;

    const tick = () => {
      if (v.readyState >= 2 && v.currentTime !== lastFrameRef.current) {
        lastFrameRef.current = v.currentTime;
        layerRef.current?.batchDraw();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, videoEl?.src, media]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setZoom(newScale);
    const mpt = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    setPanOffset({ x: pointer.x - mpt.x * newScale, y: pointer.y - mpt.y * newScale });
  }, [setZoom, setPanOffset]);

  const handleDragEnd = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const { offsetX, offsetY, scale } = canvasCtxRef.current;
    updateElement(id, { x: (e.target.x() - offsetX) / scale, y: (e.target.y() - offsetY) / scale });
  }, [updateElement]);

  const handleTransformEnd = useCallback((id: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const { offsetX, offsetY, scale } = canvasCtxRef.current;
    updateElement(id, { x: (node.x() - offsetX) / scale, y: (node.y() - offsetY) / scale, rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
  }, [updateElement]);

  if (!project) return null;
  if (showStart) return <EditorStartScreen onComplete={() => setShowStart(false)} />;

  const visibleElements = project.elements.filter((el) => el.visible);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100">{project.name}</span>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">1080 × 1920</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-zinc-500">Elementos:</span>
            <span className="text-xs text-white font-medium">{project.elements.filter(e => e.visible).length}</span>
          </div>
          <button onClick={() => setZoom(Math.max(0.1, zoom / 1.2))} className="p-1 text-zinc-400 hover:text-white transition-colors"><ZoomOut size={16} /></button>
          <span className="text-xs text-zinc-500 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(5, zoom * 1.2))} className="p-1 text-zinc-400 hover:text-white transition-colors"><ZoomIn size={16} /></button>
          <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="p-1 text-zinc-400 hover:text-white transition-colors"><RotateCcw size={16} /></button>
        </div>
      </div>

      {hasVideo && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <span className="text-[10px] text-zinc-500 font-medium mr-2">AÇÕES:</span>
          <button onClick={() => addElement({ type: 'text', name: 'Texto', x: 200, y: 800, width: 600, height: 80, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: project.elements.length, startTime: 0, endTime: project.duration, content: 'Digite seu texto', fill: '#ffffff', fontSize: 64, fontFamily: 'Arial' })} className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"><Type size={13} /> Texto</button>
          <button onClick={() => addElement({ type: 'profile', name: 'Perfil', x: 60, y: 80, width: 80, height: 80, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: project.elements.length, startTime: 0, endTime: project.duration, cornerRadius: 40 })} className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"><User size={13} /> Perfil</button>
          <button onClick={() => addElement({ type: 'handle', name: '@', x: 160, y: 95, width: 300, height: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: project.elements.length, startTime: 0, endTime: project.duration, content: '@seudominio', fill: '#ffffff', fontSize: 28, fontFamily: 'Arial' })} className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"><span className="text-xs">@</span> @</button>
          <button onClick={() => addElement({ type: 'overlay', name: 'Bloco', x: 100, y: 600, width: 200, height: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: project.elements.length, startTime: 0, endTime: project.duration, fill: '#a855f7' })} className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"><Square size={13} /> Bloco</button>
          <button onClick={() => addElement({ type: 'profile', name: 'Círculo', x: 100, y: 600, width: 200, height: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: project.elements.length, startTime: 0, endTime: project.duration, fill: '#a855f7', cornerRadius: 100 })} className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"><Circle size={13} /> Círculo</button>
          {selectedElementIds.length > 0 && (
            <button onClick={() => selectedElementIds.forEach(id => removeElement(id))}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-800 rounded"><Trash2 size={13} /> Remover</button>
          )}
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
          scaleX={zoom} scaleY={zoom} x={panOffset.x} y={panOffset.y}
          onWheel={handleWheel}
          onMouseDown={(e) => {
            if (e.evt.button === 1) { isPanningRef.current = true; panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY }; e.evt.preventDefault(); return; }
            if (e.target === e.target.getStage()) deselectAll();
          }}
          onMouseMove={(e) => {
            if (!isPanningRef.current) return;
            const dx = e.evt.clientX - panStartRef.current.x;
            const dy = e.evt.clientY - panStartRef.current.y;
            panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
            const cur = useEditorStore.getState().panOffset;
            setPanOffset({ x: cur.x + dx, y: cur.y + dy });
          }}
          onMouseUp={() => { isPanningRef.current = false; }}>
          <Layer ref={layerRef}>
            <Rect x={offsetX} y={offsetY} width={canvasWidth * scale} height={canvasHeight * scale} fill="#000" />
            {visibleElements.map((el) => {
              const ex = offsetX + el.x * scale;
              const ey = offsetY + el.y * scale;
              const ew = el.width * scale * el.scaleX;
              const eh = el.height * scale * el.scaleY;

              if (el.type === 'video') {
                const loaded = el.src ? media[el.src] : undefined;
                if (loaded && loaded instanceof HTMLVideoElement) {
                  return <Image key={el.id} id={el.id} x={offsetX} y={offsetY} width={canvasWidth * scale} height={canvasHeight * scale} image={loaded} draggable={false} listening={false} opacity={1} />;
                }
                return <Rect key={el.id} id={el.id} x={offsetX} y={offsetY} width={canvasWidth * scale} height={canvasHeight * scale} fill="#1a1a2e" stroke="#333" strokeWidth={1} draggable={false} listening={false} opacity={1} />;
              }

              if (el.type === 'text' || el.type === 'handle' || el.type === 'stats') {
                return (
                  <Text key={el.id} id={el.id} x={ex} y={ey} text={el.content || ''}
                    fontSize={(el.fontSize || 24) * scale} fontFamily={el.fontFamily || 'Arial'}
                    fill={el.fill || '#ffffff'} stroke={el.stroke} strokeWidth={el.strokeWidth ? el.strokeWidth * scale : 0}
                    shadowColor={el.shadowColor} shadowBlur={el.shadowBlur ? el.shadowBlur * scale : 0}
                    shadowOffsetX={el.shadowOffsetX ? el.shadowOffsetX * scale : 0}
                    shadowOffsetY={el.shadowOffsetY ? el.shadowOffsetY * scale : 0}
                    draggable={!el.locked} opacity={el.opacity} rotation={el.rotation}
                    onClick={() => selectElement(el.id)} onTap={() => selectElement(el.id)}
                    onDragEnd={(e) => handleDragEnd(el.id, e)} onTransformEnd={(e) => handleTransformEnd(el.id, e)} />
                );
              }

              const img = el.src ? media[el.src] : undefined;
              if (img) {
                return <Image key={el.id} id={el.id} x={ex} y={ey} width={ew} height={eh} image={img} draggable={!el.locked} opacity={el.opacity} rotation={el.rotation} onClick={() => selectElement(el.id)} onTap={() => selectElement(el.id)} onDragEnd={(e) => handleDragEnd(el.id, e)} onTransformEnd={(e) => handleTransformEnd(el.id, e)} />;
              }

              return <Rect key={el.id} id={el.id} x={ex} y={ey} width={ew} height={eh} fill={el.fill || '#a855f7'} cornerRadius={el.cornerRadius || 0} draggable={!el.locked} opacity={el.opacity} rotation={el.rotation} onClick={() => selectElement(el.id)} onTap={() => selectElement(el.id)} onDragEnd={(e) => handleDragEnd(el.id, e)} onTransformEnd={(e) => handleTransformEnd(el.id, e)} />;
            })}
            <Transformer ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => newBox.width < 10 || newBox.height < 10 ? oldBox : newBox}
              borderStroke="#a855f7" borderStrokeWidth={1.5} anchorStroke="#a855f7" anchorFill="#fff" anchorSize={8}
              rotateEnabled
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']} />
          </Layer>
        </Stage>

        {videoEl?.src && !media[videoEl.src] && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-zinc-900/80 backdrop-blur rounded-lg px-4 py-2 text-sm text-zinc-400">Carregando vídeo...</div>
          </div>
        )}
      </div>
    </div>
  );
}
