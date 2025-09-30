import { Pool } from 'pg';

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

export interface IThesis {
  id: string;
  title: string;
  student: string; // UUID reference to student
  fileUrl: string;
  submissionDate: Date;
  status: "submitted" | "assigned" | "under_review" | "evaluated";
  assignedReviewer?: string; // UUID reference to reviewer
  finalGrade?: string;
  assessment?: IAssessment;
  reviewPdf?: string;
  signedReviewPath?: string;
  signedDate?: Date;
}

interface ThesisDocument {
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
 // In your ThesisModel, update the getThesisWithUsers method:
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
      r.id as reviewer_id
    FROM theses t
    LEFT JOIN users s ON t.data->>'student' = s.id
    LEFT JOIN users r ON t.data->>'assignedReviewer' = r.id
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
      id: row.student_id // Use the actual student_id from join
    } : null,
    assignedReviewer: row.reviewer_data ? {
      ...row.reviewer_data,
      id: row.reviewer_id // Use the actual reviewer_id from join
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
        'assignedReviewer', $1::jsonb,
        'status', '"assigned"'
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await this.pool.query(query, [JSON.stringify(reviewerId), id]);
    return result.rows[0];
  }

  // Unassign reviewer from thesis
  async unassignReviewer(id: string): Promise<ThesisDocument> {
    const query = `
      UPDATE theses
      SET data = data - 'assignedReviewer' || jsonb_build_object('status', '"submitted"'),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  // Add assessment to thesis
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
}