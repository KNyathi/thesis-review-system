import express from 'express';
import upload from "../utils/multer"
import { authenticate, isConsultantReview, isSupervisor } from '../middleware/auth';
import { approveThesisTopic, downloadSignedReview, getAssignedTheses, getCompletedReviews, getPendingApprovals, getSignedReview, getUnsignedReview, proposeThesisTopic, reReviewThesis, signedReview, submitReview, uploadSignedReview } from '../controllers/supervisorController';

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
supervisorRouter.get("/unsigned-review-supervisor/:thesisId", authenticate, isSupervisor, getUnsignedReview)
supervisorRouter.get(
    "/signed-review-supervisor/:thesisId",
    authenticate,
    isConsultantReview,
    getSignedReview,
)

// Chrome native tools upload route
supervisorRouter.post(
    "/upload-signed-review-supervisor/:thesisId",
    authenticate,
    isSupervisor,
    upload.single("signedReview"),
    uploadSignedReview,
)

supervisorRouter.post("/signed-review-supervisor/:thesisId", authenticate, isSupervisor, signedReview)

supervisorRouter.get("/download-signed-review-supervisor/:thesisId", authenticate,  isConsultantReview, downloadSignedReview)

export default supervisorRouter;