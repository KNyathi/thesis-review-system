import express from 'express';
import {
  approveReviewer,
  rejectReviewer,
  assignThesis,
  reassignThesis,
  getAllUsers,
  deleteUser,
  getAllTheses
} from '../controllers/adminController';
import { authenticate, isAdmin } from '../middleware/auth';

const adminRouter = express.Router();

// User management
adminRouter.get('/users', authenticate, isAdmin, getAllUsers);
adminRouter.get('/theses', authenticate, isAdmin, getAllTheses);
adminRouter.delete('/users/:id', authenticate, isAdmin, deleteUser);

// Reviewer approval
adminRouter.patch('/reviewers/:id/approve', authenticate, isAdmin, approveReviewer);
adminRouter.patch('/reviewers/:id/reject', authenticate, isAdmin, rejectReviewer);

// Thesis assignment
adminRouter.post('/assign-thesis', authenticate, isAdmin, assignThesis);
adminRouter.patch('/reassign-thesis', authenticate, isAdmin, reassignThesis);

export default adminRouter;