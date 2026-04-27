import apiClient from './client'

export interface TaskIssue {
  id: string
  taskId: string
  type: 'issue' | 'risk'
  title: string
  description?: string
  severity: string
  status: string
  createdAt: string
}

export interface Task {
  id: string
  projectId: string
  featureId: string
  code: string
  title: string
  description?: string
  assigneeId?: string
  progress: number
  startDate?: string
  endDate?: string
  status: string
  createdAt: string
  updatedAt: string
  feature?: {
    id: string; code: string; title: string; reqId?: string
    requirement?: { id: string; code: string; title: string; status: string }
  }
  issues?: TaskIssue[]
  _count?: { issues: number }
}

export interface TaskPayload {
  title: string
  featureId: string
  description?: string
  assigneeId?: string
  progress?: number
  startDate?: string
  endDate?: string
  status?: string
}

export interface IssuePayload {
  title: string
  type: 'issue' | 'risk'
  description?: string
  severity?: string
  status?: string
}

import { type PaginatedResponse } from './requirement.api'

export const taskApi = {
  list: (projectId: string, query?: { featureId?: string; status?: string; search?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<Task>>(`/projects/${projectId}/tasks`, { params: query }).then(r => r.data),
  get: (projectId: string, taskId: string) =>
    apiClient.get<Task>(`/projects/${projectId}/tasks/${taskId}`).then(r => r.data),
  create: (projectId: string, data: TaskPayload) =>
    apiClient.post<Task>(`/projects/${projectId}/tasks`, data).then(r => r.data),
  update: (projectId: string, taskId: string, data: Partial<TaskPayload>) =>
    apiClient.put<Task>(`/projects/${projectId}/tasks/${taskId}`, data).then(r => r.data),
  remove: (projectId: string, taskId: string) =>
    apiClient.delete(`/projects/${projectId}/tasks/${taskId}`).then(r => r.data),
  addIssue: (projectId: string, taskId: string, data: IssuePayload) =>
    apiClient.post<TaskIssue>(`/projects/${projectId}/tasks/${taskId}/issues`, data).then(r => r.data),
  updateIssue: (projectId: string, taskId: string, issueId: string, data: Partial<IssuePayload>) =>
    apiClient.put<TaskIssue>(`/projects/${projectId}/tasks/${taskId}/issues/${issueId}`, data).then(r => r.data),
  removeIssue: (projectId: string, taskId: string, issueId: string) =>
    apiClient.delete(`/projects/${projectId}/tasks/${taskId}/issues/${issueId}`).then(r => r.data),
}
