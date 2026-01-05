import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { userAPI } from '../api/user.api';
import { studentAPI, StudentDetails } from '../api/student.api';
import { getImageUrl } from '../utils/imageUtils';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export const StudentView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isStudent = user?.role === 'student' && user?.id === Number(id);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch student data
  const {
    data: studentDetailsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery<StudentDetails>({
    queryKey: ['student-details', id],
    queryFn: async () => {
      if (!id) throw new Error('Student ID is required');
      try {
        const response = await studentAPI.getStudentDetails(Number(id));
        if (response?.data?.student) return response.data.student;
      } catch (detailsError: any) {
        console.log('Student details endpoint failed, trying getUserById:', detailsError);
      }
      
      const userResponse = await userAPI.getUser(Number(id));
      if (!userResponse?.data?.user) throw new Error('Student data not found');
      
      const user = userResponse.data.user;
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
        enrollments: [],
      };
    },
    enabled: !!id && !!user && (isAdmin || isStudent),
    retry: 1,
  });

  const studentData = studentDetailsResponse;

  useEffect(() => {
    if (studentData) {
      const profile = studentData.studentProfile;
      // Set image preview - process URL through getImageUrl to fix any URL issues
      if (profile?.photoUrl || studentData.avatarUrl) {
        const rawUrl = profile?.photoUrl || studentData.avatarUrl;
        const processedUrl = rawUrl ? (getImageUrl(rawUrl) || rawUrl) : null;
        setImagePreview(processedUrl);
      }
    }
  }, [studentData]);

  // Check permissions
  if (!user) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
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

  if (!isAdmin && !isStudent) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">You don't have permission to view this student.</p>
            <p className="text-gray-600 mt-2">
              {user.role === 'student' 
                ? 'Students can only view their own information.' 
                : 'Only administrators can view student information.'}
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
        <div className="max-w-4xl mx-auto p-4 md:p-6">
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

  if (error || !studentData) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">Error loading student data</p>
            <p className="text-gray-600 mt-2">
              {(error as any)?.response?.data?.message || 
               (error instanceof Error ? error.message : 'Student not found') ||
               'Internal server error while fetching user'}
            </p>
            {(error as any)?.response?.status && (
              <p className="text-gray-500 text-xs mt-1">Status Code: {(error as any).response.status}</p>
            )}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => refetch()}
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

  const profile = studentData.studentProfile;
  const documents = profile?.documents;
  
  // Parse documents if it's a string (MySQL JSON fields sometimes come as strings)
  let parsedDocuments = documents;
  if (documents && typeof documents === 'string') {
    try {
      parsedDocuments = JSON.parse(documents);
    } catch (e) {
      console.error('Error parsing documents string:', e);
      parsedDocuments = undefined;
    }
  }
  
  const enrollmentMetadata = parsedDocuments && typeof parsedDocuments === 'object' && 'enrollmentMetadata' in parsedDocuments
    ? (parsedDocuments as any).enrollmentMetadata
    : null;

  // Format schedule data for display
  const schedule = enrollmentMetadata?.schedule || [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Student Details</h1>
                <p className="mt-2 text-orange-100 text-sm md:text-base">
                  View comprehensive student information
                </p>
              </div>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm md:text-base"
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {/* Student Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8 pb-6 border-b">
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={studentData.name}
                    className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-orange-500 shadow-lg"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iIzAwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-2xl md:text-3xl shadow-lg">
                    {studentData.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{studentData.name}</h2>
                <div className="mt-2 space-y-1">
                  <p className="text-gray-600">
                    <span className="font-medium">Email:</span> {studentData.email}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Phone:</span> {studentData.phone}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      studentData.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {studentData.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {profile?.status && (
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        profile.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        profile.status === 'active plus' ? 'bg-purple-100 text-purple-800' :
                        profile.status === 'dropped' ? 'bg-red-100 text-red-800' :
                        profile.status === 'finished' ? 'bg-green-100 text-green-800' :
                        profile.status === 'deactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Information Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Date of Birth</p>
                  <p className="font-medium">
                    {profile?.dob ? formatDateDDMMYYYY(profile.dob) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date of Admission</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.dateOfAdmission ? formatDateDDMMYYYY(enrollmentMetadata.dateOfAdmission) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Enrollment Date</p>
                  <p className="font-medium">
                    {profile?.enrollmentDate ? formatDateDDMMYYYY(profile.enrollmentDate) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created At</p>
                  <p className="font-medium">{formatDateDDMMYYYY(studentData.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Contact & Address Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Contact & Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Local Address</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.localAddress || profile?.address || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Permanent Address</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.permanentAddress || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">WhatsApp Number</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.whatsappNumber || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Emergency Contact</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.emergencyContact?.name 
                      ? `${enrollmentMetadata.emergencyContact.name} (${enrollmentMetadata.emergencyContact.relation}) - ${enrollmentMetadata.emergencyContact.number}`
                      : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Course & Financial Details */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Course & Financial Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Course Name</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.courseName || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Deal Amount</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.totalDeal ? `₹${enrollmentMetadata.totalDeal.toFixed(2)}` : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Booking Amount</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.bookingAmount ? `₹${enrollmentMetadata.bookingAmount.toFixed(2)}` : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Balance Amount</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.balanceAmount ? `₹${enrollmentMetadata.balanceAmount.toFixed(2)}` : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">EMI Plan</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.emiPlan ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lump Sum Payment</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.lumpSumPayment ? 'Yes' : 'No'}
                  </p>
                </div>
                {enrollmentMetadata?.lumpSumPayment && enrollmentMetadata?.lumpSumPayments && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600">Lump Sum Payment Details</p>
                    <div className="mt-2">
                      {enrollmentMetadata.lumpSumPayments.map((payment: { date: string; amount: number }, index: number) => (
                        <div key={index} className="flex justify-between border-b pb-1">
                          <span>Payment {index + 1}:</span>
                          <span>₹{payment.amount.toFixed(2)} on {formatDateDDMMYYYY(payment.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Software Information */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Software Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Software List</p>
                  <p className="font-medium">
                    {profile?.softwareList && profile.softwareList.length > 0 
                      ? profile.softwareList.join(', ') 
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Complimentary Software</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.complimentarySoftware || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Time Slot Schedule */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Class Schedule</h3>
              {schedule && schedule.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((slot: { day: string; startTime: string; endTime: string }, index: number) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {slot.day}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {slot.startTime || 'Not set'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {slot.endTime || 'Not set'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 italic">No class schedule available</p>
              )}
            </div>

            {/* Additional Information */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Complimentary Gift</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.complimentaryGift || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Has Reference</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.hasReference ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Reference Details</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.referenceDetails || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Counselor Name</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.counselorName || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lead Source</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.leadSource || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Walk-in Date</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.walkinDate ? formatDateDDMMYYYY(enrollmentMetadata.walkinDate) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Master Faculty</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.masterFaculty || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Course Duration Information */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">Course Duration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Duration</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.totalDuration ? `${enrollmentMetadata.totalDuration} days` : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.startDate ? formatDateDDMMYYYY(enrollmentMetadata.startDate) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">End Date</p>
                  <p className="font-medium">
                    {enrollmentMetadata?.endDate ? formatDateDDMMYYYY(enrollmentMetadata.endDate) : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end pt-6 border-t">
              {isAdmin && (
                <button
                  onClick={() => navigate(`/students/edit/${id}`)}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Edit Student
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};