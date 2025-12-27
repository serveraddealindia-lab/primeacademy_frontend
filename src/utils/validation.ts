export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validatePhone = (phone: string): string | null => {
  if (!phone || phone.trim() === '') {
    return 'Phone number is required';
  }
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Check for Indian phone number format (10 digits, optionally with country code)
  if (digitsOnly.length === 10) {
    // 10 digit Indian phone number
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(digitsOnly)) {
      return 'Phone number must start with 6, 7, 8, or 9 and be 10 digits';
    }
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    // 12 digits with country code 91
    const phoneRegex = /^91[6-9][0-9]{9}$/;
    if (!phoneRegex.test(digitsOnly)) {
      return 'Invalid phone number format';
    }
  } else if (digitsOnly.length === 13 && digitsOnly.startsWith('9191')) {
    // Handle +91 format
    const phoneRegex = /^9191[6-9][0-9]{9}$/;
    if (!phoneRegex.test(digitsOnly)) {
      return 'Invalid phone number format';
    }
  } else {
    return 'Phone number must be 10 digits (or 12 digits with country code 91)';
  }
  return null;
};

export const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value || value.trim() === '') {
    return `${fieldName} is required`;
  }
  return null;
};

export const validatePAN = (pan: string): string | null => {
  if (!pan || pan.trim() === '') {
    return 'PAN number is required';
  }
  // PAN format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan.toUpperCase())) {
    return 'PAN must be in format: ABCDE1234F (5 letters, 4 digits, 1 letter)';
  }
  return null;
};

export const validateIFSC = (ifsc: string): string | null => {
  if (!ifsc || ifsc.trim() === '') {
    return 'IFSC code is required';
  }
  // IFSC format: 4 letters, 0, then 6 alphanumeric
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc.toUpperCase())) {
    return 'IFSC code must be in format: ABCD0123456 (4 letters, 0, 6 alphanumeric)';
  }
  return null;
};

export const validateAccountNumber = (accountNumber: string): string | null => {
  if (!accountNumber || accountNumber.trim() === '') {
    return 'Account number is required';
  }
  // Account number should be at least 9 digits
  const accountRegex = /^[0-9]{9,18}$/;
  if (!accountRegex.test(accountNumber.replace(/\s/g, ''))) {
    return 'Account number must be 9-18 digits';
  }
  return null;
};

export const validatePostalCode = (postalCode: string): string | null => {
  if (!postalCode || postalCode.trim() === '') {
    return 'Postal code is required';
  }
  // Indian postal code: 6 digits
  const postalRegex = /^[0-9]{6}$/;
  if (!postalRegex.test(postalCode)) {
    return 'Postal code must be 6 digits';
  }
  return null;
};

export const validateDate = (date: string, fieldName: string): string | null => {
  if (!date || date.trim() === '') {
    return `${fieldName} is required`;
  }
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return `Please enter a valid ${fieldName}`;
  }
  // Check if date is not in the future (for date of birth)
  if (fieldName.toLowerCase().includes('birth')) {
    if (dateObj > new Date()) {
      return 'Date of birth cannot be in the future';
    }
    // Check if age is at least 18 years old (properly calculated)
    const today = new Date();
    let age = today.getFullYear() - dateObj.getFullYear();
    const monthDiff = today.getMonth() - dateObj.getMonth();
    const dayDiff = today.getDate() - dateObj.getDate();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    
    if (age < 18) {
      const userType = fieldName.toLowerCase().includes('employee') 
        ? 'Employee' 
        : fieldName.toLowerCase().includes('faculty')
        ? 'Faculty'
        : 'Person';
      return `${userType} must be at least 18 years old`;
    }
  }
  return null;
};

export const validateEmployeeId = (employeeId: string): string | null => {
  if (!employeeId || employeeId.trim() === '') {
    return 'Employee ID is required';
  }
  if (employeeId.trim().length < 3) {
    return 'Employee ID must be at least 3 characters';
  }
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password || password.trim() === '') {
    return 'Password is required';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
};

