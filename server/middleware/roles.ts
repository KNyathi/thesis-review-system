import { Request, Response, NextFunction } from 'express';
import { IReviewer } from '../models/User.model';

export const isStudent = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'student') {
    res.status(403).json({ error: 'Student access required' });
    return; // Explicit return after sending response
  }
  next();
};

export const isReviewer = (req: Request, res: Response, next: NextFunction): void => {
  const reviewer = req.user as IReviewer;
  if (reviewer?.role !== 'reviewer' || !reviewer.isApproved) {
    res.status(403).json({ error: 'Approved reviewer access required' });
    return;
  }
  next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};