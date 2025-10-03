// routes/studentRouter.ts
import express from 'express';
import { authenticate, isStudent } from '../middleware/auth';
import { getMyTopicStatus } from '../controllers/studentController';

const studentRouter = express.Router();

// Student gets their topic status
studentRouter.get('/topic-status', authenticate, isStudent, getMyTopicStatus);

export default studentRouter;