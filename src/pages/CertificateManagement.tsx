import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { certificateAPI, CreateCertificateRequest, Certificate, CertificatesResponse } from '../api/certificate.api';
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
    studentDeclarationAccepted: false,
  });
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch students
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
  });

  // Fetch batches (for course suggestions)
  const { data: _batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch certificates
  const {
    data: certificatesData,
    isLoading: isLoadingCertificates,
    error: certificatesError 
  } = useQuery<CertificatesResponse>({
    queryKey: ['certificates'],
    queryFn: () => certificateAPI.getAllCertificates(),
    retry: 1,
  });

  // Handle errors separately
  if (certificatesError) {
    console.error('Error fetching certificates:', certificatesError);
  }

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
        studentDeclarationAccepted: false,
      });
      setShowDeclaration(false);
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
  const allCertificates = certificatesData?.data?.certificates || [];
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Filter certificates based on search query
  const certificates = allCertificates.filter((certificate) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      certificate.student?.name?.toLowerCase().includes(query) ||
      certificate.student?.email?.toLowerCase().includes(query) ||
      certificate.courseName?.toLowerCase().includes(query) ||
      certificate.certificateNumber?.toLowerCase().includes(query) ||
      certificate.softwareCovered?.some((s: string) => s.toLowerCase().includes(query)) ||
      certificate.grade?.toLowerCase().includes(query)
    );
  });

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
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Certificate Management</h1>
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
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search certificates by student, course, certificate number, or software..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-2 text-sm text-gray-600">
                  Showing {certificates.length} of {allCertificates.length} certificates
                </p>
              )}
            </div>

            {certificates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'No certificates found matching your search' : 'No certificates created yet.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                  >
                    Create First Certificate
                  </button>
                )}
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-orange-600 hover:text-orange-700 text-sm"
                  >
                    Clear search
                  </button>
                )}
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
                        Declaration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {certificates.map((certificate: Certificate) => (
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
                              let softwareList: string[] = [];
                              if (Array.isArray(certificate.softwareCovered)) {
                                softwareList = certificate.softwareCovered;
                              } else if (typeof certificate.softwareCovered === 'string') {
                                const softwareStr: string = certificate.softwareCovered;
                                softwareList = softwareStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                              }
                              return (
                                <>
                                  {softwareList.slice(0, 3).map((software: string, idx: number) => (
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {certificate.studentDeclarationAccepted ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                              Accepted
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              Not Required
                            </span>
                          )}
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

                {/* Student Declaration Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Note:</strong> Please note it is mandatory to submit the completed portfolio for certificate request. Placement and certificate will be strictly subject to portfolio approval and attendance verification.
                    </p>
                    <p className="text-sm text-blue-800">
                      In case, you require the certificate without submission/completion of portfolio then please accept the below terms and sign the declaration. Hence forth, you will not be eligible for placement from Prime Academy.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeclaration}
                        onChange={(e) => {
                          setShowDeclaration(e.target.checked);
                          if (!e.target.checked) {
                            setFormData({ ...formData, studentDeclarationAccepted: false });
                          }
                        }}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        I want to request certificate without portfolio submission
                      </span>
                    </label>
                  </div>

                  {showDeclaration && (
                    <div className="p-4 bg-gray-50 border-2 border-green-600 rounded-lg">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Student Declaration:</h3>
                      <div className="mb-4 text-sm text-gray-700 leading-relaxed">
                        <p className="mb-2">
                          This is a confirmation from <strong>{students.find(s => s.id === formData.studentId)?.name || '[Student Name]'}</strong>, I completely understand the policy of the portfolio submission in Professional development and job placement from the Academy.
                        </p>
                        <p className="mb-2">
                          But, I am not seeking job placement from the academy or any recommendation. This request is only for the certificate of course completion without submission of my portfolio.
                        </p>
                        <p>
                          I understand that I will not be following up ahead anytime for any job related support or recommendation in future from the academy.
                        </p>
                      </div>
                      <div className="mt-4">
                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.studentDeclarationAccepted || false}
                            onChange={(e) => setFormData({ ...formData, studentDeclarationAccepted: e.target.checked })}
                            className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">
                            I accept and agree to the above declaration terms and conditions
                          </span>
                        </label>
                      </div>
                      <div className="mt-4 p-3 bg-white border border-gray-300 rounded">
                        <div className="text-xs text-gray-500 mb-2">Signature / Date:</div>
                        <div className="h-16 border-2 border-dashed border-gray-400 rounded flex items-center justify-center text-gray-400 text-sm">
                          [Signature Box]
                        </div>
                      </div>
                    </div>
                  )}
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

