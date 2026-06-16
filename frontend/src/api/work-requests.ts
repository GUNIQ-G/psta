import apiClient from './axios';
import { WorkRequest } from '../types';

export const workRequestsApi = {
  // Get all work requests
  getWorkRequests: async (params?: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    requesterId?: string;
  }): Promise<WorkRequest[]> => {
    const response = await apiClient.get('/work/requests', { params });
    return response.data;
  },

  // Get a single work request
  getWorkRequestById: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.get(`/work/requests/${id}`);
    return response.data;
  },

  // Create a work request
  createWorkRequest: async (data: {
    title: string;
    description: string;
    priority?: string;
    projectId?: string;
    serviceId?: string;
    teamId?: string;
    dueDate?: string;
    assigneeId?: string;
  }): Promise<WorkRequest> => {
    const response = await apiClient.post('/work/requests', data);
    return response.data;
  },

  // Update a work request
  updateWorkRequest: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      status?: string;
      projectId?: string;
      serviceId?: string;
      teamId?: string;
      dueDate?: string;
      assigneeId?: string;
      actionId?: string;
    }
  ): Promise<WorkRequest> => {
    const response = await apiClient.put(`/work/requests/${id}`, data);
    return response.data;
  },

  // Recall a work request
  recallWorkRequest: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/recall`);
    return response.data;
  },

  // Resubmit a work request (from REJECTED or IN_NEGOTIATION)
  resubmitWorkRequest: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/resubmit`);
    return response.data;
  },

  // Approve a work request
  approveWorkRequest: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/approve`);
    return response.data;
  },

  // Unapprove a work request
  unapproveWorkRequest: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/unapprove`);
    return response.data;
  },

  // Create action from work request
  createActionFromWorkRequest: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/create-action`);
    return response.data;
  },

  // Delete a work request
  deleteWorkRequest: async (id: string): Promise<void> => {
    await apiClient.delete(`/work/requests/${id}`);
  },

  // Get team work requests
  getTeamWorkRequests: async (): Promise<WorkRequest[]> => {
    const response = await apiClient.get('/work/requests/team');
    return response.data;
  },

  // Assign work request to individual member
  assignToIndividual: async (id: string, assigneeId: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/assign`, { assigneeId });
    return response.data;
  },

  // Reject a work request
  rejectWorkRequest: async (id: string, rejectionMessage?: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/reject`, { rejectionMessage });
    return response.data;
  },

  // Request negotiation
  requestNegotiation: async (id: string, negotiationMessage: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/negotiate`, { negotiationMessage });
    return response.data;
  },

  // Validate action creation (check hierarchy)
  validateActionCreation: async (id: string): Promise<{
    canCreateAction: boolean;
    missingHierarchy: string[];
    suggestions: Array<{
      level: string;
      action: 'SELECT_EXISTING' | 'REQUEST_CREATION';
      existingItems?: any[];
      targetManagerId?: string;
    }>;
  }> => {
    const response = await apiClient.get(`/work/requests/${id}/validate-action-creation`);
    return response.data;
  },

  // Create hierarchy request (SERVICE or TEAM)
  createHierarchyRequest: async (data: {
    parentWorkRequestId: string;
    requestType: 'SERVICE_CREATE' | 'TEAM_CREATE';
    targetItemType: 'SERVICE' | 'TEAM';
    projectId?: string;
    serviceId?: string;
    assigneeId: string;
    title?: string;
    description?: string;
    priority?: string;
  }): Promise<WorkRequest> => {
    const response = await apiClient.post('/work/requests/hierarchy-request', data);
    return response.data;
  },

  // Link created hierarchy to work request
  linkCreatedHierarchy: async (id: string, createdItemId: string): Promise<WorkRequest> => {
    const response = await apiClient.patch(`/work/requests/${id}/link-hierarchy`, { createdItemId });
    return response.data;
  },

  // Forward work request to another user
  forwardWorkRequest: async (id: string, newAssigneeId: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/forward`, { newAssigneeId });
    return response.data;
  },

  // Get all work requests (Admin only)
  getAllWorkRequests: async (): Promise<WorkRequest[]> => {
    const response = await apiClient.get('/work/requests/all');
    return response.data;
  },

  // Cancel work request (assignee only)
  cancelWorkRequest: async (id: string): Promise<WorkRequest> => {
    const response = await apiClient.post(`/work/requests/${id}/cancel`);
    return response.data;
  },

  // Admin force delete work request
  adminDeleteWorkRequest: async (id: string): Promise<void> => {
    await apiClient.delete(`/work/requests/${id}/admin`);
  },
};
