'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ControlsPanelProps {
  config: {
    posX: number
    posY: number
    scale: number
    zoom: number
    volume: number
    rotation: number
    overlayX: number
    overlayY: number
    overlayCropTop: number
    overlayCropBottom: number
    opacity: number
    cropTop: number
    cropBottom: number
    bgColor: string
    cropColor: string
    cropOpacity: number
    speed: number
    mirror: boolean
    texts: Array<{ content: string; x: number; y: number; fontSize: number; color: string }>
  }
  onChange: (key: string, value: number | string | boolean) => void
  onSave: () => void
  onReplicate: () => void
  onReplicateCaptions: () => void
  onRender: () => void
  saving: boolean
  rendering: boolean
  selectedText: number | null
  onSelectText: (i: number | null) => void
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-500">{label}</label>
        <span className="text-xs text-zinc-400">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{title}</h4>
      {children}
    </div>
  )
}

export function ControlsPanel({ config, onChange, onSave, onReplicate, onReplicateCaptions, onRender, saving, rendering, selectedText, onSelectText }: ControlsPanelProps) {

  function updateText(i: number, field: string, val: string | number) {
    const t = config.texts.map((item, idx) => idx === i ? { ...item, [field]: val } : item)
    onChange('texts', t as unknown as string)
  }

  function addText() {
    const t = [...config.texts, { content: 'Novo texto', x: 200, y: 400, fontSize: 48, color: '#FFFFFF' }]
    onChange('texts', t as unknown as string)
    onSelectText(t.length - 1)
  }

  function removeText(i: number) {
    onChange('texts', config.texts.filter((_, idx) => idx !== i) as unknown as string)
    if (selectedText === i) onSelectText(null)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-zinc-400 tracking-wider uppercase">Controles</h3>

      {/* ── Anti-duplicidade ── */}
      <Section title="Anti-duplicidade">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-500">Velocidade</label>
            <span className="text-xs text-zinc-400">{config.speed.toFixed(2)}x</span>
          </div>
          <input type="range" min={0.9} max={1.1} step={0.01} value={config.speed}
            onChange={e => onChange('speed', parseFloat(e.target.value))}
            className="w-full accent-primary" />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
          <input type="checkbox" checked={config.mirror}
            onChange={e => onChange('mirror', e.target.checked)}
            className="accent-primary" />
          Espelhar vídeo (mirror)
        </label>
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Vídeo Original ── */}
      <Section title="Vídeo Original">
        <Slider label="Scale" min={0.1} max={3} step={0.05} value={config.scale}
          onChange={v => onChange('scale', v)} />
        <Slider label="Zoom" min={0.5} max={3} step={0.05} value={config.zoom}
          onChange={v => onChange('zoom', v)} />
        <Slider label="Posição X" min={-1500} max={1500} step={1} value={config.posX}
          onChange={v => onChange('posX', v)} />
        <Slider label="Posição Y" min={-2500} max={2500} step={1} value={config.posY}
          onChange={v => onChange('posY', v)} />
        <Slider label="Rotação" min={-180} max={180} step={1} value={config.rotation}
          onChange={v => onChange('rotation', v)} />
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Áudio ── */}
      <Section title="Áudio">
        <Slider label="Volume" min={0} max={2} step={0.05} value={config.volume}
          onChange={v => onChange('volume', v)} />
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Overlay ── */}
      <Section title="Overlay">
        <Slider label="Posição X" min={-1500} max={1500} step={1} value={config.overlayX}
          onChange={v => onChange('overlayX', v)} />
        <Slider label="Posição Y" min={-2500} max={2500} step={1} value={config.overlayY}
          onChange={v => onChange('overlayY', v)} />
        <Slider label="Opacidade" min={0} max={1} step={0.05} value={config.opacity}
          onChange={v => onChange('opacity', v)} />
        <Slider label="Corte topo (px)" min={0} max={2000} step={1} value={config.overlayCropTop}
          onChange={v => onChange('overlayCropTop', v)} />
        <Slider label="Corte base (px)" min={0} max={2000} step={1} value={config.overlayCropBottom}
          onChange={v => onChange('overlayCropBottom', v)} />
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Canvas ── */}
      <Section title="Canvas">
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500">Cor do fundo</label>
          <div className="flex items-center gap-2">
            <input type="color" value={config.bgColor}
              onChange={e => onChange('bgColor', e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent shrink-0" />
            <input type="text" value={config.bgColor}
              onChange={e => onChange('bgColor', e.target.value)}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 font-mono" />
            <button onClick={() => onChange('bgColor', '#FFFFFF')}
              className="h-8 w-8 shrink-0 rounded border border-zinc-700 bg-white" title="Branco" />
            <button onClick={() => onChange('bgColor', '#000000')}
              className="h-8 w-8 shrink-0 rounded border border-zinc-700 bg-black" title="Preto" />
          </div>
        </div>
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Corte (Crop) ── */}
      <Section title="Corte">
        <Slider label="Superior (px)" min={0} max={1080} step={1} value={config.cropTop}
          onChange={v => onChange('cropTop', v)} />
        <Slider label="Inferior (px)" min={0} max={1080} step={1} value={config.cropBottom}
          onChange={v => onChange('cropBottom', v)} />
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500">Cor do fundo</label>
          <div className="flex items-center gap-2">
            <input type="color" value={config.cropColor}
              onChange={e => onChange('cropColor', e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent shrink-0" />
            <input type="text" value={config.cropColor}
              onChange={e => onChange('cropColor', e.target.value)}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 font-mono" />
            <button onClick={() => onChange('cropColor', '#FFFFFF')}
              className="h-8 w-8 shrink-0 rounded border border-zinc-700 bg-white" title="Branco" />
            <button onClick={() => onChange('cropColor', '#000000')}
              className="h-8 w-8 shrink-0 rounded border border-zinc-700 bg-black" title="Preto" />
          </div>
        </div>
        <Slider label="Opacidade do fundo" min={0} max={1} step={0.05} value={config.cropOpacity}
          onChange={v => onChange('cropOpacity', v)} />
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Textos ── */}
      <Section title="Textos">
        {config.texts.length === 0 && (
          <p className="text-[11px] text-zinc-600 italic">Nenhum texto adicionado</p>
        )}
        {config.texts.map((t, i) => (
          <div key={i} className={`rounded border px-2 py-1.5 text-xs ${selectedText === i ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-700'}`}>
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-zinc-300 flex-1">{t.content || '(vazio)'}</span>
              <button onClick={() => onSelectText(selectedText === i ? null : i)}
                className="text-purple-400 hover:text-purple-300 shrink-0">Editar</button>
              <button onClick={() => removeText(i)}
                className="text-red-400 hover:text-red-300 shrink-0">X</button>
            </div>
            {selectedText === i && (
              <div className="mt-2 space-y-2 border-t border-zinc-700 pt-2">
                <textarea value={t.content} onChange={e => updateText(i, 'content', e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 resize-none" placeholder="Conteúdo do texto" rows={3} />
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-zinc-600">Tam</label>
                  <input type="range" min={12} max={200} step={1} value={t.fontSize}
                    onChange={e => updateText(i, 'fontSize', parseInt(e.target.value))}
                    className="flex-1 accent-primary" />
                  <span className="text-[10px] text-zinc-500 w-8 text-right">{t.fontSize}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-zinc-600">Cor</label>
                  <input type="color" value={t.color}
                    onChange={e => updateText(i, 'color', e.target.value)}
                    className="h-6 w-6 rounded border border-zinc-700 bg-transparent cursor-pointer shrink-0" />
                  <input value={t.color} onChange={e => updateText(i, 'color', e.target.value)}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono" />
                  <button onClick={() => updateText(i, 'color', '#FFFFFF')}
                    className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-white" title="Branco" />
                  <button onClick={() => updateText(i, 'color', '#000000')}
                    className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-black" title="Preto" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-zinc-600">X</label>
                  <input type="range" min={-500} max={1500} step={1} value={t.x}
                    onChange={e => updateText(i, 'x', parseInt(e.target.value))}
                    className="flex-1 accent-primary" />
                  <span className="text-[10px] text-zinc-500 w-10 text-right">{t.x}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-zinc-600">Y</label>
                  <input type="range" min={-500} max={2500} step={1} value={t.y}
                    onChange={e => updateText(i, 'y', parseInt(e.target.value))}
                    className="flex-1 accent-primary" />
                  <span className="text-[10px] text-zinc-500 w-10 text-right">{t.y}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        <button onClick={addText}
          className="w-full rounded border border-dashed border-zinc-600 py-1 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors">
          + Adicionar texto
        </button>
      </Section>

      <hr className="border-zinc-800" />

      {/* ── Ações ── */}
      <div className="space-y-2 !mt-8">
        <Button onClick={onSave} className="w-full" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar para este vídeo'}
        </Button>
        <Button onClick={onReplicate} variant="secondary" className="w-full">
          Replicar para todos do perfil
        </Button>
        <Button onClick={onReplicateCaptions} variant="secondary" className="w-full">
          Replicar legendas para todos
        </Button>
        <Button onClick={onRender} variant="outline" className="w-full" disabled={rendering}>
          {rendering ? 'Renderizando...' : 'Renderizar vídeo'}
        </Button>
      </div>
    </div>
  )
}
