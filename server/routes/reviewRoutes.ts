import express from 'express';
import {
  submitReview,
  getAssignedTheses,
  getCompletedReviews
} from '../controllers/reviewController';
import { authenticate, isReviewer } from '../middleware/auth';
import fs from 'fs';
import path from 'path';


const reviewRouter = express.Router();

// Reviewer-only routes
reviewRouter.get('/assigned-theses', authenticate, isReviewer, getAssignedTheses);
reviewRouter.get('/completed-theses', authenticate, isReviewer, getCompletedReviews);
reviewRouter.post('/submit-review/:thesisId', authenticate, isReviewer, submitReview);

// download review file
reviewRouter.get('/download-review/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../../reviews', req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
})

export default reviewRouter;