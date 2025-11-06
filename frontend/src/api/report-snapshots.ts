import axios from './axios';

export interface ReportSnapshot {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string;
  data: any[]; // Array of items
  statistics: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    onHold: number;
    averageProgress: number;
  };
  createdById: string;
  createdAt: string;
  CreatedBy: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
}

export interface CreateSnapshotParams {
  title: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string;
  data: any[];
  statistics: any;
}

export const reportSnapshotsApi = {
  // Create a new snapshot
  createSnapshot: async (params: CreateSnapshotParams): Promise<ReportSnapshot> => {
    const response = await axios.post('/report-snapshots', params);
    return response.data;
  },

  // Get all snapshots (with optional filtering by clientId)
  getSnapshots: async (clientId?: string): Promise<ReportSnapshot[]> => {
    const params = clientId ? { clientId } : {};
    const response = await axios.get('/report-snapshots', { params });
    return response.data;
  },

  // Get a single snapshot by ID
  getSnapshotById: async (id: string): Promise<ReportSnapshot> => {
    const response = await axios.get(`/report-snapshots/${id}`);
    return response.data;
  },

  // Delete a snapshot
  deleteSnapshot: async (id: string): Promise<void> => {
    await axios.delete(`/report-snapshots/${id}`);
  },
};
