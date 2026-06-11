import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('flared_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('flared_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (password: string) =>
    api.post<{ token: string }>('/auth/login', { password }),
}

export const setupApi = {
  status: () => api.get<{ hasCert: boolean; hasTunnels: boolean }>('/setup/status'),
  startLogin: () => api.post<{ url?: string; alreadyLoggedIn?: boolean }>('/setup/login'),
  loginStatus: () => api.get<{ done: boolean }>('/setup/login/status'),
  createTunnel: (name: string, accountId?: string) =>
    api.post('/setup/tunnel', { name, accountId }),
  version: () => api.get<{ version: string }>('/setup/version'),
  listCloudflareTunnels: () => api.get('/setup/tunnels/cloudflare'),
  importTunnel: (tunnelId: string, name: string, accountId?: string) =>
    api.post('/setup/tunnel/import', { tunnelId, name, accountId }),
}

export const tunnelApi = {
  list: () => api.get('/tunnels'),
  get: (id: string) => api.get(`/tunnels/${id}`),
  delete: (id: string) => api.delete(`/tunnels/${id}`),
  start: (id: string) => api.post(`/tunnels/${id}/start`),
  stop: (id: string) => api.post(`/tunnels/${id}/stop`),
  restart: (id: string) => api.post(`/tunnels/${id}/restart`),
  logs: (id: string) => api.get(`/tunnels/${id}/logs`),
  systemVersion: () => api.get<{ version: string }>('/tunnels/system/version'),
  systemLatest: () => api.get<{ latest: string }>('/tunnels/system/latest'),
  systemUpdate: () => api.post('/tunnels/system/update'),
}

export const hostnameApi = {
  list: (tunnelId: string) => api.get(`/tunnels/${tunnelId}/hostnames`),
  create: (tunnelId: string, data: {
    hostname: string
    service: string
    noTLSVerify: boolean
    httpHostHeader: string
  }) => api.post(`/tunnels/${tunnelId}/hostnames`, data),
  update: (tunnelId: string, hostnameId: string, data: object) =>
    api.patch(`/tunnels/${tunnelId}/hostnames/${hostnameId}`, data),
  toggle: (tunnelId: string, hostnameId: string) =>
    api.post(`/tunnels/${tunnelId}/hostnames/${hostnameId}/toggle`),
  delete: (tunnelId: string, hostnameId: string) =>
    api.delete(`/tunnels/${tunnelId}/hostnames/${hostnameId}`),
}

export const accountApi = {
  list: () => api.get('/accounts'),
  create: (data: { name: string; apiToken: string }) =>
    api.post('/accounts', data),
  update: (id: string, data: { name?: string; apiToken?: string }) =>
    api.put(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
  listZones: (accountId: string) => api.get(`/accounts/${accountId}/zones`),
}

export default api
