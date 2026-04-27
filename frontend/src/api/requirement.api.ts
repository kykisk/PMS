import apiClient from './client'

export interface Requirement {
  id: string
  projectId: string
  code: string
  title: string
  description?: string
  category?: string
  priority: string
  status: string
  source: string
  note?: string
  createdAt: string
  updatedAt: string
  features?: { id: string; code: string; title: string; status: string }[]
}

export interface RequirementPayload {
  title: string
  description?: string
  category?: string
  priority?: string
  status?: string
  note?: string
}

export interface RequirementQuery {
  status?: string
  priority?: string
  category?: string
  search?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const requirementApi = {
  list: (projectId: string, query?: RequirementQuery & { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Requirement>>(`/projects/${projectId}/requirements`, { params: query }).then(r => r.data),
  get: (projectId: string, reqId: string) =>
    apiClient.get<Requirement>(`/projects/${projectId}/requirements/${reqId}`).then(r => r.data),
  create: (projectId: string, data: RequirementPayload) =>
    apiClient.post<Requirement>(`/projects/${projectId}/requirements`, data).then(r => r.data),
  update: (projectId: string, reqId: string, data: Partial<RequirementPayload>) =>
    apiClient.put<Requirement>(`/projects/${projectId}/requirements/${reqId}`, data).then(r => r.data),
  remove: (projectId: string, reqId: string) =>
    apiClient.delete(`/projects/${projectId}/requirements/${reqId}`).then(r => r.data),
}
