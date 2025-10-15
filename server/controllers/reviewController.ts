import type { Request, Response } from "express"
import { ThesisModel } from "../models/Thesis.model"
import { UserModel, Reviewer, IUser, IReviewer, IStudent } from "../models/User.model"
import { generateReviewPDF } from "../utils/pdfGenerator"
import path from "path"
import fs from "fs"
import { Pool } from 'pg';

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

export const submitReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer
    const { thesisId } = req.params
    const { grade, assessment } = req.body

    // Find the thesis first
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check if supervisor has signed the review (supervisorSignedReviewPath exists and file exists)
    if (!thesis.data.supervisorSignedReviewPath) {
      res.status(400).json({
        error: "Cannot submit review: Supervisor has not signed their review yet"
      })
      return
    }

    // Verify the supervisor signed file actually exists on the filesystem
    const supervisorSignedPath = thesis.data.supervisorSignedReviewPath;
    if (!fs.existsSync(supervisorSignedPath)) {
      res.status(400).json({
        error: "Cannot submit review: Supervisor signed review file not found"
      })
      return
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
        threshold: 15,
        requiredAction: "plagiarism_revision"
      });
      return
    }

    // Verify the plagiarism-checked file exists
    if (!plagiarismCheck.checkedFileUrl || !fs.existsSync(plagiarismCheck.checkedFileUrl)) {
      res.status(400).json({
        error: "Cannot proceed: Plagiarism-checked thesis file not found",
        requiredAction: "plagiarism_recheck"
      });
      return
    }


    // Validate required fields
    if (!grade || !assessment) {
      res.status(400).json({
        error: "Grade and assessment are required"
      })
      return
    }

    // Update the thesis with the review details 
    const updatedThesis = await thesisModel.updateThesis(thesisId, {
      finalGrade: grade,
      reviewerAssessment: assessment,
      status: "under_review", // Keep as under_review until signed

    })

    if (!updatedThesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Generate unsigned PDF
    const unsignedDir = path.join(__dirname, "../../server/reviews/reviewer/unsigned");
    if (!fs.existsSync(unsignedDir)) {
      fs.mkdirSync(unsignedDir, { recursive: true })
    }

    const pdfPath = await generateReviewPDF(updatedThesis.data, reviewer)

    // Update thesis with PDF path
    await thesisModel.updateThesis(thesisId, {
      reviewPdfReviewer: pdfPath
    })

    // Update student's grade 
    await userModel.updateStudentThesisInfo(thesis.data.student, {
      thesisGrade: grade,
    })

    // Move thesis from assigned to reviewed for reviewer tracking
    await userModel.removeThesisFromReviewer(reviewer.id, thesisId)
    await userModel.addThesisToReviewed(reviewer.id, thesisId)

    // Return success with redirect flag
    res.json({
      message: "Review submitted successfully",
      redirectToSign: true,
      thesisId: thesisId,
    })
  } catch (error) {
    console.error("Error in submitReview:", error)
    res.status(500).json({ error: "Failed to submit review" })
  }
}

//ONLY ACCESS FINAL VERSION OF THESIS
export const getAssignedTheses = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer

    // Fetch theses assigned to the reviewer
    const assignedTheses = await thesisModel.getThesesByReviewer(reviewer.id)

    // Fetch student details for each thesis
    const thesesWithStudents = await Promise.all(
      assignedTheses.map(async (thesis) => {
        // Check if supervisor has signed and the file exists
        const hasSupervisorSigned = thesis.data.supervisorSignedReviewPath &&
          fs.existsSync(thesis.data.supervisorSignedReviewPath)

        const hasValidPlagiarismCheck = thesis.data.plagiarismCheck.isChecked &&
          thesis.data.plagiarismCheck.isApproved &&
          thesis.data.plagiarismCheck.checkedFileUrl &&
          fs.existsSync(thesis.data.plagiarismCheck.checkedFileUrl) &&
          thesis.data.plagiarismCheck.reportUrl;

        if (!hasSupervisorSigned || !hasValidPlagiarismCheck) {
          return null; // Skip this thesis
        }

        const student = await userModel.getUserById(thesis.data.student);
        return {
          ...thesis.data,
          id: thesis.id,
          createdAt: thesis.created_at,
          updatedAt: thesis.updated_at,
          // Use the plagiarism-checked file for reviewers
          fileUrl: thesis.data.plagiarismCheck.checkedFileUrl,
          student: student ? {
            id: student.id,
            fullName: student.fullName,
            email: student.email,
            institution: student.institution
          } : null,
          plagiarismInfo: {
            similarityScore: thesis.data.plagiarismCheck.similarityScore,
            attempts: thesis.data.plagiarismCheck.attempts,
            lastCheckDate: thesis.data.plagiarismCheck.lastCheckDate
          }
        };
      })
    );

    // Remove null values
    const filteredTheses = thesesWithStudents.filter(thesis => thesis !== null);

    res.json(filteredTheses);
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch assigned theses" })
  }
}

export const getCompletedReviews = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer

    // Get all reviewed theses and filter by this reviewer
    const allTheses = await thesisModel.find()

    const reviewedTheses = allTheses.filter(thesis =>
      thesis.status === "evaluated" &&
      thesis.assignedReviewer === reviewer.id
    )

    // Fetch student details for each thesis
    const reviewsWithStudents = await Promise.all(
      reviewedTheses.map(async (thesis) => {
        const student = await userModel.getUserById(thesis.student)

        return {
          ...thesis,
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

    res.json(reviewsWithStudents)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch completed reviews" })
  }
}

export const reReviewThesis = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer
    const { thesisId } = req.params

    // Find thesis
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check reviewer access
    if (thesis.data.assignedReviewer !== reviewer.id) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    // Check if supervisor has signed the review (supervisorSignedReviewPath exists and file exists)
    if (!thesis.data.supervisorSignedReviewPath) {
      res.status(400).json({
        error: "Cannot submit review: Supervisor has not signed their review yet"
      })
      return
    }

    // Verify the supervisor signed file actually exists on the filesystem
    const supervisorSignedPath = thesis.data.supervisorSignedReviewPath;
    if (!fs.existsSync(supervisorSignedPath)) {
      res.status(400).json({
        error: "Cannot submit review: Supervisor signed review file not found"
      })
      return
    }

    // Check if plagiarism check is completed and approved
    if (!thesis.data.plagiarismCheck.isChecked || !thesis.data.plagiarismCheck.isApproved) {
      res.status(400).json({
        error: "Cannot submit review: Thesis has not passed plagiarism check"
      })
      return
    }

    // Verify the plagiarism-checked file exists
    if (!thesis.data.plagiarismCheck.checkedFileUrl || !fs.existsSync(thesis.data.plagiarismCheck.checkedFileUrl)) {
      res.status(400).json({
        error: "Cannot submit review: Plagiarism-checked thesis file not found"
      })
      return
    }

    // Delete signed review file if it exists
    const signedReviewPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`)
    if (fs.existsSync(signedReviewPath)) {
      fs.unlinkSync(signedReviewPath)
    }

    // Delete unsigned review file if it exists
    if (thesis.data.reviewPdfReviewer && fs.existsSync(thesis.data.reviewPdfReviewer)) {
      fs.unlinkSync(thesis.data.reviewPdfReviewer)
    }

    // Reset thesis to under_review and clear review data
    await thesisModel.updateThesis(thesisId, {
      status: "under_review",
      finalGrade: undefined,
      reviewerAssessment: undefined,
      reviewPdfReviewer: undefined,
      reviewerSignedReviewPath: undefined,
      signedDate: undefined,
    })

    // Move thesis back from reviewed to assigned
    await userModel.removeThesisFromReviewer(reviewer.id, thesisId)
    await userModel.addThesisToReviewer(reviewer.id, thesisId)

    // Update student status
    await userModel.updateStudentThesisStatus(thesis.data.student, "under_review")

    res.json({ message: "Thesis moved back for re-review successfully" })
  } catch (error) {
    console.error("Error in reReviewThesis:", error)
    res.status(500).json({ error: "Failed to move thesis for re-review" })
  }
}

export const getUnsignedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer
    const { thesisId } = req.params

    // Find thesis and check access
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Check if reviewer has access
    if (thesis.data.assignedReviewer !== reviewer.id) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    // Find the student associated with this thesis
        const student = await userModel.getUserById(thesis.data.student);
        if (!student) {
            res.status(404).json({ error: "Student not found for this thesis" });
            return;
        }

        // Check if student has signed 
        if (!(student as IStudent).studentSignedRevTwoAt) {
            res.status(400).json({ 
                error: "Cannot access unsigned review: Student has not signed their submission yet",
                requiredAction: "await_student_signature"
            });
            return;
        }


    if (!thesis.data.reviewPdfReviewer) {
      res.status(404).json({ error: "Unsigned review not found" })
      return
    }

    // Use full path from database
    const unsignedReviewPath = thesis.data.reviewPdfReviewer

    if (!fs.existsSync(unsignedReviewPath)) {
      res.status(404).json({ error: "Unsigned review file not found" })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="unsigned_review2_${thesisId}.pdf"`)

    const fileStream = fs.createReadStream(unsignedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming unsigned review:", error)
      res.status(500).json({ error: "Failed to stream unsigned review" })
    })
  } catch (error) {
    console.error("Error getting unsigned review:", error)
    res.status(500).json({ error: "Failed to get unsigned review" })
  }
}

export const uploadSignedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer
    const { thesisId } = req.params
    const { file } = req

    console.log("Uploading signed review via Chrome native tools:", { thesisId, hasFile: !!file })

    // Find thesis and check access
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    if (thesis.data.assignedReviewer !== reviewer.id) {
      res.status(403).json({ error: "Access denied" })
      return
    }

    if (!file) {
      res.status(400).json({ error: "Signed PDF file is required" })
      return
    }

    // Ensure signed reviews directory exists
    const signedDir = path.join(__dirname, "../../server/reviews/reviewer/signed")
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true })
    }

    // Move uploaded file to signed reviews directory
    const signedReviewPath = path.join(signedDir, `signed_review2_${thesis.data.student}.pdf`)
    fs.renameSync(file.path, signedReviewPath)

    console.log(`Chrome-signed review saved to: ${signedReviewPath}`)

    // Update thesis with signed PDF path and status
    await thesisModel.updateThesis(thesisId, {
      status: "evaluated",
      reviewerSignedReviewPath: signedReviewPath,
      reviewPdfReviewer: signedReviewPath,
      signedDate: new Date(),
    })

    // Update student status to evaluated
    await userModel.updateStudentThesisStatus(thesis.data.student, "evaluated")

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

    if (thesis.data.reviewerSignedReviewPath && fs.existsSync(thesis.data.reviewerSignedReviewPath)) {
      signedReviewPath = thesis.data.reviewerSignedReviewPath
    } else {
      signedReviewPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`)
    }

    if (!fs.existsSync(signedReviewPath)) {
      res.status(404).json({ error: "Signed review not found" })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="signed_review2_${thesis.data.student}.pdf"`)

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

    if (thesis.data.reviewerSignedReviewPath && fs.existsSync(thesis.data.reviewerSignedReviewPath)) {
      signedReviewPath = thesis.data.reviewerSignedReviewPath
    } else {
      signedReviewPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`)
    }

    if (!fs.existsSync(signedReviewPath)) {
      res.status(404).json({ error: "Signed review not found" })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="signed_review2_${thesis.data.student}.pdf"`)

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
    const reviewer = req.user as AuthenticatedUser & IReviewer
    const { thesisId } = req.params
    const { file } = req

    if (!file) {
      res.status(400).json({ error: "File not available" })
      return
    }

    // Update the thesis status to evaluated
    const thesis = await thesisModel.updateThesis(thesisId, {
      status: "evaluated",
    })

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" })
      return
    }

    // Move signed PDF to permanent storage
    const signedPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`)
    fs.renameSync(file.path, signedPath)

    // Update student's status
    await userModel.updateStudentThesisStatus(thesis.data.student, "evaluated")

    res.json({ success: true })
  } catch (error) {
    console.error("Error finalizing review:", error)
    res.status(500).json({ error: "Failed to finalize review" })
  }
}

// New method to get reviewer's assigned and reviewed thesis counts
export const getReviewerStats = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer

    const assignedTheses = await thesisModel.getThesesByReviewer(reviewer.id)
    const allTheses = await thesisModel.find()
    const reviewedTheses = allTheses.filter(thesis =>
      thesis.data.status === "evaluated" && thesis.data.assignedReviewer === reviewer.id
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