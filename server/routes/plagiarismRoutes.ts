import express from 'express';
import { authenticate, isStudent, isSupervisor } from '../middleware/auth';
import { checkPlagiarismStart, checkPlagiarismSupervisor } from '../controllers/plagiarismController';

const plagiarismRouter = express.Router();

// Review signing routes
plagiarismRouter.post("/plagiarism-supervisor/:thesisId", authenticate, isSupervisor, checkPlagiarismSupervisor) 
plagiarismRouter.post("/plagiarism-start/:thesisId", authenticate, isSupervisor, checkPlagiarismStart) 

export default plagiarismRouter;