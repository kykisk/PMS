import apiClient from './client'

export interface Feature {
  id: string
  projectId: string
  reqId: string
  code: string
  title: string
  description?: string
  screenDesign?: string
  status: string
  createdAt: string
  updatedAt: string
  requirement?: { id: string; code: string; title: string; status: string; priority?: string }
  tasks?: { id: string; code: string; title: string; progress: number; status: string; assigneeId?: string }[]
  testScenarios?: { id: string; code: string; title: string; status: string }[]
}

export interface FeaturePayload {
  title: string
  description?: string
  reqId?: string
  status?: string
}

import { type PaginatedResponse } from './requirement.api'

export const featureApi = {
  list: (projectId: string, query?: { reqId?: string; status?: string; search?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<Feature>>(`/projects/${projectId}/features`, { params: query }).then(r => r.data),
  get: (projectId: string, featureId: string) =>
    apiClient.get<Feature>(`/projects/${projectId}/features/${featureId}`).then(r => r.data),
  create: (projectId: string, data: FeaturePayload) =>
    apiClient.post<Feature>(`/projects/${projectId}/features`, data).then(r => r.data),
  update: (projectId: string, featureId: string, data: Partial<FeaturePayload>) =>
    apiClient.put<Feature>(`/projects/${projectId}/features/${featureId}`, data).then(r => r.data),
  remove: (projectId: string, featureId: string) =>
    apiClient.delete(`/projects/${projectId}/features/${featureId}`).then(r => r.data),
  uploadScreen: (projectId: string, featureId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post(`/projects/${projectId}/features/${featureId}/screen`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  link: (projectId: string, featureId: string, reqId: string) =>
    apiClient.post(`/projects/${projectId}/features/${featureId}/link`, { reqId }).then(r => r.data),
  unlink: (projectId: string, featureId: string) =>
    apiClient.delete(`/projects/${projectId}/features/${featureId}/link`).then(r => r.data),
}
