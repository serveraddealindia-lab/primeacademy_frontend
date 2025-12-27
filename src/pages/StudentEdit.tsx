import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { userAPI, UpdateUserRequest, UpdateStudentProfileRequest } from '../api/user.api';
import { studentAPI, StudentDetails } from '../api/student.api';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import { batchAPI } from '../api/batch.api';
import { employeeAPI } from '../api/employee.api';
import { facultyAPI } from '../api/faculty.api';
import { courseAPI } from '../api/course.api';
import { paymentAPI, PaymentTransaction, CreatePaymentRequest } from '../api/payment.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const ALL_SOFTWARES = [
  'Photoshop',
  'Illustrator',
  'InDesign',
  'After Effects',
  'Premiere Pro',
  'Figma',
  'Sketch',
  'Blender',
  'Maya',
  '3ds Max',
  'Cinema 4D',
  'Lightroom',
  'CorelDRAW',
  'AutoCAD',
  'SolidWorks',
  'Revit',
  'SketchUp',
  'Unity',
  'Unreal Engine',
  'DaVinci Resolve',
  'Final Cut Pro',
  'Procreate',
  'Affinity Designer',
  'Affinity Photo',
  'Canva Pro',
];

export const StudentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null); // Store the uploaded photo URL
  const [selectedSoftwares, setSelectedSoftwares] = useState<string[]>([]);
  const [showOtherSoftwareInput, setShowOtherSoftwareInput] = useState(false);
  const [otherSoftware, setOtherSoftware] = useState('');
  const [availableSoftwares, setAvailableSoftwares] = useState<string[]>(ALL_SOFTWARES); // Software options based on selected course
  const [isPhoneWhatsApp, setIsPhoneWhatsApp] = useState<boolean>(false); // Checkbox state for phone = WhatsApp
  const [uploadedDocuments, setUploadedDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  const [photo, setPhoto] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [panCard, setPanCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [aadharCard, setAadharCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [otherDocuments, setOtherDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  // Photo upload hook
  const { uploadPhoto, uploading: uploadingPhoto, error: photoUploadError, getPhotoUrl } = usePhotoUpload();
  const [uploadingPanCard, setUploadingPanCard] = useState(false);
  const [uploadingAadharCard, setUploadingAadharCard] = useState(false);
  const [uploadingOtherDocs, setUploadingOtherDocs] = useState(false);
  const [showLeadSourceModal, setShowLeadSourceModal] = useState(false);
  const [editingLeadSource, setEditingLeadSource] = useState<string | null>(null);
  const [newLeadSourceName, setNewLeadSourceName] = useState('');
  const [leadSources, setLeadSources] = useState<string[]>(['Walk-in', 'Online', 'Reference', 'Social Media', 'Advertisement', 'Other']);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    dueDate: '',
    paymentMethod: '',
    transactionId: '',
    notes: '',
  });

  // Form data state
  const [customizedEmiIndices, setCustomizedEmiIndices] = useState<Set<number>>(new Set()); // Track which EMIs have been manually customized
  const [customDateEmiIndices, setCustomDateEmiIndices] = useState<Set<number>>(new Set()); // Track which EMIs have custom dates
  const [formData, setFormData] = useState<{
    // Basic Info
    name?: string;
    email?: string;
    phone?: string;
    whatsappNumber?: string;
    dateOfAdmission?: string;
    isActive?: boolean;
    // Contact & Address
    localAddress?: string;
    permanentAddress?: string;
    emergencyContactNumber?: string;
    emergencyName?: string;
    emergencyRelation?: string;
    // Course & Financial
    courseName?: string;
    batchId?: number;
    totalDeal?: number;
    bookingAmount?: number;
    balanceAmount?: number;
    emiPlan?: boolean;
    emiPlanDate?: string;
    emiInstallments?: Array<{
      month: number;
      amount: number;
      dueDate?: string;
    }>;
    // Additional Info
    complimentarySoftware?: string;
    complimentaryGift?: string;
    hasReference?: boolean;
    referenceDetails?: string;
    counselorName?: string;
    leadSource?: string;
    walkinDate?: string;
    masterFaculty?: string;
    // Profile fields
    dob?: string;
    address?: string;
    enrollmentDate?: string;
    status?: string;
    softwareList?: string[];
    enrollmentDocuments?: Array<{ name: string; url: string; size?: number }>;
  }>({});

  // Fetch student data
  const {
    data: studentDetailsResponse,
    isLoading,
    error: queryError,
    refetch: refetchStudentDetails,
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
    enabled: !!id && !!user && isAdmin,
    retry: 1,
  });

  const studentData = studentDetailsResponse;

  // Fetch course names from Course Modules (database) - Fetch early to avoid initialization errors
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseAPI.getAllCourses(),
  });

  // Initialize form data when student data loads
  useEffect(() => {
    if (studentData) {
      const profile = studentData.studentProfile;
      let documents = profile?.documents;
      
      // Parse documents if it's a string (MySQL JSON fields sometimes come as strings)
      if (documents && typeof documents === 'string') {
        try {
          documents = JSON.parse(documents);
        } catch (e) {
          console.error('Error parsing documents string:', e);
          documents = undefined;
        }
      }
      
      const enrollmentMetadata = documents && typeof documents === 'object' && 'enrollmentMetadata' in documents
        ? (documents as any).enrollmentMetadata
        : null;

      setFormData({
        // Basic Info
        name: studentData.name || '',
        email: studentData.email || '',
        phone: studentData.phone || '',
        whatsappNumber: enrollmentMetadata?.whatsappNumber || '',
        dateOfAdmission: enrollmentMetadata?.dateOfAdmission || profile?.enrollmentDate || '',
        isActive: studentData.isActive ?? true,
        // Contact & Address
        localAddress: enrollmentMetadata?.localAddress || profile?.address || '',
        permanentAddress: enrollmentMetadata?.permanentAddress || '',
        emergencyContactNumber: enrollmentMetadata?.emergencyContact?.number || '',
        emergencyName: enrollmentMetadata?.emergencyContact?.name || '',
        emergencyRelation: enrollmentMetadata?.emergencyContact?.relation || '',
        // Course & Financial
        courseName: enrollmentMetadata?.courseName || '',
        totalDeal: enrollmentMetadata?.totalDeal,
        bookingAmount: enrollmentMetadata?.bookingAmount,
        balanceAmount: enrollmentMetadata?.balanceAmount,
        emiPlan: enrollmentMetadata?.emiPlan || false,
        emiPlanDate: enrollmentMetadata?.emiPlanDate || '',
        emiInstallments: enrollmentMetadata?.emiInstallments || [],
        enrollmentDocuments: enrollmentMetadata?.enrollmentDocuments || [],
        // Additional Info
        complimentarySoftware: enrollmentMetadata?.complimentarySoftware || '',
        complimentaryGift: enrollmentMetadata?.complimentaryGift || '',
        hasReference: enrollmentMetadata?.hasReference || false,
        referenceDetails: enrollmentMetadata?.referenceDetails || '',
        counselorName: enrollmentMetadata?.counselorName || '',
        leadSource: enrollmentMetadata?.leadSource || '',
        walkinDate: enrollmentMetadata?.walkinDate || '',
        masterFaculty: enrollmentMetadata?.masterFaculty || '',
        // Profile fields
        dob: profile?.dob || '',
        address: profile?.address || '',
        enrollmentDate: profile?.enrollmentDate || '',
        status: profile?.status || 'active',
        softwareList: profile?.softwareList || [],
      });

      // Load existing documents - check for structured documents first
      // Check both enrollmentMetadata.documents and root level documents
      let structuredDocuments = enrollmentMetadata?.documents;
      
      // Also check if documents are at root level (not inside enrollmentMetadata)
      if (!structuredDocuments && documents && typeof documents === 'object') {
        // Check if documents have photo, panCard, etc. at root level
        if (documents.photo || documents.panCard || documents.aadharCard || documents.otherDocuments) {
          structuredDocuments = documents;
        }
      }
      
      // Debug logging
      console.log('Loading documents:', {
        documents,
        enrollmentMetadata,
        structuredDocuments,
        hasPhoto: !!structuredDocuments?.photo,
        hasPanCard: !!structuredDocuments?.panCard,
        hasAadharCard: !!structuredDocuments?.aadharCard,
        otherDocsCount: structuredDocuments?.otherDocuments?.length || 0,
      });
      
      if (structuredDocuments && typeof structuredDocuments === 'object') {
        // Load structured documents (photo, panCard, aadharCard, otherDocuments)
        if (structuredDocuments.photo && structuredDocuments.photo.url) {
          setPhoto({
            name: structuredDocuments.photo.name || structuredDocuments.photo.url.split('/').pop() || 'Photo',
            url: structuredDocuments.photo.url,
            size: structuredDocuments.photo.size,
          });
        }
        if (structuredDocuments.panCard && structuredDocuments.panCard.url) {
          setPanCard({
            name: structuredDocuments.panCard.name || structuredDocuments.panCard.url.split('/').pop() || 'PAN Card',
            url: structuredDocuments.panCard.url,
            size: structuredDocuments.panCard.size,
          });
        }
        if (structuredDocuments.aadharCard && structuredDocuments.aadharCard.url) {
          setAadharCard({
            name: structuredDocuments.aadharCard.name || structuredDocuments.aadharCard.url.split('/').pop() || 'Aadhar Card',
            url: structuredDocuments.aadharCard.url,
            size: structuredDocuments.aadharCard.size,
          });
        }
        if (structuredDocuments.otherDocuments && Array.isArray(structuredDocuments.otherDocuments)) {
          const validDocs = structuredDocuments.otherDocuments.filter((doc: any) => doc && doc.url);
          if (validDocs.length > 0) {
            setOtherDocuments(validDocs.map((doc: any) => ({
              name: doc.name || doc.url.split('/').pop() || 'Document',
              url: doc.url,
              size: doc.size,
            })));
          }
        }
        // Load uploadedDocuments (legacy/general documents)
        if (structuredDocuments.uploadedDocuments && Array.isArray(structuredDocuments.uploadedDocuments)) {
          const docs = structuredDocuments.uploadedDocuments.map((doc: any) => ({
            name: doc.name || (typeof doc === 'string' ? doc.split('/').pop() : 'Document'),
            url: typeof doc === 'string' ? doc : doc.url,
            size: typeof doc === 'string' ? undefined : doc.size,
          }));
          setUploadedDocuments(docs);
        }
      } else if (enrollmentMetadata?.enrollmentDocuments && Array.isArray(enrollmentMetadata.enrollmentDocuments)) {
        // Fallback: Load from legacy enrollmentDocuments array (for backward compatibility)
        const docs = enrollmentMetadata.enrollmentDocuments.map((url: string) => ({
          name: url.split('/').pop() || 'Document',
          url: url,
        }));
        setUploadedDocuments(docs);
      }

      // Set software list
      if (profile?.softwareList && Array.isArray(profile.softwareList)) {
        setSelectedSoftwares(profile.softwareList);
      }
      
      // Set available software based on course
      if (enrollmentMetadata?.courseName && coursesData?.data) {
        const selectedCourse = coursesData.data.find(c => c.name === enrollmentMetadata.courseName);
        if (selectedCourse?.software && Array.isArray(selectedCourse.software) && selectedCourse.software.length > 0) {
          setAvailableSoftwares(selectedCourse.software);
        } else {
          setAvailableSoftwares(ALL_SOFTWARES);
        }
      } else {
        setAvailableSoftwares(ALL_SOFTWARES);
      }
      
      // Check if phone number equals WhatsApp number to set checkbox
      const phoneValue = formData.phone || '';
      const whatsappValue = formData.whatsappNumber || '';
      if (phoneValue && whatsappValue && phoneValue === whatsappValue) {
        setIsPhoneWhatsApp(true);
      }

      // Set image preview - process URL through getImageUrl to fix any URL issues
      if (profile?.photoUrl || studentData.avatarUrl) {
        const rawUrl = profile?.photoUrl || studentData.avatarUrl;
        const processedUrl = rawUrl ? (getImageUrl(rawUrl) || rawUrl) : null;
        setImagePreview(processedUrl);
      }
    }
  }, [studentData]);
  
  // Separate useEffect to update available software when coursesData loads
  useEffect(() => {
    if (formData.courseName && coursesData?.data) {
      const selectedCourse = coursesData.data.find(c => c.name === formData.courseName);
      if (selectedCourse?.software && Array.isArray(selectedCourse.software) && selectedCourse.software.length > 0) {
        setAvailableSoftwares(selectedCourse.software);
      } else {
        setAvailableSoftwares(ALL_SOFTWARES);
      }
    } else if (!formData.courseName) {
      setAvailableSoftwares(ALL_SOFTWARES);
    }
  }, [formData.courseName, coursesData]);

  // Fetch batches
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
  });

  // Fetch employees for dropdown
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeAPI.getAllEmployees(),
  });

// Fetch faculty for dropdown
const { data: facultyData } = useQuery({
  queryKey: ['faculty'],
  queryFn: () => facultyAPI.getAllFaculty(),
});

// Fetch course names from Excel (legacy source)
const { data: courseNamesData } = useQuery({
  queryKey: ['courseNames'],
  queryFn: () => studentAPI.getCourseNames(),
});

  // Fetch enrollments for payment creation
  const { data: enrollmentsData } = useQuery({
    queryKey: ['enrollments', id],
    queryFn: async () => {
      if (!id) return { data: [] };
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/enrollments?studentId=${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          return { data: Array.isArray(data.data) ? data.data : (data.data?.enrollments || []) };
        }
        return { data: [] };
      } catch (error) {
        console.error('Error fetching enrollments:', error);
        return { data: [] };
      }
    },
    enabled: !!id,
  });

  // Fetch payments for the student (read-only display)
  const { data: paymentsData, refetch: refetchPayments } = useQuery({
    queryKey: ['student-payments-edit', id],
    queryFn: async () => {
      if (!id) return { status: 'success', data: { payments: [] } };
      try {
        const result = await paymentAPI.getAllPayments({ studentId: Number(id) });
        return result;
      } catch (error) {
        console.error('Error fetching payments:', error);
        return { status: 'success', data: { payments: [] } };
      }
    },
    enabled: !!id,
    staleTime: 30000, // Keep data fresh for 30 seconds
    gcTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  // Auto-calculate balance when totalDeal or bookingAmount changes
  useEffect(() => {
    if (formData.totalDeal !== undefined && formData.totalDeal !== null && 
        formData.bookingAmount !== undefined && formData.bookingAmount !== null) {
      const totalDeal = Number(formData.totalDeal) || 0;
      const bookingAmount = Number(formData.bookingAmount) || 0;
      const calculatedBalance = Math.max(0, totalDeal - bookingAmount);
      setFormData(prev => {
        // Only update if balance actually changed to avoid infinite loops
        if (prev.balanceAmount !== calculatedBalance) {
          return { ...prev, balanceAmount: calculatedBalance };
        }
        return prev;
      });
    }
  }, [formData.totalDeal, formData.bookingAmount]);

  // Auto-calculate EMI installments when EMI plan is enabled and balance is available
  useEffect(() => {
    if (formData.emiPlan && formData.balanceAmount && formData.balanceAmount > 0 && formData.emiPlanDate) {
      const balance = Number(formData.balanceAmount);
      
      // Always recalculate installments with equal amounts when balance changes or EMI plan is enabled
      // Default: 10 installments
      const numberOfInstallments = 10;
      const installmentAmount = balance / numberOfInstallments;
      const installments: Array<{ month: number; amount: number; dueDate: string }> = [];
      
      // Get EMI plan date
      const emiPlanDate = new Date(formData.emiPlanDate);
      
      for (let i = 1; i <= numberOfInstallments; i++) {
        // Calculate due date: EMI plan date + (i-1) months
        const dueDate = new Date(emiPlanDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        const dueDateStr = dueDate.toISOString().split('T')[0];
        
        installments.push({
          month: i,
          amount: Math.round(installmentAmount * 100) / 100, // Round to 2 decimal places
          dueDate: dueDateStr
        });
      }
      
      // Adjust last installment to account for rounding
      const totalCalculated = installments.reduce((sum, inst) => sum + inst.amount, 0);
      if (totalCalculated !== balance) {
        installments[installments.length - 1].amount = Math.round((balance - (totalCalculated - installments[installments.length - 1].amount)) * 100) / 100;
      }
      
      handleInputChange('emiInstallments', installments);
      
      // Clear customized indices when auto-calculating (fresh calculation)
      setCustomizedEmiIndices(new Set());
      setCustomDateEmiIndices(new Set());
    } else if (!formData.emiPlan && formData.emiInstallments && formData.emiInstallments.length > 0) {
      // Clear installments when EMI plan is disabled
      handleInputChange('emiInstallments', []);
      setCustomizedEmiIndices(new Set());
      setCustomDateEmiIndices(new Set());
    }
  }, [formData.emiPlan, formData.balanceAmount, formData.emiPlanDate]);

  const batches = batchesData?.data || [];

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
      queryClient.invalidateQueries({ queryKey: ['student-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['student-payments-edit', id] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update student profile');
    },
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: (data: CreatePaymentRequest) => {
      console.log('Creating payment with data:', data);
      console.log('Student ID from URL:', id, 'Type:', typeof id);
      console.log('Student ID in request:', data.studentId, 'Type:', typeof data.studentId);
      return paymentAPI.createPayment(data);
    },
    onSuccess: (response) => {
      console.log('Payment created successfully! Response:', response);
      console.log('Created payment studentId:', response?.data?.payment?.studentId);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['student-payments'] });
      queryClient.invalidateQueries({ queryKey: ['student-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['student-payments-edit', id] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setIsPaymentModalOpen(false);
      setNewPayment({
        amount: '',
        dueDate: '',
        paymentMethod: '',
        transactionId: '',
        notes: '',
      });
      alert(`Payment created successfully!\n\nPayment ID: ${response?.data?.payment?.id}\nStudent ID: ${response?.data?.payment?.studentId}\nAmount: ₹${response?.data?.payment?.amount}\n\nThe payment will appear in the Payment History section below.`);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create payment';
      console.error('Payment creation error:', error);
      console.error('Error response:', error.response);
      alert(`Error: ${errorMessage}\n\nCheck console for details.`);
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // If phone number changes and checkbox is checked, update WhatsApp number
    if (field === 'phone' && isPhoneWhatsApp) {
      setFormData(prev => ({ ...prev, whatsappNumber: value }));
    }
    
    // Fetch and display course software when course is selected
    if (field === 'courseName' && value) {
      const selectedCourse = coursesData?.data?.find(course => course.name === value);
      if (selectedCourse?.software && Array.isArray(selectedCourse.software) && selectedCourse.software.length > 0) {
        const courseSoftware = selectedCourse.software as string[];
        // Set available software to only course software
        setAvailableSoftwares(courseSoftware);
        // Auto-select all course software (read-only, comes from course)
        setSelectedSoftwares(courseSoftware);
        // Clear any manually added "Other" software when course is selected
        setShowOtherSoftwareInput(false);
        setOtherSoftware('');
      } else {
        // If no course software found, reset to all software
        setAvailableSoftwares(ALL_SOFTWARES);
        setSelectedSoftwares([]);
      }
    } else if (field === 'courseName' && !value) {
      // Reset to all software when course is cleared - allow manual selection
      setAvailableSoftwares(ALL_SOFTWARES);
      setSelectedSoftwares([]);
      setShowOtherSoftwareInput(false);
      setOtherSoftware('');
    }
  };

  const handleCreatePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) {
      alert('Student ID is required');
      return;
    }

    const amount = parseFloat(newPayment.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    if (!newPayment.dueDate) {
      alert('Please select a due date');
      return;
    }

    const enrollmentId = (document.getElementById('paymentEnrollmentId') as HTMLSelectElement)?.value;
    
    const data: CreatePaymentRequest = {
      studentId: Number(id),
      enrollmentId: enrollmentId ? Number(enrollmentId) : undefined,
      amount: amount,
      dueDate: newPayment.dueDate,
      paymentMethod: newPayment.paymentMethod || undefined,
      transactionId: newPayment.transactionId || undefined,
      notes: newPayment.notes || undefined,
    };

    console.log('Creating payment with data:', data);
    console.log('Student ID:', id, 'Type:', typeof id, 'Parsed:', Number(id));
    createPaymentMutation.mutate(data);
  };

  const handleSoftwareChange = (software: string, checked: boolean) => {
    if (checked) {
      setSelectedSoftwares(prev => [...prev, software]);
    } else {
      setSelectedSoftwares(prev => prev.filter(s => s !== software));
    }
  };

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


  // Handle photo upload - NEW SIMPLIFIED VERSION
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      e.target.value = '';
      return;
    }

    console.log('Photo upload initiated:', { fileName: file.name, fileType: file.type, fileSize: file.size });

    // Upload photo using hook
    const photoData = await uploadPhoto(file);
    
    if (!photoData) {
      // Error already set in hook, show alert
      const errorMsg = photoUploadError || 'Failed to upload photo. Please try again.';
      console.error('Photo upload failed:', errorMsg);
      alert(errorMsg);
      e.target.value = '';
      return;
    }

    console.log('Photo uploaded successfully, updating state:', photoData);

    // Set photo in state
    setPhoto(photoData);
    setUploadedPhotoUrl(photoData.url);
    
    // Set image preview for display
    const previewUrl = getPhotoUrl(photoData.url) || photoData.url;
    setImagePreview(previewUrl);

    // Update user's avatarUrl and student profile photoUrl
    if (id) {
      try {
        console.log('Updating avatarUrl and photoUrl in database:', photoData.url);
        await userAPI.updateUser(Number(id), { avatarUrl: photoData.url });
        if (studentData?.studentProfile) {
          await userAPI.updateStudentProfile(Number(id), { photoUrl: photoData.url });
        }
        queryClient.invalidateQueries({ queryKey: ['student-details', id] });
        console.log('Photo URLs updated successfully');
      } catch (error: any) {
        console.error('Error updating photo URLs:', error);
        // Don't fail - photo is uploaded, just URL update failed
        alert('Photo uploaded but failed to update profile. Please refresh the page.');
      }
    }

    alert('Photo uploaded successfully!');
    e.target.value = '';
  };

  // Handle PAN Card upload
  const handlePanCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid file (JPG, PNG, or PDF)');
      e.target.value = '';
      return;
    }

    setUploadingPanCard(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const uploadedFile = uploadResponse.data.files[0];
        setPanCard({
          name: uploadedFile.originalName,
          url: uploadedFile.url,
          size: uploadedFile.size,
        });
        alert('PAN Card uploaded successfully!');
      } else {
        throw new Error('No file returned from upload');
      }
    } catch (error: any) {
      console.error('PAN Card upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload PAN Card');
    } finally {
      setUploadingPanCard(false);
      e.target.value = '';
    }
  };

  // Handle Aadhar Card upload
  const handleAadharCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid file (JPG, PNG, or PDF)');
      e.target.value = '';
      return;
    }

    setUploadingAadharCard(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const uploadedFile = uploadResponse.data.files[0];
        setAadharCard({
          name: uploadedFile.originalName,
          url: uploadedFile.url,
          size: uploadedFile.size,
        });
        alert('Aadhar Card uploaded successfully!');
      } else {
        throw new Error('No file returned from upload');
      }
    } catch (error: any) {
      console.error('Aadhar Card upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload Aadhar Card');
    } finally {
      setUploadingAadharCard(false);
      e.target.value = '';
    }
  };

  // Handle Other Documents upload (multiple files)
  const handleOtherDocumentsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const fileArray = Array.from(files);
    const invalidFiles = fileArray.filter(file => !allowedTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      alert('Please select only valid files (JPG, PNG, or PDF)');
      e.target.value = '';
      return;
    }

    setUploadingOtherDocs(true);
    try {
      const uploadResponse = await uploadAPI.uploadMultipleFiles(fileArray);
      if (uploadResponse.data && uploadResponse.data.files) {
        const newDocuments = uploadResponse.data.files.map((file: { originalName: string; url: string; size: number }) => ({
          name: file.originalName,
          url: file.url,
          size: file.size,
        }));
        setOtherDocuments(prev => [...prev, ...newDocuments]);
        alert(`${newDocuments.length} document(s) uploaded successfully!`);
      } else {
        throw new Error('No files returned from upload');
      }
    } catch (error: any) {
      console.error('Other documents upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload documents');
    } finally {
      setUploadingOtherDocs(false);
      e.target.value = '';
    }
  };

  // Remove other document
  const handleRemoveOtherDocument = (index: number) => {
    setOtherDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const validateAllFields = (): boolean => {
    const errors: string[] = [];

    // Step 1: Basic Information
    if (!formData.name || !formData.name.trim()) {
      errors.push('Student Name is required');
    }
    if (!formData.email || !formData.email.trim()) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.push('Please enter a valid email address');
      }
    }
    if (!formData.phone || !formData.phone.trim()) {
      errors.push('Phone number is required');
    } else {
      const phoneCleaned = formData.phone.replace(/\D/g, '');
      if (phoneCleaned.length !== 10) {
        errors.push('Please enter a valid 10-digit phone number');
      }
    }

    // Step 2: Address & Contact
    if (!formData.localAddress || !formData.localAddress.trim()) {
      errors.push('Local Address is required');
    }
    if (!formData.permanentAddress || !formData.permanentAddress.trim()) {
      errors.push('Permanent Address is required');
    }
    if (!formData.whatsappNumber || !formData.whatsappNumber.trim()) {
      errors.push('WhatsApp number is required');
    } else {
      const whatsappCleaned = formData.whatsappNumber.replace(/\D/g, '');
      if (whatsappCleaned.length !== 10) {
        errors.push('Please enter a valid 10-digit WhatsApp number');
      }
    }
    if (!formData.emergencyContactNumber || !formData.emergencyContactNumber.trim()) {
      errors.push('Emergency Contact Number is required');
    } else {
      const emergencyCleaned = formData.emergencyContactNumber.replace(/\D/g, '');
      if (emergencyCleaned.length !== 10) {
        errors.push('Please enter a valid 10-digit emergency contact number');
      }
    }
    if (!formData.emergencyName || !formData.emergencyName.trim()) {
      errors.push('Emergency Contact Name is required');
    }
    if (!formData.emergencyRelation || !formData.emergencyRelation.trim()) {
      errors.push('Emergency Contact Relation is required');
    }

    // Validate Date of Birth - must be at least 18 years old
    if (formData.dob) {
      const dobDate = new Date(formData.dob);
      if (!isNaN(dobDate.getTime())) {
        if (dobDate > new Date()) {
          errors.push('Date of birth cannot be in the future');
        } else {
          const today = new Date();
          let age = today.getFullYear() - dobDate.getFullYear();
          const monthDiff = today.getMonth() - dobDate.getMonth();
          const dayDiff = today.getDate() - dobDate.getDate();
          
          // Adjust age if birthday hasn't occurred this year
          if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age--;
          }
          
          if (age < 18) {
            errors.push('Student must be at least 18 years old');
          }
        }
      }
    }

    if (errors.length > 0) {
      alert(`Please fill all required fields correctly:\n${errors.join('\n')}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!studentData) {
      alert('Student data is not loaded. Please try again.');
      return;
    }

    // Validate all required fields
    if (!validateAllFields()) {
      return;
    }

    // Combine all selected software
    let softwaresList = [...selectedSoftwares];
    if (showOtherSoftwareInput && otherSoftware.trim()) {
      const otherSoftwareList = otherSoftware.split(',').map(s => s.trim()).filter(s => s.length > 0);
      softwaresList = [...softwaresList, ...otherSoftwareList];
    }
    
    // Remove duplicates and filter empty strings
    softwaresList = [...new Set(softwaresList.filter(s => s && s.trim().length > 0))];
    
    console.log('Selected software list for update:', softwaresList);

    // Prepare enrollmentMetadata
    const enrollmentMetadata: any = {};
    if (formData.whatsappNumber) enrollmentMetadata.whatsappNumber = formData.whatsappNumber;
    if (formData.localAddress) enrollmentMetadata.localAddress = formData.localAddress;
    if (formData.permanentAddress) enrollmentMetadata.permanentAddress = formData.permanentAddress;
    if (formData.emergencyContactNumber || formData.emergencyName || formData.emergencyRelation) {
      enrollmentMetadata.emergencyContact = {
        number: formData.emergencyContactNumber || null,
        name: formData.emergencyName || null,
        relation: formData.emergencyRelation || null,
      };
    }
    if (formData.courseName) enrollmentMetadata.courseName = formData.courseName;
    if (formData.totalDeal !== undefined) enrollmentMetadata.totalDeal = formData.totalDeal;
    if (formData.bookingAmount !== undefined) enrollmentMetadata.bookingAmount = formData.bookingAmount;
    if (formData.balanceAmount !== undefined) enrollmentMetadata.balanceAmount = formData.balanceAmount;
    if (formData.emiPlan !== undefined) enrollmentMetadata.emiPlan = formData.emiPlan;
    if (formData.emiPlanDate) enrollmentMetadata.emiPlanDate = formData.emiPlanDate;
    if (formData.emiInstallments && formData.emiInstallments.length > 0) {
      enrollmentMetadata.emiInstallments = formData.emiInstallments;
    }
    // Store documents in structured format
    const documents: any = {};
    if (photo) documents.photo = photo;
    if (panCard) documents.panCard = panCard;
    if (aadharCard) documents.aadharCard = aadharCard;
    if (otherDocuments.length > 0) documents.otherDocuments = otherDocuments;
    if (uploadedDocuments.length > 0) documents.uploadedDocuments = uploadedDocuments;
    
    // Also maintain enrollmentDocuments array for backward compatibility
    const allDocuments = [
      ...(photo ? [photo.url] : []),
      ...(panCard ? [panCard.url] : []),
      ...(aadharCard ? [aadharCard.url] : []),
      ...otherDocuments.map(doc => doc.url),
      ...uploadedDocuments.map(doc => doc.url),
    ];
    if (allDocuments.length > 0) {
      enrollmentMetadata.enrollmentDocuments = allDocuments;
    }
    if (Object.keys(documents).length > 0) {
      enrollmentMetadata.documents = documents;
    }
    if (formData.complimentarySoftware) enrollmentMetadata.complimentarySoftware = formData.complimentarySoftware;
    if (formData.complimentaryGift) enrollmentMetadata.complimentaryGift = formData.complimentaryGift;
    if (formData.hasReference !== undefined) enrollmentMetadata.hasReference = formData.hasReference;
    if (formData.referenceDetails) enrollmentMetadata.referenceDetails = formData.referenceDetails;
    if (formData.counselorName) enrollmentMetadata.counselorName = formData.counselorName;
    if (formData.leadSource) enrollmentMetadata.leadSource = formData.leadSource;
    if (formData.walkinDate) enrollmentMetadata.walkinDate = formData.walkinDate;
    if (formData.masterFaculty) enrollmentMetadata.masterFaculty = formData.masterFaculty;
    if (formData.dateOfAdmission) enrollmentMetadata.dateOfAdmission = formData.dateOfAdmission;

    // Get photo URL - use uploaded photo URL if available, otherwise use existing photoUrl or avatarUrl
    let photoUrlToSave: string | undefined = undefined;
    if (uploadedPhotoUrl) {
      // Use the uploaded photo URL (raw URL from server)
      photoUrlToSave = uploadedPhotoUrl;
    } else if (studentData?.studentProfile?.photoUrl) {
      // Use existing photoUrl from profile
      photoUrlToSave = studentData.studentProfile.photoUrl;
    } else if (studentData?.avatarUrl) {
      // Fallback to avatarUrl
      photoUrlToSave = studentData.avatarUrl;
    }

    // Update user information
    const userData: UpdateUserRequest = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      isActive: formData.isActive,
      avatarUrl: photoUrlToSave,
    };

    // Update student profile
    const profileData: UpdateStudentProfileRequest = {
      dob: formData.dob,
      address: formData.localAddress || formData.address,
      enrollmentDate: formData.enrollmentDate || formData.dateOfAdmission,
      status: formData.status,
      softwareList: softwaresList.length > 0 ? softwaresList : undefined,
      photoUrl: photoUrlToSave, // Include photoUrl in profile update
      documents: {
        enrollmentMetadata: enrollmentMetadata,
      },
    };

    try {
      await updateUserMutation.mutateAsync(userData);
      await updateStudentProfileMutation.mutateAsync(profileData);
      // Reset uploaded photo URL after successful save
      setUploadedPhotoUrl(null);
      alert('Student updated successfully!');
      navigate('/students');
    } catch (error) {
      console.error('Error updating student:', error);
    }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.name.trim()) {
        alert('Student Name is required');
        return;
      }
      if (!formData.phone || !formData.phone.trim()) {
        alert('Phone number is required');
        return;
      }
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Permission checks
  if (!user) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
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
        <div className="max-w-7xl mx-auto p-4 md:p-6">
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

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
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

  if (queryError || !studentData) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 text-lg font-semibold">Error loading student data</p>
            <p className="text-gray-600 mt-2">
              {(queryError as any)?.response?.data?.message || 
               (queryError instanceof Error ? queryError.message : 'Student not found') ||
               'Internal server error while fetching user'}
            </p>
            {(queryError as any)?.response?.status && (
              <p className="text-gray-500 text-xs mt-1">Status Code: {(queryError as any).response.status}</p>
            )}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Edit Student</h1>
                <p className="mt-2 text-orange-100 text-sm md:text-base">Update student information</p>
              </div>
              <button
                onClick={() => navigate('/students')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm md:text-base"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="px-4 md:px-8 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between overflow-x-auto">
              {[1, 2, 3, 4].map((step) => (
                <React.Fragment key={step}>
                  <div className="flex items-center min-w-0 flex-shrink-0">
                    <div
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-sm md:text-base ${
                        currentStep >= step
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {step}
                    </div>
                    <span
                      className={`ml-2 text-xs md:text-sm font-medium hidden sm:inline ${
                        currentStep >= step ? 'text-orange-600' : 'text-gray-500'
                      }`}
                    >
                      {step === 1 && 'Basic Info'}
                      {step === 2 && 'Contact & Address'}
                      {step === 3 && 'Course & Financial'}
                      {step === 4 && 'Additional Info'}
                    </span>
                  </div>
                  {step < totalSteps && (
                    <div
                      className={`flex-1 h-1 mx-1 md:mx-2 min-w-[20px] ${
                        currentStep > step ? 'bg-orange-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <form onSubmit={(e) => {
            // Only allow form submission when explicitly clicking the submit button
            // Prevent any other form submission triggers
            e.preventDefault();
          }} onKeyDown={(e) => {
            // Prevent form submission when Enter is pressed in any input field
            // Only allow submission via the submit button
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              // Allow Enter in textareas (they handle it naturally)
              if (target.tagName === 'TEXTAREA') {
                return; // Let textarea handle Enter normally
              }
              // Prevent Enter in all other cases (input fields, selects, etc.)
              e.preventDefault();
              e.stopPropagation();
            }
          }}>
            <div className="p-4 md:p-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>
                  
                  {/* Student Photo */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">Student Photo</h3>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                      {(() => {
                        // Get photo URL - prioritize imagePreview (which is already processed), then fallback to profile/avatar URLs
                        let photoUrl = imagePreview;
                        if (!photoUrl) {
                          const rawUrl = studentData?.studentProfile?.photoUrl || studentData?.avatarUrl;
                          // Process the URL through getImageUrl to fix any URL issues (like duplicate domains)
                          photoUrl = rawUrl ? (getImageUrl(rawUrl) || rawUrl) : null;
                        } else if (!photoUrl.startsWith('data:')) {
                          // If imagePreview is not a data URL, process it through getImageUrl
                          photoUrl = getImageUrl(photoUrl) || photoUrl;
                        }
                        const studentName = formData.name || studentData?.name || 'Student';
                        if (photoUrl) {
                          const cacheBustedUrl = photoUrl + (photoUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`;
                          return (
                            <img
                              key={`student-photo-${photoUrl}-${Date.now()}`}
                              src={cacheBustedUrl}
                              alt={studentName}
                              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-orange-500 shadow-lg"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                console.error('Student photo failed to load:', photoUrl);
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY5NTAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7c3R1ZGVudE5hbWUuY2hhckF0KDApfX08L3RleHQ+PC9zdmc+';
                              }}
                            />
                          );
                        } else {
                          return (
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-2xl md:text-3xl shadow-lg">
                              {studentName.charAt(0).toUpperCase()}
                            </div>
                          );
                        }
                      })()}
                      <div className="flex-1 w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photo</label>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                        {uploadingPhoto && <p className="mt-1 text-xs text-gray-500">Uploading...</p>}
                        {photoUploadError && <p className="mt-1 text-xs text-red-600">{photoUploadError}</p>}
                        <p className="mt-1 text-xs text-gray-500">JPG, PNG, WEBP, GIF - Max 5MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="mt-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPhoneWhatsApp}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsPhoneWhatsApp(checked);
                              if (checked && formData.phone) {
                                // Auto-fill WhatsApp number with phone number
                                handleInputChange('whatsappNumber', formData.phone);
                              } else if (!checked) {
                                // Clear WhatsApp number when unchecked (only if it matches phone)
                                if (formData.whatsappNumber === formData.phone) {
                                  handleInputChange('whatsappNumber', '');
                                }
                              }
                            }}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">Phone number is WhatsApp number</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        value={formData.whatsappNumber || ''}
                        onChange={(e) => {
                          handleInputChange('whatsappNumber', e.target.value);
                          // If user manually changes WhatsApp number, uncheck the checkbox if it was checked
                          if (isPhoneWhatsApp && e.target.value !== formData.phone) {
                            setIsPhoneWhatsApp(false);
                          }
                        }}
                        disabled={isPhoneWhatsApp}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          isPhoneWhatsApp ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      />
                      {isPhoneWhatsApp && (
                        <p className="mt-1 text-xs text-blue-600">✓ Auto-filled from phone number</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(formData.dob)}
                        onChange={(e) => handleInputChange('dob', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Must be at least 18 years old</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Admission
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(formData.dateOfAdmission)}
                        onChange={(e) => handleInputChange('dateOfAdmission', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.isActive ? 'true' : 'false'}
                        onChange={(e) => handleInputChange('isActive', e.target.value === 'true')}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Profile Status
                      </label>
                      <select
                        value={formData.status || 'active'}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="on-hold">On Hold</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact & Address */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Contact & Address Information</h2>
                  
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Local Address
                      </label>
                      <textarea
                        rows={3}
                        value={formData.localAddress || ''}
                        onChange={(e) => handleInputChange('localAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Permanent Address
                      </label>
                      <textarea
                        rows={3}
                        value={formData.permanentAddress || ''}
                        onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact Number
                        </label>
                        <input
                          type="tel"
                          value={formData.emergencyContactNumber || ''}
                          onChange={(e) => handleInputChange('emergencyContactNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact Name
                        </label>
                        <input
                          type="text"
                          value={formData.emergencyName || ''}
                          onChange={(e) => handleInputChange('emergencyName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Relation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Father, Mother, Guardian"
                          value={formData.emergencyRelation || ''}
                          onChange={(e) => handleInputChange('emergencyRelation', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Course & Financial Details */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Course & Financial Details</h2>
                  
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Course Name <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.courseName || ''}
                        onChange={(e) => {
                          handleInputChange('courseName', e.target.value);
                          // Fetch and display course software
                          const selectedCourse = coursesData?.data?.find(course => course.name === e.target.value);
                          if (selectedCourse?.software && Array.isArray(selectedCourse.software) && selectedCourse.software.length > 0) {
                            const courseSoftware = selectedCourse.software as string[];
                            setAvailableSoftwares(courseSoftware);
                            setSelectedSoftwares(courseSoftware);
                          } else {
                            setAvailableSoftwares(ALL_SOFTWARES);
                            setSelectedSoftwares([]);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select course name</option>
                        {Array.from(
                          new Set([
                            // Course names from Course Modules (database)
                            ...(coursesData?.data?.map((course) => course.name) || []),
                            // Legacy course names from Excel (if any)
                            ...(courseNamesData?.data?.courseNames || []),
                          ])
                        )
                          .sort((a, b) => a.localeCompare(b))
                          .map((courseName) => (
                            <option key={courseName} value={courseName}>
                              {courseName}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Batch
                      </label>
                      <select
                        value={formData.batchId?.toString() || ''}
                        onChange={(e) => handleInputChange('batchId', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select a batch (optional)</option>
                        {batches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Softwares Included <span className="text-red-500">*</span>
                      </label>
                      {formData.courseName ? (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-800">
                            ✓ Software automatically loaded from selected course. You can manually select software if course is not selected.
                          </p>
                        </div>
                      ) : (
                        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-xs text-yellow-800">
                            ℹ️ No course selected. You can manually select software from the list below.
                          </p>
                        </div>
                      )}
                      {formData.courseName && availableSoftwares.length === 0 && (
                        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-xs text-red-800">
                            No software found for the selected course
                          </p>
                        </div>
                      )}
                      <div className={`border border-gray-300 rounded-md p-3 md:p-4 max-h-64 overflow-y-auto ${formData.courseName ? 'bg-gray-50' : ''}`}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                          {availableSoftwares.map((software) => (
                            <label 
                              key={software} 
                              className={`flex items-center space-x-2 p-1 md:p-2 rounded text-sm ${formData.courseName ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-gray-50'}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSoftwares.includes(software)}
                                onChange={(e) => {
                                  if (!formData.courseName) {
                                    handleSoftwareChange(software, e.target.checked);
                                  }
                                }}
                                disabled={!!formData.courseName}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className={`text-xs md:text-sm ${formData.courseName ? 'text-gray-500' : 'text-gray-700'}`}>{software}</span>
                            </label>
                          ))}
                          {/* Show "Other" option only when course is NOT selected */}
                          {!formData.courseName && (
                            <label 
                              key="Other" 
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 md:p-2 rounded text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={showOtherSoftwareInput}
                                onChange={(e) => {
                                  setShowOtherSoftwareInput(e.target.checked);
                                }}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                              <span className="text-xs md:text-sm text-gray-700">Other</span>
                            </label>
                          )}
                        </div>
                      </div>
                      {showOtherSoftwareInput && !formData.courseName && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Specify Other Software
                          </label>
                          <input
                            type="text"
                            value={otherSoftware}
                            onChange={(e) => {
                              const value = e.target.value;
                              setOtherSoftware(value);
                              if (value.trim() && !selectedSoftwares.includes(value.trim())) {
                                setSelectedSoftwares(prev => [...prev, value.trim()]);
                              }
                            }}
                            placeholder="Enter software names (comma separated)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        {formData.courseName 
                          ? 'Software is automatically included from the selected course' 
                          : 'Select all applicable software'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Deal Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.totalDeal || ''}
                          onChange={(e) => handleInputChange('totalDeal', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.bookingAmount || ''}
                          onChange={(e) => handleInputChange('bookingAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Balance Amount (₹) <span className="text-xs text-gray-500">(Auto-calculated)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          readOnly
                          value={formData.balanceAmount !== undefined && formData.balanceAmount !== null ? formData.balanceAmount.toFixed(2) : '0.00'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Balance = Total Deal - Booking Amount
                        </p>
                      </div>
                    </div>

                    {/* Add Payment Button */}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          // Pre-fill amount with balance if available
                          if (formData.balanceAmount && formData.balanceAmount > 0) {
                            setNewPayment(prev => ({
                              ...prev,
                              amount: formData.balanceAmount!.toFixed(2),
                            }));
                          }
                          setIsPaymentModalOpen(true);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                      >
                        + Add Payment
                      </button>
                    </div>

                    {/* Payment History - Read Only */}
                    <div className="mt-6 border-t pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
                        <button
                          type="button"
                          onClick={() => refetchPayments()}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          title="Refresh Payments"
                        >
                          🔄 Refresh
                        </button>
                      </div>

                      {!paymentsData ? (
                        <div className="text-center py-4 text-gray-500">Loading payments...</div>
                      ) : (paymentsData as any)?.data?.payments && Array.isArray((paymentsData as any).data.payments) && (paymentsData as any).data.payments.length > 0 ? (
                        <>
                          {/* Payment Summary */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Total Payments</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {(paymentsData as any).data.payments.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                              <p className="text-lg font-semibold text-gray-900">
                                ₹{(paymentsData as any).data.payments.reduce((sum: number, p: PaymentTransaction) => sum + (Number(p.amount) || 0), 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                              <p className="text-lg font-semibold text-green-600">
                                ₹{(paymentsData as any).data.payments.reduce((sum: number, p: PaymentTransaction) => sum + (Number(p.paidAmount) || 0), 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Pending</p>
                              <p className="text-lg font-semibold text-orange-600">
                                ₹{(paymentsData as any).data.payments.reduce((sum: number, p: PaymentTransaction) => {
                                  const amount = Number(p.amount) || 0;
                                  const paid = Number(p.paidAmount) || 0;
                                  return sum + (amount - paid);
                                }, 0).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {/* Payment List */}
                          <div className="space-y-3">
                            {(paymentsData as any).data.payments.map((payment: PaymentTransaction) => {
                            const amount = Number(payment.amount) || 0;
                            const paidAmount = Number(payment.paidAmount) || 0;
                            const pending = amount - paidAmount;
                            
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

                            return (
                              <div key={payment.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Payment ID</p>
                                    <p className="text-sm font-semibold text-gray-900">#{payment.id}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Amount</p>
                                    <p className="text-sm font-semibold text-gray-900">₹{amount.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Paid</p>
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
                                    <p className="text-xs text-gray-500 mb-1">Status</p>
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${getStatusColor(payment.status)}`}>
                                      {payment.status || 'pending'}
                                    </span>
                                  </div>
                                  <div>
                                    {payment.receiptUrl && (
                                      <a
                                        href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${payment.receiptUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                                      >
                                        View Receipt
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {(payment.paymentMethod || payment.transactionId || payment.notes) && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                                    {payment.paymentMethod && <p><strong>Method:</strong> {payment.paymentMethod}</p>}
                                    {payment.transactionId && <p><strong>Transaction ID:</strong> {payment.transactionId}</p>}
                                    {payment.notes && <p><strong>Notes:</strong> {payment.notes}</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500">No payment records found for this student.</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          EMI Plan
                        </label>
                        <select
                          value={formData.emiPlan ? 'yes' : 'no'}
                          onChange={(e) => handleInputChange('emiPlan', e.target.value === 'yes')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          EMI Plan Date
                        </label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={formatDateForInput(formData.emiPlanDate)}
                          onChange={(e) => handleInputChange('emiPlanDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    {/* EMI Installments Table */}
                    {formData.emiPlan && (
                      <div className="mt-6">
                        {/* Total EMI Amount Display */}
                        {formData.balanceAmount && formData.balanceAmount > 0 && (
                          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm font-medium text-blue-900">Balance Amount</p>
                                <p className="text-lg font-bold text-blue-900">₹{formData.balanceAmount.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-blue-900">Total EMI Amount</p>
                                <p className={`text-lg font-bold ${
                                  formData.emiInstallments && formData.emiInstallments.length > 0 && 
                                  formData.emiInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0) > formData.balanceAmount
                                    ? 'text-red-600'
                                    : 'text-blue-900'
                                }`}>
                                  ₹{formData.emiInstallments?.reduce((sum, inst) => sum + (inst.amount || 0), 0).toFixed(2) || '0.00'}
                                </p>
                                {formData.emiInstallments && formData.emiInstallments.length > 0 && 
                                 formData.emiInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0) > formData.balanceAmount && (
                                  <p className="text-xs text-red-600 font-semibold mt-1">⚠ Exceeds Balance!</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              EMI Installments (Month-wise)
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!formData.balanceAmount || formData.balanceAmount <= 0) {
                                  alert('Please enter Total Deal and Booking Amount first to calculate balance');
                                  return;
                                }
                                if (!formData.emiPlanDate) {
                                  alert('Please select EMI Plan Date first');
                                  return;
                                }
                                const balance = Number(formData.balanceAmount);
                                const numberOfInstallments = 10;
                                const installmentAmount = balance / numberOfInstallments;
                                const installments = [];
                                
                                // Get EMI plan date
                                const emiPlanDate = new Date(formData.emiPlanDate);
                                
                                for (let i = 1; i <= numberOfInstallments; i++) {
                                  // Calculate due date: EMI plan date + (i-1) months
                                  const dueDate = new Date(emiPlanDate);
                                  dueDate.setMonth(dueDate.getMonth() + (i - 1));
                                  const dueDateStr = dueDate.toISOString().split('T')[0];
                                  
                                  installments.push({
                                    month: i,
                                    amount: Math.round(installmentAmount * 100) / 100,
                                    dueDate: dueDateStr
                                  });
                                }
                                
                                // Adjust last installment to account for rounding
                                const totalCalculated = installments.reduce((sum, inst) => sum + inst.amount, 0);
                                if (totalCalculated !== balance) {
                                  installments[installments.length - 1].amount = Math.round((balance - (totalCalculated - installments[installments.length - 1].amount)) * 100) / 100;
                                }
                                
                                handleInputChange('emiInstallments', installments);
                                
                                // Clear customized indices when auto-calculating
                                setCustomizedEmiIndices(new Set());
                                // Clear custom date indices when auto-calculating
                                setCustomDateEmiIndices(new Set());
                              }}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                              Auto-Calculate (10 EMIs)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const installments = formData.emiInstallments || [];
                                const nextMonth = installments.length > 0 
                                  ? Math.max(...installments.map(i => i.month)) + 1 
                                  : 1;
                                handleInputChange('emiInstallments', [
                                  ...installments,
                                  { month: nextMonth, amount: 0, dueDate: '' }
                                ]);
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              + Add Installment
                            </button>
                          </div>
                  </div>
                        {formData.emiInstallments && formData.emiInstallments.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Month</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Amount (₹)</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Due Date</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase">Action</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {formData.emiInstallments.map((installment, index) => (
                                  <tr key={index}>
                                    <td className="px-4 py-2">
                                      <input
                                        type="number"
                                        min="1"
                                        value={installment.month}
                                        onChange={(e) => {
                                          const installments = [...(formData.emiInstallments || [])];
                                          installments[index].month = parseInt(e.target.value) || 1;
                                          handleInputChange('emiInstallments', installments);
                                        }}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded-md"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={installment.amount}
                                        onChange={(e) => {
                                          const installments = [...(formData.emiInstallments || [])];
                                          const newAmount = parseFloat(e.target.value) || 0;
                                          
                                          // Mark this installment as customized
                                          setCustomizedEmiIndices(prev => new Set(prev).add(index));
                                          
                                          // Update the customized installment
                                          installments[index].amount = newAmount;
                                          
                                          // If balance amount is available, redistribute remaining balance across non-customized installments
                                          if (formData.balanceAmount && installments.length > 1) {
                                            const balance = Number(formData.balanceAmount);
                                            
                                            // Calculate sum of all customized amounts (including the one just changed)
                                            const customizedTotal = installments.reduce((sum, inst, idx) => {
                                              if (customizedEmiIndices.has(idx) || idx === index) {
                                                return sum + (inst.amount || 0);
                                              }
                                              return sum;
                                            }, 0);
                                            
                                            // Get non-customized installments (excluding all customized ones)
                                            const nonCustomizedIndices = installments
                                              .map((_, idx) => idx)
                                              .filter(idx => idx !== index && !customizedEmiIndices.has(idx));
                                            
                                            if (nonCustomizedIndices.length > 0) {
                                              const remainingBalance = balance - customizedTotal;
                                              
                                              if (remainingBalance >= 0) {
                                                // Distribute remaining balance equally across non-customized installments
                                                const amountPerInstallment = remainingBalance / nonCustomizedIndices.length;
                                                
                                                // Update all non-customized installments with equal amounts
                                                nonCustomizedIndices.forEach(idx => {
                                                  installments[idx].amount = Math.round(amountPerInstallment * 100) / 100;
                                                });
                                                
                                                // Adjust last non-customized installment to account for rounding
                                                const totalCalculated = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
                                                if (totalCalculated !== balance && nonCustomizedIndices.length > 0) {
                                                  const lastNonCustomizedIndex = nonCustomizedIndices[nonCustomizedIndices.length - 1];
                                                  const adjustment = balance - (totalCalculated - installments[lastNonCustomizedIndex].amount);
                                                  installments[lastNonCustomizedIndex].amount = Math.round(adjustment * 100) / 100;
                                                }
                                              }
                                            }
                                          }
                                          
                                          handleInputChange('emiInstallments', installments);
                                        }}
                                        className="w-32 px-2 py-1 border border-gray-300 rounded-md"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="date"
                                          min={new Date().toISOString().split('T')[0]}
                                          value={formatDateForInput(installment.dueDate)}
                                          onChange={(e) => {
                                            const installments = [...(formData.emiInstallments || [])];
                                            const newDate = e.target.value;
                                            installments[index].dueDate = newDate;
                                            
                                            // If not a custom date, update all subsequent dates
                                            if (!customDateEmiIndices.has(index) && newDate) {
                                              const baseDate = new Date(newDate);
                                              for (let i = index + 1; i < installments.length; i++) {
                                                // Skip if this installment has a custom date
                                                if (!customDateEmiIndices.has(i)) {
                                                  const nextDate = new Date(baseDate);
                                                  nextDate.setMonth(nextDate.getMonth() + (i - index));
                                                  installments[i].dueDate = nextDate.toISOString().split('T')[0];
                                                }
                                              }
                                            }
                                            
                                            handleInputChange('emiInstallments', installments);
                                          }}
                                          className="flex-1 px-2 py-1 border border-gray-300 rounded-md"
                                        />
                                        <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                                          <input
                                            type="checkbox"
                                            checked={customDateEmiIndices.has(index)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setCustomDateEmiIndices(prev => new Set(prev).add(index));
                                              } else {
                                                setCustomDateEmiIndices(prev => {
                                                  const newSet = new Set(prev);
                                                  newSet.delete(index);
                                                  return newSet;
                                                });
                                                // If unchecking custom, recalculate from previous installment
                                                const installments = [...(formData.emiInstallments || [])];
                                                if (index > 0 && installments[index - 1]?.dueDate) {
                                                  const prevDate = new Date(installments[index - 1].dueDate as string);
                                                  prevDate.setMonth(prevDate.getMonth() + 1);
                                                  installments[index].dueDate = prevDate.toISOString().split('T')[0];
                                                  
                                                  // Update all subsequent non-custom dates
                                                  for (let i = index + 1; i < installments.length; i++) {
                                                    if (!customDateEmiIndices.has(i)) {
                                                      const nextDate = new Date(prevDate);
                                                      nextDate.setMonth(nextDate.getMonth() + (i - index));
                                                      installments[i].dueDate = nextDate.toISOString().split('T')[0];
                                                    }
                                                  }
                                                  handleInputChange('emiInstallments', installments);
                                                }
                                              }
                                            }}
                                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                            title="Mark as custom date (won't auto-update)"
                                          />
                                          <span>Custom</span>
                                        </label>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const installments = [...(formData.emiInstallments || [])];
                                          installments.splice(index, 1);
                                          
                                          // Remove this index from customized set and adjust other indices
                                          setCustomDateEmiIndices(prev => {
                                            const newSet = new Set<number>();
                                            prev.forEach(customIdx => {
                                              if (customIdx < index) {
                                                newSet.add(customIdx); // Keep indices before removed one
                                              } else if (customIdx > index) {
                                                newSet.add(customIdx - 1); // Shift indices after removed one
                                              }
                                              // Skip the removed index
                                            });
                                            return newSet;
                                          });
                                          setCustomizedEmiIndices(prev => {
                                            const newSet = new Set<number>();
                                            prev.forEach(customIdx => {
                                              if (customIdx < index) {
                                                newSet.add(customIdx); // Keep indices before removed one
                                              } else if (customIdx > index) {
                                                newSet.add(customIdx - 1); // Shift indices after removed one
                                              }
                                              // Skip the removed index itself
                                            });
                                            return newSet;
                                          });
                                          
                                          // Recalculate amounts equally across remaining installments
                                          if (formData.balanceAmount && installments.length > 0) {
                                            const balance = Number(formData.balanceAmount);
                                            const numberOfInstallments = installments.length;
                                            const installmentAmount = balance / numberOfInstallments;
                                            
                                            // Update all remaining installments with equal amounts
                                            installments.forEach((inst) => {
                                              inst.amount = Math.round(installmentAmount * 100) / 100;
                                            });
                                            
                                            // Adjust last installment to account for rounding
                                            const totalCalculated = installments.reduce((sum, inst) => sum + inst.amount, 0);
                                            if (totalCalculated !== balance) {
                                              const lastIndex = installments.length - 1;
                                              const adjustment = balance - (totalCalculated - installments[lastIndex].amount);
                                              installments[lastIndex].amount = Math.round(adjustment * 100) / 100;
                                            }
                                            
                                            // Update month numbers sequentially
                                            installments.forEach((inst, idx) => {
                                              inst.month = idx + 1;
                                            });
                                            
                                            // Update due dates if EMI plan date exists
                                            if (formData.emiPlanDate) {
                                              const emiPlanDate = new Date(formData.emiPlanDate);
                                              installments.forEach((inst, idx) => {
                                                const dueDate = new Date(emiPlanDate);
                                                dueDate.setMonth(dueDate.getMonth() + idx);
                                                inst.dueDate = dueDate.toISOString().split('T')[0];
                                              });
                                            }
                                          }
                                          
                                          handleInputChange('emiInstallments', installments);
                                        }}
                                        className="px-2 py-1 text-sm text-red-600 hover:text-red-800"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No installments added. Click "Add Installment" to add month-wise EMI details.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Additional Information */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Additional Information</h2>
                  
                  <div className="space-y-4 md:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Complimentary Software
                        </label>
                        <div className="border border-gray-300 rounded-md p-3 max-h-56 overflow-y-auto">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ALL_SOFTWARES.map((software) => (
                              <label
                                key={software}
                                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                              >
                                <input
                                  type="checkbox"
                                  value={software}
                                  checked={(formData.complimentarySoftware || '')
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                    .includes(software)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const current = (formData.complimentarySoftware || '')
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                    const next = checked
                                      ? Array.from(new Set([...current, software]))
                                      : current.filter((s) => s !== software);
                                    handleInputChange('complimentarySoftware', next.join(', '));
                                  }}
                                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700">{software}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Select all complimentary software given to the student.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Complimentary Gift
                        </label>
                        <input
                          type="text"
                          value={formData.complimentaryGift || ''}
                          onChange={(e) => handleInputChange('complimentaryGift', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Has Reference
                      </label>
                      <select
                        value={formData.hasReference ? 'yes' : 'no'}
                        onChange={(e) => handleInputChange('hasReference', e.target.value === 'yes')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference Details
                      </label>
                      <textarea
                        rows={3}
                        value={formData.referenceDetails || ''}
                        onChange={(e) => handleInputChange('referenceDetails', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Employee Name
                        </label>
                        <select
                          value={formData.counselorName || ''}
                          onChange={(e) => handleInputChange('counselorName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Select employee</option>
                          {employeesData?.data?.users?.map((employee) => (
                            <option key={employee.id} value={employee.name}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lead Source
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={formData.leadSource || ''}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              handleInputChange('leadSource', selectedValue);
                              
                              // Auto-fill current date when Walk-in is selected and date is empty
                              if (selectedValue === 'Walk-in' && (!formData.walkinDate || !formData.walkinDate.trim())) {
                                const today = new Date();
                                const todayYYYYMMDD = today.toISOString().split('T')[0];
                                handleInputChange('walkinDate', todayYYYYMMDD);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">Select lead source</option>
                            {leadSources.map((source) => (
                              <option key={source} value={source}>
                                {source}
                              </option>
                            ))}
                          </select>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLeadSource(null);
                                setNewLeadSourceName('');
                                setShowLeadSourceModal(true);
                              }}
                              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                              title="Manage Lead Sources"
                            >
                              ⚙️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Walk-in Date
                          {formData.leadSource === 'Walk-in' && <span className="text-xs text-gray-500 ml-1">(Auto-filled if not entered)</span>}
                        </label>
                        <input
                          type="date"
                          value={formatDateForInput(formData.walkinDate)}
                          onChange={(e) => handleInputChange('walkinDate', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Faculty
                        </label>
                        <select
                          value={formData.masterFaculty || ''}
                          onChange={(e) => handleInputChange('masterFaculty', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Select faculty</option>
                          {facultyData?.data?.users?.map((faculty) => (
                            <option key={faculty.id} value={faculty.name}>
                              {faculty.name}
                            </option>
                          )) || facultyData?.data?.faculty?.map((faculty) => (
                            <option key={faculty.id} value={faculty.name}>
                              {faculty.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Documents Upload Section */}
                    <div className="border-t pt-6 mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Documents</h3>
                      <div className="space-y-6">
                        {/* Photo Upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Photo <span className="text-xs text-gray-500">(JPG, PNG, PDF)</span>
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handlePhotoUpload}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            disabled={uploadingPhoto}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                          />
                          {uploadingPhoto && (
                            <p className="mt-2 text-sm text-blue-600">Uploading photo...</p>
                          )}
                          {photo && (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0">
                                    {photo.url.toLowerCase().endsWith('.pdf') ? (
                                      <span className="text-2xl">📄</span>
                                    ) : (
                                      <span className="text-2xl">🖼️</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{photo.name}</p>
                                    {photo.size && (
                                      <p className="text-xs text-gray-500">
                                        {(photo.size / 1024).toFixed(2)} KB
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <a
                                    href={getImageUrl(photo.url) || photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                  >
                                    View
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setPhoto(null)}
                                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* PAN Card Upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            PAN Card <span className="text-xs text-gray-500">(JPG, PNG, PDF)</span>
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handlePanCardUpload}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            disabled={uploadingPanCard}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                          />
                          {uploadingPanCard && (
                            <p className="mt-2 text-sm text-blue-600">Uploading PAN Card...</p>
                          )}
                          {panCard && (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0">
                                    {panCard.url.toLowerCase().endsWith('.pdf') ? (
                                      <span className="text-2xl">📄</span>
                                    ) : (
                                      <span className="text-2xl">🖼️</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{panCard.name}</p>
                                    {panCard.size && (
                                      <p className="text-xs text-gray-500">
                                        {(panCard.size / 1024).toFixed(2)} KB
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <a
                                    href={getImageUrl(panCard.url) || panCard.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                  >
                                    View
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setPanCard(null)}
                                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Aadhar Card Upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Aadhar Card <span className="text-xs text-gray-500">(JPG, PNG, PDF)</span>
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleAadharCardUpload}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            disabled={uploadingAadharCard}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                          />
                          {uploadingAadharCard && (
                            <p className="mt-2 text-sm text-blue-600">Uploading Aadhar Card...</p>
                          )}
                          {aadharCard && (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0">
                                    {aadharCard.url.toLowerCase().endsWith('.pdf') ? (
                                      <span className="text-2xl">📄</span>
                                    ) : (
                                      <span className="text-2xl">🖼️</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{aadharCard.name}</p>
                                    {aadharCard.size && (
                                      <p className="text-xs text-gray-500">
                                        {(aadharCard.size / 1024).toFixed(2)} KB
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <a
                                    href={getImageUrl(aadharCard.url) || aadharCard.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                  >
                                    View
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setAadharCard(null)}
                                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Other Documents Upload (Multiple) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Other Documents <span className="text-xs text-gray-500">(Multiple files - JPG, PNG, PDF)</span>
                          </label>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleOtherDocumentsUpload}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            disabled={uploadingOtherDocs}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            You can upload multiple files. Supported formats: PDF, JPG, PNG (Max 10MB per file)
                          </p>
                          {uploadingOtherDocs && (
                            <p className="mt-2 text-sm text-blue-600">Uploading documents...</p>
                          )}
                          {otherDocuments.length > 0 && (
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Uploaded Other Documents ({otherDocuments.length})
                              </label>
                              <div className="space-y-2">
                                {otherDocuments.map((doc, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md"
                                  >
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                      <div className="flex-shrink-0">
                                        {doc.url.toLowerCase().endsWith('.pdf') ? (
                                          <span className="text-2xl">📄</span>
                                        ) : (
                                          <span className="text-2xl">🖼️</span>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                                        {doc.size && (
                                          <p className="text-xs text-gray-500">
                                            {(doc.size / 1024).toFixed(2)} KB
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <a
                                        href={getImageUrl(doc.url) || doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                                      >
                                        View
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveOtherDocument(index)}
                                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 md:mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="w-full sm:w-auto px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Create a synthetic form event to call handleSubmit
                      const form = e.currentTarget.closest('form');
                      if (form) {
                        const syntheticEvent = {
                          preventDefault: () => {},
                          currentTarget: form,
                          target: form,
                        } as unknown as React.FormEvent<HTMLFormElement>;
                        handleSubmit(syntheticEvent);
                      }
                    }}
                    disabled={updateUserMutation.isPending || updateStudentProfileMutation.isPending}
                    className="w-full sm:w-auto px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateUserMutation.isPending || updateStudentProfileMutation.isPending ? 'Saving...' : 'Save All Changes'}
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Lead Source Management Modal */}
          {showLeadSourceModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Manage Lead Sources
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeadSourceModal(false);
                      setEditingLeadSource(null);
                      setNewLeadSourceName('');
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                  >
                    ×
                  </button>
                </div>

                {/* Add/Edit Form */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {editingLeadSource ? 'Edit Lead Source' : 'Add New Lead Source'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLeadSourceName}
                      onChange={(e) => setNewLeadSourceName(e.target.value)}
                      placeholder="Enter lead source name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newLeadSourceName.trim()) {
                            if (editingLeadSource) {
                              // Update existing lead source
                              setLeadSources(prev => 
                                prev.map(s => s === editingLeadSource ? newLeadSourceName.trim() : s)
                              );
                              if (formData.leadSource === editingLeadSource) {
                                handleInputChange('leadSource', newLeadSourceName.trim());
                              }
                            } else {
                              // Add new lead source
                              if (!leadSources.includes(newLeadSourceName.trim())) {
                                setLeadSources(prev => [...prev, newLeadSourceName.trim()]);
                              }
                            }
                            setEditingLeadSource(null);
                            setNewLeadSourceName('');
                          }
                        } else if (e.key === 'Escape') {
                          setEditingLeadSource(null);
                          setNewLeadSourceName('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newLeadSourceName.trim()) {
                          if (editingLeadSource) {
                            // Update existing lead source
                            setLeadSources(prev => 
                              prev.map(s => s === editingLeadSource ? newLeadSourceName.trim() : s)
                            );
                            if (formData.leadSource === editingLeadSource) {
                              handleInputChange('leadSource', newLeadSourceName.trim());
                            }
                          } else {
                            // Add new lead source
                            if (!leadSources.includes(newLeadSourceName.trim())) {
                              setLeadSources(prev => [...prev, newLeadSourceName.trim()]);
                            }
                          }
                          setEditingLeadSource(null);
                          setNewLeadSourceName('');
                        }
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    >
                      {editingLeadSource ? 'Update' : 'Add'}
                    </button>
                    {editingLeadSource && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLeadSource(null);
                          setNewLeadSourceName('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* List of Lead Sources */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    All Lead Sources ({leadSources.length})
                  </label>
                  {leadSources.length === 0 ? (
                    <p className="text-sm text-gray-500 italic p-4 text-center">No lead sources added yet</p>
                  ) : (
                    <div className="border border-gray-300 rounded-md divide-y divide-gray-200 max-h-64 overflow-y-auto">
                      {leadSources.map((source) => (
                        <div
                          key={source}
                          className="flex items-center justify-between p-3 hover:bg-gray-50"
                        >
                          <span className="text-sm text-gray-900 flex-1">{source}</span>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLeadSource(source);
                                  setNewLeadSourceName(source);
                                }}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                title="Edit"
                              >
                                ✎ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${source}"?`)) {
                                  setLeadSources(prev => prev.filter(s => s !== source));
                                  if (formData.leadSource === source) {
                                    handleInputChange('leadSource', '');
                                  }
                                  if (editingLeadSource === source) {
                                    setEditingLeadSource(null);
                                    setNewLeadSourceName('');
                                  }
                                }
                                }}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                                title="Delete"
                              >
                                × Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeadSourceModal(false);
                      setEditingLeadSource(null);
                      setNewLeadSourceName('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Payment Modal */}
          {isPaymentModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create Payment</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      setNewPayment({
                        amount: '',
                        dueDate: '',
                        paymentMethod: '',
                        transactionId: '',
                        notes: '',
                      });
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreatePayment}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Enrollment (Optional)
                      </label>
                      <select
                        id="paymentEnrollmentId"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">No enrollment (Manual payment)</option>
                        {enrollmentsData?.data?.map((enrollment: any) => {
                          const isException = enrollment.status === 'exception' || enrollment.enrollmentStatus === 'exception';
                          return (
                            <option key={enrollment.id} value={enrollment.id}>
                              {enrollment.batch?.title || `Enrollment #${enrollment.id}`}
                              {isException ? ' (Exception)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={newPayment.dueDate}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={newPayment.paymentMethod}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select payment method</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Debit Card">Debit Card</option>
                        <option value="Online">Online</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction ID
                      </label>
                      <input
                        type="text"
                        value={newPayment.transactionId}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, transactionId: e.target.value }))}
                        placeholder="Enter transaction ID or reference number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        rows={3}
                        value={newPayment.notes}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional notes about this payment"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaymentModalOpen(false);
                        setNewPayment({
                          amount: '',
                          dueDate: '',
                          paymentMethod: '',
                          transactionId: '',
                          notes: '',
                        });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createPaymentMutation.isPending}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                    >
                      {createPaymentMutation.isPending ? 'Creating...' : 'Create Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
