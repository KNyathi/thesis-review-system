import type { Request, Response } from "express"
import { type IThesis, ThesisModel } from "../models/Thesis.model"
import { UserModel, type IStudent, type IConsultant } from "../models/User.model"
import path from "path"
import fs from "fs"
import { Pool } from "pg"
import { generateConsultantReviewPDF } from "../utils/pdfGeneratorConsultant"
import { i18n } from "../utils/i18n"
import { Student } from "../models/User.model"

const pool = new Pool({
  connectionString: process.env.DB_URL,
})

const thesisModel = new ThesisModel(pool)
const userModel = new UserModel(pool)

// Define authenticated user type
interface AuthenticatedUser {
  id: string
  role: string
  email: string
}

export const submitReview = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant
    const { thesisId } = req.params
    const { comments, assessment, isFinalApproval } = req.body

    console.log(" Consultant submitting review:", {
      thesisId,
      isFinalApproval,
      hasComments: !!comments,
      hasAssessment: !!assessment,
    })

    // Find the thesis first
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: i18n.errors.thesisNotFound })
      return
    }

    // Verify consultant is assigned to this thesis
    if (thesis.data.assignedConsultant !== consultant.id) {
      res.status(403).json({ error: i18n.errors.notAuthorized })
      return
    }

    if (!comments || comments.trim().length === 0) {
      res.status(400).json({ error: "Пожалуйста, укажите комментарии" })
      return
    }

    let updatedThesis
    let pdfPath = null

    // CASE 1: Request Revisions (only comments, no assessment)
    if (!isFinalApproval) {
      console.log("Submitting revisions request")

      updatedThesis = await thesisModel.submitConsultantReview(thesisId, comments, "revisions_requested", false)

      if (!updatedThesis) {
        res.status(404).json({ error: i18n.errors.thesisNotFound })
        return
      }

      // Update consultant stats
      await thesisModel.updateConsultantStats(consultant.id, thesisId, false)

      try {
        await userModel.updateStudentThesisFeedback(
          thesis.data.student,
          {
            comments: comments,
            lastReviewDate: new Date(),
            reviewIteration: thesis.data.currentIteration,
            status: "revisions_requested",
          },
          thesis.data.currentIteration,
        )
      } catch (studentUpdateError) {
        console.error("Error updating student feedback:", studentUpdateError)
        // Don't fail the request, but log the error
      }

      console.log("Revisions request submitted successfully")

      res.json({
        message: i18n.success.revisionsRequested,
        redirectToSign: false,
        thesisId: thesisId,
        status: "revisions_requested",
      })

      return
    }

  // CASE 2: Final Approval (with assessment and comments)
  if (isFinalApproval && assessment && assessment.trim().length > 0) {
      console.log("Submitting final approval with assessment")

      const student = await Student.findById(userModel, thesis.data.student)
      if (!student) {
          res.status(404).json({ error: "Student not found" })
          return
      }

      if (!(student as IStudent).thesisContent) {
          res.status(400).json({
              error: "Cannot proceed: Student has not submitted thesis structure/content",
              requiredAction: "await_student_submission",
          })
          return
      }

      // Создаём структуру consultantAssessment для PDF генератора
      let assessmentStructure;
      if (typeof assessment === 'string' && assessment.trim().length > 0) {
          // Если пришла строка с заключением, создаём структуру с оценками по умолчанию (5)
          assessmentStructure = {
              section1: {
                  topicCorrespondence: 5,
                  relevanceJustification: 5,
                  subjectAreaCorrespondence: 5,
                  researchMethodsCorrectness: 5,
                  materialPresentation: 5,
                  assertionsJustification: 5,
                  researchValue: 5,
                  researchFindingsIntegration: 5
              },
              section2: {
                  questions: [],
                  advantages: [],
                  disadvantages: []
              }
          };
      } else if (assessment && typeof assessment === 'object') {
          // Если пришёл объект (полная структура), используем его
          assessmentStructure = assessment;
      } else {
          // Значения по умолчанию, если ничего не пришло
          assessmentStructure = {
              section1: {
                  topicCorrespondence: 5,
                  relevanceJustification: 5,
                  subjectAreaCorrespondence: 5,
                  researchMethodsCorrectness: 5,
                  materialPresentation: 5,
                  assertionsJustification: 5,
                  researchValue: 5,
                  researchFindingsIntegration: 5
              },
              section2: {
                  questions: [],
                  advantages: [],
                  disadvantages: []
              }
          };
      }

      // Update the thesis with assessment first
      updatedThesis = await thesisModel.updateThesis(thesisId, {
          consultantAssessment: assessmentStructure,
      })

      if (!updatedThesis) {
          res.status(404).json({ error: i18n.errors.thesisNotFound })
          return
      }

      // Submit the consultant review with final approval
      updatedThesis = await thesisModel.submitConsultantReview(thesisId, comments, "approved", true)

      // Generate unsigned PDF for consultant review
      const unsignedDir = path.join(__dirname, "../../server/reviews/consultant/unsigned")
      if (!fs.existsSync(unsignedDir)) {
          fs.mkdirSync(unsignedDir, { recursive: true })
      }

      try {
          pdfPath = await generateConsultantReviewPDF(updatedThesis.data, consultant, false)
      } catch (pdfError) {
          console.error("PDF generation error:", pdfError)
          res.status(500).json({
              error: `Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`,
              details: pdfError,
          })
          return
      }

      // Update thesis with PDF path and status
      await thesisModel.updateThesis(thesisId, {
          ...(pdfPath ? { reviewPdfConsultant: pdfPath } : {}),
          status: thesis.data.assignedSupervisor ? "with_supervisor" : "under_review",
      })

      try {
        await userModel.updateStudentThesisFeedback(
          thesis.data.student,
          {
            comments: "Дипломная работа одобрена консультантом",
            lastReviewDate: new Date(),
            reviewIteration: thesis.data.currentIteration,
            status: "approved",
          },
          thesis.data.currentIteration,
        )
      } catch (studentUpdateError) {
        console.error("Error updating student feedback:", studentUpdateError)
        // Don't fail the request, but log the error
      }

      // Update consultant stats and tracking
      await thesisModel.updateConsultantStats(consultant.id, thesisId, true)
      await userModel.removeThesisFromConsultant(consultant.id, thesisId)
      await userModel.addThesisToConsultantReviewed(consultant.id, thesisId)

      console.log("Final approval submitted successfully")

      res.json({
        message: i18n.success.reviewApproved,
        redirectToSign: true,
        thesisId: thesisId,
        pdfPath: pdfPath,
        status: "approved",
      })
      return
    }

    // If we get here, the request is invalid
    res.status(400).json({
      error: i18n.errors.invalidRequest,
    })
    return
  } catch (error) {
    console.error("Error in submitConsultantReview:", error)
    res.status(500).json({ error: i18n.errors.failedToSubmitReview })
  }
}

export const getAssignedTheses = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant

    // Exclude theses with revisions_requested or approved status
    const assignedTheses = await thesisModel.getThesesByConsultant(consultant.id)

    // Показываем работы со статусом:
    // - "with_consultant" (ожидают проверки консультанта)
    // - "awaiting_consultant_signature" (ожидают подписи консультанта)
    const activeTheses = assignedTheses.filter((thesis) => {
      const status = thesis.data.status
      return status === "with_consultant" || status === "awaiting_consultant_signature"
    })

    // Fetch student details for each thesis
    const thesesWithStudents = await Promise.all(
      activeTheses.map(async (thesis) => {
        const student = await userModel.getUserById(thesis.data.student)
        return {
          ...thesis.data,
          id: thesis.id,
          createdAt: thesis.created_at,
          updatedAt: thesis.updated_at,
          student: student
            ? {
                id: student.id,
                fullName: student.fullName,
                email: student.email,
                institution: student.institution,
              }
            : null,
        }
      }),
    )

    res.json(thesesWithStudents)
  } catch (error) {
    console.error("Error in getAssignedTheses:", error)
    res.status(500).json({ error: i18n.errors.failedToFetchTheses })
  }
}

export const getCompletedReviews = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant

    // Get all theses assigned to this consultant
    const assignedTheses = await thesisModel.getThesesByConsultant(consultant.id)

    // These are the "completed" reviews awaiting signing or awaiting student fixes
    const completedReviews = assignedTheses.filter((thesis) => {
      const thesisData = thesis.data

      // Берем последнюю итерацию
      const lastIteration = thesisData.reviewIterations[thesisData.reviewIterations.length - 1]

      if (!lastIteration) return false

      // Консультантское ревью
      const consultantStatus = lastIteration.consultantReview?.status

      return consultantStatus === "approved" || consultantStatus === "revisions_requested"
    })

    // Fetch student details for each completed review
    const reviewsWithStudents = await Promise.all(
      completedReviews.map(async (thesis) => {
        const thesisData = thesis.data
        const student = await userModel.getUserById(thesisData.student)

        return {
          id: thesis.id,
          title: thesisData.title,
          submissionDate: thesisData.submissionDate,
          finalGrade: thesisData.finalGrade,
          status: thesisData.status,
          consultantAssessment: thesisData.consultantAssessment,
          approvedAt: new Date(),
          createdAt: thesis.created_at,
          updatedAt: thesis.updated_at,
          student: student
            ? {
                id: student.id,
                fullName: student.fullName,
                email: student.email,
                institution: student.institution,
                faculty: (student as IStudent).faculty,
                group: (student as IStudent).group,
                subjectArea: (student as IStudent).subjectArea,
              }
            : null,
        }
      }),
    )

    // Sort by update date (most recent first)
    reviewsWithStudents.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())

    res.json(reviewsWithStudents)
  } catch (error) {
    console.error("Error in getCompletedReviews:", error)
    res.status(500).json({ error: i18n.errors.failedToFetchReviews })
  }
}

export const reReviewThesis = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant
    const { thesisId } = req.params

    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: i18n.errors.thesisNotFound })
      return
    }

    if (thesis.data.assignedConsultant !== consultant.id) {
      res.status(403).json({ error: i18n.errors.accessDenied })
      return
    }

    // Delete consultant review files if they exist
    if (thesis.data.reviewPdfConsultant && fs.existsSync(thesis.data.reviewPdfConsultant)) {
      fs.unlinkSync(thesis.data.reviewPdfConsultant)
    }

    // Reset thesis review data but keep the current iteration and review history
    const updatedThesisData: Partial<IThesis> = {
      status: "with_consultant",
      consultantAssessment: undefined,
      reviewPdfConsultant: undefined,
      reviewIterations: thesis.data.reviewIterations.map((iteration) => ({
        iteration: iteration.iteration,
        status: "under_review",
        consultantReview: undefined,
        supervisorReview: undefined,
        studentResubmissionDate: undefined,
      })),
    }

    await thesisModel.updateThesis(thesisId, updatedThesisData)
    await userModel.addThesisToConsultant(consultant.id, thesisId)

    // Update student status and clear previous consultant feedback
    await userModel.updateStudentThesisStatus(thesis.data.student, "with_consultant")

    // Clear the student's consultant feedback
    await userModel.updateStudentThesisFeedback(
      thesis.data.student,
      {
        comments: "",
        lastReviewDate: new Date(),
        reviewIteration: thesis.data.currentIteration,
        status: "pending",
      },
      thesis.data.currentIteration,
    )

    // Delete signed review file if it exists
    const signedReviewPath = path.join(
      __dirname,
      "../../server/reviews/signed",
      `signed_review1_${thesis.data.student}.pdf`,
    )
    if (fs.existsSync(signedReviewPath)) {
      fs.unlinkSync(signedReviewPath)
    }

    // Delete unsigned review file if it exists
    if (thesis.data.reviewPdfConsultant && fs.existsSync(thesis.data.reviewPdfConsultant)) {
      fs.unlinkSync(thesis.data.reviewPdfConsultant)
    }

    res.json({ message: i18n.success.rereviewStarted })
  } catch (error) {
    console.error("Error in reReviewThesis:", error)
    res.status(500).json({ error: i18n.errors.failedToReview })
  }
}

export const getUnsignedReview = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant
    const { thesisId } = req.params

    // Find thesis and check access
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: i18n.errors.thesisNotFound })
      return
    }

    // Check if consultant has access
    if (thesis.data.assignedConsultant !== consultant.id) {
      res.status(403).json({ error: i18n.errors.accessDenied })
      return
    }

    if (!thesis.data.reviewPdfConsultant) {
      res.status(404).json({ error: i18n.errors.unsignedReviewNotFound })
      return
    }

    // Use full path from database
    const unsignedReviewPath = thesis.data.reviewPdfConsultant

    if (!fs.existsSync(unsignedReviewPath)) {
      res.status(404).json({ error: i18n.errors.unsignedReviewFileNotFound })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="unsigned_review1_${thesis.data.student}.pdf"`)

    const fileStream = fs.createReadStream(unsignedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming unsigned review:", error)
      res.status(500).json({ error: i18n.errors.failedToStreamReview })
    })
  } catch (error) {
    console.error("Error getting unsigned review:", error)
    res.status(500).json({ error: i18n.errors.failedToStreamReview })
  }
}

export const uploadSignedReview = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant;
    const { thesisId } = req.params;
    const { file } = req;

    console.log("Consultant uploading signed review:", { thesisId, hasFile: !!file });

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const thesis = await thesisModel.getThesisById(thesisId);
    if (!thesis || thesis.data.assignedConsultant !== consultant.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    if (thesis.data.status !== "awaiting_consultant_signature") {
      res.status(400).json({ error: "Not awaiting consultant signature" });
      return;
    }

    // Сохраняем подписанный консультантом PDF в отдельную папку
    const consultantSignedDir = path.join(__dirname, "../../server/reviews/consultant/signed");
    if (!fs.existsSync(consultantSignedDir)) fs.mkdirSync(consultantSignedDir, { recursive: true });
    
    const fileName = `consultant_signed_${thesis.data.student}.pdf`;
    const consultantSignedPath = path.join(consultantSignedDir, fileName);
    fs.renameSync(file.path, consultantSignedPath);

    // Обновляем статус на ожидание финальной подписи руководителя
    await thesisModel.updateThesis(thesisId, {
      status: "awaiting_supervisor_signature",
      consultantSignedReviewPath: consultantSignedPath
    });

    res.json({ 
      message: "Consultant signed review uploaded successfully", 
      success: true 
    });
  } catch (error) {
    console.error("Error uploading consultant signed review:", error);
    res.status(500).json({ error: "Failed to upload signed review" });
  }
};

export const getSignedReview = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser
    const { thesisId } = req.params

    // Find thesis
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: i18n.errors.thesisNotFound })
      return
    }

    let signedReviewPath: string

    if (
      user.role === "consultant" &&
      thesis.data.assignedConsultant === user.id &&
      thesis.data.consultantSignedReviewPath &&
      fs.existsSync(thesis.data.consultantSignedReviewPath)
    ) {
      signedReviewPath = thesis.data.consultantSignedReviewPath
    } else if (user.role === "supervisor" && thesis.data.assignedSupervisor === user.id) {
      signedReviewPath = path.join(
        __dirname,
        "../../server/reviews/supervisor/signed",
        `signed_review1_${thesis.data.student}.pdf`,
      )
    } else {
      signedReviewPath = path.join(
        __dirname,
        "../../server/reviews/supervisor/signed",
        `signed_review1_${thesis.data.student}.pdf`,
      )
    }

    if (!fs.existsSync(signedReviewPath)) {
      res.status(404).json({ error: i18n.errors.signedReviewNotFound })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="signed_review1_${thesis.data.student}.pdf"`)

    const fileStream = fs.createReadStream(signedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error streaming signed review:", error)
      res.status(500).json({ error: i18n.errors.failedToStreamReview })
    })
  } catch (error) {
    console.error("Error getting signed review:", error)
    res.status(500).json({ error: i18n.errors.failedToDownloadReview })
  }
}

export const downloadSignedReview = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser
    const { thesisId } = req.params

    // Find thesis
    const thesis = await thesisModel.getThesisById(thesisId)
    if (!thesis) {
      res.status(404).json({ error: i18n.errors.thesisNotFound })
      return
    }

    let signedReviewPath: string

    if (thesis.data.consultantSignedReviewPath && fs.existsSync(thesis.data.consultantSignedReviewPath)) {
      signedReviewPath = thesis.data.consultantSignedReviewPath
    } else {
      signedReviewPath = path.join(
        __dirname,
        "../../server/reviews/consultant/signed",
        `signed_review1_${thesis.data.student}.pdf`,
      )
    }

    if (!fs.existsSync(signedReviewPath)) {
      res.status(404).json({ error: i18n.errors.signedReviewNotFound })
      return
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="signed_review1_${thesis.data.student}.pdf"`)

    const fileStream = fs.createReadStream(signedReviewPath)
    fileStream.pipe(res)

    fileStream.on("error", (error) => {
      console.error("Error downloading signed review:", error)
      res.status(500).json({ error: i18n.errors.failedToDownloadReview })
    })
  } catch (error) {
    console.error("Error downloading signed review:", error)
    res.status(500).json({ error: i18n.errors.failedToDownloadReview })
  }
}

export const signedReview = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant
    const { thesisId } = req.params
    const { file } = req

    if (!file) {
      res.status(400).json({ error: i18n.errors.fileNotAvailable })
      return
    }

    // Update the thesis status to evaluated
    const thesis = await thesisModel.updateThesis(thesisId, {
      status: "with_supervisor",
    })

    if (!thesis) {
      res.status(404).json({ error: i18n.errors.thesisNotFound })
      return
    }

    // Move signed PDF to permanent storage
    const signedPath = path.join(
      __dirname,
      "../../server/reviews/consultant/signed",
      `signed_review1_${thesis.data.student}.pdf`,
    )
    fs.renameSync(file.path, signedPath)

    console.log(`Signed review saved to: ${signedPath}`)

    // Update student's status
    await userModel.updateStudentThesisStatus(thesis.data.student, "with_supervisor")

    res.json({ success: true })
  } catch (error) {
    console.error(" Error finalizing review:", error)
    res.status(500).json({ error: i18n.errors.failedToFinalizeReview })
  }
}

// New method to get reviewer's assigned and reviewed thesis counts
export const getReviewerStats = async (req: Request, res: Response) => {
  try {
    const consultant = req.user as AuthenticatedUser & IConsultant

    const assignedTheses = await thesisModel.getThesesByConsultant(consultant.id)
    const allTheses = await thesisModel.find()
    const reviewedTheses = allTheses.filter(
      (thesis) => thesis.data.status === "evaluated" && thesis.data.assignedConsultant === consultant.id,
    )

    res.json({
      assignedCount: assignedTheses.length,
      reviewedCount: reviewedTheses.length,
      totalCount: assignedTheses.length + reviewedTheses.length,
    })
  } catch (error) {
    console.error("Error fetching reviewer stats:", error)
    res.status(500).json({ error: i18n.errors.failedToFetchStats })
  }
}
