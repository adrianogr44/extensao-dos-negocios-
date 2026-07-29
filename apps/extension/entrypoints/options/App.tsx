import { useState, useEffect } from 'react'
import { DEFAULT_CONFIG, type PostReelsConfig } from '../../src/lib/types'

function OptionsApp() {
  const [config, setConfig] = useState<PostReelsConfig>(DEFAULT_CONFIG)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.sync.get('postreelsConfig', (result: any) => {
      if (result.postreelsConfig) setConfig(result.postreelsConfig)
    })
  }, [])

  async function saveConfig() {
    await chrome.storage.sync.set({ postreelsConfig: config })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      maxWidth: 600, margin: '40px auto', padding: 32,
      fontFamily: 'system-ui, sans-serif',
      background: '#0f0f23', color: '#e0e0e0', borderRadius: 12,
    }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>PostReels Config</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Dashboard API URL</span>
          <input
            value={config.apiUrl}
            onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>MinIO Endpoint</span>
          <input
            value={config.minioEndpoint}
            onChange={e => setConfig({ ...config, minioEndpoint: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>MinIO Access Key</span>
          <input
            value={config.minioAccessKey}
            onChange={e => setConfig({ ...config, minioAccessKey: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>MinIO Secret Key</span>
          <input
            type="password"
            value={config.minioSecretKey}
            onChange={e => setConfig({ ...config, minioSecretKey: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Bucket</span>
          <input
            value={config.minioBucket}
            onChange={e => setConfig({ ...config, minioBucket: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Downloads simultâneos</span>
          <input
            type="number"
            min={1}
            max={10}
            value={config.concurrency}
            onChange={e => setConfig({ ...config, concurrency: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Limite máximo de vídeos por vez</span>
          <input
            type="number"
            min={1}
            max={200}
            value={config.maxDownloads}
            onChange={e => setConfig({ ...config, maxDownloads: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Scroll delay (ms)</span>
          <input
            type="number"
            min={500}
            max={5000}
            step={100}
            value={config.scrollDelay}
            onChange={e => setConfig({ ...config, scrollDelay: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Máximo de scrolls</span>
          <input
            type="number"
            min={5}
            max={200}
            value={config.maxScrolls}
            onChange={e => setConfig({ ...config, maxScrolls: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <button
          onClick={saveConfig}
          style={{
            marginTop: 16, padding: '12px 24px',
            background: '#0095f6', color: 'white', border: 'none',
            borderRadius: 8, fontSize: 16, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {saved ? 'Salvo!' : 'Salvar Configuração'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '8px 12px',
  background: '#1a1a2e',
  color: '#e0e0e0',
  border: '1px solid #333',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'monospace',
}

export default OptionsApp
