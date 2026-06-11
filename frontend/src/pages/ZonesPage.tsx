import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Plus, Trash2 } from 'lucide-react'
import { zoneApi } from '../services/api'
import type { Zone } from '../types'
import { Button, Modal, Input, EmptyState, Spinner, Badge } from '../components/ui'

export default function ZonesPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Zone | null>(null)
  const [form, setForm] = useState({ zoneId: '', apiToken: '', domain: '' })
  const [error, setError] = useState('')

  const { data: zones = [], isLoading } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => zoneApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => zoneApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      setAddOpen(false)
      setForm({ zoneId: '', apiToken: '', domain: '' })
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Erro ao adicionar zone')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => zoneApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      setDeleteConfirm(null)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Erro ao remover zone')
    },
  })

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Zones</h1>
          <p className="text-gray-400 text-sm mt-1">Domínios Cloudflare configurados</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          Adicionar zone
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center pt-16"><Spinner /></div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={<Globe className="w-12 h-12" />}
          title="Nenhuma zone cadastrada"
          description="Adicione um domínio Cloudflare para começar a criar hostnames"
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Adicionar zone
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {zones.map(zone => (
            <div key={zone.id} className="card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <Globe className="w-4 h-4 text-orange-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{zone.domain}</p>
                  <p className="text-gray-500 text-xs font-mono truncate hidden sm:block">{zone.zoneId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="green" className="hidden sm:inline-flex">Configurado</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(zone)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal adicionar */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setError('') }} title="Adicionar zone">
        <div className="space-y-4">
          <Input
            label="Zone ID"
            placeholder="abc123def456..."
            value={form.zoneId}
            onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}
          />
          <Input
            label="API Token"
            type="password"
            placeholder="Token com permissão Zone:DNS:Edit"
            value={form.apiToken}
            onChange={e => setForm(f => ({ ...f, apiToken: e.target.value }))}
          />
          <Input
            label="Domínio (opcional)"
            placeholder="seudominio.com"
            value={form.domain}
            onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
          />
          <p className="text-gray-500 text-xs">
            O Zone ID e API Token estão disponíveis no painel do Cloudflare.
            O domínio será detectado automaticamente se não informado.
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setAddOpen(false); setError('') }}>
              Cancelar
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.zoneId || !form.apiToken}
              onClick={() => createMutation.mutate()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar delete */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Remover zone"
      >
        <p className="text-gray-300 text-sm mb-6">
          Tem certeza que deseja remover a zone <strong className="text-white">{deleteConfirm?.domain}</strong>?
          Isso só é possível se não houver hostnames usando esta zone.
        </p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setDeleteConfirm(null); setError('') }}>
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
