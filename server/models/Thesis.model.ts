import { Pool } from 'pg';
import UserModel, { IConsultant, ISupervisor, IUser } from './User.model';
const pool = new Pool({
  connectionString: process.env.DB_URL
});


const userModel = new UserModel(pool);

interface IAssessment {
  section1: {
    topicCorrespondence: string;
    relevanceJustification: string;
    subjectAreaCorrespondence: string;
    researchMethodsCorrectness: string;
    materialPresentation: string;
    assertionsJustification: string;
    researchValue: string;
    researchFindingsIntegration: string;
  };
  section2: {
    questions: string[];
    advantages: string[];
    disadvantages: string[];
    critique: string[];
    conclusion: {
      finalAssessment: string;
      isComplete: boolean;
      isDeserving: boolean;
    };
  };
}

interface IConsultantReview {
  comments: string;
  submittedDate: Date;
  status: 'pending' | 'approved' | 'revisions_requested';
  iteration: number; // Track which review iteration this is
  isFinalApproval: boolean; // Whether this review approved the thesis
}

interface ISupervisorReview {
  comments: string;
  submittedDate: Date;
  status: 'pending' | 'approved' | 'revisions_requested' | 'signed';
  iteration: number; // Track which review iteration this is
  isFinalApproval: boolean; // Whether this review approved the thesis
  signedDate?: Date;
}

export interface IReviewIteration {
  iteration: number;
  consultantReview?: IConsultantReview;
  supervisorReview?: ISupervisorReview;
  studentResubmissionDate?: Date;
  status: 'under_review' | 'approved' | 'revisions_requested';
}

export interface IThesis {
  title: string;
  student: string; // UUID reference to student
  fileUrl: string;
  submissionDate: Date;
  status: "submitted" | "with_consultant" | "with_supervisor" | "under_review" | "evaluated" | "revisions_requested";
  assignedReviewer?: string;
  assignedConsultant?: string;
  assignedSupervisor?: string;
  finalGrade?: string;
  assessment?: IAssessment;
  
  // Track all review iterations
  reviewIterations: IReviewIteration[];
  currentIteration: number;
  totalReviewCount: number; // Total number of reviews across all iterations
  
  reviewPdf?: string;
  signedReviewPath?: string;
  signedDate?: Date;
}

export interface ThesisDocument {
  id: string;
  data: IThesis;
  created_at: Date;
  updated_at: Date;
}

export class ThesisModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Create a new thesis
  async createThesis(thesisData: IThesis): Promise<ThesisDocument> {
    const query = `
      INSERT INTO theses (data)
      VALUES ($1)
      RETURNING *;
    `;
    const result = await this.pool.query(query, [thesisData]);
    return result.rows[0];
  }

  // Get thesis by ID
  async getThesisById(id: string): Promise<ThesisDocument | null> {
    const query = 'SELECT * FROM theses WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Get thesis by ID with user data (join with users table)
  async getThesisWithUsers(id: string): Promise<any> {
    const query = `
      SELECT 
        t.id,
        t.data as thesis_data,
        t.created_at,
        t.updated_at,
        s.data as student_data,
        s.id as student_id,
        r.data as reviewer_data,
        r.id as reviewer_id,
        c.data as consultant_data,
        c.id as consultant_id,
        sup.data as supervisor_data,
        sup.id as supervisor_id
      FROM theses t
      LEFT JOIN users s ON t.data->>'student' = s.id
      LEFT JOIN users r ON t.data->>'assignedReviewer' = r.id
      LEFT JOIN users c ON t.data->>'assignedConsultant' = c.id
      LEFT JOIN users sup ON t.data->>'assignedSupervisor' = sup.id
      WHERE t.id = $1
    `;
    const result = await this.pool.query(query, [id]);
    
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      ...row.thesis_data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      student: row.student_data ? {
        ...row.student_data,
        id: row.student_id
      } : null,
      assignedReviewer: row.reviewer_data ? {
        ...row.reviewer_data,
        id: row.reviewer_id
      } : null,
      assignedConsultant: row.consultant_data ? {
        ...row.consultant_data,
        id: row.consultant_id
      } : null,
      assignedSupervisor: row.supervisor_data ? {
        ...row.supervisor_data,
        id: row.supervisor_id
      } : null
    };
  }

  // Get theses by status
  async getThesesByStatus(status: string): Promise<ThesisDocument[]> {
    const query = `SELECT * FROM theses WHERE data->>'status' = $1 ORDER BY created_at DESC`;
    const result = await this.pool.query(query, [status]);
    return result.rows;
  }

  // Get theses by student
  async getThesesByStudent(studentId: string): Promise<ThesisDocument[]> {
    const query = `SELECT * FROM theses WHERE data->>'student' = $1 ORDER BY created_at DESC`;
    const result = await this.pool.query(query, [studentId]);
    return result.rows;
  }

  // Get theses by reviewer
  async getThesesByReviewer(reviewerId: string): Promise<ThesisDocument[]> {
    const query = `SELECT * FROM theses WHERE data->>'assignedReviewer' = $1 ORDER BY created_at DESC`;
    const result = await this.pool.query(query, [reviewerId]);
    return result.rows;
  }

  // Get theses by consultant
  async getThesesByConsultant(consultantId: string): Promise<ThesisDocument[]> {
    const query = `SELECT * FROM theses WHERE data->>'assignedConsultant' = $1 ORDER BY created_at DESC`;
    const result = await this.pool.query(query, [consultantId]);
    return result.rows;
  }

  // Get theses by supervisor
  async getThesesBySupervisor(supervisorId: string): Promise<ThesisDocument[]> {
    const query = `SELECT * FROM theses WHERE data->>'assignedSupervisor' = $1 ORDER BY created_at DESC`;
    const result = await this.pool.query(query, [supervisorId]);
    return result.rows;
  }

  // Get unassigned theses (no reviewer assigned)
  async getUnassignedTheses(): Promise<ThesisDocument[]> {
    const query = `
      SELECT * FROM theses 
      WHERE data->>'assignedReviewer' IS NULL OR data->>'assignedReviewer' = ''
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Update thesis
  async updateThesis(id: string, thesisData: Partial<IThesis>): Promise<ThesisDocument> {
    const currentThesis = await this.getThesisById(id);
    if (!currentThesis) {
      throw new Error('Thesis not found');
    }

    const updatedData = {
      ...currentThesis.data,
      ...thesisData
    };

    const query = `
      UPDATE theses
      SET data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [updatedData, id]);
    return result.rows[0];
  }

  // Update thesis status
  async updateThesisStatus(id: string, status: IThesis['status']): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = jsonb_set(data, '{status}', $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(status), id]);
    return result.rows[0];
  }

  // Assign reviewer to thesis
  async assignReviewer(id: string, reviewerId: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data || jsonb_build_object(
        'assignedReviewer', $1::jsonb
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(reviewerId), id]);
    return result.rows[0];
  }

  // Assign consultant to thesis
  async assignConsultant(id: string, consultantId: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data || jsonb_build_object(
        'assignedConsultant', $1::jsonb
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(consultantId), id]);
    return result.rows[0];
  }

  // Assign supervisor to thesis
  async assignSupervisor(id: string, supervisorId: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data || jsonb_build_object(
        'assignedSupervisor', $1::jsonb
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(supervisorId), id]);
    return result.rows[0];
  }

  // Unassign reviewer from thesis
  async unassignReviewer(id: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data - 'assignedReviewer',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  // Unassign consultant from thesis
  async unassignConsultant(id: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data - 'assignedConsultant',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  // Unassign supervisor from thesis
  async unassignSupervisor(id: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data - 'assignedSupervisor',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  // Add assessment to thesis (for reviewer)
  async addAssessment(id: string, assessment: IAssessment): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = jsonb_set(data, '{assessment}', $1), 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [assessment, id]);
    return result.rows[0];
  }

  // Add consultant review
  async addConsultantReview(id: string, consultantReview: IConsultantReview): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = jsonb_set(data, '{consultantReview}', $1), 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [consultantReview, id]);
    return result.rows[0];
  }

  // Add supervisor review
  async addSupervisorReview(id: string, supervisorReview: ISupervisorReview): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = jsonb_set(data, '{supervisorReview}', $1), 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [supervisorReview, id]);
    return result.rows[0];
  }

  // Update final grade and mark as evaluated
  async updateGrade(id: string, grade: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data || jsonb_build_object(
        'finalGrade', $1::jsonb,
        'status', '"evaluated"'
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(grade), id]);
    return result.rows[0];
  }

  // Mark supervisor review as signed
  async signSupervisorReview(id: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = jsonb_set(
        jsonb_set(
          data, 
          '{supervisorReview,status}', '"signed"'
        ),
        '{supervisorReview,signedDate}', $1
      ), 
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(new Date()), id]);
    return result.rows[0];
  }

  // Delete thesis
  async deleteThesis(id: string): Promise<void> {
    await this.pool.query('DELETE FROM theses WHERE id = $1', [id]);
  }

  // Get all theses (with MongoDB-like compatibility)
  async find(): Promise<any[]> {
    const query = 'SELECT id, data, created_at, updated_at FROM theses ORDER BY created_at DESC';
    const result = await this.pool.query(query);
    
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Get theses with pagination
  async findWithPagination(limit: number, offset: number): Promise<any[]> {
    const query = `
      SELECT id, data, created_at, updated_at 
      FROM theses 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await this.pool.query(query, [limit, offset]);
    
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Count total theses
  async count(): Promise<number> {
    const query = 'SELECT COUNT(*) FROM theses';
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // Count theses by status
  async countByStatus(status: string): Promise<number> {
    const query = 'SELECT COUNT(*) FROM theses WHERE data->>\'status\' = $1';
    const result = await this.pool.query(query, [status]);
    return parseInt(result.rows[0].count);
  }

  // Get theses that need consultant review
  async getThesesForConsultantReview(): Promise<ThesisDocument[]> {
    const query = `
      SELECT * FROM theses 
      WHERE data->>'status' = 'with_consultant' 
      AND (data->'consultantReview' IS NULL OR data->'consultantReview'->>'status' = 'pending')
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Get theses that need supervisor review
  async getThesesForSupervisorReview(): Promise<ThesisDocument[]> {
    const query = `
      SELECT * FROM theses 
      WHERE data->>'status' = 'with_supervisor' 
      AND (data->'supervisorReview' IS NULL OR data->'supervisorReview'->>'status' = 'pending')
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Get theses that need supervisor signature
  async getThesesForSupervisorSignature(): Promise<ThesisDocument[]> {
    const query = `
      SELECT * FROM theses 
      WHERE data->>'status' = 'with_supervisor' 
      AND data->'supervisorReview'->>'status' = 'completed'
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

// In ThesisModel - Add these methods

// Start a new review iteration
async startNewIteration(thesisId: string): Promise<ThesisDocument> {
  const thesis = await this.getThesisById(thesisId);
  if (!thesis) throw new Error('Thesis not found');

  const currentIteration = thesis.data.currentIteration + 1;
  
  const newIteration: IReviewIteration = {
    iteration: currentIteration,
    status: 'under_review'
  };

  const updatedData = {
    ...thesis.data,
    currentIteration,
    totalReviewCount: thesis.data.totalReviewCount + 1,
    reviewIterations: [...(thesis.data.reviewIterations || []), newIteration]
  };

  const query = `
    UPDATE theses
    SET data = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await this.pool.query(query, [updatedData, thesisId]);
  return result.rows[0];
}

// Submit consultant review for current iteration
async submitConsultantReview(
  thesisId: string, 
  comments: string, 
  status: 'approved' | 'revisions_requested',
  isFinalApproval: boolean = false
): Promise<ThesisDocument> {
  const thesis = await this.getThesisById(thesisId);
  if (!thesis) throw new Error('Thesis not found');

  const currentIteration = thesis.data.currentIteration;
  const reviewIterations = [...(thesis.data.reviewIterations || [])];
  
  const consultantReview: IConsultantReview = {
    comments,
    submittedDate: new Date(),
    status,
    iteration: currentIteration,
    isFinalApproval
  };

  // Update the current iteration
  reviewIterations[currentIteration - 1] = {
    ...reviewIterations[currentIteration - 1],
    consultantReview,
    status: status === 'approved' ? 'approved' : 'revisions_requested'
  };

  const updatedData = {
    ...thesis.data,
    reviewIterations,
    status: status === 'approved' ? 'with_supervisor' : 'revisions_requested'
  };

  const query = `
    UPDATE theses
    SET data = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await this.pool.query(query, [updatedData, thesisId]);
  return result.rows[0];
}

// Submit supervisor review for current iteration
async submitSupervisorReview(
  thesisId: string, 
  comments: string, 
  status: 'approved' | 'revisions_requested',
  isFinalApproval: boolean = false
): Promise<ThesisDocument> {
  const thesis = await this.getThesisById(thesisId);
  if (!thesis) throw new Error('Thesis not found');

  const currentIteration = thesis.data.currentIteration;
  const reviewIterations = [...(thesis.data.reviewIterations || [])];
  
  const supervisorReview: ISupervisorReview = {
    comments,
    submittedDate: new Date(),
    status,
    iteration: currentIteration,
    isFinalApproval
  };

  // Update the current iteration
  reviewIterations[currentIteration - 1] = {
    ...reviewIterations[currentIteration - 1],
    supervisorReview,
    status: status === 'approved' ? 'approved' : 'revisions_requested'
  };

  const newStatus = status === 'approved' 
    ? (thesis.data.assignedReviewer ? 'under_review' : 'evaluated')
    : 'revisions_requested';

  const updatedData = {
    ...thesis.data,
    reviewIterations,
    status: newStatus
  };

  const query = `
    UPDATE theses
    SET data = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await this.pool.query(query, [updatedData, thesisId]);
  return result.rows[0];
}

// Student resubmits after revisions
async studentResubmitThesis(thesisId: string): Promise<ThesisDocument> {
  const thesis = await this.getThesisById(thesisId);
  if (!thesis) throw new Error('Thesis not found');

  const currentIteration = thesis.data.currentIteration;
  const reviewIterations = [...(thesis.data.reviewIterations || [])];
  
  // Update current iteration with resubmission date
  reviewIterations[currentIteration - 1] = {
    ...reviewIterations[currentIteration - 1],
    studentResubmissionDate: new Date()
  };

  // Start new iteration
  const newIteration: IReviewIteration = {
    iteration: currentIteration + 1,
    status: 'under_review'
  };

  const updatedData = {
    ...thesis.data,
    currentIteration: currentIteration + 1,
    totalReviewCount: thesis.data.totalReviewCount + 1,
    reviewIterations: [...reviewIterations, newIteration],
    status: thesis.data.assignedConsultant ? 'with_consultant' : 'with_supervisor'
  };

  const query = `
    UPDATE theses
    SET data = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await this.pool.query(query, [updatedData, thesisId]);
  return result.rows[0];
}

// Update consultant/supervisor stats
async updateConsultantStats(consultantId: string, thesisId: string, wasApproved: boolean): Promise<void> {
  const consultant = await userModel.getUserById(consultantId);
  if (!consultant || consultant.role !== 'consultant') return;

  const consultantData = consultant as IConsultant;
  
  const updatedStats = {
    totalReviews: (consultantData.reviewStats?.totalReviews || 0) + 1,
    approvedTheses: (consultantData.reviewStats?.approvedTheses || 0) + (wasApproved ? 1 : 0),
    averageReviewCount: 0 // Will be calculated based on all theses
  };

  // Add to reviewed theses if not already there
  const reviewedTheses = [...new Set([...(consultantData.reviewedTheses || []), thesisId])];

  await userModel.updateUser(consultantId, {
    reviewedTheses,
    reviewStats: updatedStats
  } as Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>);
}

// Similar method for supervisor...
async updateSupervisorStats(supervisorId: string, thesisId: string, wasApproved: boolean): Promise<void> {
  const supervisor = await userModel.getUserById(supervisorId);
  if (!supervisor || supervisor.role !== 'supervisor') return;

  const supervisorData = supervisor as ISupervisor;
  
  const updatedStats = {
    totalReviews: (supervisorData.reviewStats?.totalReviews || 0) + 1,
    approvedTheses: (supervisorData.reviewStats?.approvedTheses || 0) + (wasApproved ? 1 : 0),
    averageReviewCount: 0
  };

  const reviewedTheses = [...new Set([...(supervisorData.reviewedTheses || []), thesisId])];

  await userModel.updateUser(supervisorId, {
    reviewedTheses,
    reviewStats: updatedStats
   } as Partial<Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>>);
}

}