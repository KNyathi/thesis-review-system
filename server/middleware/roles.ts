export const ROLES = {
  STUDENT: 'student',
  CONSULTANT: 'consultant',
  SUPERVISOR: 'supervisor',
  REVIEWER: 'reviewer',
  HEAD_OF_DEPARTMENT: 'head_of_department',
  DEAN: 'dean',
  ADMIN: 'admin'
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Role hierarchy using string literals
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  student: ['student'],
  consultant: ['consultant'],
  supervisor: ['supervisor'],
  reviewer: ['reviewer'],
  head_of_department: ['head_of_department', 'supervisor', 'consultant', 'reviewer'],
  dean: ['dean', 'head_of_department', 'supervisor', 'consultant', 'reviewer'],
  admin: ['admin', 'dean', 'head_of_department', 'supervisor', 'consultant', 'reviewer', 'student']
};

// Common role groups
export const ROLE_GROUPS: Record<string, UserRole[]> = {
  FACULTY: ['supervisor', 'consultant', 'reviewer', 'head_of_department', 'dean'],
  MANAGEMENT: ['head_of_department', 'dean', 'admin'],
  ACADEMIC_STAFF: ['supervisor', 'consultant', 'reviewer'],
  ACCESS_REVIEW_1: ['supervisor', 'consultant', 'head_of_department', 'dean', 'admin'],
  ACCESS_REVIEW_2: ['reviewer', 'head_of_department', 'dean', 'admin'],
  ACCESS_REVIEW_3: ['dean', 'admin', 'student'],
  ACCESS_THESIS: ['supervisor', 'consultant', 'head_of_department', 'dean', 'admin', 'student', 'reviewer'],
  ALL_STAFF: ['supervisor', 'consultant', 'reviewer', 'head_of_department', 'dean', 'admin']
};