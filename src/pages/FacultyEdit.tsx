import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { facultyAPI } from '../api/faculty.api';
import { userAPI, UpdateUserRequest } from '../api/user.api';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';
import { formatDateDDMMYYYY, convertDDMMYYYYToYYYYMMDD, isValidDDMMYYYY } from '../utils/dateUtils';
import api from '../api/axios';

export const FacultyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  // Photo upload hook
  const { uploadPhoto, uploading: uploadingPhoto, error: photoUploadError, getPhotoUrl } = usePhotoUpload();

  // Document upload states
  const [photo, setPhoto] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [panCard, setPanCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [aadharCard, setAadharCard] = useState<{ name: string; url: string; size?: number } | null>(null);
  const [otherDocuments, setOtherDocuments] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  const [uploadingPanCard, setUploadingPanCard] = useState(false);
  const [uploadingAadharCard, setUploadingAadharCard] = useState(false);
  const [uploadingOtherDocs, setUploadingOtherDocs] = useState(false);

  // Software proficiency state
  const [selectedSoftwares, setSelectedSoftwares] = useState<string[]>([]);
  const [otherSoftware, setOtherSoftware] = useState('');
  const [showOtherSoftware, setShowOtherSoftware] = useState(false);

  // Fetch faculty data
  const { data: facultyData, isLoading, error: facultyError } = useQuery({
    queryKey: ['faculty', id],
    queryFn: async () => {
      try {
        if (!id) {
          throw new Error('Faculty ID is required');
        }
        
        const userResponse = await api.get(`/users/${id}`);
        
        if (!userResponse?.data) {
          throw new Error('No data in user response');
        }
        
        // Try multiple possible response structures
        let user = null;
        const responseData = userResponse.data;
        
        if (responseData?.data?.user) {
          user = responseData.data.user;
        } else if (responseData?.data && !responseData.data.user && responseData.data.id) {
          user = responseData.data;
        } else if (responseData?.user) {
          user = responseData.user;
        } else if (responseData?.id) {
          user = responseData;
        }
        
        if (!user || !user.id) {
          throw new Error('Invalid user response structure - user not found');
        }
        
        // Get faculty profile - it should be included in the user response
        // The backend getUserById endpoint includes facultyProfile in the response
        let profile = user.facultyProfile || null;
        
        // Note: There's no separate GET /api/faculty/:id endpoint
        // All faculty profile data comes from /api/users/:id which includes facultyProfile
        if (!profile) {
          console.warn('Faculty profile not found in user response. Profile might not exist yet.');
          console.log('User data:', user);
        }
        
        console.log('Faculty data fetched successfully:', {
          userId: user?.id,
          userName: user?.name,
          hasProfile: !!profile,
          profileId: profile?.id,
          hasDocuments: !!profile?.documents,
          documentsType: profile?.documents ? typeof profile?.documents : 'null',
          hasExpertise: !!profile?.expertise,
          expertiseType: profile?.expertise ? typeof profile?.expertise : 'null',
          hasAvailability: !!profile?.availability,
          availabilityType: profile?.availability ? typeof profile?.availability : 'null',
        });
        
        return {
          user: user,
          profile: profile,
        };
      } catch (error: any) {
        console.error('Error fetching faculty data:', error);
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
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes to prevent unnecessary refetches
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: UpdateUserRequest) => userAPI.updateUser(Number(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty', id] });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-profile', id] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { expertise?: string; availability?: string; documents?: any; softwareProficiency?: string; dateOfBirth?: string; isFinalStep?: boolean }) => {
      // Remove isFinalStep from the data before sending to API
      const { isFinalStep, ...apiData } = data;
      
      // Clean the documents object - remove undefined values and ensure it's serializable
      if (apiData.documents) {
        const cleanDocuments = (obj: any): any => {
          if (obj === null || obj === undefined) return null;
          if (typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) {
            return obj.map(cleanDocuments).filter(item => item !== undefined);
          }
          const cleaned: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];
              if (value !== undefined) {
                cleaned[key] = cleanDocuments(value);
              }
            }
          }
          return cleaned;
        };
        apiData.documents = cleanDocuments(apiData.documents);
      }
      
      console.log('Sending faculty profile update:', {
        userId: Number(id!),
        hasDocuments: !!apiData.documents,
        documentsKeys: apiData.documents ? Object.keys(apiData.documents) : [],
        hasExpertise: !!apiData.expertise,
        hasAvailability: !!apiData.availability,
        hasDateOfBirth: !!apiData.dateOfBirth,
      });
      
      return facultyAPI.updateFacultyProfile(Number(id!), apiData);
    },
    onSuccess: async (response, variables) => {
      console.log('Faculty profile update success:', response);
      
      // Update the query cache with the new data from the response
      // Response structure: { data: { user: { ... } } } or { data: { facultyProfile: { user: ... } } }
      const updatedUser = response?.data?.user || response?.data?.facultyProfile?.user;
      if (updatedUser) {
        queryClient.setQueryData(['faculty', id], (oldData: any) => {
          if (!oldData) {
            return {
              user: updatedUser,
              profile: updatedUser.facultyProfile || response?.data?.facultyProfile || null,
            };
          }
          return {
            user: updatedUser,
            profile: updatedUser.facultyProfile || response?.data?.facultyProfile || oldData.profile,
          };
        });
      }
      
      // Only invalidate queries on success, not refetch immediately to avoid clearing form
      queryClient.invalidateQueries({ queryKey: ['faculty', id] });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-profile', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      // Only navigate away if this is the final step
      if (variables?.isFinalStep) {
        // Refetch before navigating to ensure we have latest data
        await queryClient.refetchQueries({ queryKey: ['faculty', id] });
        alert('Faculty updated successfully!');
        navigate('/faculty');
      } else {
        // Show success message for intermediate steps
        console.log('Step data saved successfully');
        // Don't refetch immediately - let the form keep the current data
        // The data will be refetched when user navigates or when needed
      }
    },
    onError: (error: any) => {
      console.error('Update profile error:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error message:', error?.message);
      
      // Don't invalidate queries on error - preserve the form data
      // Only show error message to user
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update faculty profile';
      alert(errorMessage);
      
      // Don't refetch or clear data on error - let user keep their input
    },
  });

  // Helper function to parse documents from profile - memoized to ensure stability
  const parseDocumentsFromProfile = useCallback((): any => {
    if (!facultyData?.profile?.documents) {
      console.log('No documents in profile:', {
        hasProfile: !!facultyData?.profile,
        hasDocuments: !!facultyData?.profile?.documents,
        documentsType: facultyData?.profile?.documents ? typeof facultyData.profile.documents : 'null',
      });
      return null;
    }
    
    let parsedDocuments: any = null;
    const documents = facultyData.profile.documents;
    
    console.log('Parsing documents:', {
      type: typeof documents,
      isString: typeof documents === 'string',
      isObject: typeof documents === 'object',
      value: typeof documents === 'string' ? documents.substring(0, 100) : documents,
    });
    
    if (typeof documents === 'string') {
      try {
        parsedDocuments = JSON.parse(documents);
        console.log('Successfully parsed documents string:', {
          hasPersonalInfo: !!parsedDocuments?.personalInfo,
          hasEmploymentInfo: !!parsedDocuments?.employmentInfo,
          hasBankInfo: !!parsedDocuments?.bankInfo,
          hasEmergencyInfo: !!parsedDocuments?.emergencyInfo,
        });
      } catch (e) {
        console.error('Error parsing documents string:', e);
        console.error('Documents string value:', documents);
        return null;
      }
    } else if (typeof documents === 'object' && documents !== null) {
      parsedDocuments = documents;
      console.log('Documents is already an object:', {
        hasPersonalInfo: !!parsedDocuments?.personalInfo,
        hasEmploymentInfo: !!parsedDocuments?.employmentInfo,
        hasBankInfo: !!parsedDocuments?.bankInfo,
        hasEmergencyInfo: !!parsedDocuments?.emergencyInfo,
      });
    }
    
    return parsedDocuments;
  }, [facultyData]);

  // Load existing data from profile
  React.useEffect(() => {
    if (facultyData?.profile) {
      const parsedDocuments = parseDocumentsFromProfile();
      
      if (parsedDocuments) {
        // Load documents
        if (parsedDocuments.photo && parsedDocuments.photo.url) {
          setPhoto(parsedDocuments.photo);
        }
        if (parsedDocuments.panCard && parsedDocuments.panCard.url) {
          setPanCard(parsedDocuments.panCard);
        }
        if (parsedDocuments.aadharCard && parsedDocuments.aadharCard.url) {
          setAadharCard(parsedDocuments.aadharCard);
        }
        if (parsedDocuments.otherDocuments && Array.isArray(parsedDocuments.otherDocuments)) {
          const validDocs = parsedDocuments.otherDocuments.filter((doc: any) => doc && doc.url);
          if (validDocs.length > 0) {
            setOtherDocuments(validDocs);
          }
        }
        
        // Load software proficiency
        if (parsedDocuments.softwareProficiency) {
          if (typeof parsedDocuments.softwareProficiency === 'string') {
            const softwares = parsedDocuments.softwareProficiency.split(',').map((s: string) => s.trim()).filter(Boolean);
            setSelectedSoftwares(softwares);
          } else if (Array.isArray(parsedDocuments.softwareProficiency)) {
            setSelectedSoftwares(parsedDocuments.softwareProficiency);
          }
        }
      }
    }
  }, [facultyData]);

  // Compute parsed documents and related data using useMemo (before early returns to ensure hooks order)
  const parsedDocuments = useMemo(() => {
    return parseDocumentsFromProfile();
  }, [parseDocumentsFromProfile]);

  const personalInfo = useMemo(() => {
    const info = parsedDocuments?.personalInfo || {};
    // Also check top-level dateOfBirth as fallback
    if (!info.dateOfBirth && facultyData?.profile?.dateOfBirth) {
      info.dateOfBirth = facultyData.profile.dateOfBirth;
    }
    console.log('Personal Info extracted:', {
      hasParsedDocuments: !!parsedDocuments,
      hasPersonalInfo: !!parsedDocuments?.personalInfo,
      personalInfoKeys: Object.keys(info),
      gender: info.gender,
      address: info.address,
      city: info.city,
      dateOfBirth: info.dateOfBirth,
      dateOfBirthType: typeof info.dateOfBirth,
      profileDateOfBirth: facultyData?.profile?.dateOfBirth,
    });
    return info;
  }, [parsedDocuments, facultyData?.profile?.dateOfBirth]);

  const employmentInfo = useMemo(() => {
    return parsedDocuments?.employmentInfo || {};
  }, [parsedDocuments]);

  const bankInfo = useMemo(() => {
    return parsedDocuments?.bankInfo || {};
  }, [parsedDocuments]);

  const emergencyInfo = useMemo(() => {
    return parsedDocuments?.emergencyInfo || {};
  }, [parsedDocuments]);

  // Parse expertise and availability - handle JSON strings
  const parsedExpertise = useMemo(() => {
    const profile = facultyData?.profile;
    if (!profile?.expertise) return '';
    
    let expertise = profile.expertise;
    if (typeof expertise === 'string') {
      try {
        const parsed = JSON.parse(expertise);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed.description || parsed.expertise || parsed.text || expertise;
        }
        return parsed;
      } catch (e) {
        // Not JSON, return as is
        return expertise;
      }
    } else if (typeof expertise === 'object') {
      return expertise.description || expertise.expertise || expertise.text || JSON.stringify(expertise);
    }
    return '';
  }, [facultyData?.profile?.expertise]);

  const parsedAvailability = useMemo(() => {
    const profile = facultyData?.profile;
    if (!profile?.availability) return '';
    
    let availability = profile.availability;
    if (typeof availability === 'string') {
      try {
        const parsed = JSON.parse(availability);
        if (typeof parsed === 'object' && parsed !== null) {
          const scheduleValue = parsed.schedule || parsed.availability || parsed.text;
          // Ensure we always return a string, not an object
          return typeof scheduleValue === 'string' 
            ? scheduleValue 
            : (scheduleValue ? JSON.stringify(scheduleValue) : availability);
        }
        return String(parsed);
      } catch (e) {
        // Not JSON, return as is
        return availability;
      }
    } else if (typeof availability === 'object') {
      const scheduleValue = availability.schedule || availability.availability || availability.text;
      // Ensure we always return a string, not an object
      return typeof scheduleValue === 'string' 
        ? scheduleValue 
        : (scheduleValue ? JSON.stringify(scheduleValue) : JSON.stringify(availability));
    }
    return '';
  }, [facultyData?.profile?.availability]);

  // Debug: Log when data changes (moved before early returns to fix hooks order)
  React.useEffect(() => {
    if (facultyData) {
      const { user: facultyUser, profile } = facultyData || { user: null, profile: null };
      
      console.log('Faculty data loaded in component:', {
        userId: facultyUser?.id,
        userName: facultyUser?.name,
        hasProfile: !!profile,
        profileId: profile?.id,
        hasDocuments: !!profile?.documents,
        documentsType: profile?.documents ? typeof profile?.documents : 'null',
        documentsKeys: parsedDocuments ? Object.keys(parsedDocuments) : [],
        hasPersonalInfo: Object.keys(personalInfo).length > 0,
        personalInfoKeys: Object.keys(personalInfo),
        hasEmploymentInfo: Object.keys(employmentInfo).length > 0,
        hasBankInfo: Object.keys(bankInfo).length > 0,
        hasEmergencyInfo: Object.keys(emergencyInfo).length > 0,
        expertise: parsedExpertise,
        availability: parsedAvailability,
      });
    }
  }, [facultyData, parsedDocuments, personalInfo, employmentInfo, bankInfo, emergencyInfo, parsedExpertise, parsedAvailability]);

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
        queryClient.invalidateQueries({ queryKey: ['faculty', id] });
        queryClient.invalidateQueries({ queryKey: ['faculty'] });
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

  const handleRemoveOtherDocument = (index: number) => {
    setOtherDocuments(prev => prev.filter((_, i) => i !== index));
  };

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
            <p className="text-red-600">You don't have permission to edit faculty.</p>
            <button
              onClick={() => navigate('/faculty')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
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

  if (facultyError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Error loading faculty data</p>
            <p className="text-gray-600 text-sm mb-4">
              {(facultyError as any)?.response?.data?.message || (facultyError as any)?.message || 'An error occurred while loading faculty data'}
            </p>
            <button
              onClick={() => navigate('/faculty')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!facultyData) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600">Faculty not found.</p>
            <button
              onClick={() => navigate('/faculty')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Early return checks - must be after all hooks
  if (!id) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Invalid Faculty ID</p>
            <p className="text-gray-600 text-sm mb-4">No faculty ID provided in the URL.</p>
            <button
              onClick={() => navigate('/faculty')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const { user: facultyUser, profile } = facultyData || { user: null, profile: null };
  
  if (!facultyUser || !facultyUser.id) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-xl rounded-lg p-6">
            <p className="text-red-600 font-semibold mb-2">Faculty user data not available.</p>
            <button
              onClick={() => navigate('/faculty')}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Back to Faculty
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Step handlers
  const handleStep1Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Validate required fields
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    
    if (!name || !name.trim()) {
      alert('Name is required');
      return;
    }
    if (!email || !email.trim()) {
      alert('Email is required');
      return;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        alert('Please enter a valid email address');
        return;
      }
    }
    if (!phone || !phone.trim()) {
      alert('Phone number is required');
      return;
    } else {
      const phoneCleaned = phone.replace(/\D/g, '');
      if (phoneCleaned.length !== 10) {
        alert('Please enter a valid 10-digit phone number');
        return;
      }
    }
    
    const data: UpdateUserRequest = {
      name: name,
      email: email,
      phone: phone,
      isActive: formData.get('isActive') === 'true',
    };
    
    try {
      await updateUserMutation.mutateAsync(data);
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
    
    // Validate required fields
    const gender = formData.get('gender') as string;
    let dateOfBirthInput = formData.get('dateOfBirth') as string;
    const nationality = formData.get('nationality') as string;
    const maritalStatus = formData.get('maritalStatus') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const postalCode = formData.get('postalCode') as string;
    
    // If dateOfBirth field is empty, try to get it from existing data
    if (!dateOfBirthInput || !dateOfBirthInput.trim()) {
      // Use parsedDocuments or profile directly to avoid variable shadowing
      const existingDob = parsedDocuments?.personalInfo?.dateOfBirth || facultyData?.profile?.dateOfBirth;
      if (existingDob) {
        try {
          dateOfBirthInput = formatDateDDMMYYYY(existingDob);
          // formatDateDDMMYYYY returns '-' for invalid, we need to check
          if (dateOfBirthInput && dateOfBirthInput !== '-') {
            console.log('Using existing dateOfBirth from data:', dateOfBirthInput);
          } else {
            dateOfBirthInput = '';
          }
        } catch (e) {
          console.error('Error formatting existing dateOfBirth:', e);
          dateOfBirthInput = '';
        }
      }
    }
    
    if (!gender || !gender.trim()) {
      alert('Gender is required');
      return;
    }
    if (!dateOfBirthInput || !dateOfBirthInput.trim() || dateOfBirthInput === '-') {
      alert('Date of Birth is required. Please enter your date of birth in DD/MM/YYYY format.');
      return;
    }
    
    // Validate DD/MM/YYYY format
    if (!isValidDDMMYYYY(dateOfBirthInput)) {
      alert('Please enter a valid date in DD/MM/YYYY format (e.g., 01/01/1990)');
      return;
    }
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for validation and storage
    const dateOfBirth = convertDDMMYYYYToYYYYMMDD(dateOfBirthInput);
    if (!dateOfBirth) {
      alert('Invalid date format. Please use DD/MM/YYYY format');
      return;
    }
    
    // Validate Date of Birth - must be at least 18 years old
    const dobDate = new Date(dateOfBirth);
    if (isNaN(dobDate.getTime())) {
      alert('Invalid date. Please check the date you entered');
      return;
    }
    
    if (dobDate > new Date()) {
      alert('Date of birth cannot be in the future');
      return;
    }
    
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    const dayDiff = today.getDate() - dobDate.getDate();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    
    if (age < 18) {
      alert('Faculty must be at least 18 years old');
      return;
    }
    if (!nationality || !nationality.trim()) {
      alert('Nationality is required');
      return;
    }
    if (!maritalStatus || !maritalStatus.trim()) {
      alert('Marital Status is required');
      return;
    }
    if (!address || !address.trim()) {
      alert('Address is required');
      return;
    }
    if (!city || !city.trim()) {
      alert('City is required');
      return;
    }
    if (!state || !state.trim()) {
      alert('State is required');
      return;
    }
    if (!postalCode || !postalCode.trim()) {
      alert('Postal Code is required');
      return;
    }
    
    const personalInfo: any = {};
    personalInfo.gender = gender;
    personalInfo.dateOfBirth = dateOfBirth; // Store as YYYY-MM-DD format
    personalInfo.nationality = nationality;
    personalInfo.maritalStatus = maritalStatus;
    personalInfo.address = address;
    personalInfo.city = city;
    personalInfo.state = state;
    personalInfo.postalCode = postalCode;

    // Get fresh profile data from query
    const currentProfile = facultyData?.profile || profile;
    const existingDocuments = currentProfile?.documents || {};
    let parsedDocs: any = {};
    try {
      parsedDocs = typeof existingDocuments === 'string' 
        ? JSON.parse(existingDocuments) 
        : (existingDocuments || {});
      // Ensure it's an object
      if (typeof parsedDocs !== 'object' || Array.isArray(parsedDocs)) {
        parsedDocs = {};
      }
    } catch (e) {
      console.error('Error parsing existing documents:', e);
      parsedDocs = {};
    }

    // Preserve all existing data and only update personalInfo
    const updatedDocuments = {
      ...parsedDocs,
      personalInfo: Object.keys(personalInfo).length > 0 ? personalInfo : (parsedDocs.personalInfo || {}),
    };

    // Extract dateOfBirth from personalInfo to send at top level as well
    const data: any = {
      documents: updatedDocuments,
    };
    
    // Also send dateOfBirth at top level for better compatibility with backend
    if (personalInfo.dateOfBirth) {
      data.dateOfBirth = personalInfo.dateOfBirth;
    }
    
    try {
      await updateProfileMutation.mutateAsync(data);
      // Wait a bit for the query to refetch before moving to next step
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep(3);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      alert(errorMessage);
      // Don't continue to next step if save failed
    }
  };

  const handleStep3Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Validate required fields
    const department = formData.get('department') as string;
    const designation = formData.get('designation') as string;
    const dateOfJoining = formData.get('dateOfJoining') as string;
    const employmentType = formData.get('employmentType') as string;
    const workLocation = formData.get('workLocation') as string;
    const expertise = formData.get('expertise') as string;
    const availability = formData.get('availability') as string;
    
    if (!department || !department.trim()) {
      alert('Department is required');
      return;
    }
    if (!designation || !designation.trim()) {
      alert('Designation is required');
      return;
    }
    if (!dateOfJoining || !dateOfJoining.trim()) {
      alert('Date of Joining is required');
      return;
    }
    if (!employmentType || !employmentType.trim()) {
      alert('Employment Type is required');
      return;
    }
    if (!workLocation || !workLocation.trim()) {
      alert('Work Location is required');
      return;
    }
    if (!expertise || !expertise.trim()) {
      alert('Expertise is required');
      return;
    }
    if (!availability || !availability.trim()) {
      alert('Availability is required');
      return;
    }
    
    const employmentInfo: any = {};
    employmentInfo.department = department;
    employmentInfo.designation = designation;
    employmentInfo.dateOfJoining = dateOfJoining;
    employmentInfo.employmentType = employmentType;
    const reportingManager = formData.get('reportingManager') as string;
    if (reportingManager) employmentInfo.reportingManager = reportingManager;
    employmentInfo.workLocation = workLocation;

    // Get fresh profile data from query
    const currentProfile = facultyData?.profile || profile;
    const existingDocuments = currentProfile?.documents || {};
    let parsedDocs: any = {};
    try {
      parsedDocs = typeof existingDocuments === 'string' 
        ? JSON.parse(existingDocuments) 
        : (existingDocuments || {});
      // Ensure it's an object
      if (typeof parsedDocs !== 'object' || Array.isArray(parsedDocs)) {
        parsedDocs = {};
      }
    } catch (e) {
      console.error('Error parsing existing documents:', e);
      parsedDocs = {};
    }

    // Preserve all existing data and only update employmentInfo
    const updatedDocuments = {
      ...parsedDocs,
      employmentInfo: Object.keys(employmentInfo).length > 0 ? employmentInfo : (parsedDocs.employmentInfo || {}),
    };

    const data = {
      expertise,
      availability,
      documents: updatedDocuments,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      // Wait a bit for the query to refetch before moving to next step
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep(4);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      alert(errorMessage);
      // Don't continue to next step if save failed
    }
  };

  const handleStep4Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    let softwareList = [...selectedSoftwares];
    if (showOtherSoftware && otherSoftware.trim()) {
      softwareList.push(otherSoftware.trim());
    }
    const softwareProficiency = softwareList.join(', ');

    // Get fresh profile data from query
    const currentProfile = facultyData?.profile || profile;
    const existingDocuments = currentProfile?.documents || {};
    let parsedDocs: any = {};
    try {
      parsedDocs = typeof existingDocuments === 'string' 
        ? JSON.parse(existingDocuments) 
        : (existingDocuments || {});
    } catch (e) {
      console.error('Error parsing existing documents:', e);
      parsedDocs = {};
    }

    const updatedDocuments = {
      ...parsedDocs,
      softwareProficiency,
    };

    const data = {
      documents: updatedDocuments,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      // Wait a bit for the query to refetch before moving to next step
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep(5);
    } catch (error: any) {
      console.error('Error updating software:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update software';
      alert(errorMessage);
      // Don't continue to next step if save failed
    }
  };

  const handleStep5Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Validate required fields
    const bankName = formData.get('bankName') as string;
    const accountNumber = formData.get('accountNumber') as string;
    const ifscCode = formData.get('ifscCode') as string;
    const branch = formData.get('branch') as string;
    const panNumber = formData.get('panNumber') as string;
    
    if (!bankName || !bankName.trim()) {
      alert('Bank Name is required');
      return;
    }
    if (!accountNumber || !accountNumber.trim()) {
      alert('Account Number is required');
      return;
    }
    if (!ifscCode || !ifscCode.trim()) {
      alert('IFSC Code is required');
      return;
    } else {
      // Validate IFSC format
      const ifscUpper = ifscCode.toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscUpper)) {
        alert('Invalid IFSC Code format. IFSC should be 11 characters (e.g., ABCD0123456)');
        return;
      }
    }
    if (!branch || !branch.trim()) {
      alert('Branch is required');
      return;
    }
    if (!panNumber || !panNumber.trim()) {
      alert('PAN Number is required');
      return;
    } else {
      // Validate PAN format
      const panUpper = panNumber.toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
        alert('Invalid PAN Number format. PAN should be 10 characters (e.g., ABCDE1234F)');
        return;
      }
    }
    
    const bankInfo: any = {};
    bankInfo.bankName = bankName;
    bankInfo.accountNumber = accountNumber;
    bankInfo.ifscCode = ifscCode.toUpperCase();
    bankInfo.branch = branch;
    bankInfo.panNumber = panNumber.toUpperCase();

    // Get fresh profile data from query
    const currentProfile = facultyData?.profile || profile;
    const existingDocuments = currentProfile?.documents || {};
    let parsedDocs: any = {};
    try {
      parsedDocs = typeof existingDocuments === 'string' 
        ? JSON.parse(existingDocuments) 
        : (existingDocuments || {});
      // Ensure it's an object
      if (typeof parsedDocs !== 'object' || Array.isArray(parsedDocs)) {
        parsedDocs = {};
      }
    } catch (e) {
      console.error('Error parsing existing documents:', e);
      parsedDocs = {};
    }

    // Preserve all existing data and only update bankInfo
    const updatedDocuments = {
      ...parsedDocs,
      bankInfo: Object.keys(bankInfo).length > 0 ? bankInfo : (parsedDocs.bankInfo || {}),
    };

    const data = {
      documents: updatedDocuments,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      // Wait a bit for the query to refetch before moving to next step
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep(6);
    } catch (error: any) {
      console.error('Error updating bank details:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update bank details';
      alert(errorMessage);
      // Don't continue to next step if save failed
    }
  };

  const handleStep6Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Validate required fields
    const emergencyContactName = formData.get('emergencyContactName') as string;
    const emergencyRelationship = formData.get('emergencyRelationship') as string;
    const emergencyPhoneNumber = formData.get('emergencyPhoneNumber') as string;
    const emergencyAlternatePhone = formData.get('emergencyAlternatePhone') as string;
    
    if (!emergencyContactName || !emergencyContactName.trim()) {
      alert('Emergency Contact Name is required');
      return;
    }
    if (!emergencyRelationship || !emergencyRelationship.trim()) {
      alert('Emergency Relationship is required');
      return;
    }
    if (!emergencyPhoneNumber || !emergencyPhoneNumber.trim()) {
      alert('Emergency Phone Number is required');
      return;
    } else {
      const phoneCleaned = emergencyPhoneNumber.replace(/\D/g, '');
      if (phoneCleaned.length !== 10) {
        alert('Please enter a valid 10-digit emergency phone number');
        return;
      }
    }
    
    const emergencyInfo: any = {};
    emergencyInfo.emergencyContactName = emergencyContactName;
    emergencyInfo.emergencyRelationship = emergencyRelationship;
    emergencyInfo.emergencyPhoneNumber = emergencyPhoneNumber;
    if (emergencyAlternatePhone) emergencyInfo.emergencyAlternatePhone = emergencyAlternatePhone;

    // Get fresh profile data from query
    const currentProfile = facultyData?.profile || profile;
    const existingDocuments = currentProfile?.documents || {};
    let parsedDocs: any = {};
    try {
      parsedDocs = typeof existingDocuments === 'string' 
        ? JSON.parse(existingDocuments) 
        : (existingDocuments || {});
      // Ensure it's an object
      if (typeof parsedDocs !== 'object' || Array.isArray(parsedDocs)) {
        parsedDocs = {};
      }
    } catch (e) {
      console.error('Error parsing existing documents:', e);
      parsedDocs = {};
    }

    // Preserve all existing data and only update emergencyInfo
    const updatedDocuments = {
      ...parsedDocs,
      emergencyInfo: Object.keys(emergencyInfo).length > 0 ? emergencyInfo : (parsedDocs.emergencyInfo || {}),
    };

    const data = {
      documents: updatedDocuments,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data);
      // Wait a bit for the query to refetch before moving to next step
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep(7);
    } catch (error: any) {
      console.error('Error updating emergency contact:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update emergency contact';
      alert(errorMessage);
      // Don't continue to next step if save failed
    }
  };

  const handleStep7Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const documents: any = {};
    if (photo) documents.photo = photo;
    if (panCard) documents.panCard = panCard;
    if (aadharCard) documents.aadharCard = aadharCard;
    if (otherDocuments.length > 0) documents.otherDocuments = otherDocuments;
    
    // Get fresh profile data from query
    const currentProfile = facultyData?.profile || profile;
    // Preserve existing data
    const existingDocuments = currentProfile?.documents || {};
    let parsedDocs: any = {};
    try {
      parsedDocs = typeof existingDocuments === 'string' 
        ? JSON.parse(existingDocuments) 
        : (existingDocuments || {});
    } catch (e) {
      console.error('Error parsing existing documents:', e);
      parsedDocs = {};
    }
    
    const updatedDocuments = {
      ...parsedDocs,
      ...documents,
    };

    const data = {
      documents: updatedDocuments,
      isFinalStep: true,
    };
    
    try {
      await updateProfileMutation.mutateAsync(data as any);
    } catch (error: any) {
      console.error('Error updating documents:', error);
      alert(error.response?.data?.message || 'Failed to update documents');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Edit Faculty</h1>
                <p className="mt-2 text-orange-100">Update faculty information</p>
              </div>
              <button
                onClick={() => navigate('/faculty')}
                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="px-8 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
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
            {/* Show loading state */}
            {isLoading && (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading faculty data...</p>
              </div>
            )}

            {/* Show error state */}
            {facultyError && !isLoading && (
              <div className="text-center py-8">
                <p className="text-red-600 font-semibold mb-2">Error loading faculty data</p>
                <p className="text-gray-600 text-sm mb-4">{(facultyError as any)?.message || 'Failed to load faculty data'}</p>
                <button
                  onClick={() => navigate('/faculty')}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Back to Faculty
                </button>
              </div>
            )}

            {/* Final safety check - ensure we have valid data before rendering */}
            {!isLoading && !facultyError && (!facultyUser || !facultyUser.id) && (
              <div className="text-center py-8">
                <p className="text-red-600 font-semibold mb-2">Cannot render faculty edit form</p>
                <p className="text-gray-600 text-sm mb-4">Required faculty data is missing.</p>
                <button
                  onClick={() => navigate('/faculty')}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Back to Faculty
                </button>
              </div>
            )}

            {!isLoading && !facultyError && facultyUser && facultyUser.id && (
              <>
            {/* Step 1: Account Information */}
            {currentStep === 1 && (
              <form key={`step1-${facultyUser.id}-${facultyUser.name || ''}-${facultyUser.email || ''}`} onSubmit={handleStep1Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Account Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={facultyUser?.name || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={facultyUser?.email || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={facultyUser?.phone || ''}
                      required
                      pattern="[0-9]{10}"
                      title="Phone number should be 10 digits"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select
                      name="isActive"
                      defaultValue={facultyUser?.isActive !== undefined ? (facultyUser.isActive ? 'true' : 'false') : 'true'}
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
              <form key={`step2-${facultyUser?.id}-${JSON.stringify(personalInfo)}-${parsedDocuments ? 'hasDocs' : 'noDocs'}`} onSubmit={handleStep2Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender *</label>
                    <select
                      name="gender"
                      defaultValue={personalInfo?.gender || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth *</label>
                    <input
                      type="text"
                      name="dateOfBirth"
                      placeholder="DD/MM/YYYY"
                      key={`dateOfBirth-${personalInfo?.dateOfBirth || facultyData?.profile?.dateOfBirth || 'empty'}-${facultyUser?.id || ''}`}
                      defaultValue={(() => {
                        const dob = personalInfo?.dateOfBirth || facultyData?.profile?.dateOfBirth;
                        if (!dob) return '';
                        try {
                          const formatted = formatDateDDMMYYYY(dob);
                          // formatDateDDMMYYYY returns '-' for invalid dates, we want empty string
                          return formatted === '-' ? '' : formatted;
                        } catch (e) {
                          console.error('Error formatting date of birth:', e, 'Date value:', dob);
                          return '';
                        }
                      })()}
                      required
                      pattern="\d{2}/\d{2}/\d{4}"
                      title="Please enter date in DD/MM/YYYY format (e.g., 01/01/1990)"
                      maxLength={10}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      onInput={(e) => {
                        // Auto-format as user types DD/MM/YYYY
                        const input = e.currentTarget;
                        let value = input.value.replace(/\D/g, ''); // Remove non-digits
                        if (value.length >= 2) {
                          value = value.substring(0, 2) + '/' + value.substring(2);
                        }
                        if (value.length >= 5) {
                          value = value.substring(0, 5) + '/' + value.substring(5, 9);
                        }
                        input.value = value;
                      }}
                    />
                    <p className="mt-1 text-xs text-gray-500">Format: DD/MM/YYYY (e.g., 01/01/1990)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nationality *</label>
                    <input
                      type="text"
                      name="nationality"
                      defaultValue={personalInfo?.nationality || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status *</label>
                    <select
                      name="maritalStatus"
                      defaultValue={personalInfo?.maritalStatus || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                    <textarea
                      name="address"
                      rows={3}
                      defaultValue={personalInfo?.address || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                    <input
                      type="text"
                      name="city"
                      defaultValue={personalInfo?.city || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                    <input
                      type="text"
                      name="state"
                      defaultValue={personalInfo?.state || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code *</label>
                    <input
                      type="text"
                      name="postalCode"
                      defaultValue={personalInfo?.postalCode || ''}
                      required
                      pattern="[0-9]{5,6}"
                      title="Postal code should be 5-6 digits"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
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
              <form key={`step3-${facultyUser?.id}-${employmentInfo?.department || ''}-${parsedExpertise || ''}`} onSubmit={handleStep3Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Employment Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                    <input
                      type="text"
                      name="department"
                      defaultValue={employmentInfo?.department || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Designation *</label>
                    <input
                      type="text"
                      name="designation"
                      defaultValue={employmentInfo?.designation || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining *</label>
                    <input
                      type="date"
                      name="dateOfJoining"
                      defaultValue={employmentInfo?.dateOfJoining ? employmentInfo.dateOfJoining.split('T')[0] : ''}
                      required
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type *</label>
                    <select
                      name="employmentType"
                      defaultValue={employmentInfo?.employmentType || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select</option>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reporting Manager</label>
                    <input
                      type="text"
                      name="reportingManager"
                      defaultValue={employmentInfo?.reportingManager || ''}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Location *</label>
                    <input
                      type="text"
                      name="workLocation"
                      defaultValue={employmentInfo?.workLocation || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expertise / Specialization *</label>
                    <textarea
                      name="expertise"
                      rows={3}
                      required
                      key={`expertise-${parsedExpertise || 'empty'}`}
                      defaultValue={parsedExpertise}
                      placeholder="Describe your areas of expertise and specialization"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability *</label>
                    <textarea
                      name="availability"
                      rows={2}
                      required
                      key={`availability-${parsedAvailability || 'empty'}`}
                      defaultValue={parsedAvailability}
                      placeholder="e.g., Monday-Friday 9 AM - 5 PM"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
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

            {/* Step 4: Software Proficiency */}
            {currentStep === 4 && (
              <form key={`step4-${facultyUser?.id}-${selectedSoftwares.join(',') || ''}`} onSubmit={handleStep4Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Software Proficiency</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Software Proficiency <span className="text-gray-500">(Select all applicable)</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
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
                            checked={selectedSoftwares.includes(software)}
                            onChange={(e) => {
                              if (software === 'Other') {
                                setShowOtherSoftware(e.target.checked);
                                if (!e.target.checked) {
                                  setOtherSoftware('');
                                }
                              }
                              if (e.target.checked) {
                                setSelectedSoftwares([...selectedSoftwares, software]);
                              } else {
                                setSelectedSoftwares(selectedSoftwares.filter(s => s !== software));
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  )}
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

            {/* Step 5: Bank Details */}
            {currentStep === 5 && (
              <form key={`step5-${facultyUser?.id}-${bankInfo?.accountNumber || ''}-${bankInfo?.panNumber || ''}`} onSubmit={handleStep5Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Bank Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                    <input
                      type="text"
                      name="bankName"
                      defaultValue={bankInfo?.bankName || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
                    <input
                      type="text"
                      name="accountNumber"
                      defaultValue={bankInfo?.accountNumber || ''}
                      required
                      pattern="[0-9]{9,18}"
                      title="Account number should be 9-18 digits"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code *</label>
                    <input
                      type="text"
                      name="ifscCode"
                      defaultValue={bankInfo?.ifscCode || ''}
                      required
                      pattern="[A-Z]{4}0[A-Z0-9]{6}"
                      title="IFSC code should be 11 characters (e.g., ABCD0123456)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                    <input
                      type="text"
                      name="branch"
                      defaultValue={bankInfo?.branch || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number *</label>
                    <input
                      type="text"
                      name="panNumber"
                      maxLength={10}
                      defaultValue={bankInfo?.panNumber || ''}
                      required
                      pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}"
                      title="PAN should be 10 characters (e.g., ABCDE1234F)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                      style={{ textTransform: 'uppercase' }}
                      onChange={(e) => {
                        // Force uppercase so the value always matches expected PAN format
                        e.target.value = e.target.value.toUpperCase();
                      }}
                    />
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

            {/* Step 6: Expertise & Availability */}
            {currentStep === 6 && (
              <form key={`step6-${facultyUser?.id}-${parsedExpertise || ''}-${parsedAvailability || ''}`} onSubmit={handleStep6Submit} className="space-y-6">
                <h2 className="text-2xl font-bold mb-6">Emergency Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name *</label>
                    <input
                      type="text"
                      name="emergencyContactName"
                      defaultValue={emergencyInfo?.emergencyContactName || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Relationship *</label>
                    <input
                      type="text"
                      name="emergencyRelationship"
                      placeholder="e.g., Father, Mother, Spouse, Guardian"
                      defaultValue={emergencyInfo?.emergencyRelationship || ''}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      name="emergencyPhoneNumber"
                      defaultValue={emergencyInfo?.emergencyPhoneNumber || ''}
                      required
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      placeholder="10 digit phone number"
                      title="Phone number should be 10 digits"
                      onChange={(e) => {
                        // Only allow digits and limit to 10
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        e.target.value = value;
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Enter 10 digit phone number</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alternate Phone Number</label>
                    <input
                      type="tel"
                      name="emergencyAlternatePhone"
                      defaultValue={emergencyInfo?.emergencyAlternatePhone || ''}
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      placeholder="10 digit phone number (optional)"
                      title="Phone number should be 10 digits"
                      onChange={(e) => {
                        // Only allow digits and limit to 10
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        e.target.value = value;
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Enter 10 digit phone number (optional)</p>
                  </div>
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
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 7: Documents */}
            {currentStep === 7 && (
              <form key={`step7-${facultyUser?.id}`} onSubmit={handleStep7Submit} className="space-y-6">
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
                    const currentPanCard = panCard || parsedDocuments?.panCard || null;
                    
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
                    const currentAadharCard = aadharCard || parsedDocuments?.aadharCard || null;
                    
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
                    const currentOtherDocs = otherDocuments.length > 0 
                      ? otherDocuments 
                      : (parsedDocuments?.otherDocuments && Array.isArray(parsedDocuments.otherDocuments) 
                          ? parsedDocuments.otherDocuments.filter((doc: any) => doc && doc.url)
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
                    onClick={() => setCurrentStep(6)}
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
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
