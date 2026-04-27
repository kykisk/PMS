import apiClient from './client'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; name: string; password: string }
export interface AuthResponse { accessToken: string; refreshToken: string }
export interface User { id: string; email: string; name: string; role: 'ADMIN' | 'USER'; language: string }

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  register: (data: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),
  refresh: () =>
    apiClient.post<AuthResponse>('/auth/refresh').then((r) => r.data),
}
