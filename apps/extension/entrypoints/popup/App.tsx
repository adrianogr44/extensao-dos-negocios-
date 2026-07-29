import { useState, useEffect, useCallback } from 'react'
import type { DownloadTask, Niche, PendingDownload, PostReelsConfig } from '../../src/lib/types'
import { DEFAULT_CONFIG } from '../../src/lib/types'

function sendMessage(type: string, payload?: any): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, resolve)
  })
}

const platformMeta: Record<string, { label: string, color: string }> = {
  INSTAGRAM: { label: 'IG', color: '#e1306c' },
  FACEBOOK: { label: 'FB', color: '#1877f2' },
  YOUTUBE: { label: 'YT', color: '#ff4e50' },
}

export default function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [config, setConfig] = useState<PostReelsConfig>(DEFAULT_CONFIG)
  const [pending, setPending] = useState<PendingDownload | null>(null)
  const [selectedNiche, setSelectedNiche] = useState('')
  const [maxDownloads, setMaxDownloads] = useState(20)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-9), msg])
  }, [])

  useEffect(() => {
    addLog('Popup carregado')
    sendMessage('GET_NICHES').then(res => {
      if (res?.data) {
        setNiches(res.data)
        if (res.data.length > 0) setSelectedNiche(res.data[0].id)
        addLog(`Nichos: ${res.data.length}`)
      }
    })
    sendMessage('GET_CONFIG').then(res => {
      if (res?.data) {
        setConfig(res.data)
        setMaxDownloads(res.data.maxDownloads || 20)
      }
    })
    sendMessage('GET_TASKS').then(res => {
      if (res?.data) setTasks(res.data)
    })
    sendMessage('GET_PENDING_DOWNLOAD').then(res => {
      if (res?.data) {
        setPending(res.data)
        addLog(`Pendente: ${res.data.shortcodes.length} vídeos`)
      }
    })
  }, [addLog])

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'PENDING_DOWNLOAD_UPDATED') {
        setPending(message.payload)
        addLog(`Pendente recebido: ${message.payload.shortcodes.length} vídeos`)
      }
      if (message.type === 'TASKS_UPDATED') {
        setTasks(message.payload)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [addLog])

  const handleStartDownload = useCallback(async () => {
    if (!selectedNiche || !pending) return
    addLog(`Iniciando download: ${pending.shortcodes.length} vídeos`)
    await sendMessage('START_DOWNLOAD', {
      shortcodes: pending.shortcodes,
      videoUrls: pending.videoUrls,
      nicheId: selectedNiche,
      profile: pending.profile,
      platform: pending.platform,
    })
    setPending(null)
  }, [selectedNiche, pending, addLog])

  const handleSaveConfig = useCallback(async () => {
    await sendMessage('SAVE_CONFIG', { maxDownloads })
    addLog(`Config salva: maxDownloads=${maxDownloads}`)
  }, [maxDownloads, addLog])

  const handleClearCompleted = useCallback(async () => {
    await sendMessage('CLEAR_COMPLETED')
    const res = await sendMessage('GET_TASKS')
    if (res?.data) setTasks(res.data)
    addLog('Downloads completos/erro limpos')
  }, [addLog])

  const stats = {
    queued: tasks.filter(t => t.status === 'queued').length,
    active: tasks.filter(t => t.status === 'downloading' || t.status === 'uploading').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    error: tasks.filter(t => t.status === 'error').length,
  }

  return (
    <div style={{
      width: 450, background: '#0f0f23', color: '#e0e0e0',
      fontFamily: 'system-ui', padding: 16, fontSize: 13,
      minHeight: 300,
    }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>📥 PostReels</h1>

      <div style={{ marginBottom: 16 }}>
        <span style={{ display: 'inline-block', marginRight: 12, padding: '4px 8px', background: '#1a1a2e', borderRadius: 4 }}>
          ⏳ {stats.queued}
        </span>
        <span style={{ display: 'inline-block', marginRight: 12, padding: '4px 8px', background: '#1a1a2e', borderRadius: 4 }}>
          ⬇ {stats.active}
        </span>
        <span style={{ display: 'inline-block', marginRight: 12, padding: '4px 8px', background: '#1a1a2e', borderRadius: 4 }}>
          ✅ {stats.completed}
        </span>
        <span style={{ display: 'inline-block', marginRight: 12, padding: '4px 8px', background: '#1a1a2e', borderRadius: 4 }}>
          ❌ {stats.error}
        </span>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => chrome.tabs.create({ url: 'http://localhost:3000' })}
          style={btnStyle}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => chrome.tabs.create({ url: 'http://localhost:3000/settings' })}
          style={btnStyle}
        >
          ⚙️ Config
        </button>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>⚙️ Configurações</h3>
        <label style={{ fontSize: 12, color: '#999' }}>Nicho:</label>
        <select
          value={selectedNiche}
          onChange={e => setSelectedNiche(e.target.value)}
          style={inputStyle}
        >
          {niches.length === 0 && <option value="">Nenhum nicho</option>}
          {niches.map(n => (
            <option key={n.id} value={n.id}>{n.nome}</option>
          ))}
        </select>
        <label style={{ fontSize: 12, color: '#999' }}>Máximo de downloads:</label>
        <input
          type="number"
          min={1}
          max={100}
          value={maxDownloads}
          onChange={e => setMaxDownloads(parseInt(e.target.value) || 1)}
          style={inputStyle}
        />
        <button onClick={handleSaveConfig} style={btnStyle}>
          Salvar Config
        </button>
        {pending && (
          <>
            {pending.platform && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: platformMeta[pending.platform]?.color || '#666' }}>
                  {platformMeta[pending.platform]?.label || pending.platform}
                </span>
              </div>
            )}
            {pending.profile && (
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, padding: 8, background: '#0f0f23', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{pending.profile.fullName}</div>
                <div>@{pending.profile.username}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span>📬 {pending.profile.postsCount ?? '?'} posts</span>
                  <span>👥 {pending.profile.followersCount ?? '?'} seguidores</span>
                </div>
              </div>
            )}
            <button
              onClick={handleStartDownload}
              style={{ ...btnStyle, background: '#22c55e' }}
            >
              ▶️ Iniciar Download ({pending.shortcodes.length} vídeos)
            </button>
          </>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>📋 Downloads</h3>
          {tasks.length > 0 && (
            <button onClick={handleClearCompleted} style={{
              background: 'none', border: '1px solid #555',
              color: '#999', borderRadius: 4, padding: '4px 8px',
              fontSize: 11, cursor: 'pointer',
            }}>
              Limpar completos
            </button>
          )}
        </div>
        {tasks.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center' }}>Nenhum</div>
        ) : (
          tasks.map(t => (
            <div key={t.id} style={taskStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.status === 'queued' ? '⏳' : t.status === 'downloading' ? '⬇' : t.status === 'completed' ? '✅' : '❌'}
                <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 700, color: '#fff', background: platformMeta[t.platform]?.color || '#666' }}>
                  {platformMeta[t.platform]?.label || t.platform}
                </span>
                <span>{t.shortcode}</span>
              </div>
              {t.status === 'error' && <span style={{ color: '#ff6b6b', fontSize: 11, display: 'block' }}>{t.error}</span>}
            </div>
          ))
        )}
      </div>

      {logs.length > 0 && (
        <div style={{ borderTop: '1px solid #333', paddingTop: 8, marginTop: 8 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ fontSize: 11, color: '#0f0', fontFamily: 'monospace', padding: 2 }}>
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 8, marginBottom: 8,
  background: '#0f0f23', color: '#e0e0e0',
  border: '1px solid #444', borderRadius: 6,
}

const btnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: 10, marginBottom: 8,
  border: '1px solid #444', background: '#0095f6',
  color: 'white', borderRadius: 6, cursor: 'pointer',
  fontSize: 13, fontWeight: 600,
}

const sectionStyle: React.CSSProperties = {
  background: '#1a1a2e', padding: 12, borderRadius: 6,
  marginBottom: 16, border: '1px solid #333',
}

const taskStyle: React.CSSProperties = {
  background: '#0f0f23', padding: 10, marginBottom: 8,
  borderRadius: 6, border: '1px solid #333',
}
