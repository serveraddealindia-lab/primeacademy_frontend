import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { userAPI, UpdateUserRequest, UpdateStudentProfileRequest } from '../api/user.api';
import { studentAPI, StudentDetails } from '../api/student.api';

export const StudentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Fetch student data with profile/enrollments
  const {
    data: studentDetailsResponse,
    isLoading,
    error: queryError,
    refetch: refetchStudentDetails,
  } = useQuery<StudentDetails>({
    queryKey: ['student-details', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('Student ID is required');
      }
      try {
        // Try to get student details first (includes enrollments)
        try {
          const response = await studentAPI.getStudentDetails(Number(id));
          console.log('Student details response:', response);
          if (response?.data?.student) {
            return response.data.student;
          }
        } catch (detailsError: any) {
          console.log('Student details endpoint failed, trying getUserById:', detailsError);
          // Fallback to getUserById if student details endpoint fails
        }
        
        // Fallback: Use getUserById which is more flexible
        const userResponse = await userAPI.getUser(Number(id));
        console.log('User response:', userResponse);
        if (!userResponse?.data?.user) {
          throw new Error('Student data not found');
        }
        
        const user = userResponse.data.user;
        // Convert user response to student details format
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          studentProfile: user.studentProfile || null,
          enrollments: [], // Will be empty if using getUserById fallback
        };
      } catch (error: any) {
        console.error('Error fetching student details:', error);
        throw new Error(error.response?.data?.message || error.message || 'Failed to load student details');
      }
    },
    enabled: !!id && !!user && isAdmin,
    retry: 1,
  });

  // Debug logging
  console.log('StudentEdit Debug:', {
    id,
    user: user?.role,
    isAdmin,
    isLoading,
    hasData: !!studentDetailsResponse,
    error: queryError,
    enabled: !!id && !!user && isAdmin,
  });

  const studentData = studentDetailsResponse;

  // Debug logging
  console.log('StudentEdit Debug:', {
    id,
    user: user?.role,
    isAdmin,
    isLoading,
    hasData: !!studentDetailsResponse,
    error: queryError,
    enabled: !!id && !!user && isAdmin,
  });

  const [softwareListInput, setSoftwareListInput] = useState<string>('');

  const updateUserMutation = useMutation({
    mutationFn: (data: UpdateUserRequest) => userAPI.updateUser(Number(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-details', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile', id] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update user information');
    },
  });

  const updateStudentProfileMutation = useMutation({
    mutationFn: (data: UpdateStudentProfileRequest) => userAPI.updateStudentProfile(Number(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-details', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile', id] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update student profile');
    },
  });

  // Check if user is loaded
  if (!user) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
            <p className="text-center text-gray-600 mt-4">Loading user information...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">You don't have permission to edit students.</p>
            <p className="text-gray-600 mt-2">Only administrators can edit student information.</p>
            <button
              onClick={() => navigate('/students')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Students
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if query is enabled - if not, show message
  const queryEnabled = !!id && !!user && isAdmin;
  if (!queryEnabled) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">Cannot load student data</p>
            <p className="text-gray-600 mt-2">
              {!id ? 'Student ID is missing.' : !user ? 'User not authenticated.' : 'You do not have permission.'}
            </p>
            <button
              onClick={() => navigate('/students')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Students
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
            <p className="text-center text-gray-600 mt-4">Loading student data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (queryError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">Error loading student data</p>
            <p className="text-gray-600 mt-2">{queryError instanceof Error ? queryError.message : 'Unknown error occurred'}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => refetchStudentDetails()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Students
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!studentData && !isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">Student not found</p>
            <p className="text-gray-600 mt-2">Student ID: {id}</p>
            <p className="text-gray-500 mt-1">The student data could not be loaded.</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => refetchStudentDetails()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Students
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Final safety check - if we still don't have data but not loading, show error
  if (!studentData && !isLoading && !queryError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">Unable to load student data.</p>
            <p className="text-gray-500 mt-2">ID: {id}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => refetchStudentDetails()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Students
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Final safety check - ensure we have studentData before rendering form
  if (!studentData) {
    // This should not happen due to earlier checks, but just in case
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">Student data is not available</p>
            <p className="text-gray-600 mt-2">Student ID: {id}</p>
            <p className="text-gray-500 mt-1">Please try again or go back to the students list.</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => refetchStudentDetails()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Students
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Helper function to format date for input
  const formatDateForInput = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    return '';
  };

  React.useEffect(() => {
    if (studentData?.studentProfile?.softwareList && Array.isArray(studentData.studentProfile.softwareList)) {
      setSoftwareListInput(studentData.studentProfile.softwareList.join(', '));
    } else {
      setSoftwareListInput('');
    }
  }, [studentData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!studentData) {
      alert('Student data is not loaded. Please try again.');
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    
    // Update user information
    const userData: UpdateUserRequest = {
      name: formData.get('name') as string || undefined,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      isActive: formData.get('isActive') === 'true',
      avatarUrl: formData.get('avatarUrl') as string || undefined,
    };

    // Update student profile information
    const profileData: UpdateStudentProfileRequest = {
      dob: formData.get('dob') as string || undefined,
      address: formData.get('address') as string || undefined,
      photoUrl: formData.get('photoUrl') as string || undefined,
      softwareList: softwareListInput ? softwareListInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : undefined,
      enrollmentDate: formData.get('enrollmentDate') as string || undefined,
      status: formData.get('profileStatus') as string || undefined,
    };

    try {
      await updateUserMutation.mutateAsync(userData);
      if (studentData?.studentProfile || Object.values(profileData).some(v => v !== undefined && v !== '')) {
        await updateStudentProfileMutation.mutateAsync(profileData);
      }
      // Refresh the student data
      queryClient.invalidateQueries({ queryKey: ['student-details', id] });
      alert('Student updated successfully!');
      navigate('/students');
    } catch (error) {
      // Error handling is done in mutation onError
      console.error('Error updating student:', error);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Edit Student</h1>
                <p className="mt-2 text-orange-100">Update student information</p>
              </div>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Student Photo */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">Student Photo</h2>
                <div className="flex items-center gap-6">
                  {(() => {
                    const photoUrl = studentData?.studentProfile?.photoUrl || studentData?.avatarUrl;
                    const studentName = studentData?.name || 'Student';
                    if (photoUrl) {
                      return (
                        <img
                          src={photoUrl}
                          alt={studentName}
                          className="w-32 h-32 rounded-full object-cover border-4 border-orange-500 shadow-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(studentName) + '&background=orange&color=fff&size=128';
                          }}
                        />
                      );
                    } else {
                      return (
                        <div className="w-32 h-32 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                          {studentName.charAt(0).toUpperCase()}
                        </div>
                      );
                    }
                  })()}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Avatar URL</label>
                    <input
                      type="url"
                      name="avatarUrl"
                      defaultValue={studentData?.avatarUrl || ''}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">URL for student's profile photo</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo URL</label>
                    <input
                      type="url"
                      name="photoUrl"
                      defaultValue={studentData?.studentProfile?.photoUrl || ''}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Alternative photo URL in student profile</p>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6 border-b pb-2">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={studentData?.name || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={studentData?.email || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={studentData?.phone || ''}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Status *</label>
                    <select
                      name="isActive"
                      defaultValue={studentData?.isActive ? 'true' : 'false'}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  {studentData?.createdAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Account Created</label>
                      <p className="text-sm text-gray-900 py-3">{new Date(studentData.createdAt).toLocaleString()}</p>
                    </div>
                  )}
                  {studentData?.updatedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Updated</label>
                      <p className="text-sm text-gray-900 py-3">{new Date(studentData.updatedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Profile Information */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6 border-b pb-2">Student Profile Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      defaultValue={formatDateForInput(studentData?.studentProfile?.dob)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enrollment Date</label>
                    <input
                      type="date"
                      name="enrollmentDate"
                      defaultValue={formatDateForInput(studentData?.studentProfile?.enrollmentDate)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Status</label>
                    <select
                      name="profileStatus"
                      defaultValue={studentData?.studentProfile?.status || ''}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="on-hold">On Hold</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <textarea
                      name="address"
                      rows={3}
                      defaultValue={studentData?.studentProfile?.address || ''}
                      placeholder="Enter full address"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Software List</label>
                    <input
                      type="text"
                      value={softwareListInput}
                      onChange={(e) => setSoftwareListInput(e.target.value)}
                      placeholder="Photoshop, Illustrator, InDesign (comma-separated)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Enter software names separated by commas</p>
                    {studentData?.studentProfile?.softwareList && Array.isArray(studentData.studentProfile.softwareList) && studentData.studentProfile.softwareList.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {studentData.studentProfile.softwareList.map((software: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {software}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {studentData?.studentProfile?.documents && Object.keys(studentData.studentProfile.documents).length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Documents (Read-only)</label>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {JSON.stringify(studentData.studentProfile.documents, null, 2)}
                        </pre>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Documents are managed through the enrollment process</p>
                    </div>
                  )}
                  {studentData?.studentProfile?.createdAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Created</label>
                      <p className="text-sm text-gray-900 py-3">{new Date(studentData.studentProfile.createdAt).toLocaleString()}</p>
                    </div>
                  )}
                  {studentData?.studentProfile?.updatedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Updated</label>
                      <p className="text-sm text-gray-900 py-3">{new Date(studentData.studentProfile.updatedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Enrollment Overview */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Current Batches</h2>
                  <span className="text-sm text-gray-500">
                    {studentData?.enrollments?.length || 0} active enrollment{(studentData?.enrollments?.length || 0) === 1 ? '' : 's'}
                  </span>
                </div>
                {studentData?.enrollments && studentData.enrollments.length > 0 ? (
                  <div className="space-y-3">
                    {studentData.enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="p-4 border border-gray-200 rounded-lg flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-gray-50"
                      >
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            {enrollment.batch?.title || `Batch #${enrollment.batch?.id ?? 'N/A'}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            {(enrollment.batch?.software || 'Software N/A') + ' · ' + (enrollment.batch?.mode || 'Mode N/A')}
                          </p>
                          {enrollment.enrollmentDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              Enrolled on {new Date(enrollment.enrollmentDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            enrollment.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : enrollment.status === 'completed'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {enrollment.status || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Student is not enrolled in any batches yet.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending || updateStudentProfileMutation.isPending}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {updateUserMutation.isPending || updateStudentProfileMutation.isPending ? 'Saving...' : 'Save All Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/students')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

