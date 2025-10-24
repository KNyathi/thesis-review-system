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


    if (!thesis.data.reviewPdfReviewer) {
      res.status(404).json({ error: "Unsigned review not found" })
      return
    }

    // Check conditions for BOTH files
    const currentIteration = thesis.data.currentIteration;
    const currentIterationData = thesis.data.reviewIterations[currentIteration - 1];

    const isSupervisorSigned = currentIterationData?.supervisorReview?.status === 'signed';

    // Get paths and check existence
    const unsignedSupervisorPath = thesis.data.supervisorSignedReviewPath;
    const unsignedReviewPath = thesis.data.reviewPdfReviewer

    const hasSupervisorFile = unsignedSupervisorPath && fs.existsSync(unsignedSupervisorPath);
    const hasReviewerFile = unsignedReviewPath && fs.existsSync(unsignedReviewPath);

    const reviewerNotSigned = !thesis.data.reviewerSignedReviewPath;

    // Only proceed if BOTH files are available and conditions are met
    if (!isSupervisorSigned || !hasSupervisorFile || !hasReviewerFile || !reviewerNotSigned) {
      res.status(400).json({
        error: "Both reviews are not ready for HOD signing",
        details: {
          supervisorSigned: isSupervisorSigned,
          supervisorFileExists: hasSupervisorFile,
          reviewerFileExists: hasReviewerFile,
          allConditionsMet: isSupervisorSigned && hasSupervisorFile && hasReviewerFile && reviewerNotSigned
        }
      });
      return;
    }

    const supervisorPath = unsignedSupervisorPath!;
    const reviewerPath = unsignedReviewPath!;

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
    res.setHeader('Content-Disposition', `inline; filename="reviews_${thesisId}.multipart"`);

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
    await sendFilePart(supervisorPath, `unsigned_review1_${thesis.data.student}.pdf`);
    await sendFilePart(reviewerPath, `unsigned_review2_${thesis.data.student}.pdf`);

    // End of multipart
    res.write(`--${boundary}--\r\n`);
    res.end();


  } catch (error) {
    console.error("Error getting unsigned review:", error)
    res.status(500).json({ error: "Failed to get unsigned review" })
  }
}

export const uploadSignedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer
    const { thesisId } = req.params
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };


    console.log("Uploading HOD signed reviews:", { thesisId, files: files ? Object.keys(files) : 'no files' });

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

    // Check if both files are provided
    if (!files || !files.review1 || !files.review2) {
      res.status(400).json({
        error: "Both supervisor and reviewer unsigned reviews are required",
        received: files ? Object.keys(files) : 'no files'
      });
      return;
    }

    // Check conditions for BOTH files
    const currentIteration = thesis.data.currentIteration;
    const currentIterationData = thesis.data.reviewIterations[currentIteration - 1];

    const isSupervisorSigned = currentIterationData?.supervisorReview?.status === 'signed';

    // Get paths and check existence
    const unsignedSupervisorPath = thesis.data.supervisorSignedReviewPath;
    const unsignedReviewPath = thesis.data.reviewPdfReviewer

    const hasSupervisorFile = unsignedSupervisorPath && fs.existsSync(unsignedSupervisorPath);
    const hasReviewerFile = unsignedReviewPath && fs.existsSync(unsignedReviewPath);

    const reviewerSigned = thesis.data.reviewerSignedReviewPath;

    // Only proceed if BOTH files are available and conditions are met
    if (!isSupervisorSigned || !hasSupervisorFile || !hasReviewerFile) {
      res.status(400).json({
        error: "Both reviews are not ready for HOD signing",
        details: {
          supervisorSigned: isSupervisorSigned,
          supervisorFileExists: hasSupervisorFile,
          reviewerFileExists: hasReviewerFile,
          allConditionsMet: isSupervisorSigned && hasSupervisorFile && hasReviewerFile 
        }
      });
      return;
    }

    if (reviewerSigned) {
      res.status(400).json({ error: "Reviews already signed by Reviewer" });
      return;
    }

    // Ensure signed reviews directory exists
    const signedDir = path.join(__dirname, "../../server/reviews/reviewer/signed")
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true })
    }

    // Move uploaded files to HOD signed reviews directory
    const supervisorPath = path.join(signedDir, `signed_review1_${thesis.data.student}.pdf`);
    const reviewerPath = path.join(signedDir, `signed_review2_${thesis.data.student}.pdf`);

    fs.renameSync(files.review1[0].path, supervisorPath);
    fs.renameSync(files.review2[0].path, reviewerPath);

    
        console.log(`HOD signed reviews saved to: ${supervisorPath} and ${reviewerPath}`);

    // Update thesis with signed PDF path and status
    await thesisModel.updateThesis(thesisId, {
      status: "evaluated",
      reviewerSignedReviewPath: reviewerPath,
      reviewerSignedReview1Path: supervisorPath,
      reviewPdfReviewer: unsignedReviewPath,
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

    // Try to find both signed review files using full paths from database
    let signedReview1Path: string
    let signedReview2Path: string

    // For review1 (supervisor review)
    if (thesis.data.reviewerSignedReview1Path && fs.existsSync(thesis.data.reviewerSignedReview1Path)) {
      signedReview1Path = thesis.data.reviewerSignedReview1Path
    } else {
      signedReview1Path = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review1_${thesis.data.student}.pdf`)
    }

    // For review2 (reviewer review)
    if (thesis.data.reviewerSignedReviewPath && fs.existsSync(thesis.data.reviewerSignedReviewPath)) {
      signedReview2Path = thesis.data.reviewerSignedReviewPath
    } else {
      signedReview2Path = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`)
    }

    // Check if both files exist
    if (!fs.existsSync(signedReview1Path) || !fs.existsSync(signedReview2Path)) {
      res.status(404).json({ 
        error: "Signed reviews not found",
        details: {
          review1Exists: fs.existsSync(signedReview1Path),
          review2Exists: fs.existsSync(signedReview2Path)
        }
      })
      return
    }

    // Set headers for multipart response
    const boundary = '----SignedReviewBoundary'
    res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`)
    res.setHeader('Content-Disposition', `inline; filename="signed_reviews_${thesisId}.multipart"`)

    // Helper function to send a file part
    const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
      const fileStats = fs.statSync(filePath)

      // Part header
      res.write(`--${boundary}\r\n`)
      res.write(`Content-Type: ${contentType}\r\n`)
      res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`)
      res.write(`Content-Length: ${fileStats.size}\r\n`)
      res.write('\r\n')

      // File content
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res, { end: false })

      return new Promise<void>((resolve, reject) => {
        fileStream.on('end', () => resolve())
        fileStream.on('error', (error) => reject(error))
      })
    }

    // Send both signed reviews
    await sendFilePart(signedReview1Path, `signed_review1_${thesis.data.student}.pdf`)
    await sendFilePart(signedReview2Path, `signed_review2_${thesis.data.student}.pdf`)

    // End of multipart
    res.write(`--${boundary}--\r\n`)
    res.end()

  } catch (error) {
    console.error("Error getting signed reviews:", error)
    res.status(500).json({ error: "Failed to get signed reviews" })
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

    // Try to find both signed review files using full paths from database
    let signedReview1Path: string
    let signedReview2Path: string

    // For review1 (supervisor review)
    if (thesis.data.reviewerSignedReview1Path && fs.existsSync(thesis.data.reviewerSignedReview1Path)) {
      signedReview1Path = thesis.data.reviewerSignedReview1Path
    } else {
      signedReview1Path = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review1_${thesis.data.student}.pdf`)
    }

    // For review2 (reviewer review)
    if (thesis.data.reviewerSignedReviewPath && fs.existsSync(thesis.data.reviewerSignedReviewPath)) {
      signedReview2Path = thesis.data.reviewerSignedReviewPath
    } else {
      signedReview2Path = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${thesis.data.student}.pdf`)
    }

    // Check if both files exist
    if (!fs.existsSync(signedReview1Path) || !fs.existsSync(signedReview2Path)) {
      res.status(404).json({ 
        error: "Signed reviews not found",
        details: {
          review1Exists: fs.existsSync(signedReview1Path),
          review2Exists: fs.existsSync(signedReview2Path)
        }
      })
      return
    }

    // Set headers for multipart response with download disposition
    const boundary = '----SignedReviewBoundary'
    res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`)
    res.setHeader('Content-Disposition', `attachment; filename="signed_reviews_${thesisId}.multipart"`)

    // Helper function to send a file part
    const sendFilePart = (filePath: string, filename: string, contentType: string = 'application/pdf') => {
      const fileStats = fs.statSync(filePath)

      // Part header
      res.write(`--${boundary}\r\n`)
      res.write(`Content-Type: ${contentType}\r\n`)
      res.write(`Content-Disposition: attachment; filename="${filename}"\r\n`)
      res.write(`Content-Length: ${fileStats.size}\r\n`)
      res.write('\r\n')

      // File content
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res, { end: false })

      return new Promise<void>((resolve, reject) => {
        fileStream.on('end', () => resolve())
        fileStream.on('error', (error) => reject(error))
      })
    }

    // Send both signed reviews
    await sendFilePart(signedReview1Path, `signed_review1_${thesis.data.student}.pdf`)
    await sendFilePart(signedReview2Path, `signed_review2_${thesis.data.student}.pdf`)

    // End of multipart
    res.write(`--${boundary}--\r\n`)
    res.end()

  } catch (error) {
    console.error("Error downloading signed reviews:", error)
    res.status(500).json({ error: "Failed to download signed reviews" })
  }
}

export const signedReview = async (req: Request, res: Response) => {
  try {
    const reviewer = req.user as AuthenticatedUser & IReviewer;
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

    // Verify reviewer has access to this thesis
    if (currentThesis.data.assignedReviewer !== reviewer.id) {
      res.status(403).json({ error: "Access denied: Not your assigned thesis" });
      return;
    }

    // Check conditions for BOTH files
    const currentIteration = currentThesis.data.currentIteration;
    const currentIterationData = currentThesis.data.reviewIterations[currentIteration - 1];

    const isSupervisorSigned = currentIterationData?.supervisorReview?.status === 'signed';

    // Get paths and check existence of unsigned files
    const unsignedSupervisorPath = currentThesis.data.supervisorSignedReviewPath;
    const unsignedReviewPath = currentThesis.data.reviewPdfReviewer;

    const hasSupervisorFile = unsignedSupervisorPath && fs.existsSync(unsignedSupervisorPath);
    const hasReviewerFile = unsignedReviewPath && fs.existsSync(unsignedReviewPath);

    const reviewerSigned = currentThesis.data.reviewerSignedReviewPath;

    // Only proceed if BOTH files are available and conditions are met
    if (!isSupervisorSigned || !hasSupervisorFile || !hasReviewerFile) {
      res.status(400).json({
        error: "Both reviews are not ready for signing",
        details: {
          supervisorSigned: isSupervisorSigned,
          supervisorFileExists: hasSupervisorFile,
          reviewerFileExists: hasReviewerFile,
          allConditionsMet: isSupervisorSigned && hasSupervisorFile && hasReviewerFile 
        }
      });
      return;
    }

    if (reviewerSigned) {
      res.status(400).json({ error: "Reviews already signed by Reviewer" });
      return;
    }

    // Move signed PDFs to permanent storage - KEEPING ORIGINAL PATHS
    const supervisorSignedPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review1_${currentThesis.data.student}.pdf`);
    const reviewerSignedPath = path.join(__dirname, "../../server/reviews/reviewer/signed", `signed_review2_${currentThesis.data.student}.pdf`);

    // Ensure directory exists
    const signedDir = path.join(__dirname, "../../server/reviews/reviewer/signed");
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    fs.renameSync(files.supervisorReview[0].path, supervisorSignedPath);
    fs.renameSync(files.reviewerReview[0].path, reviewerSignedPath);

    // Update thesis with reviewer signed paths and metadata - KEEPING ORIGINAL FIELD NAMES
    const thesis = await thesisModel.updateThesis(thesisId, {
      status: "evaluated",
      reviewerSignedReviewPath: reviewerSignedPath,  
      reviewerSignedReview1Path: supervisorSignedPath, 
      reviewPdfReviewer: unsignedReviewPath,
      signedDate: new Date(),
    });

    if (!thesis) {
      res.status(404).json({ error: "Thesis not found" });
      return;
    }

    // Update student status to evaluated
    await userModel.updateStudentThesisStatus(currentThesis.data.student, "evaluated");

    res.json({ 
      success: true,
      message: "Both reviews signed successfully by Reviewer"
    });
  } catch (error) {
    console.error("Error finalizing reviewer review:", error);
    res.status(500).json({ error: "Failed to finalize reviewer review" });
  }
};

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