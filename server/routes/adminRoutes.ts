import express from 'express';
import {
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


export default adminRouter;