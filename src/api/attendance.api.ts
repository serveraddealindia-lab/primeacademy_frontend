import api from './axios';

export interface Attendance {
  id: number;
  sessionId: number;
  studentId: number;
  status: 'present' | 'absent' | 'manual_present';
  isManual: boolean;
  markedBy?: number;
  markedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  student?: {
    id: number;
    name: string;
    email: string;
  };
  session?: {
    id: number;
    date: string;
    topic?: string;
  };
}

export interface MarkAttendanceRequest {
  studentId: number;
  status: 'present' | 'absent' | 'manual_present';
  isManual?: boolean;
}

interface PunchPayloadBase {
  photo?: string;
  photoFile?: File | Blob;
  fingerprint?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

export type PunchInRequest = PunchPayloadBase;
export type PunchOutRequest = PunchPayloadBase;

export interface StudentPunch {
  id: number;
  userId: number;
  date: string;
  punchInAt?: string;
  punchOutAt?: string;
  punchInPhoto?: string;
  punchOutPhoto?: string;
  punchInFingerprint?: string;
  punchOutFingerprint?: string;
  punchInLocation?: any;
  punchOutLocation?: any;
  effectiveWorkingHours?: number;
  effectiveHours?: number; // Keep for backward compatibility
  breaks?: Array<{ startTime?: string; endTime?: string; reason?: string }> | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PunchResponse {
  status: string;
  message: string;
  data: {
    punch: StudentPunch;
    punchInAt?: string;
    punchOutAt?: string;
    effectiveWorkingHours?: number;
  };
}

export interface TodayPunchResponse {
  status: string;
  data: {
    punch: StudentPunch | null;
    hasPunchedIn: boolean;
    hasPunchedOut: boolean;
  };
}

export interface AttendanceResponse {
  status: string;
  data: {
    attendance: Attendance;
  };
}

export interface AttendancesResponse {
  status: string;
  data: {
    attendances: Attendance[];
  };
}

const buildPunchFormData = (data: PunchPayloadBase): FormData => {
  const formData = new FormData();

  // Handle photo - convert base64 to Blob if needed (optional)
  if (data.photoFile) {
    formData.append('photo', data.photoFile);
  } else if (data.photo) {
    // If photo is a base64 string, convert it to a Blob
    if (typeof data.photo === 'string' && data.photo.startsWith('data:')) {
      // Extract base64 data
      const arr = data.photo.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      formData.append('photo', blob, `attendance-${Date.now()}.jpg`);
    } else {
      // If it's already a string (not base64), send it as body.photo
      formData.append('photo', data.photo);
    }
  }
  // Photo is optional - if not provided, FormData will be sent without it

  // Fingerprint is optional
  if (data.fingerprint) {
    formData.append('fingerprint', data.fingerprint);
  }

  // Location is optional
  if (data.location) {
    formData.append('location', JSON.stringify(data.location));
  }

  return formData;
};

export const attendanceAPI = {
  getSessionAttendance: async (sessionId: number): Promise<AttendancesResponse> => {
    const response = await api.get<AttendancesResponse>(`/sessions/${sessionId}/attendance`);
    return response.data;
  },
  markAttendance: async (sessionId: number, data: MarkAttendanceRequest): Promise<AttendanceResponse> => {
    const response = await api.post<AttendanceResponse>(`/sessions/${sessionId}/attendance`, data);
    return response.data;
  },
  getStudentAttendance: async (studentId: number, params?: { from?: string; to?: string }): Promise<AttendancesResponse> => {
    const response = await api.get<AttendancesResponse>(`/students/${studentId}/attendance`, { params });
    return response.data;
  },
  // Student Punch In/Out
  punchIn: async (data: PunchInRequest): Promise<PunchResponse> => {
    const response = await api.post<PunchResponse>('/student-attendance/punch-in', buildPunchFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  punchOut: async (data: PunchOutRequest): Promise<PunchResponse> => {
    const response = await api.post<PunchResponse>('/student-attendance/punch-out', buildPunchFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getTodayPunch: async (): Promise<TodayPunchResponse> => {
    const response = await api.get<TodayPunchResponse>('/student-attendance/today');
    return response.data;
  },
  getStudentPunchHistory: async (params?: { from?: string; to?: string }): Promise<{ status: string; data: { punches: StudentPunch[] } }> => {
    const response = await api.get('/student-attendance/history', { params });
    return response.data;
  },
  // Break In/Out
  breakIn: async (reason?: string): Promise<{ status: string; message: string; data: any }> => {
    const response = await api.post('/student-attendance/break-in', { reason });
    return response.data;
  },
  breakOut: async (): Promise<{ status: string; message: string; data: any }> => {
    const response = await api.post('/student-attendance/break-out');
    return response.data;
  },
};

