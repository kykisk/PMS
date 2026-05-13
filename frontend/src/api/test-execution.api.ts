import apiClient from './client'

export interface TestPhase {
  id: string; projectId: string; code: string; title: string
  description?: string; status: string; startDate?: string; endDate?: string
  snapshotAt?: string; outdated: boolean; createdAt: string; updatedAt: string
  roundCount?: number; latestRound?: TestRound | null
  rounds?: TestRound[]
}

export interface TestRound {
  id: string; phaseId: string; roundNumber: number
  testerName: string; testerDept?: string; executedAt?: string
  scope: string; sourceRoundId?: string
  totalCases: number; passCount: number; failCount: number
  blockedCount: number; naCount: number
  importedAt?: string; createdAt: string; updatedAt: string
  results?: TestRoundResult[]
}

export interface TestRoundResult {
  id: string; roundId: string; scenarioCode: string; caseTitle: string
  caseIndex: number; result?: string; actual?: string
  stepResults?: any; defectId?: string; createdAt: string
}

export interface TesterSuggestion { testerName: string; testerDept?: string }

export const testExecutionApi = {
  listPhases: (projectId: string) =>
    apiClient.get<TestPhase[]>(`/projects/${projectId}/test-phases`).then(r => r.data),
  createPhase: (projectId: string, data: Partial<TestPhase>) =>
    apiClient.post<TestPhase>(`/projects/${projectId}/test-phases`, data).then(r => r.data),
  getPhase: (projectId: string, phaseId: string) =>
    apiClient.get<TestPhase>(`/projects/${projectId}/test-phases/${phaseId}`).then(r => r.data),
  updatePhase: (projectId: string, phaseId: string, data: Partial<TestPhase>) =>
    apiClient.put<TestPhase>(`/projects/${projectId}/test-phases/${phaseId}`, data).then(r => r.data),
  deletePhase: (projectId: string, phaseId: string) =>
    apiClient.delete(`/projects/${projectId}/test-phases/${phaseId}`).then(r => r.data),
  refreshSnapshot: (projectId: string, phaseId: string) =>
    apiClient.post(`/projects/${projectId}/test-phases/${phaseId}/snapshot`).then(r => r.data),
  listRounds: (projectId: string, phaseId: string) =>
    apiClient.get<TestRound[]>(`/projects/${projectId}/test-phases/${phaseId}/rounds`).then(r => r.data),
  createRound: (projectId: string, phaseId: string, data: Partial<TestRound>) =>
    apiClient.post<TestRound>(`/projects/${projectId}/test-phases/${phaseId}/rounds`, data).then(r => r.data),
  getRound: (projectId: string, phaseId: string, roundId: string) =>
    apiClient.get<TestRound>(`/projects/${projectId}/test-phases/${phaseId}/rounds/${roundId}`).then(r => r.data),
  updateRound: (projectId: string, phaseId: string, roundId: string, data: Partial<TestRound>) =>
    apiClient.put<TestRound>(`/projects/${projectId}/test-phases/${phaseId}/rounds/${roundId}`, data).then(r => r.data),
  deleteRound: (projectId: string, phaseId: string, roundId: string) =>
    apiClient.delete(`/projects/${projectId}/test-phases/${phaseId}/rounds/${roundId}`).then(r => r.data),
  getResults: (projectId: string, roundId: string) =>
    apiClient.get<TestRoundResult[]>(`/projects/${projectId}/test-rounds/${roundId}/results`).then(r => r.data),
  saveResults: (projectId: string, roundId: string, results: Partial<TestRoundResult>[]) =>
    apiClient.post(`/projects/${projectId}/test-rounds/${roundId}/results`, { results }).then(r => r.data),
  updateResult: (projectId: string, roundId: string, resultId: string, data: Partial<TestRoundResult>) =>
    apiClient.put(`/projects/${projectId}/test-rounds/${roundId}/results/${resultId}`, data).then(r => r.data),
  getTesters: (projectId: string) =>
    apiClient.get<TesterSuggestion[]>(`/projects/${projectId}/test-phases/testers`).then(r => r.data),
  getDashboard: (projectId: string, phaseId: string) =>
    apiClient.get(`/projects/${projectId}/test-phases/${phaseId}/dashboard`).then(r => r.data),
  exportTemplate: (projectId: string, phaseId: string) => {
    window.open(`/api/v1/projects/${projectId}/test-phases/${phaseId}/export-template`, '_blank')
  },
  importResults: (projectId: string, phaseId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post(`/projects/${projectId}/test-phases/${phaseId}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  exportResult: (projectId: string, phaseId: string) => {
    window.open(`/api/v1/projects/${projectId}/test-phases/${phaseId}/export-result`, '_blank')
  },
}
