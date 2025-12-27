import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import api from '../api/axios';
import { facultyAPI, CreateFacultyRequest } from '../api/faculty.api';

interface RegisterUserRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'faculty';
}

interface FacultyFormData {
  gender: string;
  dateOfBirth: string;
  nationality: string;
  maritalStatus: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
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
  emergencyContactName: string;
  emergencyRelationship: string;
  emergencyPhoneNumber: string;
  emergencyAlternatePhone: string;
  expertise: string;
  availability: string;
  softwareProficiency: string[];
  documents: string[];
}

export const FacultyRegistration: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);
  const [showOtherSoftware, setShowOtherSoftware] = useState(false);
  const [otherSoftware, setOtherSoftware] = useState('');
  
  // State to persist form data across steps
  const [formData, setFormData] = useState<FacultyFormData>({
    gender: '',
    dateOfBirth: '',
    nationality: '',
    maritalStatus: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
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
    emergencyContactName: '',
    emergencyRelationship: '',
    emergencyPhoneNumber: '',
    emergencyAlternatePhone: '',
    expertise: '',
    availability: '',
    softwareProficiency: [],
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

  // Create faculty profile
  const createFacultyMutation = useMutation({
    mutationFn: (data: CreateFacultyRequest) => facultyAPI.createFacultyProfile(data),
    onSuccess: (response) => {
      console.log('Faculty profile created successfully:', response);
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-profile'] });
      alert('Faculty registration completed successfully!');
      navigate('/faculty');
    },
    onError: (error: any) => {
      console.error('Failed to create faculty profile:', error);
      console.error('Error response:', error?.response?.data);
      alert(error.response?.data?.message || error?.message || 'Failed to create faculty profile');
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
      role: 'faculty',
    };

    registerUserMutation.mutate(userData);
  };

  const validateAllFields = (formData: FormData): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    // Validate Step 1: Account Information (already validated in handleUserRegistration)
    
    // Validate Step 2: Personal Information
    if (!formData.get('gender') || !(formData.get('gender') as string).trim()) {
      errors.gender = 'Gender is required';
    }
    if (!formData.get('dateOfBirth') || !(formData.get('dateOfBirth') as string).trim()) {
      errors.dateOfBirth = 'Date of Birth is required';
    } else {
      const dateOfBirth = formData.get('dateOfBirth') as string;
      const dobDate = new Date(dateOfBirth);
      if (!isNaN(dobDate.getTime())) {
        if (dobDate > new Date()) {
          errors.dateOfBirth = 'Date of birth cannot be in the future';
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
            errors.dateOfBirth = 'Faculty must be at least 18 years old';
          }
        }
      }
    }
    if (!formData.get('nationality') || !(formData.get('nationality') as string).trim()) {
      errors.nationality = 'Nationality is required';
    }
    if (!formData.get('maritalStatus') || !(formData.get('maritalStatus') as string).trim()) {
      errors.maritalStatus = 'Marital Status is required';
    }
    if (!formData.get('address') || !(formData.get('address') as string).trim()) {
      errors.address = 'Address is required';
    }
    if (!formData.get('city') || !(formData.get('city') as string).trim()) {
      errors.city = 'City is required';
    }
    if (!formData.get('state') || !(formData.get('state') as string).trim()) {
      errors.state = 'State is required';
    }
    if (!formData.get('postalCode') || !(formData.get('postalCode') as string).trim()) {
      errors.postalCode = 'Postal Code is required';
    }

    // Validate Step 3: Employment Information
    if (!formData.get('department') || !(formData.get('department') as string).trim()) {
      errors.department = 'Department is required';
    }
    if (!formData.get('designation') || !(formData.get('designation') as string).trim()) {
      errors.designation = 'Designation is required';
    }
    if (!formData.get('dateOfJoining') || !(formData.get('dateOfJoining') as string).trim()) {
      errors.dateOfJoining = 'Date of Joining is required';
    }
    if (!formData.get('employmentType') || !(formData.get('employmentType') as string).trim()) {
      errors.employmentType = 'Employment Type is required';
    }
    if (!formData.get('workLocation') || !(formData.get('workLocation') as string).trim()) {
      errors.workLocation = 'Work Location is required';
    }

    // Validate Step 4: Bank Information
    if (!formData.get('bankName') || !(formData.get('bankName') as string).trim()) {
      errors.bankName = 'Bank Name is required';
    }
    if (!formData.get('accountNumber') || !(formData.get('accountNumber') as string).trim()) {
      errors.accountNumber = 'Account Number is required';
    }
    if (!formData.get('ifscCode') || !(formData.get('ifscCode') as string).trim()) {
      errors.ifscCode = 'IFSC Code is required';
    }
    if (!formData.get('branch') || !(formData.get('branch') as string).trim()) {
      errors.branch = 'Branch is required';
    }
    if (!formData.get('panNumber') || !(formData.get('panNumber') as string).trim()) {
      errors.panNumber = 'PAN Number is required';
    } else {
      // Validate PAN format
      const panNumber = (formData.get('panNumber') as string).toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
        errors.panNumber = 'Invalid PAN Number format. PAN should be 10 characters (e.g., ABCDE1234F)';
      }
    }
    // Validate IFSC format
    if (formData.get('ifscCode')) {
      const ifscCode = (formData.get('ifscCode') as string).toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        errors.ifscCode = 'Invalid IFSC Code format. IFSC should be 11 characters (e.g., ABCD0123456)';
      }
    }

    // Validate Step 5: Emergency Contact
    if (!formData.get('emergencyContactName') || !(formData.get('emergencyContactName') as string).trim()) {
      errors.emergencyContactName = 'Emergency Contact Name is required';
    }
    if (!formData.get('emergencyRelationship') || !(formData.get('emergencyRelationship') as string).trim()) {
      errors.emergencyRelationship = 'Emergency Relationship is required';
    }
    if (!formData.get('emergencyPhoneNumber') || !(formData.get('emergencyPhoneNumber') as string).trim()) {
      errors.emergencyPhoneNumber = 'Emergency Phone Number is required';
    } else {
      const phoneNumber = (formData.get('emergencyPhoneNumber') as string).replace(/\D/g, '');
      if (phoneNumber.length !== 10) {
        errors.emergencyPhoneNumber = 'Please enter a valid 10-digit phone number';
      }
    }

    // Validate Step 6: Expertise & Availability
    if (!formData.get('expertise') || !(formData.get('expertise') as string).trim()) {
      errors.expertise = 'Expertise is required';
    }
    if (!formData.get('availability') || !(formData.get('availability') as string).trim()) {
      errors.availability = 'Availability is required';
    }

    // Validate Step 7: Software Proficiency (at least one required)
    const selectedSoftware = formData.getAll('softwareProficiency') as string[];
    let softwareList = selectedSoftware.filter(s => s !== 'Other');
    if (showOtherSoftware && otherSoftware.trim()) {
      softwareList.push(otherSoftware.trim());
    }
    if (softwareList.length === 0) {
      errors.softwareProficiency = 'At least one software proficiency must be selected';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Only allow submission on the last step
    if (currentStep !== totalSteps) {
      // If not on last step, validate only current step's fields and move to next step
      const currentFormData = new FormData(e.currentTarget);
      
      // Validate only current step's required fields
      let hasErrors = false;
      const stepErrors: Record<string, string> = {};
      
      if (currentStep === 2) {
        // Step 2: Personal Information
        if (!currentFormData.get('gender') || !(currentFormData.get('gender') as string).trim()) {
          stepErrors.gender = 'Gender is required';
          hasErrors = true;
        }
        if (!currentFormData.get('dateOfBirth') || !(currentFormData.get('dateOfBirth') as string).trim()) {
          stepErrors.dateOfBirth = 'Date of Birth is required';
          hasErrors = true;
        } else {
          const dateOfBirth = currentFormData.get('dateOfBirth') as string;
          const dobDate = new Date(dateOfBirth);
          if (!isNaN(dobDate.getTime())) {
            if (dobDate > new Date()) {
              stepErrors.dateOfBirth = 'Date of birth cannot be in the future';
              hasErrors = true;
            } else {
              const today = new Date();
              let age = today.getFullYear() - dobDate.getFullYear();
              const monthDiff = today.getMonth() - dobDate.getMonth();
              const dayDiff = today.getDate() - dobDate.getDate();
              if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                age--;
              }
              if (age < 18) {
                stepErrors.dateOfBirth = 'Faculty must be at least 18 years old';
                hasErrors = true;
              }
            }
          }
        }
        if (!currentFormData.get('nationality') || !(currentFormData.get('nationality') as string).trim()) {
          stepErrors.nationality = 'Nationality is required';
          hasErrors = true;
        }
        if (!currentFormData.get('maritalStatus') || !(currentFormData.get('maritalStatus') as string).trim()) {
          stepErrors.maritalStatus = 'Marital Status is required';
          hasErrors = true;
        }
        if (!currentFormData.get('address') || !(currentFormData.get('address') as string).trim()) {
          stepErrors.address = 'Address is required';
          hasErrors = true;
        }
        if (!currentFormData.get('city') || !(currentFormData.get('city') as string).trim()) {
          stepErrors.city = 'City is required';
          hasErrors = true;
        }
        if (!currentFormData.get('state') || !(currentFormData.get('state') as string).trim()) {
          stepErrors.state = 'State/Province is required';
          hasErrors = true;
        }
        if (!currentFormData.get('postalCode') || !(currentFormData.get('postalCode') as string).trim()) {
          stepErrors.postalCode = 'Postal Code is required';
          hasErrors = true;
        }
      } else if (currentStep === 3) {
        // Step 3: Employment Information (includes expertise and availability)
        if (!currentFormData.get('department') || !(currentFormData.get('department') as string).trim()) {
          stepErrors.department = 'Department is required';
          hasErrors = true;
        }
        if (!currentFormData.get('designation') || !(currentFormData.get('designation') as string).trim()) {
          stepErrors.designation = 'Designation is required';
          hasErrors = true;
        }
        if (!currentFormData.get('dateOfJoining') || !(currentFormData.get('dateOfJoining') as string).trim()) {
          stepErrors.dateOfJoining = 'Date of Joining is required';
          hasErrors = true;
        }
        if (!currentFormData.get('employmentType') || !(currentFormData.get('employmentType') as string).trim()) {
          stepErrors.employmentType = 'Employment Type is required';
          hasErrors = true;
        }
        if (!currentFormData.get('workLocation') || !(currentFormData.get('workLocation') as string).trim()) {
          stepErrors.workLocation = 'Work Location is required';
          hasErrors = true;
        }
        if (!currentFormData.get('expertise') || !(currentFormData.get('expertise') as string).trim()) {
          stepErrors.expertise = 'Expertise is required';
          hasErrors = true;
        }
        if (!currentFormData.get('availability') || !(currentFormData.get('availability') as string).trim()) {
          stepErrors.availability = 'Availability is required';
          hasErrors = true;
        }
      } else if (currentStep === 4) {
        // Step 4: Software Proficiency - at least one software must be selected
        const selectedSoftware = currentFormData.getAll('softwareProficiency') as string[];
        const hasOtherSoftware = showOtherSoftware && otherSoftware.trim();
        if (selectedSoftware.length === 0 && !hasOtherSoftware) {
          stepErrors.softwareProficiency = 'At least one software proficiency must be selected';
          hasErrors = true;
        }
      } else if (currentStep === 5) {
        // Step 5: Bank Details
        if (!currentFormData.get('bankName') || !(currentFormData.get('bankName') as string).trim()) {
          stepErrors.bankName = 'Bank Name is required';
          hasErrors = true;
        }
        if (!currentFormData.get('accountNumber') || !(currentFormData.get('accountNumber') as string).trim()) {
          stepErrors.accountNumber = 'Account Number is required';
          hasErrors = true;
        }
        if (!currentFormData.get('ifscCode') || !(currentFormData.get('ifscCode') as string).trim()) {
          stepErrors.ifscCode = 'IFSC Code is required';
          hasErrors = true;
        }
        if (!currentFormData.get('branch') || !(currentFormData.get('branch') as string).trim()) {
          stepErrors.branch = 'Branch is required';
          hasErrors = true;
        }
        if (!currentFormData.get('panNumber') || !(currentFormData.get('panNumber') as string).trim()) {
          stepErrors.panNumber = 'PAN Number is required';
          hasErrors = true;
        }
      } else if (currentStep === 6) {
        // Step 6: Emergency Contact Information
        if (!currentFormData.get('emergencyContactName') || !(currentFormData.get('emergencyContactName') as string).trim()) {
          stepErrors.emergencyContactName = 'Emergency Contact Name is required';
          hasErrors = true;
        }
        if (!currentFormData.get('emergencyRelationship') || !(currentFormData.get('emergencyRelationship') as string).trim()) {
          stepErrors.emergencyRelationship = 'Emergency Relationship is required';
          hasErrors = true;
        }
        if (!currentFormData.get('emergencyPhoneNumber') || !(currentFormData.get('emergencyPhoneNumber') as string).trim()) {
          stepErrors.emergencyPhoneNumber = 'Emergency Phone Number is required';
          hasErrors = true;
        }
      }
      
      if (hasErrors) {
        const firstError = Object.values(stepErrors)[0];
        alert(`Please fill all required fields correctly. ${firstError}`);
        return;
      }
      
      // Save current form data to state
      setFormData(prev => {
        const updated = { ...prev };
        for (const [key, value] of currentFormData.entries()) {
          if (key === 'softwareProficiency' || key === 'documents') {
            const existing = prev[key as keyof FacultyFormData] as string[];
            if (Array.isArray(existing)) {
              const newValues = currentFormData.getAll(key) as string[];
              (updated[key as keyof FacultyFormData] as string[]) = [...new Set([...existing, ...newValues])];
            } else {
              (updated[key as keyof FacultyFormData] as string[]) = currentFormData.getAll(key) as string[];
            }
          } else {
            (updated[key as keyof FacultyFormData] as string) = value as string;
          }
        }
        return updated;
      });
      
      nextStep();
      return;
    }
    
    // Create FormData from state (which has all steps) and current form
    const currentFormData = new FormData(e.currentTarget);
    const combinedFormData = new FormData();
    
    // Add all data from state - include dateOfBirth even if empty string
    Object.entries(formData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => combinedFormData.append(key, v));
      } else if (value !== null && value !== undefined) {
        // Include all values including empty strings (especially for dateOfBirth)
        combinedFormData.append(key, value);
      }
    });
    
    // Override with current form values (in case user changed something)
    for (const [key, value] of currentFormData.entries()) {
      combinedFormData.set(key, value);
    }
    
    // CRITICAL: Ensure dateOfBirth is always in combinedFormData from state if not in current form
    if (!combinedFormData.has('dateOfBirth') && formData.dateOfBirth) {
      combinedFormData.set('dateOfBirth', formData.dateOfBirth);
    }
    
    if (!createdUserId) {
      alert('Please complete user registration first');
      return;
    }

    // Validate all fields using combined form data
    const validation = validateAllFields(combinedFormData);
    if (!validation.isValid) {
      // Find the first step with errors
      let errorStep = 1;
      if (validation.errors.gender || validation.errors.dateOfBirth || validation.errors.nationality || 
          validation.errors.maritalStatus || validation.errors.address || validation.errors.city || 
          validation.errors.state || validation.errors.postalCode) {
        errorStep = 2;
      } else if (validation.errors.department || validation.errors.designation || validation.errors.dateOfJoining || 
                 validation.errors.employmentType || validation.errors.workLocation) {
        errorStep = 3;
      } else if (validation.errors.bankName || validation.errors.accountNumber || validation.errors.ifscCode || 
                 validation.errors.branch || validation.errors.panNumber) {
        errorStep = 4;
      } else if (validation.errors.emergencyContactName || validation.errors.emergencyRelationship || 
                 validation.errors.emergencyPhoneNumber) {
        errorStep = 5;
      } else if (validation.errors.expertise || validation.errors.availability) {
        errorStep = 6;
      } else if (validation.errors.softwareProficiency) {
        errorStep = 7;
      }
      setCurrentStep(errorStep);
      const firstError = Object.values(validation.errors)[0];
      alert(`Please fill all required fields correctly. ${firstError}`);
      return;
    }

    // Get selected software from state or form
    const selectedSoftware = combinedFormData.getAll('softwareProficiency') as string[];
    let softwareList = selectedSoftware.filter(s => s !== 'Other');
    if (showOtherSoftware && otherSoftware.trim()) {
      softwareList.push(otherSoftware.trim());
    }
    const softwareProficiency = softwareList.length > 0 ? softwareList.join(', ') : undefined;

    // Get selected documents from state or form
    const documentsSubmitted = combinedFormData.getAll('documents') as string[];
    
    // Structure all data properly - use state values as primary source, but prioritize form values
    // Ensure dateOfBirth is properly captured - it's required
    const dateOfBirthValue = (combinedFormData.get('dateOfBirth') as string) || formData.dateOfBirth;
    if (!dateOfBirthValue || !dateOfBirthValue.trim()) {
      setCurrentStep(2); // Go back to step 2 where dateOfBirth is
      alert('Date of Birth is required. Please enter your date of birth.');
      return;
    }
    
    const personalInfo = {
      gender: (combinedFormData.get('gender') as string) || formData.gender,
      dateOfBirth: dateOfBirthValue,
      nationality: (combinedFormData.get('nationality') as string) || formData.nationality,
      maritalStatus: (combinedFormData.get('maritalStatus') as string) || formData.maritalStatus,
      address: (combinedFormData.get('address') as string) || formData.address,
      city: (combinedFormData.get('city') as string) || formData.city,
      state: (combinedFormData.get('state') as string) || formData.state,
      postalCode: (combinedFormData.get('postalCode') as string) || formData.postalCode,
    };

    const employmentInfo = {
      department: combinedFormData.get('department') as string || formData.department,
      designation: combinedFormData.get('designation') as string || formData.designation,
      dateOfJoining: combinedFormData.get('dateOfJoining') as string || formData.dateOfJoining,
      employmentType: combinedFormData.get('employmentType') as string || formData.employmentType,
      reportingManager: (combinedFormData.get('reportingManager') as string) || formData.reportingManager || undefined,
      workLocation: combinedFormData.get('workLocation') as string || formData.workLocation,
    };

    const bankInfo = {
      bankName: combinedFormData.get('bankName') as string || formData.bankName,
      accountNumber: combinedFormData.get('accountNumber') as string || formData.accountNumber,
      ifscCode: combinedFormData.get('ifscCode') as string || formData.ifscCode,
      branch: combinedFormData.get('branch') as string || formData.branch,
      panNumber: combinedFormData.get('panNumber') as string || formData.panNumber,
    };

    const emergencyInfo = {
      emergencyContactName: combinedFormData.get('emergencyContactName') as string || formData.emergencyContactName,
      emergencyRelationship: combinedFormData.get('emergencyRelationship') as string || formData.emergencyRelationship,
      emergencyPhoneNumber: combinedFormData.get('emergencyPhoneNumber') as string || formData.emergencyPhoneNumber,
      emergencyAlternatePhone: (combinedFormData.get('emergencyAlternatePhone') as string) || formData.emergencyAlternatePhone || undefined,
    };

    const documents = {
      personalInfo,
      employmentInfo,
      bankInfo,
      emergencyInfo,
      documentsSubmitted: documentsSubmitted.length > 0 ? documentsSubmitted : undefined,
    };
    
    const data: CreateFacultyRequest = {
      userId: createdUserId,
      expertise: (combinedFormData.get('expertise') as string) || formData.expertise,
      availability: (combinedFormData.get('availability') as string) || formData.availability,
      documents,
      softwareProficiency,
    };

    createFacultyMutation.mutate(data);
  };

  const nextStep = (e?: React.FormEvent<HTMLFormElement>) => {
    if (currentStep < totalSteps) {
      // Save current form data to state before moving to next step
      if (e) {
        e.preventDefault();
        const currentFormData = new FormData(e.currentTarget);
        
        // Update formData state with current step's data
        setFormData(prev => {
          const updated = { ...prev };
          // Save all form fields from current step to state
          for (const [key, value] of currentFormData.entries()) {
            if (key === 'softwareProficiency' || key === 'documents') {
              // Handle arrays separately
              const existing = prev[key as keyof FacultyFormData] as string[];
              if (Array.isArray(existing)) {
                (updated[key as keyof FacultyFormData] as string[]) = [...existing, value as string];
              } else {
                (updated[key as keyof FacultyFormData] as string[]) = [value as string];
              }
            } else {
              (updated[key as keyof FacultyFormData] as string) = value as string;
            }
          }
          return updated;
        });
      }
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">Faculty Registration Form</h1>
            <p className="mt-2 text-orange-100">Complete faculty registration and profile setup</p>
          </div>

          {/* Progress Steps */}
          <div className="px-8 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
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
                      {step === 4 && 'Software'}
                      {step === 5 && 'Bank'}
                      {step === 6 && 'Emergency'}
                      {step === 7 && 'Documents'}
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
                    pattern="[0-9]{10}"
                    title="Phone number should be 10 digits"
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

          {/* Steps 2-7: Profile Information */}
          {currentStep > 1 && (
            <form onSubmit={handleSubmit}>
              <div className="p-8">
                {/* Step 2: Personal Information */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 2: Personal Information</h2>
                    
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
                              value="male" 
                              required 
                              checked={formData.gender === 'male'}
                              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                              className="mr-2" 
                            />
                            <span>Male</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="female" 
                              required 
                              checked={formData.gender === 'female'}
                              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                              className="mr-2" 
                            />
                            <span>Female</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="other" 
                              required 
                              checked={formData.gender === 'other'}
                              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                              className="mr-2" 
                            />
                            <span>Other</span>
                          </label>
                        </div>
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
                          onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">Must be at least 18 years old</p>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Marital Status <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center">
                            <input type="radio" name="maritalStatus" value="single" required className="mr-2" />
                            <span>Single</span>
                          </label>
                          <label className="flex items-center">
                            <input type="radio" name="maritalStatus" value="married" required className="mr-2" />
                            <span>Married</span>
                          </label>
                          <label className="flex items-center">
                            <input type="radio" name="maritalStatus" value="other" required className="mr-2" />
                            <span>Other</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="address"
                        rows={3}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State/Province <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="state"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postal Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          required
                          pattern="[0-9]{5,6}"
                          title="Postal code should be 5-6 digits"
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
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="department"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Designation / Job Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="designation"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Joining <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="dateOfJoining"
                        required
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Employment Type <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <label className="flex items-center">
                          <input type="radio" name="employmentType" value="full-time" required className="mr-2" />
                          <span>Full-Time</span>
                        </label>
                        <label className="flex items-center">
                          <input type="radio" name="employmentType" value="part-time" required className="mr-2" />
                          <span>Part-Time</span>
                        </label>
                        <label className="flex items-center">
                          <input type="radio" name="employmentType" value="contract" required className="mr-2" />
                          <span>Contract</span>
                        </label>
                        <label className="flex items-center">
                          <input type="radio" name="employmentType" value="intern" required className="mr-2" />
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Work Location <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="workLocation"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expertise / Specialization <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="expertise"
                        rows={3}
                        required
                        placeholder="Describe your areas of expertise and specialization"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Availability <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="availability"
                        rows={2}
                        required
                        placeholder="e.g., Monday-Friday 9 AM - 5 PM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Software Proficiency */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 4: Software Proficiency</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Software Proficiency <span className="text-gray-500">(Select all applicable)</span>
                      </label>
                      <div className="border border-gray-300 rounded-md p-4 max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
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
                            'Other',
                          ].map((software) => (
                            <label 
                              key={software} 
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                name="softwareProficiency"
                                value={software}
                                onChange={(e) => {
                                  if (software === 'Other') {
                                    setShowOtherSoftware(e.target.checked);
                                  }
                                }}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                              <span className="text-sm text-gray-700">{software}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {showOtherSoftware && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Specify Other Software
                          </label>
                          <input
                            type="text"
                            value={otherSoftware}
                            onChange={(e) => setOtherSoftware(e.target.value)}
                            placeholder="Enter software names (comma separated)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 5: Bank Details */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 5: Bank Details</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="bankName"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="accountNumber"
                        required
                        pattern="[0-9]{9,18}"
                        title="Account number should be 9-18 digits"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IFSC / Routing Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="ifscCode"
                        required
                        pattern="[A-Z]{4}0[A-Z0-9]{6}"
                        title="IFSC code should be 11 characters (e.g., ABCD0123456)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Branch <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="branch"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PAN / Tax ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="panNumber"
                        required
                        maxLength={10}
                        pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}"
                        title="PAN should be 10 characters (e.g., ABCDE1234F)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                        style={{ textTransform: 'uppercase' }}
                        onChange={(e) => {
                          // Force uppercase value so it matches PAN format while user types
                          e.target.value = e.target.value.toUpperCase();
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Step 6: Emergency Contact Information */}
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 6: Emergency Contact Information</h2>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="emergencyContactName"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Relationship <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="emergencyRelationship"
                        required
                        placeholder="e.g., Father, Mother, Spouse, Guardian"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
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
                          title="Phone number should be 10 digits"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone Number</label>
                        <input
                          type="tel"
                          name="emergencyAlternatePhone"
                          pattern="[0-9]{10}"
                          title="Phone number should be 10 digits"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 7: Documents & Declaration */}
                {currentStep === 7 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 7: Documents & Declaration</h2>
                    
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
                            Faculty Signature
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
                      type="submit"
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={createFacultyMutation.isPending}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {createFacultyMutation.isPending ? 'Submitting...' : 'Submit Registration'}
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



