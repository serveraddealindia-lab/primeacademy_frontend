import api from './axios';

export type DeviceType = 'push-api' | 'pull-api';
export type DeviceStatus = 'active' | 'inactive';

export interface BiometricDevice {
  id: number;
  deviceName: string;
  deviceType: DeviceType;
  ipAddress: string | null;
  port: number | null;
  apiUrl: string | null;
  authKey: string | null;
  lastSyncAt: string | null;
  status: DeviceStatus;
  createdAt?: string;
  updatedAt?: string;
  logCount?: number;
}

export interface CreateDeviceRequest {
  deviceName: string;
  deviceType: DeviceType;
  ipAddress?: string;
  port?: number;
  apiUrl?: string;
  authKey?: string;
}

export interface UpdateDeviceRequest {
  deviceName?: string;
  ipAddress?: string;
  port?: number;
  apiUrl?: string;
  authKey?: string;
  status?: DeviceStatus;
}

export interface DevicesResponse {
  status: string;
  data: BiometricDevice[];
}

export interface DeviceResponse {
  status: string;
  data: BiometricDevice;
}

export interface TestConnectionResponse {
  status: string;
  message: string;
  data: {
    connected: boolean;
  };
}

export interface SyncResponse {
  status: string;
  message: string;
  data: {
    success: boolean;
    count: number;
  };
}

export const biometricAPI = {
  getAllDevices: async (): Promise<DevicesResponse> => {
    const response = await api.get<DevicesResponse>('/biometric/devices');
    return response.data;
  },

  registerDevice: async (data: CreateDeviceRequest): Promise<DeviceResponse> => {
    const response = await api.post<DeviceResponse>('/biometric/register-device', data);
    return response.data;
  },

  updateDevice: async (id: number, data: UpdateDeviceRequest): Promise<DeviceResponse> => {
    const response = await api.put<DeviceResponse>(`/biometric/device/${id}`, data);
    return response.data;
  },

  deleteDevice: async (id: number): Promise<void> => {
    await api.delete(`/biometric/device/${id}`);
  },

  testConnection: async (id: number): Promise<TestConnectionResponse> => {
    const response = await api.post<TestConnectionResponse>(`/biometric/device/${id}/test-connection`);
    return response.data;
  },

  syncNow: async (id: number): Promise<SyncResponse> => {
    const response = await api.post<SyncResponse>(`/biometric/device/${id}/sync-now`);
    return response.data;
  },
};




