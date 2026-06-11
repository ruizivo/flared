import { useState } from 'react'
import { Settings, RefreshCw, Shield, ArrowUpCircle, CheckCircle } from 'lucide-react'
import { tunnelApi } from '../services/api'
import { Button, Spinner } from '../components/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'

function extractVersion(raw: string): string {
  const m = raw.match(/(\d{4}\.\d+\.\d+)/)
  return m ? m[1] : raw.split('\n')[0]
}

function isOutdated(current: string, latest: string): boolean {
  const parse = (v: string) => v.split('.').map(Number) as [number, number, number]
  const [cy, cm, cp] = parse(current)
  const [ly, lm, lp] = parse(latest)
  if (ly !== cy) return ly > cy
  if (lm !== cm) return lm > cm
  return lp > cp
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const [updating, setUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState('')

  const { data: versionData } = useQuery({
    queryKey: ['cf-version'],
    queryFn: () => tunnelApi.systemVersion().then(r => r.data),
  })

  const { data: latestData, isLoading: loadingLatest } = useQuery({
    queryKey: ['cf-latest'],
    queryFn: () => tunnelApi.systemLatest().then(r => r.data),
    staleTime: 5 * 60 * 1000, // revalida a cada 5 min
  })

  const handleUpdate = async () => {
    setUpdating(true)
    setUpdateResult('')
    try {
      const res = await tunnelApi.systemUpdate()
      setUpdateResult(res.data.output || 'Atualizado com sucesso')
      qc.invalidateQueries({ queryKey: ['cf-version'] })
      qc.invalidateQueries({ queryKey: ['cf-latest'] })
    } catch (err: any) {
      setUpdateResult(err.response?.data?.error || 'Erro ao atualizar')
    } finally {
      setUpdating(false)
    }
  }

  const currentVersion = versionData?.version ? extractVersion(versionData.version) : null
  const latestVersion = latestData?.latest ?? null
  const outdated = currentVersion && latestVersion ? isOutdated(currentVersion, latestVersion) : false

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 text-sm mt-1">Gerenciamento do sistema</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* cloudflared version */}
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <Settings className="w-4 h-4 text-orange-500" />
            <h2 className="text-white font-medium">cloudflared</h2>
          </div>

          <div className="space-y-4">
            {/* versão instalada */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-gray-400 text-sm">Versão instalada</p>
                <p className="text-white text-sm font-mono mt-0.5">
                  {currentVersion ?? '—'}
                </p>
              </div>
              {/* badge de status */}
              <div className="shrink-0 mt-0.5">
                {loadingLatest ? (
                  <Spinner className="w-4 h-4 text-gray-400" />
                ) : outdated ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-900/40 text-orange-400 border border-orange-800">
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Atualização disponível
                  </span>
                ) : currentVersion && latestVersion ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-800">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Atualizado
                  </span>
                ) : null}
              </div>
            </div>

            {/* versão mais recente */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-gray-400 text-sm">Versão mais recente</p>
                <p className="text-white text-sm font-mono mt-0.5">
                  {loadingLatest ? '...' : (latestVersion ?? '—')}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={updating}
                onClick={handleUpdate}
                className="shrink-0"
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
            A senha de acesso é definida via variável de ambiente{' '}
            <code className="text-orange-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">FLARED_PASSWORD</code>.
            Para alterar, atualize a variável e reinicie o container.
          </p>
        </div>
      </div>
    </div>
  )
}
