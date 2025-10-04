import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, IHeadOfDepartment, IDean } from "../models/User.model";
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
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        // Check conditions for BOTH files - Dean signs after HOD
        const isHodSigned = thesis.data.hodSignedSupervisorPath && thesis.data.hodSignedReviewerPath;
        const isThesisEvaluated = thesis.data.status === 'evaluated'; // Thesis should be evaluated
        const deanNotSigned = !thesis.data.deanSignedSupervisorPath && !thesis.data.deanSignedReviewerPath;

        // Get HOD signed paths (these are the "unsigned" files for Dean)
        const hodSupervisorPath = thesis.data.hodSignedSupervisorPath;
        const hodReviewerPath = thesis.data.hodSignedReviewerPath;

        const hasHodSupervisorFile = hodSupervisorPath && fs.existsSync(hodSupervisorPath);
        const hasHodReviewerFile = hodReviewerPath && fs.existsSync(hodReviewerPath);

        // Only proceed if BOTH HOD-signed files are available and conditions are met
        if (!isHodSigned || !isThesisEvaluated || !hasHodSupervisorFile || !hasHodReviewerFile || !deanNotSigned) {
            res.status(400).json({
                error: "Both reviews are not ready for Dean signing",
                details: {
                    hodSigned: isHodSigned,
                    thesisEvaluated: isThesisEvaluated,
                    hodSupervisorFileExists: hasHodSupervisorFile,
                    hodReviewerFileExists: hasHodReviewerFile,
                    deanNotSigned: deanNotSigned,
                    allConditionsMet: isHodSigned && isThesisEvaluated && hasHodSupervisorFile && hasHodReviewerFile && deanNotSigned
                }
            });
            return;
        }

        const supervisorPath = hodSupervisorPath!;
        const reviewerPath = hodReviewerPath!;

        if (!fs.existsSync(supervisorPath) || !fs.existsSync(reviewerPath)) {
            res.status(404).json({
                error: "HOD signed review files not found",
                details: {
                    supervisorExists: fs.existsSync(supervisorPath),
                    reviewerExists: fs.existsSync(reviewerPath)
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----DeanReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `inline; filename="dean_reviews_${thesisId}.multipart"`);

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

        // Send both HOD-signed files (these are "unsigned" for Dean)
        await sendFilePart(supervisorPath, `hod_signed_supervisor_review_${thesis.data.student}.pdf`);
        await sendFilePart(reviewerPath, `hod_signed_reviewer_review_${thesis.data.student}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error getting unsigned reviews for Dean:", error);
        res.status(500).json({ error: "Failed to get unsigned reviews" });
    }
};


export const getSignedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        // Get Dean signed paths
        const deanSupervisorPath = thesis.data.deanSignedSupervisorPath;
        const deanReviewerPath = thesis.data.deanSignedReviewerPath;

        // Check if both Dean signed files exist
        const hasDeanSupervisorFile = deanSupervisorPath && fs.existsSync(deanSupervisorPath);
        const hasDeanReviewerFile = deanReviewerPath && fs.existsSync(deanReviewerPath);

        if (!hasDeanSupervisorFile || !hasDeanReviewerFile) {
            res.status(404).json({
                error: "Dean signed reviews not found",
                details: {
                    deanSupervisorExists: hasDeanSupervisorFile,
                    deanReviewerExists: hasDeanReviewerFile
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----DeanSignedReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `inline; filename="dean_signed_reviews_${thesisId}.multipart"`);

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

        // Send both Dean signed files
        await sendFilePart(deanSupervisorPath, `dean_signed_supervisor_review_${thesis.data.student}.pdf`);
        await sendFilePart(deanReviewerPath, `dean_signed_reviewer_review_${thesis.data.student}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error getting Dean signed reviews:", error);
        res.status(500).json({ error: "Failed to get Dean signed reviews" });
    }
};

// Helper function to delete all review files from other roles
const deleteAllOtherReviews = async (thesis: any) => {
    try {
        const baseDir = path.join(__dirname, "../../server/reviews");
        const studentId = thesis.data.student;

        const filesToDelete = [
            // Supervisor files
            thesis.data.supervisorSignedReviewPath,
            thesis.data.reviewPdfSupervisor,
            path.join(baseDir, "supervisor/signed", `signed_review1_${studentId}.pdf`),
            path.join(baseDir, "supervisor/unsigned", `unsigned_review1_${studentId}.pdf`),

            // Reviewer files
            thesis.data.reviewerSignedReviewPath,
            thesis.data.reviewPdfReviewer,
            path.join(baseDir, "reviewer/signed", `signed_review2_${studentId}.pdf`),
            path.join(baseDir, "reviewer/unsigned", `unsigned_review2_${studentId}.pdf`),

            // Consultant files
            thesis.data.consultantSignedReviewPath,
            thesis.data.reviewPdfConsultant,
            path.join(baseDir, "consultant/signed", `signed_review1_${studentId}.pdf`),
            path.join(baseDir, "consultant/unsigned", `unsigned_review1_${studentId}.pdf`),

            // HOD files
            thesis.data.hodSignedSupervisorPath,
            thesis.data.hodSignedReviewerPath,
            path.join(baseDir, "hod/signed", `hod_signed_supervisor_${studentId}.pdf`),
            path.join(baseDir, "hod/signed", `hod_signed_reviewer_${studentId}.pdf`)
        ];

        // Delete each file if it exists
        for (const filePath of filesToDelete) {
            if (filePath && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted file: ${filePath}`);
                } catch (deleteError) {
                    console.warn(`Could not delete file ${filePath}:`, deleteError);
                    // Continue with other files even if one fails
                }
            }
        }

        console.log(`Finished cleaning up review files for student ${studentId}`);
    } catch (error) {
        console.error("Error deleting other review files:", error);
        // Don't throw error - we want to continue with Dean upload even if cleanup fails
    }
};

export const uploadSignedDeanReviews = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        console.log("Uploading Dean signed reviews:", { thesisId, files: files ? Object.keys(files) : 'no files' });

        // Find thesis and check access
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
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

        // Check if reviews are ready for Dean signing
        const isHodSigned = thesis.data.hodSignedSupervisorPath && thesis.data.hodSignedReviewerPath;
        const isThesisEvaluated = thesis.data.status === 'evaluated';
        const hasHodSupervisorFile = thesis.data.hodSignedSupervisorPath && fs.existsSync(thesis.data.hodSignedSupervisorPath);
        const hasHodReviewerFile = thesis.data.hodSignedReviewerPath && fs.existsSync(thesis.data.hodSignedReviewerPath);

        if (!isHodSigned || !isThesisEvaluated || !hasHodSupervisorFile || !hasHodReviewerFile) {
            res.status(400).json({
                error: "Reviews are not ready for Dean signing",
                details: {
                    hodSigned: isHodSigned,
                    thesisEvaluated: isThesisEvaluated,
                    hodSupervisorFileExists: hasHodSupervisorFile,
                    hodReviewerFileExists: hasHodReviewerFile
                }
            });
            return;
        }

        // Check if Dean already signed
        if (thesis.data.deanSignedSupervisorPath || thesis.data.deanSignedReviewerPath) {
            res.status(400).json({ error: "Reviews already signed by Dean" });
            return;
        }

        // Ensure Dean signed reviews directory exists
        const signedDir = path.join(__dirname, "../../server/reviews/dean/signed");
        if (!fs.existsSync(signedDir)) {
            fs.mkdirSync(signedDir, { recursive: true });
        }

        // Move uploaded files to Dean signed reviews directory
        const deanSupervisorPath = path.join(signedDir, `dean_signed_supervisor_${thesis.data.student}.pdf`);
        const deanReviewerPath = path.join(signedDir, `dean_signed_reviewer_${thesis.data.student}.pdf`);

        fs.renameSync(files.supervisorReview[0].path, deanSupervisorPath);
        fs.renameSync(files.reviewerReview[0].path, deanReviewerPath);

        console.log(`Dean signed reviews saved to: ${deanSupervisorPath} and ${deanReviewerPath}`);

        // Delete all corresponding reviews from other roles
        await deleteAllOtherReviews(thesis);

        // Update thesis with Dean signed PDF paths
        await thesisModel.updateThesis(thesisId, {
            deanSignedSupervisorPath: deanSupervisorPath,
            deanSignedReviewerPath: deanReviewerPath,
            deanSignedDate: new Date(),
            // Clear all other review file paths
            supervisorSignedReviewPath: undefined,
            reviewerSignedReviewPath: undefined,
            hodSignedSupervisorPath: undefined,
            hodSignedReviewerPath: undefined,
            reviewPdfConsultant: undefined,
            reviewPdfSupervisor: undefined,
            reviewPdfReviewer: undefined,
            consultantSignedReviewPath: undefined
        });

        res.json({
            message: "Both reviews signed successfully by Dean",
            success: true,
            signedPaths: {
                supervisor: deanSupervisorPath,
                reviewer: deanReviewerPath
            }
        });
    } catch (error) {
        console.error("Error uploading Dean signed reviews:", error);
        res.status(500).json({ error: "Failed to upload signed reviews" });
    }
};


export const signedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
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

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(currentThesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        // Move signed PDFs to permanent storage
        const supervisorSignedPath = path.join(__dirname, "../../server/reviews/dean/signed", `dean_signed_supervisor_${currentThesis.data.student}.pdf`);
        const reviewerSignedPath = path.join(__dirname, "../../server/reviews/dean/signed", `dean_signed_reviewer_${currentThesis.data.student}.pdf`);

        fs.renameSync(files.supervisorReview[0].path, supervisorSignedPath);
        fs.renameSync(files.reviewerReview[0].path, reviewerSignedPath);

        // Delete all corresponding reviews from other roles
        await deleteAllOtherReviews(currentThesis);

        // Update thesis with Dean signed paths and metadata
        const thesis = await thesisModel.updateThesis(thesisId, {
            deanSignedSupervisorPath: supervisorSignedPath,
            deanSignedReviewerPath: reviewerSignedPath,
            deanSignedDate: new Date(),

            // Clear all other review file paths
            supervisorSignedReviewPath: undefined,
            reviewerSignedReviewPath: undefined,
            hodSignedSupervisorPath: undefined,
            hodSignedReviewerPath: undefined,
            reviewPdfConsultant: undefined,
            reviewPdfSupervisor: undefined,
            reviewPdfReviewer: undefined,
            consultantSignedReviewPath: undefined
        });

        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        res.json({
            success: true,
            message: "Both reviews signed successfully by Dean"
        });
    } catch (error) {
        console.error("Error finalizing Dean review:", error);
        res.status(500).json({ error: "Failed to finalize Dean review" });
    }
};


export const downloadSignedReview = async (req: Request, res: Response) => {
    try {
        const dean = req.user as AuthenticatedUser & IDean;
        const { thesisId } = req.params;

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify Dean has access to this faculty
        const student = await userModel.getUserById(thesis.data.student);
        if (!student || (student as IStudent).faculty !== dean.faculty) {
            res.status(403).json({ error: "Access denied: Not your faculty student" });
            return;
        }

        let supervisorSignedPath: string;
        let reviewerSignedPath: string;

        // Get Dean signed paths with fallbacks
        if (thesis.data.deanSignedSupervisorPath && fs.existsSync(thesis.data.deanSignedSupervisorPath)) {
            supervisorSignedPath = thesis.data.deanSignedSupervisorPath;
        } else {
            supervisorSignedPath = path.join(__dirname, "../../server/reviews/dean/signed", `dean_signed_supervisor_${thesis.data.student}.pdf`);
        }

        if (thesis.data.deanSignedReviewerPath && fs.existsSync(thesis.data.deanSignedReviewerPath)) {
            reviewerSignedPath = thesis.data.deanSignedReviewerPath;
        } else {
            reviewerSignedPath = path.join(__dirname, "../../server/reviews/dean/signed", `dean_signed_reviewer_${thesis.data.student}.pdf`);
        }

        // Check if both files exist
        if (!fs.existsSync(supervisorSignedPath) || !fs.existsSync(reviewerSignedPath)) {
            res.status(404).json({
                error: "Dean signed reviews not found",
                details: {
                    supervisorExists: fs.existsSync(supervisorSignedPath),
                    reviewerExists: fs.existsSync(reviewerSignedPath)
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----DeanSignedReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `attachment; filename="dean_signed_reviews_${thesis.data.student}.multipart"`);

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
        await sendFilePart(supervisorSignedPath, `dean_signed_supervisor_${thesis.data.student}.pdf`);
        await sendFilePart(reviewerSignedPath, `dean_signed_reviewer_${thesis.data.student}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error downloading Dean signed reviews:", error);
        res.status(500).json({ error: "Failed to download Dean signed reviews" });
    }
};