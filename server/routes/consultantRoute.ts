import express from "express"

import { authenticate, isAdmin, isConsultant, isConsultantReview, isReviewer, isStudent } from "../middleware/auth"
import upload from "../utils/multer"
import { downloadSignedReview, getAssignedTheses, getCompletedReviews, getSignedReview, getUnsignedReview, reReviewThesis, signedReview, submitReview, uploadSignedReview } from "../controllers/consultantController"


const consultantRouter = express.Router()

// Reviewer routes
consultantRouter.get("/assigned-theses-consultant", authenticate, isConsultant, getAssignedTheses) //complete
consultantRouter.get("/completed-theses-consultant", authenticate, isConsultant, getCompletedReviews) //complete
consultantRouter.post("/submit-review-consultant/:thesisId", authenticate, isConsultant, submitReview) //complete
consultantRouter.post("/re-review-consultant/:thesisId", authenticate, isConsultant, reReviewThesis) //complete

// Review signing routes
consultantRouter.get("/unsigned-review-consultant/:thesisId", authenticate, isConsultant, getUnsignedReview) //complete
consultantRouter.get(
    "/signed-review-consultant/:thesisId",
    authenticate,
    isConsultantReview,
    getSignedReview,
) //must be complete

// Chrome native tools upload route
consultantRouter.post(
    "/upload-signed-review-consultant/:thesisId",
    authenticate,
    isConsultant,
    upload.single("signedReview"),
    uploadSignedReview,
) //must be complete

consultantRouter.post("/signed-review-consultant/:thesisId", authenticate, isConsultant, signedReview) //must be complete

consultantRouter.get("/download-signed-review-consultant/:thesisId", authenticate, isConsultantReview, downloadSignedReview) //must be complete

export default consultantRouter
