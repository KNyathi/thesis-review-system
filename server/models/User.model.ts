import { Document, Schema, Types, model } from 'mongoose';

// Shared base interface
interface IUserBase extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  institution: string;
  role: 'student' | 'reviewer' | 'admin';
  createdAt: Date;
}

// Student-specific interface
export interface IStudent extends IUserBase {
  role: 'student';
  faculty: string;
  group: string;
  subjectArea: string;
  educationalProgram: string;
  degreeLevel: 'bachelors' | 'masters';
  thesisTopic?: string;
  thesisStatus?: 'not_submitted' | 'submitted' | 'under_review' | 'evaluated';
  thesisGrade?: string;
  thesisFile?: string; // URL to PDF
  reviewer?: Types.ObjectId; // Assigned reviewer
}

// Reviewer-specific interface
export interface IReviewer extends IUserBase {
  role: 'reviewer';
  positions: string[];
  assignedTheses: Types.ObjectId[]; // Thesis IDs
  reviewedTheses: Types.ObjectId[];
  isApproved: boolean;
}

// Admin interface
export interface IAdmin extends IUserBase {
  role: 'admin';
  position: string;
}

// Export the base interface
export type IUser = IStudent | IReviewer | IAdmin;

// Base schema
const userSchema = new Schema<IUserBase>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  institution: { type: String, required: true },
  role: { type: String, required: true, enum: ['student', 'reviewer', 'admin'] },
}, { timestamps: true });

// Create the base model
export const User = model<IUserBase>('User', userSchema);

// Student schema
const studentSchema = new Schema<IStudent>({
  faculty: { type: String },
  group: { type: String },
  subjectArea: { type: String },
  educationalProgram: { type: String },
  degreeLevel: { type: String, enum: ['bachelors', 'masters'] },
  thesisTopic: { type: String },
  thesisStatus: { type: String, enum: ['not_submitted', 'submitted', 'under_review', 'evaluated'], default: 'not_submitted' },
  thesisGrade: { type: String },
  thesisFile: { type: String },
  reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
});

// Reviewer schema
const reviewerSchema = new Schema<IReviewer>({
  positions: { type: [String] },
  assignedTheses: [{ type: Schema.Types.ObjectId, ref: 'Thesis' }],
  reviewedTheses: [{ type: Schema.Types.ObjectId, ref: 'Thesis' }],
  isApproved: { type: Boolean, default: false },
});

// Admin schema
const adminSchema = new Schema<IAdmin>({
  position: { type: String },
});

export const Student = User.discriminator<IStudent>('Student', studentSchema);
export const Reviewer = User.discriminator<IReviewer>('Reviewer', reviewerSchema);
export const Admin = User.discriminator<IAdmin>('Admin', adminSchema);