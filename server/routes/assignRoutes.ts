import express from 'express';
import { authenticate, isAdmin, isManagement } from '../middleware/auth';
import {assignThesisTeam, assignUserRole, getUnassignedUsers, removeUserRole, setPrimaryRole } from '../controllers/assignController';

const assignRouter = express.Router();

// Routes for team assignment - using management role group
assignRouter.post('/assign-thesis-team', authenticate, isManagement, assignThesisTeam);

// Assign role to user
assignRouter.post('/assign-role', authenticate, isManagement, assignUserRole);

// Remove role from user  
assignRouter.post('/remove-role', authenticate, isManagement, removeUserRole);

// Set primary role (only for management)
assignRouter.post('/set-primary-role', authenticate, isManagement, setPrimaryRole);

// Get all unassigned users
assignRouter.get('/unassigned-users', authenticate, isManagement, getUnassignedUsers);

export default assignRouter;