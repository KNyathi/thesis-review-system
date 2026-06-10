import express from 'express';
import upload from "../utils/multer"
import { authenticate, isConsultantReview, isSupervisor } from '../middleware/auth';
import { approveThesisTopic, downloadSignedReview, downloadThesis, getAssignedTheses, getCompletedReviews, getPendingApprovals, getSignedReview, getUnsignedReview, getUnsignedSupervisorReview, proposeThesisTopic, reReviewThesis, signedReview, submitReview, uploadSignedReview, viewThesis, getMyStudents, uploadFinalSupervisorSignedReview } from '../controllers/supervisorController';

const supervisorRouter = express.Router();

// Routes for team assignment - using management role group
supervisorRouter.put('/:studentId/approve-topic-supervisor', authenticate, isSupervisor, approveThesisTopic); //completed
supervisorRouter.put('/:studentId/propose-topic-supervisor', authenticate, isSupervisor, proposeThesisTopic);

// Supervisor gets pending approvals
supervisorRouter.get('/pending-approvals', authenticate, isSupervisor, getPendingApprovals);

// Reviewer routes
supervisorRouter.get("/assigned-theses-supervisor", authenticate, isSupervisor, getAssignedTheses) 
supervisorRouter.get("/completed-theses-supervisor", authenticate, isSupervisor, getCompletedReviews) 
supervisorRouter.post("/submit-review-supervisor/:thesisId", authenticate, isSupervisor, submitReview) 
supervisorRouter.post("/re-review-supervisor/:thesisId", authenticate, isSupervisor, reReviewThesis)

// Review signing routes
supervisorRouter.get(
  "/unsigned-review-supervisor/:thesisId",
  authenticate,
  isSupervisor,  
  getUnsignedReview
);

// Chrome native tools upload route
supervisorRouter.post(
    "/upload-signed-review-supervisor/:thesisId",
    authenticate,
    isSupervisor,
    upload.single("signedReview"),
    uploadSignedReview,
)

supervisorRouter.get(
  "/get-student-signed/:thesisId",
  authenticate,
  isSupervisor,
  getUnsignedSupervisorReview
);

supervisorRouter.post(
  "/upload-final-signed-review/:thesisId",
  authenticate,
  isSupervisor,
  upload.single("finalSignedReview"),
  uploadFinalSupervisorSignedReview
);

supervisorRouter.post("/signed-review-supervisor/:thesisId", authenticate, isSupervisor, signedReview)

supervisorRouter.get("/download-signed-review-supervisor/:thesisId", authenticate,  isConsultantReview, downloadSignedReview)

// Download route (reviewer/admin)
supervisorRouter.get(
  "/thesis-supervisor/:id/download",
  authenticate,
  isSupervisor,
  downloadThesis,
) //complete

supervisorRouter.get("/view-pdf-supervisor/:id", authenticate, isSupervisor, viewThesis) //complete

supervisorRouter.get('/my-students', authenticate, isSupervisor, getMyStudents);

// Загрузка финальной подписанной рецензии руководителем
supervisorRouter.post(
  "/upload-final-signed-review/:thesisId",
  authenticate,
  isSupervisor,
  upload.single("finalSignedReview"),
  uploadFinalSupervisorSignedReview
);

export default supervisorRouter;