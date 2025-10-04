import multer from "multer"
import type { Request, Response } from "express";
import { Pool } from 'pg';
import path from "path"
import fs from "fs"


// Ensure HOD signed reviews directory exists
const hodSignedDir = path.join(__dirname, "../../server/reviews/hod/signed/")
if (!fs.existsSync(hodSignedDir)) {
  fs.mkdirSync(hodSignedDir, { recursive: true })
}

// Configure storage for HOD - save directly to final location
const hodStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, hodSignedDir)
  },
  filename: (req, file, cb) => {
    const { thesisId } = req.params;
    const fieldName = file.fieldname; // "supervisorReview" or "reviewerReview"
    
    // Use temporary filename with timestamp, we'll rename in the upload function
    const filename = `temp_hod_${fieldName.replace('Review', '')}_${thesisId}.pdf`;
    cb(null, filename)
  },
})

// File filter for PDF only
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type, only PDF is allowed!"), false)
  }
}

// Configure Multer for HOD with multiple files
const hodUpload = multer({
  storage: hodStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit per file
  },
})

export { hodUpload }