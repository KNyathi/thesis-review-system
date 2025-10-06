import type { Request, Response } from "express";
import { Pool } from 'pg';
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer } from "../models/User.model";
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

export const getMyTopicStatus = async (req: Request, res: Response) => {
    try {
        const studentId = (req.user as any).id;

        const student = await userModel.getUserById(studentId);
        if (!student || student.role !== 'student') {
            res.status(404).json({
                error: "Student not found"
            });
            return;
        }

        const studentData = student as IStudent;

        res.status(200).json({
            data: {
                thesisTopic: studentData.thesisTopic,
                isTopicApproved: studentData.isTopicApproved,
                rejectionComments: studentData.topicRejectionComments,
                supervisor: studentData.supervisor
            }
        });

    } catch (error: any) {
        console.error('Error fetching topic status:', error);
        res.status(500).json({
            error: error.message || "Failed to fetch topic status"
        });
    }
};


export const getSignedReview = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent;
        const { thesisId } = req.params;

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify student has access to this thesis
        if (thesis.data.student !== student.id) {
            res.status(403).json({ error: "Access denied: Not your thesis" });
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
        const boundary = '----StudentSignedReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `inline; filename="final_signed_reviews_${thesisId}.multipart"`);

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
        await sendFilePart(deanSupervisorPath, `final_supervisor_review_${student.id}.pdf`);
        await sendFilePart(deanReviewerPath, `final_reviewer_review_${student.id}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error getting signed reviews for student:", error);
        res.status(500).json({ error: "Failed to get signed reviews" });
    }
};


export const downloadSignedReview = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent;
        const { thesisId } = req.params;

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Verify student has access to this thesis
        if (thesis.data.student !== student.id) {
            res.status(403).json({ error: "Access denied: Not your thesis" });
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
                error: "Final signed reviews not found",
                details: {
                    supervisorExists: fs.existsSync(supervisorSignedPath),
                    reviewerExists: fs.existsSync(reviewerSignedPath)
                }
            });
            return;
        }

        // Set headers for multipart response
        const boundary = '----StudentSignedReviewBoundary';
        res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
        res.setHeader('Content-Disposition', `attachment; filename="final_signed_reviews_${student.id}.multipart"`);

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
        await sendFilePart(supervisorSignedPath, `final_supervisor_review_${student.id}.pdf`);
        await sendFilePart(reviewerSignedPath, `final_reviewer_review_${student.id}.pdf`);

        // End of multipart
        res.write(`--${boundary}--\r\n`);
        res.end();

    } catch (error) {
        console.error("Error downloading final signed reviews:", error);
        res.status(500).json({ error: "Failed to download final signed reviews" });
    }
};



export const respondToProposedTopic = async (req: Request, res: Response) => {
    try {
        const studentId = (req.user as AuthenticatedUser).id;
        const { accepted, comments } = req.body;

        // Validate input
        if (typeof accepted !== 'boolean') {
            res.status(400).json({
                error: "Acceptance status is required and must be boolean"
            });
            return;
        }

        if (!accepted && (!comments || comments.trim() === '')) {
            res.status(400).json({
                error: "Comments are required when rejecting a proposed thesis topic"
            });
            return;
        }

        // Get student data
        const student = await userModel.getUserById(studentId);
        if (!student || student.role !== 'student') {
            res.status(404).json({
                error: "Student not found"
            });
            return;
        }

        const studentData = student as IStudent;

        // Check if there is a supervisor-proposed topic pending response
        if (studentData.topicProposedBy !== 'supervisor' || 
            !studentData.studentTopicResponse || 
            studentData.studentTopicResponse.status !== 'pending') {
            res.status(400).json({
                error: "No pending topic proposal found from supervisor"
            });
            return;
        }

        // Check if topic is already approved through other means
        if (studentData.isTopicApproved) {
            res.status(400).json({
                error: "Thesis topic is already approved"
            });
            return;
        }

        // Prepare update data based on student response
        const updateData: any = {
            studentTopicResponse: {
                status: accepted ? 'accepted' : 'rejected',
                respondedAt: new Date(),
                comments: accepted ? null : comments.trim()
            }
        };

        // If student accepts the topic, mark it as approved
        if (accepted) {
            updateData.isTopicApproved = true;
        } else {
            // If rejected, clear the proposed topic but keep the history
            updateData.thesisTopic = null;
            updateData.isTopicApproved = false;
        }

        const updatedStudent = await userModel.updateUser(studentId, updateData);

        res.status(200).json({
            message: `Thesis topic ${accepted ? 'accepted' : 'rejected'} successfully`,
            student: {
                id: updatedStudent.id,
                thesisTopic: (updatedStudent as IStudent).thesisTopic,
                isTopicApproved: (updatedStudent as IStudent).isTopicApproved,
                fullName: updatedStudent.fullName,
                topicProposedBy: (updatedStudent as IStudent).topicProposedBy,
                studentTopicResponse: (updatedStudent as IStudent).studentTopicResponse
            }
        });

    } catch (error: any) {
        console.error('Error responding to proposed topic:', error);
        res.status(500).json({
            error: error.message || "Failed to respond to proposed topic"
        });
    }
};