import type { Request, Response } from "express";
import { Pool } from 'pg';
import path from "path"
import fs from "fs"
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, ISupervisor } from "../models/User.model";
import { generateConsultantReviewPDF } from "../utils/pdfGeneratorConsultant";

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


export const approveThesisTopic = async (req: Request, res: Response) => {
    try {
        const { studentId } = req.params;
        const { approved, comments } = req.body;
        const supervisorId = (req.user as AuthenticatedUser).id;

        // Validate input
        if (typeof approved !== 'boolean') {
            res.status(400).json({
                error: "Approval status is required and must be boolean"
            });
            return;
        }

        if (!approved && (!comments || comments.trim() === '')) {
            res.status(400).json({
                error: "Comments are required when rejecting a thesis topic"
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

        // Check if student is assigned to this supervisor
        if (studentData.supervisor !== supervisorId) {
            res.status(403).json({
                error: "You are not assigned as supervisor for this student"
            });
            return;
        }

        // Check if student has submitted a thesis topic
        if (!studentData.thesisTopic || studentData.thesisTopic.trim() === '') {
            res.status(400).json({
                error: "Student has not submitted any thesis topic"
            });
            return;
        }

        // Check if topic is already approved
        if (studentData.isTopicApproved) {
            res.status(400).json({
                error: "Thesis topic is already approved"
            });
            return;
        }

        // Prepare update data
        const updateData: any = {
            isTopicApproved: approved
        };

        // Store rejection comments if topic is rejected
        if (!approved) {
            updateData.topicRejectionComments = comments.trim();
        } else {
            // Clear rejection comments if approving
            updateData.topicRejectionComments = null;
        }

        const updatedStudent = await userModel.updateUser(studentId, updateData);

        res.status(200).json({
            message: `Thesis topic ${approved ? 'approved' : 'rejected'} successfully`,
            student: {
                id: updatedStudent.id,
                thesisTopic: (updatedStudent as IStudent).thesisTopic,
                isTopicApproved: (updatedStudent as IStudent).isTopicApproved,
                fullName: updatedStudent.fullName,
                ...(!approved && { rejectionComments: (updatedStudent as IStudent).topicRejectionComments })
            }
        });

    } catch (error: any) {
        console.error('Error approving thesis topic:', error);
        res.status(500).json({
            error: error.message || "Failed to approve thesis topic"
        });
    }
};


export const getPendingApprovals = async (req: Request, res: Response) => {
    try {
        const supervisorId = (req.user as any).id;

        const allStudents = await userModel.getStudents();

        // Filter students assigned to this supervisor with pending topic approval
        const pendingApprovals = allStudents
            .filter(student =>
                student.thesisTopic &&
                student.thesisTopic.trim() !== '' &&
                !student.isTopicApproved &&
                student.supervisor === supervisorId
            )
            .map(student => ({
                studentId: student.id,
                studentName: student.fullName,
                faculty: student.faculty,
                thesisTopic: student.thesisTopic
            }));

        res.status(200).json({
            data: pendingApprovals
        });
        return

    } catch (error: any) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({
            error: error.message || "Failed to fetch pending approvals"
        });

        return
    }
};


export const submitReview = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor;
        const { thesisId } = req.params;
        const { comments, assessment, isFinalApproval } = req.body;

        // Find the thesis first
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return
        }

        // Verify supervisor is assigned to this thesis
        if (thesis.data.assignedSupervisor !== supervisor.id) {
            res.status(403).json({ error: "Not authorized to review this thesis" });
            return
        }

        let updatedThesis;
        let pdfPath = null;

        // SCENARIO 1: Consultant already reviewed and approved - Just sign existing PDF
        const validReviewIterations = (thesis.data.reviewIterations || []).filter(iteration => iteration !== null);
        const hasConsultantApproval = validReviewIterations.some(iteration =>
            iteration.consultantReview?.status === 'approved' &&
            iteration.consultantReview?.isFinalApproval === true
        );

        if (hasConsultantApproval && thesis.data.assignedConsultant) {
            // Get the signed consultant PDF
            const consultantSignedPdfPath = thesis.data.consultantSignedReviewPath;

            if (!consultantSignedPdfPath) {
                res.status(400).json({ error: "Consultant signed PDF not found" });
                return
            }


            // Verify the PDF exists in the CONSULTANT SIGNED directory
            if (!fs.existsSync(consultantSignedPdfPath)) {
                // Try to find it in the consultant signed directory
                const consultantSignedDir = path.join(__dirname, "../../server/reviews/consultant/signed");
                const fileName = path.basename(consultantSignedPdfPath);
                const alternativePath = path.join(consultantSignedDir, fileName);

                if (!fs.existsSync(alternativePath)) {
                    res.status(400).json({
                        error: "Consultant signed PDF file not found on server",
                        details: `Looking for: ${consultantSignedPdfPath} or ${alternativePath}`
                    });
                    return
                }

            }

            // Submit supervisor review (just signing)
            updatedThesis = await thesisModel.submitSupervisorReview(
                thesisId,
                "Thesis approved by supervisor after consultant review",
                'approved',
                true
            );

            // Copy the signed consultant PDF to supervisor unsigned directory
            const supervisorUnSignedDir = path.join(__dirname, "../../server/reviews/supervisor/unsigned");
            if (!fs.existsSync(supervisorUnSignedDir)) {
                fs.mkdirSync(supervisorUnSignedDir, { recursive: true });
            }

            // Use the same filename but in supervisor signed directory
            const fileName = path.basename(consultantSignedPdfPath);
            const supervisorUnSignedPdfPath = path.join(supervisorUnSignedDir, fileName);

            // Copy the file
            fs.copyFileSync(consultantSignedPdfPath, supervisorUnSignedPdfPath);

            // Update thesis with supervisor unsigned PDF path
            await thesisModel.updateThesis(thesisId, {
                reviewPdfSupervisor: supervisorUnSignedPdfPath,
                signedDate: new Date(),
                status: "under_review" // Ready for final review
            });

            // Update student with supervisor feedback (signing only)
            await userModel.updateStudentSupervisorFeedback(
                thesis.data.student,
                {
                    comments: "Thesis approved by supervisor",
                    lastReviewDate: new Date(),
                    reviewIteration: thesis.data.currentIteration,
                    status: 'approved',
                    isSigned: true,
                    signedDate: new Date()
                },
                thesis.data.currentIteration
            );

            // Update supervisor stats and tracking
            await thesisModel.updateSupervisorStats(supervisor.id, thesisId, true);
            await userModel.removeThesisFromSupervisor(supervisor.id, thesisId);
            await userModel.addThesisToSupervisorReviewed(supervisor.id, thesisId);

            res.json({
                message: "Thesis approved successfully by reviewer",
                redirectToSign: true,
                thesisId: thesisId,
                pdfPath: supervisorUnSignedPdfPath,
                action: "unsigned"
            });
            return
        }

        // SCENARIO 2: No consultant or consultant didn't approve - Supervisor does full review
        // CASE 2A: Request Revisions (only comments)
        if (comments && !assessment) {
            updatedThesis = await thesisModel.submitSupervisorReview(
                thesisId,
                comments,
                'revisions_requested',
                false
            );

            // Update supervisor stats
            await thesisModel.updateSupervisorStats(supervisor.id, thesisId, false);

            await userModel.updateStudentSupervisorFeedback(
                thesis.data.student,
                {
                    comments: comments,
                    lastReviewDate: new Date(),
                    reviewIteration: thesis.data.currentIteration,
                    status: 'revisions_requested',
                    isSigned: false
                },
                thesis.data.currentIteration
            );

            res.json({
                message: "Revisions requested successfully",
                redirectToSign: false,
                thesisId: thesisId,
                action: "revisions_requested"
            });
            return
        }

        // CASE 2B: Final Approval (with assessment) - Supervisor creates new PDF
        if (assessment) {
            // Update the thesis with assessment first
            updatedThesis = await thesisModel.updateThesis(thesisId, {
                consultantAssessment: assessment,
            });

            if (!updatedThesis) {
                res.status(404).json({ error: "Thesis not found" });
                return
            }

            // Submit the supervisor review with final approval
            updatedThesis = await thesisModel.submitSupervisorReview(
                thesisId,
                "Thesis approved by supervisor",
                'approved',
                true
            );

            // Generate unsigned PDF for supervisor review (only when no consultant)
            const unsignedDir = path.join(__dirname, "../../server/reviews/supervisor/unsigned");
            if (!fs.existsSync(unsignedDir)) {
                fs.mkdirSync(unsignedDir, { recursive: true });
            }

            pdfPath = await generateConsultantReviewPDF(updatedThesis.data, supervisor, true);

            // Update thesis with PDF path
            await thesisModel.updateThesis(thesisId, {
                reviewPdfSupervisor: pdfPath,
                status: "under_review" // Ready for final review
            });

            // Update student with supervisor feedback and approval
            await userModel.updateStudentSupervisorFeedback(
                thesis.data.student,
                {
                    comments: "Thesis approved by supervisor",
                    lastReviewDate: new Date(),
                    reviewIteration: thesis.data.currentIteration,
                    status: 'approved',
                    isSigned: false // Will be signed later
                },
                thesis.data.currentIteration
            );

            // Update supervisor stats and tracking
            await thesisModel.updateSupervisorStats(supervisor.id, thesisId, true);
            await userModel.removeThesisFromSupervisor(supervisor.id, thesisId);
            await userModel.addThesisToSupervisorReviewed(supervisor.id, thesisId);

            res.json({
                message: "Review submitted and approved successfully",
                redirectToSign: true, // Supervisor needs to sign their own PDF
                thesisId: thesisId,
                pdfPath: pdfPath,
                action: "approved"
            });
            return
        }

        // If we get here, the request is invalid
        res.status(400).json({
            error: "Invalid request. Either provide only comments for revisions, or provide assessment for approval."
        });
        return

    } catch (error) {
        console.error("Error in submitSupervisorReview:", error);
        res.status(500).json({ error: "Failed to submit review" });
    }
}


export const getAssignedTheses = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor

        // Fetch theses assigned to the consultant
        const assignedTheses = await thesisModel.getThesesBySupervisor(supervisor.id);

        // Fetch student details for each thesis
        const thesesWithStudents = await Promise.all(
            assignedTheses.map(async (thesis) => {
                const student = await userModel.getUserById(thesis.data.student)
                return {
                    ...thesis.data,
                    id: thesis.id,
                    createdAt: thesis.created_at,
                    updatedAt: thesis.updated_at,
                    student: student ? {
                        id: student.id,
                        fullName: student.fullName,
                        email: student.email,
                        institution: student.institution
                    } : null
                }
            })
        )

        res.json(thesesWithStudents)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to fetch assigned theses" })
    }
}

export const getCompletedReviews = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor;

        // Get all theses assigned to this consultant
        const assignedTheses = await thesisModel.getThesesBySupervisor(supervisor.id);

        // Filter theses where consultant has given final approval
        const completedReviews = assignedTheses.filter(thesis => {
            const thesisData = thesis.data; // Access the IThesis data

            // Check if there are any review iterations
            if (!thesisData.reviewIterations || thesisData.reviewIterations.length === 0) {
                return false;
            }

            // Look for any consultant review that has isFinalApproval = true
            const hasFinalApproval = thesisData.reviewIterations.some(iteration =>
                iteration.supervisorReview?.isFinalApproval === true &&
                iteration.supervisorReview?.status === 'approved'
            );

            return hasFinalApproval;
        });

        // Fetch student details for each completed review
        const reviewsWithStudents = await Promise.all(
            completedReviews.map(async (thesis) => {
                const thesisData = thesis.data;
                const student = await userModel.getUserById(thesisData.student);

                // Find the final approval review
                const finalReview = thesisData.reviewIterations.find(iteration =>
                    iteration.supervisorReview?.isFinalApproval === true
                );

                return {
                    id: thesis.id, // From ThesisDocument
                    title: thesisData.title,
                    submissionDate: thesisData.submissionDate,
                    finalGrade: thesisData.finalGrade,
                    status: thesisData.status,
                    supervisorReview: finalReview?.supervisorReview,
                    approvedAt: finalReview?.supervisorReview?.submittedDate,
                    iteration: finalReview?.iteration,
                    createdAt: thesis.created_at, // From ThesisDocument
                    updatedAt: thesis.updated_at, // From ThesisDocument
                    student: student ? {
                        id: student.id,
                        fullName: student.fullName,
                        email: student.email,
                        institution: student.institution,
                        faculty: (student as IStudent).faculty,
                        group: (student as IStudent).group,
                        subjectArea: (student as IStudent).subjectArea
                    } : null
                };
            })
        );

        // Sort by approval date (most recent first)
        reviewsWithStudents.sort((a, b) =>
            new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime()
        );

        res.json(reviewsWithStudents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch completed reviews" });
    }
}

export const reReviewThesis = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor;
        const { thesisId } = req.params;

        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return
        }

        if (thesis.data.assignedSupervisor !== supervisor.id) {
            res.status(403).json({ error: "Access denied" });
            return
        }

        // Delete supervisor review files if they exist
        if (thesis.data.reviewPdfSupervisor && fs.existsSync(thesis.data.reviewPdfSupervisor)) {
            fs.unlinkSync(thesis.data.reviewPdfSupervisor);
        }

        // Reset thesis review data but keep the current iteration and review history
        const updatedThesisData: Partial<IThesis> = {
            status: "with_supervisor",
            consultantAssessment: undefined,
            reviewPdfSupervisor: undefined,
            reviewIterations: thesis.data.reviewIterations.map(iteration => ({
                iteration: iteration.iteration,
                status: 'under_review',

                consultantReview: undefined,
                supervisorReview: undefined,
                studentResubmissionDate: undefined
            }))
        };

        await thesisModel.updateThesis(thesisId, updatedThesisData);

        await userModel.addThesisToSupervisor(supervisor.id, thesisId);

        // Update student status and clear previous supervisor feedback
        await userModel.updateStudentThesisStatus(thesis.data.student, "with_supervisor");

        // Clear the student's supervisor feedback
        await userModel.updateStudentSupervisorFeedback(
            thesis.data.student,
            {
                comments: "",
                lastReviewDate: new Date(),
                reviewIteration: thesis.data.currentIteration,
                status: 'pending',
                isSigned: false
            },
            thesis.data.currentIteration
        );

        // Delete signed review file if it exists
        const signedReviewPath = path.join(__dirname, "../../server/reviews/supervisor/signed", `signed_review1_${thesis.data.student}.pdf`)
        if (fs.existsSync(signedReviewPath)) {
            fs.unlinkSync(signedReviewPath)
        }

        // Delete unsigned supervisor review file if it exists
        if (thesis.data.reviewPdfSupervisor && fs.existsSync(thesis.data.reviewPdfSupervisor)) {
            fs.unlinkSync(thesis.data.reviewPdfSupervisor)
        }

        res.json({ message: "Thesis moved back for supervisor re-review successfully" })
    } catch (error) {
        console.error("Error in reReviewThesisSupervisor:", error)
        res.status(500).json({ error: "Failed to move thesis for supervisor re-review" })
    }
}

export const getUnsignedReview = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor;
        const { thesisId } = req.params;

        // Find thesis and check access
        const thesis = await thesisModel.getThesisById(thesisId);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Check if supervisor has access
        if (thesis.data.assignedSupervisor !== supervisor.id) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        if (!thesis.data.reviewPdfSupervisor) {
            res.status(404).json({ error: "Unsigned review not found" });
            return;
        }

        // Use full path from database
        const unsignedReviewPath = thesis.data.reviewPdfSupervisor;

        if (!fs.existsSync(unsignedReviewPath)) {
            res.status(404).json({ error: "Unsigned review file not found" });
            return;
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="unsigned_review1_${thesis.data.student}.pdf"`);

        const fileStream = fs.createReadStream(unsignedReviewPath);
        fileStream.pipe(res);

        fileStream.on("error", (error) => {
            console.error("Error streaming unsigned review:", error);
            res.status(500).json({ error: "Failed to stream unsigned review" });
        });
    } catch (error) {
        console.error("Error getting unsigned review:", error);
        res.status(500).json({ error: "Failed to get unsigned review" });
    }
}

export const uploadSignedReview = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor
        const { thesisId } = req.params
        const { file } = req

        console.log("Uploading signed review via Chrome native tools:", { thesisId, hasFile: !!file })

        // Find thesis and check access
        const thesis = await thesisModel.getThesisById(thesisId)
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" })
            return
        }

        if (thesis.data.assignedSupervisor !== supervisor.id) {
            res.status(403).json({ error: "Access denied" })
            return
        }

        if (!file) {
            res.status(400).json({ error: "Signed PDF file is required" })
            return
        }

        // Ensure signed reviews directory exists
        const signedDir = path.join(__dirname, "../../server/reviews/supervisor/signed")
        if (!fs.existsSync(signedDir)) {
            fs.mkdirSync(signedDir, { recursive: true })
        }

        // Move uploaded file to signed reviews directory
        const signedReviewPath = path.join(signedDir, `signed_review1_${thesis.data.student}.pdf`)
        fs.renameSync(file.path, signedReviewPath)

        console.log(`Chrome-signed review saved to: ${signedReviewPath}`)

         // Update the current iteration's supervisor review status to "signed"
        const currentIteration = thesis.data.currentIteration;
        const updatedReviewIterations = thesis.data.reviewIterations.map((iteration, index) => {
            if (index === currentIteration - 1) { // currentIteration is 1-based, array is 0-based
                return {
                    ...iteration,
                    supervisorReview: iteration.supervisorReview ? {
                        ...iteration.supervisorReview,
                        status: 'signed' as const,
                        signedDate: new Date()
                    } : undefined
                };
            }
            return iteration;
        });


        // Update thesis with signed PDF path and status
        await thesisModel.updateThesis(thesisId, {
            status: "under_review",
            supervisorSignedReviewPath: signedReviewPath,
            signedDate: new Date(),
            reviewIterations: updatedReviewIterations
        })

        // Update student status to evaluated
        await userModel.updateStudentThesisStatus(thesis.data.student, "under_review")

        res.json({
            message: "Signed review uploaded successfully using Chrome's native tools",
            success: true,
        })
    } catch (error) {
        console.error("Error uploading Chrome-signed review:", error)
        res.status(500).json({ error: "Failed to upload signed review" })
    }
}

export const getSignedReview = async (req: Request, res: Response) => {
    try {
        const user = req.user as AuthenticatedUser
        const { thesisId } = req.params

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId)
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" })
            return
        }

     
        // Try to find signed review file using full path from database
        let signedReviewPath: string

        if (user.role === 'consultant' && thesis.data.assignedConsultant === user.id && thesis.data.consultantSignedReviewPath && fs.existsSync(thesis.data.consultantSignedReviewPath)) {
            signedReviewPath = thesis.data.consultantSignedReviewPath
        } else if (user.role === 'supervisor' && thesis.data.assignedSupervisor === user.id ) {
            signedReviewPath = path.join(__dirname, "../../server/reviews/supervisor/signed", `signed_review1_${thesis.data.student}.pdf`)
        } else {
            signedReviewPath = path.join(__dirname, "../../server/reviews/supervisor/signed", `signed_review1_${thesis.data.student}.pdf`)
        }

        if (!fs.existsSync(signedReviewPath)) {
            res.status(404).json({ error: "Signed review not found" })
            return
        }

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="signed_review1_${thesis.data.student}.pdf"`)

        const fileStream = fs.createReadStream(signedReviewPath)
        fileStream.pipe(res)

        fileStream.on("error", (error) => {
            console.error("Error streaming signed review:", error)
            res.status(500).json({ error: "Failed to stream signed review" })
        })
    } catch (error) {
        console.error("Error getting signed review:", error)
        res.status(500).json({ error: "Failed to get signed review" })
    }
}

export const downloadSignedReview = async (req: Request, res: Response) => {
    try {
        const user = req.user as AuthenticatedUser
        const { thesisId } = req.params

        // Find thesis
        const thesis = await thesisModel.getThesisById(thesisId)
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" })
            return
        }

        let signedReviewPath: string

        if (thesis.data.supervisorSignedReviewPath && fs.existsSync(thesis.data.supervisorSignedReviewPath)) {
            signedReviewPath = thesis.data.supervisorSignedReviewPath
        } else {
            signedReviewPath = path.join(__dirname, "../../server/reviews/supervisor/signed", `signed_review1_${thesis.data.student}.pdf`)
        }

        if (!fs.existsSync(signedReviewPath)) {
            res.status(404).json({ error: "Signed review not found" })
            return
        }

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `attachment; filename="signed_review1_${thesis.data.student}.pdf"`)

        const fileStream = fs.createReadStream(signedReviewPath)
        fileStream.pipe(res)

        fileStream.on("error", (error) => {
            console.error("Error downloading signed review:", error)
            res.status(500).json({ error: "Failed to download signed review" })
        })
    } catch (error) {
        console.error("Error downloading signed review:", error)
        res.status(500).json({ error: "Failed to download signed review" })
    }
}

export const signedReview = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor
        const { thesisId } = req.params
        const { file } = req

        if (!file) {
            res.status(400).json({ error: "File not available" })
            return
        }

        
       // Get the current thesis first to access the review iterations
        const currentThesis = await thesisModel.getThesisById(thesisId)
        if (!currentThesis) {
            res.status(404).json({ error: "Thesis not found" })
            return
        }

        // Move signed PDF to permanent storage
        const signedPath = path.join(__dirname, "../../server/reviews/supervisor/signed", `signed_review1_${currentThesis.data.student}.pdf`)
        fs.renameSync(file.path, signedPath)

        // Update the current iteration's supervisor review status to "signed"
        const currentIteration = currentThesis.data.currentIteration;
        const updatedReviewIterations = currentThesis.data.reviewIterations.map((iteration, index) => {
            if (index === currentIteration - 1) { // currentIteration is 1-based, array is 0-based
                return {
                    ...iteration,
                    supervisorReview: iteration.supervisorReview ? {
                        ...iteration.supervisorReview,
                        status: 'signed' as const,
                        signedDate: new Date()
                    } : {
                        // If no supervisor review exists yet, create one with signed status
                        comments: "Signed by supervisor",
                        submittedDate: new Date(),
                        status: 'signed' as const,
                        iteration: currentIteration,
                        isFinalApproval: false,
                        signedDate: new Date()
                    }
                };
            }
            return iteration;
        });

        // Update thesis with signed PDF path and review status (keep thesis status as under_review)
        const thesis = await thesisModel.updateThesis(thesisId, {
            status: "under_review", // Keep thesis status as under_review
            supervisorSignedReviewPath: signedPath,
            signedDate: new Date(),
            reviewIterations: updatedReviewIterations
        })

        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" })
            return
        }
        
        // Update student's status
        await userModel.updateStudentThesisStatus(thesis.data.student, "under_review")

        res.json({ success: true })
    } catch (error) {
        console.error("Error finalizing review:", error)
        res.status(500).json({ error: "Failed to finalize review" })
    }
}

// New method to get reviewer's assigned and reviewed thesis counts
export const getReviewerStats = async (req: Request, res: Response) => {
    try {
        const supervisor = req.user as AuthenticatedUser & ISupervisor

        const assignedTheses = await thesisModel.getThesesBySupervisor(supervisor.id)
        const allTheses = await thesisModel.find()
        const reviewedTheses = allTheses.filter(thesis =>
            thesis.data.status === "evaluated" && thesis.data.assignedSupervisor === supervisor.id
        )

        res.json({
            assignedCount: assignedTheses.length,
            reviewedCount: reviewedTheses.length,
            totalCount: assignedTheses.length + reviewedTheses.length
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to fetch reviewer stats" })
    }
}