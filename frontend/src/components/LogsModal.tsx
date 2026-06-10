import { useEffect, useRef, useState } from 'react'
import { X, Terminal, Trash2 } from 'lucide-react'
import type { Tunnel } from '../types'
import { Button } from './ui'

interface LogsModalProps {
  tunnel: Tunnel
  onClose: () => void
}

export default function LogsModal({ tunnel, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/tunnels/${tunnel.id}/logs`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.log) {
          setLogs(prev => [...prev.slice(-499), data.log])
        }
      } catch {}
    }

    return () => ws.close()
  }, [tunnel.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col" style={{ height: '70vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-white font-medium">{tunnel.name}</span>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`} />
            <span className="text-gray-500 text-xs">{connected ? 'Conectado' : 'Desconectado'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-gray-950 rounded-b-xl">
          {logs.length === 0 ? (
            <p className="text-gray-600">Aguardando logs...</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`mb-0.5 ${
                  log.includes('ERR') ? 'text-red-400' :
                  log.includes('INF') ? 'text-green-400' :
                  log.includes('WRN') ? 'text-yellow-400' :
                  'text-gray-400'
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
