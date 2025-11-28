import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { certificateAPI, CreateCertificateRequest, Certificate } from '../api/certificate.api';
import { studentAPI } from '../api/student.api';
import { batchAPI } from '../api/batch.api';

// Common software options
const SOFTWARE_OPTIONS = [
  'Adobe Photoshop',
  'Adobe Illustrator',
  'Corel Draw',
  'Adobe Indesign',
  'Adobe Premiere Pro',
  'Adobe After Effects',
  'Adobe XD',
  'Figma',
  'Sketch',
  'Blender',
  'Maya',
  'Cinema 4D',
  'Autodesk 3ds Max',
  'Unity',
  'Unreal Engine',
];

// Common course names
const COURSE_OPTIONS = [
  'Graphic Design Prime',
  'Web Design Prime',
  'UI/UX Design Prime',
  'Video Editing Prime',
  '3D Animation Prime',
  'Motion Graphics Prime',
  'Digital Marketing Prime',
  'Full Stack Development Prime',
];

// Grade options
const GRADE_OPTIONS = ['A', 'B+', 'B', 'C'];

// Month options
const MONTH_OPTIONS = [
  'Jan - 2025',
  'Feb - 2025',
  'Mar - 2025',
  'Apr - 2025',
  'May - 2025',
  'Jun - 2025',
  'Jul - 2025',
  'Aug - 2025',
  'Sept - 2025',
  'Oct - 2025',
  'Nov - 2025',
  'Dec - 2025',
];

export const CertificateManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Debug logging
  console.log('CertificateManagement: Component rendering', { user: user?.role });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateCertificateRequest>({
    studentId: 0,
    courseName: '',
    softwareCovered: [],
    grade: '',
    monthOfCompletion: '',
    certificateNumber: '',
  });

  // Fetch students
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches (for course suggestions)
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch certificates
  const { 
    data: certificatesData, 
    isLoading: isLoadingCertificates,
    error: certificatesError 
  } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => certificateAPI.getAllCertificates(),
    retry: 1,
    onError: (error: any) => {
      console.error('Error fetching certificates:', error);
    },
  });

  const createCertificateMutation = useMutation({
    mutationFn: (data: CreateCertificateRequest) => certificateAPI.createCertificate(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setIsCreateModalOpen(false);
      setFormData({
        studentId: 0,
        courseName: '',
        softwareCovered: [],
        grade: '',
        monthOfCompletion: '',
        certificateNumber: '',
      });
      alert('Certificate created successfully! PDF has been generated.');
      // Optionally download the PDF
      if (response.data.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
      }
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create certificate');
    },
  });

  const handleDownload = async (certificateId: number) => {
    try {
      const blob = await certificateAPI.downloadCertificate(certificateId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate_${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to download certificate');
    }
  };

  const handleSoftwareToggle = (software: string) => {
    setFormData((prev) => ({
      ...prev,
      softwareCovered: prev.softwareCovered.includes(software)
        ? prev.softwareCovered.filter((s) => s !== software)
        : [...prev.softwareCovered, software],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.courseName || !formData.grade || !formData.monthOfCompletion) {
      alert('Please fill all required fields');
      return;
    }
    if (formData.softwareCovered.length === 0) {
      alert('Please select at least one software');
      return;
    }
    createCertificateMutation.mutate(formData);
  };

  const students = studentsData?.data?.students || [];
  const certificates = certificatesData?.data?.certificates || [];
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Show loading state
  if (!user) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow-xl rounded-lg p-8 text-center">
            <p className="text-red-600 text-lg font-semibold">Access Denied</p>
            <p className="mt-2 text-gray-700">You don't have permission to manage certificates.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show error state
  if (certificatesError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow-xl rounded-lg p-8 text-center">
            <p className="text-red-600 text-lg font-semibold">Error Loading Certificates</p>
            <p className="mt-2 text-gray-700">
              {certificatesError instanceof Error 
                ? certificatesError.message 
                : 'Failed to load certificates. Please check your connection and try again.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading state while fetching
  if (isLoadingCertificates || isLoadingStudents) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow-xl rounded-lg p-8">
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
            <p className="text-center text-gray-600 mt-4">Loading certificates...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Certificate Management</h1>
                <p className="mt-2 text-orange-100">Create and manage student certificates</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                + Create Certificate
              </button>
            </div>
          </div>

          <div className="p-6">
            {certificates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No certificates created yet.</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Create First Certificate
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Certificate #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Software
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {certificates.map((certificate) => (
                      <tr key={certificate.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {certificate.certificateNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {certificate.student?.name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">{certificate.student?.email || ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {certificate.courseName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              // Ensure softwareCovered is always an array
                              const softwareList = Array.isArray(certificate.softwareCovered) 
                                ? certificate.softwareCovered 
                                : (typeof certificate.softwareCovered === 'string' 
                                    ? certificate.softwareCovered.split(',').map(s => s.trim()).filter(s => s)
                                    : []);
                              return (
                                <>
                                  {softwareList.slice(0, 3).map((software, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                    >
                                      {software}
                                    </span>
                                  ))}
                                  {softwareList.length > 3 && (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                      +{softwareList.length - 3}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              certificate.grade === 'A'
                                ? 'bg-green-100 text-green-800'
                                : certificate.grade === 'B+'
                                ? 'bg-blue-100 text-blue-800'
                                : certificate.grade === 'B'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {certificate.grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {certificate.monthOfCompletion}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDownload(certificate.id)}
                            className="text-orange-600 hover:text-orange-900 mr-4"
                          >
                            📥 Download
                          </button>
                          {certificate.pdfUrl && (
                            <a
                              href={certificate.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900"
                            >
                              👁️ View
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Create Certificate Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-4">
                <h2 className="text-2xl font-bold text-white">Create Certificate</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Student Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: Number(e.target.value) })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={0}>Select Student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Course Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.courseName}
                    onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Course</option>
                    {COURSE_OPTIONS.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or enter custom course name"
                    value={formData.courseName}
                    onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
                    className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Software Covered */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Software Covered <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {SOFTWARE_OPTIONS.map((software) => (
                        <label key={software} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.softwareCovered.includes(software)}
                            onChange={() => handleSoftwareToggle(software)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">{software}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {formData.softwareCovered.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.softwareCovered.map((software) => (
                        <span
                          key={software}
                          className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs"
                        >
                          {software}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Grade</option>
                    {GRADE_OPTIONS.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month of Completion */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Month of Completion <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.monthOfCompletion}
                    onChange={(e) => setFormData({ ...formData, monthOfCompletion: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Month</option>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Certificate Number (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Number (Optional - Auto-generated if empty)
                  </label>
                  <input
                    type="text"
                    value={formData.certificateNumber}
                    onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                    placeholder="e.g., PA/A/MP/20251120"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to auto-generate based on student name and course
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={createCertificateMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {createCertificateMutation.isPending ? 'Generating...' : 'Generate Certificate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setFormData({
                        studentId: 0,
                        courseName: '',
                        softwareCovered: [],
                        grade: '',
                        monthOfCompletion: '',
                        certificateNumber: '',
                      });
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

