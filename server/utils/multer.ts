import multer from 'multer';
import path from 'path';
import { Request } from 'express';

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/theses'));
  },
  filename: (req: Request, file, cb) => {
    const studentId = req.user?._id;
    const timestamp = Date.now();
    cb(null, `${studentId}-${timestamp}${path.extname(file.originalname)}`);
  }
});

// File filter for PDF only
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export default upload;