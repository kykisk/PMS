import apiClient from './client'

export interface Project {
  id: string
  name: string
  description?: string
  status: string
  startDate?: string
  endDate?: string
  createdBy: string
  createdAt: string
  members?: { user: { id: string; name: string; email: string } }[]
  _count?: { requirements: number; features: number; tasks: number; testScenarios: number }
}

export interface CreateProjectPayload {
  name: string
  description?: string
  startDate?: string
  endDate?: string
}

export const projectApi = {
  list: () => apiClient.get<Project[]>('/projects').then(r => r.data),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (data: CreateProjectPayload) => apiClient.post<Project>('/projects', data).then(r => r.data),
  update: (id: string, data: Partial<CreateProjectPayload & { status: string }>) =>
    apiClient.put<Project>(`/projects/${id}`, data).then(r => r.data),
  remove: (id: string) => apiClient.delete(`/projects/${id}`).then(r => r.data),
  dashboard: (id: string) => apiClient.get(`/projects/${id}/dashboard`).then(r => r.data),
  members: (id: string) => apiClient.get(`/projects/${id}/members`).then(r => r.data),
  addMember: (id: string, userId: string) =>
    apiClient.post(`/projects/${id}/members`, { userId }).then(r => r.data),
  removeMember: (id: string, userId: string) =>
    apiClient.delete(`/projects/${id}/members/${userId}`).then(r => r.data),
}
