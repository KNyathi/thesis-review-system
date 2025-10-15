import type { Request, Response } from "express";
import { Pool } from 'pg';
import path from "path"
import fs from "fs"
import { ThesisModel, IThesis, IReviewIteration } from "../models/Thesis.model";
import { UserModel, Student, Reviewer, IUser, IStudent, IReviewer, ISupervisor, IHeadOfDepartment, IDean } from "../models/User.model";
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

        // Check if this is a supervisor-proposed topic waiting for student response
        if (studentData.topicProposedBy === 'supervisor' &&
            studentData.studentTopicResponse?.status === 'pending') {
            res.status(400).json({
                error: "This topic is waiting for student response. Cannot approve/reject as supervisor."
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

        // Set topic proposed by if not set (for student-submitted topics)
        if (!studentData.topicProposedBy) {
            updateData.topicProposedBy = 'student';
        }


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
                topicProposedBy: (updatedStudent as IStudent).topicProposedBy,
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

export const proposeThesisTopic = async (req: Request, res: Response) => {
    try {
        const { studentId } = req.params;
        const { proposedTopic } = req.body;
        const supervisorId = (req.user as AuthenticatedUser).id;

        // Validate input
        if (!proposedTopic || proposedTopic.trim() === '') {
            res.status(400).json({
                error: "Proposed topic is required"
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

        // Check if student already has an approved topic
        if (studentData.isTopicApproved) {
            res.status(400).json({
                error: "Student already has an approved thesis topic"
            });
            return;
        }

        // Check if there's a pending supervisor proposal
        if (studentData.topicProposedBy === 'supervisor' &&
            studentData.studentTopicResponse?.status === 'pending') {
            res.status(400).json({
                error: "There is already a pending topic proposal waiting for student response"
            });
            return;
        }

        // Prepare update data
        const updateData: any = {
            thesisTopic: proposedTopic.trim(),
            isTopicApproved: false,
            topicProposedBy: 'supervisor',
            topicProposedAt: new Date(),
            topicRejectionComments: null,
            studentTopicResponse: {
                status: 'pending', // Set to pending for student response
                respondedAt: null,
                comments: null
            }
        };

        const updatedStudent = await userModel.updateUser(studentId, updateData);

        res.status(200).json({
            message: "Thesis topic proposed successfully. Waiting for student response.",
            student: {
                id: updatedStudent.id,
                thesisTopic: (updatedStudent as IStudent).thesisTopic,
                isTopicApproved: (updatedStudent as IStudent).isTopicApproved,
                fullName: updatedStudent.fullName,
                topicProposedBy: (updatedStudent as IStudent).topicProposedBy,
                topicProposedAt: (updatedStudent as IStudent).topicProposedAt,
                studentTopicResponse: (updatedStudent as IStudent).studentTopicResponse
            }
        });

    } catch (error: any) {
        console.error('Error proposing thesis topic:', error);
        res.status(500).json({
            error: error.message || "Failed to propose thesis topic"
        });
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

        const student = await userModel.getUserById(thesis.data.student);
        if (!student) {
            res.status(404).json({ error: "Student not found for this thesis" });
            return;
        }

        // PLAGIARISM CHECK VALIDATION - REQUIRED BEFORE ANY SUPERVISOR SIGNING
        const plagiarismCheck = thesis.data.plagiarismCheck;

        // Check if plagiarism check was performed
        if (!plagiarismCheck.isChecked) {
            res.status(400).json({
                error: "Cannot proceed: Thesis must pass plagiarism check before supervisor review",
                requiredAction: "plagiarism_check"
            });
            return
        }

        // Check if plagiarism check is approved
        if (!plagiarismCheck.isApproved) {
            res.status(400).json({
                error: `Cannot proceed: Thesis failed plagiarism check (Similarity: ${plagiarismCheck.similarityScore}%)`,
                similarityScore: plagiarismCheck.similarityScore,
                threshold: 15, // Your approval threshold
                requiredAction: "plagiarism_revision"
            });
            return
        }

        // Verify the plagiarism-checked file exists
        if (!plagiarismCheck.checkedFileUrl) {
            res.status(400).json({
                error: "Cannot proceed: Plagiarism-checked thesis file not found",
                requiredAction: "plagiarism_recheck"
            });
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


            // VALIDATION 1: Check if student has submitted thesis content
            if (!(student as IStudent).thesisContent) {
                res.status(400).json({
                    error: "Cannot proceed: Student has not submitted thesis content",
                    requiredAction: "await_student_submission"
                });
                return;
            }

            // VALIDATION 2: Check if student has signed their submission
            if (!(student as IStudent).studentSignedRevOneAt) {
                res.status(400).json({
                    error: "Cannot proceed: Student must sign their thesis submission before supervisor review",
                    requiredAction: "await_student_signature"
                });
                return;
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

            // VALIDATION 1: Check if student has submitted thesis content
            if (!(student as IStudent).thesisContent) {
                res.status(400).json({
                    error: "Cannot proceed: Student has not submitted thesis content",
                    requiredAction: "await_student_submission"
                });
                return;
            }

            // VALIDATION 2: Check if student has signed their submission
            if (!(student as IStudent).studentSignedRevOneAt) {
                res.status(400).json({
                    error: "Cannot proceed: Student must sign their thesis submission before supervisor review",
                    requiredAction: "await_student_signature"
                });
                return;
            }


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

        const student = await userModel.getUserById(thesis.data.student);
        if (!student) {
            res.status(404).json({ error: "Student not found for this thesis" });
            return;
        }


        const studentUpdateData: any = {
            studentSignedAt: undefined
        };

        if ('studentSignedRevOneAt' in student) {
            studentUpdateData.studentSignedRevOneAt = undefined;
        }

        await userModel.updateUser(thesis.data.student, studentUpdateData);
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

        // Find the student associated with this thesis
        const student = await userModel.getUserById(thesis.data.student);
        if (!student) {
            res.status(404).json({ error: "Student not found for this thesis" });
            return;
        }

        // Check if student has signed (studentSignedRevOneAt is defined)
        if (!(student as IStudent).studentSignedRevOneAt) {
            res.status(400).json({ 
                error: "Cannot access unsigned review: Student has not signed their submission yet",
                requiredAction: "await_student_signature"
            });
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
        } else if (user.role === 'supervisor' && thesis.data.assignedSupervisor === user.id) {
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


// Download Thesis
export const downloadThesis = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user as AuthenticatedUser;

        if (!user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }

        const thesis = await thesisModel.getThesisById(id);
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" });
            return;
        }

        // Get the student to verify assignments
        const student = await userModel.getUserById(thesis.data.student);
        if (!student) {
            res.status(404).json({ error: "Student not found" });
            return;
        }

        // Enhanced permission checking
        let isAllowed = false;

        switch (user.role) {
            case "admin":
                // Admin can access everything
                isAllowed = true;
                break;

            case "student":
                // Student can only access their own thesis
                isAllowed = thesis.data.student === user.id;
                break;

            case "reviewer":
                // Reviewer must be assigned to this specific thesis
                isAllowed = thesis.data.assignedReviewer === user.id;
                break;

            case "supervisor":
                // Supervisor must be assigned to this student
                const studentAsIStudent = student as IStudent;
                isAllowed = studentAsIStudent.supervisor === user.id;
                break;

            case "consultant":
                // Consultant must be assigned to this student
                const studentAsIStudentForConsultant = student as IStudent;
                isAllowed = studentAsIStudentForConsultant.consultant === user.id;
                break;

            case "head_of_department":
                // Head of Department must be in the same faculty as the student
                const studentAsIStudentForHOD = student as IStudent;
                const hod = user as IHeadOfDepartment;
                isAllowed = studentAsIStudentForHOD.faculty === hod.faculty;
                break;

            case "dean":
                // Dean must be in the same faculty as the student
                const studentAsIStudentForDean = student as IStudent;
                const dean = user as IDean;
                isAllowed = studentAsIStudentForDean.faculty === dean.faculty;
                break;

            default:
                isAllowed = false;
        }

        if (!isAllowed) {
            res.status(403).json({
                error: "Access denied",
                message: "You are not authorized to access this thesis"
            });
            return;
        }

        if (!thesis.data.plagiarismCheck.checkedFileUrl) {
            res.status(400).json({ error: "Checked file URL not found in database" });
            return;
        }

        const filePath = path.join(__dirname, "../../server/uploads/checked-theses", path.basename(thesis.data.plagiarismCheck.checkedFileUrl))

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "File not found" })
            return
        }

        // Set headers to indicate a file download
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `attachment; filename="thesis_${thesis.data.student}.pdf"`)

        // Stream the file to the response
        const fileStream = fs.createReadStream(filePath)
        fileStream.pipe(res)

        fileStream.on("error", (error) => {
            console.error("Error streaming file:", error)
            res.status(500).json({ error: "Download failed" })
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Download failed" })
    }
}

export const viewThesis = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const user = req.user as AuthenticatedUser

        if (!user) {
            res.status(401).json({ error: "User not authenticated" })
            return
        }

        const thesis = await thesisModel.getThesisById(id)
        if (!thesis) {
            res.status(404).json({ error: "Thesis not found" })
            return
        }


        // Get the student to verify assignments
        const student = await userModel.getUserById(thesis.data.student);
        if (!student) {
            res.status(404).json({ error: "Student not found" });
            return;
        }

        // Enhanced permission checking
        let isAllowed = false;

        switch (user.role) {
            case "admin":
                // Admin can access everything
                isAllowed = true;
                break;

            case "student":
                // Student can only access their own thesis
                isAllowed = thesis.data.student === user.id;
                break;

            case "reviewer":
                // Reviewer must be assigned to this specific thesis
                isAllowed = thesis.data.assignedReviewer === user.id;
                break;

            case "supervisor":
                // Supervisor must be assigned to this student
                const studentAsIStudent = student as IStudent;
                isAllowed = studentAsIStudent.supervisor === user.id;
                break;

            case "consultant":
                // Consultant must be assigned to this student
                const studentAsIStudentForConsultant = student as IStudent;
                isAllowed = studentAsIStudentForConsultant.consultant === user.id;
                break;

            case "head_of_department":
                // Head of Department must be in the same faculty as the student
                const studentAsIStudentForHOD = student as IStudent;
                const hod = user as IHeadOfDepartment;
                isAllowed = studentAsIStudentForHOD.faculty === hod.faculty;
                break;

            case "dean":
                // Dean must be in the same faculty as the student
                const studentAsIStudentForDean = student as IStudent;
                const dean = user as IDean;
                isAllowed = studentAsIStudentForDean.faculty === dean.faculty;
                break;

            default:
                isAllowed = false;
        }

        if (!isAllowed) {
            res.status(403).json({
                error: "Access denied",
                message: "You are not authorized to access this thesis"
            });
            return;
        }


        if (!thesis.data.plagiarismCheck.checkedFileUrl) {
            res.status(400).json({ error: "Checked file URL not found in database" });
            return;
        }

        const filePath = path.join(__dirname, "../../server/uploads/checked-theses", path.basename(thesis.data.plagiarismCheck.checkedFileUrl))

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "File not found" })
            return
        }

        // Set headers to indicate a file download
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="thesis_${thesis.data.student}.pdf"`)

        // Stream the file to the response
        const fileStream = fs.createReadStream(filePath)
        fileStream.pipe(res)

        fileStream.on("error", (error) => {
            console.error("Error streaming file:", error)
            res.status(500).json({ error: "View failed" })
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "View failed" })
    }
}



// Get student's thesis status and grade
export const getThesisStatus = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent

        const theses = await thesisModel.getThesesByStudent(student.id)
        const thesis = theses[0] // Assuming one thesis per student

        const response = {
            thesisStatus: student.thesisStatus || "not_submitted",
            thesisGrade: student.thesisGrade || null,
            thesisTopic: student.thesisTopic || null,
            hasThesis: !!thesis,
            thesis: thesis ? {
                id: thesis.id,
                title: thesis.data.title,
                submissionDate: thesis.data.submissionDate,
                status: thesis.data.status,
                assignedReviewer: thesis.data.assignedReviewer,
            } : null
        }

        res.json(response)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Failed to get thesis status" })
    }
}

// Delete student's thesis
export const deleteThesis = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent;

        const theses = await thesisModel.getThesesByStudent(student.id);

        for (const thesis of theses) {
            // Remove from reviewer's assigned theses if assigned
            if (thesis.data.assignedReviewer) {
                const reviewer = await userModel.getUserById(thesis.data.assignedReviewer);
                if (reviewer && reviewer.role === 'reviewer') {
                    await userModel.removeThesisFromReviewer(reviewer.id, thesis.id);
                }
            }

            // Remove from consultant's assigned theses if assigned
            if (thesis.data.assignedConsultant) {
                const consultant = await userModel.getUserById(thesis.data.assignedConsultant);
                if (consultant && consultant.role === 'consultant') {
                    // Remove from assignedTheses array
                    await userModel.removeThesisFromConsultant(consultant.id, thesis.id);
                    // Remove from assignedStudents array
                    await userModel.removeStudentFromConsultant(consultant.id, student.id);
                }
            }

            // Remove from supervisor's assigned theses if assigned
            if (thesis.data.assignedSupervisor) {
                const supervisor = await userModel.getUserById(thesis.data.assignedSupervisor);
                if (supervisor && supervisor.role === 'supervisor') {
                    // Remove from assignedTheses array
                    await userModel.removeThesisFromSupervisor(supervisor.id, thesis.id);
                    // Remove from assignedStudents array
                    await userModel.removeStudentFromSupervisor(supervisor.id, student.id);
                }
            }

            // Delete the thesis file
            const filePath = path.join(__dirname, "../../server/uploads/theses", path.basename(thesis.data.fileUrl));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Delete the thesis record
            await thesisModel.deleteThesis(thesis.id);
        }

        // Reset student's thesis info using separate methods
        await userModel.updateStudentThesisStatus(student.id, "not_submitted");
        await userModel.updateStudentThesisInfo(student.id, {
            thesisFile: undefined,
            thesisTopic: undefined,
            thesisGrade: undefined,
        });


        res.json({ message: "Thesis deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete thesis" });
    }
};

// Update student's thesis topic
export const updateThesisTopic = async (req: Request, res: Response) => {
    try {
        const student = req.user as AuthenticatedUser & IStudent
        const { thesisTopic } = req.body

        if (!thesisTopic) {
            res.status(400).json({ error: "Thesis topic is required" })
            return
        }

        await userModel.updateStudentThesisInfo(student.id, {
            thesisTopic: thesisTopic,
        })

        res.json({ message: "Thesis topic updated successfully" })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Failed to update thesis topic" })
    }
}