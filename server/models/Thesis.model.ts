import { Document, Schema, model } from 'mongoose';
import { IStudent, IReviewer } from './User.model';

export interface IThesis extends Document {
  title: string;
  student: Schema.Types.ObjectId | IStudent;
  fileUrl: string;
  submissionDate: Date;
  status: 'submitted' | 'assigned' | 'under_review' | 'evaluated';
  assignedReviewer: Schema.Types.ObjectId | IReviewer;
  finalGrade?: string;
}

const thesisSchema = new Schema<IThesis>({
  title: { type: String, required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fileUrl: { type: String, required: true },
  submissionDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['submitted', 'assigned', 'under_review', 'evaluated'],
    default: 'submitted'
  },
 assignedReviewer: { type: Schema.Types.ObjectId, ref: 'User' },
  finalGrade: { type: String }
});

export const Thesis = model<IThesis>('Thesis', thesisSchema);