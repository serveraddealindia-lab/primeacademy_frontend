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

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);

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

  const updateUserImageMutation = useMutation({
    mutationFn: ({ userId, avatarUrl }: { userId: number; avatarUrl: string }) =>
      userAPI.updateUser(userId, { avatarUrl }),
    onSuccess: (data, variables) => {
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
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_enrollment_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to download template');
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
  const batches = batchesData?.data || [];

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
                                src={student.avatarUrl}
                                alt={student.name}
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.name) + '&background=orange&color=fff';
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
                    src={`${selectedStudent.avatarUrl}?t=${Date.now()}`}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={selectedStudent.avatarUrl}
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
                            src={photoUrl}
                            alt={studentName}
                            className="w-40 h-40 rounded-full object-cover border-4 border-orange-500 shadow-lg mx-auto"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(studentName) + '&background=orange&color=fff&size=160';
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
                    {(studentProfileData?.data?.user?.updatedAt || selectedStudent?.updatedAt) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(studentProfileData?.data?.user?.updatedAt || selectedStudent?.updatedAt || '').toLocaleDateString()}</p>
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
                          {studentProfileData.data?.user?.studentProfile?.dob 
                            ? new Date(studentProfileData.data.user.studentProfile.dob).toLocaleDateString() 
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {studentProfileData.data?.user?.studentProfile?.enrollmentDate 
                            ? new Date(studentProfileData.data.user.studentProfile.enrollmentDate).toLocaleDateString() 
                            : '-'}
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
                          const softwareList = studentProfileData?.data?.user?.studentProfile?.softwareList;
                          // Handle different data types: array, string, or null/undefined
                          let softwareArray: string[] = [];
                          if (Array.isArray(softwareList)) {
                            softwareArray = softwareList;
                          } else if (typeof softwareList === 'string' && softwareList.trim()) {
                            // If it's a string, split by comma
                            softwareArray = softwareList.split(',').map(s => s.trim()).filter(s => s.length > 0);
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
                      {studentProfileData.data?.user?.studentProfile?.documents && Object.keys(studentProfileData.data.user.studentProfile.documents).length > 0 && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Documents</label>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-60 overflow-y-auto">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(studentProfileData.data.user.studentProfile.documents, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
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
    </Layout>
  );
};

