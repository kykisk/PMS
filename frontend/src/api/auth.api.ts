import apiClient from './client'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; name: string; password: string }
export interface AuthResponse { accessToken: string; refreshToken: string }
export interface User {
  id: string; email: string; name: string; nameEn?: string; role: 'ADMIN' | 'USER';
  language: string; phone?: string; department?: string; position?: string; avatarUrl?: string; createdAt: string;
}
export interface UpdateProfilePayload { name?: string; nameEn?: string; email?: string; phone?: string; department?: string; position?: string }

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  register: (data: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),
  refresh: () =>
    apiClient.post<AuthResponse>('/auth/refresh').then((r) => r.data),
  updateProfile: (data: UpdateProfilePayload) =>
    apiClient.put<User>('/auth/profile', data).then((r) => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/auth/password', data).then((r) => r.data),
  listPersonalLLMs: () => apiClient.get('/auth/llm').then(r => r.data),
  createPersonalLLM: (data: { provider: string; model: string; apiKey: string; region?: string }) => apiClient.post('/auth/llm', data).then(r => r.data),
  updatePersonalLLM: (id: string, data: any) => apiClient.put(`/auth/llm/${id}`, data).then(r => r.data),
  deletePersonalLLM: (id: string) => apiClient.delete(`/auth/llm/${id}`).then(r => r.data),
}
