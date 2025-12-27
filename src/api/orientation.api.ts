import api from './axios';

export enum OrientationLanguage {
  ENGLISH = 'english',
  GUJARATI = 'gujarati',
}

export interface OrientationStatus {
  accepted: boolean;
  acceptedAt: string | null;
}

export interface StudentOrientationResponse {
  status: string;
  data: {
    studentId: number;
    isEligible: boolean;
    orientations: {
      english: OrientationStatus;
      gujarati: OrientationStatus;
    };
  };
}

export interface BulkOrientationStatusResponse {
  status: string;
  data: {
    statusMap: Record<
      number,
      {
        english: boolean;
        gujarati: boolean;
        isEligible: boolean;
      }
    >;
  };
}

export const orientationAPI = {
  getStudentOrientation: async (studentId: number): Promise<StudentOrientationResponse> => {
    const response = await api.get<StudentOrientationResponse>(`/orientation/${studentId}`);
    return response.data;
  },

  acceptOrientation: async (
    studentId: number,
    language: OrientationLanguage
  ): Promise<StudentOrientationResponse> => {
    const response = await api.post<StudentOrientationResponse>(`/orientation/${studentId}/accept`, {
      language,
    });
    return response.data;
  },

  getBulkOrientationStatus: async (studentIds: number[]): Promise<BulkOrientationStatusResponse> => {
    const response = await api.get<BulkOrientationStatusResponse>('/orientation/bulk/status', {
      params: {
        studentIds: studentIds.join(','),
      },
    });
    return response.data;
  },
};


