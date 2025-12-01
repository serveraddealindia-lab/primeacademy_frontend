import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);
  const [orientationStudentId, setOrientationStudentId] = useState<number | null>(null);
  const [activeOrientationTab, setActiveOrientationTab] = useState<'english' | 'gujarati'>('english');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  
  // Store orientation status for all students
  const [orientationStatusMap, setOrientationStatusMap] = useState<Record<number, { isEligible: boolean; english: boolean; gujarati: boolean }>>({});

  // Fetch students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches for enrollment form
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      try {
        const response = await userAPI.getUser(selectedStudent!.id);
        console.log('Student profile data:', response);
        return response;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent && isViewModalOpen,
    retry: 1,
  });

  // Fetch software completions for selected student
  const { data: completionsData } = useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: () => softwareCompletionAPI.getCompletions({ studentId: selectedStudent?.id }),
    enabled: !!selectedStudent && isViewModalOpen,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => studentAPI.createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsEnrollmentModalOpen(false);
      alert('Student enrolled successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to enroll student. Please check if the enrollment endpoint exists in the backend.');
    },
  });

  // Accept orientation mutation
  const acceptOrientationMutation = useMutation({
    mutationFn: ({ studentId, language }: { studentId: number; language: OrientationLanguage }) =>
      orientationAPI.acceptOrientation(studentId, language),
    onSuccess: (data, variables) => {
      // Update local state
      setOrientationStatusMap((prev) => ({
        ...prev,
        [variables.studentId]: {
          isEligible: data.data.isEligible,
          english: data.data.orientations.english.accepted,
          gujarati: data.data.orientations.gujarati.accepted,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['bulk-orientation-status'] });
      alert('Orientation accepted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to accept orientation');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_data, variables) => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        setSelectedStudent({ ...selectedStudent, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedStudent(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
      alert('Student deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete student');
    },
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: (file: File) => studentAPI.bulkEnrollStudents(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully enrolled ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to bulk enroll students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadEnrollmentTemplate();
      
      // Check if blob is actually an error JSON response
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || 'Failed to download template');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download template error:', error);
      // Try to extract error message from response
      if (error.response?.data) {
        if (error.response.data instanceof Blob) {
          error.response.data.text().then((text: string) => {
            try {
              const errorData = JSON.parse(text);
              alert(errorData.message || 'Failed to download template');
            } catch {
              alert('Failed to download template');
            }
          });
        } else {
          alert(error.response.data.message || 'Failed to download template');
        }
      } else {
        alert(error.message || 'Failed to download template');
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkEnrollMutation.mutate(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedStudent.id,
          avatarUrl: imageUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const students = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || students.length;
  const batches = batchesData?.data || [];

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const handleEnrollStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateEnrollmentRequest = {
      studentId: parseInt(formData.get('studentId') as string),
      batchId: parseInt(formData.get('batchId') as string),
      enrollmentDate: formData.get('enrollmentDate') as string || new Date().toISOString().split('T')[0],
      status: formData.get('status') as string || 'active',
    };
    createEnrollmentMutation.mutate(data);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };


  const handleConfirmDelete = () => {
    if (selectedStudent) {
      deleteUserMutation.mutate(selectedStudent.id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Student Management</h1>
                <p className="mt-2 text-orange-100">Manage students and enrollments</p>
                <p className="mt-1 text-orange-200 text-sm font-semibold">Total Students: {totalStudents}</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/students/enroll')}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + New Enrollment
                  </button>
                  <button
                    onClick={() => setIsEnrollmentModalOpen(true)}
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    📥 Download Template
                  </button>
                  <button
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📤 Bulk Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orientation
                      </th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.avatarUrl ? (
                              <img
                                src={getImageUrl(student.avatarUrl) || ''}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const status = orientationStatusMap[student.id];
                            const isEligible = status?.isEligible || false;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isEligible
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible' : '⏳ Pending'}
                                </span>
                                <button
                                  onClick={() => {
                                    setOrientationStudentId(student.id);
                                    setIsOrientationModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="View Orientation"
                                >
                                  📄 Orientation
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(student)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Student"
                            >
                              👁️ View
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setImagePreview(student.avatarUrl || null);
                                    setIsImageModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Update Photo"
                                >
                                  📷 Photo
                                </button>
                                <button
                                  onClick={() => handleEdit(student)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Student"
                                >
                                  ✏️ Edit
                                </button>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={() => handleDelete(student)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Student"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Enroll Student in Batch</h2>
            <form onSubmit={handleEnrollStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                <select
                  name="batchId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                <input
                  type="date"
                  name="enrollmentDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createEnrollmentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={getImageUrl(selectedStudent.avatarUrl) || ''}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={selectedStudent.avatarUrl}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedStudent(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Student Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingProfile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : profileError ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm">
                    Could not load full profile. Showing basic information.
                  </p>
                </div>
                {/* Show basic info from selectedStudent */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !studentProfileData && !isLoadingProfile ? (
              <div className="space-y-6">
                {/* Show basic info from selectedStudent if API didn't return data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No student profile information available.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                <div className="flex justify-center mb-6">
                  {(() => {
                    const userData = studentProfileData?.data?.user || null;
                    const photoUrl = userData?.studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                    const studentName = userData?.name || selectedStudent?.name || 'Student';
                    
                    if (photoUrl) {
                      return (
                        <div className="text-center">
                          <img
                            src={getImageUrl(photoUrl) || photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                            }}
                          />
                          <p className="mt-3 text-sm font-medium text-gray-700">Student Photo</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{studentProfileData?.data?.user?.name || selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.email || selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.phone || selectedStudent?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          (studentProfileData?.data?.user?.isActive ?? selectedStudent) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(studentProfileData?.data?.user?.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    {(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt || '').toLocaleDateString()}</p>
                      </div>
                    )}
                    {studentProfileData?.data?.user?.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  {studentProfileData?.data?.user?.studentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.dob)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.enrollmentDate)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                        <p className="mt-1">
                          {studentProfileData.data?.user?.studentProfile?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                              studentProfileData.data.user.studentProfile.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : studentProfileData.data.user.studentProfile.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {studentProfileData.data.user.studentProfile.status}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Photo URL</label>
                        <p className="mt-1 text-sm text-gray-900 break-all">
                          {studentProfileData.data?.user?.studentProfile?.photoUrl || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.address || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Software List</label>
                        {(() => {
                          const softwareList: unknown = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList as string[];
                          } else if (softwareList && typeof softwareList === 'string') {
                            const trimmed = softwareList.trim();
                            if (trimmed) {
                              // If it's a string, split by comma
                              softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }
                          }
                          
                          return softwareArray.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {softwareArray.map((software: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {software}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">-</p>
                          );
                        })()}
                      </div>
                      {/* Emergency Contact Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        
                        if (emergencyContact) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.number || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.relation || '-'}</p>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Payment Plan Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        
                        if (enrollmentMetadata && (enrollmentMetadata.emiPlan !== undefined || enrollmentMetadata.totalDeal !== undefined)) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                              </div>
                              {enrollmentMetadata.totalDeal !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.totalDeal || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.bookingAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.bookingAmount || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.balanceAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.balanceAmount || '-'}</p>
                                </div>
                              )}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {studentProfileData.data?.user?.studentProfile?.createdAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Created</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.createdAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {studentProfileData.data?.user?.studentProfile?.updatedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Updated</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No student profile information available.</p>
                    </div>
                  )}
                </div>

                {/* Software Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Completions</h3>
                  {completionsData?.data?.completions && Array.isArray(completionsData.data.completions) && completionsData.data.completions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {completionsData.data.completions.map((completion: any) => (
                            <tr key={completion.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {completion.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.batch?.title || `Batch ${completion.batchId}`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  completion.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {completion.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.faculty?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software completions found for this student.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Student</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Bulk Student Enrollment</h2>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Upload Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully enrolled: {bulkUploadResult.success} student(s)
                  </p>
                  {bulkUploadResult.failed > 0 && (
                    <p className="text-red-700 font-medium mt-1">
                      ✗ Failed: {bulkUploadResult.failed} student(s)
                    </p>
                  )}
                </div>
                
                {bulkUploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto border border-red-200 rounded p-3 bg-red-50">
                      {bulkUploadResult.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, or .csv)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    required
                    disabled={uploadingBulk}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Maximum file size: 10MB. Download the template to see the required format.
                  </p>
                </div>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Make sure your Excel file follows the template format. 
                    Required fields: studentName, email, phone, dateOfAdmission.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Uploading...' : 'Upload & Enroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      setBulkUploadResult(null);
                    }}
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orientation Modal */}
      {isOrientationModalOpen && orientationStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Student Orientation</h2>
              <button
                onClick={() => {
                  setIsOrientationModalOpen(false);
                  setOrientationStudentId(null);
                  setActiveOrientationTab('english');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveOrientationTab('english')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'english'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setActiveOrientationTab('gujarati')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'gujarati'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gujarati
                </button>
              </div>

              {/* Orientation Content */}
              <div className="flex-1 overflow-auto p-6 bg-white">
                {activeOrientationTab === 'english' ? (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Orientation</h1>
                      <p className="text-sm text-gray-600">601 Gala Empire, Opp. Doordarshan metro station, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>3 days classroom coaching and 3 days lab practice is mandatory for every student</strong>
                          </li>
                          <li className="mb-3">
                            The batch timing may change with new software
                          </li>
                          <li className="mb-3">
                            If you have given commitment for special batch timing, plz do mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            The software practice is necessary in lab to complete assignments, for any reason if you are unable to come for practice at lab then mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            For any course, the ratio for coaching and practice is <strong>1:2</strong>, it means every classroom lecture you will have to make <strong>2 hours minimum practice</strong> and hence <strong>minimum 25 hours practice is compulsory at lab</strong>. For the best career <strong>monthly 50 hours practice is highly recommended</strong>.
                          </li>
                          <li className="mb-3">
                            Student may bring their own laptop is desirable and if he/she couldn't arrange laptop then he/she may book the practice slot accordingly. Practice lab is open <strong>9:00 am to 7:00 pm from Monday to Saturday</strong>. Faculty will guide during practice as per their availability
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            During the study of software, the faculty will guide for portfolio (assignments) and such assignment will have to get approved by faculty at end of each software.
                          </li>
                          <li className="mb-3">
                            The placement call will sole depend on the portfolio work and practice hours. <strong>The student without approved portfolio is not eligible for placement</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees payment & monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            The student who enrolled on EMI payment term has to deposits all PDCs (postdated cheques) and such cheques will be deposited in bank latest by <strong>10th of every month</strong> OR he has to pay monthly EMI between <strong>1st to 10th day of every month</strong>. Any payment after 10th day will be liable to late payment charges <strong>Rs. 50/- per day</strong>. Student will get GST paid receipt from A/C dept between <strong>15th to 20th day of every month</strong>. If any student get any exemption in payment date, plz mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            . All fees payment are including GST and non-refundable
                          </li>
                          <li className="mb-3">
                            Each course and its payment is non-transferable. No course can be down-graded in value or duration but it can be up-graded to bigger course value/duration. Any up gradation is subject to approval and for that student needs to pay difference amount in advance
                          </li>
                          <li className="mb-3">
                            The course progress will sole depend on the grasping ability of student, leaves, absenteeism and circumstances and it is no way related to payment made for the course. The payment made is no way connected and co-related with the course completion which please be noted
                          </li>
                          <li className="mb-3">
                            Cheques bounce charges <strong>Rs. 350/-</strong>
                          </li>
                          <li className="mb-3">
                            After the completion of 6 month only, if any student is not able to pay fees for any month then he has to pay <strong>Rs. 1200/- as penalty</strong> and it is not part of total payment. Student can be considered as dropped out in system in case of fail to payment and study will be paused till clearance of all due with activation charge
                          </li>
                          <li className="mb-3">
                            Student will have to pay their monthly EMI during the long leave for whatever reason.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Orientation</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            Student will get backup for the lectures/study he/she missed during the approved leaves and there is no backup for leave without approval.
                          </li>
                          <li className="mb-3">
                            If any student face any difficulty in understanding of any software then on special recommendation of faculty the entire software will get repeated without any extra cost
                          </li>
                          <li className="mb-3">
                            Once you enrolled with us you are our lifetime member and as privilege you may visit us for any technical assistance or job placement in future and all such services are <strong>FREE FOREVER</strong>
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          If you have given any special commitment by counselor then do mention here/ or leave blank
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>Student Name:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>Course:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          I, hereby confirm that I got detailed understanding for all above rule & regulation of institute and I assure to follow the same.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>Student Sign / Date</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">વિદ્યાર્થી ઓરિએન્ટેશન</h1>
                      <p className="text-sm text-gray-600">401, Shilp Square B, Opp. Sales India, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>દરેક વિદ્યાર્થી એ પોતાના કોર્સ માાં અઠિાવિયા માાં ૩ વદિર્ ક્લાર્ કોવ ાંગ અને ૩ વદિર્ પ્રેકટીર્ કરિાની રહેશે.</strong>
                          </li>
                          <li className="mb-3">
                            બે નો ટાઈમ દરેક ર્ોફ્ટિેર િખતે બદલાઈ શકે છે.
                          </li>
                          <li className="mb-3">
                            જો આપણે કોઈ ોક્કર્ ર્મયે બે આપિાની િાત ર્થઇ હોય તો અહીયાં ા જણાિિ ાં.
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            લેબ માાં આિીને પ્રેકટીર્ કરિી જરૂરી છે. કોઈ ોક્કર્ કારણોર્ર જો લેબ માાં પ્રેકટીર્ ના ર્થઇ શકે એમ હોય તો અહીયાં ા સ્પષ્ટતા કરિી
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            દરેક કોર્સ માટે <strong>૧:૨ નો પ્રેકટીર્ રેર્ીઓ જરૂરી છે</strong>. એક લેક્ ર ર્ામે <strong>૨ કલાક પ્રેકટીર્ વમવનમમ હોિી જરૂરી છે</strong>. એ મ જબ મવહના માાં <strong>25 કલાક પ્રેવક્ટર્ કરિી જરૂરી છે</strong>. પરાંત એક ર્ારી કારવકદી માટે મવહના માાં <strong>૫૦ કલાક પ્રેકટીર્ હોિી અવનિાયસ છે</strong>.
                          </li>
                          <li className="mb-3">
                            પ્રેવક્ટર્ માટે વિદ્યાર્થી પોતાન ાં લેપટોપ લઈને આિે તે આિિકાયસ છે પણ જરૂરી નર્થી. પ્રેવક્ટર્ નો ટાઈમ સ્લોટ અગાઉ ર્થી બ કરિો જરૂરી છે. જેર્થી વ્યિસ્ર્થા જાળિી શકાય. પ્રેવક્ટર્ લેબ નો ટાઈમ ર્િારે <strong>૯ ર્થી ર્ાાંજે૭ ર્ ધી રહેશે</strong>. પ્રેવક્ટર્ દરમ્યાન ફેકલ્ટી ન ાં માગસદશસન એમના ફ્રી ટાઈમ મ જબ મળી શકશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            દરેક ર્ોફ્ટિેર પૂરાં ર્થયા બાદ એક સ્ટાન્િિસ પોટસફોવલયો બનાિી ને ફેકલ્ટી પાર્ે ok કરાિિો જરૂરી છે. એક ર્ોફ્ટિેર બાદ બીજ ાં ર્ોફ્ટિેર ાલ  કરિા માટે પોટસફોવલયો િકસ પૂરાં કરિ ાં જરૂરી છે.
                          </li>
                          <li className="mb-3">
                            <strong>સ્ટાન્િિસ પોટસફોવલયો િગર અને પ રા પ્રેકટીર્ કલાકો વર્િાય જોબ પ્લેર્મેન્ટ માટે કોઈ વિદ્યાર્થી ને મોકલી શકાશે નવહ.</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees Payment & Monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            જે વિદ્યાર્થીઓ એ ફીર્ પેમેન્ટ માટે EMI કરાિેલા છે એ તમામ વિદ્યાર્થીઓ એ નિા મવહના ની <strong>૧ ર્થી ૧૦ તારીખ ર્ ધી માાં ફીર્ પેમેન્ટ કરિ ાં જરૂરી છે</strong> તેના માટે PDC આપિા જરૂરી છે જે Institute દ્વારા <strong>૧૦ તારીખે બેંક વિપોવિટ કરિામાાં આિશે</strong>. ત્યાર બાદ <strong>Rs 50/- પ્રવત વદિર્ લેખે લેટ પેમેન્ટ ાજસર્સ લાગશે</strong> જેની દરેકે નોાંધ લેિી. દરેક લેટ પેમેન્ટ ને પહોાં મળશે. જો કોઈ વિદ્યાર્થી ને સ્પેશ્યલ કેર્ તરીકે ૧૦ તારીખ પછી પયમેન્ટ ની િાત ર્થયી હોય તો અહીયાં ા જણાિિ ાં
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            ત્યારબાદ લેટ પેમેન્ટ ાજસર્સ લાગ  પિશે.
                            <br />
                            કોઈ પણ કોર્સ માટે ન ાં પેમેન્ટ GST ર્હીત ન ાં છે જેના માટે GST િળી પાકી receipt PDF copy માાં <strong>૧૫ ર્થી ૨૦ તારીખ દરમ્યાન મળી જશે</strong>. કોઈ પણ પ્રકાર ન ાં પેમેન્ટ પાછ ાં મળિા પાત્ર નર્થી.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ ન ાં પેમેન્ટ તબદીલી ને પાત્ર નર્થી. વિદ્યાર્થી એ જે કોર્સ માાં એિવમશન લીધ ાં હશે તે કોર્સ ને કોઈ બીજા નાના કોર્સ માાં તબદીલ કરી શકાશે નવહ પરાંત મોટા વકાંમત / ર્મયગાળા ના કોર્સ માાં તબદીલ કરી શકાશે આ તબદીલી મેનેજમેન્ટ ની રજામાંદી ર્થી ર્થઇ શકશે જેના માટે તફાિત ની રકમ એિિાન્ર્ માાં ભરિાની રહેશે.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ નો ર્મયગાળો એ વિદ્યાર્થી ની ર્મજશવિ / આિિત / ર્ાંજોગો ને આધારે િધારે ઓછો ર્થઇ શકશે એને ફીર્ ના EMI ર્ાર્થે ર્રખામણી કરી શકાશે નવહ. ફીર્ ના EMI એ ફીર્ પે કરિાની ર્ગિિતા માટે ની વ્યિસ્ર્થા છે માટે કોર્સ કેટલો ાલ્યો છે કે કેટલો પૂરો ર્થયો એની ર્ાર્થે ફીર્ ના EMI ને ર્રખામણી કરી શકાશે નવહ જેની દરેક વિદ્યાર્થીઓ એ નોાંધ લેિી.
                          </li>
                          <li className="mb-3">
                            જો ફીર્ ન ાં પેમેન્ટ ેક ર્થી કરાય ાં હોય અને ેક બાઉન્ર્ ર્થાય તો એના અલગ ર્થી <strong>Rs ૩૫૦/- આપિાના રહેશે</strong>.
                          </li>
                          <li className="mb-3">
                            કોઈ વિદ્યાર્થી જો પૂરો મવહનો ફીર્ ના આપી શકે તો એને <strong>Rs ૧૨૦૦/- પેનલ્ટી ાજસ ના ભરિાના રહેશે</strong> જે કોર્સ ાલ  કાયસ ના <strong>૬ મવહના પછી ર્થી જ ર્થઇ શકશે</strong>. ફીર્ પેમેન્ટ અર્થિા પેનલ્ટી ાજસર્સ ભયાસ િગર વિદ્યાર્થી વર્સ્ટમ માાં િરોપઆઉટ ર્થઇ શકે છે. કોઈ વિદ્યાર્થી પહેલા ૬ મવહના દરમ્યાન કોઈ એક મવહનો ફીર્ EMI ના આપે તો જે તે મવહના બાદ િરોપ આઉટ ગણાશે. અને એક્ટીિેશન ાજસર્સ ભયાસ બાદ ફરી ર્થી બે આપી શકાશે.
                          </li>
                          <li className="mb-3">
                            કોર્સ દરમ્યાન ર્ાંજોગોિર્ાત લાાંબી રજા લેિાની ર્થશે તો ફીર્ ના EMI બાંધ કરી શકાશે નવહ. કોર્સ નો ર્મયગાળો લીધેલી રજા મ જબ િધી જશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Help</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            દરેક વિદ્યાર્થી એ ફેકલ્ટી ની માંજૂરી ર્થી રજા લઇ શકાશે જેના માટે અલગ બેકઅપ શીખિિા માાં આિશે પણ માંજૂરી િગર ની રજા માટે બેકઅપ ની વ્યિસ્ર્થા ર્થઇ શકશે નવહ.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ વિદ્યાર્થી ને કોઈ ર્ોફ્ટિેર માાં િધારે મદદ ની જરૂર હોય તો એ ર્ોફ્ટિેર આખો કે અમ ક ટોવપક ફરી ર્થી જે ફેકલ્ટી ના ર્જેશન મ જબ કરિા માાં આિશે જેના માટે કોઈ એક્ર્ટરા પેમેન્ટ આપિાન ાં રહેત ાં નર્થી.
                          </li>
                          <li className="mb-3">
                            એકિાર કોર્સ કયાસ બાદ <strong>Lifetime કોઈ પણ પ્રકાર ની Technical મદદ માટે આપ ક્યારેય પણ institute પર આિી શકો છો</strong>. જે અમારા તમામ વિધાર્થી માટે <strong>વનિઃશ લ્ક રહેશે</strong>.
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          કોર્સ ના એિવમશન િખતે જો આપણે કોઈ ોક્કર્ પ્રકાર ન ાં કવમટમેન્ટ અપાય ાં હોય તો એ અહીયાં ા જણાિિ ાં.
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>કોર્સ ન ાં નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          મને ઉપર મ જબ તમામ વનયમો ની વિસ્તૃત જાણકારી આપિામાાં આિી છે અને મને તે બાંધનકતાસ છે.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>વિદ્યાર્થી ની ર્હી / તારીખ</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with I Agree Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                {(() => {
                  const status = orientationStatusMap[orientationStudentId];
                  const englishAccepted = status?.english || false;
                  const gujaratiAccepted = status?.gujarati || false;
                  const currentAccepted =
                    activeOrientationTab === 'english' ? englishAccepted : gujaratiAccepted;
                  const isEligible = status?.isEligible || false;

                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        {isEligible ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Student is eligible (Orientation accepted)
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">
                            ⏳ Pending approval - Please accept orientation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!currentAccepted) {
                            acceptOrientationMutation.mutate({
                              studentId: orientationStudentId,
                              language:
                                activeOrientationTab === 'english'
                                  ? OrientationLanguage.ENGLISH
                                  : OrientationLanguage.GUJARATI,
                            });
                          } else {
                            alert('This orientation has already been accepted.');
                          }
                        }}
                        disabled={currentAccepted || acceptOrientationMutation.isPending}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                          currentAccepted
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : acceptOrientationMutation.isPending
                            ? 'bg-orange-400 text-white cursor-wait'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {currentAccepted ? '✓ Accepted' : acceptOrientationMutation.isPending ? 'Processing...' : 'I Agree'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);
  const [orientationStudentId, setOrientationStudentId] = useState<number | null>(null);
  const [activeOrientationTab, setActiveOrientationTab] = useState<'english' | 'gujarati'>('english');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  
  // Store orientation status for all students
  const [orientationStatusMap, setOrientationStatusMap] = useState<Record<number, { isEligible: boolean; english: boolean; gujarati: boolean }>>({});

  // Fetch students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches for enrollment form
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      try {
        const response = await userAPI.getUser(selectedStudent!.id);
        console.log('Student profile data:', response);
        return response;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent && isViewModalOpen,
    retry: 1,
  });

  // Fetch software completions for selected student
  const { data: completionsData } = useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: () => softwareCompletionAPI.getCompletions({ studentId: selectedStudent?.id }),
    enabled: !!selectedStudent && isViewModalOpen,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => studentAPI.createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsEnrollmentModalOpen(false);
      alert('Student enrolled successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to enroll student. Please check if the enrollment endpoint exists in the backend.');
    },
  });

  // Accept orientation mutation
  const acceptOrientationMutation = useMutation({
    mutationFn: ({ studentId, language }: { studentId: number; language: OrientationLanguage }) =>
      orientationAPI.acceptOrientation(studentId, language),
    onSuccess: (data, variables) => {
      // Update local state
      setOrientationStatusMap((prev) => ({
        ...prev,
        [variables.studentId]: {
          isEligible: data.data.isEligible,
          english: data.data.orientations.english.accepted,
          gujarati: data.data.orientations.gujarati.accepted,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['bulk-orientation-status'] });
      alert('Orientation accepted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to accept orientation');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_data, variables) => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        setSelectedStudent({ ...selectedStudent, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedStudent(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
      alert('Student deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete student');
    },
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: (file: File) => studentAPI.bulkEnrollStudents(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully enrolled ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to bulk enroll students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadEnrollmentTemplate();
      
      // Check if blob is actually an error JSON response
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || 'Failed to download template');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download template error:', error);
      // Try to extract error message from response
      if (error.response?.data) {
        if (error.response.data instanceof Blob) {
          error.response.data.text().then((text: string) => {
            try {
              const errorData = JSON.parse(text);
              alert(errorData.message || 'Failed to download template');
            } catch {
              alert('Failed to download template');
            }
          });
        } else {
          alert(error.response.data.message || 'Failed to download template');
        }
      } else {
        alert(error.message || 'Failed to download template');
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkEnrollMutation.mutate(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedStudent.id,
          avatarUrl: imageUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const students = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || students.length;
  const batches = batchesData?.data || [];

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const handleEnrollStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateEnrollmentRequest = {
      studentId: parseInt(formData.get('studentId') as string),
      batchId: parseInt(formData.get('batchId') as string),
      enrollmentDate: formData.get('enrollmentDate') as string || new Date().toISOString().split('T')[0],
      status: formData.get('status') as string || 'active',
    };
    createEnrollmentMutation.mutate(data);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };


  const handleConfirmDelete = () => {
    if (selectedStudent) {
      deleteUserMutation.mutate(selectedStudent.id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Student Management</h1>
                <p className="mt-2 text-orange-100">Manage students and enrollments</p>
                <p className="mt-1 text-orange-200 text-sm font-semibold">Total Students: {totalStudents}</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/students/enroll')}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + New Enrollment
                  </button>
                  <button
                    onClick={() => setIsEnrollmentModalOpen(true)}
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    📥 Download Template
                  </button>
                  <button
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📤 Bulk Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orientation
                      </th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.avatarUrl ? (
                              <img
                                src={getImageUrl(student.avatarUrl) || ''}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const status = orientationStatusMap[student.id];
                            const isEligible = status?.isEligible || false;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isEligible
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible' : '⏳ Pending'}
                                </span>
                                <button
                                  onClick={() => {
                                    setOrientationStudentId(student.id);
                                    setIsOrientationModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="View Orientation"
                                >
                                  📄 Orientation
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(student)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Student"
                            >
                              👁️ View
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setImagePreview(student.avatarUrl || null);
                                    setIsImageModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Update Photo"
                                >
                                  📷 Photo
                                </button>
                                <button
                                  onClick={() => handleEdit(student)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Student"
                                >
                                  ✏️ Edit
                                </button>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={() => handleDelete(student)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Student"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Enroll Student in Batch</h2>
            <form onSubmit={handleEnrollStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                <select
                  name="batchId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                <input
                  type="date"
                  name="enrollmentDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createEnrollmentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={getImageUrl(selectedStudent.avatarUrl) || ''}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={selectedStudent.avatarUrl}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedStudent(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Student Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingProfile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : profileError ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm">
                    Could not load full profile. Showing basic information.
                  </p>
                </div>
                {/* Show basic info from selectedStudent */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !studentProfileData && !isLoadingProfile ? (
              <div className="space-y-6">
                {/* Show basic info from selectedStudent if API didn't return data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No student profile information available.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                <div className="flex justify-center mb-6">
                  {(() => {
                    const userData = studentProfileData?.data?.user || null;
                    const photoUrl = userData?.studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                    const studentName = userData?.name || selectedStudent?.name || 'Student';
                    
                    if (photoUrl) {
                      return (
                        <div className="text-center">
                          <img
                            src={getImageUrl(photoUrl) || photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                            }}
                          />
                          <p className="mt-3 text-sm font-medium text-gray-700">Student Photo</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{studentProfileData?.data?.user?.name || selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.email || selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.phone || selectedStudent?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          (studentProfileData?.data?.user?.isActive ?? selectedStudent) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(studentProfileData?.data?.user?.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    {(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt || '').toLocaleDateString()}</p>
                      </div>
                    )}
                    {studentProfileData?.data?.user?.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  {studentProfileData?.data?.user?.studentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.dob)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.enrollmentDate)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                        <p className="mt-1">
                          {studentProfileData.data?.user?.studentProfile?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                              studentProfileData.data.user.studentProfile.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : studentProfileData.data.user.studentProfile.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {studentProfileData.data.user.studentProfile.status}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Photo URL</label>
                        <p className="mt-1 text-sm text-gray-900 break-all">
                          {studentProfileData.data?.user?.studentProfile?.photoUrl || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.address || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Software List</label>
                        {(() => {
                          const softwareList: unknown = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList as string[];
                          } else if (softwareList && typeof softwareList === 'string') {
                            const trimmed = softwareList.trim();
                            if (trimmed) {
                              // If it's a string, split by comma
                              softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }
                          }
                          
                          return softwareArray.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {softwareArray.map((software: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {software}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">-</p>
                          );
                        })()}
                      </div>
                      {/* Emergency Contact Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        
                        if (emergencyContact) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.number || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.relation || '-'}</p>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Payment Plan Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        
                        if (enrollmentMetadata && (enrollmentMetadata.emiPlan !== undefined || enrollmentMetadata.totalDeal !== undefined)) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                              </div>
                              {enrollmentMetadata.totalDeal !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.totalDeal || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.bookingAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.bookingAmount || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.balanceAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.balanceAmount || '-'}</p>
                                </div>
                              )}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {studentProfileData.data?.user?.studentProfile?.createdAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Created</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.createdAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {studentProfileData.data?.user?.studentProfile?.updatedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Updated</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No student profile information available.</p>
                    </div>
                  )}
                </div>

                {/* Software Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Completions</h3>
                  {completionsData?.data?.completions && Array.isArray(completionsData.data.completions) && completionsData.data.completions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {completionsData.data.completions.map((completion: any) => (
                            <tr key={completion.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {completion.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.batch?.title || `Batch ${completion.batchId}`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  completion.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {completion.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.faculty?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software completions found for this student.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Student</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Bulk Student Enrollment</h2>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Upload Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully enrolled: {bulkUploadResult.success} student(s)
                  </p>
                  {bulkUploadResult.failed > 0 && (
                    <p className="text-red-700 font-medium mt-1">
                      ✗ Failed: {bulkUploadResult.failed} student(s)
                    </p>
                  )}
                </div>
                
                {bulkUploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto border border-red-200 rounded p-3 bg-red-50">
                      {bulkUploadResult.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, or .csv)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    required
                    disabled={uploadingBulk}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Maximum file size: 10MB. Download the template to see the required format.
                  </p>
                </div>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Make sure your Excel file follows the template format. 
                    Required fields: studentName, email, phone, dateOfAdmission.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Uploading...' : 'Upload & Enroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      setBulkUploadResult(null);
                    }}
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orientation Modal */}
      {isOrientationModalOpen && orientationStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Student Orientation</h2>
              <button
                onClick={() => {
                  setIsOrientationModalOpen(false);
                  setOrientationStudentId(null);
                  setActiveOrientationTab('english');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveOrientationTab('english')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'english'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setActiveOrientationTab('gujarati')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'gujarati'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gujarati
                </button>
              </div>

              {/* Orientation Content */}
              <div className="flex-1 overflow-auto p-6 bg-white">
                {activeOrientationTab === 'english' ? (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Orientation</h1>
                      <p className="text-sm text-gray-600">601 Gala Empire, Opp. Doordarshan metro station, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>3 days classroom coaching and 3 days lab practice is mandatory for every student</strong>
                          </li>
                          <li className="mb-3">
                            The batch timing may change with new software
                          </li>
                          <li className="mb-3">
                            If you have given commitment for special batch timing, plz do mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            The software practice is necessary in lab to complete assignments, for any reason if you are unable to come for practice at lab then mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            For any course, the ratio for coaching and practice is <strong>1:2</strong>, it means every classroom lecture you will have to make <strong>2 hours minimum practice</strong> and hence <strong>minimum 25 hours practice is compulsory at lab</strong>. For the best career <strong>monthly 50 hours practice is highly recommended</strong>.
                          </li>
                          <li className="mb-3">
                            Student may bring their own laptop is desirable and if he/she couldn't arrange laptop then he/she may book the practice slot accordingly. Practice lab is open <strong>9:00 am to 7:00 pm from Monday to Saturday</strong>. Faculty will guide during practice as per their availability
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            During the study of software, the faculty will guide for portfolio (assignments) and such assignment will have to get approved by faculty at end of each software.
                          </li>
                          <li className="mb-3">
                            The placement call will sole depend on the portfolio work and practice hours. <strong>The student without approved portfolio is not eligible for placement</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees payment & monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            The student who enrolled on EMI payment term has to deposits all PDCs (postdated cheques) and such cheques will be deposited in bank latest by <strong>10th of every month</strong> OR he has to pay monthly EMI between <strong>1st to 10th day of every month</strong>. Any payment after 10th day will be liable to late payment charges <strong>Rs. 50/- per day</strong>. Student will get GST paid receipt from A/C dept between <strong>15th to 20th day of every month</strong>. If any student get any exemption in payment date, plz mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            . All fees payment are including GST and non-refundable
                          </li>
                          <li className="mb-3">
                            Each course and its payment is non-transferable. No course can be down-graded in value or duration but it can be up-graded to bigger course value/duration. Any up gradation is subject to approval and for that student needs to pay difference amount in advance
                          </li>
                          <li className="mb-3">
                            The course progress will sole depend on the grasping ability of student, leaves, absenteeism and circumstances and it is no way related to payment made for the course. The payment made is no way connected and co-related with the course completion which please be noted
                          </li>
                          <li className="mb-3">
                            Cheques bounce charges <strong>Rs. 350/-</strong>
                          </li>
                          <li className="mb-3">
                            After the completion of 6 month only, if any student is not able to pay fees for any month then he has to pay <strong>Rs. 1200/- as penalty</strong> and it is not part of total payment. Student can be considered as dropped out in system in case of fail to payment and study will be paused till clearance of all due with activation charge
                          </li>
                          <li className="mb-3">
                            Student will have to pay their monthly EMI during the long leave for whatever reason.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Orientation</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            Student will get backup for the lectures/study he/she missed during the approved leaves and there is no backup for leave without approval.
                          </li>
                          <li className="mb-3">
                            If any student face any difficulty in understanding of any software then on special recommendation of faculty the entire software will get repeated without any extra cost
                          </li>
                          <li className="mb-3">
                            Once you enrolled with us you are our lifetime member and as privilege you may visit us for any technical assistance or job placement in future and all such services are <strong>FREE FOREVER</strong>
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          If you have given any special commitment by counselor then do mention here/ or leave blank
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>Student Name:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>Course:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          I, hereby confirm that I got detailed understanding for all above rule & regulation of institute and I assure to follow the same.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>Student Sign / Date</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">વિદ્યાર્થી ઓરિએન્ટેશન</h1>
                      <p className="text-sm text-gray-600">401, Shilp Square B, Opp. Sales India, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>દરેક વિદ્યાર્થી એ પોતાના કોર્સ માાં અઠિાવિયા માાં ૩ વદિર્ ક્લાર્ કોવ ાંગ અને ૩ વદિર્ પ્રેકટીર્ કરિાની રહેશે.</strong>
                          </li>
                          <li className="mb-3">
                            બે નો ટાઈમ દરેક ર્ોફ્ટિેર િખતે બદલાઈ શકે છે.
                          </li>
                          <li className="mb-3">
                            જો આપણે કોઈ ોક્કર્ ર્મયે બે આપિાની િાત ર્થઇ હોય તો અહીયાં ા જણાિિ ાં.
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            લેબ માાં આિીને પ્રેકટીર્ કરિી જરૂરી છે. કોઈ ોક્કર્ કારણોર્ર જો લેબ માાં પ્રેકટીર્ ના ર્થઇ શકે એમ હોય તો અહીયાં ા સ્પષ્ટતા કરિી
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            દરેક કોર્સ માટે <strong>૧:૨ નો પ્રેકટીર્ રેર્ીઓ જરૂરી છે</strong>. એક લેક્ ર ર્ામે <strong>૨ કલાક પ્રેકટીર્ વમવનમમ હોિી જરૂરી છે</strong>. એ મ જબ મવહના માાં <strong>25 કલાક પ્રેવક્ટર્ કરિી જરૂરી છે</strong>. પરાંત એક ર્ારી કારવકદી માટે મવહના માાં <strong>૫૦ કલાક પ્રેકટીર્ હોિી અવનિાયસ છે</strong>.
                          </li>
                          <li className="mb-3">
                            પ્રેવક્ટર્ માટે વિદ્યાર્થી પોતાન ાં લેપટોપ લઈને આિે તે આિિકાયસ છે પણ જરૂરી નર્થી. પ્રેવક્ટર્ નો ટાઈમ સ્લોટ અગાઉ ર્થી બ કરિો જરૂરી છે. જેર્થી વ્યિસ્ર્થા જાળિી શકાય. પ્રેવક્ટર્ લેબ નો ટાઈમ ર્િારે <strong>૯ ર્થી ર્ાાંજે૭ ર્ ધી રહેશે</strong>. પ્રેવક્ટર્ દરમ્યાન ફેકલ્ટી ન ાં માગસદશસન એમના ફ્રી ટાઈમ મ જબ મળી શકશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            દરેક ર્ોફ્ટિેર પૂરાં ર્થયા બાદ એક સ્ટાન્િિસ પોટસફોવલયો બનાિી ને ફેકલ્ટી પાર્ે ok કરાિિો જરૂરી છે. એક ર્ોફ્ટિેર બાદ બીજ ાં ર્ોફ્ટિેર ાલ  કરિા માટે પોટસફોવલયો િકસ પૂરાં કરિ ાં જરૂરી છે.
                          </li>
                          <li className="mb-3">
                            <strong>સ્ટાન્િિસ પોટસફોવલયો િગર અને પ રા પ્રેકટીર્ કલાકો વર્િાય જોબ પ્લેર્મેન્ટ માટે કોઈ વિદ્યાર્થી ને મોકલી શકાશે નવહ.</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees Payment & Monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            જે વિદ્યાર્થીઓ એ ફીર્ પેમેન્ટ માટે EMI કરાિેલા છે એ તમામ વિદ્યાર્થીઓ એ નિા મવહના ની <strong>૧ ર્થી ૧૦ તારીખ ર્ ધી માાં ફીર્ પેમેન્ટ કરિ ાં જરૂરી છે</strong> તેના માટે PDC આપિા જરૂરી છે જે Institute દ્વારા <strong>૧૦ તારીખે બેંક વિપોવિટ કરિામાાં આિશે</strong>. ત્યાર બાદ <strong>Rs 50/- પ્રવત વદિર્ લેખે લેટ પેમેન્ટ ાજસર્સ લાગશે</strong> જેની દરેકે નોાંધ લેિી. દરેક લેટ પેમેન્ટ ને પહોાં મળશે. જો કોઈ વિદ્યાર્થી ને સ્પેશ્યલ કેર્ તરીકે ૧૦ તારીખ પછી પયમેન્ટ ની િાત ર્થયી હોય તો અહીયાં ા જણાિિ ાં
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            ત્યારબાદ લેટ પેમેન્ટ ાજસર્સ લાગ  પિશે.
                            <br />
                            કોઈ પણ કોર્સ માટે ન ાં પેમેન્ટ GST ર્હીત ન ાં છે જેના માટે GST િળી પાકી receipt PDF copy માાં <strong>૧૫ ર્થી ૨૦ તારીખ દરમ્યાન મળી જશે</strong>. કોઈ પણ પ્રકાર ન ાં પેમેન્ટ પાછ ાં મળિા પાત્ર નર્થી.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ ન ાં પેમેન્ટ તબદીલી ને પાત્ર નર્થી. વિદ્યાર્થી એ જે કોર્સ માાં એિવમશન લીધ ાં હશે તે કોર્સ ને કોઈ બીજા નાના કોર્સ માાં તબદીલ કરી શકાશે નવહ પરાંત મોટા વકાંમત / ર્મયગાળા ના કોર્સ માાં તબદીલ કરી શકાશે આ તબદીલી મેનેજમેન્ટ ની રજામાંદી ર્થી ર્થઇ શકશે જેના માટે તફાિત ની રકમ એિિાન્ર્ માાં ભરિાની રહેશે.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ નો ર્મયગાળો એ વિદ્યાર્થી ની ર્મજશવિ / આિિત / ર્ાંજોગો ને આધારે િધારે ઓછો ર્થઇ શકશે એને ફીર્ ના EMI ર્ાર્થે ર્રખામણી કરી શકાશે નવહ. ફીર્ ના EMI એ ફીર્ પે કરિાની ર્ગિિતા માટે ની વ્યિસ્ર્થા છે માટે કોર્સ કેટલો ાલ્યો છે કે કેટલો પૂરો ર્થયો એની ર્ાર્થે ફીર્ ના EMI ને ર્રખામણી કરી શકાશે નવહ જેની દરેક વિદ્યાર્થીઓ એ નોાંધ લેિી.
                          </li>
                          <li className="mb-3">
                            જો ફીર્ ન ાં પેમેન્ટ ેક ર્થી કરાય ાં હોય અને ેક બાઉન્ર્ ર્થાય તો એના અલગ ર્થી <strong>Rs ૩૫૦/- આપિાના રહેશે</strong>.
                          </li>
                          <li className="mb-3">
                            કોઈ વિદ્યાર્થી જો પૂરો મવહનો ફીર્ ના આપી શકે તો એને <strong>Rs ૧૨૦૦/- પેનલ્ટી ાજસ ના ભરિાના રહેશે</strong> જે કોર્સ ાલ  કાયસ ના <strong>૬ મવહના પછી ર્થી જ ર્થઇ શકશે</strong>. ફીર્ પેમેન્ટ અર્થિા પેનલ્ટી ાજસર્સ ભયાસ િગર વિદ્યાર્થી વર્સ્ટમ માાં િરોપઆઉટ ર્થઇ શકે છે. કોઈ વિદ્યાર્થી પહેલા ૬ મવહના દરમ્યાન કોઈ એક મવહનો ફીર્ EMI ના આપે તો જે તે મવહના બાદ િરોપ આઉટ ગણાશે. અને એક્ટીિેશન ાજસર્સ ભયાસ બાદ ફરી ર્થી બે આપી શકાશે.
                          </li>
                          <li className="mb-3">
                            કોર્સ દરમ્યાન ર્ાંજોગોિર્ાત લાાંબી રજા લેિાની ર્થશે તો ફીર્ ના EMI બાંધ કરી શકાશે નવહ. કોર્સ નો ર્મયગાળો લીધેલી રજા મ જબ િધી જશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Help</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            દરેક વિદ્યાર્થી એ ફેકલ્ટી ની માંજૂરી ર્થી રજા લઇ શકાશે જેના માટે અલગ બેકઅપ શીખિિા માાં આિશે પણ માંજૂરી િગર ની રજા માટે બેકઅપ ની વ્યિસ્ર્થા ર્થઇ શકશે નવહ.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ વિદ્યાર્થી ને કોઈ ર્ોફ્ટિેર માાં િધારે મદદ ની જરૂર હોય તો એ ર્ોફ્ટિેર આખો કે અમ ક ટોવપક ફરી ર્થી જે ફેકલ્ટી ના ર્જેશન મ જબ કરિા માાં આિશે જેના માટે કોઈ એક્ર્ટરા પેમેન્ટ આપિાન ાં રહેત ાં નર્થી.
                          </li>
                          <li className="mb-3">
                            એકિાર કોર્સ કયાસ બાદ <strong>Lifetime કોઈ પણ પ્રકાર ની Technical મદદ માટે આપ ક્યારેય પણ institute પર આિી શકો છો</strong>. જે અમારા તમામ વિધાર્થી માટે <strong>વનિઃશ લ્ક રહેશે</strong>.
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          કોર્સ ના એિવમશન િખતે જો આપણે કોઈ ોક્કર્ પ્રકાર ન ાં કવમટમેન્ટ અપાય ાં હોય તો એ અહીયાં ા જણાિિ ાં.
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>કોર્સ ન ાં નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          મને ઉપર મ જબ તમામ વનયમો ની વિસ્તૃત જાણકારી આપિામાાં આિી છે અને મને તે બાંધનકતાસ છે.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>વિદ્યાર્થી ની ર્હી / તારીખ</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with I Agree Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                {(() => {
                  const status = orientationStatusMap[orientationStudentId];
                  const englishAccepted = status?.english || false;
                  const gujaratiAccepted = status?.gujarati || false;
                  const currentAccepted =
                    activeOrientationTab === 'english' ? englishAccepted : gujaratiAccepted;
                  const isEligible = status?.isEligible || false;

                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        {isEligible ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Student is eligible (Orientation accepted)
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">
                            ⏳ Pending approval - Please accept orientation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!currentAccepted) {
                            acceptOrientationMutation.mutate({
                              studentId: orientationStudentId,
                              language:
                                activeOrientationTab === 'english'
                                  ? OrientationLanguage.ENGLISH
                                  : OrientationLanguage.GUJARATI,
                            });
                          } else {
                            alert('This orientation has already been accepted.');
                          }
                        }}
                        disabled={currentAccepted || acceptOrientationMutation.isPending}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                          currentAccepted
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : acceptOrientationMutation.isPending
                            ? 'bg-orange-400 text-white cursor-wait'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {currentAccepted ? '✓ Accepted' : acceptOrientationMutation.isPending ? 'Processing...' : 'I Agree'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);
  const [orientationStudentId, setOrientationStudentId] = useState<number | null>(null);
  const [activeOrientationTab, setActiveOrientationTab] = useState<'english' | 'gujarati'>('english');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  
  // Store orientation status for all students
  const [orientationStatusMap, setOrientationStatusMap] = useState<Record<number, { isEligible: boolean; english: boolean; gujarati: boolean }>>({});

  // Fetch students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches for enrollment form
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      try {
        const response = await userAPI.getUser(selectedStudent!.id);
        console.log('Student profile data:', response);
        return response;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent && isViewModalOpen,
    retry: 1,
  });

  // Fetch software completions for selected student
  const { data: completionsData } = useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: () => softwareCompletionAPI.getCompletions({ studentId: selectedStudent?.id }),
    enabled: !!selectedStudent && isViewModalOpen,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => studentAPI.createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsEnrollmentModalOpen(false);
      alert('Student enrolled successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to enroll student. Please check if the enrollment endpoint exists in the backend.');
    },
  });

  // Accept orientation mutation
  const acceptOrientationMutation = useMutation({
    mutationFn: ({ studentId, language }: { studentId: number; language: OrientationLanguage }) =>
      orientationAPI.acceptOrientation(studentId, language),
    onSuccess: (data, variables) => {
      // Update local state
      setOrientationStatusMap((prev) => ({
        ...prev,
        [variables.studentId]: {
          isEligible: data.data.isEligible,
          english: data.data.orientations.english.accepted,
          gujarati: data.data.orientations.gujarati.accepted,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['bulk-orientation-status'] });
      alert('Orientation accepted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to accept orientation');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_data, variables) => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        setSelectedStudent({ ...selectedStudent, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedStudent(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
      alert('Student deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete student');
    },
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: (file: File) => studentAPI.bulkEnrollStudents(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully enrolled ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to bulk enroll students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadEnrollmentTemplate();
      
      // Check if blob is actually an error JSON response
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || 'Failed to download template');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download template error:', error);
      // Try to extract error message from response
      if (error.response?.data) {
        if (error.response.data instanceof Blob) {
          error.response.data.text().then((text: string) => {
            try {
              const errorData = JSON.parse(text);
              alert(errorData.message || 'Failed to download template');
            } catch {
              alert('Failed to download template');
            }
          });
        } else {
          alert(error.response.data.message || 'Failed to download template');
        }
      } else {
        alert(error.message || 'Failed to download template');
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkEnrollMutation.mutate(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedStudent.id,
          avatarUrl: imageUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const students = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || students.length;
  const batches = batchesData?.data || [];

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const handleEnrollStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateEnrollmentRequest = {
      studentId: parseInt(formData.get('studentId') as string),
      batchId: parseInt(formData.get('batchId') as string),
      enrollmentDate: formData.get('enrollmentDate') as string || new Date().toISOString().split('T')[0],
      status: formData.get('status') as string || 'active',
    };
    createEnrollmentMutation.mutate(data);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };


  const handleConfirmDelete = () => {
    if (selectedStudent) {
      deleteUserMutation.mutate(selectedStudent.id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Student Management</h1>
                <p className="mt-2 text-orange-100">Manage students and enrollments</p>
                <p className="mt-1 text-orange-200 text-sm font-semibold">Total Students: {totalStudents}</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/students/enroll')}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + New Enrollment
                  </button>
                  <button
                    onClick={() => setIsEnrollmentModalOpen(true)}
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    📥 Download Template
                  </button>
                  <button
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📤 Bulk Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orientation
                      </th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.avatarUrl ? (
                              <img
                                src={getImageUrl(student.avatarUrl) || ''}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const status = orientationStatusMap[student.id];
                            const isEligible = status?.isEligible || false;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isEligible
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible' : '⏳ Pending'}
                                </span>
                                <button
                                  onClick={() => {
                                    setOrientationStudentId(student.id);
                                    setIsOrientationModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="View Orientation"
                                >
                                  📄 Orientation
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(student)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Student"
                            >
                              👁️ View
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setImagePreview(student.avatarUrl || null);
                                    setIsImageModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Update Photo"
                                >
                                  📷 Photo
                                </button>
                                <button
                                  onClick={() => handleEdit(student)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Student"
                                >
                                  ✏️ Edit
                                </button>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={() => handleDelete(student)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Student"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Enroll Student in Batch</h2>
            <form onSubmit={handleEnrollStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                <select
                  name="batchId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                <input
                  type="date"
                  name="enrollmentDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createEnrollmentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={getImageUrl(selectedStudent.avatarUrl) || ''}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={selectedStudent.avatarUrl}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedStudent(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Student Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingProfile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : profileError ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm">
                    Could not load full profile. Showing basic information.
                  </p>
                </div>
                {/* Show basic info from selectedStudent */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !studentProfileData && !isLoadingProfile ? (
              <div className="space-y-6">
                {/* Show basic info from selectedStudent if API didn't return data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No student profile information available.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                <div className="flex justify-center mb-6">
                  {(() => {
                    const userData = studentProfileData?.data?.user || null;
                    const photoUrl = userData?.studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                    const studentName = userData?.name || selectedStudent?.name || 'Student';
                    
                    if (photoUrl) {
                      return (
                        <div className="text-center">
                          <img
                            src={getImageUrl(photoUrl) || photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                            }}
                          />
                          <p className="mt-3 text-sm font-medium text-gray-700">Student Photo</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{studentProfileData?.data?.user?.name || selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.email || selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.phone || selectedStudent?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          (studentProfileData?.data?.user?.isActive ?? selectedStudent) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(studentProfileData?.data?.user?.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    {(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt || '').toLocaleDateString()}</p>
                      </div>
                    )}
                    {studentProfileData?.data?.user?.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  {studentProfileData?.data?.user?.studentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.dob)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.enrollmentDate)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                        <p className="mt-1">
                          {studentProfileData.data?.user?.studentProfile?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                              studentProfileData.data.user.studentProfile.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : studentProfileData.data.user.studentProfile.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {studentProfileData.data.user.studentProfile.status}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Photo URL</label>
                        <p className="mt-1 text-sm text-gray-900 break-all">
                          {studentProfileData.data?.user?.studentProfile?.photoUrl || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.address || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Software List</label>
                        {(() => {
                          const softwareList: unknown = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList as string[];
                          } else if (softwareList && typeof softwareList === 'string') {
                            const trimmed = softwareList.trim();
                            if (trimmed) {
                              // If it's a string, split by comma
                              softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }
                          }
                          
                          return softwareArray.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {softwareArray.map((software: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {software}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">-</p>
                          );
                        })()}
                      </div>
                      {/* Emergency Contact Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        
                        if (emergencyContact) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.number || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.relation || '-'}</p>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Payment Plan Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        
                        if (enrollmentMetadata && (enrollmentMetadata.emiPlan !== undefined || enrollmentMetadata.totalDeal !== undefined)) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                              </div>
                              {enrollmentMetadata.totalDeal !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.totalDeal || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.bookingAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.bookingAmount || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.balanceAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.balanceAmount || '-'}</p>
                                </div>
                              )}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {studentProfileData.data?.user?.studentProfile?.createdAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Created</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.createdAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {studentProfileData.data?.user?.studentProfile?.updatedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Updated</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No student profile information available.</p>
                    </div>
                  )}
                </div>

                {/* Software Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Completions</h3>
                  {completionsData?.data?.completions && Array.isArray(completionsData.data.completions) && completionsData.data.completions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {completionsData.data.completions.map((completion: any) => (
                            <tr key={completion.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {completion.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.batch?.title || `Batch ${completion.batchId}`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  completion.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {completion.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.faculty?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software completions found for this student.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Student</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Bulk Student Enrollment</h2>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Upload Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully enrolled: {bulkUploadResult.success} student(s)
                  </p>
                  {bulkUploadResult.failed > 0 && (
                    <p className="text-red-700 font-medium mt-1">
                      ✗ Failed: {bulkUploadResult.failed} student(s)
                    </p>
                  )}
                </div>
                
                {bulkUploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto border border-red-200 rounded p-3 bg-red-50">
                      {bulkUploadResult.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, or .csv)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    required
                    disabled={uploadingBulk}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Maximum file size: 10MB. Download the template to see the required format.
                  </p>
                </div>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Make sure your Excel file follows the template format. 
                    Required fields: studentName, email, phone, dateOfAdmission.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Uploading...' : 'Upload & Enroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      setBulkUploadResult(null);
                    }}
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orientation Modal */}
      {isOrientationModalOpen && orientationStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Student Orientation</h2>
              <button
                onClick={() => {
                  setIsOrientationModalOpen(false);
                  setOrientationStudentId(null);
                  setActiveOrientationTab('english');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveOrientationTab('english')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'english'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setActiveOrientationTab('gujarati')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'gujarati'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gujarati
                </button>
              </div>

              {/* Orientation Content */}
              <div className="flex-1 overflow-auto p-6 bg-white">
                {activeOrientationTab === 'english' ? (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Orientation</h1>
                      <p className="text-sm text-gray-600">601 Gala Empire, Opp. Doordarshan metro station, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>3 days classroom coaching and 3 days lab practice is mandatory for every student</strong>
                          </li>
                          <li className="mb-3">
                            The batch timing may change with new software
                          </li>
                          <li className="mb-3">
                            If you have given commitment for special batch timing, plz do mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            The software practice is necessary in lab to complete assignments, for any reason if you are unable to come for practice at lab then mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            For any course, the ratio for coaching and practice is <strong>1:2</strong>, it means every classroom lecture you will have to make <strong>2 hours minimum practice</strong> and hence <strong>minimum 25 hours practice is compulsory at lab</strong>. For the best career <strong>monthly 50 hours practice is highly recommended</strong>.
                          </li>
                          <li className="mb-3">
                            Student may bring their own laptop is desirable and if he/she couldn't arrange laptop then he/she may book the practice slot accordingly. Practice lab is open <strong>9:00 am to 7:00 pm from Monday to Saturday</strong>. Faculty will guide during practice as per their availability
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            During the study of software, the faculty will guide for portfolio (assignments) and such assignment will have to get approved by faculty at end of each software.
                          </li>
                          <li className="mb-3">
                            The placement call will sole depend on the portfolio work and practice hours. <strong>The student without approved portfolio is not eligible for placement</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees payment & monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            The student who enrolled on EMI payment term has to deposits all PDCs (postdated cheques) and such cheques will be deposited in bank latest by <strong>10th of every month</strong> OR he has to pay monthly EMI between <strong>1st to 10th day of every month</strong>. Any payment after 10th day will be liable to late payment charges <strong>Rs. 50/- per day</strong>. Student will get GST paid receipt from A/C dept between <strong>15th to 20th day of every month</strong>. If any student get any exemption in payment date, plz mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            . All fees payment are including GST and non-refundable
                          </li>
                          <li className="mb-3">
                            Each course and its payment is non-transferable. No course can be down-graded in value or duration but it can be up-graded to bigger course value/duration. Any up gradation is subject to approval and for that student needs to pay difference amount in advance
                          </li>
                          <li className="mb-3">
                            The course progress will sole depend on the grasping ability of student, leaves, absenteeism and circumstances and it is no way related to payment made for the course. The payment made is no way connected and co-related with the course completion which please be noted
                          </li>
                          <li className="mb-3">
                            Cheques bounce charges <strong>Rs. 350/-</strong>
                          </li>
                          <li className="mb-3">
                            After the completion of 6 month only, if any student is not able to pay fees for any month then he has to pay <strong>Rs. 1200/- as penalty</strong> and it is not part of total payment. Student can be considered as dropped out in system in case of fail to payment and study will be paused till clearance of all due with activation charge
                          </li>
                          <li className="mb-3">
                            Student will have to pay their monthly EMI during the long leave for whatever reason.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Orientation</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            Student will get backup for the lectures/study he/she missed during the approved leaves and there is no backup for leave without approval.
                          </li>
                          <li className="mb-3">
                            If any student face any difficulty in understanding of any software then on special recommendation of faculty the entire software will get repeated without any extra cost
                          </li>
                          <li className="mb-3">
                            Once you enrolled with us you are our lifetime member and as privilege you may visit us for any technical assistance or job placement in future and all such services are <strong>FREE FOREVER</strong>
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          If you have given any special commitment by counselor then do mention here/ or leave blank
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>Student Name:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>Course:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          I, hereby confirm that I got detailed understanding for all above rule & regulation of institute and I assure to follow the same.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>Student Sign / Date</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">વિદ્યાર્થી ઓરિએન્ટેશન</h1>
                      <p className="text-sm text-gray-600">401, Shilp Square B, Opp. Sales India, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>દરેક વિદ્યાર્થી એ પોતાના કોર્સ માાં અઠિાવિયા માાં ૩ વદિર્ ક્લાર્ કોવ ાંગ અને ૩ વદિર્ પ્રેકટીર્ કરિાની રહેશે.</strong>
                          </li>
                          <li className="mb-3">
                            બે નો ટાઈમ દરેક ર્ોફ્ટિેર િખતે બદલાઈ શકે છે.
                          </li>
                          <li className="mb-3">
                            જો આપણે કોઈ ોક્કર્ ર્મયે બે આપિાની િાત ર્થઇ હોય તો અહીયાં ા જણાિિ ાં.
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            લેબ માાં આિીને પ્રેકટીર્ કરિી જરૂરી છે. કોઈ ોક્કર્ કારણોર્ર જો લેબ માાં પ્રેકટીર્ ના ર્થઇ શકે એમ હોય તો અહીયાં ા સ્પષ્ટતા કરિી
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            દરેક કોર્સ માટે <strong>૧:૨ નો પ્રેકટીર્ રેર્ીઓ જરૂરી છે</strong>. એક લેક્ ર ર્ામે <strong>૨ કલાક પ્રેકટીર્ વમવનમમ હોિી જરૂરી છે</strong>. એ મ જબ મવહના માાં <strong>25 કલાક પ્રેવક્ટર્ કરિી જરૂરી છે</strong>. પરાંત એક ર્ારી કારવકદી માટે મવહના માાં <strong>૫૦ કલાક પ્રેકટીર્ હોિી અવનિાયસ છે</strong>.
                          </li>
                          <li className="mb-3">
                            પ્રેવક્ટર્ માટે વિદ્યાર્થી પોતાન ાં લેપટોપ લઈને આિે તે આિિકાયસ છે પણ જરૂરી નર્થી. પ્રેવક્ટર્ નો ટાઈમ સ્લોટ અગાઉ ર્થી બ કરિો જરૂરી છે. જેર્થી વ્યિસ્ર્થા જાળિી શકાય. પ્રેવક્ટર્ લેબ નો ટાઈમ ર્િારે <strong>૯ ર્થી ર્ાાંજે૭ ર્ ધી રહેશે</strong>. પ્રેવક્ટર્ દરમ્યાન ફેકલ્ટી ન ાં માગસદશસન એમના ફ્રી ટાઈમ મ જબ મળી શકશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            દરેક ર્ોફ્ટિેર પૂરાં ર્થયા બાદ એક સ્ટાન્િિસ પોટસફોવલયો બનાિી ને ફેકલ્ટી પાર્ે ok કરાિિો જરૂરી છે. એક ર્ોફ્ટિેર બાદ બીજ ાં ર્ોફ્ટિેર ાલ  કરિા માટે પોટસફોવલયો િકસ પૂરાં કરિ ાં જરૂરી છે.
                          </li>
                          <li className="mb-3">
                            <strong>સ્ટાન્િિસ પોટસફોવલયો િગર અને પ રા પ્રેકટીર્ કલાકો વર્િાય જોબ પ્લેર્મેન્ટ માટે કોઈ વિદ્યાર્થી ને મોકલી શકાશે નવહ.</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees Payment & Monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            જે વિદ્યાર્થીઓ એ ફીર્ પેમેન્ટ માટે EMI કરાિેલા છે એ તમામ વિદ્યાર્થીઓ એ નિા મવહના ની <strong>૧ ર્થી ૧૦ તારીખ ર્ ધી માાં ફીર્ પેમેન્ટ કરિ ાં જરૂરી છે</strong> તેના માટે PDC આપિા જરૂરી છે જે Institute દ્વારા <strong>૧૦ તારીખે બેંક વિપોવિટ કરિામાાં આિશે</strong>. ત્યાર બાદ <strong>Rs 50/- પ્રવત વદિર્ લેખે લેટ પેમેન્ટ ાજસર્સ લાગશે</strong> જેની દરેકે નોાંધ લેિી. દરેક લેટ પેમેન્ટ ને પહોાં મળશે. જો કોઈ વિદ્યાર્થી ને સ્પેશ્યલ કેર્ તરીકે ૧૦ તારીખ પછી પયમેન્ટ ની િાત ર્થયી હોય તો અહીયાં ા જણાિિ ાં
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            ત્યારબાદ લેટ પેમેન્ટ ાજસર્સ લાગ  પિશે.
                            <br />
                            કોઈ પણ કોર્સ માટે ન ાં પેમેન્ટ GST ર્હીત ન ાં છે જેના માટે GST િળી પાકી receipt PDF copy માાં <strong>૧૫ ર્થી ૨૦ તારીખ દરમ્યાન મળી જશે</strong>. કોઈ પણ પ્રકાર ન ાં પેમેન્ટ પાછ ાં મળિા પાત્ર નર્થી.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ ન ાં પેમેન્ટ તબદીલી ને પાત્ર નર્થી. વિદ્યાર્થી એ જે કોર્સ માાં એિવમશન લીધ ાં હશે તે કોર્સ ને કોઈ બીજા નાના કોર્સ માાં તબદીલ કરી શકાશે નવહ પરાંત મોટા વકાંમત / ર્મયગાળા ના કોર્સ માાં તબદીલ કરી શકાશે આ તબદીલી મેનેજમેન્ટ ની રજામાંદી ર્થી ર્થઇ શકશે જેના માટે તફાિત ની રકમ એિિાન્ર્ માાં ભરિાની રહેશે.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ નો ર્મયગાળો એ વિદ્યાર્થી ની ર્મજશવિ / આિિત / ર્ાંજોગો ને આધારે િધારે ઓછો ર્થઇ શકશે એને ફીર્ ના EMI ર્ાર્થે ર્રખામણી કરી શકાશે નવહ. ફીર્ ના EMI એ ફીર્ પે કરિાની ર્ગિિતા માટે ની વ્યિસ્ર્થા છે માટે કોર્સ કેટલો ાલ્યો છે કે કેટલો પૂરો ર્થયો એની ર્ાર્થે ફીર્ ના EMI ને ર્રખામણી કરી શકાશે નવહ જેની દરેક વિદ્યાર્થીઓ એ નોાંધ લેિી.
                          </li>
                          <li className="mb-3">
                            જો ફીર્ ન ાં પેમેન્ટ ેક ર્થી કરાય ાં હોય અને ેક બાઉન્ર્ ર્થાય તો એના અલગ ર્થી <strong>Rs ૩૫૦/- આપિાના રહેશે</strong>.
                          </li>
                          <li className="mb-3">
                            કોઈ વિદ્યાર્થી જો પૂરો મવહનો ફીર્ ના આપી શકે તો એને <strong>Rs ૧૨૦૦/- પેનલ્ટી ાજસ ના ભરિાના રહેશે</strong> જે કોર્સ ાલ  કાયસ ના <strong>૬ મવહના પછી ર્થી જ ર્થઇ શકશે</strong>. ફીર્ પેમેન્ટ અર્થિા પેનલ્ટી ાજસર્સ ભયાસ િગર વિદ્યાર્થી વર્સ્ટમ માાં િરોપઆઉટ ર્થઇ શકે છે. કોઈ વિદ્યાર્થી પહેલા ૬ મવહના દરમ્યાન કોઈ એક મવહનો ફીર્ EMI ના આપે તો જે તે મવહના બાદ િરોપ આઉટ ગણાશે. અને એક્ટીિેશન ાજસર્સ ભયાસ બાદ ફરી ર્થી બે આપી શકાશે.
                          </li>
                          <li className="mb-3">
                            કોર્સ દરમ્યાન ર્ાંજોગોિર્ાત લાાંબી રજા લેિાની ર્થશે તો ફીર્ ના EMI બાંધ કરી શકાશે નવહ. કોર્સ નો ર્મયગાળો લીધેલી રજા મ જબ િધી જશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Help</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            દરેક વિદ્યાર્થી એ ફેકલ્ટી ની માંજૂરી ર્થી રજા લઇ શકાશે જેના માટે અલગ બેકઅપ શીખિિા માાં આિશે પણ માંજૂરી િગર ની રજા માટે બેકઅપ ની વ્યિસ્ર્થા ર્થઇ શકશે નવહ.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ વિદ્યાર્થી ને કોઈ ર્ોફ્ટિેર માાં િધારે મદદ ની જરૂર હોય તો એ ર્ોફ્ટિેર આખો કે અમ ક ટોવપક ફરી ર્થી જે ફેકલ્ટી ના ર્જેશન મ જબ કરિા માાં આિશે જેના માટે કોઈ એક્ર્ટરા પેમેન્ટ આપિાન ાં રહેત ાં નર્થી.
                          </li>
                          <li className="mb-3">
                            એકિાર કોર્સ કયાસ બાદ <strong>Lifetime કોઈ પણ પ્રકાર ની Technical મદદ માટે આપ ક્યારેય પણ institute પર આિી શકો છો</strong>. જે અમારા તમામ વિધાર્થી માટે <strong>વનિઃશ લ્ક રહેશે</strong>.
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          કોર્સ ના એિવમશન િખતે જો આપણે કોઈ ોક્કર્ પ્રકાર ન ાં કવમટમેન્ટ અપાય ાં હોય તો એ અહીયાં ા જણાિિ ાં.
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>કોર્સ ન ાં નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          મને ઉપર મ જબ તમામ વનયમો ની વિસ્તૃત જાણકારી આપિામાાં આિી છે અને મને તે બાંધનકતાસ છે.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>વિદ્યાર્થી ની ર્હી / તારીખ</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with I Agree Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                {(() => {
                  const status = orientationStatusMap[orientationStudentId];
                  const englishAccepted = status?.english || false;
                  const gujaratiAccepted = status?.gujarati || false;
                  const currentAccepted =
                    activeOrientationTab === 'english' ? englishAccepted : gujaratiAccepted;
                  const isEligible = status?.isEligible || false;

                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        {isEligible ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Student is eligible (Orientation accepted)
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">
                            ⏳ Pending approval - Please accept orientation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!currentAccepted) {
                            acceptOrientationMutation.mutate({
                              studentId: orientationStudentId,
                              language:
                                activeOrientationTab === 'english'
                                  ? OrientationLanguage.ENGLISH
                                  : OrientationLanguage.GUJARATI,
                            });
                          } else {
                            alert('This orientation has already been accepted.');
                          }
                        }}
                        disabled={currentAccepted || acceptOrientationMutation.isPending}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                          currentAccepted
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : acceptOrientationMutation.isPending
                            ? 'bg-orange-400 text-white cursor-wait'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {currentAccepted ? '✓ Accepted' : acceptOrientationMutation.isPending ? 'Processing...' : 'I Agree'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);
  const [orientationStudentId, setOrientationStudentId] = useState<number | null>(null);
  const [activeOrientationTab, setActiveOrientationTab] = useState<'english' | 'gujarati'>('english');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  
  // Store orientation status for all students
  const [orientationStatusMap, setOrientationStatusMap] = useState<Record<number, { isEligible: boolean; english: boolean; gujarati: boolean }>>({});

  // Fetch students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches for enrollment form
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      try {
        const response = await userAPI.getUser(selectedStudent!.id);
        console.log('Student profile data:', response);
        return response;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent && isViewModalOpen,
    retry: 1,
  });

  // Fetch software completions for selected student
  const { data: completionsData } = useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: () => softwareCompletionAPI.getCompletions({ studentId: selectedStudent?.id }),
    enabled: !!selectedStudent && isViewModalOpen,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => studentAPI.createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsEnrollmentModalOpen(false);
      alert('Student enrolled successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to enroll student. Please check if the enrollment endpoint exists in the backend.');
    },
  });

  // Accept orientation mutation
  const acceptOrientationMutation = useMutation({
    mutationFn: ({ studentId, language }: { studentId: number; language: OrientationLanguage }) =>
      orientationAPI.acceptOrientation(studentId, language),
    onSuccess: (data, variables) => {
      // Update local state
      setOrientationStatusMap((prev) => ({
        ...prev,
        [variables.studentId]: {
          isEligible: data.data.isEligible,
          english: data.data.orientations.english.accepted,
          gujarati: data.data.orientations.gujarati.accepted,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['bulk-orientation-status'] });
      alert('Orientation accepted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to accept orientation');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_data, variables) => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        setSelectedStudent({ ...selectedStudent, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedStudent(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
      alert('Student deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete student');
    },
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: (file: File) => studentAPI.bulkEnrollStudents(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully enrolled ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to bulk enroll students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadEnrollmentTemplate();
      
      // Check if blob is actually an error JSON response
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || 'Failed to download template');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download template error:', error);
      // Try to extract error message from response
      if (error.response?.data) {
        if (error.response.data instanceof Blob) {
          error.response.data.text().then((text: string) => {
            try {
              const errorData = JSON.parse(text);
              alert(errorData.message || 'Failed to download template');
            } catch {
              alert('Failed to download template');
            }
          });
        } else {
          alert(error.response.data.message || 'Failed to download template');
        }
      } else {
        alert(error.message || 'Failed to download template');
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkEnrollMutation.mutate(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedStudent.id,
          avatarUrl: imageUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const students = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || students.length;
  const batches = batchesData?.data || [];

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const handleEnrollStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateEnrollmentRequest = {
      studentId: parseInt(formData.get('studentId') as string),
      batchId: parseInt(formData.get('batchId') as string),
      enrollmentDate: formData.get('enrollmentDate') as string || new Date().toISOString().split('T')[0],
      status: formData.get('status') as string || 'active',
    };
    createEnrollmentMutation.mutate(data);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };


  const handleConfirmDelete = () => {
    if (selectedStudent) {
      deleteUserMutation.mutate(selectedStudent.id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Student Management</h1>
                <p className="mt-2 text-orange-100">Manage students and enrollments</p>
                <p className="mt-1 text-orange-200 text-sm font-semibold">Total Students: {totalStudents}</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/students/enroll')}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + New Enrollment
                  </button>
                  <button
                    onClick={() => setIsEnrollmentModalOpen(true)}
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    📥 Download Template
                  </button>
                  <button
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📤 Bulk Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orientation
                      </th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.avatarUrl ? (
                              <img
                                src={getImageUrl(student.avatarUrl) || ''}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const status = orientationStatusMap[student.id];
                            const isEligible = status?.isEligible || false;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isEligible
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible' : '⏳ Pending'}
                                </span>
                                <button
                                  onClick={() => {
                                    setOrientationStudentId(student.id);
                                    setIsOrientationModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="View Orientation"
                                >
                                  📄 Orientation
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(student)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Student"
                            >
                              👁️ View
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setImagePreview(student.avatarUrl || null);
                                    setIsImageModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Update Photo"
                                >
                                  📷 Photo
                                </button>
                                <button
                                  onClick={() => handleEdit(student)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Student"
                                >
                                  ✏️ Edit
                                </button>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={() => handleDelete(student)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Student"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Enroll Student in Batch</h2>
            <form onSubmit={handleEnrollStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                <select
                  name="batchId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                <input
                  type="date"
                  name="enrollmentDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createEnrollmentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={getImageUrl(selectedStudent.avatarUrl) || ''}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={selectedStudent.avatarUrl}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedStudent(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Student Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingProfile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : profileError ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm">
                    Could not load full profile. Showing basic information.
                  </p>
                </div>
                {/* Show basic info from selectedStudent */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !studentProfileData && !isLoadingProfile ? (
              <div className="space-y-6">
                {/* Show basic info from selectedStudent if API didn't return data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No student profile information available.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                <div className="flex justify-center mb-6">
                  {(() => {
                    const userData = studentProfileData?.data?.user || null;
                    const photoUrl = userData?.studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                    const studentName = userData?.name || selectedStudent?.name || 'Student';
                    
                    if (photoUrl) {
                      return (
                        <div className="text-center">
                          <img
                            src={getImageUrl(photoUrl) || photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                            }}
                          />
                          <p className="mt-3 text-sm font-medium text-gray-700">Student Photo</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{studentProfileData?.data?.user?.name || selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.email || selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.phone || selectedStudent?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          (studentProfileData?.data?.user?.isActive ?? selectedStudent) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(studentProfileData?.data?.user?.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    {(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt || '').toLocaleDateString()}</p>
                      </div>
                    )}
                    {studentProfileData?.data?.user?.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  {studentProfileData?.data?.user?.studentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.dob)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.enrollmentDate)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                        <p className="mt-1">
                          {studentProfileData.data?.user?.studentProfile?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                              studentProfileData.data.user.studentProfile.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : studentProfileData.data.user.studentProfile.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {studentProfileData.data.user.studentProfile.status}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Photo URL</label>
                        <p className="mt-1 text-sm text-gray-900 break-all">
                          {studentProfileData.data?.user?.studentProfile?.photoUrl || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.address || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Software List</label>
                        {(() => {
                          const softwareList: unknown = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList as string[];
                          } else if (softwareList && typeof softwareList === 'string') {
                            const trimmed = softwareList.trim();
                            if (trimmed) {
                              // If it's a string, split by comma
                              softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }
                          }
                          
                          return softwareArray.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {softwareArray.map((software: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {software}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">-</p>
                          );
                        })()}
                      </div>
                      {/* Emergency Contact Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        
                        if (emergencyContact) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.number || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.relation || '-'}</p>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Payment Plan Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        
                        if (enrollmentMetadata && (enrollmentMetadata.emiPlan !== undefined || enrollmentMetadata.totalDeal !== undefined)) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                              </div>
                              {enrollmentMetadata.totalDeal !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.totalDeal || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.bookingAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.bookingAmount || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.balanceAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.balanceAmount || '-'}</p>
                                </div>
                              )}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {studentProfileData.data?.user?.studentProfile?.createdAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Created</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.createdAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {studentProfileData.data?.user?.studentProfile?.updatedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Updated</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No student profile information available.</p>
                    </div>
                  )}
                </div>

                {/* Software Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Completions</h3>
                  {completionsData?.data?.completions && Array.isArray(completionsData.data.completions) && completionsData.data.completions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {completionsData.data.completions.map((completion: any) => (
                            <tr key={completion.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {completion.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.batch?.title || `Batch ${completion.batchId}`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  completion.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {completion.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.faculty?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software completions found for this student.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Student</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Bulk Student Enrollment</h2>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Upload Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully enrolled: {bulkUploadResult.success} student(s)
                  </p>
                  {bulkUploadResult.failed > 0 && (
                    <p className="text-red-700 font-medium mt-1">
                      ✗ Failed: {bulkUploadResult.failed} student(s)
                    </p>
                  )}
                </div>
                
                {bulkUploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto border border-red-200 rounded p-3 bg-red-50">
                      {bulkUploadResult.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, or .csv)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    required
                    disabled={uploadingBulk}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Maximum file size: 10MB. Download the template to see the required format.
                  </p>
                </div>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Make sure your Excel file follows the template format. 
                    Required fields: studentName, email, phone, dateOfAdmission.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Uploading...' : 'Upload & Enroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      setBulkUploadResult(null);
                    }}
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orientation Modal */}
      {isOrientationModalOpen && orientationStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Student Orientation</h2>
              <button
                onClick={() => {
                  setIsOrientationModalOpen(false);
                  setOrientationStudentId(null);
                  setActiveOrientationTab('english');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveOrientationTab('english')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'english'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setActiveOrientationTab('gujarati')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'gujarati'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gujarati
                </button>
              </div>

              {/* Orientation Content */}
              <div className="flex-1 overflow-auto p-6 bg-white">
                {activeOrientationTab === 'english' ? (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Orientation</h1>
                      <p className="text-sm text-gray-600">601 Gala Empire, Opp. Doordarshan metro station, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>3 days classroom coaching and 3 days lab practice is mandatory for every student</strong>
                          </li>
                          <li className="mb-3">
                            The batch timing may change with new software
                          </li>
                          <li className="mb-3">
                            If you have given commitment for special batch timing, plz do mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            The software practice is necessary in lab to complete assignments, for any reason if you are unable to come for practice at lab then mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            For any course, the ratio for coaching and practice is <strong>1:2</strong>, it means every classroom lecture you will have to make <strong>2 hours minimum practice</strong> and hence <strong>minimum 25 hours practice is compulsory at lab</strong>. For the best career <strong>monthly 50 hours practice is highly recommended</strong>.
                          </li>
                          <li className="mb-3">
                            Student may bring their own laptop is desirable and if he/she couldn't arrange laptop then he/she may book the practice slot accordingly. Practice lab is open <strong>9:00 am to 7:00 pm from Monday to Saturday</strong>. Faculty will guide during practice as per their availability
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            During the study of software, the faculty will guide for portfolio (assignments) and such assignment will have to get approved by faculty at end of each software.
                          </li>
                          <li className="mb-3">
                            The placement call will sole depend on the portfolio work and practice hours. <strong>The student without approved portfolio is not eligible for placement</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees payment & monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            The student who enrolled on EMI payment term has to deposits all PDCs (postdated cheques) and such cheques will be deposited in bank latest by <strong>10th of every month</strong> OR he has to pay monthly EMI between <strong>1st to 10th day of every month</strong>. Any payment after 10th day will be liable to late payment charges <strong>Rs. 50/- per day</strong>. Student will get GST paid receipt from A/C dept between <strong>15th to 20th day of every month</strong>. If any student get any exemption in payment date, plz mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            . All fees payment are including GST and non-refundable
                          </li>
                          <li className="mb-3">
                            Each course and its payment is non-transferable. No course can be down-graded in value or duration but it can be up-graded to bigger course value/duration. Any up gradation is subject to approval and for that student needs to pay difference amount in advance
                          </li>
                          <li className="mb-3">
                            The course progress will sole depend on the grasping ability of student, leaves, absenteeism and circumstances and it is no way related to payment made for the course. The payment made is no way connected and co-related with the course completion which please be noted
                          </li>
                          <li className="mb-3">
                            Cheques bounce charges <strong>Rs. 350/-</strong>
                          </li>
                          <li className="mb-3">
                            After the completion of 6 month only, if any student is not able to pay fees for any month then he has to pay <strong>Rs. 1200/- as penalty</strong> and it is not part of total payment. Student can be considered as dropped out in system in case of fail to payment and study will be paused till clearance of all due with activation charge
                          </li>
                          <li className="mb-3">
                            Student will have to pay their monthly EMI during the long leave for whatever reason.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Orientation</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            Student will get backup for the lectures/study he/she missed during the approved leaves and there is no backup for leave without approval.
                          </li>
                          <li className="mb-3">
                            If any student face any difficulty in understanding of any software then on special recommendation of faculty the entire software will get repeated without any extra cost
                          </li>
                          <li className="mb-3">
                            Once you enrolled with us you are our lifetime member and as privilege you may visit us for any technical assistance or job placement in future and all such services are <strong>FREE FOREVER</strong>
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          If you have given any special commitment by counselor then do mention here/ or leave blank
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>Student Name:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>Course:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          I, hereby confirm that I got detailed understanding for all above rule & regulation of institute and I assure to follow the same.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>Student Sign / Date</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">વિદ્યાર્થી ઓરિએન્ટેશન</h1>
                      <p className="text-sm text-gray-600">401, Shilp Square B, Opp. Sales India, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>દરેક વિદ્યાર્થી એ પોતાના કોર્સ માાં અઠિાવિયા માાં ૩ વદિર્ ક્લાર્ કોવ ાંગ અને ૩ વદિર્ પ્રેકટીર્ કરિાની રહેશે.</strong>
                          </li>
                          <li className="mb-3">
                            બે નો ટાઈમ દરેક ર્ોફ્ટિેર િખતે બદલાઈ શકે છે.
                          </li>
                          <li className="mb-3">
                            જો આપણે કોઈ ોક્કર્ ર્મયે બે આપિાની િાત ર્થઇ હોય તો અહીયાં ા જણાિિ ાં.
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            લેબ માાં આિીને પ્રેકટીર્ કરિી જરૂરી છે. કોઈ ોક્કર્ કારણોર્ર જો લેબ માાં પ્રેકટીર્ ના ર્થઇ શકે એમ હોય તો અહીયાં ા સ્પષ્ટતા કરિી
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            દરેક કોર્સ માટે <strong>૧:૨ નો પ્રેકટીર્ રેર્ીઓ જરૂરી છે</strong>. એક લેક્ ર ર્ામે <strong>૨ કલાક પ્રેકટીર્ વમવનમમ હોિી જરૂરી છે</strong>. એ મ જબ મવહના માાં <strong>25 કલાક પ્રેવક્ટર્ કરિી જરૂરી છે</strong>. પરાંત એક ર્ારી કારવકદી માટે મવહના માાં <strong>૫૦ કલાક પ્રેકટીર્ હોિી અવનિાયસ છે</strong>.
                          </li>
                          <li className="mb-3">
                            પ્રેવક્ટર્ માટે વિદ્યાર્થી પોતાન ાં લેપટોપ લઈને આિે તે આિિકાયસ છે પણ જરૂરી નર્થી. પ્રેવક્ટર્ નો ટાઈમ સ્લોટ અગાઉ ર્થી બ કરિો જરૂરી છે. જેર્થી વ્યિસ્ર્થા જાળિી શકાય. પ્રેવક્ટર્ લેબ નો ટાઈમ ર્િારે <strong>૯ ર્થી ર્ાાંજે૭ ર્ ધી રહેશે</strong>. પ્રેવક્ટર્ દરમ્યાન ફેકલ્ટી ન ાં માગસદશસન એમના ફ્રી ટાઈમ મ જબ મળી શકશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            દરેક ર્ોફ્ટિેર પૂરાં ર્થયા બાદ એક સ્ટાન્િિસ પોટસફોવલયો બનાિી ને ફેકલ્ટી પાર્ે ok કરાિિો જરૂરી છે. એક ર્ોફ્ટિેર બાદ બીજ ાં ર્ોફ્ટિેર ાલ  કરિા માટે પોટસફોવલયો િકસ પૂરાં કરિ ાં જરૂરી છે.
                          </li>
                          <li className="mb-3">
                            <strong>સ્ટાન્િિસ પોટસફોવલયો િગર અને પ રા પ્રેકટીર્ કલાકો વર્િાય જોબ પ્લેર્મેન્ટ માટે કોઈ વિદ્યાર્થી ને મોકલી શકાશે નવહ.</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees Payment & Monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            જે વિદ્યાર્થીઓ એ ફીર્ પેમેન્ટ માટે EMI કરાિેલા છે એ તમામ વિદ્યાર્થીઓ એ નિા મવહના ની <strong>૧ ર્થી ૧૦ તારીખ ર્ ધી માાં ફીર્ પેમેન્ટ કરિ ાં જરૂરી છે</strong> તેના માટે PDC આપિા જરૂરી છે જે Institute દ્વારા <strong>૧૦ તારીખે બેંક વિપોવિટ કરિામાાં આિશે</strong>. ત્યાર બાદ <strong>Rs 50/- પ્રવત વદિર્ લેખે લેટ પેમેન્ટ ાજસર્સ લાગશે</strong> જેની દરેકે નોાંધ લેિી. દરેક લેટ પેમેન્ટ ને પહોાં મળશે. જો કોઈ વિદ્યાર્થી ને સ્પેશ્યલ કેર્ તરીકે ૧૦ તારીખ પછી પયમેન્ટ ની િાત ર્થયી હોય તો અહીયાં ા જણાિિ ાં
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            ત્યારબાદ લેટ પેમેન્ટ ાજસર્સ લાગ  પિશે.
                            <br />
                            કોઈ પણ કોર્સ માટે ન ાં પેમેન્ટ GST ર્હીત ન ાં છે જેના માટે GST િળી પાકી receipt PDF copy માાં <strong>૧૫ ર્થી ૨૦ તારીખ દરમ્યાન મળી જશે</strong>. કોઈ પણ પ્રકાર ન ાં પેમેન્ટ પાછ ાં મળિા પાત્ર નર્થી.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ ન ાં પેમેન્ટ તબદીલી ને પાત્ર નર્થી. વિદ્યાર્થી એ જે કોર્સ માાં એિવમશન લીધ ાં હશે તે કોર્સ ને કોઈ બીજા નાના કોર્સ માાં તબદીલ કરી શકાશે નવહ પરાંત મોટા વકાંમત / ર્મયગાળા ના કોર્સ માાં તબદીલ કરી શકાશે આ તબદીલી મેનેજમેન્ટ ની રજામાંદી ર્થી ર્થઇ શકશે જેના માટે તફાિત ની રકમ એિિાન્ર્ માાં ભરિાની રહેશે.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ નો ર્મયગાળો એ વિદ્યાર્થી ની ર્મજશવિ / આિિત / ર્ાંજોગો ને આધારે િધારે ઓછો ર્થઇ શકશે એને ફીર્ ના EMI ર્ાર્થે ર્રખામણી કરી શકાશે નવહ. ફીર્ ના EMI એ ફીર્ પે કરિાની ર્ગિિતા માટે ની વ્યિસ્ર્થા છે માટે કોર્સ કેટલો ાલ્યો છે કે કેટલો પૂરો ર્થયો એની ર્ાર્થે ફીર્ ના EMI ને ર્રખામણી કરી શકાશે નવહ જેની દરેક વિદ્યાર્થીઓ એ નોાંધ લેિી.
                          </li>
                          <li className="mb-3">
                            જો ફીર્ ન ાં પેમેન્ટ ેક ર્થી કરાય ાં હોય અને ેક બાઉન્ર્ ર્થાય તો એના અલગ ર્થી <strong>Rs ૩૫૦/- આપિાના રહેશે</strong>.
                          </li>
                          <li className="mb-3">
                            કોઈ વિદ્યાર્થી જો પૂરો મવહનો ફીર્ ના આપી શકે તો એને <strong>Rs ૧૨૦૦/- પેનલ્ટી ાજસ ના ભરિાના રહેશે</strong> જે કોર્સ ાલ  કાયસ ના <strong>૬ મવહના પછી ર્થી જ ર્થઇ શકશે</strong>. ફીર્ પેમેન્ટ અર્થિા પેનલ્ટી ાજસર્સ ભયાસ િગર વિદ્યાર્થી વર્સ્ટમ માાં િરોપઆઉટ ર્થઇ શકે છે. કોઈ વિદ્યાર્થી પહેલા ૬ મવહના દરમ્યાન કોઈ એક મવહનો ફીર્ EMI ના આપે તો જે તે મવહના બાદ િરોપ આઉટ ગણાશે. અને એક્ટીિેશન ાજસર્સ ભયાસ બાદ ફરી ર્થી બે આપી શકાશે.
                          </li>
                          <li className="mb-3">
                            કોર્સ દરમ્યાન ર્ાંજોગોિર્ાત લાાંબી રજા લેિાની ર્થશે તો ફીર્ ના EMI બાંધ કરી શકાશે નવહ. કોર્સ નો ર્મયગાળો લીધેલી રજા મ જબ િધી જશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Help</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            દરેક વિદ્યાર્થી એ ફેકલ્ટી ની માંજૂરી ર્થી રજા લઇ શકાશે જેના માટે અલગ બેકઅપ શીખિિા માાં આિશે પણ માંજૂરી િગર ની રજા માટે બેકઅપ ની વ્યિસ્ર્થા ર્થઇ શકશે નવહ.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ વિદ્યાર્થી ને કોઈ ર્ોફ્ટિેર માાં િધારે મદદ ની જરૂર હોય તો એ ર્ોફ્ટિેર આખો કે અમ ક ટોવપક ફરી ર્થી જે ફેકલ્ટી ના ર્જેશન મ જબ કરિા માાં આિશે જેના માટે કોઈ એક્ર્ટરા પેમેન્ટ આપિાન ાં રહેત ાં નર્થી.
                          </li>
                          <li className="mb-3">
                            એકિાર કોર્સ કયાસ બાદ <strong>Lifetime કોઈ પણ પ્રકાર ની Technical મદદ માટે આપ ક્યારેય પણ institute પર આિી શકો છો</strong>. જે અમારા તમામ વિધાર્થી માટે <strong>વનિઃશ લ્ક રહેશે</strong>.
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          કોર્સ ના એિવમશન િખતે જો આપણે કોઈ ોક્કર્ પ્રકાર ન ાં કવમટમેન્ટ અપાય ાં હોય તો એ અહીયાં ા જણાિિ ાં.
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>કોર્સ ન ાં નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          મને ઉપર મ જબ તમામ વનયમો ની વિસ્તૃત જાણકારી આપિામાાં આિી છે અને મને તે બાંધનકતાસ છે.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>વિદ્યાર્થી ની ર્હી / તારીખ</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with I Agree Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                {(() => {
                  const status = orientationStatusMap[orientationStudentId];
                  const englishAccepted = status?.english || false;
                  const gujaratiAccepted = status?.gujarati || false;
                  const currentAccepted =
                    activeOrientationTab === 'english' ? englishAccepted : gujaratiAccepted;
                  const isEligible = status?.isEligible || false;

                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        {isEligible ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Student is eligible (Orientation accepted)
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">
                            ⏳ Pending approval - Please accept orientation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!currentAccepted) {
                            acceptOrientationMutation.mutate({
                              studentId: orientationStudentId,
                              language:
                                activeOrientationTab === 'english'
                                  ? OrientationLanguage.ENGLISH
                                  : OrientationLanguage.GUJARATI,
                            });
                          } else {
                            alert('This orientation has already been accepted.');
                          }
                        }}
                        disabled={currentAccepted || acceptOrientationMutation.isPending}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                          currentAccepted
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : acceptOrientationMutation.isPending
                            ? 'bg-orange-400 text-white cursor-wait'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {currentAccepted ? '✓ Accepted' : acceptOrientationMutation.isPending ? 'Processing...' : 'I Agree'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);
  const [orientationStudentId, setOrientationStudentId] = useState<number | null>(null);
  const [activeOrientationTab, setActiveOrientationTab] = useState<'english' | 'gujarati'>('english');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  
  // Store orientation status for all students
  const [orientationStatusMap, setOrientationStatusMap] = useState<Record<number, { isEligible: boolean; english: boolean; gujarati: boolean }>>({});

  // Fetch students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches for enrollment form
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      try {
        const response = await userAPI.getUser(selectedStudent!.id);
        console.log('Student profile data:', response);
        return response;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent && isViewModalOpen,
    retry: 1,
  });

  // Fetch software completions for selected student
  const { data: completionsData } = useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: () => softwareCompletionAPI.getCompletions({ studentId: selectedStudent?.id }),
    enabled: !!selectedStudent && isViewModalOpen,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => studentAPI.createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsEnrollmentModalOpen(false);
      alert('Student enrolled successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to enroll student. Please check if the enrollment endpoint exists in the backend.');
    },
  });

  // Accept orientation mutation
  const acceptOrientationMutation = useMutation({
    mutationFn: ({ studentId, language }: { studentId: number; language: OrientationLanguage }) =>
      orientationAPI.acceptOrientation(studentId, language),
    onSuccess: (data, variables) => {
      // Update local state
      setOrientationStatusMap((prev) => ({
        ...prev,
        [variables.studentId]: {
          isEligible: data.data.isEligible,
          english: data.data.orientations.english.accepted,
          gujarati: data.data.orientations.gujarati.accepted,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['bulk-orientation-status'] });
      alert('Orientation accepted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to accept orientation');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_data, variables) => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        setSelectedStudent({ ...selectedStudent, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedStudent(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
      alert('Student deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete student');
    },
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: (file: File) => studentAPI.bulkEnrollStudents(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully enrolled ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to bulk enroll students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadEnrollmentTemplate();
      
      // Check if blob is actually an error JSON response
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || 'Failed to download template');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download template error:', error);
      // Try to extract error message from response
      if (error.response?.data) {
        if (error.response.data instanceof Blob) {
          error.response.data.text().then((text: string) => {
            try {
              const errorData = JSON.parse(text);
              alert(errorData.message || 'Failed to download template');
            } catch {
              alert('Failed to download template');
            }
          });
        } else {
          alert(error.response.data.message || 'Failed to download template');
        }
      } else {
        alert(error.message || 'Failed to download template');
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkEnrollMutation.mutate(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedStudent.id,
          avatarUrl: imageUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const students = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || students.length;
  const batches = batchesData?.data || [];

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const handleEnrollStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateEnrollmentRequest = {
      studentId: parseInt(formData.get('studentId') as string),
      batchId: parseInt(formData.get('batchId') as string),
      enrollmentDate: formData.get('enrollmentDate') as string || new Date().toISOString().split('T')[0],
      status: formData.get('status') as string || 'active',
    };
    createEnrollmentMutation.mutate(data);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };


  const handleConfirmDelete = () => {
    if (selectedStudent) {
      deleteUserMutation.mutate(selectedStudent.id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Student Management</h1>
                <p className="mt-2 text-orange-100">Manage students and enrollments</p>
                <p className="mt-1 text-orange-200 text-sm font-semibold">Total Students: {totalStudents}</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/students/enroll')}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + New Enrollment
                  </button>
                  <button
                    onClick={() => setIsEnrollmentModalOpen(true)}
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    📥 Download Template
                  </button>
                  <button
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📤 Bulk Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orientation
                      </th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.avatarUrl ? (
                              <img
                                src={getImageUrl(student.avatarUrl) || ''}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const status = orientationStatusMap[student.id];
                            const isEligible = status?.isEligible || false;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isEligible
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible' : '⏳ Pending'}
                                </span>
                                <button
                                  onClick={() => {
                                    setOrientationStudentId(student.id);
                                    setIsOrientationModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="View Orientation"
                                >
                                  📄 Orientation
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(student)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Student"
                            >
                              👁️ View
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setImagePreview(student.avatarUrl || null);
                                    setIsImageModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Update Photo"
                                >
                                  📷 Photo
                                </button>
                                <button
                                  onClick={() => handleEdit(student)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Student"
                                >
                                  ✏️ Edit
                                </button>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={() => handleDelete(student)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Student"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Enroll Student in Batch</h2>
            <form onSubmit={handleEnrollStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                <select
                  name="batchId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                <input
                  type="date"
                  name="enrollmentDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createEnrollmentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={getImageUrl(selectedStudent.avatarUrl) || ''}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={selectedStudent.avatarUrl}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedStudent(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Student Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingProfile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : profileError ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm">
                    Could not load full profile. Showing basic information.
                  </p>
                </div>
                {/* Show basic info from selectedStudent */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !studentProfileData && !isLoadingProfile ? (
              <div className="space-y-6">
                {/* Show basic info from selectedStudent if API didn't return data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No student profile information available.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                <div className="flex justify-center mb-6">
                  {(() => {
                    const userData = studentProfileData?.data?.user || null;
                    const photoUrl = userData?.studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                    const studentName = userData?.name || selectedStudent?.name || 'Student';
                    
                    if (photoUrl) {
                      return (
                        <div className="text-center">
                          <img
                            src={getImageUrl(photoUrl) || photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                            }}
                          />
                          <p className="mt-3 text-sm font-medium text-gray-700">Student Photo</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{studentProfileData?.data?.user?.name || selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.email || selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.phone || selectedStudent?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          (studentProfileData?.data?.user?.isActive ?? selectedStudent) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(studentProfileData?.data?.user?.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    {(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt || '').toLocaleDateString()}</p>
                      </div>
                    )}
                    {studentProfileData?.data?.user?.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  {studentProfileData?.data?.user?.studentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.dob)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.enrollmentDate)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                        <p className="mt-1">
                          {studentProfileData.data?.user?.studentProfile?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                              studentProfileData.data.user.studentProfile.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : studentProfileData.data.user.studentProfile.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {studentProfileData.data.user.studentProfile.status}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Photo URL</label>
                        <p className="mt-1 text-sm text-gray-900 break-all">
                          {studentProfileData.data?.user?.studentProfile?.photoUrl || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.address || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Software List</label>
                        {(() => {
                          const softwareList: unknown = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList as string[];
                          } else if (softwareList && typeof softwareList === 'string') {
                            const trimmed = softwareList.trim();
                            if (trimmed) {
                              // If it's a string, split by comma
                              softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }
                          }
                          
                          return softwareArray.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {softwareArray.map((software: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {software}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">-</p>
                          );
                        })()}
                      </div>
                      {/* Emergency Contact Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        
                        if (emergencyContact) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.number || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.relation || '-'}</p>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Payment Plan Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        
                        if (enrollmentMetadata && (enrollmentMetadata.emiPlan !== undefined || enrollmentMetadata.totalDeal !== undefined)) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                              </div>
                              {enrollmentMetadata.totalDeal !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.totalDeal || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.bookingAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.bookingAmount || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.balanceAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.balanceAmount || '-'}</p>
                                </div>
                              )}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {studentProfileData.data?.user?.studentProfile?.createdAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Created</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.createdAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {studentProfileData.data?.user?.studentProfile?.updatedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Updated</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No student profile information available.</p>
                    </div>
                  )}
                </div>

                {/* Software Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Completions</h3>
                  {completionsData?.data?.completions && Array.isArray(completionsData.data.completions) && completionsData.data.completions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {completionsData.data.completions.map((completion: any) => (
                            <tr key={completion.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {completion.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.batch?.title || `Batch ${completion.batchId}`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  completion.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {completion.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.faculty?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software completions found for this student.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Student</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Bulk Student Enrollment</h2>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Upload Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully enrolled: {bulkUploadResult.success} student(s)
                  </p>
                  {bulkUploadResult.failed > 0 && (
                    <p className="text-red-700 font-medium mt-1">
                      ✗ Failed: {bulkUploadResult.failed} student(s)
                    </p>
                  )}
                </div>
                
                {bulkUploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto border border-red-200 rounded p-3 bg-red-50">
                      {bulkUploadResult.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, or .csv)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    required
                    disabled={uploadingBulk}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Maximum file size: 10MB. Download the template to see the required format.
                  </p>
                </div>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Make sure your Excel file follows the template format. 
                    Required fields: studentName, email, phone, dateOfAdmission.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Uploading...' : 'Upload & Enroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      setBulkUploadResult(null);
                    }}
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orientation Modal */}
      {isOrientationModalOpen && orientationStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Student Orientation</h2>
              <button
                onClick={() => {
                  setIsOrientationModalOpen(false);
                  setOrientationStudentId(null);
                  setActiveOrientationTab('english');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveOrientationTab('english')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'english'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setActiveOrientationTab('gujarati')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'gujarati'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gujarati
                </button>
              </div>

              {/* Orientation Content */}
              <div className="flex-1 overflow-auto p-6 bg-white">
                {activeOrientationTab === 'english' ? (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Orientation</h1>
                      <p className="text-sm text-gray-600">601 Gala Empire, Opp. Doordarshan metro station, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>3 days classroom coaching and 3 days lab practice is mandatory for every student</strong>
                          </li>
                          <li className="mb-3">
                            The batch timing may change with new software
                          </li>
                          <li className="mb-3">
                            If you have given commitment for special batch timing, plz do mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            The software practice is necessary in lab to complete assignments, for any reason if you are unable to come for practice at lab then mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            For any course, the ratio for coaching and practice is <strong>1:2</strong>, it means every classroom lecture you will have to make <strong>2 hours minimum practice</strong> and hence <strong>minimum 25 hours practice is compulsory at lab</strong>. For the best career <strong>monthly 50 hours practice is highly recommended</strong>.
                          </li>
                          <li className="mb-3">
                            Student may bring their own laptop is desirable and if he/she couldn't arrange laptop then he/she may book the practice slot accordingly. Practice lab is open <strong>9:00 am to 7:00 pm from Monday to Saturday</strong>. Faculty will guide during practice as per their availability
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            During the study of software, the faculty will guide for portfolio (assignments) and such assignment will have to get approved by faculty at end of each software.
                          </li>
                          <li className="mb-3">
                            The placement call will sole depend on the portfolio work and practice hours. <strong>The student without approved portfolio is not eligible for placement</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees payment & monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            The student who enrolled on EMI payment term has to deposits all PDCs (postdated cheques) and such cheques will be deposited in bank latest by <strong>10th of every month</strong> OR he has to pay monthly EMI between <strong>1st to 10th day of every month</strong>. Any payment after 10th day will be liable to late payment charges <strong>Rs. 50/- per day</strong>. Student will get GST paid receipt from A/C dept between <strong>15th to 20th day of every month</strong>. If any student get any exemption in payment date, plz mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            . All fees payment are including GST and non-refundable
                          </li>
                          <li className="mb-3">
                            Each course and its payment is non-transferable. No course can be down-graded in value or duration but it can be up-graded to bigger course value/duration. Any up gradation is subject to approval and for that student needs to pay difference amount in advance
                          </li>
                          <li className="mb-3">
                            The course progress will sole depend on the grasping ability of student, leaves, absenteeism and circumstances and it is no way related to payment made for the course. The payment made is no way connected and co-related with the course completion which please be noted
                          </li>
                          <li className="mb-3">
                            Cheques bounce charges <strong>Rs. 350/-</strong>
                          </li>
                          <li className="mb-3">
                            After the completion of 6 month only, if any student is not able to pay fees for any month then he has to pay <strong>Rs. 1200/- as penalty</strong> and it is not part of total payment. Student can be considered as dropped out in system in case of fail to payment and study will be paused till clearance of all due with activation charge
                          </li>
                          <li className="mb-3">
                            Student will have to pay their monthly EMI during the long leave for whatever reason.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Orientation</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            Student will get backup for the lectures/study he/she missed during the approved leaves and there is no backup for leave without approval.
                          </li>
                          <li className="mb-3">
                            If any student face any difficulty in understanding of any software then on special recommendation of faculty the entire software will get repeated without any extra cost
                          </li>
                          <li className="mb-3">
                            Once you enrolled with us you are our lifetime member and as privilege you may visit us for any technical assistance or job placement in future and all such services are <strong>FREE FOREVER</strong>
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          If you have given any special commitment by counselor then do mention here/ or leave blank
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>Student Name:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>Course:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          I, hereby confirm that I got detailed understanding for all above rule & regulation of institute and I assure to follow the same.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>Student Sign / Date</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">વિદ્યાર્થી ઓરિએન્ટેશન</h1>
                      <p className="text-sm text-gray-600">401, Shilp Square B, Opp. Sales India, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>દરેક વિદ્યાર્થી એ પોતાના કોર્સ માાં અઠિાવિયા માાં ૩ વદિર્ ક્લાર્ કોવ ાંગ અને ૩ વદિર્ પ્રેકટીર્ કરિાની રહેશે.</strong>
                          </li>
                          <li className="mb-3">
                            બે નો ટાઈમ દરેક ર્ોફ્ટિેર િખતે બદલાઈ શકે છે.
                          </li>
                          <li className="mb-3">
                            જો આપણે કોઈ ોક્કર્ ર્મયે બે આપિાની િાત ર્થઇ હોય તો અહીયાં ા જણાિિ ાં.
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            લેબ માાં આિીને પ્રેકટીર્ કરિી જરૂરી છે. કોઈ ોક્કર્ કારણોર્ર જો લેબ માાં પ્રેકટીર્ ના ર્થઇ શકે એમ હોય તો અહીયાં ા સ્પષ્ટતા કરિી
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            દરેક કોર્સ માટે <strong>૧:૨ નો પ્રેકટીર્ રેર્ીઓ જરૂરી છે</strong>. એક લેક્ ર ર્ામે <strong>૨ કલાક પ્રેકટીર્ વમવનમમ હોિી જરૂરી છે</strong>. એ મ જબ મવહના માાં <strong>25 કલાક પ્રેવક્ટર્ કરિી જરૂરી છે</strong>. પરાંત એક ર્ારી કારવકદી માટે મવહના માાં <strong>૫૦ કલાક પ્રેકટીર્ હોિી અવનિાયસ છે</strong>.
                          </li>
                          <li className="mb-3">
                            પ્રેવક્ટર્ માટે વિદ્યાર્થી પોતાન ાં લેપટોપ લઈને આિે તે આિિકાયસ છે પણ જરૂરી નર્થી. પ્રેવક્ટર્ નો ટાઈમ સ્લોટ અગાઉ ર્થી બ કરિો જરૂરી છે. જેર્થી વ્યિસ્ર્થા જાળિી શકાય. પ્રેવક્ટર્ લેબ નો ટાઈમ ર્િારે <strong>૯ ર્થી ર્ાાંજે૭ ર્ ધી રહેશે</strong>. પ્રેવક્ટર્ દરમ્યાન ફેકલ્ટી ન ાં માગસદશસન એમના ફ્રી ટાઈમ મ જબ મળી શકશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            દરેક ર્ોફ્ટિેર પૂરાં ર્થયા બાદ એક સ્ટાન્િિસ પોટસફોવલયો બનાિી ને ફેકલ્ટી પાર્ે ok કરાિિો જરૂરી છે. એક ર્ોફ્ટિેર બાદ બીજ ાં ર્ોફ્ટિેર ાલ  કરિા માટે પોટસફોવલયો િકસ પૂરાં કરિ ાં જરૂરી છે.
                          </li>
                          <li className="mb-3">
                            <strong>સ્ટાન્િિસ પોટસફોવલયો િગર અને પ રા પ્રેકટીર્ કલાકો વર્િાય જોબ પ્લેર્મેન્ટ માટે કોઈ વિદ્યાર્થી ને મોકલી શકાશે નવહ.</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees Payment & Monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            જે વિદ્યાર્થીઓ એ ફીર્ પેમેન્ટ માટે EMI કરાિેલા છે એ તમામ વિદ્યાર્થીઓ એ નિા મવહના ની <strong>૧ ર્થી ૧૦ તારીખ ર્ ધી માાં ફીર્ પેમેન્ટ કરિ ાં જરૂરી છે</strong> તેના માટે PDC આપિા જરૂરી છે જે Institute દ્વારા <strong>૧૦ તારીખે બેંક વિપોવિટ કરિામાાં આિશે</strong>. ત્યાર બાદ <strong>Rs 50/- પ્રવત વદિર્ લેખે લેટ પેમેન્ટ ાજસર્સ લાગશે</strong> જેની દરેકે નોાંધ લેિી. દરેક લેટ પેમેન્ટ ને પહોાં મળશે. જો કોઈ વિદ્યાર્થી ને સ્પેશ્યલ કેર્ તરીકે ૧૦ તારીખ પછી પયમેન્ટ ની િાત ર્થયી હોય તો અહીયાં ા જણાિિ ાં
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            ત્યારબાદ લેટ પેમેન્ટ ાજસર્સ લાગ  પિશે.
                            <br />
                            કોઈ પણ કોર્સ માટે ન ાં પેમેન્ટ GST ર્હીત ન ાં છે જેના માટે GST િળી પાકી receipt PDF copy માાં <strong>૧૫ ર્થી ૨૦ તારીખ દરમ્યાન મળી જશે</strong>. કોઈ પણ પ્રકાર ન ાં પેમેન્ટ પાછ ાં મળિા પાત્ર નર્થી.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ ન ાં પેમેન્ટ તબદીલી ને પાત્ર નર્થી. વિદ્યાર્થી એ જે કોર્સ માાં એિવમશન લીધ ાં હશે તે કોર્સ ને કોઈ બીજા નાના કોર્સ માાં તબદીલ કરી શકાશે નવહ પરાંત મોટા વકાંમત / ર્મયગાળા ના કોર્સ માાં તબદીલ કરી શકાશે આ તબદીલી મેનેજમેન્ટ ની રજામાંદી ર્થી ર્થઇ શકશે જેના માટે તફાિત ની રકમ એિિાન્ર્ માાં ભરિાની રહેશે.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ નો ર્મયગાળો એ વિદ્યાર્થી ની ર્મજશવિ / આિિત / ર્ાંજોગો ને આધારે િધારે ઓછો ર્થઇ શકશે એને ફીર્ ના EMI ર્ાર્થે ર્રખામણી કરી શકાશે નવહ. ફીર્ ના EMI એ ફીર્ પે કરિાની ર્ગિિતા માટે ની વ્યિસ્ર્થા છે માટે કોર્સ કેટલો ાલ્યો છે કે કેટલો પૂરો ર્થયો એની ર્ાર્થે ફીર્ ના EMI ને ર્રખામણી કરી શકાશે નવહ જેની દરેક વિદ્યાર્થીઓ એ નોાંધ લેિી.
                          </li>
                          <li className="mb-3">
                            જો ફીર્ ન ાં પેમેન્ટ ેક ર્થી કરાય ાં હોય અને ેક બાઉન્ર્ ર્થાય તો એના અલગ ર્થી <strong>Rs ૩૫૦/- આપિાના રહેશે</strong>.
                          </li>
                          <li className="mb-3">
                            કોઈ વિદ્યાર્થી જો પૂરો મવહનો ફીર્ ના આપી શકે તો એને <strong>Rs ૧૨૦૦/- પેનલ્ટી ાજસ ના ભરિાના રહેશે</strong> જે કોર્સ ાલ  કાયસ ના <strong>૬ મવહના પછી ર્થી જ ર્થઇ શકશે</strong>. ફીર્ પેમેન્ટ અર્થિા પેનલ્ટી ાજસર્સ ભયાસ િગર વિદ્યાર્થી વર્સ્ટમ માાં િરોપઆઉટ ર્થઇ શકે છે. કોઈ વિદ્યાર્થી પહેલા ૬ મવહના દરમ્યાન કોઈ એક મવહનો ફીર્ EMI ના આપે તો જે તે મવહના બાદ િરોપ આઉટ ગણાશે. અને એક્ટીિેશન ાજસર્સ ભયાસ બાદ ફરી ર્થી બે આપી શકાશે.
                          </li>
                          <li className="mb-3">
                            કોર્સ દરમ્યાન ર્ાંજોગોિર્ાત લાાંબી રજા લેિાની ર્થશે તો ફીર્ ના EMI બાંધ કરી શકાશે નવહ. કોર્સ નો ર્મયગાળો લીધેલી રજા મ જબ િધી જશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Help</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            દરેક વિદ્યાર્થી એ ફેકલ્ટી ની માંજૂરી ર્થી રજા લઇ શકાશે જેના માટે અલગ બેકઅપ શીખિિા માાં આિશે પણ માંજૂરી િગર ની રજા માટે બેકઅપ ની વ્યિસ્ર્થા ર્થઇ શકશે નવહ.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ વિદ્યાર્થી ને કોઈ ર્ોફ્ટિેર માાં િધારે મદદ ની જરૂર હોય તો એ ર્ોફ્ટિેર આખો કે અમ ક ટોવપક ફરી ર્થી જે ફેકલ્ટી ના ર્જેશન મ જબ કરિા માાં આિશે જેના માટે કોઈ એક્ર્ટરા પેમેન્ટ આપિાન ાં રહેત ાં નર્થી.
                          </li>
                          <li className="mb-3">
                            એકિાર કોર્સ કયાસ બાદ <strong>Lifetime કોઈ પણ પ્રકાર ની Technical મદદ માટે આપ ક્યારેય પણ institute પર આિી શકો છો</strong>. જે અમારા તમામ વિધાર્થી માટે <strong>વનિઃશ લ્ક રહેશે</strong>.
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          કોર્સ ના એિવમશન િખતે જો આપણે કોઈ ોક્કર્ પ્રકાર ન ાં કવમટમેન્ટ અપાય ાં હોય તો એ અહીયાં ા જણાિિ ાં.
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>કોર્સ ન ાં નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          મને ઉપર મ જબ તમામ વનયમો ની વિસ્તૃત જાણકારી આપિામાાં આિી છે અને મને તે બાંધનકતાસ છે.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>વિદ્યાર્થી ની ર્હી / તારીખ</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with I Agree Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                {(() => {
                  const status = orientationStatusMap[orientationStudentId];
                  const englishAccepted = status?.english || false;
                  const gujaratiAccepted = status?.gujarati || false;
                  const currentAccepted =
                    activeOrientationTab === 'english' ? englishAccepted : gujaratiAccepted;
                  const isEligible = status?.isEligible || false;

                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        {isEligible ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Student is eligible (Orientation accepted)
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">
                            ⏳ Pending approval - Please accept orientation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!currentAccepted) {
                            acceptOrientationMutation.mutate({
                              studentId: orientationStudentId,
                              language:
                                activeOrientationTab === 'english'
                                  ? OrientationLanguage.ENGLISH
                                  : OrientationLanguage.GUJARATI,
                            });
                          } else {
                            alert('This orientation has already been accepted.');
                          }
                        }}
                        disabled={currentAccepted || acceptOrientationMutation.isPending}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                          currentAccepted
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : acceptOrientationMutation.isPending
                            ? 'bg-orange-400 text-white cursor-wait'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {currentAccepted ? '✓ Accepted' : acceptOrientationMutation.isPending ? 'Processing...' : 'I Agree'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);
  const [orientationStudentId, setOrientationStudentId] = useState<number | null>(null);
  const [activeOrientationTab, setActiveOrientationTab] = useState<'english' | 'gujarati'>('english');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  
  // Store orientation status for all students
  const [orientationStatusMap, setOrientationStatusMap] = useState<Record<number, { isEligible: boolean; english: boolean; gujarati: boolean }>>({});

  // Fetch students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches for enrollment form
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      try {
        const response = await userAPI.getUser(selectedStudent!.id);
        console.log('Student profile data:', response);
        return response;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent && isViewModalOpen,
    retry: 1,
  });

  // Fetch software completions for selected student
  const { data: completionsData } = useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: () => softwareCompletionAPI.getCompletions({ studentId: selectedStudent?.id }),
    enabled: !!selectedStudent && isViewModalOpen,
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => studentAPI.createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsEnrollmentModalOpen(false);
      alert('Student enrolled successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to enroll student. Please check if the enrollment endpoint exists in the backend.');
    },
  });

  // Accept orientation mutation
  const acceptOrientationMutation = useMutation({
    mutationFn: ({ studentId, language }: { studentId: number; language: OrientationLanguage }) =>
      orientationAPI.acceptOrientation(studentId, language),
    onSuccess: (data, variables) => {
      // Update local state
      setOrientationStatusMap((prev) => ({
        ...prev,
        [variables.studentId]: {
          isEligible: data.data.isEligible,
          english: data.data.orientations.english.accepted,
          gujarati: data.data.orientations.gujarati.accepted,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['bulk-orientation-status'] });
      alert('Orientation accepted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to accept orientation');
    },
  });

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (_data, variables) => {
      // Invalidate and refetch students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        setSelectedStudent({ ...selectedStudent, avatarUrl: variables.avatarUrl });
      }
      setUploadingImage(false);
      setIsImageModalOpen(false);
      setSelectedStudent(null);
      setImagePreview(null);
      alert('Image updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update image');
      setUploadingImage(false);
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userAPI.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteModalOpen(false);
      setSelectedStudent(null);
      alert('Student deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete student');
    },
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: (file: File) => studentAPI.bulkEnrollStudents(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully enrolled ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to bulk enroll students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadEnrollmentTemplate();
      
      // Check if blob is actually an error JSON response
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        alert(errorData.message || 'Failed to download template');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download template error:', error);
      // Try to extract error message from response
      if (error.response?.data) {
        if (error.response.data instanceof Blob) {
          error.response.data.text().then((text: string) => {
            try {
              const errorData = JSON.parse(text);
              alert(errorData.message || 'Failed to download template');
            } catch {
              alert('Failed to download template');
            }
          });
        } else {
          alert(error.response.data.message || 'Failed to download template');
        }
      } else {
        alert(error.message || 'Failed to download template');
      }
    }
  };

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.');
      return;
    }

    setUploadingBulk(true);
    setBulkUploadResult(null);
    bulkEnrollMutation.mutate(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingImage(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      console.log('Upload response:', uploadResponse);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const imageUrl = uploadResponse.data.files[0].url;
        console.log('Uploaded image URL:', imageUrl);
        // Update preview with the uploaded URL
        setImagePreview(imageUrl);
        // Update user with new image URL
        updateUserImageMutation.mutate({
          userId: selectedStudent.id,
          avatarUrl: imageUrl,
        });
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload image');
      setUploadingImage(false);
      setImagePreview(null);
    }
  };

  const students = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || students.length;
  const batches = batchesData?.data || [];

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const handleEnrollStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateEnrollmentRequest = {
      studentId: parseInt(formData.get('studentId') as string),
      batchId: parseInt(formData.get('batchId') as string),
      enrollmentDate: formData.get('enrollmentDate') as string || new Date().toISOString().split('T')[0],
      status: formData.get('status') as string || 'active',
    };
    createEnrollmentMutation.mutate(data);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };


  const handleConfirmDelete = () => {
    if (selectedStudent) {
      deleteUserMutation.mutate(selectedStudent.id);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Student Management</h1>
                <p className="mt-2 text-orange-100">Manage students and enrollments</p>
                <p className="mt-1 text-orange-200 text-sm font-semibold">Total Students: {totalStudents}</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/students/enroll')}
                    className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                  >
                    + New Enrollment
                  </button>
                  <button
                    onClick={() => setIsEnrollmentModalOpen(true)}
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                  >
                    Enroll Existing Student
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    📥 Download Template
                  </button>
                  <button
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📤 Bulk Upload
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orientation
                      </th>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.avatarUrl ? (
                              <img
                                src={getImageUrl(student.avatarUrl) || ''}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const status = orientationStatusMap[student.id];
                            const isEligible = status?.isEligible || false;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isEligible
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible' : '⏳ Pending'}
                                </span>
                                <button
                                  onClick={() => {
                                    setOrientationStudentId(student.id);
                                    setIsOrientationModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
                                  title="View Orientation"
                                >
                                  📄 Orientation
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(student)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Student"
                            >
                              👁️ View
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setImagePreview(student.avatarUrl || null);
                                    setIsImageModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Update Photo"
                                >
                                  📷 Photo
                                </button>
                                <button
                                  onClick={() => handleEdit(student)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Edit Student"
                                >
                                  ✏️ Edit
                                </button>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={() => handleDelete(student)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Student"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Enroll Student in Batch</h2>
            <form onSubmit={handleEnrollStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  name="studentId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch *</label>
                <select
                  name="batchId"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select a batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date *</label>
                <input
                  type="date"
                  name="enrollmentDate"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createEnrollmentMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {isImageModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={imagePreview}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={getImageUrl(selectedStudent.avatarUrl) || ''}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={selectedStudent.avatarUrl}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image (JPG, PNG - Max 5MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImageModalOpen(false);
                  setSelectedStudent(null);
                  setImagePreview(null);
                }}
                disabled={uploadingImage}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Student Profile</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingProfile ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : profileError ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm">
                    Could not load full profile. Showing basic information.
                  </p>
                </div>
                {/* Show basic info from selectedStudent */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !studentProfileData && !isLoadingProfile ? (
              <div className="space-y-6">
                {/* Show basic info from selectedStudent if API didn't return data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedStudent?.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No student profile information available.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                <div className="flex justify-center mb-6">
                  {(() => {
                    const userData = studentProfileData?.data?.user || null;
                    const photoUrl = userData?.studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                    const studentName = userData?.name || selectedStudent?.name || 'Student';
                    
                    if (photoUrl) {
                      return (
                        <div className="text-center">
                          <img
                            src={getImageUrl(photoUrl) || photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                            }}
                          />
                          <p className="mt-3 text-sm font-medium text-gray-700">Student Photo</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{studentProfileData?.data?.user?.name || selectedStudent?.name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.email || selectedStudent?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{studentProfileData?.data?.user?.phone || selectedStudent?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <p className="mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          (studentProfileData?.data?.user?.isActive ?? selectedStudent) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(studentProfileData?.data?.user?.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    {(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.createdAt || selectedStudent?.createdAt || '').toLocaleDateString()}</p>
                      </div>
                    )}
                    {studentProfileData?.data?.user?.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                  {studentProfileData?.data?.user?.studentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.dob)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatDateDDMMYYYY(studentProfileData.data?.user?.studentProfile?.enrollmentDate)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                        <p className="mt-1">
                          {studentProfileData.data?.user?.studentProfile?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                              studentProfileData.data.user.studentProfile.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : studentProfileData.data.user.studentProfile.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {studentProfileData.data.user.studentProfile.status}
                            </span>
                          ) : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Photo URL</label>
                        <p className="mt-1 text-sm text-gray-900 break-all">
                          {studentProfileData.data?.user?.studentProfile?.photoUrl || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.address || '-'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Software List</label>
                        {(() => {
                          const softwareList: unknown = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList as string[];
                          } else if (softwareList && typeof softwareList === 'string') {
                            const trimmed = softwareList.trim();
                            if (trimmed) {
                              // If it's a string, split by comma
                              softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            }
                          }
                          
                          return softwareArray.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {softwareArray.map((software: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {software}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">-</p>
                          );
                        })()}
                      </div>
                      {/* Emergency Contact Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        
                        if (emergencyContact) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.number || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.name || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">{emergencyContact.relation || '-'}</p>
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Payment Plan Information */}
                      {(() => {
                        const documents = studentProfileData.data?.user?.studentProfile?.documents;
                        const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents 
                          ? (documents as any).enrollmentMetadata 
                          : null;
                        
                        if (enrollmentMetadata && (enrollmentMetadata.emiPlan !== undefined || enrollmentMetadata.totalDeal !== undefined)) {
                          return (
                            <>
                              <div className="md:col-span-2 border-t pt-4 mt-4">
                                <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                              </div>
                              {enrollmentMetadata.totalDeal !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.totalDeal || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.bookingAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.bookingAmount || '-'}</p>
                                </div>
                              )}
                              {enrollmentMetadata.balanceAmount !== undefined && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                  <p className="mt-1 text-sm text-gray-900">₹{enrollmentMetadata.balanceAmount || '-'}</p>
                                </div>
                              )}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {studentProfileData.data?.user?.studentProfile?.createdAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Created</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.createdAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {studentProfileData.data?.user?.studentProfile?.updatedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Profile Updated</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData.data.user.studentProfile.updatedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No student profile information available.</p>
                    </div>
                  )}
                </div>

                {/* Software Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Completions</h3>
                  {completionsData?.data?.completions && Array.isArray(completionsData.data.completions) && completionsData.data.completions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {completionsData.data.completions.map((completion: any) => (
                            <tr key={completion.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {completion.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.batch?.title || `Batch ${completion.batchId}`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {new Date(completion.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  completion.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {completion.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {completion.faculty?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software completions found for this student.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Student</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedStudent(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Bulk Student Enrollment</h2>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Upload Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully enrolled: {bulkUploadResult.success} student(s)
                  </p>
                  {bulkUploadResult.failed > 0 && (
                    <p className="text-red-700 font-medium mt-1">
                      ✗ Failed: {bulkUploadResult.failed} student(s)
                    </p>
                  )}
                </div>
                
                {bulkUploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto border border-red-200 rounded p-3 bg-red-50">
                      {bulkUploadResult.errors.map((error: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkUploadResult(null);
                  }}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, or .csv)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    required
                    disabled={uploadingBulk}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Maximum file size: 10MB. Download the template to see the required format.
                  </p>
                </div>
                
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Make sure your Excel file follows the template format. 
                    Required fields: studentName, email, phone, dateOfAdmission.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Uploading...' : 'Upload & Enroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      setBulkUploadResult(null);
                    }}
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Orientation Modal */}
      {isOrientationModalOpen && orientationStudentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Student Orientation</h2>
              <button
                onClick={() => {
                  setIsOrientationModalOpen(false);
                  setOrientationStudentId(null);
                  setActiveOrientationTab('english');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveOrientationTab('english')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'english'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setActiveOrientationTab('gujarati')}
                  className={`px-6 py-3 font-medium text-sm ${
                    activeOrientationTab === 'gujarati'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gujarati
                </button>
              </div>

              {/* Orientation Content */}
              <div className="flex-1 overflow-auto p-6 bg-white">
                {activeOrientationTab === 'english' ? (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Orientation</h1>
                      <p className="text-sm text-gray-600">601 Gala Empire, Opp. Doordarshan metro station, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>3 days classroom coaching and 3 days lab practice is mandatory for every student</strong>
                          </li>
                          <li className="mb-3">
                            The batch timing may change with new software
                          </li>
                          <li className="mb-3">
                            If you have given commitment for special batch timing, plz do mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            The software practice is necessary in lab to complete assignments, for any reason if you are unable to come for practice at lab then mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            For any course, the ratio for coaching and practice is <strong>1:2</strong>, it means every classroom lecture you will have to make <strong>2 hours minimum practice</strong> and hence <strong>minimum 25 hours practice is compulsory at lab</strong>. For the best career <strong>monthly 50 hours practice is highly recommended</strong>.
                          </li>
                          <li className="mb-3">
                            Student may bring their own laptop is desirable and if he/she couldn't arrange laptop then he/she may book the practice slot accordingly. Practice lab is open <strong>9:00 am to 7:00 pm from Monday to Saturday</strong>. Faculty will guide during practice as per their availability
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            During the study of software, the faculty will guide for portfolio (assignments) and such assignment will have to get approved by faculty at end of each software.
                          </li>
                          <li className="mb-3">
                            The placement call will sole depend on the portfolio work and practice hours. <strong>The student without approved portfolio is not eligible for placement</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees payment & monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            The student who enrolled on EMI payment term has to deposits all PDCs (postdated cheques) and such cheques will be deposited in bank latest by <strong>10th of every month</strong> OR he has to pay monthly EMI between <strong>1st to 10th day of every month</strong>. Any payment after 10th day will be liable to late payment charges <strong>Rs. 50/- per day</strong>. Student will get GST paid receipt from A/C dept between <strong>15th to 20th day of every month</strong>. If any student get any exemption in payment date, plz mention here
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            . All fees payment are including GST and non-refundable
                          </li>
                          <li className="mb-3">
                            Each course and its payment is non-transferable. No course can be down-graded in value or duration but it can be up-graded to bigger course value/duration. Any up gradation is subject to approval and for that student needs to pay difference amount in advance
                          </li>
                          <li className="mb-3">
                            The course progress will sole depend on the grasping ability of student, leaves, absenteeism and circumstances and it is no way related to payment made for the course. The payment made is no way connected and co-related with the course completion which please be noted
                          </li>
                          <li className="mb-3">
                            Cheques bounce charges <strong>Rs. 350/-</strong>
                          </li>
                          <li className="mb-3">
                            After the completion of 6 month only, if any student is not able to pay fees for any month then he has to pay <strong>Rs. 1200/- as penalty</strong> and it is not part of total payment. Student can be considered as dropped out in system in case of fail to payment and study will be paused till clearance of all due with activation charge
                          </li>
                          <li className="mb-3">
                            Student will have to pay their monthly EMI during the long leave for whatever reason.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Student Orientation</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            Student will get backup for the lectures/study he/she missed during the approved leaves and there is no backup for leave without approval.
                          </li>
                          <li className="mb-3">
                            If any student face any difficulty in understanding of any software then on special recommendation of faculty the entire software will get repeated without any extra cost
                          </li>
                          <li className="mb-3">
                            Once you enrolled with us you are our lifetime member and as privilege you may visit us for any technical assistance or job placement in future and all such services are <strong>FREE FOREVER</strong>
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          If you have given any special commitment by counselor then do mention here/ or leave blank
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>Student Name:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>Course:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          I, hereby confirm that I got detailed understanding for all above rule & regulation of institute and I assure to follow the same.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>Student Sign / Date</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto prose prose-sm">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">વિદ્યાર્થી ઓરિએન્ટેશન</h1>
                      <p className="text-sm text-gray-600">401, Shilp Square B, Opp. Sales India, Drive-In Road, Ahmedabad 380052</p>
                      <p className="text-sm text-gray-600">Helpdesk: 9033222499 | Technical Help: 9825308959</p>
                    </div>

                    <div className="space-y-6 text-gray-800">
                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching & Practice</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4">
                          <li className="mb-3">
                            <strong>દરેક વિદ્યાર્થી એ પોતાના કોર્સ માાં અઠિાવિયા માાં ૩ વદિર્ ક્લાર્ કોવ ાંગ અને ૩ વદિર્ પ્રેકટીર્ કરિાની રહેશે.</strong>
                          </li>
                          <li className="mb-3">
                            બે નો ટાઈમ દરેક ર્ોફ્ટિેર િખતે બદલાઈ શકે છે.
                          </li>
                          <li className="mb-3">
                            જો આપણે કોઈ ોક્કર્ ર્મયે બે આપિાની િાત ર્થઇ હોય તો અહીયાં ા જણાિિ ાં.
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            લેબ માાં આિીને પ્રેકટીર્ કરિી જરૂરી છે. કોઈ ોક્કર્ કારણોર્ર જો લેબ માાં પ્રેકટીર્ ના ર્થઇ શકે એમ હોય તો અહીયાં ા સ્પષ્ટતા કરિી
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                          </li>
                          <li className="mb-3">
                            દરેક કોર્સ માટે <strong>૧:૨ નો પ્રેકટીર્ રેર્ીઓ જરૂરી છે</strong>. એક લેક્ ર ર્ામે <strong>૨ કલાક પ્રેકટીર્ વમવનમમ હોિી જરૂરી છે</strong>. એ મ જબ મવહના માાં <strong>25 કલાક પ્રેવક્ટર્ કરિી જરૂરી છે</strong>. પરાંત એક ર્ારી કારવકદી માટે મવહના માાં <strong>૫૦ કલાક પ્રેકટીર્ હોિી અવનિાયસ છે</strong>.
                          </li>
                          <li className="mb-3">
                            પ્રેવક્ટર્ માટે વિદ્યાર્થી પોતાન ાં લેપટોપ લઈને આિે તે આિિકાયસ છે પણ જરૂરી નર્થી. પ્રેવક્ટર્ નો ટાઈમ સ્લોટ અગાઉ ર્થી બ કરિો જરૂરી છે. જેર્થી વ્યિસ્ર્થા જાળિી શકાય. પ્રેવક્ટર્ લેબ નો ટાઈમ ર્િારે <strong>૯ ર્થી ર્ાાંજે૭ ર્ ધી રહેશે</strong>. પ્રેવક્ટર્ દરમ્યાન ફેકલ્ટી ન ાં માગસદશસન એમના ફ્રી ટાઈમ મ જબ મળી શકશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio & Placement</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={7}>
                          <li className="mb-3">
                            દરેક ર્ોફ્ટિેર પૂરાં ર્થયા બાદ એક સ્ટાન્િિસ પોટસફોવલયો બનાિી ને ફેકલ્ટી પાર્ે ok કરાિિો જરૂરી છે. એક ર્ોફ્ટિેર બાદ બીજ ાં ર્ોફ્ટિેર ાલ  કરિા માટે પોટસફોવલયો િકસ પૂરાં કરિ ાં જરૂરી છે.
                          </li>
                          <li className="mb-3">
                            <strong>સ્ટાન્િિસ પોટસફોવલયો િગર અને પ રા પ્રેકટીર્ કલાકો વર્િાય જોબ પ્લેર્મેન્ટ માટે કોઈ વિદ્યાર્થી ને મોકલી શકાશે નવહ.</strong>
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Fees Payment & Monthly EMIs</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={9}>
                          <li className="mb-3">
                            જે વિદ્યાર્થીઓ એ ફીર્ પેમેન્ટ માટે EMI કરાિેલા છે એ તમામ વિદ્યાર્થીઓ એ નિા મવહના ની <strong>૧ ર્થી ૧૦ તારીખ ર્ ધી માાં ફીર્ પેમેન્ટ કરિ ાં જરૂરી છે</strong> તેના માટે PDC આપિા જરૂરી છે જે Institute દ્વારા <strong>૧૦ તારીખે બેંક વિપોવિટ કરિામાાં આિશે</strong>. ત્યાર બાદ <strong>Rs 50/- પ્રવત વદિર્ લેખે લેટ પેમેન્ટ ાજસર્સ લાગશે</strong> જેની દરેકે નોાંધ લેિી. દરેક લેટ પેમેન્ટ ને પહોાં મળશે. જો કોઈ વિદ્યાર્થી ને સ્પેશ્યલ કેર્ તરીકે ૧૦ તારીખ પછી પયમેન્ટ ની િાત ર્થયી હોય તો અહીયાં ા જણાિિ ાં
                            <div className="border-b-2 border-gray-400 mt-2 mb-2 w-64"></div>
                            ત્યારબાદ લેટ પેમેન્ટ ાજસર્સ લાગ  પિશે.
                            <br />
                            કોઈ પણ કોર્સ માટે ન ાં પેમેન્ટ GST ર્હીત ન ાં છે જેના માટે GST િળી પાકી receipt PDF copy માાં <strong>૧૫ ર્થી ૨૦ તારીખ દરમ્યાન મળી જશે</strong>. કોઈ પણ પ્રકાર ન ાં પેમેન્ટ પાછ ાં મળિા પાત્ર નર્થી.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ ન ાં પેમેન્ટ તબદીલી ને પાત્ર નર્થી. વિદ્યાર્થી એ જે કોર્સ માાં એિવમશન લીધ ાં હશે તે કોર્સ ને કોઈ બીજા નાના કોર્સ માાં તબદીલ કરી શકાશે નવહ પરાંત મોટા વકાંમત / ર્મયગાળા ના કોર્સ માાં તબદીલ કરી શકાશે આ તબદીલી મેનેજમેન્ટ ની રજામાંદી ર્થી ર્થઇ શકશે જેના માટે તફાિત ની રકમ એિિાન્ર્ માાં ભરિાની રહેશે.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ કોર્સ નો ર્મયગાળો એ વિદ્યાર્થી ની ર્મજશવિ / આિિત / ર્ાંજોગો ને આધારે િધારે ઓછો ર્થઇ શકશે એને ફીર્ ના EMI ર્ાર્થે ર્રખામણી કરી શકાશે નવહ. ફીર્ ના EMI એ ફીર્ પે કરિાની ર્ગિિતા માટે ની વ્યિસ્ર્થા છે માટે કોર્સ કેટલો ાલ્યો છે કે કેટલો પૂરો ર્થયો એની ર્ાર્થે ફીર્ ના EMI ને ર્રખામણી કરી શકાશે નવહ જેની દરેક વિદ્યાર્થીઓ એ નોાંધ લેિી.
                          </li>
                          <li className="mb-3">
                            જો ફીર્ ન ાં પેમેન્ટ ેક ર્થી કરાય ાં હોય અને ેક બાઉન્ર્ ર્થાય તો એના અલગ ર્થી <strong>Rs ૩૫૦/- આપિાના રહેશે</strong>.
                          </li>
                          <li className="mb-3">
                            કોઈ વિદ્યાર્થી જો પૂરો મવહનો ફીર્ ના આપી શકે તો એને <strong>Rs ૧૨૦૦/- પેનલ્ટી ાજસ ના ભરિાના રહેશે</strong> જે કોર્સ ાલ  કાયસ ના <strong>૬ મવહના પછી ર્થી જ ર્થઇ શકશે</strong>. ફીર્ પેમેન્ટ અર્થિા પેનલ્ટી ાજસર્સ ભયાસ િગર વિદ્યાર્થી વર્સ્ટમ માાં િરોપઆઉટ ર્થઇ શકે છે. કોઈ વિદ્યાર્થી પહેલા ૬ મવહના દરમ્યાન કોઈ એક મવહનો ફીર્ EMI ના આપે તો જે તે મવહના બાદ િરોપ આઉટ ગણાશે. અને એક્ટીિેશન ાજસર્સ ભયાસ બાદ ફરી ર્થી બે આપી શકાશે.
                          </li>
                          <li className="mb-3">
                            કોર્સ દરમ્યાન ર્ાંજોગોિર્ાત લાાંબી રજા લેિાની ર્થશે તો ફીર્ ના EMI બાંધ કરી શકાશે નવહ. કોર્સ નો ર્મયગાળો લીધેલી રજા મ જબ િધી જશે.
                          </li>
                        </ol>
                      </section>

                      <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Help</h2>
                        <ol className="list-decimal list-inside space-y-3 ml-4" start={15}>
                          <li className="mb-3">
                            દરેક વિદ્યાર્થી એ ફેકલ્ટી ની માંજૂરી ર્થી રજા લઇ શકાશે જેના માટે અલગ બેકઅપ શીખિિા માાં આિશે પણ માંજૂરી િગર ની રજા માટે બેકઅપ ની વ્યિસ્ર્થા ર્થઇ શકશે નવહ.
                          </li>
                          <li className="mb-3">
                            કોઈ પણ વિદ્યાર્થી ને કોઈ ર્ોફ્ટિેર માાં િધારે મદદ ની જરૂર હોય તો એ ર્ોફ્ટિેર આખો કે અમ ક ટોવપક ફરી ર્થી જે ફેકલ્ટી ના ર્જેશન મ જબ કરિા માાં આિશે જેના માટે કોઈ એક્ર્ટરા પેમેન્ટ આપિાન ાં રહેત ાં નર્થી.
                          </li>
                          <li className="mb-3">
                            એકિાર કોર્સ કયાસ બાદ <strong>Lifetime કોઈ પણ પ્રકાર ની Technical મદદ માટે આપ ક્યારેય પણ institute પર આિી શકો છો</strong>. જે અમારા તમામ વિધાર્થી માટે <strong>વનિઃશ લ્ક રહેશે</strong>.
                          </li>
                        </ol>
                      </section>

                      <section className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="mb-4 text-sm">
                          કોર્સ ના એિવમશન િખતે જો આપણે કોઈ ોક્કર્ પ્રકાર ન ાં કવમટમેન્ટ અપાય ાં હોય તો એ અહીયાં ા જણાિિ ાં.
                        </p>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-2"></div>
                        <div className="border-b-2 border-gray-400 mb-4"></div>
                      </section>

                      <section className="mt-8 space-y-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="mb-2"><strong>નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                          <div className="flex-1">
                            <p className="mb-2"><strong>કોર્સ ન ાં નામ:</strong></p>
                            <div className="border-b-2 border-gray-400 mb-4"></div>
                          </div>
                        </div>
                        <p className="mt-6 mb-4">
                          મને ઉપર મ જબ તમામ વનયમો ની વિસ્તૃત જાણકારી આપિામાાં આિી છે અને મને તે બાંધનકતાસ છે.
                        </p>
                        <div className="mt-8">
                          <p className="mb-2"><strong>વિદ્યાર્થી ની ર્હી / તારીખ</strong></p>
                          <div className="border-b-2 border-gray-400 w-48"></div>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with I Agree Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                {(() => {
                  const status = orientationStatusMap[orientationStudentId];
                  const englishAccepted = status?.english || false;
                  const gujaratiAccepted = status?.gujarati || false;
                  const currentAccepted =
                    activeOrientationTab === 'english' ? englishAccepted : gujaratiAccepted;
                  const isEligible = status?.isEligible || false;

                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        {isEligible ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Student is eligible (Orientation accepted)
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">
                            ⏳ Pending approval - Please accept orientation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!currentAccepted) {
                            acceptOrientationMutation.mutate({
                              studentId: orientationStudentId,
                              language:
                                activeOrientationTab === 'english'
                                  ? OrientationLanguage.ENGLISH
                                  : OrientationLanguage.GUJARATI,
                            });
                          } else {
                            alert('This orientation has already been accepted.');
                          }
                        }}
                        disabled={currentAccepted || acceptOrientationMutation.isPending}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                          currentAccepted
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : acceptOrientationMutation.isPending
                            ? 'bg-orange-400 text-white cursor-wait'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {currentAccepted ? '✓ Accepted' : acceptOrientationMutation.isPending ? 'Processing...' : 'I Agree'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

