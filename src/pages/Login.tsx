import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (err.response) {
        errorMessage = err.response.data?.message || err.message || errorMessage;
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);

    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      setForgotPasswordError('Please enter a valid email address');
      return;
    }

    setForgotPasswordLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotPasswordEmail.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setForgotPasswordSuccess(true);
        setForgotPasswordError('');
      } else {
        setForgotPasswordError(data.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err: any) {
      setForgotPasswordError('Unable to connect to server. Please check your connection.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center min-h-screen px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="mb-8 sm:mb-10 md:mb-12 text-center lg:text-left">
            <div className="mb-4">
              <div className="text-orange-500 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.1' }}>
                PRIME
              </div>
              <div className="flex flex-col mb-2">
                <div className="h-1 w-20 sm:w-24 md:w-28 bg-orange-500 mb-1"></div>
                <div className="h-0.5 w-20 sm:w-24 md:w-28 bg-orange-500"></div>
              </div>
              <div className="text-white text-xl sm:text-2xl font-light tracking-wider mb-1">ACADEMY</div>
              <div className="text-gray-400 text-sm mt-1">SINCE 2013</div>
            </div>
            <p className="text-white text-lg sm:text-xl font-light">Digital Art With Excellence</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500 bg-opacity-90 text-white rounded-lg text-sm sm:text-base shadow-lg">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg text-white placeholder-white placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent backdrop-blur-sm text-sm sm:text-base transition-all duration-200 hover:bg-opacity-15"
                placeholder="Enter your email"
                style={{ color: 'white' }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-white text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg text-white placeholder-white placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent backdrop-blur-sm text-sm sm:text-base transition-all duration-200 hover:bg-opacity-15"
                  placeholder="Enter your password"
                  style={{ color: 'white' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white text-opacity-70 hover:text-opacity-100 focus:outline-none transition-opacity"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L3 12m3.29-5.71L12 12m-5.71 0L12 12m0 0l3.29 3.29M12 12l3.29-3.29m0 0L21 3m-5.71 5.71L21 12m-5.71 0L12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-white text-opacity-80 hover:text-opacity-100 text-sm font-medium transition-opacity focus:outline-none focus:underline"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg text-sm sm:text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-white text-opacity-70 text-xs sm:text-sm">
              Enter your registered email and password to continue
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Single Promotional Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="w-full h-full relative">
          {/* Single Image */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url('/login-page.jpeg')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Gradient Overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-transparent"></div>
          </div>
          
          {/* Content Overlay */}
          <div className="relative z-10 w-full h-full flex flex-col justify-end p-8 xl:p-12">
            <div className="max-w-lg">
              <h2 className="text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white leading-tight mb-3 drop-shadow-lg">
                A Journey of 12 Years
              </h2>
              <h2 className="text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white leading-tight mb-6 drop-shadow-lg">
                A Legacy of Pride
              </h2>
              <div className="h-1 w-24 bg-orange-500 mb-4"></div>
              <p className="text-white text-lg xl:text-xl font-light text-opacity-90 drop-shadow-md">
                Excellence in Digital Art Education Since 2013
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Image Section - Shown only on mobile */}
      <div className="lg:hidden w-full h-64 sm:h-80 md:h-96 relative overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url('/login-page.jpeg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent"></div>
        </div>
        <div className="relative z-10 w-full h-full flex flex-col justify-end p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight mb-2 drop-shadow-lg">
            A Journey of 12 Years
          </h2>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg">
            A Legacy of Pride
          </h2>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 sm:p-8 relative">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setForgotPasswordEmail('');
                setForgotPasswordError('');
                setForgotPasswordSuccess(false);
              }}
              className="absolute top-4 right-4 text-white text-opacity-70 hover:text-opacity-100 focus:outline-none transition-opacity"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {forgotPasswordSuccess ? (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 bg-green-500 bg-opacity-20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Check Your Email</h2>
                <p className="text-white text-opacity-80 mb-6">
                  We've sent a password reset link to <strong className="text-white">{forgotPasswordEmail}</strong>. 
                  Please check your email and follow the instructions to reset your password.
                </p>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                    setForgotPasswordError('');
                    setForgotPasswordSuccess(false);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
                <p className="text-white text-opacity-70 mb-6 text-sm">
                  Enter your registered email address and we'll send you a link to reset your password.
                </p>

                {forgotPasswordError && (
                  <div className="mb-4 p-3 bg-red-500 bg-opacity-90 text-white rounded-lg text-sm">
                    {forgotPasswordError}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-white text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg text-white placeholder-white placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent backdrop-blur-sm text-sm sm:text-base transition-all duration-200"
                      placeholder="Enter your email"
                      style={{ color: 'white' }}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotPasswordEmail('');
                        setForgotPasswordError('');
                        setForgotPasswordSuccess(false);
                      }}
                      className="flex-1 py-3 px-4 bg-white bg-opacity-10 text-white font-semibold rounded-lg hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotPasswordLoading}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {forgotPasswordLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
