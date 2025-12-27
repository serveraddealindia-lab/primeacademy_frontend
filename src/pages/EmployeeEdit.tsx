import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { employeeAPI, EmployeeProfile } from '../api/employee.api';
import { userAPI, UpdateUserRequest } from '../api/user.api';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import api from '../api/axios';
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
} from '../utils/validation';

export const EmployeeEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Document upload states
  const [photo, setPhoto] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [panCard, setPanCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [aadharCard, setAadharCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [otherDocuments, setOtherDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  // Photo upload hook
  const { uploadPhoto, uploading: uploadingPhoto, error: photoUploadError, getPhotoUrl } = usePhotoUpload();
  const [uploadingPanCard, setUploadingPanCard] = useState(false);
  const [uploadingAadharCard, setUploadingAadharCard] = useState(false);
  const [uploadingOtherDocs, setUploadingOtherDocs] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Debug logging
  console.log('EmployeeEdit component rendering', { id, user, hasId: !!id });
  
  React.useEffect(() => {
    console.log('EmployeeEdit component mounted', { id, user });
  }, [id, user]);

  // Fetch employee data
  const { data: employeeData, isLoading, error: employeeError } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      try {
        console.log('Fetching employee data for ID:', id);
        if (!id) {
          throw new Error('Employee ID is required');
        }
        
        const userResponse = await api.get(`/users/${id}`);
        console.log('User response:', userResponse);
        
        if (!userResponse?.data) {
          throw new Error('No data in user response');
        }
        
        // Try multiple possible response structures
        let user = null;
        const responseData = userResponse.data;
        
        // Try different possible structures
        if (responseData?.data?.user) {
          user = responseData.data.user;
        } else if (responseData?.data && !responseData.data.user && responseData.data.id) {
          // Sometimes the user data is directly in data
          user = responseData.data;
        } else if (responseData?.user) {
          user = responseData.user;
        } else if (responseData?.id) {
          // If responseData itself is the user object
          user = responseData;
        }
        
        if (!user || !user.id) {
          console.error('User response structure:', responseData);
          throw new Error('Invalid user response structure - user not found');
        }
        
        // Get employee profile - it should be included in the user response
        let profile = user.employeeProfile || null;
        
        // If not included, try to fetch separately
        if (!profile) {
          try {
            const profileResponse = await employeeAPI.getEmployeeProfile(Number(id));
            console.log('Profile response:', profileResponse);
            // Try multiple possible response structures
            const profileResponseData: any = profileResponse;
            if (profileResponseData?.data?.employeeProfile) {
              profile = profileResponseData.data.employeeProfile;
            } else if (profileResponseData?.employeeProfile) {
              profile = profileResponseData.employeeProfile;
            } else if (profileResponseData?.data && profileResponseData.data.id) {
              // Sometimes the profile is directly in data
              profile = profileResponseData.data;
            } else if (profileResponseData?.id) {
              // If profileResponse itself is the profile
              profile = profileResponseData;
            }
            console.log('Extracted profile from separate fetch:', profile);
          } catch (profileError: any) {
            console.warn('Could not fetch employee profile separately:', profileError?.message);
            // Continue without profile - it might not exist yet
          }
        } else {
          console.log('Profile found in user response:', profile);
        }
        
        console.log('Employee data fetched successfully:', {
          userId: user?.id,
          userName: user?.name,
          hasProfile: !!profile,
          profileId: profile?.id,
          hasAddress: !!profile?.address,
          address: profile?.address,
          hasCity: !!profile?.city,
          city: profile?.city,
          hasState: !!profile?.state,
          state: profile?.state,
          hasPostalCode: !!profile?.postalCode,
          postalCode: profile?.postalCode,
        });
        return {
          user: user,
          profile: profile,
        };
      } catch (error: any) {
        console.error('Error fetching employee data:', error);
        console.error('Error details:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
        });
        throw error;
      }
    },
    enabled: !!id,
    retry: 1,
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: UpdateUserRequest) => userAPI.updateUser(Number(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile', id] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<EmployeeProfile & { isFinalStep?: boolean }>) => {
      // Remove isFinalStep from the data before sending to API
      const { isFinalStep, ...apiData } = data;
      return employeeAPI.updateEmployeeProfile(Number(id!), apiData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile', id] });
      // Only navigate away if this is the final step (step 5 - documents)
      if (variables?.isFinalStep) {
        alert('Employee updated successfully!');
        navigate('/employees');
      }
    },
    onError: (error: any) => {
      // Don't show alert here - let individual step handlers handle errors
      console.error('Update profile error:', error);
    },
  });

  // Extract user and profile from employeeData (must be before any early returns)
  const employeeUser = employeeData?.user;
  const profile = employeeData?.profile;

  // Helper function to parse documents from profile
  const parseDocumentsFromProfile = (): any => {
    if (!profile?.documents) return null;

    let parsedDocuments: any = null;
    if (typeof profile.documents === 'string') {
      try {
        parsedDocuments = JSON.parse(profile.documents);
      } catch (e) {
        console.error('Error parsing documents string:', e);
        return null;
      }
    } else if (typeof profile.documents === 'object' && profile.documents !== null) {
      parsedDocuments = profile.documents;
    }

    return parsedDocuments;
  };

  const parsedProfileDocuments = parseDocumentsFromProfile();

  // Load existing documents from profile
  React.useEffect(() => {
    console.log('Loading documents from profile:', {
      hasProfile: !!profile,
      hasDocuments: !!profile?.documents,
      documentsType: typeof profile?.documents,
      documentsValue: profile?.documents,
    });

    const parsedDocuments = parseDocumentsFromProfile();

    if (parsedDocuments && typeof parsedDocuments === 'object') {
      console.log('Setting document state:', {
        hasPhoto: !!parsedDocuments.photo,
        hasPanCard: !!parsedDocuments.panCard,
        hasAadharCard: !!parsedDocuments.aadharCard,
        otherDocsCount: parsedDocuments.otherDocuments?.length || 0,
        hasEmergencyContact: !!parsedDocuments.emergencyContact,
        emergencyContact: parsedDocuments.emergencyContact,
      });

      // Only set if the document exists and has required properties
      if (parsedDocuments.photo && parsedDocuments.photo.url) {
        setPhoto(parsedDocuments.photo);
      }
      if (parsedDocuments.panCard && parsedDocuments.panCard.url) {
        setPanCard(parsedDocuments.panCard);
      }
      if (parsedDocuments.aadharCard && parsedDocuments.aadharCard.url) {
        setAadharCard(parsedDocuments.aadharCard);
      }
      if (
        parsedDocuments.otherDocuments &&
        Array.isArray(parsedDocuments.otherDocuments) &&
        parsedDocuments.otherDocuments.length > 0
      ) {
        // Filter out any invalid documents
        const validDocs = parsedDocuments.otherDocuments.filter((doc: any) => doc && doc.url);
        if (validDocs.length > 0) {
          setOtherDocuments(validDocs);
        }
      }
    } else {
      console.log('No valid parsed documents found in profile');
    }
  }, [profile]);

  // Early return if no ID (after hooks)
  if (!id) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Invalid Employee ID</p>
            <p className="text-gray-600 text-sm mb-4">No employee ID provided in the URL.</p>
            <button
              onClick={() => navigate('/employees')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Employees
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Safety check for user
  if (!user) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">Please log in to continue.</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">You don't have permission to edit employees.</p>
            <button
              onClick={() => navigate('/employees')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Employees
            </button>
          </div>
        </div>
      </Layout>
    );
  }

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

  if (employeeError) {
    const errorMessage = (employeeError as any)?.response?.data?.message || (employeeError as any)?.message || 'An error occurred while loading employee data';
    const errorStatus = (employeeError as any)?.response?.status;
    console.error('EmployeeEdit Error:', {
      error: employeeError,
      message: errorMessage,
      status: errorStatus,
      id,
      user,
    });
    
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Error loading employee data</p>
            <p className="text-gray-600 text-sm mb-2">{errorMessage}</p>
            {errorStatus && (
              <p className="text-gray-500 text-xs mb-4">Status Code: {errorStatus}</p>
            )}
            <div className="mt-4 space-x-2">
              <button
                onClick={() => navigate('/employees')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Back to Employees
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!employeeData && !isLoading) {
    console.warn('EmployeeEdit: No employee data and not loading', { id, isLoading, employeeError });
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Employee not found</p>
            <p className="text-gray-600 text-sm mb-4">
              Unable to load employee data. Please check if the employee ID is correct.
            </p>
            <div className="mt-4 space-x-2">
              <button
                onClick={() => navigate('/employees')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Back to Employees
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Handle Photo upload - NEW SIMPLIFIED VERSION
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

    // Update user's avatarUrl in database
    if (id) {
      try {
        console.log('Updating avatarUrl in database:', photoData.url);
        await userAPI.updateUser(Number(id), { avatarUrl: photoData.url });
        queryClient.invalidateQueries({ queryKey: ['employee', id] });
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        console.log('AvatarUrl updated successfully');
      } catch (error: any) {
        console.error('Error updating avatarUrl:', error);
        // Don't fail - photo is uploaded, just avatarUrl update failed
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
      const uploadPromises = validFiles.map((file: File) => uploadAPI.uploadFile(file));
      const uploadResponses = await Promise.all(uploadPromises);
      
      const newDocuments = uploadResponses
        .filter(response => response.data && response.data.files && response.data.files.length > 0)
        .map(response => {
          // Clean the URL before saving to remove any duplicate domain issues
          const cleanedUrl = getImageUrl(response.data.files[0].url) || response.data.files[0].url;
          return {
            name: response.data.files[0].originalName,
            url: cleanedUrl,
            size: response.data.files[0].size,
          };
        });

      setOtherDocuments(prev => [...prev, ...newDocuments]);
      alert(`${newDocuments.length} document(s) uploaded successfully!`);
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

  const handleStep1Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string) || '';
    const email = (formData.get('email') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    
    // Validate
    const newErrors: Record<string, string> = {};
    const nameError = validateRequired(name, 'Name');
    if (nameError) newErrors.name = nameError;
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    const data: UpdateUserRequest = {
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
      isActive: formData.get('isActive') === 'true',
    };
    
    try {
      await updateUserMutation.mutateAsync(data);
      setErrors({});
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error updating user:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update user information';
      if (confirm(`${errorMessage}. Do you want to continue to the next step anyway?`)) {
        setCurrentStep(2);
      }
    }
  };

  const handleStep2Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const employeeId = (formData.get('employeeId') as string) || '';
    const gender = (formData.get('gender') as string) || '';
    const dateOfBirth = (formData.get('dateOfBirth') as string) || '';
    const nationality = (formData.get('nationality') as string) || '';
    const maritalStatus = (formData.get('maritalStatus') as string) || '';
    const address = (formData.get('address') as string) || '';
    const city = (formData.get('city') as string) || '';
    const state = (formData.get('state') as string) || '';
    const postalCode = (formData.get('postalCode') as string) || '';
    
    // Validate
    const newErrors: Record<string, string> = {};
    const employeeIdError = validateEmployeeId(employeeId);
    if (employeeIdError) newErrors.employeeId = employeeIdError;
    const genderError = validateRequired(gender, 'Gender');
    if (genderError) newErrors.gender = genderError;
    const dobError = validateDate(dateOfBirth, 'Date of Birth');
    if (dobError) newErrors.dateOfBirth = dobError;
    const nationalityError = validateRequired(nationality, 'Nationality');
    if (nationalityError) newErrors.nationality = nationalityError;
    const maritalStatusError = validateRequired(maritalStatus, 'Marital Status');
    if (maritalStatusError) newErrors.maritalStatus = maritalStatusError;
    const addressError = validateRequired(address, 'Address');
    if (addressError) newErrors.address = addressError;
    const cityError = validateRequired(city, 'City');
    if (cityError) newErrors.city = cityError;
    const stateError = validateRequired(state, 'State');
    if (stateError) newErrors.state = stateError;
    const postalCodeError = validatePostalCode(postalCode);
    if (postalCodeError) newErrors.postalCode = postalCodeError;
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    const data: Partial<EmployeeProfile & { isFinalStep?: boolean }> = {
      employeeId: employeeId || undefined,
      gender: gender || undefined,
      dateOfBirth: dateOfBirth || undefined,
      nationality: nationality || undefined,
      maritalStatus: maritalStatus || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      isFinalStep: false,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      setErrors({});
      setCurrentStep(3);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      if (confirm(`${errorMessage}. Do you want to continue to the next step anyway?`)) {
        setCurrentStep(3);
      }
    }
  };

  const handleStep3Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const department = (formData.get('department') as string) || '';
    const designation = (formData.get('designation') as string) || '';
    const dateOfJoining = (formData.get('dateOfJoining') as string) || '';
    const employmentType = (formData.get('employmentType') as string) || '';
    const reportingManager = (formData.get('reportingManager') as string) || '';
    const workLocation = (formData.get('workLocation') as string) || '';
    
    // Validate
    const newErrors: Record<string, string> = {};
    const departmentError = validateRequired(department, 'Department');
    if (departmentError) newErrors.department = departmentError;
    const designationError = validateRequired(designation, 'Designation');
    if (designationError) newErrors.designation = designationError;
    const dojError = validateDate(dateOfJoining, 'Date of Joining');
    if (dojError) newErrors.dateOfJoining = dojError;
    const employmentTypeError = validateRequired(employmentType, 'Employment Type');
    if (employmentTypeError) newErrors.employmentType = employmentTypeError;
    const reportingManagerError = validateRequired(reportingManager, 'Reporting Manager');
    if (reportingManagerError) newErrors.reportingManager = reportingManagerError;
    const workLocationError = validateRequired(workLocation, 'Work Location');
    if (workLocationError) newErrors.workLocation = workLocationError;
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    const data: Partial<EmployeeProfile & { isFinalStep?: boolean }> = {
      department: department || undefined,
      designation: designation || undefined,
      dateOfJoining: dateOfJoining || undefined,
      employmentType: employmentType || undefined,
      reportingManager: reportingManager || undefined,
      workLocation: workLocation || undefined,
      isFinalStep: false,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      setErrors({});
      setCurrentStep(4);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      if (confirm(`${errorMessage}. Do you want to continue to the next step anyway?`)) {
        setCurrentStep(4);
      }
    }
  };

  const handleStep4Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const bankName = (formData.get('bankName') as string) || '';
    const accountNumber = (formData.get('accountNumber') as string) || '';
    const ifscCode = (formData.get('ifscCode') as string) || '';
    const branch = (formData.get('branch') as string) || '';
    const panNumber = (formData.get('panNumber') as string) || '';
    
    // Validate
    const newErrors: Record<string, string> = {};
    const bankNameError = validateRequired(bankName, 'Bank Name');
    if (bankNameError) newErrors.bankName = bankNameError;
    const accountNumberError = validateAccountNumber(accountNumber);
    if (accountNumberError) newErrors.accountNumber = accountNumberError;
    const ifscError = validateIFSC(ifscCode);
    if (ifscError) newErrors.ifscCode = ifscError;
    const branchError = validateRequired(branch, 'Branch');
    if (branchError) newErrors.branch = branchError;
    const panError = validatePAN(panNumber);
    if (panError) newErrors.panNumber = panError;
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    const data: Partial<EmployeeProfile & { isFinalStep?: boolean }> = {
      bankName: bankName || undefined,
      accountNumber: accountNumber || undefined,
      ifscCode: ifscCode || undefined,
      branch: branch || undefined,
      panNumber: panNumber || undefined,
      isFinalStep: false,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      setErrors({});
      setCurrentStep(5);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      if (confirm(`${errorMessage}. Do you want to continue to the next step anyway?`)) {
        setCurrentStep(5);
      }
    }
  };

  const handleStep5Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const emergencyContactName = (formData.get('emergencyContactName') as string) || '';
    const emergencyRelationship = (formData.get('emergencyRelationship') as string) || '';
    const emergencyPhoneNumber = (formData.get('emergencyPhoneNumber') as string) || '';
    const emergencyAlternatePhone = (formData.get('emergencyAlternatePhone') as string) || '';
    
    // Validate
    const newErrors: Record<string, string> = {};
    const contactNameError = validateRequired(emergencyContactName, 'Emergency Contact Name');
    if (contactNameError) newErrors.emergencyContactName = contactNameError;
    const relationshipError = validateRequired(emergencyRelationship, 'Relationship');
    if (relationshipError) newErrors.emergencyRelationship = relationshipError;
    
    // Phone Number validation
    const phoneNumberTrimmed = emergencyPhoneNumber.trim();
    if (!phoneNumberTrimmed) {
      newErrors.emergencyPhoneNumber = 'Phone number is required';
    } else if (phoneNumberTrimmed.length !== 10) {
      newErrors.emergencyPhoneNumber = 'Phone number must be exactly 10 digits';
    } else {
      const phoneError = validatePhone(phoneNumberTrimmed);
      if (phoneError) newErrors.emergencyPhoneNumber = phoneError;
    }
    
    // Alternate Phone Number validation
    const altPhoneTrimmed = emergencyAlternatePhone.trim();
    if (!altPhoneTrimmed) {
      newErrors.emergencyAlternatePhone = 'Alternate phone number is required';
    } else if (altPhoneTrimmed.length !== 10) {
      newErrors.emergencyAlternatePhone = 'Phone number must be exactly 10 digits';
    } else {
      const altPhoneError = validatePhone(altPhoneTrimmed);
      if (altPhoneError) newErrors.emergencyAlternatePhone = altPhoneError;
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Store emergency contact in documents JSON field
    const emergencyContact: any = {
      emergencyContactName: emergencyContactName || undefined,
      emergencyRelationship: emergencyRelationship || undefined,
      emergencyPhoneNumber: emergencyPhoneNumber || undefined,
      emergencyAlternatePhone: emergencyAlternatePhone || undefined,
    };
    
    // Get existing documents or create new object
    const existingDocuments = profile?.documents || {};
    let parsedDocuments: any = {};
    
    if (typeof existingDocuments === 'string') {
      try {
        parsedDocuments = JSON.parse(existingDocuments);
      } catch (e) {
        console.error('Error parsing documents:', e);
        parsedDocuments = {};
      }
    } else if (typeof existingDocuments === 'object' && !Array.isArray(existingDocuments)) {
      parsedDocuments = existingDocuments;
    }
    
    // Preserve existing document fields (photo, panCard, aadharCard, otherDocuments)
    const updatedDocuments = {
      ...parsedDocuments,
      emergencyContact: Object.keys(emergencyContact).some(key => emergencyContact[key]) 
        ? emergencyContact 
        : parsedDocuments.emergencyContact,
    };

    const data: Partial<EmployeeProfile & { isFinalStep?: boolean }> = {
      documents: updatedDocuments,
      isFinalStep: false, // Not the final step
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      setErrors({});
      setCurrentStep(6);
    } catch (error: any) {
      console.error('Error updating emergency contact:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update emergency contact';
      if (confirm(`${errorMessage}. Do you want to continue to the next step anyway?`)) {
        setCurrentStep(6);
      }
    }
  };

  const handleStep6Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Prepare documents object
    const documents: any = {};
    if (photo) documents.photo = photo;
    if (panCard) documents.panCard = panCard;
    if (aadharCard) documents.aadharCard = aadharCard;
    if (otherDocuments.length > 0) documents.otherDocuments = otherDocuments;
    
    // Preserve emergency contact if it exists
    const existingDocuments = profile?.documents || {};
    const parsedDocuments = typeof existingDocuments === 'string' 
      ? JSON.parse(existingDocuments) 
      : existingDocuments;
    
    if (parsedDocuments.emergencyContact) {
      documents.emergencyContact = parsedDocuments.emergencyContact;
    }

    const data: Partial<EmployeeProfile & { isFinalStep?: boolean }> = {
      documents: Object.keys(documents).length > 0 ? documents : undefined,
      isFinalStep: true, // This is the final step - navigate after save
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      
      // Also update user's avatarUrl if photo was uploaded
      if (photo && photo.url && id) {
        try {
          await userAPI.updateUser(Number(id), { avatarUrl: photo.url });
          queryClient.invalidateQueries({ queryKey: ['employee', id] });
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        } catch (error: any) {
          console.error('Error updating avatarUrl:', error);
          // Don't fail the entire submission if avatarUrl update fails
        }
      }
      
      // Navigation will happen in onSuccess callback
    } catch (error: any) {
      console.error('Error updating documents:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update documents';
      alert(errorMessage);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-gray-600">Loading employee data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Final safety check - ensure we have valid data before rendering
  if (!employeeUser || !employeeUser.id) {
    console.error('EmployeeEdit: Cannot render - missing employee user data', {
      employeeUser,
      profile,
      employeeData,
      isLoading,
      employeeError,
    });
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Cannot render employee edit form</p>
            <p className="text-gray-600 text-sm mb-4">Required employee data is missing.</p>
            {employeeError && (
              <p className="text-red-500 text-sm mb-4">Error: {(employeeError as any)?.message || 'Failed to load employee data'}</p>
            )}
            <button
              onClick={() => navigate('/employees')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Employees
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  console.log('EmployeeEdit: Rendering main form', {
    employeeUser: { id: employeeUser.id, name: employeeUser.name },
    hasProfile: !!profile,
    currentStep,
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden overflow-x-auto">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Edit Employee</h1>
                <p className="mt-2 text-orange-100">Update employee information</p>
              </div>
              <button
                onClick={() => navigate('/employees')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="px-8 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        currentStep >= step
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {step}
                    </div>
                    <span className="mt-2 text-xs text-gray-600 text-center">
                      {step === 1 && 'Basic Info'}
                      {step === 2 && 'Personal Info'}
                      {step === 3 && 'Employment'}
                      {step === 4 && 'Bank Details'}
                      {step === 5 && 'Emergency'}
                      {step === 6 && 'Documents'}
                    </span>
                  </div>
                  {step < totalSteps && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        currentStep > step ? 'bg-orange-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <form key={`step1-${employeeUser?.id}-${employeeUser?.name}`} onSubmit={handleStep1Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={employeeUser?.name || ''}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={employeeUser?.email || ''}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      defaultValue={employeeUser?.phone || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select
                      name="isActive"
                      defaultValue={employeeUser?.isActive !== undefined ? (employeeUser.isActive ? 'true' : 'false') : 'true'}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateUserMutation.isPending ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Personal Information */}
            {currentStep === 2 && (
              <form key={`step2-${employeeUser?.id}-${profile?.employeeId}-${profile?.gender}-${profile?.dateOfBirth}-${profile?.address || ''}-${profile?.city || ''}-${profile?.state || ''}-${profile?.postalCode || ''}`} onSubmit={handleStep2Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID *</label>
                    <input
                      type="text"
                      name="employeeId"
                      defaultValue={profile?.employeeId || ''}
                      required
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.employeeId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.employeeId && (
                      <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender *</label>
                    <select
                      name="gender"
                      required
                      defaultValue={profile?.gender || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.gender ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && (
                      <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth *</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      required
                      defaultValue={profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.dateOfBirth && (
                      <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nationality *</label>
                    <input
                      type="text"
                      name="nationality"
                      required
                      defaultValue={profile?.nationality || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.nationality ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.nationality && (
                      <p className="mt-1 text-sm text-red-600">{errors.nationality}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status *</label>
                    <select
                      name="maritalStatus"
                      required
                      defaultValue={profile?.maritalStatus || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.maritalStatus ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.maritalStatus && (
                      <p className="mt-1 text-sm text-red-600">{errors.maritalStatus}</p>
                    )}
                  </div>
                </div>
                
                {/* Address Section */}
                <div className="mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                    <textarea
                      name="address"
                      required
                      rows={3}
                      key={`address-${profile?.address || 'empty'}`}
                      defaultValue={profile?.address || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.address ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.address && (
                      <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                      <input
                        type="text"
                        name="city"
                        required
                        key={`city-${profile?.city || 'empty'}`}
                        defaultValue={profile?.city || ''}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.city ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.city && (
                        <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State/Province *</label>
                      <input
                        type="text"
                        name="state"
                        required
                        key={`state-${profile?.state || 'empty'}`}
                        defaultValue={profile?.state || ''}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.state ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.state && (
                        <p className="mt-1 text-sm text-red-600">{errors.state}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code *</label>
                      <input
                        type="text"
                        name="postalCode"
                        required
                        maxLength={6}
                        key={`postalCode-${profile?.postalCode || 'empty'}`}
                        defaultValue={profile?.postalCode || ''}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                          errors.postalCode ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.postalCode && (
                        <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Employment Details */}
            {currentStep === 3 && (
              <form key={`step3-${employeeUser?.id}-${profile?.department}-${profile?.designation}`} onSubmit={handleStep3Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Employment Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                    <input
                      type="text"
                      name="department"
                      required
                      defaultValue={profile?.department || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.department ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.department && (
                      <p className="mt-1 text-sm text-red-600">{errors.department}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Designation *</label>
                    <input
                      type="text"
                      name="designation"
                      required
                      defaultValue={profile?.designation || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.designation ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.designation && (
                      <p className="mt-1 text-sm text-red-600">{errors.designation}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining *</label>
                    <input
                      type="date"
                      name="dateOfJoining"
                      required
                      defaultValue={profile?.dateOfJoining ? profile.dateOfJoining.split('T')[0] : ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.dateOfJoining ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.dateOfJoining && (
                      <p className="mt-1 text-sm text-red-600">{errors.dateOfJoining}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type *</label>
                    <select
                      name="employmentType"
                      required
                      defaultValue={profile?.employmentType || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.employmentType ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Intern">Intern</option>
                    </select>
                    {errors.employmentType && (
                      <p className="mt-1 text-sm text-red-600">{errors.employmentType}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reporting Manager *</label>
                    <input
                      type="text"
                      name="reportingManager"
                      required
                      defaultValue={profile?.reportingManager || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.reportingManager ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.reportingManager && (
                      <p className="mt-1 text-sm text-red-600">{errors.reportingManager}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Location *</label>
                    <input
                      type="text"
                      name="workLocation"
                      required
                      defaultValue={profile?.workLocation || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.workLocation ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.workLocation && (
                      <p className="mt-1 text-sm text-red-600">{errors.workLocation}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Bank Details */}
            {currentStep === 4 && (
              <form key={`step4-${employeeUser?.id}-${profile?.bankName}-${profile?.accountNumber}`} onSubmit={handleStep4Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Bank Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                    <input
                      type="text"
                      name="bankName"
                      required
                      defaultValue={profile?.bankName || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.bankName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.bankName && (
                      <p className="mt-1 text-sm text-red-600">{errors.bankName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
                    <input
                      type="text"
                      name="accountNumber"
                      required
                      defaultValue={profile?.accountNumber || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.accountNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.accountNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.accountNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code *</label>
                    <input
                      type="text"
                      name="ifscCode"
                      required
                      defaultValue={profile?.ifscCode || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase ${
                        errors.ifscCode ? 'border-red-500' : 'border-gray-300'
                      }`}
                      style={{ textTransform: 'uppercase' }}
                    />
                    {errors.ifscCode && (
                      <p className="mt-1 text-sm text-red-600">{errors.ifscCode}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                    <input
                      type="text"
                      name="branch"
                      required
                      defaultValue={profile?.branch || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.branch ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.branch && (
                      <p className="mt-1 text-sm text-red-600">{errors.branch}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number *</label>
                    <input
                      type="text"
                      name="panNumber"
                      required
                      maxLength={10}
                      defaultValue={profile?.panNumber || ''}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase ${
                        errors.panNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      style={{ textTransform: 'uppercase' }}
                    />
                    {errors.panNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.panNumber}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 5: Emergency Contact */}
            {currentStep === 5 && (
              <form 
                key={`step5-${employeeUser?.id}-${JSON.stringify(parsedProfileDocuments?.emergencyContact)}`}
                onSubmit={handleStep5Submit} 
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold mb-6">Emergency Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name *</label>
                    <input
                      type="text"
                      name="emergencyContactName"
                      required
                      defaultValue={
                        (parsedProfileDocuments?.emergencyContact?.emergencyContactName as string) || 
                        (profile?.documents && typeof profile.documents === 'object' && !Array.isArray(profile.documents) 
                          ? (profile.documents as any)?.emergencyContact?.emergencyContactName || '' 
                          : '')
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.emergencyContactName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.emergencyContactName && (
                      <p className="mt-1 text-sm text-red-600">{errors.emergencyContactName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Relationship *</label>
                    <input
                      type="text"
                      name="emergencyRelationship"
                      required
                      placeholder="e.g., Father, Mother, Spouse, Guardian"
                      defaultValue={
                        (parsedProfileDocuments?.emergencyContact?.emergencyRelationship as string) || 
                        (profile?.documents && typeof profile.documents === 'object' && !Array.isArray(profile.documents) 
                          ? (profile.documents as any)?.emergencyContact?.emergencyRelationship || '' 
                          : '')
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.emergencyRelationship ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.emergencyRelationship && (
                      <p className="mt-1 text-sm text-red-600">{errors.emergencyRelationship}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      name="emergencyPhoneNumber"
                      required
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      placeholder="10 digit phone number"
                      defaultValue={
                        (parsedProfileDocuments?.emergencyContact?.emergencyPhoneNumber as string) || 
                        (profile?.documents && typeof profile.documents === 'object' && !Array.isArray(profile.documents) 
                          ? (profile.documents as any)?.emergencyContact?.emergencyPhoneNumber || '' 
                          : '')
                      }
                      onChange={(e) => {
                        // Only allow digits and limit to 10
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        e.target.value = value;
                        // Clear error if exists
                        if (errors.emergencyPhoneNumber) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.emergencyPhoneNumber;
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={(e) => {
                        // Validate on blur
                        const value = e.target.value.trim();
                        if (!value) {
                          setErrors(prev => ({ ...prev, emergencyPhoneNumber: 'Phone number is required' }));
                        } else if (value.length !== 10) {
                          setErrors(prev => ({ ...prev, emergencyPhoneNumber: 'Phone number must be exactly 10 digits' }));
                        } else {
                          const phoneError = validatePhone(value);
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
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.emergencyPhoneNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.emergencyPhoneNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.emergencyPhoneNumber}</p>
                    )}
                    {!errors.emergencyPhoneNumber && (
                      <p className="mt-1 text-xs text-gray-500">Enter 10 digit phone number</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alternate Phone Number *</label>
                    <input
                      type="tel"
                      name="emergencyAlternatePhone"
                      required
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      placeholder="10 digit phone number"
                      defaultValue={
                        (parsedProfileDocuments?.emergencyContact?.emergencyAlternatePhone as string) || 
                        (profile?.documents && typeof profile.documents === 'object' && !Array.isArray(profile.documents) 
                          ? (profile.documents as any)?.emergencyContact?.emergencyAlternatePhone || '' 
                          : '')
                      }
                      onChange={(e) => {
                        // Only allow digits and limit to 10
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        e.target.value = value;
                        // Clear error if exists
                        if (errors.emergencyAlternatePhone) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.emergencyAlternatePhone;
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={(e) => {
                        // Validate on blur
                        const value = e.target.value.trim();
                        if (!value) {
                          setErrors(prev => ({ ...prev, emergencyAlternatePhone: 'Alternate phone number is required' }));
                        } else if (value.length !== 10) {
                          setErrors(prev => ({ ...prev, emergencyAlternatePhone: 'Phone number must be exactly 10 digits' }));
                        } else {
                          const phoneError = validatePhone(value);
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
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        errors.emergencyAlternatePhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.emergencyAlternatePhone && (
                      <p className="mt-1 text-sm text-red-600">{errors.emergencyAlternatePhone}</p>
                    )}
                    {!errors.emergencyAlternatePhone && (
                      <p className="mt-1 text-xs text-gray-500">Enter 10 digit phone number</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 6: Documents */}
            {currentStep === 6 && (
              <form key={`step6-${employeeUser?.id}-${JSON.stringify(parsedProfileDocuments)}`} onSubmit={handleStep6Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Documents</h2>
                
                {/* Photo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  />
                  {uploadingPhoto && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
                  {photo && photo.url && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                      <img
                        key={`photo-${photo.url}-${Date.now()}`}
                        src={(getPhotoUrl(photo.url) || photo.url) + (photo.url.includes('?') ? '&' : '?') + `t=${Date.now()}`}
                        alt="Photo"
                        className="h-16 w-16 object-cover rounded border border-gray-300"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          console.error('Photo failed to load:', photo.url);
                          // Show placeholder on error
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
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
                  {photoUploadError && (
                    <p className="mt-2 text-sm text-red-600">{photoUploadError}</p>
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
                  {(() => {
                    // Get PAN card from state or profile as fallback
                    const parsedDocs = parseDocumentsFromProfile();
                    const currentPanCard = panCard || parsedDocs?.panCard || null;
                    
                    return currentPanCard && currentPanCard.url ? (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                        {currentPanCard.url.endsWith('.pdf') ? (
                          <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                            <span className="text-2xl">📄</span>
                          </div>
                        ) : (
                          <img
                            src={getImageUrl(currentPanCard.url) || ''}
                            alt="PAN Card"
                            className="h-16 w-16 object-cover rounded border border-gray-300"
                            crossOrigin="anonymous"
                          />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{currentPanCard.name || 'PAN Card'}</p>
                          <p className="text-xs text-gray-500">{currentPanCard.url.endsWith('.pdf') ? 'PDF Document' : 'Image File'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPanCard(null)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null;
                  })()}
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
                  {(() => {
                    // Get Aadhar card from state or profile as fallback
                    const parsedDocs = parseDocumentsFromProfile();
                    const currentAadharCard = aadharCard || parsedDocs?.aadharCard || null;
                    
                    return currentAadharCard && currentAadharCard.url ? (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center space-x-4">
                        {currentAadharCard.url.endsWith('.pdf') ? (
                          <div className="h-16 w-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                            <span className="text-2xl">📄</span>
                          </div>
                        ) : (
                          <img
                            src={getImageUrl(currentAadharCard.url) || ''}
                            alt="Aadhar Card"
                            className="h-16 w-16 object-cover rounded border border-gray-300"
                            crossOrigin="anonymous"
                          />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{currentAadharCard.name || 'Aadhar Card'}</p>
                          <p className="text-xs text-gray-500">{currentAadharCard.url.endsWith('.pdf') ? 'PDF Document' : 'Image File'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAadharCard(null)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null;
                  })()}
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
                  {(() => {
                    // Get other documents from state or profile as fallback
                    const parsedDocs = parseDocumentsFromProfile();
                    const currentOtherDocs = otherDocuments.length > 0 
                      ? otherDocuments 
                      : (parsedDocs?.otherDocuments && Array.isArray(parsedDocs.otherDocuments) 
                          ? parsedDocs.otherDocuments.filter((doc: any) => doc && doc.url)
                          : []);
                    
                    return currentOtherDocs.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {currentOtherDocs.map((doc: any, index: number) => {
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
                              onClick={() => {
                                // If documents are from profile fallback, sync to state first
                                if (otherDocuments.length === 0 && currentOtherDocs.length > 0) {
                                  const updated = currentOtherDocs.filter((_: any, i: number) => i !== index);
                                  setOtherDocuments(updated);
                                } else {
                                  handleRemoveOtherDocument(index);
                                }
                              }}
                              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    ) : null;
                  })()}
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save & Finish'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

