import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ExternalLink, CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import { setupApi } from '../services/api'
import { Button, Input } from '../components/ui'

type Step = 'check' | 'login' | 'wait-auth' | 'create-tunnel' | 'done'

export default function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('check')
  const [loginUrl, setLoginUrl] = useState('')
  const [tunnelName, setTunnelName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    checkStatus()
  }, [])

  // polling para detectar quando cert.pem foi criado
  useEffect(() => {
    if (step !== 'wait-auth') return
    const interval = setInterval(async () => {
      const res = await setupApi.loginStatus()
      if (res.data.done) {
        clearInterval(interval)
        setStep('create-tunnel')
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [step])

  const checkStatus = async () => {
    setLoading(true)
    try {
      const res = await setupApi.status()
      if (res.data.hasCert && res.data.hasTunnels) {
        navigate('/dashboard')
      } else if (res.data.hasCert) {
        setStep('create-tunnel')
      } else {
        setStep('login')
      }
    } finally {
      setLoading(false)
    }
  }

  const startLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await setupApi.startLogin()
      if (res.data.alreadyLoggedIn) {
        setStep('create-tunnel')
      } else if (res.data.url) {
        setLoginUrl(res.data.url)
        setStep('wait-auth')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao iniciar login')
    } finally {
      setLoading(false)
    }
  }

  const createTunnel = async () => {
    if (!tunnelName.trim()) return
    setLoading(true)
    setError('')
    try {
      await setupApi.createTunnel(tunnelName.trim())
      setStep('done')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar tunnel')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'check') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center mb-4">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuração inicial</h1>
          <p className="text-gray-400 text-sm mt-1">Vamos conectar o flared ao Cloudflare</p>
        </div>

        <div className="card space-y-6">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={step === 'login' || step === 'wait-auth' ? 'text-orange-400 font-medium' : 'text-green-400'}>
              1. Login Cloudflare
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className={step === 'create-tunnel' ? 'text-orange-400 font-medium' : step === 'done' ? 'text-green-400' : ''}>
              2. Criar Tunnel
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className={step === 'done' ? 'text-green-400 font-medium' : ''}>
              3. Pronto
            </span>
          </div>

          {/* Step: login */}
          {step === 'login' && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Clique abaixo para iniciar a autenticação no Cloudflare. Você será redirecionado para autorizar o acesso.
              </p>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button onClick={startLogin} loading={loading} className="w-full justify-center">
                Conectar ao Cloudflare
              </Button>
            </div>
          )}

          {/* Step: aguardando auth */}
          {step === 'wait-auth' && (
            <div className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <p className="text-orange-300 text-sm font-medium mb-2">Ação necessária</p>
                <p className="text-gray-300 text-sm mb-3">
                  Abra o link abaixo no seu browser, faça login no Cloudflare e autorize o acesso.
                </p>
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm underline"
                >
                  Abrir página de autorização
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                Aguardando autorização...
              </div>
            </div>
          )}

          {/* Step: criar tunnel */}
          {step === 'create-tunnel' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Cloudflare autenticado com sucesso
              </div>
              <p className="text-gray-300 text-sm">
                Agora crie o seu primeiro tunnel. O nome é usado internamente no Cloudflare.
              </p>
              <Input
                label="Nome do tunnel"
                placeholder="ex: homelab-tunnel"
                value={tunnelName}
                onChange={e => setTunnelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTunnel()}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button
                onClick={createTunnel}
                loading={loading}
                disabled={!tunnelName.trim()}
                className="w-full justify-center"
              >
                Criar tunnel
              </Button>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
              <p className="text-gray-200 font-medium">Tudo pronto!</p>
              <p className="text-gray-400 text-sm">Redirecionando para o dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
