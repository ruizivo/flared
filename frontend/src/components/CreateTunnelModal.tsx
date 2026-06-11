import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ExternalLink } from 'lucide-react'
import { setupApi, accountApi } from '../services/api'
import type { Account } from '../types'
import { Modal, Input, Button } from './ui'

interface Props {
  onClose: () => void
}

export default function CreateTunnelModal({ onClose }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [hasCert, setHasCert] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list().then(r => r.data),
  })

  useEffect(() => {
    setupApi.status().then(r => setHasCert(r.data.hasCert))
  }, [])

  useEffect(() => {
    if (accounts.length === 1) setAccountId(accounts[0].id)
  }, [accounts])

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await setupApi.createTunnel(name.trim(), accountId || undefined)
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

          {accounts.length > 1 && (
            <div>
              <label className="label">Conta Cloudflare</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
              >
                <option value="">Selecione uma conta</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {accounts.length === 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-sm">
              Nenhuma conta Cloudflare cadastrada. Adicione uma em{' '}
              <button
                className="underline font-medium"
                onClick={() => { onClose(); navigate('/accounts') }}
              >
                Contas
              </button>{' '}
              primeiro.
            </div>
          )}

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
