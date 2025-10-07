import express from 'express';
import { authenticate, isStudent } from '../middleware/auth';
import { checkPlagiarismStart, checkPlagiarismSupervisor } from '../controllers/plagiarismController';

const plagiarismRouter = express.Router();

// Review signing routes
plagiarismRouter.post("/plagiarism-supervisor/:thesisId", authenticate, isStudent, checkPlagiarismSupervisor) 
plagiarismRouter.post("/plagiarism-start/:thesisId", authenticate, isStudent, checkPlagiarismStart) 

export default plagiarismRouter;