import Elysia, { t } from 'elysia'
import { jwt } from '@elysiajs/jwt'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.FLARED_JWT_SECRET || 'flared-secret-change-me',
      exp: process.env.FLARED_JWT_EXPIRY || '24h',
    })
  )
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const password = process.env.FLARED_PASSWORD
      if (!password) {
        set.status = 500
        return { error: 'FLARED_PASSWORD não configurado' }
      }
      if (body.password !== password) {
        set.status = 401
        return { error: 'Senha inválida' }
      }
      const token = await jwt.sign({ role: 'admin' })
      return { token }
    },
    {
      body: t.Object({ password: t.String() }),
    }
  )
  .post('/verify', async ({ headers, jwt, set }) => {
    const auth = headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      set.status = 401
      return { error: 'Token não fornecido' }
    }
    const token = auth.slice(7)
    const payload = await jwt.verify(token)
    if (!payload) {
      set.status = 401
      return { error: 'Token inválido' }
    }
    return { valid: true }
  })
