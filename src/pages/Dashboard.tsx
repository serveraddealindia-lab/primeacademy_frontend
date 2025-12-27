import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { hasModuleAccess } from '../utils/rolePermissions';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const allModules = [
    { name: 'Batches', path: '/batches', icon: '📚', description: 'Manage training batches', module: 'batches' },
    { name: 'Course Modules', path: '/course-modules', icon: '📖', description: 'Manage multiple courses with tabs', module: 'batches' },
    { name: 'Students', path: '/students', icon: '👥', description: 'Manage students', module: 'students' },
    { name: 'Faculty', path: '/faculty', icon: '👨‍🏫', description: 'Manage faculty members', module: 'faculty' },
    { name: 'Employees', path: '/employees', icon: '💼', description: 'Manage employees', module: 'employees' },
    { name: 'Attendance', path: '/attendance', icon: '✅', description: 'Track attendance', module: 'attendance' }, // Session-based (admin/superadmin)
    { name: 'Attendance', path: '/my-attendance', icon: '📸', description: 'Punch in/out and manage attendance', module: 'attendance' }, // Unified attendance (faculty/employees)
    { name: 'My Attendance', path: '/student-attendance', icon: '📋', description: 'View your attendance by batch and day', module: 'attendance' }, // Student attendance view
    { name: 'Payments', path: '/payments', icon: '💰', description: 'Manage payments', module: 'payments' },
    { name: 'Portfolios', path: '/portfolios', icon: '📁', description: 'Student portfolios', module: 'portfolios' },
    { name: 'Reports', path: '/reports', icon: '📊', description: 'View reports', module: 'reports' },
    { name: 'Approvals', path: '/approvals', icon: '✓', description: 'Manage approvals', module: 'approvals' },
    { name: 'Leave Management', path: '/leaves', icon: '🏖️', description: 'Manage leave requests', module: null },
    { name: 'Batch Extensions', path: '/batch-extensions', icon: '⏱️', description: 'Manage batch extensions', module: 'batch_extensions' },
    { name: 'Users', path: '/users', icon: '👤', description: 'Manage users', module: 'users' },
    { name: 'Roles', path: '/roles', icon: '🔐', description: 'Manage roles and permissions', module: null },
  ];

  // Filter modules based on user role permissions
  const modules = useMemo(() => {
    return allModules.filter((item) => {
      // Course Modules - hide from students and employees
      if (item.name === 'Course Modules') {
        if (user?.role === 'student' || user?.role === 'employee') {
          return false;
        }
        // For other roles, check module access
        return item.module ? hasModuleAccess(user?.role, item.module) : false;
      }
      
      // Roles is only for superadmin
      if (item.name === 'Roles') {
        return user?.role === 'superadmin';
      }
      
      // Attendance (unified) - show for employees and faculty
      if (item.path === '/my-attendance') {
        return (user?.role === 'employee' || user?.role === 'faculty') && hasModuleAccess(user?.role, 'attendance');
      }
      
      // Student Attendance View - show only for students
      if (item.path === '/student-attendance') {
        return user?.role === 'student' && hasModuleAccess(user?.role, 'attendance');
      }
      
      // Session-based Attendance Management - admin/superadmin
      if (item.path === '/attendance') {
        return (user?.role === 'admin' || user?.role === 'superadmin') && hasModuleAccess(user?.role, 'attendance');
      }
      
      // Leave Management - check based on role-specific leave modules
      if (item.name === 'Leave Management') {
        if (!user?.role) return false;
        if (user.role === 'student') return hasModuleAccess(user.role, 'student_leaves');
        if (user.role === 'employee') return hasModuleAccess(user.role, 'employee_leaves');
        if (user.role === 'faculty') return hasModuleAccess(user.role, 'faculty_leaves');
        // Admin and superadmin can see all leaves
        return user.role === 'admin' || user.role === 'superadmin';
      }
      
      // For all other items, check module access
      if (item.module) {
        return hasModuleAccess(user?.role, item.module);
      }
      
      return false;
    });
  }, [user?.role]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm md:text-base text-gray-600">Welcome back, {user?.name}!</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {modules.map((module) => (
            <div
              key={module.path}
              onClick={() => navigate(module.path)}
              className="bg-white rounded-lg shadow-md p-4 md:p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200 hover:border-orange-500"
            >
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">{module.icon}</div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">{module.name}</h3>
              <p className="text-xs md:text-sm text-gray-600">{module.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

