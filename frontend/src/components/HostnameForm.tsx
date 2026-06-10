import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hostnameApi, zoneApi } from '../services/api'
import type { Tunnel, Zone } from '../types'
import { Modal, Input, Button, Toggle } from './ui'

interface HostnameFormProps {
  tunnel: Tunnel
  onClose: () => void
  onSuccess: () => void
}

export default function HostnameForm({ tunnel, onClose, onSuccess }: HostnameFormProps) {
  const [hostname, setHostname] = useState('')
  const [service, setService] = useState('https://localhost:443')
  const [noTLSVerify, setNoTLSVerify] = useState(true)
  const [httpHostHeader, setHttpHostHeader] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => zoneApi.list().then(r => r.data),
  })

  const handleHostnameChange = (val: string) => {
    setHostname(val)
    if (!httpHostHeader || httpHostHeader === hostname) {
      setHttpHostHeader(val)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await hostnameApi.create(tunnel.id, {
        hostname,
        service,
        noTLSVerify,
        httpHostHeader: httpHostHeader || hostname,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar hostname')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Adicionar hostname">
      <form onSubmit={handleSubmit} className="space-y-4">
        {zones.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-sm">
            Nenhuma zone cadastrada. Adicione uma zone em <strong>Zones</strong> primeiro.
          </div>
        )}

        <Input
          label="Hostname"
          placeholder="app.seudominio.com"
          value={hostname}
          onChange={e => handleHostnameChange(e.target.value)}
          required
        />

        <Input
          label="Serviço (URL de destino)"
          placeholder="https://localhost:443"
          value={service}
          onChange={e => setService(e.target.value)}
          required
        />

        <div className="flex items-center justify-between">
          <div>
            <label className="label mb-0">No TLS Verify</label>
            <p className="text-gray-500 text-xs">Ignora validação do certificado na origem</p>
          </div>
          <Toggle checked={noTLSVerify} onChange={setNoTLSVerify} />
        </div>

        <Input
          label="HTTP Host Header"
          placeholder="app.seudominio.com"
          value={httpHostHeader}
          onChange={e => setHttpHostHeader(e.target.value)}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={!hostname || !service}>
            Adicionar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
