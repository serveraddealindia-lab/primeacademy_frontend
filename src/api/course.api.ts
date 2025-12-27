import api from './axios';

export interface Course {
  id: number;
  name: string;
  software: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CoursesResponse {
  status: string;
  data: Course[];
}

export interface CourseResponse {
  status: string;
  message?: string;
  data: {
    course: Course;
  };
}

export interface CreateCourseRequest {
  name: string;
  software: string[];
}

export interface UpdateCourseRequest {
  name?: string;
  software?: string[];
}

export const courseAPI = {
  getAllCourses: async (): Promise<CoursesResponse> => {
    const response = await api.get<CoursesResponse>('/courses');
    return response.data;
  },
  getCourseById: async (id: number): Promise<CourseResponse> => {
    const response = await api.get<CourseResponse>(`/courses/${id}`);
    return response.data;
  },
  createCourse: async (data: CreateCourseRequest): Promise<CourseResponse> => {
    const response = await api.post<CourseResponse>('/courses', data);
    return response.data;
  },
  updateCourse: async (id: number, data: UpdateCourseRequest): Promise<CourseResponse> => {
    const response = await api.put<CourseResponse>(`/courses/${id}`, data);
    return response.data;
  },
  deleteCourse: async (id: number): Promise<{ status: string; message: string }> => {
    const response = await api.delete<{ status: string; message: string }>(`/courses/${id}`);
    return response.data;
  },
};



