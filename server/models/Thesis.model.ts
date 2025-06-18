import { Document, Schema, model } from 'mongoose';
import { IStudent, IReviewer } from './User.model';

// Define the structure for assessment data
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

export interface IThesis extends Document {
  title: string;
  student: Schema.Types.ObjectId | IStudent;
  fileUrl: string;
  submissionDate: Date;
  status: 'submitted' | 'assigned' | 'under_review' | 'evaluated';
  assignedReviewer: Schema.Types.ObjectId | IReviewer;
  finalGrade?: string;
  assessment?: IAssessment;
  reviewPdf?: string;
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
  finalGrade: { type: String },
   assessment: {
    section1: {
      topicCorrespondence: String,
      relevanceJustification: String,
      subjectAreaCorrespondence: String,
      researchMethodsCorrectness: String,
      materialPresentation: String,
      assertionsJustification: String,
      researchValue: String,
      researchFindingsIntegration: String,
    },
    section2: {
      questions: [String],
      advantages: [String],
      disadvantages: [String],
      critique: [String],
      conclusion: {
        finalAssessment: String,
        isComplete: Boolean,
        isDeserving: Boolean,
      },
    },
  },
  reviewPdf: { type: String }
});

export const Thesis = model<IThesis>('Thesis', thesisSchema);