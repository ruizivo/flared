import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Network, Plus, Play, Square, RotateCcw, Trash2, ChevronDown, ChevronRight, Terminal, Download, FolderPlus } from 'lucide-react'
import { tunnelApi, hostnameApi } from '../services/api'
import type { Tunnel, Hostname } from '../types'
import { Button, Badge, Modal, Toggle, EmptyState, Spinner } from '../components/ui'
import LogsModal from '../components/LogsModal'
import HostnameForm from '../components/HostnameForm'
import ImportTunnelModal from '../components/ImportTunnelModal'
import CreateTunnelModal from '../components/CreateTunnelModal'

export default function TunnelsPage() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logsModal, setLogsModal] = useState<Tunnel | null>(null)
  const [addHostname, setAddHostname] = useState<Tunnel | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Tunnel | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const { data: tunnels = [], isLoading } = useQuery<Tunnel[]>({
    queryKey: ['tunnels'],
    queryFn: () => tunnelApi.list().then(r => r.data),
    refetchInterval: 5000,
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => tunnelApi.start(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnels'] }),
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => tunnelApi.stop(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnels'] }),
  })

  const restartMutation = useMutation({
    mutationFn: (id: string) => tunnelApi.restart(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnels'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tunnelApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tunnels'] })
      setDeleteConfirm(null)
    },
  })

  const toggleHostname = useMutation({
    mutationFn: ({ tunnelId, hostnameId }: { tunnelId: string; hostnameId: string }) =>
      hostnameApi.toggle(tunnelId, hostnameId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnels'] }),
  })

  const deleteHostname = useMutation({
    mutationFn: ({ tunnelId, hostnameId }: { tunnelId: string; hostnameId: string }) =>
      hostnameApi.delete(tunnelId, hostnameId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tunnels'] }),
  })

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex justify-center pt-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tunnels</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie seus Cloudflare Tunnels</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <FolderPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Criar tunnel</span>
          </Button>
        </div>
      </div>

      {tunnels.length === 0 ? (
        <EmptyState
          icon={<Network className="w-12 h-12" />}
          title="Nenhum tunnel configurado"
          description="Crie um tunnel no setup para começar"
        />
      ) : (
        <div className="space-y-4">
          {tunnels.map(tunnel => (
            <div key={tunnel.id} className="card p-0 overflow-hidden">
              {/* Header do tunnel */}
              <div className="flex items-center justify-between p-4 md:p-5 gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => setExpanded(expanded === tunnel.id ? null : tunnel.id)}
                    className="text-gray-400 hover:text-gray-200 shrink-0"
                  >
                    {expanded === tunnel.id
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                    }
                  </button>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${tunnel.running ? 'bg-green-400 shadow-sm shadow-green-400' : 'bg-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{tunnel.name}</p>
                    <p className="text-gray-500 text-xs font-mono truncate hidden sm:block">{tunnel.tunnelId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                  <Badge variant={tunnel.running ? 'green' : 'gray'} className="hidden sm:inline-flex">
                    {tunnel.running ? 'Rodando' : 'Parado'}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogsModal(tunnel)}
                    title="Logs"
                  >
                    <Terminal className="w-4 h-4" />
                  </Button>

                  {tunnel.running ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={restartMutation.isPending}
                        onClick={() => restartMutation.mutate(tunnel.id)}
                        title="Reiniciar"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={stopMutation.isPending}
                        onClick={() => stopMutation.mutate(tunnel.id)}
                        title="Parar"
                      >
                        <Square className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={startMutation.isPending}
                      onClick={() => startMutation.mutate(tunnel.id)}
                      title="Iniciar"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(tunnel)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Hostnames expandidos */}
              {expanded === tunnel.id && (
                <div className="border-t border-gray-800">
                  <div className="flex items-center justify-between px-4 md:px-5 py-3 bg-gray-800/30">
                    <span className="text-gray-400 text-sm font-medium">
                      Hostnames ({tunnel.hostnames.length})
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAddHostname(tunnel)}
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </Button>
                  </div>

                  {tunnel.hostnames.length === 0 ? (
                    <div className="px-4 md:px-5 py-8 text-center">
                      <p className="text-gray-500 text-sm">Nenhum hostname configurado</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800/50">
                      {tunnel.hostnames.map((h: Hostname) => (
                        <div key={h.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 md:px-5 py-3 gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <Toggle
                              checked={h.active}
                              onChange={() => toggleHostname.mutate({
                                tunnelId: tunnel.id,
                                hostnameId: h.id,
                              })}
                            />
                            <div className="min-w-0">
                              <p className="text-gray-200 text-sm font-medium truncate">{h.hostname}</p>
                              <p className="text-gray-500 text-xs truncate">{h.service}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-10 sm:ml-4 shrink-0">
                            {h.noTLSVerify && (
                              <Badge variant="orange">noTLS</Badge>
                            )}
                            <Badge variant={h.active ? 'green' : 'gray'}>
                              {h.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHostname.mutate({
                                tunnelId: tunnel.id,
                                hostnameId: h.id,
                              })}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {logsModal && (
        <LogsModal
          tunnel={logsModal}
          onClose={() => setLogsModal(null)}
        />
      )}

      {addHostname && (
        <HostnameForm
          tunnel={addHostname}
          onClose={() => setAddHostname(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['tunnels'] })
            setAddHostname(null)
          }}
        />
      )}

      {showCreate && (
        <CreateTunnelModal onClose={() => setShowCreate(false)} />
      )}

      {showImport && (
        <ImportTunnelModal onClose={() => setShowImport(false)} />
      )}

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Remover tunnel"
      >
        <p className="text-gray-300 text-sm mb-6">
          Tem certeza que deseja remover o tunnel <strong className="text-white">{deleteConfirm?.name}</strong>?
          Todos os hostnames serão removidos e o tunnel será parado.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
          >
            Remover
          </Button>
        </div>
      </Modal>
    </div>
  )
}
