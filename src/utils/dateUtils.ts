/**
 * Format date to dd/mm/yyyy format
 * @param date - Date string, Date object, null, or undefined
 * @returns Formatted date string in dd/mm/yyyy format or '-' if invalid
 */
export const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
};

/**
 * Convert date input value (YYYY-MM-DD) to dd/mm/yyyy format for display
 * @param dateString - Date string in YYYY-MM-DD format (from HTML date input)
 * @returns Formatted date string in dd/mm/yyyy format or empty string
 */
export const formatDateInputToDDMMYYYY = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return '';
  } catch {
    return '';
  }
};

/**
 * Convert DD/MM/YYYY format to YYYY-MM-DD (for API submission)
 * @param ddmmyyyy - Date string in DD/MM/YYYY format
 * @returns Date string in YYYY-MM-DD format or empty string if invalid
 */
export const convertDDMMYYYYToYYYYMMDD = (ddmmyyyy: string | null | undefined): string => {
  if (!ddmmyyyy) return '';
  try {
    const parts = ddmmyyyy.trim().split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      // Validate date
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
        return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
    }
    return '';
  } catch {
    return '';
  }
};

/**
 * Validate DD/MM/YYYY date format
 * @param dateString - Date string in DD/MM/YYYY format
 * @returns true if valid, false otherwise
 */
export const isValidDDMMYYYY = (dateString: string | null | undefined): boolean => {
  if (!dateString) return false;
  try {
    const parts = dateString.trim().split('/');
    if (parts.length !== 3) return false;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Basic range validation
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    
    // Check if date is actually valid (e.g., not 31/02/2024)
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Format phone number validation
 * @param phone - Phone number string
 * @returns true if valid (10 digits), false otherwise
 */
export const isValidPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
};

/**
 * Format email validation
 * @param email - Email string
 * @returns true if valid email format, false otherwise
 */
export const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

