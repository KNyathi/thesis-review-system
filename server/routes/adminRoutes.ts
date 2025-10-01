import express from 'express';
import {
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


// Thesis assignment
//adminRouter.post('/assign-thesis', authenticate, isAdmin, assignThesis);
adminRouter.patch('/reassign-thesis', authenticate, isAdmin, reassignThesis);

export default adminRouter;