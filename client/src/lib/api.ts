import axios, { AxiosError } from 'axios'
import type { FieldError } from '../types'

const TOKEN_KEY = 'youthverse.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Emitted when the server rejects our token, so the app can log out. */
export const AUTH_EXPIRED_EVENT = 'youthverse:auth-expired'

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // A 401 on any call means the stored token is dead. Drop it and let the
    // app react, rather than leaving the UI in a half-authenticated state.
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

interface ApiErrorBody {
  message?: string
  errors?: FieldError[]
}

/** Turn an unknown thrown value into a message + per-field errors. */
export function unwrapError(error: unknown): { message: string; fields: FieldError[] } {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined
    if (body?.message) {
      return { message: body.message, fields: body.errors ?? [] }
    }
    if (error.code === 'ERR_NETWORK') {
      return {
        message: 'Cannot reach the server. Is the API running on port 5050?',
        fields: [],
      }
    }
    return { message: error.message, fields: [] }
  }
  return { message: 'Something went wrong. Please try again.', fields: [] }
}
