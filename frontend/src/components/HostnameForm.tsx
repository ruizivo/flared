import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hostnameApi, accountApi } from '../services/api'
import type { Tunnel, CfZone } from '../types'
import { Modal, Input, Button, Toggle } from './ui'

interface HostnameFormProps {
  tunnel: Tunnel
  onClose: () => void
  onSuccess: () => void
}

export default function HostnameForm({ tunnel, onClose, onSuccess }: HostnameFormProps) {
  const [subdomain, setSubdomain] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [service, setService] = useState('https://localhost:443')
  const [noTLSVerify, setNoTLSVerify] = useState(true)
  const [httpHostHeader, setHttpHostHeader] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasAccount = !!tunnel.accountId

  const { data: zones = [], isLoading: loadingZones } = useQuery<CfZone[]>({
    queryKey: ['account-zones', tunnel.accountId],
    queryFn: () => accountApi.listZones(tunnel.accountId).then(r => r.data),
    enabled: hasAccount,
  })

  const hostname = selectedZone ? (subdomain ? `${subdomain}.${selectedZone}` : selectedZone) : subdomain

  const handleSubdomainChange = (val: string) => {
    setSubdomain(val)
    const computed = selectedZone ? (val ? `${val}.${selectedZone}` : selectedZone) : val
    if (!httpHostHeader || httpHostHeader === (subdomain ? `${subdomain}.${selectedZone}` : subdomain)) {
      setHttpHostHeader(computed)
    }
  }

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone)
    const computed = subdomain ? `${subdomain}.${zone}` : zone
    if (!httpHostHeader || httpHostHeader === hostname) {
      setHttpHostHeader(computed)
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
        {!hasAccount && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-sm">
            Este tunnel não tem uma conta Cloudflare associada. Associe uma conta para gerenciar DNS.
          </div>
        )}

        {hasAccount && zones.length === 0 && !loadingZones && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-sm">
            Nenhuma zone encontrada na conta. Verifique as permissões do token.
          </div>
        )}

        {/* Subdomain + Zone selector */}
        <div>
          <label className="label">Hostname</label>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="app"
              value={subdomain}
              onChange={e => handleSubdomainChange(e.target.value)}
              className="flex-1"
            />
            {zones.length > 0 && (
              <>
                <span className="text-gray-500 text-sm shrink-0">.</span>
                <select
                  value={selectedZone}
                  onChange={e => handleZoneChange(e.target.value)}
                  required
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">Selecione o domínio</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.name}>{z.name}</option>
                  ))}
                </select>
              </>
            )}
            {hasAccount && loadingZones && (
              <span className="text-gray-500 text-xs shrink-0">Carregando...</span>
            )}
          </div>
          {hostname && (
            <p className="text-gray-500 text-xs mt-1.5">
              Hostname completo: <span className="text-gray-300 font-mono">{hostname}</span>
            </p>
          )}
        </div>

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
          <Button
            type="submit"
            loading={loading}
            disabled={!hostname || !service || (hasAccount && zones.length > 0 && !selectedZone)}
          >
            Adicionar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
