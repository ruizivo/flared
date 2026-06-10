import { useState } from 'react'
import { Settings, RefreshCw, Shield } from 'lucide-react'
import { tunnelApi } from '../services/api'
import { Button } from '../components/ui'
import { useQuery } from '@tanstack/react-query'

export default function SettingsPage() {
  const [updating, setUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState('')

  const { data: versionData, refetch } = useQuery({
    queryKey: ['cf-version'],
    queryFn: () => tunnelApi.systemVersion().then(r => r.data),
  })

  const handleUpdate = async () => {
    setUpdating(true)
    setUpdateResult('')
    try {
      const res = await tunnelApi.systemUpdate()
      setUpdateResult(res.data.output || 'Atualizado com sucesso')
      refetch()
    } catch (err: any) {
      setUpdateResult(err.response?.data?.error || 'Erro ao atualizar')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 text-sm mt-1">Gerenciamento do sistema</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* cloudflared version */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-4 h-4 text-orange-500" />
            <h2 className="text-white font-medium">cloudflared</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Versão instalada</p>
                <p className="text-white text-sm font-mono mt-0.5">
                  {versionData?.version?.split('\n')[0] || '—'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={updating}
                onClick={handleUpdate}
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
            </div>
            {updateResult && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-300 text-xs font-mono whitespace-pre-wrap">{updateResult}</p>
              </div>
            )}
          </div>
        </div>

        {/* Auth info */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-4 h-4 text-orange-500" />
            <h2 className="text-white font-medium">Autenticação</h2>
          </div>
          <p className="text-gray-400 text-sm">
            A senha de acesso é definida via variável de ambiente <code className="text-orange-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">FLARED_PASSWORD</code>.
            Para alterar, atualize a variável e reinicie o container.
          </p>
        </div>
      </div>
    </div>
  )
}
