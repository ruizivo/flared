import { useQuery } from '@tanstack/react-query'
import { Network, Globe, Activity, RefreshCw } from 'lucide-react'
import { tunnelApi, setupApi } from '../services/api'
import type { Tunnel } from '../types'
import { Badge, Button, Spinner } from '../components/ui'
import { useState } from 'react'

export default function DashboardPage() {
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')

  const { data: tunnels = [], isLoading } = useQuery<Tunnel[]>({
    queryKey: ['tunnels'],
    queryFn: () => tunnelApi.list().then(r => r.data),
    refetchInterval: 5000,
  })

  const { data: versionData } = useQuery({
    queryKey: ['cf-version'],
    queryFn: () => tunnelApi.systemVersion().then(r => r.data),
  })

  const handleUpdate = async () => {
    setUpdating(true)
    setUpdateMsg('')
    try {
      const res = await tunnelApi.systemUpdate()
      setUpdateMsg(res.data.output || 'Atualizado com sucesso')
    } catch (err: any) {
      setUpdateMsg(err.response?.data?.error || 'Erro ao atualizar')
    } finally {
      setUpdating(false)
    }
  }

  const running = tunnels.filter(t => t.running).length
  const totalHostnames = tunnels.reduce((acc, t) => acc + t.hostnames.length, 0)
  const activeHostnames = tunnels.reduce((acc, t) => acc + t.hostnames.filter(h => h.active).length, 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Visão geral da sua infraestrutura</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Tunnels ativos</span>
                <Network className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-white">{running}</div>
              <div className="text-gray-500 text-xs mt-1">de {tunnels.length} configurados</div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Hostnames ativos</span>
                <Globe className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-white">{activeHostnames}</div>
              <div className="text-gray-500 text-xs mt-1">de {totalHostnames} configurados</div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">cloudflared</span>
                <Activity className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-lg font-bold text-white truncate">
                {versionData?.version?.split('\n')[0] || '—'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={updating}
                onClick={handleUpdate}
                className="mt-2 -ml-2 text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar
              </Button>
              {updateMsg && (
                <p className="text-xs text-gray-400 mt-1">{updateMsg}</p>
              )}
            </div>
          </div>

          {/* Tunnels list */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Tunnels</h2>
            {tunnels.length === 0 ? (
              <div className="card text-center py-12">
                <Network className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Nenhum tunnel configurado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tunnels.map(tunnel => (
                  <div key={tunnel.id} className="card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${tunnel.running ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <div>
                        <p className="text-white font-medium">{tunnel.name}</p>
                        <p className="text-gray-500 text-xs font-mono">{tunnel.tunnelId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={tunnel.running ? 'green' : 'gray'}>
                        {tunnel.running ? 'Rodando' : 'Parado'}
                      </Badge>
                      <span className="text-gray-500 text-xs">
                        {tunnel.hostnames.filter(h => h.active).length} hostname(s)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
