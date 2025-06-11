import express from 'express';
import {
  approveReviewer,
  rejectReviewer,
  assignThesis,
  reassignThesis,
  getAllUsers,
  deleteUser
} from '../controllers/adminController';
import { authenticate, isAdmin } from '../middleware/auth';

const adminRouter = express.Router();

// User management
adminRouter.get('/users', authenticate, isAdmin, getAllUsers);
adminRouter.delete('/users/:id', authenticate, isAdmin, deleteUser);

// Reviewer approval
adminRouter.patch('/reviewers/:id/approve', authenticate, isAdmin, approveReviewer);
adminRouter.patch('/reviewers/:id/reject', authenticate, isAdmin, rejectReviewer);

// Thesis assignment
adminRouter.post('/assign-thesis', authenticate, isAdmin, assignThesis);
adminRouter.patch('/reassign-thesis', authenticate, isAdmin, reassignThesis);

export default adminRouter;