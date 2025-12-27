import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, Student, CreateEnrollmentRequest } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { uploadAPI } from '../api/upload.api';
import { softwareCompletionAPI } from '../api/softwareCompletion.api';
import { studentSoftwareProgressAPI, StudentSoftwareProgress } from '../api/studentSoftwareProgress.api';
import { userAPI } from '../api/user.api';
import { getImageUrl } from '../utils/imageUtils';
import { orientationAPI, OrientationLanguage } from '../api/orientation.api';
import { paymentAPI, PaymentTransaction } from '../api/payment.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { StudentSoftware } from '../components/StudentSoftware';
import { courseAPI } from '../api/course.api';

// Payment Detail Card Component
const PaymentDetailCard: React.FC<{
  payment: PaymentTransaction;
  amount: number;
  paidAmount: number;
  pending: number;
  refetchPayments: () => void;
}> = ({ payment, amount, paidAmount, pending, refetchPayments }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleGenerateReceipt = async () => {
    if (!payment.id) return;
    setGeneratingReceipt(true);
    try {
      await paymentAPI.generateReceipt(payment.id);
      alert('Receipt generated successfully!');
      refetchPayments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to generate receipt');
    } finally {
      setGeneratingReceipt(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!payment.id || !payment.receiptUrl) return;
    setDownloadingReceipt(true);
    try {
      const blob = await paymentAPI.downloadReceipt(payment.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${payment.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to download receipt');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Payment Summary Row */}
      <div 
        className="bg-white hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4 p-4 items-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Payment ID</p>
            <p className="text-sm font-semibold text-gray-900">#{payment.id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Amount</p>
            <p className="text-sm font-semibold text-gray-900">₹{amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Paid Amount</p>
            <p className="text-sm font-semibold text-green-600">
              ₹{paidAmount.toFixed(2)}
              {pending > 0 && (
                <span className="text-xs text-orange-600 block">Pending: ₹{pending.toFixed(2)}</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Due Date</p>
            <p className="text-sm text-gray-900">
              {payment.dueDate ? formatDateDDMMYYYY(payment.dueDate) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Paid Date</p>
            <p className="text-sm text-gray-900">
              {payment.paidDate ? formatDateDDMMYYYY(payment.paidDate) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${getStatusColor(payment.status)}`}>
              {payment.status || 'pending'}
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="text-gray-900 font-medium">{payment.paymentMethod || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="text-gray-900 font-mono text-xs">{payment.transactionId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created At:</span>
                  <span className="text-gray-900">{payment.createdAt ? formatDateDDMMYYYY(payment.createdAt) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated At:</span>
                  <span className="text-gray-900">{payment.updatedAt ? formatDateDDMMYYYY(payment.updatedAt) : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Enrollment & Batch</h4>
              <div className="space-y-2 text-sm">
                {payment.enrollment ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Enrollment ID:</span>
                      <span className="text-gray-900 font-medium">#{payment.enrollment.id}</span>
                    </div>
                    {payment.enrollment.batch && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Batch:</span>
                        <span className="text-gray-900 font-medium">{payment.enrollment.batch.title}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">No enrollment linked</p>
                )}
              </div>
            </div>

            {payment.notes && (
              <div className="md:col-span-2">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                <p className="text-sm text-gray-900 bg-white p-3 rounded border border-gray-200">{payment.notes}</p>
              </div>
            )}

            <div className="md:col-span-2">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Receipt</h4>
              <div className="flex gap-2">
                {payment.receiptUrl ? (
                  <>
                    <button
                      onClick={handleDownloadReceipt}
                      disabled={downloadingReceipt}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {downloadingReceipt ? 'Downloading...' : '📥 Download Receipt'}
                    </button>
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${payment.receiptUrl.split('/').map((part, index) => {
                        // Keep the first part (empty string or '/receipts') as-is, encode the rest
                        if (index === 0 || part === '') return part;
                        return encodeURIComponent(part);
                      }).join('/')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                    >
                      👁️ View Receipt
                    </a>
                  </>
                ) : (payment.status === 'paid' || payment.status === 'partial') ? (
                  <button
                    onClick={handleGenerateReceipt}
                    disabled={generatingReceipt}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {generatingReceipt ? 'Generating...' : '📄 Generate Receipt'}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500 italic">Receipt can only be generated for paid or partial payments</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'students' | 'student-software'>('students');
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
  const [searchQuery, setSearchQuery] = useState('');
  
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

  // Fetch courses for software display
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseAPI.getAllCourses(),
  });

  // Fetch payments for selected student
  const { data: paymentsData, refetch: refetchPayments, isLoading: isLoadingPayments, error: paymentsError } = useQuery({
    queryKey: ['student-payments', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) {
        return { status: 'success', data: { payments: [] } };
      }
      
      const studentId = selectedStudent.id;
      console.log('🔍 Fetching payments for student ID:', studentId, 'Type:', typeof studentId);
      
      try {
        // First, try to get all payments to debug
        const allPaymentsResult = await paymentAPI.getAllPayments();
        console.log('📊 All payments in system:', allPaymentsResult?.data?.payments?.length || 0);
        
        // Check if any payments match this studentId
        const allPayments = allPaymentsResult?.data?.payments || [];
        const matchingPayments = allPayments.filter((p: PaymentTransaction) => {
          const pStudentId = Number(p.studentId);
          const sStudentId = Number(studentId);
          return pStudentId === sStudentId;
        });
        console.log('✅ Payments matching student ID:', matchingPayments.length);
        if (matchingPayments.length > 0) {
          console.log('📋 Matching payments:', matchingPayments.map((p: PaymentTransaction) => ({
            id: p.id,
            studentId: p.studentId,
            amount: p.amount,
            status: p.status
          })));
        }
        
        // Now get filtered payments
        const result = await paymentAPI.getAllPayments({ studentId: studentId });
        console.log('📥 Filtered payments result:', result);
        console.log('📦 Payments data:', result?.data);
        console.log('📋 Payments array:', result?.data?.payments);
        console.log('🔢 Payments count:', result?.data?.payments?.length || 0);
        
        if (result?.data?.payments?.length === 0 && matchingPayments.length > 0) {
          console.warn('⚠️ WARNING: Found matching payments in all payments but filtered query returned empty!');
          console.warn('This suggests a query issue. Returning matching payments manually.');
          return {
            status: 'success',
            data: {
              payments: matchingPayments
            }
          };
        }
        
        return result;
      } catch (error) {
        console.error('❌ Error fetching payments:', error);
        throw error;
      }
    },
    enabled: !!selectedStudent?.id && isViewModalOpen,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch full student data with profile for view modal
  const { data: studentProfileData, isLoading: isLoadingProfile, error: profileError, refetch: refetchStudentProfile } = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) {
        console.warn('No student ID provided for profile fetch');
        return null;
      }

      // Always fetch fresh data from backend to ensure we get complete profile
      try {
        // Use dedicated details endpoint so we always get full profile + documents
        const detailsResponse = await studentAPI.getStudentDetails(selectedStudent.id);
        console.log('Student details API response:', detailsResponse);
        console.log('Student profile documents:', detailsResponse?.data?.student?.studentProfile?.documents);

        if (detailsResponse?.data?.student) {
          const student = detailsResponse.data.student;
          
          // Parse documents if it's a string (should already be parsed by backend, but just in case)
          if (student.studentProfile?.documents && typeof student.studentProfile.documents === 'string') {
            try {
              student.studentProfile.documents = JSON.parse(student.studentProfile.documents);
              console.log('Parsed documents string:', student.studentProfile.documents);
            } catch (e) {
              console.error('Error parsing documents:', e);
            }
          }
          
          // Ensure we have complete profile data
          // If profile is missing or incomplete, try to get it from userAPI as fallback
          if (!student.studentProfile || !student.studentProfile.documents) {
            try {
              const userResponse = await userAPI.getUser(selectedStudent.id);
              if (userResponse?.data?.user?.studentProfile) {
                // Merge profile data
                student.studentProfile = {
                  ...student.studentProfile,
                  ...userResponse.data.user.studentProfile,
                };
              }
            } catch (userErr: any) {
              console.warn('Failed to fetch user profile as fallback:', userErr?.message);
            }
          }
          
          // Normalize to the same shape the view expects: { data: { user: ... } }
          return {
            data: {
              user: student,
            },
          };
        }

        console.warn('Student details response missing student object, falling back to selectedStudent');
        return {
          data: {
            user: selectedStudent,
          },
        };
      } catch (error: any) {
        console.error('Error fetching student details:', error);
        
        // Try fallback: fetch from userAPI
        try {
          const userResponse = await userAPI.getUser(selectedStudent.id);
          if (userResponse?.data?.user) {
            return {
              data: {
                user: userResponse.data.user,
              },
            };
          }
        } catch (userErr: any) {
          console.warn('Fallback user fetch also failed:', userErr?.message);
        }
        
        // Last resort: Fallback to basic selectedStudent so modal still shows something
        return {
          data: {
            user: selectedStudent,
          },
        };
      }
    },
    enabled: !!selectedStudent?.id && isViewModalOpen,
    retry: 2, // Retry more times to ensure we get data
    staleTime: 0, // Always refetch when modal opens
    gcTime: 0, // Don't cache, always get fresh data
  });

  // Refresh student profile when view modal opens
  React.useEffect(() => {
    if (isViewModalOpen && selectedStudent) {
      // Invalidate and refetch the student profile data
      queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent.id] });
      queryClient.invalidateQueries({ queryKey: ['student', selectedStudent.id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-software-progress', selectedStudent.id] });
      // Explicitly refetch the profile data
      refetchStudentProfile();
    }
  }, [isViewModalOpen, selectedStudent, queryClient, refetchStudentProfile]);

  // Also refresh when component mounts (useful when returning from edit page)
  React.useEffect(() => {
    // Invalidate queries on mount to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['student-profile'] });
    queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
    // If modal is open, refetch the profile
    if (isViewModalOpen && selectedStudent) {
      refetchStudentProfile();
    }
  }, [queryClient, isViewModalOpen, selectedStudent, refetchStudentProfile]);

  // Refresh data when page becomes visible (user returns from edit page)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible, invalidate queries to get fresh data
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['student-profile'] });
        queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
        // If modal is open, refetch the profile
        if (isViewModalOpen && selectedStudent) {
          refetchStudentProfile();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, isViewModalOpen, selectedStudent, refetchStudentProfile]);

  // Fetch software completions for selected student
  useQuery({
    queryKey: ['software-completions', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) {
        return { status: 'success', data: { completions: [], count: 0 } };
      }
      try {
        const result = await softwareCompletionAPI.getCompletions({ studentId: selectedStudent.id });
        console.log('Software completions fetched:', result);
        return result;
      } catch (error: any) {
        console.error('Error fetching software completions:', error);
        // Return empty result instead of throwing
        return { status: 'success', data: { completions: [], count: 0 } };
      }
    },
    enabled: !!selectedStudent?.id && isViewModalOpen,
    retry: 1,
  });

  // Fetch software progress for selected student (this is the actual data being tracked)
  const { data: softwareProgressData, isLoading: isLoadingProgress, error: progressError } = useQuery({
    queryKey: ['student-software-progress', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) {
        return { status: 'success', data: { records: [] } };
      }
      try {
        const result = await studentSoftwareProgressAPI.getAll({ studentId: selectedStudent.id });
        console.log('Software progress fetched:', result);
        return result;
      } catch (error: any) {
        console.error('Error fetching software progress:', error);
        return { status: 'success', data: { records: [] } };
      }
    },
    enabled: !!selectedStudent?.id && isViewModalOpen,
    retry: 1,
  });

  // Collect software ONLY from student profile (softwareList + complimentarySoftware), then merge with progress records
  const allSoftwareWithProgress = useMemo(() => {
    if (!selectedStudent?.id || !studentProfileData?.data?.user) {
      return [];
    }

    const softwareSet = new Set<string>();
    const student = studentProfileData.data.user;
    const studentProfile = student.studentProfile;

    // 1. Collect software from student profile softwareList (PRIMARY SOURCE)
    if (studentProfile?.softwareList) {
      const softwareListData = studentProfile.softwareList;
      
      if (Array.isArray(softwareListData)) {
        softwareListData.forEach((s) => {
          if (s && typeof s === 'string' && s.trim()) {
            softwareSet.add(s.trim());
          }
        });
      } else {
        const strValue = String(softwareListData as unknown as string);
        try {
          const parsed = JSON.parse(strValue);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (s && typeof s === 'string' && s.trim()) {
                softwareSet.add(s.trim());
              }
            });
          } else if (typeof parsed === 'string' && parsed.trim()) {
            softwareSet.add(parsed.trim());
          }
        } catch {
          strValue.split(',').forEach((s: string) => {
            const trimmed = s.trim();
            if (trimmed) {
              softwareSet.add(trimmed);
            }
          });
        }
      }
    }

    // 2. Collect complimentary software from student profile documents
    if (studentProfile?.documents) {
      let documents = studentProfile.documents;
      // Handle documents as string (JSON) or object
      if (typeof documents === 'string') {
        try {
          documents = JSON.parse(documents);
        } catch {
          documents = {};
        }
      }
      
      const enrollmentMetadata = documents?.enrollmentMetadata || documents;
      if (enrollmentMetadata?.complimentarySoftware) {
        const compSoftware = typeof enrollmentMetadata.complimentarySoftware === 'string'
          ? enrollmentMetadata.complimentarySoftware.split(',').map((s: string) => s.trim()).filter(Boolean)
          : Array.isArray(enrollmentMetadata.complimentarySoftware)
          ? enrollmentMetadata.complimentarySoftware
          : [];
        compSoftware.forEach((s: string) => {
          if (s && typeof s === 'string' && s.trim()) {
            softwareSet.add(s.trim());
          }
        });
      }
    }

    // 3. Get progress records ONLY for software that exists in the profile (to show status and dates)
    const progressRecords = softwareProgressData?.data?.records || [];
    
    // Create a map of progress records by software name (only for software in the profile)
    const progressMap = new Map<string, StudentSoftwareProgress>();
    const allSoftware = Array.from(softwareSet).sort();
    
    // Only map progress records for software that's in the profile
    progressRecords.forEach((p: StudentSoftwareProgress) => {
      if (p.softwareName && softwareSet.has(p.softwareName.trim())) {
        progressMap.set(p.softwareName.trim(), p);
      }
    });

    // 4. Merge profile software with their progress records (if any)
    return allSoftware.map((softwareName) => {
      const progress = progressMap.get(softwareName);
      if (progress) {
        return progress;
      }
      // Return a minimal progress object for software without progress records
      return {
        id: 0, // No ID for software without progress records
        studentId: selectedStudent.id,
        softwareName,
        softwareCode: null,
        status: 'XX' as const, // Not Started
        enrollmentDate: null,
        courseName: null,
        courseType: null,
        studentStatus: null,
        batchTiming: null,
        schedule: null,
        facultyName: null,
        batchStartDate: null,
        batchEndDate: null,
        batchId: null,
        notes: null,
        batch: null,
      } as unknown as StudentSoftwareProgress;
    });
  }, [selectedStudent?.id, studentProfileData, softwareProgressData]);

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
      queryClient.invalidateQueries({ queryKey: ['student-details', selectedStudent?.id] });
      
      // Update the selected student's avatarUrl immediately
      if (selectedStudent) {
        const updatedStudent = { ...selectedStudent, avatarUrl: variables.avatarUrl };
        setSelectedStudent(updatedStudent);
        
        // Update preview with cache-busted URL to force reload
        const fullImageUrl = getImageUrl(variables.avatarUrl) || variables.avatarUrl;
        const cacheBustedUrl = fullImageUrl + (fullImageUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`;
        setImagePreview(cacheBustedUrl);
      }
      
      setUploadingImage(false);
      alert('Image updated successfully!');
      
      // Don't close modal immediately - let user see the updated image
      // Close after a short delay
      setTimeout(() => {
        setIsImageModalOpen(false);
        setSelectedStudent(null);
        setImagePreview(null);
      }, 1000);
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

  const unifiedImportMutation = useMutation({
    mutationFn: (file: File) => studentAPI.unifiedStudentImport(file),
    onSuccess: (data) => {
      setBulkUploadResult(data.data);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['student-software-progress'] });
      setUploadingBulk(false);
      if (data.data.failed === 0) {
        alert(`Successfully imported ${data.data.success} student(s)!`);
        setIsBulkUploadModalOpen(false);
        setBulkUploadResult(null);
      }
    },
    onError: (error: any) => {
      setUploadingBulk(false);
      alert(error.response?.data?.message || 'Failed to import students');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentAPI.downloadUnifiedTemplate();
      
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
      link.download = 'unified_student_template.xlsx';
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
    unifiedImportMutation.mutate(file);
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
        
        // Get full URL for preview with cache-busting
        const fullImageUrl = getImageUrl(imageUrl) || imageUrl;
        const cacheBustedUrl = fullImageUrl + (fullImageUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`;
        console.log('Full image URL for preview (with cache-busting):', cacheBustedUrl);
        
        // Update preview with the cache-busted URL
        setImagePreview(cacheBustedUrl);
        
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

  const allStudents = studentsData?.data.students || [];
  const totalStudents = studentsData?.data.totalCount || allStudents.length;
  const batches = batchesData?.data || [];

  // Filter students based on search query
  const students = useMemo(() => {
    if (!searchQuery.trim()) {
      return allStudents;
    }
    const query = searchQuery.toLowerCase();
    return allStudents.filter((student: Student) => {
      const name = (student.name || '').toLowerCase();
      const email = (student.email || '').toLowerCase();
      const phone = (student.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [allStudents, searchQuery]);

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
    console.log('Opening view modal for student:', student.id, student.name);
    setSelectedStudent(student);
    setIsViewModalOpen(true);
    // Force refetch when opening the modal to get latest data
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['student-profile', student.id] });
      queryClient.invalidateQueries({ queryKey: ['student-payments', student.id] });
    }, 100);
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
              {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin') && (
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
                    📤 Import Students
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('students')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'students'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Students List
              </button>
              <button
                onClick={() => setActiveTab('student-software')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'student-software'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Student Software
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'student-software' ? (
              <StudentSoftware />
            ) : activeTab === 'students' && students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No students found</p>
              </div>
            ) : activeTab === 'students' ? (
              <>
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
                      placeholder="Search students by name, email, or phone..."
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
                      Showing {students.length} of {allStudents.length} students
                    </p>
                  )}
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle sm:px-0">
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          S.NO
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Photo
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                          Email
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                          Phone
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          DOB
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Status
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Address
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Local Address
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Permanent Address
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Course Name
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Software List
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Emergency Contact
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                          Joined Date
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                          Orientation
                        </th>
                        {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin') && (
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student, index) => {
                        // Extract enrollment metadata from documents
                        const studentProfile = student.studentProfile;
                        const documents = studentProfile?.documents;
                        let enrollmentMetadata: any = null;
                        
                        if (documents && typeof documents === 'object') {
                          if ('enrollmentMetadata' in documents) {
                            enrollmentMetadata = documents.enrollmentMetadata;
                          } else if (documents && typeof documents === 'object' && !Array.isArray(documents)) {
                            // Sometimes enrollmentMetadata is at the root level
                            enrollmentMetadata = documents;
                          }
                        }
                        
                        // Get course name and software list
                        const courseName = enrollmentMetadata?.courseName || '-';
                        const softwareList = (() => {
                          if (courseName && courseName !== '-' && coursesData?.data) {
                            const selectedCourse = coursesData.data.find(c => c.name === courseName);
                            if (selectedCourse?.software && Array.isArray(selectedCourse.software) && selectedCourse.software.length > 0) {
                              return selectedCourse.software;
                            }
                          }
                          const softwareListData = studentProfile?.softwareList;
                          if (Array.isArray(softwareListData)) {
                            return softwareListData;
                          }
                          return [];
                        })();
                        
                        // Get emergency contact info
                        const emergencyContact = enrollmentMetadata?.emergencyContact;
                        const emergencyContactNumber = emergencyContact?.number || '-';
                        const emergencyContactName = emergencyContact?.name || '-';
                        
                        return (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {student.avatarUrl ? (
                                  <img
                                    src={(getImageUrl(student.avatarUrl) || student.avatarUrl) + (student.avatarUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`}
                                    alt={student.name}
                                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover border-2 border-gray-200"
                                    crossOrigin="anonymous"
                                    key={`student-${student.id}-${student.avatarUrl}`}
                                    onError={(e) => {
                                      console.error('Student photo failed to load:', student.avatarUrl);
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmOTUwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj57e3N0dWRlbnQubmFtZS5jaGFyQXQoMCl9fTwvdGV4dD48L3N2Zz4=';
                                    }}
                                  />
                                ) : (
                                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-base sm:text-lg">
                                    {student.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-xs text-gray-500 md:hidden mt-1">
                                {student.email}
                              </div>
                              <div className="text-xs text-gray-500 lg:hidden mt-1">
                                {student.phone || '-'} • {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">{student.email}</div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">{student.phone || '-'}</div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">
                                {studentProfile?.dob ? formatDateDDMMYYYY(studentProfile.dob) : '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              <div className="text-xs sm:text-sm">
                                <span className={`px-2 py-1 rounded font-semibold ${
                                  studentProfile?.status?.toLowerCase() === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : studentProfile?.status?.toLowerCase() === 'inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {studentProfile?.status || '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500 max-w-xs truncate" title={studentProfile?.address || '-'}>
                                {studentProfile?.address || '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500 max-w-xs truncate" title={enrollmentMetadata?.localAddress || '-'}>
                                {enrollmentMetadata?.localAddress || '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500 max-w-xs truncate" title={enrollmentMetadata?.permanentAddress || '-'}>
                                {enrollmentMetadata?.permanentAddress || '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500 max-w-xs truncate" title={courseName}>
                                {courseName}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">
                                {softwareList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {softwareList.slice(0, 3).map((software: string, idx: number) => (
                                      <span key={idx} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                        {software}
                                      </span>
                                    ))}
                                    {softwareList.length > 3 && (
                                      <span className="text-gray-500 text-xs">+{softwareList.length - 3}</span>
                                    )}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden xl:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">
                                <div>{emergencyContactName}</div>
                                <div className="text-gray-400">{emergencyContactNumber}</div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="text-xs sm:text-sm text-gray-500">
                                {student.createdAt ? formatDateDDMMYYYY(student.createdAt) : '-'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                              {(() => {
                                const status = orientationStatusMap[student.id];
                                const isEligible = status?.isEligible || false;
                                return (
                                  <div className="flex items-center gap-2 flex-wrap">
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
                            <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium">
                              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                <button
                                  onClick={() => handleView(student)}
                                  className="text-blue-600 hover:text-blue-900 text-left sm:text-center"
                                  title="View Student"
                                >
                                  👁️ View
                                </button>
                                {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin') && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedStudent(student);
                                        setImagePreview(student.avatarUrl || null);
                                        setIsImageModalOpen(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-900 text-left sm:text-center"
                                      title="Update Photo"
                                    >
                                      📷 Photo
                                    </button>
                                    <button
                                      onClick={() => handleEdit(student)}
                                      className="text-orange-600 hover:text-orange-900 text-left sm:text-center"
                                      title="Edit Student"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(student)}
                                      className="text-red-600 hover:text-red-900 text-left sm:text-center"
                                      title="Delete Student"
                                    >
                                      🗑️ Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
                {searchQuery && students.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">No students found matching your search</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-sm text-orange-600 hover:text-orange-800"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {isEnrollmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Update Student Photo</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Student:</strong> {selectedStudent.name}
              </p>
              <div className="flex justify-center mb-4">
                {imagePreview ? (
                  <img
                    src={imagePreview.startsWith('data:') ? imagePreview : ((getImageUrl(imagePreview) || imagePreview) + (imagePreview.includes('?') ? '&' : '?') + `t=${Date.now()}`)}
                    alt="Preview"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    key={`preview-${imagePreview}-${Date.now()}`}
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error('Image preview failed to load:', imagePreview);
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c2VsZWN0ZWRTdHVkZW50Lm5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : selectedStudent?.avatarUrl ? (
                  <img
                    src={(getImageUrl(selectedStudent.avatarUrl) || selectedStudent.avatarUrl) + (selectedStudent.avatarUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`}
                    alt="Current"
                    className="h-32 w-32 rounded-full object-cover border-4 border-orange-500"
                    crossOrigin="anonymous"
                    key={`current-${selectedStudent.avatarUrl}-${Date.now()}`}
                    onError={(e) => {
                      console.error('Current student photo failed to load:', selectedStudent.avatarUrl);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
            ) : (!studentProfileData || !('data' in studentProfileData) || !studentProfileData.data?.user) && !isLoadingProfile ? (
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
            ) : studentProfileData && 'data' in studentProfileData && studentProfileData.data?.user ? (
              <div className="space-y-6">
                {/* Student Photo - Prominently Displayed */}
                {(() => {
                  const userData = (studentProfileData as any)?.data?.user || selectedStudent || null;
                  const studentProfile = userData?.studentProfile;
                  const photoUrl = studentProfile?.photoUrl || 
                                    userData?.avatarUrl || 
                                    selectedStudent?.avatarUrl;
                  const studentName = userData?.name || selectedStudent?.name || 'Student';
                  
                  return (
                    <div className="flex justify-center mb-6">
                      {photoUrl ? (
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
                      ) : (
                        <div className="text-center">
                          <div className="w-40 h-40 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-4xl mx-auto shadow-lg">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <p className="mt-3 text-sm font-medium text-gray-700">No Photo Available</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Basic Information */}
                {(() => {
                  const userData = (studentProfileData as any)?.data?.user || selectedStudent || null;
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Basic Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Name</label>
                          <p className="mt-1 text-sm text-gray-900 font-medium">{userData?.name || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <p className="mt-1 text-sm text-gray-900">{userData?.email || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Phone</label>
                          <p className="mt-1 text-sm text-gray-900">{userData?.phone || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <p className="mt-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              (userData?.isActive ?? true) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {(userData?.isActive ?? true) ? 'Active' : 'Inactive'}
                            </span>
                          </p>
                        </div>
                        {userData?.createdAt && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Joined Date</label>
                            <p className="mt-1 text-sm text-gray-900">{new Date(userData.createdAt).toLocaleDateString()}</p>
                          </div>
                        )}
                        {userData?.updatedAt && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                            <p className="mt-1 text-sm text-gray-900">{new Date(userData.updatedAt).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Student Profile Information */}
                {(() => {
                  const userData = (studentProfileData as any)?.data?.user || selectedStudent || null;
                  // Parse documents and enrollmentMetadata once
                  let documents = userData?.studentProfile?.documents;
                  let enrollmentMetadata: any = null;
                  let structuredDocuments: any = null;
                  
                  if (documents) {
                    if (typeof documents === 'string') {
                      try {
                        documents = JSON.parse(documents);
                      } catch (e) {
                        console.error('Error parsing documents:', e);
                        documents = null;
                      }
                    }
                    
                    if (documents && typeof documents === 'object') {
                      console.log('📄 Documents structure:', documents);
                      console.log('📄 Documents keys:', Object.keys(documents));
                      
                      // Check if documents are at root level
                      if (documents.photo || documents.panCard || documents.aadharCard || documents.otherDocuments) {
                        structuredDocuments = documents;
                      }
                      
                      // Check for enrollmentMetadata structure - try multiple possible locations
                      if ('enrollmentMetadata' in documents) {
                        enrollmentMetadata = (documents as any).enrollmentMetadata;
                        console.log('✅ Found enrollmentMetadata in documents.enrollmentMetadata:', enrollmentMetadata);
                        if (enrollmentMetadata?.documents) {
                          structuredDocuments = enrollmentMetadata.documents;
                        }
                      } else if (documents.totalDeal !== undefined || documents.bookingAmount !== undefined) {
                        // If enrollmentMetadata fields are at root level of documents
                        enrollmentMetadata = documents;
                        console.log('✅ Found enrollmentMetadata at root level of documents:', enrollmentMetadata);
                      } else {
                        console.warn('⚠️ No enrollmentMetadata found in documents structure');
                      }
                    }
                    
                    // Also check if enrollment has paymentPlan data
                    const enrollment = userData?.enrollments?.[0];
                    if (enrollment?.paymentPlan && !enrollmentMetadata) {
                      const paymentPlan = enrollment.paymentPlan;
                      console.log('✅ Found paymentPlan in enrollment:', paymentPlan);
                      enrollmentMetadata = {
                        totalDeal: paymentPlan.totalDeal,
                        bookingAmount: paymentPlan.bookingAmount,
                        balanceAmount: paymentPlan.balanceAmount,
                        emiPlan: paymentPlan.emiPlan,
                        emiPlanDate: paymentPlan.emiPlanDate,
                        emiInstallments: paymentPlan.emiInstallments,
                      };
                    }
                    
                    console.log('📊 Final enrollmentMetadata:', enrollmentMetadata);
                  }
                  
                  const studentProfile = userData?.studentProfile;
                  const emergencyContact = enrollmentMetadata?.emergencyContact;
                  
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Profile Details</h3>
                      {userData ? (
                        <div className="space-y-6">
                          {/* Personal Information */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Personal Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {studentProfile?.dob ? formatDateDDMMYYYY(studentProfile.dob) : '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {studentProfile?.enrollmentDate ? formatDateDDMMYYYY(studentProfile.enrollmentDate) : '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                                <p className="mt-1">
                                  {studentProfile?.status ? (
                                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                                      studentProfile.status === 'active' 
                                        ? 'bg-green-100 text-green-800' 
                                        : studentProfile.status === 'completed'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {studentProfile.status}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-500">-</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Address Information */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Address Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Address</label>
                                <p className="mt-1 text-sm text-gray-900">{studentProfile?.address || '-'}</p>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Local Address</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.localAddress || '-'}</p>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Permanent Address</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.permanentAddress || '-'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Course Information */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Course Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Course Name</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.courseName || '-'}</p>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Software List</label>
                                {(() => {
                                  // First try to get software from course if course name is available
                                  let softwareArray: string[] = [];
                                  const courseName = enrollmentMetadata?.courseName;
                                  
                                  if (courseName && coursesData?.data) {
                                    const selectedCourse = coursesData.data.find(c => c.name === courseName);
                                    if (selectedCourse?.software && Array.isArray(selectedCourse.software) && selectedCourse.software.length > 0) {
                                      softwareArray = selectedCourse.software;
                                    }
                                  }
                                  
                                  // If no course software found, fall back to studentProfile softwareList
                                  if (softwareArray.length === 0) {
                                    const softwareList: unknown = studentProfile?.softwareList;
                                    if (Array.isArray(softwareList)) {
                                      softwareArray = softwareList as string[];
                                    } else if (softwareList && typeof softwareList === 'string') {
                                      const trimmed = softwareList.trim();
                                      if (trimmed) {
                                        softwareArray = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                                      }
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
                            </div>
                          </div>

                          {/* Emergency Contact Information */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Emergency Contact Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {emergencyContact?.number || 
                                   enrollmentMetadata?.emergencyContact?.number || 
                                   enrollmentMetadata?.emergencyContactNumber || 
                                   '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {emergencyContact?.name || 
                                   enrollmentMetadata?.emergencyContact?.name || 
                                   enrollmentMetadata?.emergencyName || 
                                   '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Emergency Relation</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {emergencyContact?.relation || 
                                   enrollmentMetadata?.emergencyContact?.relation || 
                                   enrollmentMetadata?.emergencyRelation || 
                                   '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                      
                          {/* Payment Plan Information */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Payment Plan</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Total Deal</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {enrollmentMetadata?.totalDeal !== undefined && enrollmentMetadata?.totalDeal !== null 
                                    ? `₹${Number(enrollmentMetadata.totalDeal).toFixed(2)}` 
                                    : '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Booking Amount</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {enrollmentMetadata?.bookingAmount !== undefined && enrollmentMetadata?.bookingAmount !== null 
                                    ? `₹${Number(enrollmentMetadata.bookingAmount).toFixed(2)}` 
                                    : '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                                <p className="mt-1 text-sm text-gray-900">
                                  {enrollmentMetadata?.balanceAmount !== undefined && enrollmentMetadata?.balanceAmount !== null 
                                    ? `₹${Number(enrollmentMetadata.balanceAmount).toFixed(2)}` 
                                    : '-'}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">EMI Plan</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata?.emiPlan 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata?.emiPlan ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              {enrollmentMetadata?.emiPlanDate && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">EMI Plan Date</label>
                                  <p className="mt-1 text-sm text-gray-900">{formatDateDDMMYYYY(enrollmentMetadata.emiPlanDate)}</p>
                                </div>
                              )}
                              {enrollmentMetadata?.emiInstallments && Array.isArray(enrollmentMetadata.emiInstallments) && enrollmentMetadata.emiInstallments.length > 0 && (
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">EMI Installments</label>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Month</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Amount (₹)</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Due Date</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {enrollmentMetadata.emiInstallments.map((installment: any, index: number) => (
                                          <tr key={index}>
                                            <td className="px-4 py-2 text-sm text-gray-900">{installment.month}</td>
                                            <td className="px-4 py-2 text-sm text-gray-900">₹{Number(installment.amount).toFixed(2)}</td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              {installment.dueDate ? formatDateDDMMYYYY(installment.dueDate) : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Additional Information */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Additional Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Complimentary Software</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.complimentarySoftware || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Complimentary Gift</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.complimentaryGift || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Has Reference</label>
                                <p className="mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    enrollmentMetadata?.hasReference 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {enrollmentMetadata?.hasReference ? 'Yes' : 'No'}
                                  </span>
                                </p>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Reference Details</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.referenceDetails || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Counselor Name</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.counselorName || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Lead Source</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.leadSource || '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Walk-in Date</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.walkinDate ? formatDateDDMMYYYY(enrollmentMetadata.walkinDate) : '-'}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Master Faculty</label>
                                <p className="mt-1 text-sm text-gray-900">{enrollmentMetadata?.masterFaculty || '-'}</p>
                              </div>
                            </div>
                          </div>
                      
                          {/* Documents Section */}
                          <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Documents</h4>
                            {(() => {
                              // Collect all documents from structured format
                              const allDocs: Array<{ name: string; url: string; type: string }> = [];
                              
                              if (structuredDocuments) {
                                if (structuredDocuments.photo && structuredDocuments.photo.url) {
                                  allDocs.push({
                                    name: structuredDocuments.photo.name || 'Photo',
                                    url: structuredDocuments.photo.url,
                                    type: 'Photo'
                                  });
                                }
                                if (structuredDocuments.panCard && structuredDocuments.panCard.url) {
                                  allDocs.push({
                                    name: structuredDocuments.panCard.name || 'PAN Card',
                                    url: structuredDocuments.panCard.url,
                                    type: 'PAN Card'
                                  });
                                }
                                if (structuredDocuments.aadharCard && structuredDocuments.aadharCard.url) {
                                  allDocs.push({
                                    name: structuredDocuments.aadharCard.name || 'Aadhar Card',
                                    url: structuredDocuments.aadharCard.url,
                                    type: 'Aadhar Card'
                                  });
                                }
                                if (structuredDocuments.otherDocuments && Array.isArray(structuredDocuments.otherDocuments)) {
                                  structuredDocuments.otherDocuments.forEach((doc: any) => {
                                    if (doc && doc.url) {
                                      allDocs.push({
                                        name: doc.name || doc.url.split('/').pop() || 'Other Document',
                                        url: doc.url,
                                        type: 'Other Document'
                                      });
                                    }
                                  });
                                }
                                if (structuredDocuments.uploadedDocuments && Array.isArray(structuredDocuments.uploadedDocuments)) {
                                  structuredDocuments.uploadedDocuments.forEach((doc: any) => {
                                    if (doc && doc.url) {
                                      allDocs.push({
                                        name: doc.name || (typeof doc === 'string' ? doc.split('/').pop() : 'Document'),
                                        url: typeof doc === 'string' ? doc : doc.url,
                                        type: 'Document'
                                      });
                                    }
                                  });
                                }
                              }
                              
                              // Fallback to enrollmentDocuments array if no structured documents
                              if (allDocs.length === 0 && enrollmentMetadata?.enrollmentDocuments && Array.isArray(enrollmentMetadata.enrollmentDocuments)) {
                                enrollmentMetadata.enrollmentDocuments.forEach((docUrl: string) => {
                                  allDocs.push({
                                    name: docUrl.split('/').pop() || 'Document',
                                    url: docUrl,
                                    type: 'Document'
                                  });
                                });
                              }
                              
                              const handleDownload = async (url: string, fileName: string) => {
                                try {
                                  const fullUrl = getImageUrl(url) || url;
                                  const response = await fetch(fullUrl, {
                                    method: 'GET',
                                    headers: {
                                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                    },
                                  });
                                  
                                  if (!response.ok) {
                                    throw new Error('Failed to download file');
                                  }
                                  
                                  const blob = await response.blob();
                                  const downloadUrl = window.URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = downloadUrl;
                                  link.download = fileName;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(downloadUrl);
                                } catch (error) {
                                  console.error('Download error:', error);
                                  window.open(getImageUrl(url) || url, '_blank');
                                }
                              };
                              
                              return allDocs.length > 0 ? (
                                <div className="space-y-2">
                                  {allDocs.map((doc, index: number) => {
                                    const fileName = doc.name;
                                    const isImage = doc.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
                                    const isPdf = doc.url.toLowerCase().endsWith('.pdf');
                                    const fullUrl = getImageUrl(doc.url) || doc.url;
                                    
                                    return (
                                      <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                                      >
                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                          <div className="flex-shrink-0">
                                            {isPdf ? (
                                              <span className="text-2xl">📄</span>
                                            ) : isImage ? (
                                              <span className="text-2xl">🖼️</span>
                                            ) : (
                                              <span className="text-2xl">📎</span>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate" title={fileName}>
                                              {fileName}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                              {doc.type} {isPdf ? '(PDF)' : isImage ? '(Image)' : ''}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <a
                                            href={fullUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                                            title="View Document"
                                          >
                                            👁️ View
                                          </a>
                                          <button
                                            onClick={() => handleDownload(doc.url, fileName)}
                                            className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded hover:bg-green-50 transition-colors"
                                            title="Download Document"
                                          >
                                            ⬇️ Download
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-gray-500 mb-2">No documents uploaded for this student.</p>
                                  <p className="text-xs text-gray-400 mt-2">
                                    Documents can be uploaded through the Edit Student page.
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500">No student profile information available.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Payment Details */}
                <div>
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
                    <button
                      type="button"
                      onClick={() => refetchPayments()}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      title="Refresh Payments"
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {/* Payment Plan Information */}
                  {(() => {
                    const userData = (studentProfileData as any)?.data?.user || selectedStudent || null;
                    const documents = userData?.studentProfile?.documents;
                    let enrollmentMetadata: any = null;
                    
                    if (documents) {
                      if (typeof documents === 'string') {
                        try {
                          const parsed = JSON.parse(documents);
                          enrollmentMetadata = parsed?.enrollmentMetadata || null;
                        } catch (e) {
                          console.error('Error parsing documents:', e);
                        }
                      } else if (typeof documents === 'object' && 'enrollmentMetadata' in documents) {
                        enrollmentMetadata = (documents as any).enrollmentMetadata;
                      }
                    }

                    if (enrollmentMetadata && (enrollmentMetadata.totalDeal !== undefined || enrollmentMetadata.bookingAmount !== undefined)) {
                      const totalDeal = enrollmentMetadata.totalDeal || 0;
                      const bookingAmount = enrollmentMetadata.bookingAmount || 0;
                      const balanceAmount = enrollmentMetadata.balanceAmount !== undefined 
                        ? enrollmentMetadata.balanceAmount 
                        : totalDeal - bookingAmount;

                      return (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment Plan</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Total Deal Amount (₹)</label>
                              <p className="text-lg font-semibold text-gray-900">₹{Number(totalDeal).toFixed(2)}</p>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Booking Amount (₹)</label>
                              <p className="text-lg font-semibold text-gray-900">₹{Number(bookingAmount).toFixed(2)}</p>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Balance Amount (₹)</label>
                              <p className="text-lg font-semibold text-orange-600">₹{Number(balanceAmount).toFixed(2)}</p>
                              <p className="text-xs text-gray-500 mt-1">Balance = Total Deal - Booking Amount</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {isLoadingPayments ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Loading payments...</p>
                    </div>
                  ) : paymentsError ? (
                    <div className="text-center py-8 bg-red-50 rounded-lg">
                      <p className="text-red-600">Error loading payments: {paymentsError instanceof Error ? paymentsError.message : String(paymentsError)}</p>
                      <button
                        onClick={() => refetchPayments()}
                        className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  ) : paymentsData?.data?.payments && Array.isArray(paymentsData.data.payments) && paymentsData.data.payments.length > 0 ? (
                    <div className="space-y-4">
                      {/* Payment Summary */}
                      {(() => {
                        // Get paymentPlan from first payment's enrollment (if available)
                        const firstPayment = paymentsData.data.payments[0] as any;
                        const paymentPlan = firstPayment?.enrollment?.paymentPlan;
                        const totalDeal = paymentPlan?.totalDeal !== null && paymentPlan?.totalDeal !== undefined ? Number(paymentPlan.totalDeal) : null;
                        const bookingAmount = paymentPlan?.bookingAmount !== null && paymentPlan?.bookingAmount !== undefined ? Number(paymentPlan.bookingAmount) : 0;
                        
                        // Calculate totals from payments
                        const totalPaid = paymentsData.data.payments.reduce((sum: number, p: PaymentTransaction) => {
                          if (p.status === 'paid' || p.status === 'partial') {
                            return sum + (Number(p.paidAmount) || 0);
                          }
                          return sum;
                        }, 0);
                        const totalPending = paymentsData.data.payments.reduce((sum: number, p: PaymentTransaction) => {
                          const amount = Number(p.amount) || 0;
                          const paid = Number(p.paidAmount) || 0;
                          return sum + (amount - paid);
                        }, 0);
                        
                        // Calculate overall balance: use balanceAmount from paymentPlan if available, otherwise calculate
                        const balanceAmount = paymentPlan?.balanceAmount !== null && paymentPlan?.balanceAmount !== undefined 
                          ? Number(paymentPlan.balanceAmount)
                          : null;
                        const overallBalance = balanceAmount !== null 
                          ? balanceAmount
                          : (totalDeal !== null && totalDeal !== undefined 
                            ? Math.max(0, totalDeal - bookingAmount - totalPaid)
                            : null);
                        
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                            {totalDeal !== null && totalDeal !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Total Deal Amount</p>
                                <p className="text-lg font-semibold text-blue-600">
                                  ₹{totalDeal.toFixed(2)}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Total Payments</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {paymentsData.data.payments.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                              <p className="text-lg font-semibold text-green-600">
                                ₹{totalPaid.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Payment Pending</p>
                              <p className="text-lg font-semibold text-orange-600">
                                ₹{totalPending.toFixed(2)}
                              </p>
                            </div>
                            {overallBalance !== null && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Balance Pending</p>
                                <p className="text-lg font-semibold text-red-600">
                                  ₹{overallBalance.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {totalDeal !== null && bookingAmount > 0 
                                    ? `Total Deal: ₹${totalDeal.toFixed(2)} | Booking: ₹${bookingAmount.toFixed(2)} | Paid: ₹${totalPaid.toFixed(2)}`
                                    : totalDeal !== null
                                    ? `Total Deal: ₹${totalDeal.toFixed(2)} | Paid: ₹${totalPaid.toFixed(2)}`
                                    : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Payment Transactions */}
                      <div className="space-y-3">
                        {paymentsData.data.payments.map((payment: PaymentTransaction) => {
                          const amount = Number(payment.amount) || 0;
                          const paidAmount = Number(payment.paidAmount) || 0;
                          const pending = amount - paidAmount;
                          return (
                            <PaymentDetailCard
                              key={payment.id}
                              payment={payment}
                              amount={amount}
                              paidAmount={paidAmount}
                              pending={pending}
                              refetchPayments={refetchPayments}
                            />
                          );
                        })}
                      </div>

                      {/* Payment Notes */}
                      {paymentsData.data.payments.some((p: PaymentTransaction) => p.notes) && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Payment Notes</h4>
                          <div className="space-y-2">
                            {paymentsData.data.payments
                              .filter((p: PaymentTransaction) => p.notes)
                              .map((payment: PaymentTransaction) => (
                                <div key={payment.id} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                                  <p className="text-xs text-gray-500 mb-1">
                                    Payment #{payment.id} - {payment.paidDate ? formatDateDDMMYYYY(payment.paidDate) : payment.dueDate ? formatDateDDMMYYYY(payment.dueDate) : 'N/A'}
                                  </p>
                                  <p className="text-sm text-gray-900">{payment.notes}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No payment records found for this student.</p>
                    </div>
                  )}
                </div>

                {/* Software Progress/Completions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Software Progress</h3>
                  {isLoadingProgress || !studentProfileData ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Loading software progress...</p>
                    </div>
                  ) : progressError ? (
                    <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-700">Error loading software progress. Please try again.</p>
                      <p className="text-xs text-yellow-600 mt-2">{(progressError as any)?.message || 'Unknown error'}</p>
                    </div>
                  ) : allSoftwareWithProgress && allSoftwareWithProgress.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {allSoftwareWithProgress.map((progress: StudentSoftwareProgress, index: number) => (
                            <tr key={progress.id || `software-${index}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {progress.softwareName}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  progress.status === 'Finished'
                                    ? 'bg-green-100 text-green-800'
                                    : progress.status === 'IP'
                                    ? 'bg-blue-100 text-blue-800'
                                    : progress.status === 'NO'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {progress.status === 'Finished' ? 'Completed' : progress.status === 'IP' ? 'In Progress' : progress.status === 'NO' ? 'Not Applicable' : 'Not Started'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {progress.courseName || '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {progress.batch?.title || progress.batchId ? `Batch ${progress.batchId}` : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {progress.batchStartDate ? formatDateDDMMYYYY(progress.batchStartDate) : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {progress.batchEndDate ? formatDateDDMMYYYY(progress.batchEndDate) : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {progress.facultyName || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No software found for this student.</p>
                      <p className="text-xs text-gray-400 mt-2">Software can be added to the student profile or through enrollments.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
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
                    <p className="text-gray-500">Unable to load student profile information.</p>
                  </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
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

      {/* Unified Import Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Import Students (Unified)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Import student enrollment data and software progress in one Excel file.
            </p>
            
            {bulkUploadResult ? (
              <div className="mb-4">
                <div className={`p-4 rounded-lg mb-4 ${
                  bulkUploadResult.failed === 0 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    Import Results:
                  </h3>
                  <p className="text-green-700 font-medium">
                    ✓ Successfully imported: {bulkUploadResult.success} student(s)
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
                    <strong>Note:</strong> This unified import handles both student enrollment and software progress. 
                    Download the template to see all available fields. Required fields: phone or email, studentName.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={uploadingBulk}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? 'Importing...' : 'Import Students'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
