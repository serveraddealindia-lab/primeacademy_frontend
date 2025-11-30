/**
 * Get the full URL for an image
 * Handles both relative and absolute URLs
 */
export const getImageUrl = (imageUrl: string | null | undefined): string | null => {
  if (!imageUrl) return null;
  
  // If already a full URL (http/https), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a data URL (base64), return as is
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // Construct full URL from relative path
  // For /uploads paths, we need the backend server URL WITHOUT /api
  // Try to get API base URL from environment
  let apiBase = import.meta.env.VITE_API_BASE_URL;
  
  // If not set, try to detect from current location
  if (!apiBase) {
    // In production, might be same origin
    if (window.location.origin.includes('localhost')) {
      apiBase = 'http://localhost:3000/api';
    } else {
      // Use same origin for production
      apiBase = `${window.location.origin}/api`;
    }
  }
  
  // Remove /api to get base server URL (e.g., http://localhost:3000)
  const baseUrl = apiBase.replace('/api', '').replace(/\/$/, ''); // Also remove trailing slash
  
  // Ensure imageUrl starts with /
  const relativePath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  
  // Construct full URL - static files are served directly, not through /api
  const fullUrl = `${baseUrl}${relativePath}`;
  
  // Always log for debugging (remove in production if needed)
  console.log('🖼️ Image URL conversion:', { 
    original: imageUrl, 
    apiBase, 
    baseUrl, 
    relativePath, 
    fullUrl,
    timestamp: new Date().toISOString()
  });
  
  return fullUrl;
};
