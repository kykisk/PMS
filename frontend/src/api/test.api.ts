import apiClient from './client'

export interface TestCase {
  id: string; scenarioId: string; type: string; title: string
  steps?: any; testData?: string; expected?: string; actual?: string
  result?: string; executedBy?: string; executedAt?: string; status: string
  createdAt: string; updatedAt: string
}

export interface TestScenario {
  id: string; projectId: string; code: string; title: string
  description?: string; type: string; testData?: string
  reqId?: string; featureId?: string; status: string; createdAt: string
  testCases?: TestCase[]
  feature?: { id: string; code: string; title: string; requirement?: { id: string; code: string; title: string } }
  _count?: { testCases: number }
}

import { type PaginatedResponse } from './requirement.api'

export const testApi = {
  listScenarios: (projectId: string, query?: { reqId?: string; featureId?: string; type?: string; search?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<TestScenario>>(`/projects/${projectId}/test-scenarios`, { params: query }).then(r => r.data),
  getScenario: (projectId: string, sId: string) =>
    apiClient.get<TestScenario>(`/projects/${projectId}/test-scenarios/${sId}`).then(r => r.data),
  createScenario: (projectId: string, data: Partial<TestScenario>) =>
    apiClient.post<TestScenario>(`/projects/${projectId}/test-scenarios`, data).then(r => r.data),
  updateScenario: (projectId: string, sId: string, data: Partial<TestScenario>) =>
    apiClient.put<TestScenario>(`/projects/${projectId}/test-scenarios/${sId}`, data).then(r => r.data),
  removeScenario: (projectId: string, sId: string) =>
    apiClient.delete(`/projects/${projectId}/test-scenarios/${sId}`).then(r => r.data),
  createCase: (projectId: string, sId: string, data: Partial<TestCase>) =>
    apiClient.post<TestCase>(`/projects/${projectId}/test-scenarios/${sId}/cases`, data).then(r => r.data),
  updateCase: (projectId: string, cId: string, data: Partial<TestCase>) =>
    apiClient.put<TestCase>(`/projects/${projectId}/test-cases/${cId}`, data).then(r => r.data),
  executeCase: (projectId: string, cId: string, result: string, actual?: string) =>
    apiClient.put<TestCase>(`/projects/${projectId}/test-cases/${cId}/execute`, { result, actual }).then(r => r.data),
  removeCase: (projectId: string, cId: string) =>
    apiClient.delete(`/projects/${projectId}/test-cases/${cId}`).then(r => r.data),
}

export const traceApi = {
  matrix: (projectId: string) => apiClient.get(`/projects/${projectId}/traceability/matrix`).then(r => r.data),
  coverage: (projectId: string) => apiClient.get(`/projects/${projectId}/traceability/coverage`).then(r => r.data),
  createLink: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/traceability/links`, data).then(r => r.data),
  deleteLink: (projectId: string, data: any) => apiClient.delete(`/projects/${projectId}/traceability/links`, { data }).then(r => r.data),
}
