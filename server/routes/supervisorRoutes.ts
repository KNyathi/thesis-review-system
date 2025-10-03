import express from 'express';
import { authenticate, isSupervisor } from '../middleware/auth';
import { approveThesisTopic, getPendingApprovals } from '../controllers/supervisorController';

const supervisorRouter = express.Router();

// Routes for team assignment - using management role group
supervisorRouter.put('/:studentId/approve-topic', authenticate, isSupervisor, approveThesisTopic); //completed

// Supervisor gets pending approvals
supervisorRouter.get('/pending-approvals', authenticate, isSupervisor, getPendingApprovals);
export default supervisorRouter;