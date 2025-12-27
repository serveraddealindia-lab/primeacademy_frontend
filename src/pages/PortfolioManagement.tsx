import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { portfolioAPI, Portfolio, CreatePortfolioRequest, ApprovePortfolioRequest } from '../api/portfolio.api';
import { studentAPI } from '../api/student.api';
import { batchAPI } from '../api/batch.api';
import { enrollmentAPI } from '../api/enrollment.api';
import { uploadAPI } from '../api/upload.api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { getImageUrl } from '../utils/imageUtils';

export const PortfolioManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; type: 'image' | 'pdf'; name?: string }>>([]);
  const [videoLinks, setVideoLinks] = useState<string[]>(['']);
  const [isUploading, setIsUploading] = useState(false);
  const addingVideoLinkRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // Filter by status: 'all', 'pending', 'approved', 'rejected'

  // Fetch portfolios - backend automatically filters by student ID for students
  const { data: portfoliosData, isLoading, error: portfoliosError } = useQuery({
    queryKey: ['portfolios', user?.id, user?.role, statusFilter],
    queryFn: async () => {
      try {
        // For students, backend automatically filters to their own portfolios
        // Don't pass studentId - let backend handle it to avoid conflicts
        // For admins/superadmins/faculty, show all portfolios (or filtered by status if selected)
        const params: { status?: string } = {};
        if (statusFilter !== 'all' && (user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'faculty')) {
          params.status = statusFilter;
        }
        const result = await portfolioAPI.getAllPortfolios(params);
        console.log('Portfolio API Response:', result);
        return result;
      } catch (error: any) {
        console.error('Portfolio API Error:', error);
        throw error;
      }
    },
    enabled: !!user, // Only run query when user is available
    retry: 1,
  });

  // Fetch students and batches for form
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentAPI.getAllStudents(),
    enabled: user?.role !== 'student', // Only fetch for admins/faculty
  });

  // For students, fetch their enrollments to get their batches
  const { data: enrollmentsData } = useQuery({
    queryKey: ['student-enrollments', user?.id],
    queryFn: () => enrollmentAPI.getAllEnrollments({ studentId: user?.id }),
    enabled: user?.role === 'student' && !!user?.id,
  });

  // For admins/faculty, fetch all batches
  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchAPI.getAllBatches(),
    enabled: user?.role !== 'student',
  });

  const createPortfolioMutation = useMutation({
    mutationFn: ({ studentId, data }: { studentId: number; data: CreatePortfolioRequest }) =>
      portfolioAPI.createPortfolio(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.refetchQueries({ queryKey: ['portfolios'] });
      setIsCreateModalOpen(false);
      setUploadedFiles([]);
      setVideoLinks(['']);
      alert('Portfolio created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create portfolio');
    },
  });

  const approvePortfolioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApprovePortfolioRequest }) =>
      portfolioAPI.approvePortfolio(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setIsApproveModalOpen(false);
      setSelectedPortfolio(null);
      alert('Portfolio status updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to update portfolio');
    },
  });

  const allPortfolios = portfoliosData?.data?.portfolios || [];
  const students = studentsData?.data?.students || [];
  
  // For students, get batches from enrollments; for admins/faculty, get all batches
  const batches = user?.role === 'student' 
    ? (enrollmentsData?.data || []).map((enrollment: any) => enrollment.batch).filter((b: any) => b)
    : (batchesData?.data || []);

  // Debug logging
  console.log('Portfolio Management Debug:', {
    userRole: user?.role,
    userId: user?.id,
    userObject: user,
    isLoading,
    portfoliosCount: allPortfolios.length,
    portfolios: allPortfolios.map(p => ({
      id: p.id,
      studentId: p.studentId,
      status: p.status,
      hasFiles: !!p.files,
      filesType: typeof p.files
    })),
    error: portfoliosError,
    rawData: portfoliosData,
    responseStatus: portfoliosData?.status,
    responseData: portfoliosData?.data
  });

  // Helper function to normalize files (handle both array and object formats)
  const normalizeFiles = (files: any): string[] => {
    if (!files) return [];
    
    // If it's already an array, filter out empty/null values
    if (Array.isArray(files)) {
      return files.filter((f): f is string => typeof f === 'string' && f.length > 0);
    }
    
    // If it's an object (but not null), get all values
    if (typeof files === 'object' && files !== null) {
      // Check if it's an array-like object
      if (files.length !== undefined) {
        return Array.from(files).filter((f): f is string => typeof f === 'string' && f.length > 0);
      }
      // Regular object - get all values
      const values = Object.values(files);
      return values.filter((f): f is string => typeof f === 'string' && f.length > 0);
    }
    
    // If it's a string, try to parse it as JSON
    if (typeof files === 'string') {
      // First check if it's already a valid URL (not JSON)
      if (files.startsWith('http://') || files.startsWith('https://') || files.startsWith('/')) {
        return [files];
      }
      
      try {
        const parsed = JSON.parse(files);
        if (Array.isArray(parsed)) {
          return parsed.filter((f): f is string => typeof f === 'string' && f.length > 0);
        }
        if (typeof parsed === 'object' && parsed !== null) {
          const values = Object.values(parsed);
          return values.filter((f): f is string => typeof f === 'string' && f.length > 0);
        }
        // If parsed is a string, return it
        if (typeof parsed === 'string' && parsed.length > 0) {
          return [parsed];
        }
      } catch (e) {
        // If parsing fails, treat as single URL if it looks like one
        if (files.length > 0 && (files.startsWith('http') || files.startsWith('/'))) {
          return [files];
        }
        // Otherwise return empty
        return [];
      }
    }
    
    return [];
  };

  // Helper function to check if URL is an image
  const isImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase();
    // Check for image extensions
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url)) return true;
    // Check for image in path
    if (lowerUrl.includes('/image') || lowerUrl.includes('/img') || lowerUrl.includes('image/')) return true;
    // Check for image mime type in URL
    if (lowerUrl.includes('image/jpeg') || lowerUrl.includes('image/png') || lowerUrl.includes('image/gif')) return true;
    return false;
  };

  // Helper function to check if URL is a PDF
  const isPdfUrl = (url: string): boolean => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('application/pdf');
  };

  // Filter portfolios based on search query
  const portfolios = allPortfolios.filter((portfolio) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      portfolio.student?.name?.toLowerCase().includes(query) ||
      portfolio.student?.email?.toLowerCase().includes(query) ||
      portfolio.batch?.title?.toLowerCase().includes(query) ||
      portfolio.status?.toLowerCase().includes(query)
    );
  });

  const handleCreatePortfolio = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // For students, use their own ID; for admins, use selected student ID
    const studentId = user?.role === 'student' 
      ? (user.id || user.userId) 
      : parseInt(formData.get('studentId') as string);
    
    if (!studentId) {
      alert('Student ID is required');
      return;
    }
    
    // Collect video links
    const videoUrls = videoLinks
      .map(link => link.trim())
      .filter(link => link.length > 0);
    
    // Validate that at least one file or video is provided
    if (uploadedFiles.length === 0 && videoUrls.length === 0) {
      alert('Please upload at least one image/PDF or provide a video link');
      return;
    }
    
    // Build files array from uploaded files (backend expects array of URLs)
    const filesArray = uploadedFiles.length > 0 ? uploadedFiles.map(f => f.url) : undefined;
    
    // Get first video URL (backend accepts youtubeUrl as single string)
    const youtubeUrl = videoUrls.length > 0 ? videoUrls[0] : undefined;
    
    const data: CreatePortfolioRequest = {
      batchId: parseInt(formData.get('batchId') as string),
      files: filesArray, // Send as array - backend will convert to JSON
      youtubeUrl,
    };
    
    createPortfolioMutation.mutate({
      studentId,
      data,
    });
  };
  
  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const addVideoLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (addingVideoLinkRef.current) return;
    addingVideoLinkRef.current = true;
    
    setVideoLinks(prev => [...prev, '']);
    
    // Reset flag after state update
    setTimeout(() => {
      addingVideoLinkRef.current = false;
    }, 100);
  };
  
  const removeVideoLink = (index: number) => {
    setVideoLinks(prev => prev.filter((_, i) => i !== index));
  };
  
  const updateVideoLink = (index: number, value: string) => {
    setVideoLinks(prev => {
      const newLinks = [...prev];
      newLinks[index] = value;
      return newLinks;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate file size (10MB = 10 * 1024 * 1024 bytes - matches backend limit)
    const maxSize = 10 * 1024 * 1024;
    const invalidFiles = Array.from(files).filter(file => file.size > maxSize);
    
    if (invalidFiles.length > 0) {
      alert(`Some files exceed 10MB limit: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Validate file types (images and PDFs)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    const invalidTypes = Array.from(files).filter(file => !validTypes.includes(file.type));
    
    if (invalidTypes.length > 0) {
      alert(`Some files are not valid (only images and PDFs allowed): ${invalidTypes.map(f => f.name).join(', ')}`);
      return;
    }

    setIsUploading(true);
    try {
      const fileArray = Array.from(files);
      const response = await uploadAPI.uploadMultipleFiles(fileArray);
      
      // Add uploaded files with their types for preview
      const newFiles = fileArray.map((file, idx) => ({
        url: response.data.urls[idx],
        type: file.type === 'application/pdf' ? 'pdf' as const : 'image' as const,
        name: file.name,
      }));
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleApprovePortfolio = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPortfolio) return;
    const formData = new FormData(e.currentTarget);
    const data: ApprovePortfolioRequest = {
      approve: formData.get('approve') === 'true',
    };
    approvePortfolioMutation.mutate({ id: selectedPortfolio.id, data });
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
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 md:px-8 py-4 md:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Portfolio Management</h1>
                <p className="mt-2 text-orange-100">Student portfolios</p>
              </div>
              {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'student') && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                >
                  + Create Portfolio
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Search Bar and Filters */}
            <div className="mb-4 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search portfolios by student, batch, software, or status..."
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
              {/* Status Filter for Admins/SuperAdmins/Faculty */}
              {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'faculty') && (
                <div className="flex-shrink-0">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>
            {/* Portfolio Summary for Admins/SuperAdmins */}
            {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'faculty') && allPortfolios.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">{allPortfolios.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Pending:</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                    {allPortfolios.filter(p => p.status === 'pending').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Approved:</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    {allPortfolios.filter(p => p.status === 'approved').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Rejected:</span>
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                    {allPortfolios.filter(p => p.status === 'rejected').length}
                  </span>
                </div>
                {statusFilter !== 'all' && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <span>Filtered by: {statusFilter}</span>
                  </div>
                )}
              </div>
            )}
            {searchQuery && (
              <p className="mb-4 text-sm text-gray-600">
                Showing {portfolios.length} of {allPortfolios.length} portfolios matching search
              </p>
            )}

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading portfolios...</p>
              </div>
            ) : portfoliosError ? (
              <div className="text-center py-12">
                <p className="text-red-600 text-lg mb-2">Error loading portfolios</p>
                <p className="text-gray-500 text-sm">
                  {portfoliosError instanceof Error ? portfoliosError.message : 'Unknown error'}
                </p>
                <button
                  onClick={() => queryClient.refetchQueries({ queryKey: ['portfolios'] })}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Retry
                </button>
              </div>
            ) : portfolios.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'No portfolios found matching your search' : 'No portfolios found'}
                </p>
                {user?.role === 'student' && (
                  <p className="text-gray-400 text-sm mt-2">
                    {allPortfolios.length === 0 
                      ? 'You haven\'t created any portfolios yet. Click "Create Portfolio" to get started.'
                      : 'No portfolios match your search criteria.'}
                  </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolios.map((portfolio) => (
                  <div key={portfolio.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{portfolio.student?.name || `Student ${portfolio.studentId}`}</h3>
                        <p className="text-sm text-gray-600">{portfolio.batch?.title || `Batch ${portfolio.batchId}`}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        portfolio.status === 'approved' ? 'bg-green-100 text-green-800' :
                        portfolio.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {portfolio.status}
                      </span>
                    </div>
                    <div className="mb-4">
                      {(() => {
                        const files = normalizeFiles(portfolio.files);
                        const imageFiles = files.filter(isImageUrl);
                        const pdfFiles = files.filter(isPdfUrl);
                        const otherFiles = files.filter(f => !isImageUrl(f) && !isPdfUrl(f));
                        const hasAnyFiles = files.length > 0 || portfolio.pdfUrl || portfolio.youtubeUrl;
                        
                        // Debug logging
                        console.log('Portfolio data:', {
                          portfolioId: portfolio.id,
                          status: portfolio.status,
                          rawFiles: portfolio.files,
                          filesType: typeof portfolio.files,
                          normalizedFiles: files,
                          imageFiles,
                          pdfFiles,
                          otherFiles,
                          hasAnyFiles
                        });
                        
                        return (
                          <div className="space-y-2">
                            {imageFiles.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 mb-2">{imageFiles.length} image(s)</p>
                                {/* Large preview of first image */}
                                {imageFiles.length > 0 && (
                                  <div className="mb-3">
                                    {(() => {
                                      const firstImageUrl = imageFiles[0];
                                      
                                      // Normalize the URL - if it's just a filename, prepend /uploads/general/
                                      let normalizedUrl = firstImageUrl;
                                      if (firstImageUrl && !firstImageUrl.startsWith('/') && !firstImageUrl.startsWith('http')) {
                                        // It's just a filename, add the path
                                        normalizedUrl = `/uploads/general/${firstImageUrl}`;
                                      } else if (firstImageUrl && !firstImageUrl.startsWith('/uploads/') && !firstImageUrl.startsWith('http')) {
                                        // It might be missing /uploads prefix
                                        normalizedUrl = firstImageUrl.startsWith('/') ? `/uploads${firstImageUrl}` : `/uploads/${firstImageUrl}`;
                                      }
                                      
                                      const fullUrl = getImageUrl(normalizedUrl) || normalizedUrl;
                                      const imageId = firstImageUrl.split('/').pop() || firstImageUrl.substring(firstImageUrl.length - 8);
                                      
                                      // Log for debugging
                                      console.log('🖼️ Image URL Debug:', {
                                        original: firstImageUrl,
                                        normalized: normalizedUrl,
                                        fullUrl,
                                        imageId
                                      });
                                      
                                      // Build list of potential URLs to try
                                      const buildAlternativeUrls = (url: string): string[] => {
                                        const alternatives: string[] = [];
                                        
                                        // Add the original fullUrl first
                                        alternatives.push(fullUrl);
                                        
                                        // If it's a relative path, try different base URLs
                                        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
                                          const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
                                          const baseUrl = apiBase.replace('/api', '').replace(/\/$/, '');
                                          
                                          // Try with API base URL
                                          if (url.startsWith('/uploads/') || url.includes('uploads')) {
                                            alternatives.push(`${baseUrl}${url.startsWith('/') ? url : '/' + url}`);
                                          }
                                          
                                          // Try with window origin
                                          alternatives.push(`${window.location.origin}${url.startsWith('/') ? url : '/' + url}`);
                                          
                                          // Try with /api/uploads path (though this shouldn't be needed)
                                          if (url.startsWith('/uploads/')) {
                                            alternatives.push(`${apiBase.replace('/api', '')}${url}`);
                                            alternatives.push(`${window.location.origin}/api${url}`);
                                          }
                                          
                                          // If URL doesn't start with /uploads/, try adding it
                                          if (!url.startsWith('/uploads/')) {
                                            const withUploads = url.startsWith('/') ? `/uploads${url}` : `/uploads/${url}`;
                                            alternatives.push(`${baseUrl}${withUploads}`);
                                            alternatives.push(`${window.location.origin}${withUploads}`);
                                          }
                                        } else if (url.startsWith('http')) {
                                          // If it's already a full URL, try it as-is
                                          alternatives.push(url);
                                        }
                                        
                                        // Remove duplicates
                                        return Array.from(new Set(alternatives));
                                      };
                                      
                                      const alternativeUrls = buildAlternativeUrls(normalizedUrl);
                                      
                                      console.log('🔄 Alternative URLs to try:', alternativeUrls);
                                      
                                      return (
                                        <div className="relative group">
                                          <img
                                            src={alternativeUrls[0]}
                                            alt="Portfolio preview"
                                            className="w-full h-48 object-cover rounded border-2 border-orange-300 cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => {
                                              window.open(alternativeUrls[0], '_blank');
                                            }}
                                            onLoad={() => {
                                              console.log('✅ Main image loaded successfully:', alternativeUrls[0]);
                                              // Hide placeholder if image loads
                                              const placeholder = document.querySelector(`[data-placeholder-for="${firstImageUrl}"]`) as HTMLElement;
                                              if (placeholder) {
                                                placeholder.style.display = 'none';
                                              }
                                            }}
                                            onError={(e) => {
                                              console.error('❌ Main image failed to load:', {
                                                original: firstImageUrl,
                                                attemptedUrl: alternativeUrls[0],
                                                imageId
                                              });
                                              const target = e.target as HTMLImageElement;
                                              
                                              // Hide image and show placeholder
                                              target.style.display = 'none';
                                              const placeholder = document.querySelector(`[data-placeholder-for="${firstImageUrl}"]`) as HTMLElement;
                                              if (placeholder) {
                                                placeholder.style.display = 'flex';
                                              }
                                              
                                              // Try each alternative URL
                                              let attemptIndex = 1;
                                              const tryNextAlternative = () => {
                                                if (attemptIndex < alternativeUrls.length) {
                                                  const altUrl = alternativeUrls[attemptIndex];
                                                  console.log(`🔄 Trying alternative URL ${attemptIndex + 1}/${alternativeUrls.length}:`, altUrl);
                                                  
                                                  const testImg = new Image();
                                                  testImg.onload = () => {
                                                    console.log('✅ Alternative URL worked:', altUrl);
                                                    target.src = altUrl;
                                                    target.style.display = 'block';
                                                    if (placeholder) placeholder.style.display = 'none';
                                                  };
                                                  testImg.onerror = () => {
                                                    console.error(`❌ Alternative URL ${attemptIndex + 1} failed:`, altUrl);
                                                    attemptIndex++;
                                                    tryNextAlternative();
                                                  };
                                                  testImg.src = altUrl;
                                                } else {
                                                  console.error('❌ All alternative URLs failed. Showing placeholder.');
                                                }
                                              };
                                              
                                              if (alternativeUrls.length > 1) {
                                                tryNextAlternative();
                                              }
                                            }}
                                          />
                                          <div 
                                            data-placeholder-for={firstImageUrl}
                                            className="w-full h-48 bg-orange-100 rounded border-2 border-orange-300 flex flex-col items-center justify-center text-sm text-gray-700 hidden cursor-pointer hover:bg-orange-200 transition-colors"
                                            title={`Click to open: ${fullUrl}`}
                                            onClick={() => {
                                              window.open(fullUrl, '_blank');
                                            }}
                                          >
                                            <span className="text-center font-medium mb-2">Click to View</span>
                                            <span className="text-xs text-gray-500" title={firstImageUrl}>
                                              {imageId}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                {/* Thumbnail grid for additional images */}
                                {imageFiles.length > 1 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {imageFiles.slice(1, 5).map((url, idx) => {
                                      // Normalize the URL - if it's just a filename, prepend /uploads/general/
                                      let normalizedUrl = url;
                                      if (url && !url.startsWith('/') && !url.startsWith('http')) {
                                        // It's just a filename, add the path
                                        normalizedUrl = `/uploads/general/${url}`;
                                      } else if (url && !url.startsWith('/uploads/') && !url.startsWith('http')) {
                                        // It might be missing /uploads prefix
                                        normalizedUrl = url.startsWith('/') ? `/uploads${url}` : `/uploads/${url}`;
                                      }
                                      
                                      const fullUrl = getImageUrl(normalizedUrl) || normalizedUrl;
                                      const imageId = url.split('/').pop() || url.substring(url.length - 8);
                                      
                                      // Build list of potential URLs to try
                                      const buildThumbnailUrls = (imgUrl: string): string[] => {
                                        const alternatives: string[] = [];
                                        
                                        // Add the original fullUrl first
                                        alternatives.push(fullUrl);
                                        
                                        // If it's a relative path, try different base URLs
                                        if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://') && !imgUrl.startsWith('data:')) {
                                          const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
                                          const baseUrl = apiBase.replace('/api', '').replace(/\/$/, '');
                                          
                                          // Try with API base URL
                                          if (imgUrl.startsWith('/uploads/') || imgUrl.includes('uploads')) {
                                            alternatives.push(`${baseUrl}${imgUrl.startsWith('/') ? imgUrl : '/' + imgUrl}`);
                                          }
                                          
                                          // Try with window origin
                                          alternatives.push(`${window.location.origin}${imgUrl.startsWith('/') ? imgUrl : '/' + imgUrl}`);
                                          
                                          // Try with /api/uploads path
                                          if (imgUrl.startsWith('/uploads/')) {
                                            alternatives.push(`${apiBase.replace('/api', '')}${imgUrl}`);
                                            alternatives.push(`${window.location.origin}/api${imgUrl}`);
                                          }
                                          
                                          // If URL doesn't start with /uploads/, try adding it
                                          if (!imgUrl.startsWith('/uploads/')) {
                                            const withUploads = imgUrl.startsWith('/') ? `/uploads${imgUrl}` : `/uploads/${imgUrl}`;
                                            alternatives.push(`${baseUrl}${withUploads}`);
                                            alternatives.push(`${window.location.origin}${withUploads}`);
                                          }
                                        } else if (imgUrl.startsWith('http')) {
                                          // If it's already a full URL, try it as-is
                                          alternatives.push(imgUrl);
                                        }
                                        
                                        // Remove duplicates
                                        return Array.from(new Set(alternatives));
                                      };
                                      
                                      const thumbnailUrls = buildThumbnailUrls(normalizedUrl);
                                      
                                      return (
                                        <div key={idx} className="relative group">
                                          <img
                                            src={thumbnailUrls[0]}
                                            alt={`Portfolio image ${idx + 2}`}
                                            className="w-20 h-20 object-cover rounded border-2 border-gray-300 cursor-pointer hover:opacity-80 hover:border-orange-500 transition-all"
                                            onClick={() => {
                                              window.open(thumbnailUrls[0], '_blank');
                                            }}
                                            onLoad={() => {
                                              // Hide placeholder if image loads
                                              const placeholder = document.querySelector(`[data-thumbnail-placeholder-for="${url}"]`) as HTMLElement;
                                              if (placeholder) {
                                                placeholder.style.display = 'none';
                                              }
                                            }}
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              
                                              // Hide image and show placeholder
                                              target.style.display = 'none';
                                              const placeholder = document.querySelector(`[data-thumbnail-placeholder-for="${url}"]`) as HTMLElement;
                                              if (placeholder) {
                                                placeholder.style.display = 'flex';
                                              }
                                              
                                              // Try each alternative URL
                                              let attemptIndex = 1;
                                              const tryNextAlternative = () => {
                                                if (attemptIndex < thumbnailUrls.length) {
                                                  const altUrl = thumbnailUrls[attemptIndex];
                                                  
                                                  const testImg = new Image();
                                                  testImg.onload = () => {
                                                    target.src = altUrl;
                                                    target.style.display = 'block';
                                                    if (placeholder) placeholder.style.display = 'none';
                                                  };
                                                  testImg.onerror = () => {
                                                    attemptIndex++;
                                                    tryNextAlternative();
                                                  };
                                                  testImg.src = altUrl;
                                                }
                                              };
                                              
                                              if (thumbnailUrls.length > 1) {
                                                tryNextAlternative();
                                              }
                                            }}
                                          />
                                          <div 
                                            data-thumbnail-placeholder-for={url}
                                            className="w-20 h-20 bg-orange-100 rounded border-2 border-orange-300 flex flex-col items-center justify-center text-xs text-gray-700 hidden cursor-pointer hover:bg-orange-200 transition-colors"
                                            title={`Click to open: ${fullUrl}`}
                                            onClick={() => {
                                              window.open(fullUrl, '_blank');
                                            }}
                                          >
                                            <span className="text-center px-1 text-[10px] font-medium">Click to<br/>View</span>
                                            <span className="text-[8px] text-gray-500 mt-1 truncate w-full px-1" title={url}>
                                              {imageId.substring(0, 8)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {imageFiles.length > 5 && (
                                      <div 
                                        className="w-20 h-20 bg-gray-100 rounded border-2 border-gray-300 flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                        title={`${imageFiles.length - 5} more images`}
                                      >
                                        +{imageFiles.length - 5}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {pdfFiles.length > 0 && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="text-lg">📄</span>
                                <span>{pdfFiles.length} PDF file(s)</span>
                              </div>
                            )}
                            {portfolio.pdfUrl && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="text-lg">📄</span>
                                <a 
                                  href={getImageUrl(portfolio.pdfUrl) || portfolio.pdfUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:underline"
                                >
                                  Portfolio PDF
                                </a>
                              </div>
                            )}
                            {portfolio.youtubeUrl && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="text-lg">▶️</span>
                                <a 
                                  href={portfolio.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:underline"
                                >
                                  YouTube Video
                                </a>
                              </div>
                            )}
                            {otherFiles.length > 0 && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="text-lg">📎</span>
                                <span>{otherFiles.length} other file(s)</span>
                              </div>
                            )}
                            {files.length > 0 && imageFiles.length === 0 && pdfFiles.length === 0 && (
                              <div className="text-xs text-gray-500">
                                {files.length} file(s) - unable to preview
                              </div>
                            )}
                            {!hasAnyFiles && (
                              <p className="text-sm text-gray-500">No files</p>
                            )}
                            {portfolio.approvedAt && (
                              <p className="text-xs text-gray-500 mt-2">
                                Approved: {formatDateDDMMYYYY(portfolio.approvedAt)}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'faculty') && portfolio.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedPortfolio(portfolio);
                          setIsApproveModalOpen(true);
                        }}
                        className="w-full px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Portfolio Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Portfolio</h2>
            <form onSubmit={handleCreatePortfolio}>
              {/* Only show student dropdown for admins/superadmins/faculty */}
              {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'faculty') && (
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
              )}
              {/* For students, show their name as read-only */}
              {user?.role === 'student' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                  <input
                    type="text"
                    value={user.name || 'You'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                  <input type="hidden" name="studentId" value={user.id || user.userId} />
                </div>
              )}
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
                      {batch.title}
                    </option>
                  ))}
                </select>
              </div>
              {/* File Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images & PDFs (Max 10MB per file)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
                  multiple
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                />
                {isUploading && (
                  <p className="text-xs text-orange-600 mt-1">Uploading files...</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Upload image files (JPG, PNG, GIF, WebP) or PDF files - Max 10MB per file</p>
              </div>

              {/* Uploaded Files Preview */}
              {uploadedFiles.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uploaded Files ({uploadedFiles.length})
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.type === 'image' ? (
                          <div className="relative">
                            <img
                              src={getImageUrl(file.url) || file.url}
                              alt={file.name || `Image ${index + 1}`}
                              className="w-full h-32 object-cover rounded border border-gray-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeUploadedFile(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="w-full h-32 bg-gray-100 rounded border border-gray-300 flex flex-col items-center justify-center">
                              <span className="text-4xl mb-1">📄</span>
                              <span className="text-xs text-gray-600 text-center px-2 truncate w-full" title={file.name}>
                                {file.name || 'PDF'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeUploadedFile(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Video Links */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Links (YouTube)
                </label>
                {videoLinks.map((link, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateVideoLink(index, e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {videoLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeVideoLink(index);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVideoLink}
                  className="mt-2 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  + Add Video Link
                </button>
                <p className="text-xs text-gray-500 mt-1">Enter YouTube video URLs</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createPortfolioMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {createPortfolioMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setUploadedFiles([]);
                    setVideoLinks(['']);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Portfolio Modal */}
      {isApproveModalOpen && selectedPortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Review Portfolio</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Student:</span> {selectedPortfolio.student?.name || `Student ${selectedPortfolio.studentId}`}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Batch:</span> {selectedPortfolio.batch?.title || `Batch ${selectedPortfolio.batchId}`}
              </p>
              <div className="mt-4">
                {(() => {
                  const files = normalizeFiles(selectedPortfolio.files);
                  const imageFiles = files.filter(isImageUrl);
                  const pdfFiles = files.filter(isPdfUrl);
                  const otherFiles = files.filter(f => !isImageUrl(f) && !isPdfUrl(f));
                  
                  return (
                    <div className="space-y-4">
                      {imageFiles.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Images ({imageFiles.length}):</p>
                          <div className="bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {imageFiles.map((url, idx) => {
                                // Normalize the URL - if it's just a filename, prepend /uploads/general/
                                let normalizedUrl = url;
                                if (url && !url.startsWith('/') && !url.startsWith('http')) {
                                  normalizedUrl = `/uploads/general/${url}`;
                                } else if (url && !url.startsWith('/uploads/') && !url.startsWith('http')) {
                                  normalizedUrl = url.startsWith('/') ? `/uploads${url}` : `/uploads/${url}`;
                                }
                                const imageUrl = getImageUrl(normalizedUrl) || normalizedUrl;
                                
                                return (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={imageUrl}
                                      alt={`Portfolio image ${idx + 1}`}
                                      className="w-full h-32 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => window.open(imageUrl, '_blank')}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center">
                                      <span className="text-white text-xs opacity-0 group-hover:opacity-100">Click to view</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {pdfFiles.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">PDF Files ({pdfFiles.length}):</p>
                          <div className="bg-gray-50 p-3 rounded space-y-2">
                            {pdfFiles.map((url, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50">
                                <span className="text-2xl">📄</span>
                                <div className="flex-1 min-w-0">
                                  <a
                                    href={getImageUrl(url) || url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:underline text-sm truncate block"
                                  >
                                    {url.split('/').pop() || `PDF ${idx + 1}`}
                                  </a>
                                </div>
                                <a
                                  href={getImageUrl(url) || url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                                >
                                  Open
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {selectedPortfolio.pdfUrl && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Portfolio PDF:</p>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50">
                              <span className="text-2xl">📄</span>
                              <div className="flex-1 min-w-0">
                                <a
                                  href={getImageUrl(selectedPortfolio.pdfUrl) || selectedPortfolio.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:underline text-sm truncate block"
                                >
                                  {selectedPortfolio.pdfUrl.split('/').pop() || 'Portfolio PDF'}
                                </a>
                              </div>
                              <a
                                href={getImageUrl(selectedPortfolio.pdfUrl) || selectedPortfolio.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                              >
                                Open
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {selectedPortfolio.youtubeUrl && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">YouTube Video:</p>
                          <div className="bg-gray-50 p-3 rounded">
                            <a
                              href={selectedPortfolio.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-orange-600 hover:underline"
                            >
                              <span className="text-lg">▶️</span>
                              <span className="text-sm truncate">{selectedPortfolio.youtubeUrl}</span>
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {otherFiles.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Other Files ({otherFiles.length}):</p>
                          <div className="bg-gray-50 p-3 rounded space-y-1 max-h-40 overflow-y-auto">
                            {otherFiles.map((url, idx) => (
                              <div key={idx} className="text-xs text-gray-600">
                                <a
                                  href={getImageUrl(url) || url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:underline truncate block"
                                >
                                  {url}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {files.length === 0 && !selectedPortfolio.pdfUrl && !selectedPortfolio.youtubeUrl && (
                        <p className="text-sm text-gray-500">No files in this portfolio</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <form onSubmit={handleApprovePortfolio}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Action *</label>
                <select
                  name="approve"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="true">Approve</option>
                  <option value="false">Reject</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={approvePortfolioMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {approvePortfolioMutation.isPending ? 'Updating...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsApproveModalOpen(false);
                    setSelectedPortfolio(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

