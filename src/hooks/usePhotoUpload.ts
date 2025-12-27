import { useState } from 'react';
import { uploadAPI } from '../api/upload.api';
import { getImageUrl } from '../utils/imageUtils';

export interface PhotoData {
  name: string;
  url: string;
  size?: number;
}

export const usePhotoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = async (file: File): Promise<PhotoData | null> => {
    // Validate file
    if (!file) {
      setError('No file selected');
      return null;
    }

    // Validate file type - allow more types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError(`Please select a valid image file (JPG, PNG, WEBP, or GIF). Selected: ${file.type}`);
      return null;
    }

    // Validate file size (10MB max to match backend)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Image size must be less than 10MB');
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      console.log('Starting photo upload:', { name: file.name, type: file.type, size: file.size });
      
      const uploadResponse = await uploadAPI.uploadFile(file);
      
      console.log('Upload response received:', uploadResponse);
      
      if (!uploadResponse) {
        throw new Error('No response from server');
      }

      if (uploadResponse.status !== 'success') {
        throw new Error(uploadResponse?.message || 'Upload failed');
      }

      if (!uploadResponse.data?.files || uploadResponse.data.files.length === 0) {
        throw new Error('No file returned from upload');
      }

      const uploadedFile = uploadResponse.data.files[0];
      
      console.log('Uploaded file data:', uploadedFile);
      
      // Return clean photo data with relative URL
      const photoData: PhotoData = {
        name: uploadedFile.originalName,
        url: uploadedFile.url, // Relative URL like /uploads/general/filename.jpg
        size: uploadedFile.size,
      };

      console.log('Photo upload successful:', photoData);
      setUploading(false);
      return photoData;
    } catch (err: any) {
      console.error('Photo upload error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });
      
      const errorMessage = err.response?.data?.message || err.message || 'Failed to upload photo';
      setError(errorMessage);
      setUploading(false);
      return null;
    }
  };

  const getPhotoUrl = (photoUrl: string | null | undefined): string | null => {
    if (!photoUrl) return null;
    return getImageUrl(photoUrl);
  };

  return {
    uploadPhoto,
    uploading,
    error,
    getPhotoUrl,
  };
};

