import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ExternalLink } from 'lucide-react'
import { setupApi } from '../services/api'
import { Modal, Input, Button } from './ui'

interface Props {
  onClose: () => void
}

export default function CreateTunnelModal({ onClose }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [hasCert, setHasCert] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setupApi.status().then(r => setHasCert(r.data.hasCert))
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await setupApi.createTunnel(name.trim())
      qc.invalidateQueries({ queryKey: ['tunnels'] })
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar tunnel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Criar novo tunnel">
      {hasCert === null ? null : !hasCert ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-orange-900/20 border border-orange-800 rounded-lg p-4 text-sm text-orange-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            É necessário fazer login no Cloudflare antes de criar um tunnel.
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => { onClose(); navigate('/setup') }}>
              <ExternalLink className="w-4 h-4" />
              Ir para setup
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            O nome é usado internamente no Cloudflare para identificar o tunnel.
          </p>
          <Input
            label="Nome do tunnel"
            placeholder="ex: homelab-tunnel"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              loading={loading}
              disabled={!name.trim()}
              onClick={handleCreate}
            >
              Criar tunnel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
