import { api } from './api'
import type { Me } from '../types'

export async function register(payload: {
  email: string
  password: string
  full_name: string
  business_name: string
}): Promise<string> {
  const { data } = await api.post('/auth/register', payload)
  return data.access_token as string
}

export async function login(email: string, password: string): Promise<string> {
  const { data } = await api.post('/auth/login', { email, password })
  return data.access_token as string
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get('/auth/me')
  return data
}
