import { Pool } from 'pg';

// Shared base interface - ALL users have these fields
interface IUserBase {
  id: string;
  email: string;
  password: string;
  fullName: string;
  institution: string;
  role: 'student' | 'reviewer' | 'admin';
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
  thesisStatus?: 'not_submitted' | 'submitted' | 'under_review' | 'evaluated';
  thesisGrade?: string;
  thesisFile?: string;
  reviewer?: string;
}

// Reviewer-specific interface
export interface IReviewer extends IUserBase {
  role: 'reviewer';
  positions: string[];
  assignedTheses: string[];
  reviewedTheses: string[];
  isApproved: boolean;
}

// Admin interface
export interface IAdmin extends IUserBase {
  role: 'admin';
  position: string;
}

// Export the base interface
export type IUser = IStudent | IReviewer | IAdmin;

interface UserDocument {
  id: string;
  data: IUser;
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

  // Get approved reviewers
  async getApprovedReviewers(): Promise<IReviewer[]> {
    const query = `
      SELECT * FROM users 
      WHERE data->>'role' = 'reviewer' AND data->>'isApproved' = 'true' 
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IReviewer[];
  }

  // Get unapproved reviewers
  async getUnapprovedReviewers(): Promise<IReviewer[]> {
    const query = `
      SELECT * FROM users 
      WHERE data->>'role' = 'reviewer' AND (data->>'isApproved' = 'false' OR data->>'isApproved' IS NULL)
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as IReviewer[];
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

  // Reviewer-specific methods
  async addThesisToReviewer(reviewerId: string, thesisId: string): Promise<IReviewer> {
    const currentUser = await this.getUserById(reviewerId);
    if (!currentUser || currentUser.role !== 'reviewer') {
      throw new Error('Reviewer not found');
    }

    const reviewerData = currentUser as IReviewer;
    const updatedAssignedTheses = [...(reviewerData.assignedTheses || []), thesisId];

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
    const updatedReviewedTheses = [...(reviewerData.reviewedTheses || []), thesisId];

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

  async approveReviewer(reviewerId: string): Promise<IReviewer> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{isApproved}', 'true'), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND data->>'role' = 'reviewer'
      RETURNING *;
    `;
    const result = await this.pool.query(query, [reviewerId]);
    const row = result.rows[0];
    
    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IReviewer;
  }

  // Admin-specific method
  async updateAdminPosition(adminId: string, position: string): Promise<IAdmin> {
    const query = `
      UPDATE users
      SET data = jsonb_set(data, '{position}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND data->>'role' = 'admin'
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(position), adminId]);
    const row = result.rows[0];
    
    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as IAdmin;
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

  // Type guards for runtime type checking
  isStudent(user: IUser): user is IStudent {
    return user.role === 'student';
  }

  isReviewer(user: IUser): user is IReviewer {
    return user.role === 'reviewer';
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

export const Reviewer = {
  create: (userModel: UserModel, reviewerData: Omit<IReviewer, 'id' | 'createdAt' | 'updatedAt' | 'role'>) => 
    userModel.createReviewer(reviewerData),
  
  find: (userModel: UserModel) => userModel.getReviewers(),
  
  findById: (userModel: UserModel, id: string) => userModel.getUserById(id).then(user => 
    user && user.role === 'reviewer' ? user as IReviewer : null
  ),
  
  findApproved: (userModel: UserModel) => userModel.getApprovedReviewers(),
  
  findUnapproved: (userModel: UserModel) => userModel.getUnapprovedReviewers()
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