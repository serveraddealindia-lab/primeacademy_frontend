import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import api from '../api/axios';
import { employeeAPI, CreateEmployeeProfileRequest } from '../api/employee.api';

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
    const formData = new FormData(e.currentTarget);
    
    const userData: RegisterUserRequest = {
      name: formData.get('fullName') as string,
      email: formData.get('email') as string,
      phone: formData.get('contactNumber') as string,
      password: formData.get('password') as string,
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

    // Validate required fields
    if (!formData.employeeId || formData.employeeId.trim() === '') {
      alert('Employee ID is required');
      setCurrentStep(2); // Go back to step 2 where Employee ID is entered
      return;
    }
    
    const data: CreateEmployeeProfileRequest & { 
      address?: string;
      emergencyContactName?: string;
      emergencyRelationship?: string;
      emergencyPhoneNumber?: string;
      emergencyAlternatePhone?: string;
      documentsSubmitted?: string;
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

    createEmployeeProfileMutation.mutate(data);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      // Save current step data before moving forward
      saveCurrentStepData(currentStep);
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
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
            <form onSubmit={handleUserRegistration} className="p-8">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
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
            <form onSubmit={handleSubmit}>
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
                        onChange={handleInputChange}
                        placeholder="e.g., EMP001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="Male" 
                              checked={formData.gender === 'Male'}
                              onChange={(e) => handleRadioChange('gender', e.target.value)}
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
                              onChange={(e) => handleRadioChange('gender', e.target.value)}
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
                              onChange={(e) => handleRadioChange('gender', e.target.value)}
                              className="mr-2" 
                            />
                            <span>Other</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={formData.dateOfBirth}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                        <input
                          type="text"
                          name="nationality"
                          value={formData.nationality}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="maritalStatus" 
                              value="Single" 
                              checked={formData.maritalStatus === 'Single'}
                              onChange={(e) => handleRadioChange('maritalStatus', e.target.value)}
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
                              onChange={(e) => handleRadioChange('maritalStatus', e.target.value)}
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
                              onChange={(e) => handleRadioChange('maritalStatus', e.target.value)}
                              className="mr-2" 
                            />
                            <span>Other</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        name="address"
                        rows={3}
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                        <input
                          type="text"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation / Job Title</label>
                        <input
                          type="text"
                          name="designation"
                          value={formData.designation}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
                      <input
                        type="date"
                        name="dateOfJoining"
                        value={formData.dateOfJoining}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <label className="flex items-center">
                          <input 
                            type="radio" 
                            name="employmentType" 
                            value="Full-Time" 
                            checked={formData.employmentType === 'Full-Time'}
                            onChange={(e) => handleRadioChange('employmentType', e.target.value)}
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
                            onChange={(e) => handleRadioChange('employmentType', e.target.value)}
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
                            onChange={(e) => handleRadioChange('employmentType', e.target.value)}
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
                            onChange={(e) => handleRadioChange('employmentType', e.target.value)}
                            className="mr-2" 
                          />
                          <span>Intern</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
                        <input
                          type="text"
                          name="reportingManager"
                          value={formData.reportingManager}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Work Location</label>
                        <input
                          type="text"
                          name="workLocation"
                          value={formData.workLocation}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Bank Details */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 4: Bank Details</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        name="bankName"
                        value={formData.bankName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        name="accountNumber"
                        value={formData.accountNumber}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IFSC / Routing Number</label>
                      <input
                        type="text"
                        name="ifscCode"
                        value={formData.ifscCode}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                      <input
                        type="text"
                        name="branch"
                        value={formData.branch}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PAN / Tax ID</label>
                      <input
                        type="text"
                        name="panNumber"
                        maxLength={10}
                        value={formData.panNumber}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Emergency Contact Information */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 5: Emergency Contact Information</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input
                        type="text"
                        name="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                      <input
                        type="text"
                        name="emergencyRelationship"
                        value={formData.emergencyRelationship}
                        onChange={handleInputChange}
                        placeholder="e.g., Father, Mother, Spouse, Guardian"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          name="emergencyPhoneNumber"
                          value={formData.emergencyPhoneNumber}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone Number</label>
                        <input
                          type="tel"
                          name="emergencyAlternatePhone"
                          value={formData.emergencyAlternatePhone}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Documents & Declaration */}
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 6: Documents & Declaration</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Documents Submitted</label>
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
                      type="submit"
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
