// routes/studentRouter.ts
import express from 'express';
import { authenticate, isFinalReview, isStudent } from '../middleware/auth';
import { downloadSignedReview, getMyTopicStatus, getSignedReview } from '../controllers/studentController';

const studentRouter = express.Router();

// Student gets their topic status
studentRouter.get('/topic-status', authenticate, isStudent, getMyTopicStatus);

studentRouter.get(
  "/signed-review-final/:thesisId",
  authenticate,
  isFinalReview,
  getSignedReview,
)

studentRouter.get("/download-signed-review-final/:thesisId", authenticate, isFinalReview, downloadSignedReview)


export default studentRouter;