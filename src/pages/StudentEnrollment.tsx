import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { studentAPI, CompleteEnrollmentRequest } from '../api/student.api';
import { batchAPI, Batch } from '../api/batch.api';
import { formatDateDDMMYYYY, formatDateInputToDDMMYYYY, convertDDMMYYYYToYYYYMMDD, isValidDDMMYYYY, isValidPhone, isValidEmail } from '../utils/dateUtils';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import { employeeAPI } from '../api/employee.api';
import { facultyAPI } from '../api/faculty.api';
import { courseAPI } from '../api/course.api';
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

export const StudentEnrollment: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [showOtherSoftwareInput, setShowOtherSoftwareInput] = useState(false);
  const [otherSoftware, setOtherSoftware] = useState('');
  const [selectedSoftwares, setSelectedSoftwares] = useState<string[]>([]);
  const [complimentarySelectedSoftwares, setComplimentarySelectedSoftwares] = useState<string[]>([]);
  const [suggestedBatches, setSuggestedBatches] = useState<Batch[]>([]);
  const [availableSoftwares, setAvailableSoftwares] = useState<string[]>(ALL_SOFTWARES); // Software options based on selected course
  
  // Form data state to preserve values across steps
  // Store dates in DD/MM/YYYY format for display
  const [formData, setFormData] = useState<Partial<CompleteEnrollmentRequest>>({
    emiInstallments: [],
  });
  const [dateOfAdmissionDDMMYYYY, setDateOfAdmissionDDMMYYYY] = useState<string>('');
  const [dateOfAdmissionYYYYMMDD, setDateOfAdmissionYYYYMMDD] = useState<string>('');
  const [emiPlanDateDDMMYYYY, setEmiPlanDateDDMMYYYY] = useState<string>('');
  const [emiPlanDateYYYYMMDD, setEmiPlanDateYYYYMMDD] = useState<string>('');
  const [walkinDateDDMMYYYY, setWalkinDateDDMMYYYY] = useState<string>('');
  const [walkinDateYYYYMMDD, setWalkinDateYYYYMMDD] = useState<string>('');
  const [emiInstallmentDates, setEmiInstallmentDates] = useState<{ [key: number]: string }>({});
  const [customizedEmiIndices, setCustomizedEmiIndices] = useState<Set<number>>(new Set()); // Track which EMIs have been manually customized
  const [customDateEmiIndices, setCustomDateEmiIndices] = useState<Set<number>>(new Set()); // Track which EMIs have custom dates
  const [whatsappCountryCode, setWhatsappCountryCode] = useState<string>('+91'); // Default to India
  const [isPhoneWhatsApp, setIsPhoneWhatsApp] = useState<boolean>(false); // Checkbox state for phone = WhatsApp
  const [uploadedDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  const [photo, setPhoto] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [panCard, setPanCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [aadharCard, setAadharCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [otherDocuments, setOtherDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingPanCard, setUploadingPanCard] = useState(false);
  const [uploadingAadharCard, setUploadingAadharCard] = useState(false);
  const [uploadingOtherDocs, setUploadingOtherDocs] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [showLeadSourceModal, setShowLeadSourceModal] = useState(false);
  const [editingLeadSource, setEditingLeadSource] = useState<string | null>(null);
  const [newLeadSourceName, setNewLeadSourceName] = useState('');
  const [leadSources, setLeadSources] = useState<string[]>(['Walk-in', 'Online', 'Reference', 'Social Media', 'Advertisement', 'Other']);
  
  // Common country codes
  const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+974', country: 'Qatar', flag: '🇶🇦' },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+27', country: 'South Africa', flag: '🇿🇦' },
    { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
    { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
    { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
    { code: '+977', country: 'Nepal', flag: '🇳🇵' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+82', country: 'South Korea', flag: '🇰🇷' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+39', country: 'Italy', flag: '🇮🇹' },
    { code: '+34', country: 'Spain', flag: '🇪🇸' },
    { code: '+7', country: 'Russia', flag: '🇷🇺' },
  ];
  
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
    if (formData.emiPlan && formData.balanceAmount && formData.balanceAmount > 0) {
      const balance = Number(formData.balanceAmount);
      
      // Always recalculate installments with equal amounts when balance changes or EMI plan is enabled
      // Default: 10 installments
      const numberOfInstallments = 10;
      const installmentAmount = balance / numberOfInstallments;
      const installments: Array<{ month: number; amount: number; dueDate: string }> = [];
      
      // Get EMI plan date or use today's date
      const emiPlanDate = emiPlanDateYYYYMMDD ? new Date(emiPlanDateYYYYMMDD) : new Date();
      
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
      
      setFormData(prev => ({ ...prev, emiInstallments: installments }));
      
      // Also update the DDMMYYYY format dates for display
      const datesObj: { [key: number]: string } = {};
      installments.forEach((inst, idx) => {
        if (inst.dueDate) {
          datesObj[idx] = formatDateInputToDDMMYYYY(inst.dueDate);
        }
      });
      setEmiInstallmentDates(datesObj);
    } else if (!formData.emiPlan && formData.emiInstallments && formData.emiInstallments.length > 0) {
      // Clear installments when EMI plan is disabled
      setFormData(prev => ({ ...prev, emiInstallments: [] }));
      setEmiInstallmentDates({});
    }
  }, [formData.emiPlan, formData.balanceAmount, emiPlanDateYYYYMMDD]);

  // Update form data when input changes
  const handleInputChange = (field: keyof CompleteEnrollmentRequest, value: any) => {
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
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };



  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid file (JPG, PNG, or PDF)');
      e.target.value = '';
      return;
    }

    setUploadingPhoto(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const uploadedFile = uploadResponse.data.files[0];
        // Clean the URL before saving to remove any duplicate domain issues
        const cleanedUrl = getImageUrl(uploadedFile.url) || uploadedFile.url;
        setPhoto({
          name: uploadedFile.originalName,
          url: cleanedUrl,
          size: uploadedFile.size,
        });
        alert('Photo uploaded successfully!');
      } else {
        throw new Error('No file returned from upload');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      alert(error.response?.data?.message || error.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Handle PAN Card upload
  const handlePanCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
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
        // Clean the URL before saving to remove any duplicate domain issues
        const cleanedUrl = getImageUrl(uploadedFile.url) || uploadedFile.url;
        setPanCard({
          name: uploadedFile.originalName,
          url: cleanedUrl,
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

    // Validate file type
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
        // Clean the URL before saving to remove any duplicate domain issues
        const cleanedUrl = getImageUrl(uploadedFile.url) || uploadedFile.url;
        setAadharCard({
          name: uploadedFile.originalName,
          url: cleanedUrl,
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

    // Validate file types
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
        const newDocuments = uploadResponse.data.files.map((file) => {
          // Clean the URL before saving to remove any duplicate domain issues
          const cleanedUrl = getImageUrl(file.url) || file.url;
          return {
            name: file.originalName,
            url: cleanedUrl,
            size: file.size,
          };
        });
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

// Fetch batches for enrollment
const { data: batchesData } = useQuery({
  queryKey: ['batches'],
  queryFn: () => batchAPI.getAllBatches(),
});

// Fetch employees for dropdown
// Fetch course names from Excel (legacy source)
const { data: courseNamesData } = useQuery({
  queryKey: ['courseNames'],
  queryFn: () => studentAPI.getCourseNames(),
});

// Fetch course names from Course Modules (database)
const { data: coursesData } = useQuery({
  queryKey: ['courses'],
  queryFn: () => courseAPI.getAllCourses(),
});

const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeAPI.getAllEmployees(),
  });

  // Fetch faculty for dropdown
  const { data: facultyData } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => facultyAPI.getAllFaculty(),
  });

  const enrollmentMutation = useMutation({
    mutationFn: (data: CompleteEnrollmentRequest) => studentAPI.completeEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      alert('Student enrolled successfully!');
      navigate('/students');
    },
    onError: (error: any) => {
      const errorData = error.response?.data;
      const statusCode = error.response?.status;
      
      console.error('Enrollment error:', error);
      console.error('Error status:', statusCode);
      console.error('Error response:', errorData);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // Check if it's a validation error (400 Bad Request)
      if (statusCode === 400 && errorData?.errors && Array.isArray(errorData.errors)) {
        const validationErrors = errorData.errors;
        const errorMessage = errorData.message || 'Validation failed';
        const errorDetails = validationErrors.length > 0 
          ? `\n\nPlease fix the following errors:\n${validationErrors.map((err: string, idx: number) => `${idx + 1}. ${err}`).join('\n')}`
          : '';
        alert(errorMessage + errorDetails);
        return;
      }
      
      // Check if it's a duplicate email/phone error (409 Conflict)
      if (statusCode === 409) {
        const errorMessage = errorData?.message || error.message || 'Failed to enroll student.';
        const existingStudentId = errorData?.existingStudentId;
        const existingStudentName = errorData?.existingStudentName || 'the student';
        
        if (existingStudentId) {
          const shouldEdit = window.confirm(
            `${errorMessage}\n\n` +
            `Existing Student: ${existingStudentName}\n` +
            `Would you like to edit this student's profile instead?`
          );
          
          if (shouldEdit) {
            navigate(`/students/${existingStudentId}/edit`);
          }
          // If user clicks Cancel, they stay on the enrollment form
        } else {
          // 409 but no student ID - show error anyway
          alert(errorMessage);
        }
      } else {
        // Other errors
        const errorMessage = errorData?.message || error.message || 'Failed to enroll student. Please check all required fields.';
        alert(errorMessage);
      }
    },
  });

  const batches = batchesData?.data || [];

  // Filter batches based on selected software
  useEffect(() => {
    if (selectedSoftwares.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const suggested = batches.filter(batch => {
        // Check if batch hasn't started yet
        const batchStartDate = new Date(batch.startDate);
        batchStartDate.setHours(0, 0, 0, 0);
        if (batchStartDate < today) return false;
        
        // Check if batch software matches any selected software
        if (batch.software) {
          const batchSoftwareLower = batch.software.toLowerCase();
          return selectedSoftwares.some(sw => 
            batchSoftwareLower.includes(sw.toLowerCase()) || 
            sw.toLowerCase().includes(batchSoftwareLower)
          );
        }
        return false;
      });
      
      setSuggestedBatches(suggested);
    } else {
      setSuggestedBatches([]);
    }
  }, [selectedSoftwares, batches]);

  const handleSoftwareChange = (software: string, checked: boolean) => {
    if (checked) {
      setSelectedSoftwares(prev => [...prev, software]);
    } else {
      setSelectedSoftwares(prev => prev.filter(s => s !== software));
    }
  };

  // Keep complimentary software field in sync with complimentary selection
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      complimentarySoftware: complimentarySelectedSoftwares.length
        ? complimentarySelectedSoftwares.join(', ')
        : '',
    }));
  }, [complimentarySelectedSoftwares]);

  const validateAllFields = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    // Required fields validation
    if (!formData.studentName || !formData.studentName.trim()) {
      errors.studentName = 'Student Name is required';
    }
    
    if (!formData.email || !formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.phone || !formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!isValidPhone(formData.phone)) {
      errors.phone = 'Please enter a valid 10-digit phone number';
    }
    
    // Validate WhatsApp number (required field)
    if (!formData.whatsappNumber || !formData.whatsappNumber.trim()) {
      errors.whatsappNumber = 'WhatsApp number is required';
    } else {
      // For India (+91), validate 10 digits
      if (whatsappCountryCode === '+91') {
        if (!isValidPhone(formData.whatsappNumber)) {
          errors.whatsappNumber = 'Please enter a valid 10-digit WhatsApp number';
        }
      } else {
        // For other countries, just check if it's not empty and has reasonable length
        const cleaned = formData.whatsappNumber.replace(/\D/g, '');
        if (cleaned.length < 7 || cleaned.length > 15) {
          errors.whatsappNumber = 'Please enter a valid phone number';
        }
      }
    }
    
    if (!dateOfAdmissionYYYYMMDD || !dateOfAdmissionYYYYMMDD.trim()) {
      errors.dateOfAdmission = 'Date of Admission is required';
    }
    
    if (!formData.localAddress || !formData.localAddress.trim()) {
      errors.localAddress = 'Local Address is required';
    }
    
    if (!formData.permanentAddress || !formData.permanentAddress.trim()) {
      errors.permanentAddress = 'Permanent Address is required';
    }
    
    if (!formData.emergencyContactNumber || !formData.emergencyContactNumber.trim()) {
      errors.emergencyContactNumber = 'Emergency Contact Number is required';
    } else if (!isValidPhone(formData.emergencyContactNumber)) {
      errors.emergencyContactNumber = 'Please enter a valid 10-digit phone number';
    }
    
    if (!formData.emergencyName || !formData.emergencyName.trim()) {
      errors.emergencyName = 'Emergency Contact Name is required';
    }
    
    if (!formData.emergencyRelation || !formData.emergencyRelation.trim()) {
      errors.emergencyRelation = 'Emergency Contact Relation is required';
    }
    
    if (!formData.courseName || !formData.courseName.trim()) {
      errors.courseName = 'Course Name is required';
    }
    
    if (selectedSoftwares.length === 0 && !otherSoftware.trim()) {
      errors.softwaresIncluded = 'At least one software must be selected';
    }
    
    if (!formData.totalDeal || formData.totalDeal <= 0) {
      errors.totalDeal = 'Total Deal Amount is required and must be greater than 0';
    }
    
    if (!formData.bookingAmount || formData.bookingAmount < 0) {
      errors.bookingAmount = 'Booking Amount is required';
    }
    
    if (formData.totalDeal && formData.bookingAmount && formData.bookingAmount > formData.totalDeal) {
      errors.bookingAmount = 'Booking Amount cannot be greater than Total Deal Amount';
    }
    
      if (formData.emiPlan) {
        if (!emiPlanDateYYYYMMDD || !emiPlanDateYYYYMMDD.trim()) {
          errors.emiPlanDate = 'EMI Plan Date is required when EMI Plan is selected';
        }
        
        if (formData.emiInstallments && formData.emiInstallments.length > 0) {
          const totalEMI = formData.emiInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
          const balance = formData.balanceAmount || 0;
          
          if (totalEMI > balance) {
            errors.emiInstallments = `Total EMI amount (₹${totalEMI.toFixed(2)}) cannot exceed Balance Amount (₹${balance.toFixed(2)})`;
          }
          
          formData.emiInstallments.forEach((inst, idx) => {
            if (!inst.amount || inst.amount <= 0) {
              errors[`emiInstallment_${idx}_amount`] = 'Installment amount is required';
            }
            if (inst.dueDate) {
              const dueDateDDMMYYYY = emiInstallmentDates[idx];
              if (dueDateDDMMYYYY && !isValidDDMMYYYY(dueDateDDMMYYYY)) {
                errors[`emiInstallment_${idx}_dueDate`] = 'Please enter a valid date in DD/MM/YYYY format';
              }
            }
          });
        }
      }
    
    if (!formData.counselorName || !formData.counselorName.trim()) {
      errors.counselorName = 'Employee Name is required';
    }
    
    if (!formData.leadSource || !formData.leadSource.trim()) {
      errors.leadSource = 'Lead Source is required';
    }
    
    // Auto-fill current date if Walk-in is selected and date is empty
    if (formData.leadSource === 'Walk-in' && (!walkinDateYYYYMMDD || !walkinDateYYYYMMDD.trim())) {
      const today = new Date();
      const todayYYYYMMDD = today.toISOString().split('T')[0];
      setWalkinDateYYYYMMDD(todayYYYYMMDD);
      const formatted = formatDateInputToDDMMYYYY(todayYYYYMMDD);
      setWalkinDateDDMMYYYY(formatted);
      // Don't show error, date is auto-filled
    }
    
    if (!formData.masterFaculty || !formData.masterFaculty.trim()) {
      errors.masterFaculty = 'Faculty is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate totalDeal first - it's COMPULSORY and cannot be bypassed
    if (!formData.totalDeal || formData.totalDeal <= 0) {
      setCurrentStep(3); // Go to step 3 where totalDeal field is
      setValidationErrors({ totalDeal: 'Total Deal Amount is required and must be greater than 0. Student registration cannot proceed without a deal amount.' });
      alert('Total Deal Amount is required. Please enter a valid deal amount to proceed with student registration.');
      return;
    }
    
    // Validate all required fields
    if (!validateAllFields()) {
      // Find the first step with errors
      let errorStep = 1;
      if (validationErrors.courseName || validationErrors.softwaresIncluded || validationErrors.totalDeal || validationErrors.bookingAmount) {
        errorStep = 3;
      } else if (validationErrors.localAddress || validationErrors.permanentAddress || validationErrors.emergencyContactNumber) {
        errorStep = 2;
      } else if (validationErrors.counselorName || validationErrors.leadSource || validationErrors.masterFaculty) {
        errorStep = 4;
      }
      setCurrentStep(errorStep);
      alert('Please fill all required fields correctly');
      return;
    }
    
    // Get all selected software checkboxes from state
    let softwaresList = [...selectedSoftwares];
    
    // Add other software if specified
    if (showOtherSoftwareInput && otherSoftware.trim()) {
      const otherSoftwareList = otherSoftware.split(',').map(s => s.trim()).filter(s => s.length > 0);
      softwaresList = [...softwaresList, ...otherSoftwareList];
    }
    
    // Remove duplicates and ensure software list is properly formatted
    softwaresList = [...new Set(softwaresList.filter(s => s && s.trim().length > 0))];
    const softwaresIncluded = softwaresList.length > 0 ? softwaresList.join(', ') : '';
    
    console.log('Selected software list:', softwaresList);
    console.log('Formatted software string:', softwaresIncluded);
    
    // Use YYYY-MM-DD dates for API (already in correct format from date picker)
    const dateOfAdmission = dateOfAdmissionYYYYMMDD;
    const emiPlanDate = emiPlanDateYYYYMMDD || undefined;
    const walkinDate = walkinDateYYYYMMDD || undefined;
    
    // Convert EMI installment dates
    const emiInstallments = formData.emiInstallments?.map((inst, idx) => ({
      ...inst,
      dueDate: emiInstallmentDates[idx] ? convertDDMMYYYYToYYYYMMDD(emiInstallmentDates[idx]) : undefined,
    }));
    
    // Combine form data with software list, ensuring required fields are present
    const data: CompleteEnrollmentRequest = {
      studentName: formData.studentName!.trim(),
      email: formData.email!.trim(),
      phone: formData.phone!.trim(),
      whatsappNumber: formData.whatsappNumber?.trim() 
        ? `${whatsappCountryCode}${formData.whatsappNumber.trim()}` 
        : undefined,
      dateOfAdmission: dateOfAdmission,
      localAddress: formData.localAddress!.trim(),
      permanentAddress: formData.permanentAddress!.trim(),
      emergencyContactNumber: formData.emergencyContactNumber!.trim(),
      emergencyName: formData.emergencyName!.trim(),
      emergencyRelation: formData.emergencyRelation!.trim(),
      courseName: formData.courseName!.trim(),
      batchId: formData.batchId || undefined,
      softwaresIncluded: softwaresIncluded || undefined,
      totalDeal: formData.totalDeal!, // Required - validated above, cannot be 0 or undefined
      bookingAmount: formData.bookingAmount!,
      balanceAmount: formData.balanceAmount || undefined,
      emiPlan: formData.emiPlan || false,
      emiPlanDate: emiPlanDate,
      emiInstallments: emiInstallments,
      complimentarySoftware: formData.complimentarySoftware?.trim() || undefined,
      complimentaryGift: formData.complimentaryGift?.trim() || undefined,
      hasReference: formData.hasReference || false,
      referenceDetails: formData.referenceDetails?.trim() || undefined,
      counselorName: formData.counselorName!.trim(),
      leadSource: formData.leadSource!,
      walkinDate: walkinDate,
      masterFaculty: formData.masterFaculty!.trim(),
      enrollmentDocuments: [
        ...(photo ? [photo.url] : []),
        ...(panCard ? [panCard.url] : []),
        ...(aadharCard ? [aadharCard.url] : []),
        ...otherDocuments.map(doc => doc.url),
        ...uploadedDocuments.map(doc => doc.url),
      ].length > 0 ? [
        ...(photo ? [photo.url] : []),
        ...(panCard ? [panCard.url] : []),
        ...(aadharCard ? [aadharCard.url] : []),
        ...otherDocuments.map(doc => doc.url),
        ...uploadedDocuments.map(doc => doc.url),
      ] : undefined,
    };

    console.log('Submitting enrollment data:', data);
    enrollmentMutation.mutate(data);
  };

  const nextStep = () => {
    // Validate required fields before proceeding to next step
    const errors: { [key: string]: string } = {};
    
    if (currentStep === 1) {
      if (!formData.studentName || !formData.studentName.trim()) {
        errors.studentName = 'Student Name is required';
      }
      if (!formData.email || !formData.email.trim()) {
        errors.email = 'Email is required';
      } else if (!isValidEmail(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
      if (!formData.phone || !formData.phone.trim()) {
        errors.phone = 'Phone number is required';
      } else if (!isValidPhone(formData.phone)) {
        errors.phone = 'Please enter a valid 10-digit phone number';
      }
      // Validate WhatsApp number if provided (optional field)
      if (formData.whatsappNumber && formData.whatsappNumber.trim()) {
        // For India (+91), validate 10 digits
        if (whatsappCountryCode === '+91') {
          if (!isValidPhone(formData.whatsappNumber)) {
            errors.whatsappNumber = 'Please enter a valid 10-digit WhatsApp number';
          }
        } else {
          // For other countries, just check if it's not empty and has reasonable length
          const cleaned = formData.whatsappNumber.replace(/\D/g, '');
          if (cleaned.length < 7 || cleaned.length > 15) {
            errors.whatsappNumber = 'Please enter a valid phone number';
          }
        }
      }
      if (!dateOfAdmissionYYYYMMDD || !dateOfAdmissionYYYYMMDD.trim()) {
        errors.dateOfAdmission = 'Date of Admission is required';
      }
    } else if (currentStep === 2) {
      if (!formData.localAddress || !formData.localAddress.trim()) {
        errors.localAddress = 'Local Address is required';
      }
      if (!formData.permanentAddress || !formData.permanentAddress.trim()) {
        errors.permanentAddress = 'Permanent Address is required';
      }
      if (!formData.emergencyContactNumber || !formData.emergencyContactNumber.trim()) {
        errors.emergencyContactNumber = 'Emergency Contact Number is required';
      } else if (!isValidPhone(formData.emergencyContactNumber)) {
        errors.emergencyContactNumber = 'Please enter a valid 10-digit phone number';
      }
      if (!formData.emergencyName || !formData.emergencyName.trim()) {
        errors.emergencyName = 'Emergency Contact Name is required';
      }
      if (!formData.emergencyRelation || !formData.emergencyRelation.trim()) {
        errors.emergencyRelation = 'Emergency Contact Relation is required';
      }
    } else if (currentStep === 3) {
      if (!formData.courseName || !formData.courseName.trim()) {
        errors.courseName = 'Course Name is required';
      }
      if (selectedSoftwares.length === 0 && !otherSoftware.trim()) {
        errors.softwaresIncluded = 'At least one software must be selected';
      }
      if (!formData.totalDeal || formData.totalDeal <= 0) {
        errors.totalDeal = 'Total Deal Amount is required and must be greater than 0';
      }
      if (!formData.bookingAmount || formData.bookingAmount < 0) {
        errors.bookingAmount = 'Booking Amount is required';
      }
      if (formData.totalDeal && formData.bookingAmount) {
        if (formData.bookingAmount > formData.totalDeal) {
          errors.bookingAmount = 'Booking Amount cannot be greater than Total Deal Amount';
        }
        // Auto-calculate balance for validation
        const calculatedBalance = formData.totalDeal - formData.bookingAmount;
        if (calculatedBalance < 0) {
          errors.balanceAmount = 'Balance cannot be negative';
        }
      }
      if (formData.emiPlan) {
        if (!emiPlanDateYYYYMMDD || !emiPlanDateYYYYMMDD.trim()) {
          errors.emiPlanDate = 'EMI Plan Date is required when EMI Plan is selected';
        }
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      alert('Please fill all required fields correctly before proceeding');
      return;
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Student Enrollment Form</h1>
            <p className="mt-2 text-sm md:text-base text-orange-100">Complete student registration and enrollment</p>
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="studentName"
                        required
                        value={formData.studentName || ''}
                        onChange={(e) => handleInputChange('studentName', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.studentName 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                      />
                      {validationErrors.studentName && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.studentName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.email 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                      />
                      {validationErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.phone 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                      />
                      {validationErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.phone}</p>
                      )}
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
                      <div className="flex gap-2">
                        <div className="w-32 flex-shrink-0">
                          <select
                            name="whatsappCountryCode"
                            value={whatsappCountryCode}
                            onChange={(e) => setWhatsappCountryCode(e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                          >
                            {countryCodes.map((country) => (
                              <option key={country.code} value={country.code}>
                                {country.flag} {country.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <input
                            type="tel"
                            name="whatsappNumber"
                            value={formData.whatsappNumber || ''}
                            onChange={(e) => {
                              handleInputChange('whatsappNumber', e.target.value);
                              // If user manually changes WhatsApp number, uncheck the checkbox if it was checked
                              if (isPhoneWhatsApp && e.target.value !== formData.phone) {
                                setIsPhoneWhatsApp(false);
                              }
                            }}
                            disabled={isPhoneWhatsApp}
                            placeholder={whatsappCountryCode === '+91' ? '10-digit number' : 'Phone number'}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                              validationErrors.whatsappNumber 
                                ? 'border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:ring-orange-500'
                            } ${isPhoneWhatsApp ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </div>
                      {validationErrors.whatsappNumber && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.whatsappNumber}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {isPhoneWhatsApp ? (
                          <span className="text-blue-600">✓ Auto-filled from phone number</span>
                        ) : (
                          `Optional - ${whatsappCountryCode === '+91' ? 'Must be 10 digits if provided' : 'Enter valid phone number'}`
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Admission <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="dateOfAdmission"
                        required
                        value={dateOfAdmissionYYYYMMDD}
                        onChange={(e) => {
                          const yyyymmdd = e.target.value;
                          setDateOfAdmissionYYYYMMDD(yyyymmdd);
                          if (yyyymmdd) {
                            const formatted = formatDateInputToDDMMYYYY(yyyymmdd);
                            setDateOfAdmissionDDMMYYYY(formatted);
                            // Clear validation error
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.dateOfAdmission;
                              return newErrors;
                            });
                          } else {
                            setDateOfAdmissionDDMMYYYY('');
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.dateOfAdmission 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                      />
                      {dateOfAdmissionDDMMYYYY && (
                        <p className="mt-1 text-xs text-gray-600">Selected: {dateOfAdmissionDDMMYYYY}</p>
                      )}
                      {validationErrors.dateOfAdmission && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.dateOfAdmission}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact & Address */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact & Address Information</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Local Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="localAddress"
                        rows={3}
                        required
                        value={formData.localAddress || ''}
                        onChange={(e) => handleInputChange('localAddress', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.localAddress 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                      />
                      {validationErrors.localAddress && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.localAddress}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Permanent Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="permanentAddress"
                        rows={3}
                        required
                        value={formData.permanentAddress || ''}
                        onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.permanentAddress 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                      />
                      {validationErrors.permanentAddress && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.permanentAddress}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="emergencyContactNumber"
                          required
                          value={formData.emergencyContactNumber || ''}
                          onChange={(e) => handleInputChange('emergencyContactNumber', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.emergencyContactNumber 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        />
                        {validationErrors.emergencyContactNumber && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.emergencyContactNumber}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="emergencyName"
                          required
                          value={formData.emergencyName || ''}
                          onChange={(e) => handleInputChange('emergencyName', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.emergencyName 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        />
                        {validationErrors.emergencyName && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.emergencyName}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Relation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="emergencyRelation"
                          placeholder="e.g., Father, Mother, Guardian"
                          required
                          value={formData.emergencyRelation || ''}
                          onChange={(e) => handleInputChange('emergencyRelation', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.emergencyRelation 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        />
                        {validationErrors.emergencyRelation && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.emergencyRelation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Course & Financial Details */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Course & Financial Details</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Course Name <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="courseName"
                        required
                        value={formData.courseName || ''}
                        onChange={(e) => handleInputChange('courseName', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                          validationErrors.courseName 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
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
                      {validationErrors.courseName && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.courseName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Batch
                      </label>
                      
                      {/* Suggested Batches */}
                      {suggestedBatches.length > 0 && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900 mb-2">
                            💡 Suggested Batches (based on your software selection)
                          </p>
                          <div className="space-y-2">
                            {suggestedBatches.map((batch) => (
                              <div
                                key={batch.id}
                                className="p-2 bg-white border border-blue-300 rounded hover:bg-blue-50 cursor-pointer"
                                onClick={() => handleInputChange('batchId', batch.id)}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-medium">{batch.title}</span>
                                    {batch.software && (
                                      <span className="text-sm text-gray-600 ml-2">- {batch.software}</span>
                                    )}
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({batch.mode}) | Starts: {formatDateDDMMYYYY(batch.startDate)}
                                    </span>
                                  </div>
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    Suggested
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <select
                        name="batchId"
                        value={formData.batchId?.toString() || ''}
                        onChange={(e) => handleInputChange('batchId', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select a batch (optional)</option>
                        {suggestedBatches.length > 0 && (
                          <optgroup label="Suggested Batches">
                            {suggestedBatches.map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode}) - Starts: {formatDateDDMMYYYY(batch.startDate)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {suggestedBatches.length > 0 && batches.length > suggestedBatches.length && (
                          <optgroup label="All Batches">
                            {batches.filter(b => !suggestedBatches.some(sb => sb.id === b.id)).map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {suggestedBatches.length === 0 && batches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.title} {batch.software ? `- ${batch.software}` : ''} ({batch.mode})
                          </option>
                        ))}
                      </select>
                      {suggestedBatches.length > 0 && (
                        <p className="mt-1 text-xs text-blue-600">
                          Batches matching your software selection are shown above
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Softwares Included <span className="text-red-500">*</span>
                      </label>
                      {validationErrors.softwaresIncluded && (
                        <p className="mb-2 text-sm text-red-600">{validationErrors.softwaresIncluded}</p>
                      )}
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
                      <div className={`border border-gray-300 rounded-md p-4 max-h-48 overflow-y-auto ${formData.courseName ? 'bg-gray-50' : ''}`}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {availableSoftwares.map((software) => (
                            <label 
                              key={software} 
                              className={`flex items-center space-x-2 p-2 rounded ${formData.courseName ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-gray-50'}`}
                            >
                              <input
                                type="checkbox"
                                name="softwaresIncluded"
                                value={software}
                                checked={selectedSoftwares.includes(software)}
                                onChange={(e) => {
                                  if (!formData.courseName) {
                                    handleSoftwareChange(software, e.target.checked);
                                  }
                                }}
                                disabled={!!formData.courseName}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className={`text-sm ${formData.courseName ? 'text-gray-500' : 'text-gray-700'}`}>{software}</span>
                            </label>
                          ))}
                          {/* Show "Other" option only when course is NOT selected */}
                          {!formData.courseName && (
                            <label 
                              key="Other" 
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                name="softwaresIncluded"
                                value="Other"
                                checked={showOtherSoftwareInput}
                                onChange={(e) => {
                                  setShowOtherSoftwareInput(e.target.checked);
                                }}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                              <span className="text-sm text-gray-700">Other</span>
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
                              // Update selected softwares when other software is entered
                              if (value.trim()) {
                                const trimmed = value.trim();
                                if (!selectedSoftwares.includes(trimmed)) {
                                  setSelectedSoftwares(prev => [...prev, trimmed]);
                                }
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Deal Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="totalDeal"
                          step="0.01"
                          min="0"
                          required
                          value={formData.totalDeal || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            handleInputChange('totalDeal', value);
                            // Trigger balance recalculation
                            if (value !== undefined && formData.bookingAmount !== undefined) {
                              const calculatedBalance = Math.max(0, (value || 0) - (formData.bookingAmount || 0));
                              setFormData(prev => ({ ...prev, balanceAmount: calculatedBalance }));
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.totalDeal 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        />
                        {validationErrors.totalDeal && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.totalDeal}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="bookingAmount"
                          step="0.01"
                          min="0"
                          required
                          value={formData.bookingAmount || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            handleInputChange('bookingAmount', value);
                            // Trigger balance recalculation
                            if (value !== undefined && formData.totalDeal !== undefined) {
                              const calculatedBalance = Math.max(0, (formData.totalDeal || 0) - (value || 0));
                              setFormData(prev => ({ ...prev, balanceAmount: calculatedBalance }));
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.bookingAmount 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        />
                        {validationErrors.bookingAmount && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.bookingAmount}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Balance Amount (₹) <span className="text-xs text-gray-500">(Auto-calculated)</span>
                        </label>
                        <input
                          type="number"
                          name="balanceAmount"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          EMI Plan
                        </label>
                        <select
                          name="emiPlan"
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
                          EMI Plan Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="emiPlanDate"
                          required={formData.emiPlan}
                          disabled={!formData.emiPlan}
                          min={new Date().toISOString().split('T')[0]}
                          value={emiPlanDateYYYYMMDD}
                          onChange={(e) => {
                            const yyyymmdd = e.target.value;
                            setEmiPlanDateYYYYMMDD(yyyymmdd);
                            if (yyyymmdd) {
                              const formatted = formatDateInputToDDMMYYYY(yyyymmdd);
                              setEmiPlanDateDDMMYYYY(formatted);
                              setValidationErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.emiPlanDate;
                                return newErrors;
                              });
                            } else {
                              setEmiPlanDateDDMMYYYY('');
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.emiPlanDate 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          } ${!formData.emiPlan ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        />
                        {emiPlanDateDDMMYYYY && (
                          <p className="mt-1 text-xs text-gray-600">Selected: {emiPlanDateDDMMYYYY}</p>
                        )}
                        {validationErrors.emiPlanDate && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.emiPlanDate}</p>
                        )}
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
                                if (!emiPlanDateYYYYMMDD) {
                                  alert('Please select EMI Plan Date first');
                                  return;
                                }
                                const balance = Number(formData.balanceAmount);
                                const numberOfInstallments = 10;
                                const installmentAmount = balance / numberOfInstallments;
                                const installments = [];
                                
                                // Get EMI plan date
                                const emiPlanDate = new Date(emiPlanDateYYYYMMDD);
                                
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
                                
                                // Also update the DDMMYYYY format dates for display
                                const datesObj: { [key: number]: string } = {};
                                installments.forEach((inst, idx) => {
                                  if (inst.dueDate) {
                                    datesObj[idx] = formatDateInputToDDMMYYYY(inst.dueDate);
                                  }
                                });
                                setEmiInstallmentDates(datesObj);
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
                          <div>
                            {/* Summary */}
                            {formData.balanceAmount && (
                              <div className={`mb-3 p-3 rounded-md border ${
                                formData.emiInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0) > formData.balanceAmount
                                  ? 'bg-red-50 border-red-300'
                                  : 'bg-green-50 border-green-300'
                              }`}>
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm font-semibold">Balance Amount: ₹{formData.balanceAmount.toFixed(2)}</p>
                                    <p className="text-sm">Total EMI Amount: ₹{formData.emiInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0).toFixed(2)}</p>
                                  </div>
                                  {formData.emiInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0) > formData.balanceAmount ? (
                                    <span className="text-red-600 font-bold">⚠ Exceeds Balance!</span>
                                  ) : (
                                    <span className="text-green-600 font-semibold">✓ Valid</span>
                                  )}
                                </div>
                              </div>
                            )}
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
                                          
                                          // Check if total exceeds balance
                                          const totalEMI = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
                                          
                                          if (formData.balanceAmount && totalEMI > formData.balanceAmount) {
                                            setValidationErrors(prev => ({
                                              ...prev,
                                              [`emiInstallment_${index}_amount`]: `Total EMI (₹${totalEMI.toFixed(2)}) exceeds Balance (₹${(formData.balanceAmount || 0).toFixed(2)})`
                                            }));
                                          } else {
                                            setValidationErrors(prev => {
                                              const newErrors = { ...prev };
                                              delete newErrors[`emiInstallment_${index}_amount`];
                                              return newErrors;
                                            });
                                          }
                                          
                                          handleInputChange('emiInstallments', installments);
                                        }}
                                        className={`w-32 px-2 py-1 border rounded-md ${
                                          validationErrors[`emiInstallment_${index}_amount`] 
                                            ? 'border-red-500' 
                                            : 'border-gray-300'
                                        }`}
                                      />
                                      {validationErrors[`emiInstallment_${index}_amount`] && (
                                        <p className="mt-1 text-xs text-red-600">{validationErrors[`emiInstallment_${index}_amount`]}</p>
                                      )}
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="date"
                                          min={new Date().toISOString().split('T')[0]}
                                          value={installment.dueDate || ''}
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
                                            
                                            // Also update the DDMMYYYY format for display
                                            if (newDate) {
                                              const formatted = formatDateInputToDDMMYYYY(newDate);
                                              setEmiInstallmentDates(prev => ({ ...prev, [index]: formatted }));
                                              
                                              // Update subsequent dates display if not custom
                                              if (!customDateEmiIndices.has(index)) {
                                                const updatedDates = { ...emiInstallmentDates };
                                                for (let i = index + 1; i < installments.length; i++) {
                                                  if (!customDateEmiIndices.has(i) && installments[i].dueDate) {
                                                    updatedDates[i] = formatDateInputToDDMMYYYY(installments[i].dueDate);
                                                  }
                                                }
                                                setEmiInstallmentDates(updatedDates);
                                              }
                                            } else {
                                              setEmiInstallmentDates(prev => {
                                                const newDates = { ...prev };
                                                delete newDates[index];
                                                return newDates;
                                              });
                                            }
                                            
                                            // Clear validation error
                                            setValidationErrors(prev => {
                                              const newErrors = { ...prev };
                                              delete newErrors[`emiInstallment_${index}_dueDate`];
                                              return newErrors;
                                            });
                                          }}
                                          className={`flex-1 px-2 py-1 border rounded-md ${
                                            validationErrors[`emiInstallment_${index}_dueDate`] 
                                              ? 'border-red-500' 
                                              : 'border-gray-300'
                                          }`}
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
                                      {validationErrors[`emiInstallment_${index}_dueDate`] && (
                                        <p className="mt-1 text-xs text-red-600">{validationErrors[`emiInstallment_${index}_dueDate`]}</p>
                                      )}
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
                                            if (emiPlanDateYYYYMMDD) {
                                              const emiPlanDate = new Date(emiPlanDateYYYYMMDD);
                                              installments.forEach((inst, idx) => {
                                                const dueDate = new Date(emiPlanDate);
                                                dueDate.setMonth(dueDate.getMonth() + idx);
                                                inst.dueDate = dueDate.toISOString().split('T')[0];
                                              });
                                              
                                              // Update DDMMYYYY format dates for display
                                              const datesObj: { [key: number]: string } = {};
                                              installments.forEach((inst, idx) => {
                                                if (inst.dueDate) {
                                                  datesObj[idx] = formatDateInputToDDMMYYYY(inst.dueDate);
                                                }
                                              });
                                              setEmiInstallmentDates(datesObj);
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
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No installments added. Click "Auto-Calculate" to generate 10 equal installments or "Add Installment" to add manually.</p>
                        )}
                        {validationErrors.emiInstallments && (
                          <p className="mt-2 text-sm text-red-600 font-semibold">{validationErrors.emiInstallments}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Additional Information */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Additional Information</h2>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                  checked={complimentarySelectedSoftwares.includes(software)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setComplimentarySelectedSoftwares((prev) =>
                                      checked
                                        ? [...prev, software]
                                        : prev.filter((s) => s !== software)
                                    );
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
                          name="complimentaryGift"
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
                        name="hasReference"
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
                        name="referenceDetails"
                        rows={3}
                        value={formData.referenceDetails || ''}
                        onChange={(e) => handleInputChange('referenceDetails', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Employee Name <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="counselorName"
                          required
                          value={formData.counselorName || ''}
                          onChange={(e) => handleInputChange('counselorName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.counselorName 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        >
                          <option value="">Select employee</option>
                          {employeesData?.data?.users?.map((employee) => (
                            <option key={employee.id} value={employee.name}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                        {validationErrors.counselorName && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.counselorName}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lead Source <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <select
                            name="leadSource"
                            required
                            value={formData.leadSource || ''}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              handleInputChange('leadSource', selectedValue);
                              
                              // Auto-fill current date when Walk-in is selected and date is empty
                              if (selectedValue === 'Walk-in' && (!walkinDateYYYYMMDD || !walkinDateYYYYMMDD.trim())) {
                                const today = new Date();
                                const todayYYYYMMDD = today.toISOString().split('T')[0];
                                setWalkinDateYYYYMMDD(todayYYYYMMDD);
                                const formatted = formatDateInputToDDMMYYYY(todayYYYYMMDD);
                                setWalkinDateDDMMYYYY(formatted);
                                // Clear any validation errors
                                setValidationErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.walkinDate;
                                  return newErrors;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                              validationErrors.leadSource 
                                ? 'border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:ring-orange-500'
                            }`}
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
                        {validationErrors.leadSource && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.leadSource}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Walk-in Date
                          {formData.leadSource === 'Walk-in' && <span className="text-xs text-gray-500 ml-1">(Auto-filled if not entered)</span>}
                        </label>
                        <input
                          type="date"
                          name="walkinDate"
                          value={walkinDateYYYYMMDD}
                          onChange={(e) => {
                            const yyyymmdd = e.target.value;
                            setWalkinDateYYYYMMDD(yyyymmdd);
                            if (yyyymmdd) {
                              const formatted = formatDateInputToDDMMYYYY(yyyymmdd);
                              setWalkinDateDDMMYYYY(formatted);
                              setValidationErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.walkinDate;
                                return newErrors;
                              });
                            } else {
                              setWalkinDateDDMMYYYY('');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.walkinDate 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
                        />
                        {walkinDateDDMMYYYY && (
                          <p className="mt-1 text-xs text-gray-600">Selected: {walkinDateDDMMYYYY}</p>
                        )}
                        {validationErrors.walkinDate && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.walkinDate}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Faculty <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="masterFaculty"
                          required
                          value={formData.masterFaculty || ''}
                          onChange={(e) => handleInputChange('masterFaculty', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            validationErrors.masterFaculty 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-orange-500'
                          }`}
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
                        {validationErrors.masterFaculty && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.masterFaculty}</p>
                        )}
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
                    disabled={enrollmentMutation.isPending}
                    className="w-full sm:w-auto px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {enrollmentMutation.isPending ? 'Submitting...' : 'Submit Enrollment'}
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
        </div>
      </div>
    </Layout>
  );
};

