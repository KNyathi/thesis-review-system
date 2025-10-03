import express from "express"

import { authenticate, isAdmin, isConsultant, isConsultantReview, isReviewer, isStudent } from "../middleware/auth"
import upload from "../utils/multer"
import { getAssignedTheses, getCompletedReviews, getSignedReview, getUnsignedReview, reReviewThesis, signedReview, submitReview, uploadSignedReview } from "../controllers/consultantController"


const consultantRouter = express.Router()

// Reviewer routes
consultantRouter.get("/assigned-theses-consultant", authenticate, isConsultant, getAssignedTheses) //complete
consultantRouter.get("/completed-theses-consultant", authenticate, isConsultant, getCompletedReviews) //in progress
consultantRouter.post("/submit-review-consultant/:thesisId", authenticate, isConsultant, submitReview) //working on it
consultantRouter.post("/re-review-consultant/:thesisId", authenticate, isConsultant, reReviewThesis)

// Review signing routes
consultantRouter.get("/unsigned-review-consultant/:thesisId", authenticate, isConsultant, getUnsignedReview)
consultantRouter.get(
    "/signed-review-consultant/:thesisId",
    authenticate,
    isConsultantReview,
    getSignedReview,
)

// Chrome native tools upload route
consultantRouter.post(
    "/upload-signed-review-consultant/:thesisId",
    authenticate,
    isConsultant,
    upload.single("signedReview"),
    uploadSignedReview,
)

consultantRouter.post("/signed-review-consultant/:thesisId", authenticate, isConsultant, signedReview)

export default consultantRouter
