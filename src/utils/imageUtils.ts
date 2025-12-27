/**
 * Get the API base URL for constructing document URLs
 * This ensures we use the correct API domain in production
 */
const getApiBaseUrl = (): string => {
  // First, try environment variable
  let apiBase = import.meta.env.VITE_API_BASE_URL;
  
  if (apiBase) {
    // Clean and validate the URL
    apiBase = apiBase.trim();
    // Ensure it has protocol
    if (!apiBase.startsWith('http://') && !apiBase.startsWith('https://')) {
      // Add protocol based on current location
      const protocol = window.location.protocol;
      apiBase = `${protocol}//${apiBase}`;
    }
    // Ensure it ends with /api
    return apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;
  }
  
  // If not set, try to detect from current location
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Development - always use localhost:3001 for backend API
    return 'http://localhost:3001/api';
  } else {
    // Production - try to detect API domain from frontend domain
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Check if hostname contains a subdomain (e.g., crm.prashantthakar.com)
    const hostnameParts = hostname.split('.');
    if (hostnameParts.length >= 3) {
      // Has subdomain - try to replace with 'api' subdomain
      const rootDomain = hostnameParts.slice(-2).join('.');
      const apiHostname = `api.${rootDomain}`;
      return `${protocol}//${apiHostname}/api`;
    } else {
      // No subdomain or can't determine - use same origin
      return `${window.location.origin}/api`;
    }
  }
};

/**
 * Get the full URL for an image
 * Handles both relative and absolute URLs
 */
export const getImageUrl = (imageUrl: string | null | undefined): string | null => {
  if (!imageUrl) return null;
  
  // First, aggressively clean any malformed URLs with duplicate domains in the path
  // This handles cases like: https://crm.prashantthakar.com/.prashantthakar.com/api/uploads/...
  if (imageUrl.includes('://')) {
    // It's a full URL - check for duplicate domains in path
    try {
      const urlObj = new URL(imageUrl);
      const hostname = urlObj.hostname;
      let pathname = urlObj.pathname;
      
      // Extract root domain from hostname (e.g., "prashantthakar.com" from "crm.prashantthakar.com")
      const hostnameParts = hostname.split('.');
      const rootDomain = hostnameParts.length >= 2 
        ? hostnameParts.slice(-2).join('.') 
        : hostname;
      
      // CRITICAL FIX: Remove any domain-like segment from path (with or without leading dot)
      // This handles: /.prashantthakar.com/api/uploads/... or /prashantthakar.com/api/uploads/...
      // More aggressive pattern that matches domain anywhere in path
      const domainPattern = /\/\.?([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/|$)/;
      
      // Remove ALL domain-like segments from path that match the hostname or root domain
      pathname = pathname.replace(domainPattern, (match) => {
        const domainInPath = match.replace(/^\/\.?/, '').replace(/\/$/, '');
        const domainInPathParts = domainInPath.split('.');
        const rootDomainInPath = domainInPathParts.length >= 2 
          ? domainInPathParts.slice(-2).join('.') 
          : domainInPath;
        
        // If domains match, remove the domain segment (return just the slash)
        if (rootDomainInPath === rootDomain || domainInPath === hostname || 
            domainInPath.includes(hostname) || hostname.includes(domainInPath) ||
            hostname.includes(rootDomainInPath) || rootDomainInPath.includes(rootDomain)) {
          return '/';
        }
        return match; // Keep if domains don't match
      });
      
      // Also check for domain segments anywhere in the path (not just at start)
      const pathParts = pathname.split('/').filter(p => p);
      const cleanedParts = pathParts.filter(part => {
        const cleanPart = part.startsWith('.') ? part.substring(1) : part;
        const domainPattern2 = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        if (domainPattern2.test(cleanPart)) {
          const domainParts = cleanPart.split('.');
          const rootDomainInPart = domainParts.length >= 2 
            ? domainParts.slice(-2).join('.') 
            : cleanPart;
          // Remove if it matches the hostname or root domain
          return !(rootDomainInPart === rootDomain || cleanPart === hostname || 
                   cleanPart.includes(hostname) || hostname.includes(cleanPart) ||
                   hostname.includes(rootDomainInPart) || rootDomainInPart.includes(rootDomain));
        }
        return true;
      });
      
      // Clean up double slashes
      pathname = '/' + cleanedParts.join('/').replace(/\/+/g, '/');
      urlObj.pathname = pathname;
      
      // Remove /api from uploads paths (uploads should be served directly, not through /api)
      urlObj.pathname = urlObj.pathname.replace(/\/api\/uploads(\/|$)/g, '/uploads$1');
      
      imageUrl = urlObj.toString();
    } catch (e) {
      // If URL parsing fails, try aggressive string replacement
      // Remove any domain-like segment from path (with or without leading dot)
      imageUrl = imageUrl.replace(/\/\.?([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/|$)/g, '/');
      // Also remove /api from uploads paths
      imageUrl = imageUrl.replace(/\/api\/uploads(\/|$)/g, '/uploads$1');
    }
  }
  
  // If already a full URL (http/https) and wasn't processed above, clean it and return
  // Note: This is a fallback for URLs that might have been missed in the first check
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Clean duplicate domains from path
    try {
      const urlObj = new URL(imageUrl);
      const hostname = urlObj.hostname;
      const hostnameParts = hostname.split('.');
      const rootDomain = hostnameParts.length >= 2 
        ? hostnameParts.slice(-2).join('.') 
        : hostname;
      
      const domainPattern3 = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      let pathname = urlObj.pathname;
      
      // CRITICAL: Remove ALL domain-like segments from path that match hostname/root domain
      const domainPattern = /\/\.?([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/|$)/;
      pathname = pathname.replace(domainPattern, (match) => {
        const domainInPath = match.replace(/^\/\.?/, '').replace(/\/$/, '');
        const domainInPathParts = domainInPath.split('.');
        const rootDomainInPath = domainInPathParts.length >= 2 
          ? domainInPathParts.slice(-2).join('.') 
          : domainInPath;
        
        // If domains match, remove the domain segment
        if (rootDomainInPath === rootDomain || domainInPath === hostname || 
            domainInPath.includes(hostname) || hostname.includes(domainInPath) ||
            hostname.includes(rootDomainInPath) || rootDomainInPath.includes(rootDomain)) {
          return '/';
        }
        return match;
      });
      
      const pathParts = pathname.split('/').filter(p => p);
      
      // Remove any domain-like segments from the path (including those with leading dots)
      const cleanedParts = pathParts.filter(part => {
        // Skip domain-like segments (with or without leading dot)
        const cleanPart = part.startsWith('.') ? part.substring(1) : part;
        if (domainPattern3.test(cleanPart)) {
          const domainParts = cleanPart.split('.');
          const rootDomainInPart = domainParts.length >= 2 
            ? domainParts.slice(-2).join('.') 
            : cleanPart;
          // Remove if it matches the hostname or root domain
          return !(rootDomainInPart === rootDomain || cleanPart === hostname || 
                   cleanPart.includes(hostname) || hostname.includes(cleanPart) ||
                   hostname.includes(rootDomainInPart) || rootDomainInPart.includes(rootDomain));
        }
        return true;
      });
      
      // Clean up double slashes
      pathname = '/' + cleanedParts.join('/').replace(/\/+/g, '/');
      urlObj.pathname = pathname;
      
      // Remove /api from uploads paths
      urlObj.pathname = urlObj.pathname.replace(/\/api\/uploads(\/|$)/g, '/uploads$1');
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails, try manual cleaning
      let cleaned = imageUrl;
      // Remove .prashantthakar.com or similar from path (with or without trailing slash)
      cleaned = cleaned.replace(/\/\.?([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/|$)/g, '/');
      cleaned = cleaned.replace(/\/api\/uploads(\/|$)/g, '/uploads$1');
      // Clean up double slashes
      cleaned = cleaned.replace(/\/+/g, '/');
      return cleaned;
    }
  }
  
  // If it's a data URL (base64), return as is
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // Clean the URL first - remove leading dots and domain-like segments
  let cleanedUrl = imageUrl.trim();
  
  // CRITICAL FIX: Handle URLs that start with dot-domain (e.g., .prashantthakar.com/uploads/...)
  // This happens when protocol is missing and URL construction fails
  if (cleanedUrl.startsWith('.')) {
    // Check if it's a domain pattern
    const domainPattern = /^\.([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/;
    if (domainPattern.test(cleanedUrl)) {
      // It's a domain - add protocol and remove leading dot
      const protocol = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://' 
        : window.location.protocol + '//';
      cleanedUrl = protocol + cleanedUrl.substring(1);
    } else {
      // Just remove leading dot
      cleanedUrl = cleanedUrl.substring(1);
    }
  }
  
  // Remove leading slash if it's followed by a domain (with or without leading dot)
  if (cleanedUrl.startsWith('/')) {
    const domainPattern4 = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    // Remove .domain.com pattern from start of path (with or without trailing slash)
    cleanedUrl = cleanedUrl.replace(/^\/\.([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/|$)/, '/');
    
    const pathParts = cleanedUrl.split('/').filter(p => p);
    if (pathParts.length > 0) {
      // Check if first part is a domain (with or without leading dot)
      const firstPart = pathParts[0].startsWith('.') ? pathParts[0].substring(1) : pathParts[0];
      if (domainPattern4.test(firstPart)) {
        // First segment is a domain - remove it
        pathParts.shift();
        cleanedUrl = '/' + pathParts.join('/');
      }
    }
  }
  
  // Check if URL contains a domain name at the start (e.g., prashantthakar.com/api/uploads/...)
  const domainPattern5 = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (domainPattern5.test(cleanedUrl)) {
    // URL starts with a domain name - add protocol if missing
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const protocol = isProduction ? 'https://' : 'http://';
    
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
      cleanedUrl = protocol + cleanedUrl;
    }
    
    // Fix common issues: remove /api from uploads paths
    cleanedUrl = cleanedUrl.replace(/\/api\/uploads(\/|$)/g, '/uploads$1');
    
    // Handle duplicate domains in path
    try {
      const urlObj = new URL(cleanedUrl);
      let pathname = urlObj.pathname;
      
      // Remove leading dot-domain patterns (e.g., /.prashantthakar.com or /.prashantthakar.com/)
      pathname = pathname.replace(/^\/\.([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/|$)/, '/');
      
      const pathParts = pathname.split('/').filter(p => p);
      
      // Remove any domain-like segments from the path (including those with leading dots)
      const cleanedParts = pathParts.filter(part => {
        const cleanPart = part.startsWith('.') ? part.substring(1) : part;
        return !domainPattern5.test(cleanPart);
      });
      
      if (cleanedParts.length !== pathParts.length) {
        urlObj.pathname = '/' + cleanedParts.join('/');
        cleanedUrl = urlObj.toString();
      }
    } catch (e) {
      console.warn('Failed to parse URL:', cleanedUrl, e);
    }
    
    return cleanedUrl;
  }
  
  // Construct full URL from relative path
  // For /uploads paths, we need the backend server URL WITHOUT /api
  const apiBase = getApiBaseUrl();

  // Remove /api to get base server URL (e.g., http://localhost:3001 or https://api.prashantthakar.com)
  let baseUrl = apiBase.replace('/api', '').replace(/\/$/, ''); // Also remove trailing slash

  // Clean up the relative path FIRST before constructing URL
  let relativePath = cleanedUrl.startsWith('/') ? cleanedUrl : `/${cleanedUrl}`;
  console.log('imageUtils - Initial relativePath:', relativePath);

  // Remove /api from uploads paths FIRST (before domain removal, to preserve filename)
  relativePath = relativePath.replace(/^\/api\/uploads\//, '/uploads/');
  relativePath = relativePath.replace(/\/api\/uploads(\/|$)/g, '/uploads$1');
  console.log('imageUtils - After /api removal:', relativePath);

  // For LOCAL DEVELOPMENT: Skip complex domain removal - just use the path as-is
  // The domain removal was too aggressive and was removing filenames
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // For local dev, if path already starts with /uploads/, use it directly
    if (relativePath.startsWith('/uploads/')) {
      // Just clean up double slashes, but preserve the full path including filename
      console.log('imageUtils - Local dev, path starts with /uploads/, preserving:', relativePath);
      relativePath = relativePath.replace(/\/{2,}/g, '/');
      console.log('imageUtils - After cleanup:', relativePath);
    } else {
      // Only do domain removal if path doesn't start with /uploads/
      // This is a safety measure for production paths that might have domain segments
      const pathParts = relativePath.split('/').filter(p => p);
      if (pathParts.length > 0) {
        const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        
        const cleanedParts = pathParts.filter((part, index) => {
          if (index === pathParts.length - 1) return true; // Always keep filename (last part)
          const cleanPart = part.startsWith('.') ? part.substring(1) : part;
          return !domainPattern.test(cleanPart);
        });
        
        relativePath = '/' + cleanedParts.join('/');
      }
      relativePath = relativePath.replace(/\/{2,}/g, '/');
    }
  } else {
    // For PRODUCTION: Do domain removal but preserve filename
    const pathParts = relativePath.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      
      const cleanedParts = pathParts.filter((part, index) => {
        if (index === pathParts.length - 1) return true; // Always keep filename (last part)
        const cleanPart = part.startsWith('.') ? part.substring(1) : part;
        return !domainPattern.test(cleanPart);
      });
      
      relativePath = '/' + cleanedParts.join('/');
    }
    relativePath = relativePath.replace(/\/{2,}/g, '/');
  }

  // For LOCAL DEVELOPMENT: Simplify URL construction
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local development - ALWAYS use localhost:3001 for backend
    baseUrl = 'http://localhost:3001';
    
    // Ensure relativePath starts with /uploads
    // If the path already starts with /uploads, use it as-is
    // Otherwise, if it starts with /, prepend /uploads
    // If it doesn't start with /, add /uploads/
    if (!relativePath.startsWith('/uploads')) {
      if (relativePath.startsWith('/')) {
        // Path like /general/filename.jpg -> /uploads/general/filename.jpg
        relativePath = '/uploads' + relativePath;
      } else {
        // Path like general/filename.jpg -> /uploads/general/filename.jpg
        relativePath = '/uploads/' + relativePath;
      }
    }
    
    // Ensure no double slashes (already done above, but double-check)
    relativePath = relativePath.replace(/\/{2,}/g, '/');
    
    // CRITICAL: Final validation - ensure filename is present
    if (!relativePath.match(/\/[^/]+\.[a-zA-Z0-9]+$/)) {
      // Filename might be missing - try to recover from original
      const filenameMatch = cleanedUrl.match(/\/([^/]+\.(jpg|jpeg|png|gif|webp|pdf))$/i);
      if (filenameMatch && filenameMatch[1]) {
        console.warn('Filename missing, recovering:', { 
          original: imageUrl,
          cleaned: cleanedUrl,
          relativePath,
          recoveredFilename: filenameMatch[1]
        });
        relativePath = relativePath.replace(/\/$/, '') + '/' + filenameMatch[1];
      } else {
        console.error('CRITICAL: Cannot recover filename!', {
          original: imageUrl,
          cleaned: cleanedUrl,
          relativePath
        });
      }
    }
    
    const fullUrl = `${baseUrl}${relativePath}`;
    console.log('Local image URL constructed:', { 
      original: imageUrl,
      cleaned: cleanedUrl, 
      relativePath, 
      baseUrl, 
      fullUrl 
    });
    return fullUrl;
  }
  
  // For PRODUCTION: Construct URL using API domain
  try {
    // Get API base URL (e.g., https://api.prashantthakar.com/api)
    const apiBase = getApiBaseUrl();
    // Remove /api to get base server URL (e.g., https://api.prashantthakar.com)
    baseUrl = apiBase.replace('/api', '').replace(/\/$/, '');
    
    // Ensure baseUrl has protocol - CRITICAL FIX
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      // If no protocol, determine from current location
      const protocol = window.location.protocol;
      // If baseUrl starts with //, add protocol
      if (baseUrl.startsWith('//')) {
        baseUrl = `${protocol}${baseUrl}`;
      } else {
        // If it's just a domain, add protocol
        baseUrl = `${protocol}//${baseUrl}`;
      }
    }
    
    // Parse to ensure valid URL - this will throw if URL is invalid
    const urlObj = new URL(baseUrl);
    baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    
    // Final validation - ensure we have a valid base URL
    if (!baseUrl || baseUrl === '//' || !baseUrl.includes('.')) {
      throw new Error(`Invalid base URL: ${baseUrl}`);
    }
    
    // Ensure relativePath starts with /uploads
    if (!relativePath.startsWith('/uploads')) {
      if (relativePath.startsWith('/')) {
        relativePath = '/uploads' + relativePath;
      } else {
        relativePath = '/uploads/' + relativePath;
      }
    }
    
    // Clean up double slashes
    relativePath = relativePath.replace(/\/{2,}/g, '/');
    
    // CRITICAL: Final validation - ensure filename is present
    if (!relativePath.match(/\/[^/]+\.[a-zA-Z0-9]+$/)) {
      // Filename might be missing - try to recover from original
      const filenameMatch = cleanedUrl.match(/\/([^/]+\.(jpg|jpeg|png|gif|webp|pdf))$/i);
      if (filenameMatch && filenameMatch[1]) {
        console.warn('Production - Filename missing, recovering:', { 
          original: imageUrl,
          cleaned: cleanedUrl,
          relativePath,
          recoveredFilename: filenameMatch[1]
        });
        relativePath = relativePath.replace(/\/$/, '') + '/' + filenameMatch[1];
      }
    }
    
    // Construct full URL - static files are served directly from backend, not through /api
    const fullUrl = `${baseUrl}${relativePath}`;
    
      // Final safety check: remove any remaining domain-like segments from path
      try {
        const finalUrlObj = new URL(fullUrl);
        let finalPathname = finalUrlObj.pathname;
        // Remove any remaining domain-like segments (but preserve filename)
        const pathParts = finalPathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
          const cleanedParts = pathParts.filter((part, index) => {
            if (index === pathParts.length - 1) return true; // Always keep filename (last part)
            const cleanPart = part.startsWith('.') ? part.substring(1) : part;
            return !domainPattern.test(cleanPart);
          });
          finalPathname = '/' + cleanedParts.join('/');
        }
        finalPathname = finalPathname.replace(/\/+/g, '/');
        finalUrlObj.pathname = finalPathname;
        return finalUrlObj.toString();
      } catch (e) {
        // If parsing fails, return as-is
        return fullUrl;
      }
  } catch (e) {
    // If parsing fails, use window origin as fallback
    console.error('Error constructing production URL:', e, {
      apiBase,
      baseUrl,
      relativePath,
      imageUrl
    });
    
    // Try to construct a safe fallback URL
    try {
      // Use API domain detection as fallback
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const hostnameParts = hostname.split('.');
      
      if (hostnameParts.length >= 3) {
        // Has subdomain - use api subdomain
        const rootDomain = hostnameParts.slice(-2).join('.');
        const apiHostname = `api.${rootDomain}`;
        baseUrl = `${protocol}//${apiHostname}`;
      } else {
        // Use same origin
        baseUrl = window.location.origin;
      }
      
      // Ensure relativePath starts with /uploads
      if (!relativePath.startsWith('/uploads')) {
        if (relativePath.startsWith('/')) {
          relativePath = '/uploads' + relativePath;
        } else {
          relativePath = '/uploads/' + relativePath;
        }
      }
      
      const fullUrl = `${baseUrl}${relativePath}`;
      console.warn('Using fallback URL:', fullUrl);
      return fullUrl;
    } catch (fallbackError) {
      console.error('Fallback URL construction also failed:', fallbackError);
      // Last resort - return the original URL
      return imageUrl;
    }
  }
};
