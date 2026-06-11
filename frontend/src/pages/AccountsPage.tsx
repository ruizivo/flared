import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Plus, Trash2, Edit2, Globe, ChevronDown } from 'lucide-react'
import { accountApi } from '../services/api'
import type { Account, CfZone } from '../types'
import { Button, Modal, Input, EmptyState, Spinner, Badge } from '../components/ui'

function ZonesList({ accountId }: { accountId: string }) {
  const { data: zones, isLoading, error } = useQuery<CfZone[]>({
    queryKey: ['account-zones', accountId],
    queryFn: () => accountApi.listZones(accountId).then(r => r.data),
  })

  if (isLoading) return <Spinner className="w-4 h-4 text-gray-500" />
  if (error) return <span className="text-red-400 text-xs">Erro ao carregar zones</span>
  if (!zones?.length) return <span className="text-gray-500 text-xs">Nenhuma zone</span>

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {zones.map(z => (
        <span key={z.id} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
          {z.name}
        </span>
      ))}
    </div>
  )
}

export default function AccountsPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', apiToken: '' })
  const [editForm, setEditForm] = useState({ name: '', apiToken: '' })
  const [error, setError] = useState('')

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => accountApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setAddOpen(false)
      setForm({ name: '', apiToken: '' })
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Erro ao adicionar conta')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => accountApi.update(editAccount!.id, {
      name: editForm.name || undefined,
      apiToken: editForm.apiToken || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setEditAccount(null)
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Erro ao atualizar conta')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setDeleteConfirm(null)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Erro ao remover conta')
    },
  })

  const openEdit = (account: Account) => {
    setEditAccount(account)
    setEditForm({ name: account.name, apiToken: '' })
    setError('')
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Contas Cloudflare</h1>
          <p className="text-gray-400 text-sm mt-1">Tokens API para gerenciar DNS e tunnels</p>
        </div>
        <Button onClick={() => { setAddOpen(true); setError('') }} className="shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          Adicionar conta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center pt-16"><Spinner /></div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<User className="w-12 h-12" />}
          title="Nenhuma conta cadastrada"
          description="Adicione um token API Cloudflare para começar a gerenciar tunnels e hostnames"
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Adicionar conta
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <div key={account.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{account.name}</p>
                    <p className="text-gray-500 text-xs font-mono truncate">token: ***</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                    title="Ver zones"
                  >
                    <Globe className="w-4 h-4 text-gray-400" />
                    <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${expandedId === account.id ? 'rotate-180' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(account)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDeleteConfirm(account); setError('') }}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {expandedId === account.id && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-gray-500 text-xs mb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Zones disponíveis nesta conta
                  </p>
                  <ZonesList accountId={account.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal adicionar */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setError('') }} title="Adicionar conta Cloudflare">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            O token precisa de permissões <strong className="text-gray-300">Zone:Read</strong> e{' '}
            <strong className="text-gray-300">Zone:DNS:Edit</strong>.
            Para importar tunnels, adicione também{' '}
            <strong className="text-gray-300">Account:Cloudflare Tunnel:Read</strong>.
          </p>
          <Input
            label="Nome da conta"
            placeholder="ex: Homelab, Trabalho..."
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            label="API Token"
            type="password"
            placeholder="cfut_..."
            value={form.apiToken}
            onChange={e => setForm(f => ({ ...f, apiToken: e.target.value }))}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setAddOpen(false); setError('') }}>
              Cancelar
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.name || !form.apiToken}
              onClick={() => createMutation.mutate()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editAccount} onClose={() => { setEditAccount(null); setError('') }} title="Editar conta">
        <div className="space-y-4">
          <Input
            label="Nome da conta"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Novo API Token (deixe vazio para manter)"
            type="password"
            placeholder="cfut_..."
            value={editForm.apiToken}
            onChange={e => setEditForm(f => ({ ...f, apiToken: e.target.value }))}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setEditAccount(null); setError('') }}>
              Cancelar
            </Button>
            <Button
              loading={updateMutation.isPending}
              disabled={!editForm.name}
              onClick={() => updateMutation.mutate()}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar delete */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setError('') }}
        title="Remover conta"
      >
        <p className="text-gray-300 text-sm mb-6">
          Tem certeza que deseja remover a conta{' '}
          <strong className="text-white">{deleteConfirm?.name}</strong>?
          Tunnels associados a esta conta não poderão gerenciar DNS.
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
