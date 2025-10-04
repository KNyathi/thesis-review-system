import { Pool } from 'pg';

// Shared base interface - ALL users have these fields
interface IUserBase {
  id: string;
  email: string;
  password: string;
  fullName: string;
  institution: string;
  role: 'student' | 'consultant' | 'supervisor' | 'reviewer' | 'head_of_department' | 'dean' | 'admin';
  roles: ('student' | 'consultant' | 'supervisor' | 'reviewer' | 'head_of_department' | 'dean' | 'admin')[];
  createdAt: Date;
  updatedAt: Date;
}

// Student-specific interface
export interface IStudent extends IUserBase {
  role: 'student';
  faculty: string;
  group: string;
  subjectArea: string;
  educationalProgram: string;
  degreeLevel: 'bachelors' | 'masters' | 'specialist';
  thesisTopic?: string;
  thesisStatus?: 'not_submitted' | 'submitted' | 'with_consultant' | 'with_supervisor' | 'under_review' | 'evaluated' | 'revisions_requested';
  thesisGrade?: string;
  thesisFile?: string;
  reviewer?: string;
  isTopicApproved: boolean;
  supervisor?: string;
  consultant?: string;
  topicRejectionComments?: string;

  consultantFeedback?: {
    comments?: string;
    lastReviewDate?: Date;
    reviewIteration: number;
    status: 'pending' | 'approved' | 'revisions_requested';
  };

  // Supervisor feedback
  supervisorFeedback?: {
    comments?: string;
    lastReviewDate?: Date;
    reviewIteration: number;
    status: 'pending' | 'approved' | 'revisions_requested' | 'signed';
    isSigned: boolean;
    signedDate?: Date;
  };

  totalReviewAttempts: number;
  currentReviewIteration: number;
}

export interface IConsultant extends IUserBase {
  role: 'consultant';
  position: string;
  faculty: string;
  department: string;
  assignedStudents: string[];
  assignedTheses: string[];
  reviewedTheses: string[];
  reviewStats: {
    totalReviews: number;
    approvedTheses: number;
    averageReviewCount: number;
  };
}

export interface ISupervisor extends IUserBase {
  role: 'supervisor';
  position: string;
  department: string;
  faculty: string;
  assignedStudents: string[];
  assignedTheses: string[];
  reviewedTheses: string[];
  reviewStats: {
    totalReviews: number;
    approvedTheses: number;
    averageReviewCount: number;
  };
  maxStudents: number;
}

// Reviewer remains the same
export interface IReviewer extends IUserBase {
  role: 'reviewer';
  position: string;
  faculty: string;
  department: string;
  assignedTheses: string[];
  reviewedTheses: string[];
}

// Head of Department-specific interface
export interface IHeadOfDepartment extends IUserBase {
  role: 'head_of_department';
  position: string;
  department: string;
  faculty: string;
}

// Dean-specific interface
export interface IDean extends IUserBase {
  role: 'dean';
  position: string;
  faculty: string;
}

// Admin interface
export interface IAdmin extends IUserBase {
  role: 'admin';
  position: string;
}

// Export the base interface
export type IUser = IStudent | IConsultant | ISupervisor | IReviewer | IHeadOfDepartment | IDean | IAdmin;

interface UserDocument {
  id: string;
  data: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>;
  created_at: Date;
  updated_at: Date;
}

export class UserModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Create a new user with base validation
  async createUser(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserDocument> {
    // Validate required base fields
    if (!userData.email || !userData.password || !userData.fullName || !userData.institution || !userData.role) {
      throw new Error('Missing required base fields: email, password, fullName, institution, role');
    }

    const query = `
      INSERT INTO users (data)
      VALUES ($1)
      RETURNING *;
    `;
    const result = await this.pool.query(query, [userData]);
    return result.rows[0];
  }

  // Get user by ID
  async getUserById(id: string): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    const row = result.rows[0];
    if (!row) return null;

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IUser;
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<IUser | null> {
    const query = `SELECT * FROM users WHERE data->>'email' = $1`;
    const result = await this.pool.query(query, [email]);
    const row = result.rows[0];
    if (!row) return null;

    // Ensure the password is properly extracted from JSONB
    const userData = row.data;

    if (typeof userData === 'object' && userData !== null) {
      return {
        ...userData,
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      } as IUser;
    }

    return null;
  }

  // Get users by role
  async getUsersByRole(role: string): Promise<IUser[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = $1 ORDER BY created_at DESC`;
    const result = await this.pool.query(query, [role]);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IUser[];
  }

  // Get all students
  async getStudents(): Promise<IStudent[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'student' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IStudent[];
  }

  // Get all consultants
  async getConsultants(): Promise<IConsultant[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'consultant' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IConsultant[];
  }

  // Get all supervisors
  async getSupervisors(): Promise<ISupervisor[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'supervisor' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as ISupervisor[];
  }

  // Get all reviewers
  async getReviewers(): Promise<IReviewer[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'reviewer' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IReviewer[];
  }

  // Get all heads of department
  async getHeadsOfDepartment(): Promise<IHeadOfDepartment[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'head_of_department' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IHeadOfDepartment[];
  }

  // Get all deans
  async getDeans(): Promise<IDean[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'dean' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IDean[];
  }

  // Get all admins
  async getAdmins(): Promise<IAdmin[]> {
    const query = `SELECT * FROM users WHERE data->>'role' = 'admin' ORDER BY created_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IAdmin[];
  }

  // Update user
  async updateUser(id: string, userData: Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>): Promise<IUser> {
    const currentUser = await this.getUserById(id);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const updatedData = {
      ...currentUser,
      ...userData
    };

    const query = `
      UPDATE users
      SET data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [updatedData, id]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IUser;
  }

  // Update base user info (email, fullName, institution)
  async updateBaseUserInfo(
    id: string,
    baseInfo: { email?: string; fullName?: string; institution?: string }
  ): Promise<IUser> {
    const currentUser = await this.getUserById(id);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const updatedData = {
      ...currentUser,
      ...baseInfo
    };

    const query = `
      UPDATE users
      SET data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [updatedData, id]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IUser;
  }

  // Update password
  async updatePassword(id: string, newPassword: string): Promise<IUser> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{password}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(newPassword), id]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IUser;
  }

  // Student-specific methods
  async updateStudentThesisStatus(studentId: string, thesisStatus: IStudent['thesisStatus']): Promise<IStudent> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{thesisStatus}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND data->>'role' = 'student'
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(thesisStatus), studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  async updateStudentThesisInfo(
    studentId: string,
    thesisInfo: { thesisTopic?: string; thesisFile?: string; thesisGrade?: string }
  ): Promise<IStudent> {
    const currentUser = await this.getUserById(studentId);
    if (!currentUser || currentUser.role !== 'student') {
      throw new Error('Student not found');
    }

    const updatedData = {
      ...currentUser,
      ...thesisInfo
    };

    const query = `
      UPDATE users
      SET data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [updatedData, studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  async assignReviewerToStudent(studentId: string, reviewerId: string): Promise<IStudent> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{reviewer}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND data->>'role' = 'student'
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(reviewerId), studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  async assignSupervisorToStudent(studentId: string, supervisorId: string): Promise<IStudent> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{supervisor}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND data->>'role' = 'student'
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(supervisorId), studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  async assignConsultantToStudent(studentId: string, consultantId: string): Promise<IStudent> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{consultant}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND data->>'role' = 'student'
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(consultantId), studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  // Consultant-specific methods
  async addStudentToConsultant(consultantId: string, studentId: string): Promise<IConsultant> {
    const currentUser = await this.getUserById(consultantId);
    if (!currentUser || currentUser.role !== 'consultant') {
      throw new Error('Consultant not found');
    }

    const consultantData = currentUser as IConsultant;

    // Check if student already exists in assignedStudents
    const assignedStudents = consultantData.assignedStudents || [];
    if (assignedStudents.includes(studentId)) {
      return currentUser as IConsultant; // Student already assigned, return unchanged
    }

    const updatedAssignedStudents = [...assignedStudents, studentId];

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedStudents}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedStudents), consultantId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IConsultant;
  }

  async removeStudentFromConsultant(consultantId: string, studentId: string): Promise<IConsultant> {
    const currentUser = await this.getUserById(consultantId);
    if (!currentUser || currentUser.role !== 'consultant') {
      throw new Error('Consultant not found');
    }

    const consultantData = currentUser as IConsultant;
    const updatedAssignedStudents = (consultantData.assignedStudents || []).filter(id => id !== studentId);

    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{assignedStudents}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedStudents), consultantId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IConsultant;
  }

  // Supervisor-specific methods
  async addStudentToSupervisor(supervisorId: string, studentId: string): Promise<ISupervisor> {
    const currentUser = await this.getUserById(supervisorId);
    if (!currentUser || currentUser.role !== 'supervisor') {
      throw new Error('Supervisor not found');
    }

    const supervisorData = currentUser as ISupervisor;

    // Check if student already exists in assignedStudents
    const assignedStudents = supervisorData.assignedStudents || [];
    if (assignedStudents.includes(studentId)) {
      return currentUser as ISupervisor; // Student already assigned, return unchanged
    }

    const updatedAssignedStudents = [...assignedStudents, studentId];

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedStudents}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedStudents), supervisorId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as ISupervisor;
  }

  async removeStudentFromSupervisor(supervisorId: string, studentId: string): Promise<ISupervisor> {
    const currentUser = await this.getUserById(supervisorId);
    if (!currentUser || currentUser.role !== 'supervisor') {
      throw new Error('Supervisor not found');
    }

    const supervisorData = currentUser as ISupervisor;
    const updatedAssignedStudents = (supervisorData.assignedStudents || []).filter(id => id !== studentId);

    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{assignedStudents}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedStudents), supervisorId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as ISupervisor;
  }

  // Reviewer-specific methods
  async addThesisToReviewer(reviewerId: string, thesisId: string): Promise<IReviewer> {
    const currentUser = await this.getUserById(reviewerId);
    if (!currentUser || currentUser.role !== 'reviewer') {
      throw new Error('Reviewer not found');
    }

    const reviewerData = currentUser as IReviewer;

    // Check if thesis already exists in assignedTheses
    const assignedTheses = reviewerData.assignedTheses || [];
    if (assignedTheses.includes(thesisId)) {
      return currentUser as IReviewer; // Thesis already assigned, return unchanged
    }

    const updatedAssignedTheses = [...assignedTheses, thesisId];

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedTheses}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedTheses), reviewerId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IReviewer;
  }

  async removeThesisFromReviewer(reviewerId: string, thesisId: string): Promise<IReviewer> {
    const currentUser = await this.getUserById(reviewerId);
    if (!currentUser || currentUser.role !== 'reviewer') {
      throw new Error('Reviewer not found');
    }

    const reviewerData = currentUser as IReviewer;
    const updatedAssignedTheses = (reviewerData.assignedTheses || []).filter(id => id !== thesisId);

    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{assignedTheses}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedTheses), reviewerId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IReviewer;
  }

  async addThesisToReviewed(reviewerId: string, thesisId: string): Promise<IReviewer> {
    const currentUser = await this.getUserById(reviewerId);
    if (!currentUser || currentUser.role !== 'reviewer') {
      throw new Error('Reviewer not found');
    }

    const reviewerData = currentUser as IReviewer;

    // Use Set to prevent duplicates
    const updatedReviewedTheses = [...new Set([
      ...(reviewerData.reviewedTheses || []),
      thesisId
    ])];

    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{reviewedTheses}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(updatedReviewedTheses), reviewerId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IReviewer;
  }

  async addThesisToConsultantReviewed(consultantId: string, thesisId: string): Promise<IConsultant> {
    const currentUser = await this.getUserById(consultantId);
    if (!currentUser || currentUser.role !== 'consultant') {
      throw new Error('Consultant not found');
    }

    const consultantData = currentUser as IConsultant;

    // Check if thesisId already exists to prevent duplicates
    const currentReviewedTheses = consultantData.reviewedTheses || [];
    if (currentReviewedTheses.includes(thesisId)) {
      // If already exists, return the current user data without changes
      return {
        ...consultantData,
        id: currentUser.id,
        createdAt: currentUser.createdAt,
        updatedAt: currentUser.updatedAt
      } as IConsultant;
    }

    // Add thesisId if not already present
    const updatedReviewedTheses = [...currentReviewedTheses, thesisId];

    const query = `
        UPDATE users
        SET data = jsonb_set(data, '{reviewedTheses}', $1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(updatedReviewedTheses), consultantId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IConsultant;
  }

  async addThesisToSupervisorReviewed(supervisorId: string, thesisId: string): Promise<ISupervisor> {
    const currentUser = await this.getUserById(supervisorId);
    if (!currentUser || currentUser.role !== 'supervisor') {
      throw new Error('Supervisor not found');
    }

    const supervisorData = currentUser as ISupervisor;

    // Use Set to prevent duplicates
    const updatedReviewedTheses = [...new Set([
      ...(supervisorData.reviewedTheses || []),
      thesisId
    ])];

    const query = `
        UPDATE users
        SET data = jsonb_set(data, '{reviewedTheses}', $1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(updatedReviewedTheses), supervisorId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as ISupervisor;
  }

  // Position update methods for roles with position field
  async updateUserPosition(userId: string, position: string): Promise<IUser> {
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Check if the user role has a position field
    const rolesWithPosition = ['consultant', 'supervisor', 'reviewer', 'head_of_department', 'dean', 'admin'];
    if (!rolesWithPosition.includes(currentUser.role)) {
      throw new Error(`User role ${currentUser.role} does not have a position field`);
    }

    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{position}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(position), userId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IUser;
  }

  async updateStudentThesisFeedback(
    studentId: string,
    feedback: {
      comments?: string;
      lastReviewDate?: Date;
      reviewIteration: number;
      status: 'pending' | 'approved' | 'revisions_requested';
    },
    currentIteration: number
  ): Promise<IStudent> {
    const currentUser = await this.getUserById(studentId);
    if (!currentUser || currentUser.role !== 'student') {
      throw new Error('Student not found');
    }

    const studentData = currentUser as IStudent;

    const updatedData = {
      ...studentData,
      consultantFeedback: feedback,
      currentReviewIteration: currentIteration,
      totalReviewAttempts: (studentData.totalReviewAttempts || 0) + 1,
      thesisStatus: feedback.status === 'approved' ? 'with_supervisor' : 'revisions_requested'
    };

    const query = `
        UPDATE users
        SET data = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;
    const result = await this.pool.query(query, [updatedData, studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  // In UserModel - Add supervisor feedback method
  async updateStudentSupervisorFeedback(
    studentId: string,
    feedback: {
      comments?: string;
      lastReviewDate?: Date;
      reviewIteration: number;
      status: 'pending' | 'approved' | 'revisions_requested' | 'signed';
      isSigned: boolean;
      signedDate?: Date;
    },
    currentIteration: number
  ): Promise<IStudent> {
    const currentUser = await this.getUserById(studentId);
    if (!currentUser || currentUser.role !== 'student') {
      throw new Error('Student not found');
    }

    const studentData = currentUser as IStudent;

    const updatedData = {
      ...studentData,
      supervisorFeedback: feedback,
      currentReviewIteration: currentIteration,
      totalReviewAttempts: (studentData.totalReviewAttempts || 0) + 1,
      thesisStatus: feedback.status === 'approved' || feedback.status === 'signed' ?
        'under_review' : 'revisions_requested'
    };

    const query = `
        UPDATE users
        SET data = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
    `;
    const result = await this.pool.query(query, [updatedData, studentId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IStudent;
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  // Get all users
  async find(): Promise<IUser[]> {
    const query = 'SELECT id, data, created_at, updated_at FROM users ORDER BY created_at DESC';
    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IUser[];
  }

  // Get users with pagination
  async findWithPagination(limit: number, offset: number): Promise<IUser[]> {
    const query = `
      SELECT id, data, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await this.pool.query(query, [limit, offset]);

    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IUser[];
  }

  // Search users by name or email
  async searchUsers(searchTerm: string): Promise<IUser[]> {
    const query = `
      SELECT * FROM users 
      WHERE data->>'fullName' ILIKE $1 OR data->>'email' ILIKE $1
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [`%${searchTerm}%`]);

    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IUser[];
  }

  // Count total users
  async count(): Promise<number> {
    const query = 'SELECT COUNT(*) FROM users';
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // Count users by role
  async countByRole(role: string): Promise<number> {
    const query = 'SELECT COUNT(*) FROM users WHERE data->>\'role\' = $1';
    const result = await this.pool.query(query, [role]);
    return parseInt(result.rows[0].count);
  }

  // Check if email exists
  async emailExists(email: string): Promise<boolean> {
    const query = `SELECT 1 FROM users WHERE data->>'email' = $1`;
    const result = await this.pool.query(query, [email]);
    return result.rows.length > 0;
  }

  // Factory methods to create specific user types
  async createStudent(studentData: Omit<IStudent, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<IStudent> {
    const data: Omit<IStudent, 'id' | 'createdAt' | 'updatedAt'> = {
      ...studentData,
      role: 'student'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as IStudent;
  }

  async createConsultant(consultantData: Omit<IConsultant, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<IConsultant> {
    const data: Omit<IConsultant, 'id' | 'createdAt' | 'updatedAt'> = {
      ...consultantData,
      role: 'consultant'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as IConsultant;
  }

  async createSupervisor(supervisorData: Omit<ISupervisor, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<ISupervisor> {
    const data: Omit<ISupervisor, 'id' | 'createdAt' | 'updatedAt'> = {
      ...supervisorData,
      role: 'supervisor'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as ISupervisor;
  }

  async createReviewer(reviewerData: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<IReviewer> {
    const data: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt'> = {
      ...reviewerData,
      role: 'reviewer'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as IReviewer;
  }

  async createHeadOfDepartment(hodData: Omit<IHeadOfDepartment, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<IHeadOfDepartment> {
    const data: Omit<IHeadOfDepartment, 'id' | 'createdAt' | 'updatedAt'> = {
      ...hodData,
      role: 'head_of_department'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as IHeadOfDepartment;
  }

  async createDean(deanData: Omit<IDean, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<IDean> {
    const data: Omit<IDean, 'id' | 'createdAt' | 'updatedAt'> = {
      ...deanData,
      role: 'dean'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as IDean;
  }

  async createAdmin(adminData: Omit<IAdmin, 'id' | 'createdAt' | 'updatedAt' | 'role'>): Promise<IAdmin> {
    const data: Omit<IAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
      ...adminData,
      role: 'admin'
    };
    const result = await this.createUser(data);
    return {
      ...result.data,
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    } as IAdmin;
  }

  // In UserModel - Add these methods

  // For consultants and supervisors
  async addThesisToConsultant(consultantId: string, thesisId: string): Promise<IConsultant> {
    const currentUser = await this.getUserById(consultantId);
    if (!currentUser || currentUser.role !== 'consultant') {
      throw new Error('Consultant not found');
    }

    const consultantData = currentUser as IConsultant;

    // Check if thesis already exists in assignedTheses
    const assignedTheses = consultantData.assignedTheses || [];
    if (assignedTheses.includes(thesisId)) {
      return currentUser as IConsultant; // Thesis already assigned, return unchanged
    }

    const updatedAssignedTheses = [...assignedTheses, thesisId];

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedTheses}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedTheses), consultantId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IConsultant;
  }

  // Similar method for supervisor...
  async addThesisToSupervisor(supervisorId: string, thesisId: string): Promise<ISupervisor> {
    const currentUser = await this.getUserById(supervisorId);
    if (!currentUser || currentUser.role !== 'supervisor') {
      throw new Error('Supervisor not found');
    }

    const supervisorData = currentUser as ISupervisor;

    // Check if thesis already exists in assignedTheses
    const assignedTheses = supervisorData.assignedTheses || [];
    if (assignedTheses.includes(thesisId)) {
      return currentUser as ISupervisor; // Thesis already assigned, return unchanged
    }

    const updatedAssignedTheses = [...assignedTheses, thesisId];

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedTheses}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedTheses), supervisorId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as ISupervisor;
  }


  async removeThesisFromConsultant(consultantId: string, thesisId: string): Promise<IConsultant> {
    const currentUser = await this.getUserById(consultantId);
    if (!currentUser || currentUser.role !== 'consultant') {
      throw new Error('Consultant not found');
    }

    const consultantData = currentUser as IConsultant;
    const updatedAssignedTheses = (consultantData.assignedTheses || []).filter(id => id !== thesisId);

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedTheses}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedTheses), consultantId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IConsultant;
  }

  async removeThesisFromSupervisor(supervisorId: string, thesisId: string): Promise<ISupervisor> {
    const currentUser = await this.getUserById(supervisorId);
    if (!currentUser || currentUser.role !== 'supervisor') {
      throw new Error('Supervisor not found');
    }

    const supervisorData = currentUser as ISupervisor;
    const updatedAssignedTheses = (supervisorData.assignedTheses || []).filter(id => id !== thesisId);

    const query = `
    UPDATE users
    SET data = jsonb_set(data, '{assignedTheses}', $1), updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
    const result = await this.pool.query(query, [JSON.stringify(updatedAssignedTheses), supervisorId]);
    const row = result.rows[0];

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as ISupervisor;
  }


  // Type guards for runtime type checking
  isStudent(user: IUser): user is IStudent {
    return user.role === 'student';
  }

  isConsultant(user: IUser): user is IConsultant {
    return user.role === 'consultant';
  }

  isSupervisor(user: IUser): user is ISupervisor {
    return user.role === 'supervisor';
  }

  isReviewer(user: IUser): user is IReviewer {
    return user.role === 'reviewer';
  }

  isHeadOfDepartment(user: IUser): user is IHeadOfDepartment {
    return user.role === 'head_of_department';
  }

  isDean(user: IUser): user is IDean {
    return user.role === 'dean';
  }

  isAdmin(user: IUser): user is IAdmin {
    return user.role === 'admin';
  }
}

// Export factory functions for convenience
export const Student = {
  create: (userModel: UserModel, studentData: Omit<IStudent, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createStudent(studentData),

  find: (userModel: UserModel) => userModel.getStudents(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'student' ? user as IStudent : null
  )
};

export const Consultant = {
  create: (userModel: UserModel, consultantData: Omit<IConsultant, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createConsultant(consultantData),

  find: (userModel: UserModel) => userModel.getConsultants(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'consultant' ? user as IConsultant : null
  )
};

export const Supervisor = {
  create: (userModel: UserModel, supervisorData: Omit<ISupervisor, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createSupervisor(supervisorData),

  find: (userModel: UserModel) => userModel.getSupervisors(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'supervisor' ? user as ISupervisor : null
  )
};

export const Reviewer = {
  create: (userModel: UserModel, reviewerData: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createReviewer(reviewerData),

  find: (userModel: UserModel) => userModel.getReviewers(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'reviewer' ? user as IReviewer : null
  )
  // Removed findApproved and findUnapproved methods
};

export const HeadOfDepartment = {
  create: (userModel: UserModel, hodData: Omit<IHeadOfDepartment, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createHeadOfDepartment(hodData),

  find: (userModel: UserModel) => userModel.getHeadsOfDepartment(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'head_of_department' ? user as IHeadOfDepartment : null
  )
};

export const Dean = {
  create: (userModel: UserModel, deanData: Omit<IDean, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createDean(deanData),

  find: (userModel: UserModel) => userModel.getDeans(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'dean' ? user as IDean : null
  )
};

export const Admin = {
  create: (userModel: UserModel, adminData: Omit<IAdmin, 'id' | 'createdAt' | 'updatedAt' | 'role'>) =>
    userModel.createAdmin(adminData),

  find: (userModel: UserModel) => userModel.getAdmins(),

  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user =>
    user && user.role === 'admin' ? user as IAdmin : null
  )
};

export default UserModel;