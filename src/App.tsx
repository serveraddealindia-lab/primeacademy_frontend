import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SoftwareCompletionManagement } from './pages/SoftwareCompletionManagement';
import { BatchExtensionManagement } from './pages/BatchExtensionManagement';
import { LeaveManagement } from './pages/LeaveManagement';
import { BatchManagement } from './pages/BatchManagement';
import { BatchCreate } from './pages/BatchCreate';
import { BatchEdit } from './pages/BatchEdit';
import { BatchDetails } from './pages/BatchDetails';
import { FacultyManagement } from './pages/FacultyManagement';
import { FacultyEdit } from './pages/FacultyEdit';
import { StudentManagement } from './pages/StudentManagement';
import { StudentEnrollment } from './pages/StudentEnrollment';
import { StudentEdit } from './pages/StudentEdit';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { EmployeeRegistration } from './pages/EmployeeRegistration';
import { EmployeeEdit } from './pages/EmployeeEdit';
import { FacultyRegistration } from './pages/FacultyRegistration';
import { SessionManagement } from './pages/SessionManagement';
import { AttendanceManagement } from './pages/AttendanceManagement';
import { UnifiedAttendance } from './pages/UnifiedAttendance';
import { StudentAttendanceView } from './pages/StudentAttendanceView';
import { PaymentManagement } from './pages/PaymentManagement';
import { PortfolioManagement } from './pages/PortfolioManagement';
import { ReportManagement } from './pages/ReportManagement';
import { ApprovalManagement } from './pages/ApprovalManagement';
import { UserManagement } from './pages/UserManagement';
import { RoleManagement } from './pages/RoleManagement';
import { CertificateManagement } from './pages/CertificateManagement';
import { BiometricSettings } from './pages/BiometricSettings';
import { PhotoManagement } from './pages/PhotoManagement';
import { CourseModuleManagement } from './pages/CourseModuleManagement';
import { ErrorBoundary } from './components/ErrorBoundary';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/software-completions"
        element={
          <ProtectedRoute>
            <SoftwareCompletionManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/batch-extensions"
        element={
          <ProtectedRoute>
            <BatchExtensionManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/batches"
        element={
          <ProtectedRoute>
            <BatchManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/batches/create"
        element={
          <ProtectedRoute>
            <BatchCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/batches/:id/edit"
        element={
          <ProtectedRoute>
            <BatchEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/batches/:id"
        element={
          <ProtectedRoute>
            <BatchDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/course-modules"
        element={
          <ProtectedRoute>
            <CourseModuleManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <StudentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students/enroll"
        element={
          <ProtectedRoute>
            <StudentEnrollment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students/:id/edit"
        element={
          <ProtectedRoute>
            <StudentEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <ProtectedRoute>
            <FacultyManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/:id/edit"
        element={
          <ProtectedRoute>
            <FacultyEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/register"
        element={
          <ProtectedRoute>
            <FacultyRegistration />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/register"
        element={
          <ProtectedRoute>
            <EmployeeRegistration />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/:id/edit"
        element={
          <ProtectedRoute>
            <EmployeeEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <EmployeeManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <SessionManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <AttendanceManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-attendance"
        element={
          <ProtectedRoute>
            <UnifiedAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student-attendance"
        element={
          <ProtectedRoute>
            <StudentAttendanceView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <PaymentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portfolios"
        element={
          <ProtectedRoute>
            <PortfolioManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <ApprovalManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaves"
        element={
          <ProtectedRoute>
            <LeaveManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student-leaves"
        element={
          <ProtectedRoute>
            <LeaveManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute>
            <RoleManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificates"
        element={
          <ProtectedRoute>
            <CertificateManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biometric-settings"
        element={
          <ProtectedRoute>
            <BiometricSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/photos"
        element={
          <ProtectedRoute>
            <PhotoManagement />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

