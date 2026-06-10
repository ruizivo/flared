import Elysia from 'elysia'
import { jwt } from '@elysiajs/jwt'

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.FLARED_JWT_SECRET || 'flared-secret-change-me',
    })
  )
  .derive({ as: 'scoped' }, async ({ headers, jwt, set }) => {
    const auth = headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      set.status = 401
      throw new Error('Token não fornecido')
    }
    const token = auth.slice(7)
    const payload = await jwt.verify(token)
    if (!payload) {
      set.status = 401
      throw new Error('Token inválido')
    }
    return { user: payload }
  })
