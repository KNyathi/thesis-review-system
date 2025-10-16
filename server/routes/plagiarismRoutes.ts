import express from 'express';
import { authenticate, isStaff, isStudent, isSupervisor } from '../middleware/auth';
import { checkPlagiarismStart, checkPlagiarismSupervisor, downloadPlagiarismReport } from '../controllers/plagiarismController';

const plagiarismRouter = express.Router();

// Review signing routes
plagiarismRouter.post("/plagiarism-supervisor/:thesisId", authenticate, isSupervisor, checkPlagiarismSupervisor) 
plagiarismRouter.post("/plagiarism-start/:thesisId", authenticate, isSupervisor, checkPlagiarismStart) 
plagiarismRouter.get("/download-plagiarism-doc/:thesisId", authenticate, isStaff,  downloadPlagiarismReport)

export default plagiarismRouter;