// models/SupervisorRequest.model.ts
import { Pool } from 'pg';

export interface ISupervisorRequest {
  id: string;
  studentId: string;
  supervisorId: string;
  faculty: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  studentMessage?: string;
  declineReason?: string;
}

interface SupervisorRequestDocument {
  id: string;
  data: Omit<ISupervisorRequest, 'id' | 'createdAt' | 'updatedAt'>;
  created_at: Date;
  updated_at: Date;
}

export class SupervisorRequestModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Create table if not exists
  async createTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS supervisor_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_supervisor_requests_student_id ON supervisor_requests ((data->>'studentId'));
      CREATE INDEX IF NOT EXISTS idx_supervisor_requests_supervisor_id ON supervisor_requests ((data->>'supervisorId'));
      CREATE INDEX IF NOT EXISTS idx_supervisor_requests_status ON supervisor_requests ((data->>'status'));
      CREATE INDEX IF NOT EXISTS idx_supervisor_requests_faculty ON supervisor_requests ((data->>'faculty'));
    `;
    await this.pool.query(query);
  }

  // Create a new supervisor request
  async createSupervisorRequest(requestData: Omit<ISupervisorRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const query = `
      INSERT INTO supervisor_requests (data)
      VALUES ($1)
      RETURNING id;
    `;
    const result = await this.pool.query(query, [requestData]);
    return result.rows[0].id;
  }

  // Get request by ID
  async getRequestById(requestId: string): Promise<ISupervisorRequest | null> {
    const query = 'SELECT * FROM supervisor_requests WHERE id = $1';
    const result = await this.pool.query(query, [requestId]);
    const row = result.rows[0];
    if (!row) return null;

    return {
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as ISupervisorRequest;
  }

  // Get pending requests for supervisor
  async getPendingRequestsForSupervisor(supervisorId: string): Promise<ISupervisorRequest[]> {
    const query = `
      SELECT * FROM supervisor_requests 
      WHERE data->>'supervisorId' = $1 AND data->>'status' = 'pending'
      ORDER BY created_at DESC;
    `;
    const result = await this.pool.query(query, [supervisorId]);
    
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as ISupervisorRequest[];
  }

  // Get requests by student
  async getRequestsByStudent(studentId: string): Promise<ISupervisorRequest[]> {
    const query = `
      SELECT * FROM supervisor_requests 
      WHERE data->>'studentId' = $1
      ORDER BY created_at DESC;
    `;
    const result = await this.pool.query(query, [studentId]);
    
    return result.rows.map(row => ({
      ...row.data,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as ISupervisorRequest[];
  }

  // Update request status
  async updateRequestStatus(requestId: string, status: 'accepted' | 'declined' | 'cancelled', declineReason?: string): Promise<void> {
    const currentRequest = await this.getRequestById(requestId);
    if (!currentRequest) {
      throw new Error('Request not found');
    }

    const updatedData = {
      ...currentRequest,
      status,
      declineReason: declineReason || currentRequest.declineReason,
      updatedAt: new Date()
    };

    const query = `
      UPDATE supervisor_requests
      SET data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `;
    await this.pool.query(query, [updatedData, requestId]);
  }

  // Check if student has pending request to supervisor
  async hasPendingRequest(studentId: string, supervisorId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM supervisor_requests 
      WHERE data->>'studentId' = $1 
      AND data->>'supervisorId' = $2 
      AND data->>'status' = 'pending';
    `;
    const result = await this.pool.query(query, [studentId, supervisorId]);
    return result.rows.length > 0;
  }

  // Get all pending requests count for supervisor
  async getPendingRequestsCount(supervisorId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM supervisor_requests 
      WHERE data->>'supervisorId' = $1 AND data->>'status' = 'pending';
    `;
    const result = await this.pool.query(query, [supervisorId]);
    return parseInt(result.rows[0].count);
  }

  // Delete request (for cleanup)
  async deleteRequest(requestId: string): Promise<void> {
    await this.pool.query('DELETE FROM supervisor_requests WHERE id = $1', [requestId]);
  }
}