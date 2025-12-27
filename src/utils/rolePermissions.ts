// Predefined role permissions mapping
export const PREDEFINED_ROLE_PERMISSIONS: Record<string, Record<string, { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean }>> = {
  superadmin: {
    batches: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    students: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    faculty: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    employees: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    sessions: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    attendance: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    payments: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    portfolios: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    reports: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    approvals: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    users: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    software_completions: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    student_leaves: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    batch_extensions: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    employee_leaves: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    faculty_leaves: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  },
  admin: {
    batches: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    students: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    faculty: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    employees: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    sessions: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    attendance: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    payments: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    portfolios: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    reports: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    approvals: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    users: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    software_completions: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    student_leaves: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    batch_extensions: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    employee_leaves: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    faculty_leaves: { canView: true, canAdd: true, canEdit: true, canDelete: false },
  },
  faculty: {
    batches: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    students: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    faculty: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    employees: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    sessions: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    attendance: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    payments: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    portfolios: { canView: true, canAdd: false, canEdit: true, canDelete: false },
    reports: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    approvals: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    users: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    software_completions: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    student_leaves: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    batch_extensions: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    employee_leaves: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    faculty_leaves: { canView: true, canAdd: true, canEdit: false, canDelete: false },
  },
  student: {
    batches: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    students: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    faculty: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    employees: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    sessions: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    attendance: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    payments: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    portfolios: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    reports: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    approvals: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    users: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    software_completions: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    student_leaves: { canView: true, canAdd: true, canEdit: false, canDelete: false },
    batch_extensions: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    employee_leaves: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    faculty_leaves: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  },
  employee: {
    batches: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    students: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    faculty: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    employees: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    sessions: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    attendance: { canView: true, canAdd: true, canEdit: false, canDelete: false },
    payments: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    portfolios: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    reports: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    approvals: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    users: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    software_completions: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    student_leaves: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    batch_extensions: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    employee_leaves: { canView: true, canAdd: true, canEdit: false, canDelete: false },
    faculty_leaves: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  },
};

// Helper function to check if a user has view permission for a module
export const hasModuleAccess = (userRole: string | undefined, moduleName: string): boolean => {
  if (!userRole) return false;
  
  const rolePermissions = PREDEFINED_ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  
  const modulePermission = rolePermissions[moduleName];
  if (!modulePermission) return false;
  
  // User has access if they have at least View permission
  return modulePermission.canView;
};





