import express from 'express';
import { authenticate, isAdmin, isManagement } from '../middleware/auth';
import {assignThesisTeam } from '../controllers/assignController';

const assignRouter = express.Router();

// Routes for team assignment - using management role group
assignRouter.post('/assign-thesis-team', authenticate, isManagement, assignThesisTeam);

export default assignRouter;