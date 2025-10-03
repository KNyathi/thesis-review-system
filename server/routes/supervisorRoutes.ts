import express from 'express';
import upload from "../utils/multer"
import { authenticate, isConsultantReview, isSupervisor } from '../middleware/auth';
import { approveThesisTopic, getAssignedTheses, getCompletedReviews, getPendingApprovals, getSignedReview, getUnsignedReview, reReviewThesis, signedReview, submitReview, uploadSignedReview } from '../controllers/supervisorController';

const supervisorRouter = express.Router();

// Routes for team assignment - using management role group
supervisorRouter.put('/:studentId/approve-topic', authenticate, isSupervisor, approveThesisTopic); //completed

// Supervisor gets pending approvals
supervisorRouter.get('/pending-approvals', authenticate, isSupervisor, getPendingApprovals);

// Reviewer routes
supervisorRouter.get("/assigned-theses-consultant", authenticate, isSupervisor, getAssignedTheses) 
supervisorRouter.get("/completed-theses-consultant", authenticate, isSupervisor, getCompletedReviews) 
supervisorRouter.post("/submit-review-consultant/:thesisId", authenticate, isSupervisor, submitReview) 
supervisorRouter.post("/re-review-consultant/:thesisId", authenticate, isSupervisor, reReviewThesis)

// Review signing routes
supervisorRouter.get("/unsigned-review-consultant/:thesisId", authenticate, isSupervisor, getUnsignedReview)
supervisorRouter.get(
    "/signed-review-consultant/:thesisId",
    authenticate,
    isConsultantReview,
    getSignedReview,
)

// Chrome native tools upload route
supervisorRouter.post(
    "/upload-signed-review-consultant/:thesisId",
    authenticate,
    isSupervisor,
    upload.single("signedReview"),
    uploadSignedReview,
)

supervisorRouter.post("/signed-review-consultant/:thesisId", authenticate, isSupervisor, signedReview)


export default supervisorRouter;