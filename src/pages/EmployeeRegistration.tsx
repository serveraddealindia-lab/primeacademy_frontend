import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import api from '../api/axios';
import { employeeAPI, CreateEmployeeProfileRequest } from '../api/employee.api';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validatePAN,
  validateIFSC,
  validateAccountNumber,
  validatePostalCode,
  validateDate,
  validateEmployeeId,
  validatePassword,
} from '../utils/validation';

interface RegisterUserRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'employee';
}

interface EmployeeFormData {
  employeeId: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  maritalStatus: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  employmentType: string;
  reportingManager: string;
  workLocation: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  panNumber: string;
  city: string;
  state: string;
  postalCode: string;
  address: string;
  emergencyContactName: string;
  emergencyRelationship: string;
  emergencyPhoneNumber: string;
  emergencyAlternatePhone: string;
  documents: string[];
}

export const EmployeeRegistration: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Document upload states
  const [photo, setPhoto] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [panCard, setPanCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [aadharCard, setAadharCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [otherDocuments, setOtherDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingPanCard, setUploadingPanCard] = useState(false);
  const [uploadingAadharCard, setUploadingAadharCard] = useState(false);
  const [uploadingOtherDocs, setUploadingOtherDocs] = useState(false);
  
  // State to persist form data across steps
  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeId: '',
    gender: '',
    dateOfBirth: '',
    nationality: '',
    maritalStatus: '',
    department: '',
    designation: '',
    dateOfJoining: '',
    employmentType: '',
    reportingManager: '',
    workLocation: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    panNumber: '',
    city: '',
    state: '',
    postalCode: '',
    address: '',
    emergencyContactName: '',
    emergencyRelationship: '',
    emergencyPhoneNumber: '',
    emergencyAlternatePhone: '',
    documents: [],
  });

  // Register user first
  const registerUserMutation = useMutation({
    mutationFn: async (data: RegisterUserRequest) => {
      const response = await api.post('/auth/register', data);
      return response.data;
    },
    onSuccess: (data) => {
      setCreatedUserId(data.data.user.id);
      setCurrentStep(2); // Move to next step after user creation
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create user account');
    },
  });

  // Create employee profile
  const createEmployeeProfileMutation = useMutation({
    mutationFn: (data: CreateEmployeeProfileRequest) => employeeAPI.createEmployeeProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      alert('Employee registration completed successfully!');
      navigate('/employees');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create employee profile');
    },
  });

  const handleUserRegistration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataObj = new FormData(e.currentTarget);
    
    const name = (formDataObj.get('fullName') as string) || '';
    const email = (formDataObj.get('email') as string) || '';
    const phone = (formDataObj.get('contactNumber') as string) || '';
    const password = (formDataObj.get('password') as string) || '';
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    
    const nameError = validateRequired(name, 'Full Name');
    if (nameError) newErrors.fullName = nameError;
    
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.contactNumber = phoneError;
    
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    const userData: RegisterUserRequest = {
      name,
      email,
      phone,
      password,
      role: 'employee',
    };

    registerUserMutation.mutate(userData);
  };

  // Handle input changes and update state
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle radio button changes
  const handleRadioChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle checkbox changes for documents
  const handleDocumentChange = (document: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      documents: checked
        ? [...prev.documents, document]
        : prev.documents.filter(doc => doc !== document),
    }));
  };

  // Save current step data before moving to next step
  const saveCurrentStepData = (step: number) => {
    const form = document.querySelector('form');
    if (!form) return;

    const formDataObj = new FormData(form);
    
    // Update state with current form values
    setFormData(prev => {
      const updated = { ...prev };
      
      // Step 2: Personal Information
      if (step === 2) {
        updated.employeeId = (formDataObj.get('employeeId') as string) || prev.employeeId;
        updated.gender = (formDataObj.get('gender') as string) || prev.gender;
        updated.dateOfBirth = (formDataObj.get('dateOfBirth') as string) || prev.dateOfBirth;
        updated.nationality = (formDataObj.get('nationality') as string) || prev.nationality;
        updated.maritalStatus = (formDataObj.get('maritalStatus') as string) || prev.maritalStatus;
        updated.address = (formDataObj.get('address') as string) || prev.address;
        updated.city = (formDataObj.get('city') as string) || prev.city;
        updated.state = (formDataObj.get('state') as string) || prev.state;
        updated.postalCode = (formDataObj.get('postalCode') as string) || prev.postalCode;
      }
      // Step 3: Employment Information
      else if (step === 3) {
        updated.department = (formDataObj.get('department') as string) || prev.department;
        updated.designation = (formDataObj.get('designation') as string) || prev.designation;
        updated.dateOfJoining = (formDataObj.get('dateOfJoining') as string) || prev.dateOfJoining;
        updated.employmentType = (formDataObj.get('employmentType') as string) || prev.employmentType;
        updated.reportingManager = (formDataObj.get('reportingManager') as string) || prev.reportingManager;
        updated.workLocation = (formDataObj.get('workLocation') as string) || prev.workLocation;
      }
      // Step 4: Bank Details
      else if (step === 4) {
        updated.bankName = (formDataObj.get('bankName') as string) || prev.bankName;
        updated.accountNumber = (formDataObj.get('accountNumber') as string) || prev.accountNumber;
        updated.ifscCode = (formDataObj.get('ifscCode') as string) || prev.ifscCode;
        updated.branch = (formDataObj.get('branch') as string) || prev.branch;
        updated.panNumber = (formDataObj.get('panNumber') as string) || prev.panNumber;
      }
      // Step 5: Emergency Contact
      else if (step === 5) {
        updated.emergencyContactName = (formDataObj.get('emergencyContactName') as string) || prev.emergencyContactName;
        updated.emergencyRelationship = (formDataObj.get('emergencyRelationship') as string) || prev.emergencyRelationship;
        updated.emergencyPhoneNumber = (formDataObj.get('emergencyPhoneNumber') as string) || prev.emergencyPhoneNumber;
        updated.emergencyAlternatePhone = (formDataObj.get('emergencyAlternatePhone') as string) || prev.emergencyAlternatePhone;
      }
      // Step 6: Documents
      else if (step === 6) {
        const documents = formDataObj.getAll('documents') as string[];
        updated.documents = documents.length > 0 ? documents : prev.documents;
      }
      
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!createdUserId) {
      alert('Please complete user registration first');
      return;
    }

    // Validate all steps before final submission
    if (!validateCurrentStep(5)) {
      alert('Please fill in all required fields correctly. Going back to incomplete step.');
      // Find the first step with errors
      if (errors.employeeId || errors.gender || errors.dateOfBirth || errors.nationality || 
          errors.maritalStatus || errors.address || errors.city || errors.state || errors.postalCode) {
        setCurrentStep(2);
      } else if (errors.department || errors.designation || errors.dateOfJoining || 
                 errors.employmentType || errors.reportingManager || errors.workLocation) {
        setCurrentStep(3);
      } else if (errors.bankName || errors.accountNumber || errors.ifscCode || 
                 errors.branch || errors.panNumber) {
        setCurrentStep(4);
      } else if (errors.emergencyContactName || errors.emergencyRelationship || 
                 errors.emergencyPhoneNumber || errors.emergencyAlternatePhone) {
        setCurrentStep(5);
      }
      return;
    }
    
    // Store documents in structured format
    const documents: any = {};
    if (photo) documents.photo = photo;
    if (panCard) documents.panCard = panCard;
    if (aadharCard) documents.aadharCard = aadharCard;
    if (otherDocuments.length > 0) documents.otherDocuments = otherDocuments;
    
    const data: CreateEmployeeProfileRequest & { 
      address?: string;
      emergencyContactName?: string;
      emergencyRelationship?: string;
      emergencyPhoneNumber?: string;
      emergencyAlternatePhone?: string;
      documentsSubmitted?: string;
      metadata?: any;
    } = {
      userId: createdUserId,
      employeeId: formData.employeeId.trim(),
      gender: formData.gender || undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
      nationality: formData.nationality || undefined,
      maritalStatus: formData.maritalStatus || undefined,
      department: formData.department || undefined,
      designation: formData.designation || undefined,
      dateOfJoining: formData.dateOfJoining || undefined,
      employmentType: formData.employmentType || undefined,
      reportingManager: formData.reportingManager || undefined,
      workLocation: formData.workLocation || undefined,
      bankName: formData.bankName || undefined,
      accountNumber: formData.accountNumber || undefined,
      ifscCode: formData.ifscCode || undefined,
      branch: formData.branch || undefined,
      panNumber: formData.panNumber || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      postalCode: formData.postalCode || undefined,
      address: formData.address || undefined,
      emergencyContactName: formData.emergencyContactName || undefined,
      emergencyRelationship: formData.emergencyRelationship || undefined,
      emergencyPhoneNumber: formData.emergencyPhoneNumber || undefined,
      emergencyAlternatePhone: formData.emergencyAlternatePhone || undefined,
      documentsSubmitted: formData.documents.length > 0 ? formData.documents.join(', ') : undefined,
    };

    // Add documents to metadata if any exist
    if (Object.keys(documents).length > 0) {
      data.metadata = { documents };
    }

    createEmployeeProfileMutation.mutate(data);
  };

  const validateCurrentStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 2) {
      // Personal Information
      const employeeIdError = validateEmployeeId(formData.employeeId);
      if (employeeIdError) newErrors.employeeId = employeeIdError;
      
      const genderError = validateRequired(formData.gender, 'Gender');
      if (genderError) newErrors.gender = genderError;
      
      const dobError = validateDate(formData.dateOfBirth, 'Date of Birth');
      if (dobError) newErrors.dateOfBirth = dobError;
      
      const nationalityError = validateRequired(formData.nationality, 'Nationality');
      if (nationalityError) newErrors.nationality = nationalityError;
      
      const maritalStatusError = validateRequired(formData.maritalStatus, 'Marital Status');
      if (maritalStatusError) newErrors.maritalStatus = maritalStatusError;
      
      const addressError = validateRequired(formData.address, 'Address');
      if (addressError) newErrors.address = addressError;
      
      const cityError = validateRequired(formData.city, 'City');
      if (cityError) newErrors.city = cityError;
      
      const stateError = validateRequired(formData.state, 'State');
      if (stateError) newErrors.state = stateError;
      
      const postalCodeError = validatePostalCode(formData.postalCode);
      if (postalCodeError) newErrors.postalCode = postalCodeError;
    } else if (step === 3) {
      // Employment Information
      const departmentError = validateRequired(formData.department, 'Department');
      if (departmentError) newErrors.department = departmentError;
      
      const designationError = validateRequired(formData.designation, 'Designation');
      if (designationError) newErrors.designation = designationError;
      
      const dojError = validateDate(formData.dateOfJoining, 'Date of Joining');
      if (dojError) newErrors.dateOfJoining = dojError;
      
      const employmentTypeError = validateRequired(formData.employmentType, 'Employment Type');
      if (employmentTypeError) newErrors.employmentType = employmentTypeError;
      
      const reportingManagerError = validateRequired(formData.reportingManager, 'Reporting Manager');
      if (reportingManagerError) newErrors.reportingManager = reportingManagerError;
      
      const workLocationError = validateRequired(formData.workLocation, 'Work Location');
      if (workLocationError) newErrors.workLocation = workLocationError;
    } else if (step === 4) {
      // Bank Details
      const bankNameError = validateRequired(formData.bankName, 'Bank Name');
      if (bankNameError) newErrors.bankName = bankNameError;
      
      const accountNumberError = validateAccountNumber(formData.accountNumber);
      if (accountNumberError) newErrors.accountNumber = accountNumberError;
      
      const ifscError = validateIFSC(formData.ifscCode);
      if (ifscError) newErrors.ifscCode = ifscError;
      
      const branchError = validateRequired(formData.branch, 'Branch');
      if (branchError) newErrors.branch = branchError;
      
      const panError = validatePAN(formData.panNumber);
      if (panError) newErrors.panNumber = panError;
    } else if (step === 5) {
      // Emergency Contact
      const contactNameError = validateRequired(formData.emergencyContactName, 'Emergency Contact Name');
      if (contactNameError) newErrors.emergencyContactName = contactNameError;
      
      const relationshipError = validateRequired(formData.emergencyRelationship, 'Relationship');
      if (relationshipError) newErrors.emergencyRelationship = relationshipError;
      
      // Phone Number is required and must be valid
      if (!formData.emergencyPhoneNumber || formData.emergencyPhoneNumber.trim() === '') {
        newErrors.emergencyPhoneNumber = 'Phone number is required';
      } else {
        const phoneError = validatePhone(formData.emergencyPhoneNumber);
        if (phoneError) newErrors.emergencyPhoneNumber = phoneError;
      }
      
      // Alternate Phone Number is required and must be valid
      if (!formData.emergencyAlternatePhone || formData.emergencyAlternatePhone.trim() === '') {
        newErrors.emergencyAlternatePhone = 'Alternate phone number is required';
      } else {
        const altPhoneError = validatePhone(formData.emergencyAlternatePhone);
        if (altPhoneError) newErrors.emergencyAlternatePhone = altPhoneError;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      // Validate current step before moving forward
      if (!validateCurrentStep(currentStep)) {
        alert('Please fill in all required fields correctly before proceeding.');
        return;
      }
      
      // Save current step data before moving forward
      saveCurrentStepData(currentStep);
      setErrors({}); // Clear errors when moving to next step
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      // Save current step data before moving backward
      saveCurrentStepData(currentStep);
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG or PNG)');
      e.target.value = '';
      return;
    }

    setUploadingPhoto(true);
    try {
      const uploadResponse = await uploadAPI.uploadFile(file);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const uploadedFile = uploadResponse.data.files[0];
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

  // Handle Other Documents upload
  const handleOtherDocumentsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const validFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      if (allowedTypes.includes(files[i].type)) {
        validFiles.push(files[i]);
      }
    }

    if (validFiles.length === 0) {
      alert('Please select valid files (JPG, PNG, or PDF)');
      e.target.value = '';
      return;
    }

    setUploadingOtherDocs(true);
    try {
      const uploadResponse = await uploadAPI.uploadMultipleFiles(validFiles);
      if (uploadResponse.data && uploadResponse.data.files && uploadResponse.data.files.length > 0) {
        const uploadedFiles = uploadResponse.data.files.map((file) => ({
          name: file.originalName,
          url: getImageUrl(file.url) || file.url,
          size: file.size,
        }));
        setOtherDocuments(prev => [...prev, ...uploadedFiles]);
        alert(`${uploadedFiles.length} document(s) uploaded successfully!`);
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

  // Handle remove other document
  const handleRemoveOtherDocument = (index: number) => {
    setOtherDocuments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden overflow-x-auto">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">Employee Registration Form</h1>
            <p className="mt-2 text-orange-100">Complete employee registration and profile setup</p>
          </div>

          {/* Progress Steps */}
          <div className="px-8 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <React.Fragment key={step}>
                  <div className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        currentStep >= step
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {step}
                    </div>
                    <span
                      className={`ml-1 text-xs font-medium ${
                        currentStep >= step ? 'text-orange-600' : 'text-gray-500'
                      }`}
                    >
                      {step === 1 && 'Account'}
                      {step === 2 && 'Personal'}
                      {step === 3 && 'Employment'}
                      {step === 4 && 'Bank'}
                      {step === 5 && 'Emergency'}
                      {step === 6 && 'Documents'}
                    </span>
                  </div>
                  {step < totalSteps && (
                    <div
                      className={`flex-1 h-1 mx-1 ${
                        currentStep > step ? 'bg-orange-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step 1: User Account Creation */}
          {currentStep === 1 && (
            <form onSubmit={handleUserRegistration} className="p-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 1: Create User Account</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      errors.fullName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.contactNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={registerUserMutation.isPending}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {registerUserMutation.isPending ? 'Creating Account...' : 'Create Account & Continue'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Steps 2-6: Profile Information */}
          {currentStep > 1 && (
            <form onSubmit={(e) => {
              e.preventDefault();
              // Only submit when explicitly clicking the submit button
              // This prevents accidental form submission via Enter key
            }} onKeyDown={(e) => {
              // Prevent form submission when Enter is pressed anywhere in the form
              if (e.key === 'Enter') {
                const target = e.target as HTMLElement;
                // Allow Enter in textareas
                if (target.tagName === 'TEXTAREA') {
                  return;
                }
                // Prevent Enter in all other cases
                e.preventDefault();
                e.stopPropagation();
              }
            }}>
              <div className="p-8">
                {/* Step 2: Personal Information */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 2: Personal Information</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Employee ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="employeeId"
                        required
                        value={formData.employeeId}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.employeeId) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.employeeId;
                              return newErrors;
                            });
                          }
                        }}
                        placeholder="e.g., EMP001"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.employeeId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.employeeId && (
                        <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="Male" 
                              checked={formData.gender === 'Male'}
                              onChange={(e) => {
                                handleRadioChange('gender', e.target.value);
                                if (errors.gender) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.gender;
                                    return newErrors;
                                  });
                                }
                              }}
                              className="mr-2" 
                            />
                            <span>Male</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="Female" 
                              checked={formData.gender === 'Female'}
                              onChange={(e) => {
                                handleRadioChange('gender', e.target.value);
                                if (errors.gender) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.gender;
                                    return newErrors;
                                  });
                                }
                              }}
                              className="mr-2" 
                            />
                            <span>Female</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="Other" 
                              checked={formData.gender === 'Other'}
                              onChange={(e) => {
                                handleRadioChange('gender', e.target.value);
                                if (errors.gender) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.gender;
                                    return newErrors;
                                  });
                                }
                              }}
                              className="mr-2" 
                            />
                            <span>Other</span>
                          </label>
                        </div>
                        {errors.gender && (
                          <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date of Birth <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          required
                          value={formData.dateOfBirth}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.dateOfBirth) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.dateOfBirth;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.dateOfBirth && (
                          <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nationality <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="nationality"
                          required
                          value={formData.nationality}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.nationality) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.nationality;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.nationality ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.nationality && (
                          <p className="mt-1 text-sm text-red-600">{errors.nationality}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Marital Status <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="maritalStatus" 
                              value="Single" 
                              checked={formData.maritalStatus === 'Single'}
                              onChange={(e) => {
                                handleRadioChange('maritalStatus', e.target.value);
                                if (errors.maritalStatus) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.maritalStatus;
                                    return newErrors;
                                  });
                                }
                              }}
                              className="mr-2" 
                            />
                            <span>Single</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="maritalStatus" 
                              value="Married" 
                              checked={formData.maritalStatus === 'Married'}
                              onChange={(e) => {
                                handleRadioChange('maritalStatus', e.target.value);
                                if (errors.maritalStatus) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.maritalStatus;
                                    return newErrors;
                                  });
                                }
                              }}
                              className="mr-2" 
                            />
                            <span>Married</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="maritalStatus" 
                              value="Other" 
                              checked={formData.maritalStatus === 'Other'}
                              onChange={(e) => {
                                handleRadioChange('maritalStatus', e.target.value);
                                if (errors.maritalStatus) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.maritalStatus;
                                    return newErrors;
                                  });
                                }
                              }}
                              className="mr-2" 
                            />
                            <span>Other</span>
                          </label>
                        </div>
                        {errors.maritalStatus && (
                          <p className="mt-1 text-sm text-red-600">{errors.maritalStatus}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="address"
                        required
                        rows={3}
                        value={formData.address}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.address) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.address;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.address ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.address && (
                        <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          required
                          value={formData.city}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.city) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.city;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.city ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.city && (
                          <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State/Province <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="state"
                          required
                          value={formData.state}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.state) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.state;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.state ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.state && (
                          <p className="mt-1 text-sm text-red-600">{errors.state}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postal Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          required
                          maxLength={6}
                          value={formData.postalCode}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.postalCode) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.postalCode;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.postalCode ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.postalCode && (
                          <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Employment Information */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 3: Employment Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="department"
                          required
                          value={formData.department}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.department) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.department;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.department ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.department && (
                          <p className="mt-1 text-sm text-red-600">{errors.department}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Designation / Job Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="designation"
                          required
                          value={formData.designation}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.designation) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.designation;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.designation ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.designation && (
                          <p className="mt-1 text-sm text-red-600">{errors.designation}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Joining <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="dateOfJoining"
                        required
                        value={formData.dateOfJoining}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.dateOfJoining) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.dateOfJoining;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.dateOfJoining ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.dateOfJoining && (
                        <p className="mt-1 text-sm text-red-600">{errors.dateOfJoining}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Employment Type <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="employmentType" 
                            value="Full-Time" 
                            checked={formData.employmentType === 'Full-Time'}
                            onChange={(e) => {
                              handleRadioChange('employmentType', e.target.value);
                              if (errors.employmentType) {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.employmentType;
                                  return newErrors;
                                });
                              }
                            }}
                            className="mr-2" 
                          />
                          <span>Full-Time</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="employmentType" 
                            value="Part-Time" 
                            checked={formData.employmentType === 'Part-Time'}
                            onChange={(e) => {
                              handleRadioChange('employmentType', e.target.value);
                              if (errors.employmentType) {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.employmentType;
                                  return newErrors;
                                });
                              }
                            }}
                            className="mr-2" 
                          />
                          <span>Part-Time</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="employmentType" 
                            value="Contract" 
                            checked={formData.employmentType === 'Contract'}
                            onChange={(e) => {
                              handleRadioChange('employmentType', e.target.value);
                              if (errors.employmentType) {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.employmentType;
                                  return newErrors;
                                });
                              }
                            }}
                            className="mr-2" 
                          />
                          <span>Contract</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="employmentType" 
                            value="Intern" 
                            checked={formData.employmentType === 'Intern'}
                            onChange={(e) => {
                              handleRadioChange('employmentType', e.target.value);
                              if (errors.employmentType) {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.employmentType;
                                  return newErrors;
                                });
                              }
                            }}
                            className="mr-2" 
                          />
                          <span>Intern</span>
                        </label>
                      </div>
                      {errors.employmentType && (
                        <p className="mt-1 text-sm text-red-600">{errors.employmentType}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reporting Manager <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="reportingManager"
                          required
                          value={formData.reportingManager}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.reportingManager) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.reportingManager;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.reportingManager ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.reportingManager && (
                          <p className="mt-1 text-sm text-red-600">{errors.reportingManager}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Work Location <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="workLocation"
                          required
                          value={formData.workLocation}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (errors.workLocation) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.workLocation;
                                return newErrors;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.workLocation ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.workLocation && (
                          <p className="mt-1 text-sm text-red-600">{errors.workLocation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Bank Details */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 4: Bank Details</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="bankName"
                        required
                        value={formData.bankName}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.bankName) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.bankName;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.bankName ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.bankName && (
                        <p className="mt-1 text-sm text-red-600">{errors.bankName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="accountNumber"
                        required
                        value={formData.accountNumber}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.accountNumber) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.accountNumber;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.accountNumber ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.accountNumber && (
                        <p className="mt-1 text-sm text-red-600">{errors.accountNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IFSC Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="ifscCode"
                        required
                        value={formData.ifscCode}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.ifscCode) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.ifscCode;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase ${
                          errors.ifscCode ? 'border-red-500' : 'border-gray-300'
                        }`}
                        style={{ textTransform: 'uppercase' }}
                      />
                      {errors.ifscCode && (
                        <p className="mt-1 text-sm text-red-600">{errors.ifscCode}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Branch <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="branch"
                        required
                        value={formData.branch}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.branch) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.branch;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.branch ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.branch && (
                        <p className="mt-1 text-sm text-red-600">{errors.branch}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PAN Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="panNumber"
                        required
                        maxLength={10}
                        value={formData.panNumber}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.panNumber) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.panNumber;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase ${
                          errors.panNumber ? 'border-red-500' : 'border-gray-300'
                        }`}
                        style={{ textTransform: 'uppercase' }}
                      />
                      {errors.panNumber && (
                        <p className="mt-1 text-sm text-red-600">{errors.panNumber}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 5: Emergency Contact Information */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 5: Emergency Contact Information</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="emergencyContactName"
                        required
                        value={formData.emergencyContactName}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.emergencyContactName) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.emergencyContactName;
                              return newErrors;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.emergencyContactName ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.emergencyContactName && (
                        <p className="mt-1 text-sm text-red-600">{errors.emergencyContactName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Relationship <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="emergencyRelationship"
                        required
                        value={formData.emergencyRelationship}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (errors.emergencyRelationship) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.emergencyRelationship;
                              return newErrors;
                            });
                          }
                        }}
                        placeholder="e.g., Father, Mother, Spouse, Guardian"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.emergencyRelationship ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.emergencyRelationship && (
                        <p className="mt-1 text-sm text-red-600">{errors.emergencyRelationship}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="emergencyPhoneNumber"
                          required
                          pattern="[0-9]{10}"
                          minLength={10}
                          maxLength={10}
                          placeholder="10 digit phone number"
                          value={formData.emergencyPhoneNumber}
                          onChange={(e) => {
                            // Only allow digits
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            // Directly update state instead of using synthetic event
                            setFormData(prev => ({
                              ...prev,
                              emergencyPhoneNumber: value,
                            }));
                            // Clear error if exists
                            if (errors.emergencyPhoneNumber) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.emergencyPhoneNumber;
                                return newErrors;
                              });
                            }
                          }}
                          onBlur={() => {
                            // Validate on blur
                            if (!formData.emergencyPhoneNumber || formData.emergencyPhoneNumber.trim() === '') {
                              setErrors(prev => ({ ...prev, emergencyPhoneNumber: 'Phone number is required' }));
                            } else if (formData.emergencyPhoneNumber.length !== 10) {
                              setErrors(prev => ({ ...prev, emergencyPhoneNumber: 'Phone number must be exactly 10 digits' }));
                            } else {
                              const phoneError = validatePhone(formData.emergencyPhoneNumber);
                              if (phoneError) {
                                setErrors(prev => ({ ...prev, emergencyPhoneNumber: phoneError }));
                              } else {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.emergencyPhoneNumber;
                                  return newErrors;
                                });
                              }
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.emergencyPhoneNumber ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.emergencyPhoneNumber && (
                          <p className="mt-1 text-sm text-red-600">{errors.emergencyPhoneNumber}</p>
                        )}
                        {!errors.emergencyPhoneNumber && formData.emergencyPhoneNumber && (
                          <p className="mt-1 text-xs text-gray-500">Enter 10 digit phone number</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Alternate Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="emergencyAlternatePhone"
                          required
                          pattern="[0-9]{10}"
                          minLength={10}
                          maxLength={10}
                          placeholder="10 digit phone number"
                          value={formData.emergencyAlternatePhone}
                          onChange={(e) => {
                            // Only allow digits
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            // Directly update state instead of using synthetic event
                            setFormData(prev => ({
                              ...prev,
                              emergencyAlternatePhone: value,
                            }));
                            // Clear error if exists
                            if (errors.emergencyAlternatePhone) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.emergencyAlternatePhone;
                                return newErrors;
                              });
                            }
                          }}
                          onBlur={() => {
                            // Validate on blur
                            if (!formData.emergencyAlternatePhone || formData.emergencyAlternatePhone.trim() === '') {
                              setErrors(prev => ({ ...prev, emergencyAlternatePhone: 'Alternate phone number is required' }));
                            } else if (formData.emergencyAlternatePhone.length !== 10) {
                              setErrors(prev => ({ ...prev, emergencyAlternatePhone: 'Phone number must be exactly 10 digits' }));
                            } else {
                              const phoneError = validatePhone(formData.emergencyAlternatePhone);
                              if (phoneError) {
                                setErrors(prev => ({ ...prev, emergencyAlternatePhone: phoneError }));
                              } else {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.emergencyAlternatePhone;
                                  return newErrors;
                                });
                              }
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                            errors.emergencyAlternatePhone ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.emergencyAlternatePhone && (
                          <p className="mt-1 text-sm text-red-600">{errors.emergencyAlternatePhone}</p>
                        )}
                        {!errors.emergencyAlternatePhone && formData.emergencyAlternatePhone && (
                          <p className="mt-1 text-xs text-gray-500">Enter 10 digit phone number</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Documents & Declaration */}
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 6: Documents & Declaration</h2>
                    
                    {/* Photo */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                      />
                      {uploadingPhoto && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
                      {photo && photo.url && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                          <img
                            src={getImageUrl(photo.url) || ''}
                            alt="Photo"
                            className="h-16 w-16 object-cover rounded border border-gray-300"
                            crossOrigin="anonymous"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{photo.name || 'Photo'}</p>
                            <p className="text-xs text-gray-500">Image File</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPhoto(null)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* PAN Card */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={handlePanCardUpload}
                        disabled={uploadingPanCard}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                      />
                      {uploadingPanCard && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
                      {panCard && panCard.url && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                          {panCard.url.endsWith('.pdf') ? (
                            <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                              <span className="text-2xl">📄</span>
                            </div>
                          ) : (
                            <img
                              src={getImageUrl(panCard.url) || ''}
                              alt="PAN Card"
                              className="h-16 w-16 object-cover rounded border border-gray-300"
                              crossOrigin="anonymous"
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{panCard.name || 'PAN Card'}</p>
                            <p className="text-xs text-gray-500">{panCard.url.endsWith('.pdf') ? 'PDF Document' : 'Image File'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPanCard(null)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Aadhar Card */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Aadhar Card</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={handleAadharCardUpload}
                        disabled={uploadingAadharCard}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                      />
                      {uploadingAadharCard && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
                      {aadharCard && aadharCard.url && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                          {aadharCard.url.endsWith('.pdf') ? (
                            <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                              <span className="text-2xl">📄</span>
                            </div>
                          ) : (
                            <img
                              src={getImageUrl(aadharCard.url) || ''}
                              alt="Aadhar Card"
                              className="h-16 w-16 object-cover rounded border border-gray-300"
                              crossOrigin="anonymous"
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{aadharCard.name || 'Aadhar Card'}</p>
                            <p className="text-xs text-gray-500">{aadharCard.url.endsWith('.pdf') ? 'PDF Document' : 'Image File'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAadharCard(null)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Other Documents */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Other Documents (Multiple files allowed)</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        multiple
                        onChange={handleOtherDocumentsUpload}
                        disabled={uploadingOtherDocs}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                      />
                      {uploadingOtherDocs && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
                      {otherDocuments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {otherDocuments.map((doc, index) => {
                            const isPdf = doc.url.endsWith('.pdf');
                            const isImage = doc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                            return (
                              <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                                {isImage ? (
                                  <img
                                    src={getImageUrl(doc.url) || ''}
                                    alt={doc.name}
                                    className="h-16 w-16 object-cover rounded border border-gray-300"
                                    crossOrigin="anonymous"
                                  />
                                ) : (
                                  <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                                    <span className="text-2xl">{isPdf ? '📄' : '📎'}</span>
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {isPdf ? 'PDF Document' : isImage ? 'Image File' : 'Document'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOtherDocument(index)}
                                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Documents Submitted Checkboxes (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Documents Submitted (Optional)</label>
                      <div className="space-y-2 border border-gray-300 rounded-md p-4">
                        {[
                          'Resume',
                          'ID Proof',
                          'Previous Salary Payslip',
                          'Educational Certificates',
                          'Experience Certificates',
                          'Relieving letter',
                        ].map((doc) => (
                          <label key={doc} className="flex items-center">
                            <input
                              type="checkbox"
                              name="documents"
                              value={doc}
                              checked={formData.documents.includes(doc)}
                              onChange={(e) => handleDocumentChange(doc, e.target.checked)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              className="mr-2"
                            />
                            <span>{doc}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Declaration</h3>
                      <p className="text-sm text-gray-700 mb-4">
                        I hereby declare that the above information is true and correct to the best of my knowledge.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employee Signature
                          </label>
                          <div className="border-b-2 border-gray-400 h-10"></div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <input
                            type="date"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                            readOnly
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={currentStep === 2}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {currentStep < totalSteps ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Explicitly call handleSubmit
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
                      disabled={createEmployeeProfileMutation.isPending}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {createEmployeeProfileMutation.isPending ? 'Submitting...' : 'Submit Registration'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
};
