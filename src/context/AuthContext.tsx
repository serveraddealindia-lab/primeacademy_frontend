import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/axios';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  userId?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response && response.data && response.data.status === 'success' && response.data.data && response.data.data.user) {
        setUser({ ...response.data.data.user, userId: response.data.data.user.id });
        setError(null);
      } else {
        console.warn('Invalid response structure from /auth/me:', response?.data);
        localStorage.removeItem('token');
        setError(null); // Not really an error, just invalid token
      }
    } catch (error: any) {
      console.error('Failed to fetch user:', error);
      setError(error);
      // Only remove token if it's an auth error, not a network error
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
      }
      // Don't throw - just set loading to false
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let cancelled = false;
    
    const initAuth = async () => {
      try {
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        if (token && !cancelled) {
          await fetchUser();
        } else if (!cancelled) {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error initializing auth:', err);
        if (isMounted && !cancelled) {
          setError(err);
          setLoading(false);
        }
      }
    };
    
    initAuth();
    
    return () => {
      cancelled = true;
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.status === 'success') {
        const token = response.data.data.token;
        const userData = response.data.data.user;
        
        // Store token
        localStorage.setItem('token', token);
        
        // Set user with userId
        setUser({ 
          ...userData, 
          userId: userData.id 
        });
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      // Preserve the original error for better error handling
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else if (error.message) {
        throw error;
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

