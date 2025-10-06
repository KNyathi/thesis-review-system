// routes/studentRouter.ts
import express from 'express';
import { authenticate, isFinalReview, isStudent } from '../middleware/auth';
import { downloadSignedReview, getMyTopicStatus, getSignedReview, respondToProposedTopic } from '../controllers/studentController';

const studentRouter = express.Router();

// Student gets their topic status
studentRouter.get('/topic-status', authenticate, isStudent, getMyTopicStatus);
studentRouter.put('/approve-topic-student', authenticate, isStudent, respondToProposedTopic);

studentRouter.get(
  "/signed-review-final/:thesisId",
  authenticate,
  isFinalReview,
  getSignedReview,
)

studentRouter.get("/download-signed-review-final/:thesisId", authenticate, isFinalReview, downloadSignedReview)


export default studentRouter;