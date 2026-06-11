import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertCircle, Download } from 'lucide-react'
import { setupApi, accountApi } from '../services/api'
import type { CloudflareTunnel, Account } from '../types'
import { Modal, Button, Badge, Spinner } from './ui'

interface Props {
  onClose: () => void
}

export default function ImportTunnelModal({ onClose }: Props) {
  const qc = useQueryClient()
  const [accountId, setAccountId] = useState('')

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list().then(r => r.data),
  })

  useEffect(() => {
    if (accounts.length === 1) setAccountId(accounts[0].id)
  }, [accounts])

  const { data: tunnels = [], isLoading, error } = useQuery<CloudflareTunnel[]>({
    queryKey: ['cf-tunnels'],
    queryFn: () => setupApi.listCloudflareTunnels().then(r => r.data),
  })

  const importMutation = useMutation({
    mutationFn: ({ tunnelId, name }: { tunnelId: string; name: string }) =>
      setupApi.importTunnel(tunnelId, name, accountId || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tunnels'] })
      qc.invalidateQueries({ queryKey: ['cf-tunnels'] })
    },
  })

  const errorMessage = (error as any)?.response?.data?.error ?? (error as any)?.message

  return (
    <Modal open onClose={onClose} title="Importar tunnel do Cloudflare" size="lg">
      {accounts.length > 1 && (
        <div className="mb-4">
          <label className="label">Associar a conta</label>
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

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : errorMessage ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-red-900/20 border border-red-800 rounded-lg p-4 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {errorMessage}
          </div>
          {errorMessage.includes('permissão') && (
            <p className="text-gray-500 text-xs">
              No painel Cloudflare → My Profile → API Tokens → edite o token e adicione{' '}
              <span className="text-gray-400 font-medium">Account → Cloudflare Tunnel → Read</span>.
            </p>
          )}
        </div>
      ) : tunnels.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          Nenhum tunnel encontrado na sua conta Cloudflare.
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {tunnels.map(t => (
            <div
              key={t.tunnelId}
              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-800"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'healthy' ? 'bg-green-400' : 'bg-gray-600'}`} />
                <div className="min-w-0">
                  <p className="text-gray-200 text-sm font-medium truncate">{t.name}</p>
                  <p className="text-gray-500 text-xs font-mono truncate">{t.tunnelId}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {t.imported ? (
                  <div className="flex items-center gap-1.5 text-green-400 text-xs">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Importado
                  </div>
                ) : !t.hasCredentials ? (
                  <Badge variant="gray">Sem credenciais</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={importMutation.isPending && importMutation.variables?.tunnelId === t.tunnelId}
                    onClick={() => importMutation.mutate({ tunnelId: t.tunnelId, name: t.name })}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Importar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && tunnels.some(t => !t.hasCredentials && !t.imported) && (
        <p className="text-gray-500 text-xs mt-4">
          Tunnels sem credenciais precisam ser recriados via{' '}
          <code className="text-gray-400">cloudflared tunnel create</code> neste ambiente.
        </p>
      )}

      <div className="flex justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  )
}
