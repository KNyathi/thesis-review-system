import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, IHeadOfDepartment } from "../models/User.model";
import path from "path"
import fs from "fs"

const pool = new Pool({
    connectionString: process.env.DB_URL
});

const thesisModel = new ThesisModel(pool);
const userModel = new UserModel(pool);

// Define authenticated user type
interface AuthenticatedUser {
    id: string;
    role: string;
    email: string;
}

export const getUnsignedReview = async (req: Request, res: Response) => {
    try {
        const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify HOD has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== hod.faculty) {
            res.status(403).json({ error: "Access denied: Not your student" });
            return;
        }

        // Check conditions for BOTH files
        const currentIteration = thesis.data.currentIteration;
        const currentIterationData = thesis.data.reviewIterations[currentIteration - 1];

        const isSupervisorSigned = currentIterationData?.supervisorReview?.status === 'signed';
        const isThesisNotEvaluated = thesis.data.status !== 'evaluated';

        // Get paths and check existence
        const supervisorReviewPath = thesis.data.reviewerSignedReview1Path;
        const reviewerReviewPath = thesis.data.reviewerSignedReviewPath;

        const hasSupervisorFile = supervisorReviewPath && fs.existsSync(supervisorReviewPath);
        const hasReviewerFile = reviewerReviewPath && fs.existsSync(reviewerReviewPath);

        const hodNotSigned = !thesis.data.hodSignedSupervisorPath && !thesis.data.hodSignedReviewerPath;

        // Only proceed if BOTH files are available and conditions are met
        if (!isSupervisorSigned || !isThesisNotEvaluated || !hasSupervisorFile || !hasReviewerFile || !hodNotSigned) {
            res.status(400).json({
                error: "Both reviews are not ready for HOD signing",
                details: {
                    supervisorSigned: isSupervisorSigned,
                    thesisNotEvaluated: isThesisNotEvaluated,
                    supervisorFileExists: hasSupervisorFile,
                    reviewerFileExists: hasReviewerFile,
                    hodNotSigned: hodNotSigned,
                    allConditionsMet: isSupervisorSigned && isThesisNotEvaluated && hasSupervisorFile && hasReviewerFile && hodNotSigned
                }
            });
            return;
        }

        const supervisorPath = supervisorReviewPath!;
        const reviewerPath = reviewerReviewPath!;

        if (!fs.existsSync(supervisorPath) || !fs.existsSync(reviewerPath)) {
            res.status(404).json({ 
                error: "Review files not found",
                details: {
                    supervisorExists: fs.existsSync(supervisorPath),
                    reviewerExists: fs.existsSync(reviewerPath)
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----HODReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `inline; filename="hod_reviews_${thesisId}.multipart"`);

        // Helper function to send a file part - FIXED Promise types
        const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
            const fileStats = fs.statSync(filePath);

            // Part header
            res.write(`--${boundary}\r\n`);
            res.write(`Content-Type: ${contentType}\r\n`);
            res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`);
            res.write(`Content-Length: ${fileStats.size}\r\n`);
            res.write('\r\n');

            // File content
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res, { end: false });

            return new Promise<void>((resolve, reject) => { // Changed to Promise<void>
                fileStream.on('end', () => resolve()); // Fixed: resolve without arguments
                fileStream.on('error', (error) => reject(error)); // Fixed: reject with error
            });
        };

        // Send both files
        await sendFilePart(supervisorPath, `unsigned_supervisor_review_${thesis.data.student}.pdf`);
        await sendFilePart(reviewerPath, `unsigned_reviewer_review_${thesis.data.student}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error getting unsigned reviews for HOD:", error);
        res.status(500).json({ error: "Failed to get unsigned reviews" });
    }
};


export const getSignedReview = async (req: Request, res: Response) => {
    try {
        const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
        const { thesisId } = req.params;

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify HOD has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== hod.faculty) {
            res.status(403).json({ error: "Access denied: Not your student" });
            return;
        }

        // Get HOD signed paths
        const hodSupervisorPath = thesis.data.hodSignedSupervisorPath;
        const hodReviewerPath = thesis.data.hodSignedReviewerPath;

        // Check if both HOD signed files exist
        const hasHodSupervisorFile = hodSupervisorPath && fs.existsSync(hodSupervisorPath);
        const hasHodReviewerFile = hodReviewerPath && fs.existsSync(hodReviewerPath);

        if (!hasHodSupervisorFile || !hasHodReviewerFile) {
            res.status(404).json({
                error: "HOD signed reviews not found",
                details: {
                    hodSupervisorExists: hasHodSupervisorFile,
                    hodReviewerExists: hasHodReviewerFile
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----HODSignedReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `inline; filename="hod_signed_reviews_${thesisId}.multipart"`);

        // Helper function to send a file part
        const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
            const fileStats = fs.statSync(filePath);

            // Part header
            res.write(`--${boundary}\r\n`);
            res.write(`Content-Type: ${contentType}\r\n`);
            res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`);
            res.write(`Content-Length: ${fileStats.size}\r\n`);
            res.write('\r\n');

            // File content
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res, { end: false });

            return new Promise<void>((resolve, reject) => {
                fileStream.on('end', () => resolve());
                fileStream.on('error', (error) => reject(error));
            });
        };

        // Send both HOD signed files
        await sendFilePart(hodSupervisorPath, `hod_signed_supervisor_review_${thesis.data.student}.pdf`);
        await sendFilePart(hodReviewerPath, `hod_signed_reviewer_review_${thesis.data.student}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error getting HOD signed reviews:", error);
        res.status(500).json({ error: "Failed to get HOD signed reviews" });
    }
};


export const uploadSignedHodReviews = async (req: Request, res: Response) => {
    try {
        const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
        const { thesisId } = req.params;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        console.log("Uploading HOD signed reviews:", { thesisId, files: files ? Object.keys(files) : 'no files' });

        // Find thesis and check access
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify HOD has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== hod.faculty) {
            res.status(403).json({ error: "Access denied: Not your student" });
            return;
        }

        // Check if both files are provided
        if (!files || !files.supervisorReview || !files.reviewerReview) {
            res.status(400).json({ 
                error: "Both supervisor and reviewer signed reviews are required",
                received: files ? Object.keys(files) : 'no files'
            });
            return;
        }

        // Check if reviews are ready for HOD signing
        const currentIteration = thesis.data.currentIteration;
        const currentIterationData = thesis.data.reviewIterations[currentIteration - 1];
        
        const isSupervisorSigned = currentIterationData?.supervisorReview?.status === 'signed';
        const isThesisNotEvaluated = thesis.data.status !== 'evaluated';
        const hasSupervisorFile = thesis.data.reviewerSignedReview1Path && fs.existsSync(thesis.data.reviewerSignedReview1Path);
        const hasReviewerFile = thesis.data.reviewerSignedReviewPath && fs.existsSync(thesis.data.reviewerSignedReviewPath);

        if (!isSupervisorSigned || !isThesisNotEvaluated || !hasSupervisorFile || !hasReviewerFile) {
            res.status(400).json({ 
                error: "Reviews are not ready for HOD signing",
                details: {
                    supervisorSigned: isSupervisorSigned,
                    thesisNotEvaluated: isThesisNotEvaluated,
                    supervisorFileExists: hasSupervisorFile,
                    reviewerFileExists: hasReviewerFile
                }
            });
            return;
        }

        // Check if HOD already signed
        if (thesis.data.hodSignedSupervisorPath || thesis.data.hodSignedReviewerPath) {
            res.status(400).json({ error: "Reviews already signed by HOD" });
            return;
        }

        // Ensure HOD signed reviews directory exists
        const signedDir = path.join(__dirname, "../../server/reviews/hod/signed");
        if (!fs.existsSync(signedDir)) {
            fs.mkdirSync(signedDir, { recursive: true });
        }

        // Move uploaded files to HOD signed reviews directory
        const hodSupervisorPath = path.join(signedDir, `hod_signed_supervisor_${thesis.data.student}.pdf`);
        const hodReviewerPath = path.join(signedDir, `hod_signed_reviewer_${thesis.data.student}.pdf`);

        fs.renameSync(files.supervisorReview[0].path, hodSupervisorPath);
        fs.renameSync(files.reviewerReview[0].path, hodReviewerPath);

        console.log(`HOD signed reviews saved to: ${hodSupervisorPath} and ${hodReviewerPath}`);

        // Update thesis with HOD signed PDF paths
        await thesisModel.updateThesis(thesisId, {
            hodSignedSupervisorPath: hodSupervisorPath,
            hodSignedReviewerPath: hodReviewerPath,
            hodSignedDate: new Date()
        });


        res.json({
            message: "Both reviews signed successfully by HOD",
            success: true,
            signedPaths: {
                supervisor: hodSupervisorPath,
                reviewer: hodReviewerPath
            }
        });
    } catch (error) {
        console.error("Error uploading HOD signed reviews:", error);
        res.status(500).json({ error: "Failed to upload signed reviews" });
    }
};


export const signedReview = async (req: Request, res: Response) => {
  try {
    const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
    const { thesisId } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.supervisorReview || !files.reviewerReview) {
      res.status(400).json({ error: "Both supervisor and reviewer signed files are required" });
      return;
    }

    // Get the current thesis first to access student data
    const currentThesis = await thesisModel.getThesisById(thesisId);
    if (!currentThesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Verify HOD has access to this faculty
    const student = await userModel.getUserById(currentThesis.data.student);
    if (!student || (student as IStudent).faculty !== hod.faculty) {
      res.status(403).json({ error: "Access denied: Not your student" });
      return;
    }

    // Move signed PDFs to permanent storage
    const supervisorSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_supervisor_${currentThesis.data.student}.pdf`);
    const reviewerSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_reviewer_${currentThesis.data.student}.pdf`);

    fs.renameSync(files.supervisorReview[0].path, supervisorSignedPath);
    fs.renameSync(files.reviewerReview[0].path, reviewerSignedPath);

    // Update thesis with HOD signed paths and metadata
    const thesis = await thesisModel.updateThesis(thesisId, {
      hodSignedSupervisorPath: supervisorSignedPath,
      hodSignedReviewerPath: reviewerSignedPath,
      hodSignedDate: new Date()
    });

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    res.json({ 
      success: true,
      message: "Both reviews signed successfully by HOD"
    });
  } catch (error) {
    console.error("Error finalizing HOD review:", error);
    res.status(500).json({ error: "Failed to finalize HOD review" });
  }
};


export const downloadSignedReview = async (req: Request, res: Response) => {
  try {
    const hod = req.user as AuthenticatedUser & IHeadOfDepartment;
    const { thesisId } = req.params;

    // Find thesis
    const thesis = await thesisModel.getThesisById(thesisId);
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Verify HOD has access to this faculty
    const student = await userModel.getUserById(thesis.data.student);
    if (!student || (student as IStudent).faculty !== hod.faculty) {
      res.status(403).json({ error: "Access denied: Not your student" });
      return;
    }

    let supervisorSignedPath: string;
    let reviewerSignedPath: string;

    // Get HOD signed paths with fallbacks
    if (thesis.data.hodSignedSupervisorPath && fs.existsSync(thesis.data.hodSignedSupervisorPath)) {
      supervisorSignedPath = thesis.data.hodSignedSupervisorPath;
    } else {
      supervisorSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_supervisor_${thesis.data.student}.pdf`);
    }

    if (thesis.data.hodSignedReviewerPath && fs.existsSync(thesis.data.hodSignedReviewerPath)) {
      reviewerSignedPath = thesis.data.hodSignedReviewerPath;
    } else {
      reviewerSignedPath = path.join(__dirname, "../../server/reviews/hod/signed", `hod_signed_reviewer_${thesis.data.student}.pdf`);
    }

    // Check if both files exist
    if (!fs.existsSync(supervisorSignedPath) || !fs.existsSync(reviewerSignedPath)) {
      res.status(404).json({
        error: "HOD signed reviews not found",
        details: {
          supervisorExists: fs.existsSync(supervisorSignedPath),
          reviewerExists: fs.existsSync(reviewerSignedPath)
        }
      });
      return;
    }

    // Set headers for multipart response
    const boundary = '----HODSignedReviewBoundary';
    res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
    res.setHeader('Content-Disposition', `attachment; filename="hod_signed_reviews_${thesis.data.student}.multipart"`);

    // Helper function to send a file part
    const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
      const fileStats = fs.statSync(filePath);

      // Part header
      res.write(`--${boundary}\r\n`);
      res.write(`Content-Type: ${contentType}\r\n`);
      res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`);
      res.write(`Content-Length: ${fileStats.size}\r\n`);
      res.write('\r\n');

      // File content
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res, { end: false });

      return new Promise<void>((resolve, reject) => {
        fileStream.on('end', () => resolve());
        fileStream.on('error', (error) => reject(error));
      });
    };

    // Send both files
    await sendFilePart(supervisorSignedPath, `hod_signed_supervisor_${thesis.data.student}.pdf`);
    await sendFilePart(reviewerSignedPath, `hod_signed_reviewer_${thesis.data.student}.pdf`);

    // End of multipart
    res.write(`--${boundary}--\r\n`);
    res.end();

  } catch (error) {
    console.error("Error downloading HOD signed reviews:", error);
    res.status(500).json({ error: "Failed to download HOD signed reviews" });
  }
};