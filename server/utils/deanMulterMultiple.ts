import multer from "multer"
import type { Request, Response } from "express";
import { Pool } from 'pg';
import path from "path"
import fs from "fs"


// Ensure Dean signed reviews directory exists
const deanSignedDir = path.join(__dirname, "../../server/reviews/dean/signed/")
if (!fs.existsSync(deanSignedDir)) {
  fs.mkdirSync(deanSignedDir, { recursive: true })
}

// Configure storage for Dean - save directly to final location
const deanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, deanSignedDir)
  },
  filename: (req, file, cb) => {
    const { thesisId } = req.params;
    const fieldName = file.fieldname; // "supervisorReview" or "reviewerReview"
    
    // Create meaningful filenames like:
    // dean_signed_supervisor_12345.pdf or dean_signed_reviewer_12345.pdf
    const filename = `dean_signed_${fieldName.replace('Review', '')}_${thesisId}.pdf`;
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

// Configure Multer for Dean with multiple files
const deanUpload = multer({
  storage: deanStorage,
  fileFilter: fileFilter, // Same PDF filter as before
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit per file
  },
})

export { deanUpload }