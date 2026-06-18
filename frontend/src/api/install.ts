import axios from 'axios';

const BASE = '/api/install';

export interface InstallStatus {
  installed: boolean;
  dbConnected?: boolean;
}

export const getInstallStatus = () =>
  axios.get<InstallStatus>(`${BASE}/status`).then(r => r.data);

export const testDbConnection = (databaseUrl: string) =>
  axios.post<{ ok: boolean; error?: string }>(`${BASE}/test-db`, { databaseUrl }).then(r => r.data);

export const runInstall = (data: { frontendUrl: string }) =>
  axios.post<{ ok: boolean; message: string }>(`${BASE}/run`, data).then(r => r.data);
