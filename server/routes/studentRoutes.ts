// routes/studentRouter.ts
import express from 'express';
import upload from "../utils/multer"
import { authenticate, isFinalReview, isStudent } from '../middleware/auth';
import { downloadReviewerUnSignedReview, downloadSignedReview, downloadSupervisorUnSignedReview, getMyTopicStatus, getReviewerUnSignedReview, getSignedReview, getSupervisorUnSignedReview, respondToProposedTopic, studentSignedReviewReviewer, studentSignedReviewSupervisor, uploadStudentSignedReviewReviewer, uploadStudentSignedReviewSupervisor } from '../controllers/studentController';

const studentRouter = express.Router();

// Student gets their topic status
studentRouter.get('/topic-status', authenticate, isStudent, getMyTopicStatus);
studentRouter.put('/approve-topic-student', authenticate, isStudent, respondToProposedTopic);

studentRouter.get(
  "/signed-review-final/:thesisId",
  authenticate,
  isFinalReview,
  getSignedReview,
);

studentRouter.get(
  "/unsigned-review-supervisor/:thesisId",
  authenticate,
  isStudent,
  getSupervisorUnSignedReview,
);

studentRouter.get(
  "/unsigned-review-reviewer/:thesisId",
  authenticate,
  isStudent,
  getReviewerUnSignedReview,
)

studentRouter.get("/download-signed-review-final/:thesisId", authenticate, isFinalReview, downloadSignedReview)
studentRouter.get("/download-unsigned-review-supervisor/:thesisId", authenticate, isStudent, downloadSupervisorUnSignedReview)
studentRouter.get("/download-unsigned-review-reviewer/:thesisId", authenticate, isStudent, downloadReviewerUnSignedReview)

// Chrome native tools upload route
studentRouter.post(
    "/upload-signed--student-review-supervisor/:thesisId",
    authenticate,
    isStudent,
    upload.single("signedStudentReviewSupervisor"),
    uploadStudentSignedReviewSupervisor,
)

studentRouter.post(
    "/upload-signed--student-review-reviewer/:thesisId",
    authenticate,
    isStudent,
    upload.single("signedStudentReviewReviewer"),
    uploadStudentSignedReviewReviewer,
)

studentRouter.post("/signed-student-review-supervisor/:thesisId", authenticate, isStudent, studentSignedReviewSupervisor)
studentRouter.post("/signed-student-review-reviewer/:thesisId", authenticate, isStudent, studentSignedReviewReviewer)


export default studentRouter;