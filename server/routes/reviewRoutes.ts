import express from 'express';
import {
  submitReview,
  getAssignedTheses,
  getCompletedReviews
} from '../controllers/reviewController';
import { authenticate, isReviewer } from '../middleware/auth';

const reviewRouter = express.Router();

// Reviewer-only routes
reviewRouter.get('/assigned-theses', authenticate, isReviewer, getAssignedTheses);
reviewRouter.get('/completed-theses', authenticate, isReviewer, getCompletedReviews);
reviewRouter.post('/submit-review/:thesisId', authenticate, isReviewer, submitReview);

export default reviewRouter;