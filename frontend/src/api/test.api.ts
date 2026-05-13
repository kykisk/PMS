import apiClient from './client'

export interface TestCase {
  id: string; scenarioId: string; type: string; title: string
  priority: string; steps?: any; testData?: string; expected?: string
  actual?: string; result?: string; executedBy?: string; executedAt?: string
  status: string; createdAt: string; updatedAt: string
  executions?: TestExecution[]
}

export interface TestScenario {
  id: string; projectId: string; code: string; title: string
  description?: string; type: string; testType: string; testData?: string
  reqId?: string; featureId?: string; status: string
  outdated?: boolean; outdatedReason?: string | null
  createdAt: string; updatedAt: string
  testCases?: TestCase[]
  feature?: { id: string; code: string; title: string; requirement?: { id: string; code: string; title: string } }
  requirement?: { id: string; code: string; title: string }
  _count?: { testCases: number }
}

export interface TestCycle {
  id: string; projectId: string; code: string; title: string
  description?: string; scope: string; status: string
  startDate?: string; endDate?: string; createdAt: string; updatedAt: string
  stats?: { total: number; pass: number; fail: number; blocked: number; skipped: number; notExecuted: number; passRate: number }
}

export interface TestExecution {
  id: string; testCaseId: string; cycleId: string
  result: string; actual?: string; note?: string
  executedBy?: string; executedAt: string; createdAt: string
  testCase?: Partial<TestCase>; cycle?: Partial<TestCycle>
}

export interface Defect {
  id: string; projectId: string; code: string; title: string
  description?: string; severity: string; priority: string; status: string
  assigneeId?: string; reportedBy?: string; executionId?: string
  resolution?: string; resolvedAt?: string; createdAt: string; updatedAt: string
  execution?: Partial<TestExecution>
}

import { type PaginatedResponse } from './requirement.api'

export const testApi = {
  listScenarios: (projectId: string, query?: { reqId?: string; featureId?: string; type?: string; testType?: string; search?: string; page?: number; limit?: number }) =>
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
  getCaseExecutions: (projectId: string, cId: string) =>
    apiClient.get<TestExecution[]>(`/projects/${projectId}/test-cases/${cId}/executions`).then(r => r.data),

  listCycles: (projectId: string) =>
    apiClient.get<TestCycle[]>(`/projects/${projectId}/test-cycles`).then(r => r.data),
  getCycle: (projectId: string, cycleId: string) =>
    apiClient.get<TestCycle>(`/projects/${projectId}/test-cycles/${cycleId}`).then(r => r.data),
  createCycle: (projectId: string, data: Partial<TestCycle>) =>
    apiClient.post<TestCycle>(`/projects/${projectId}/test-cycles`, data).then(r => r.data),
  updateCycle: (projectId: string, cycleId: string, data: Partial<TestCycle>) =>
    apiClient.put<TestCycle>(`/projects/${projectId}/test-cycles/${cycleId}`, data).then(r => r.data),
  removeCycle: (projectId: string, cycleId: string) =>
    apiClient.delete(`/projects/${projectId}/test-cycles/${cycleId}`).then(r => r.data),
  getCycleStats: (projectId: string, cycleId: string) =>
    apiClient.get(`/projects/${projectId}/test-cycles/${cycleId}/stats`).then(r => r.data),
  getCycleExecutions: (projectId: string, cycleId: string) =>
    apiClient.get<TestExecution[]>(`/projects/${projectId}/test-cycles/${cycleId}/executions`).then(r => r.data),
  createExecution: (projectId: string, cycleId: string, data: { testCaseId: string; result: string; actual?: string; note?: string }) =>
    apiClient.post<TestExecution>(`/projects/${projectId}/test-cycles/${cycleId}/executions`, data).then(r => r.data),

  listDefects: (projectId: string, query?: { status?: string; severity?: string; priority?: string; search?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Defect>>(`/projects/${projectId}/defects`, { params: query }).then(r => r.data),
  getDefect: (projectId: string, defectId: string) =>
    apiClient.get<Defect>(`/projects/${projectId}/defects/${defectId}`).then(r => r.data),
  createDefect: (projectId: string, data: Partial<Defect>) =>
    apiClient.post<Defect>(`/projects/${projectId}/defects`, data).then(r => r.data),
  updateDefect: (projectId: string, defectId: string, data: Partial<Defect>) =>
    apiClient.put<Defect>(`/projects/${projectId}/defects/${defectId}`, data).then(r => r.data),
  removeDefect: (projectId: string, defectId: string) =>
    apiClient.delete(`/projects/${projectId}/defects/${defectId}`).then(r => r.data),

  getTestSummary: (projectId: string) =>
    apiClient.get(`/projects/${projectId}/test-stats/summary`).then(r => r.data),
}

export const traceApi = {
  matrix: (projectId: string) => apiClient.get(`/projects/${projectId}/traceability/matrix`).then(r => r.data),
  coverage: (projectId: string) => apiClient.get(`/projects/${projectId}/traceability/coverage`).then(r => r.data),
  createLink: (projectId: string, data: any) => apiClient.post(`/projects/${projectId}/traceability/links`, data).then(r => r.data),
  deleteLink: (projectId: string, data: any) => apiClient.delete(`/projects/${projectId}/traceability/links`, { data }).then(r => r.data),
}
