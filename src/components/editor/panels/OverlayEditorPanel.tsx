'use client';

import { useEditorStore } from '@/lib/editor/store';
import { Input } from '@/components/editor/ui/Input';
import { Select } from '@/components/editor/ui/Select';
import { ColorPicker } from '@/components/editor/ui/ColorPicker';
import { Slider } from '@/components/editor/ui/Slider';
import { Button } from '@/components/editor/ui/Button';
import { OVERLAY_PRESETS } from '@/lib/editor/types';
import type { OverlayElement, OverlayElementType, EditorElement } from '@/lib/editor/types';
import { useRef, useState, useCallback } from 'react';
import {
  Camera, Type, AtSign, BadgeCheck, Square, Eye, EyeOff,
  Image, Trash2, Lock, Unlock, ChevronDown, ChevronRight, Upload, ArrowLeft,
} from 'lucide-react';

const ELEMENT_LABELS: Record<OverlayElementType, { label: string; icon: any }> = {
  avatar: { label: 'Avatar', icon: Camera },
  display_name: { label: 'Nome', icon: Type },
  username: { label: '@Username', icon: AtSign },
  verified: { label: 'Selo verificado', icon: BadgeCheck },
  video_area: { label: 'Área do vídeo', icon: Square },
  top_bar: { label: 'Barra superior', icon: Square },
  bottom_bar: { label: 'Barra inferior', icon: Square },
  stats: { label: 'Estatísticas', icon: Square },
  custom_text: { label: 'Texto personalizado', icon: Type },
};

const FONT_OPTIONS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
];

const WEIGHT_OPTIONS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];



export function OverlayEditorPanel() {
  const project = useEditorStore((s) => s.project);
  const elements = useEditorStore((s) => s.project?.elements || []);
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const selectElement = useEditorStore((s) => s.selectElement);

  const [expandedSection, setExpandedSection] = useState<string | null>('overlay');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const overlayElements = elements.filter((el) =>
    ['profile', 'handle', 'stats', 'overlay', 'text', 'image'].includes(el.type) &&
    el.type !== 'video'
  );

  const selectedEl = elements.find((el) => el.id === selectedElementIds[0]);

  const applyPreset = useCallback((presetKey: string) => {
    const preset = OVERLAY_PRESETS[presetKey];
    if (!preset) return;
    const duration = project?.duration || 30;

    const existingNonVideo = elements.filter((el) => el.type !== 'video');
    existingNonVideo.forEach((el) => removeElement(el.id));

    let zIndexCounter = 1;
    for (const pe of preset.elements) {
      if (pe.type === 'video_area') continue;

      const mappedType = mapOverlayToElementType(pe.type);
      const isBar = pe.type === 'top_bar' || pe.type === 'bottom_bar';
      const isVerified = pe.type === 'verified';

      addElement({
        type: mappedType,
        name: pe.label,
        x: pe.x, y: pe.y,
        width: pe.width, height: pe.height,
        rotation: pe.rotation || 0,
        scaleX: pe.scale || 1, scaleY: pe.scale || 1,
        opacity: pe.opacity ?? 1,
        visible: pe.visible,
        locked: false,
        zIndex: zIndexCounter++,
        startTime: 0, endTime: duration,
        content: pe.content || '',
        fill: isBar ? (pe.backgroundColor || '#000000') : isVerified ? (pe.iconColor || '#1d9bf0') : (pe.color || '#ffffff'),
        fontSize: pe.fontSize || 24,
        fontFamily: pe.font || 'Arial',
        fontWeight: Number(pe.fontWeight) || 400,
        cornerRadius: pe.mask === 'circle' ? Math.min(pe.width, pe.height) / 2 : (pe.borderRadius || 0),
        src: pe.imageUrl,
      });
    }
    setShowPresetMenu(false);
  }, [elements, addElement, removeElement, project]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, elementId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateElement(elementId, { src: url });
  }, [updateElement]);

  if (!project) return null;

  return (
    <div className="p-3 space-y-3 overflow-y-auto max-h-full">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (uploadTarget) handleImageUpload(e, uploadTarget); }} />

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Overlay</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowPresetMenu(!showPresetMenu)}>
            {showPresetMenu ? 'Fechar' : 'Presets'}
          </Button>
        </div>
      </div>

      {showPresetMenu && (
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 space-y-2 animate-slide-up">
          <p className="text-xs text-zinc-400 font-medium">Modelos de Overlay</p>
          {Object.entries(OVERLAY_PRESETS).map(([key, preset]) => (
            <button key={key} onClick={() => applyPreset(key)}
              className="w-full text-left bg-zinc-800 hover:bg-zinc-700 rounded-lg p-3 transition-colors">
              <p className="text-sm text-white font-medium">{preset.elements.find(e => e.type === 'display_name')?.content || key}</p>
              <p className="text-[10px] text-zinc-500">{preset.elements.length} elementos</p>
            </button>
          ))}
        </div>
      )}

      {overlayElements.length === 0 && !showPresetMenu && (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <BadgeCheck size={24} className="text-purple-400" />
          </div>
          <p className="text-sm text-zinc-400 mb-1">Nenhum elemento de overlay</p>
          <p className="text-xs text-zinc-600 mb-3">Adicione um preset ou crie manualmente</p>
          <Button size="sm" variant="primary" onClick={() => setShowPresetMenu(true)}>
            Escolher Preset
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {overlayElements.map((el) => {
          const overlayType = mapElementTypeToOverlay(el.type);
          const meta = ELEMENT_LABELS[overlayType] || ELEMENT_LABELS.custom_text;
          const Icon = meta.icon;
          const isSelected = selectedElementIds.includes(el.id);
          const isExpanded = expandedSection === el.id;

          return (
            <div key={el.id} className={`bg-zinc-900 rounded-lg border ${isSelected ? 'border-purple-500' : 'border-zinc-800'} overflow-hidden`}>
              <button onClick={() => { selectElement(el.id); setExpandedSection(isExpanded ? null : el.id); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                <Icon size={14} className="text-zinc-400 shrink-0" />
                <span className="text-sm text-white flex-1 text-left">{el.name || meta.label}</span>
                <div className="flex items-center gap-1">
                  <div onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }}
                    className={`p-1 rounded ${el.visible ? 'text-zinc-400 hover:text-white' : 'text-zinc-600'}`}>
                    {el.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-zinc-800 pt-3">
                  {renderOverlayControls(el, updateElement, removeElement, fileInputRef, setUploadTarget)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mapOverlayToElementType(type: OverlayElementType): EditorElement['type'] {
  switch (type) {
    case 'avatar': return 'profile';
    case 'display_name': return 'text';
    case 'username': return 'handle';
    case 'verified': return 'image';
    case 'video_area': return 'overlay';
    case 'top_bar': return 'overlay';
    case 'bottom_bar': return 'overlay';
    case 'stats': return 'stats';
    case 'custom_text': return 'text';
  }
}

function mapElementTypeToOverlay(type: string): OverlayElementType {
  switch (type) {
    case 'profile': return 'avatar';
    case 'handle': return 'username';
    case 'stats': return 'stats';
    case 'text': return 'display_name';
    case 'overlay': return 'video_area';
    default: return 'custom_text';
  }
}

function renderOverlayControls(
  el: EditorElement,
  updateElement: (id: string, updates: any) => void,
  removeElement: (id: string) => void,
  fileInputRef: React.RefObject<HTMLInputElement | null>,
  setUploadTarget: (id: string | null) => void,
) {
  const controls: React.ReactNode[] = [];

  const add = (node: React.ReactNode) => controls.push(node);

  if (el.type === 'profile' || el.type === 'image') {
    add(
      <div key="img">
        <p className="text-xs text-zinc-500 mb-2">Imagem</p>
        <div className="flex gap-2 items-center">
          <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
            {el.src ? (
              <img src={el.src} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={20} className="text-zinc-500" />
            )}
          </div>
          <Button size="sm" variant="secondary" icon={<Upload size={12} />}
            onClick={() => { setUploadTarget(el.id); fileInputRef.current?.click(); }}>
            Trocar imagem
          </Button>
        </div>
      </div>
    );
    if (el.type === 'profile') {
      add(<Slider key="mask" label="Máscara circular" value={el.cornerRadius || 0} onChange={(v) => updateElement(el.id, { cornerRadius: v })} max={100} />);
    }
  }

  if (el.type === 'image' && el.name?.toLowerCase().includes('selo')) {
    add(
      <div key="icon-controls" className="space-y-2">
        <div className="flex items-center gap-2">
          <ColorPicker label="Cor do ícone" value={el.fill || '#1d9bf0'} onChange={(v) => updateElement(el.id, { fill: v })} />
          <Button size="sm" variant="ghost" icon={<Image size={12} />}>Trocar ícone</Button>
        </div>
      </div>
    );
  }

  if (el.type === 'text' || el.type === 'handle' || el.type === 'stats') {
    const isName = el.type === 'text' && el.name?.toLowerCase().includes('nome');
    const isHandle = el.type === 'handle';

    add(<Input key="content" label={isName ? 'Nome' : isHandle ? '@' : 'Conteúdo'}
      value={el.content || ''} onChange={(e) => updateElement(el.id, { content: e.target.value })} />);

    add(<Select key="font" label="Fonte" options={FONT_OPTIONS} value={el.fontFamily || 'Arial'}
      onChange={(e) => updateElement(el.id, { fontFamily: e.target.value })} />);

    add(<Slider key="size" label="Tamanho" value={el.fontSize || 24} onChange={(v) => updateElement(el.id, { fontSize: v })} min={10} max={120} />);

    if (isName) {
      add(<Select key="weight" label="Peso" options={WEIGHT_OPTIONS} value={String(el.fontWeight || '400')}
        onChange={(e) => updateElement(el.id, { fontWeight: Number(e.target.value) })} />);
    }

    add(<ColorPicker key="color" label="Cor" value={el.fill || '#ffffff'} onChange={(v) => updateElement(el.id, { fill: v })} />);
  }

  add(
    <div key="position" className="grid grid-cols-2 gap-2">
      <Input label="Posição X" type="number" value={Math.round(el.x)} onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })} />
      <Input label="Posição Y" type="number" value={Math.round(el.y)} onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })} />
      <Input label="Largura" type="number" value={Math.round(el.width)} onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })} />
      <Input label="Altura" type="number" value={Math.round(el.height)} onChange={(e) => updateElement(el.id, { height: Number(e.target.value) })} />
    </div>
  );

  add(<Slider key="scale" label="Escala" value={Math.round((el.scaleX || 1) * 100)} onChange={(v) => updateElement(el.id, { scaleX: v / 100, scaleY: v / 100 })} min={10} max={300} suffix="%" />);

  add(<Slider key="opacity" label="Opacidade" value={Math.round((el.opacity || 1) * 100)} onChange={(v) => updateElement(el.id, { opacity: v / 100 })} suffix="%" />);

  if (el.type === 'overlay') {
    add(<ColorPicker key="bg" label="Cor de fundo" value={el.fill || '#000000'} onChange={(v) => updateElement(el.id, { fill: v })} />);
  }

  if (el.type !== 'video') {
    add(
      <div key="actions" className="flex gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => updateElement(el.id, { visible: !el.visible })} icon={el.visible ? <EyeOff size={12} /> : <Eye size={12} />}>
          {el.visible ? 'Ocultar' : 'Mostrar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => updateElement(el.id, { locked: !el.locked })} icon={el.locked ? <Unlock size={12} /> : <Lock size={12} />}>
          {el.locked ? 'Destravar' : 'Travar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => removeElement(el.id)} icon={<Trash2 size={12} />} className="text-red-400 hover:text-red-300">
          Remover
        </Button>
      </div>
    );
  }

  return controls;
}


