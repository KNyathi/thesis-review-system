import express from "express"
import {
  submitReview,
  getAssignedTheses,
  getCompletedReviews,
  reReviewThesis,
  getUnsignedReview,
  getSignedReview,
  uploadSignedReview,
  signedReview,
  downloadSignedReview,
} from "../controllers/reviewController"
import { authenticate, isAdmin, isReviewer, isReviewerReview, isStudent } from "../middleware/auth"
import upload from "../utils/multer"
import { hodUpload } from "../utils/multerMultiple"

const reviewRouter = express.Router()

// Reviewer routes
reviewRouter.get("/assigned-theses", authenticate, isReviewer, getAssignedTheses)
reviewRouter.get("/completed-theses", authenticate, isReviewer, getCompletedReviews)
reviewRouter.post("/submit-review/:thesisId", authenticate, isReviewer, submitReview)
reviewRouter.post("/re-review/:thesisId", authenticate, isReviewer, reReviewThesis)

// Review signing routes
reviewRouter.get("/unsigned-review/:thesisId", authenticate, isReviewer, getUnsignedReview)
reviewRouter.get(
  "/signed-review/:thesisId",
  authenticate,
  isReviewerReview,
  getSignedReview,
)

// Chrome native tools upload route
reviewRouter.post(
  "/upload-signed-review/:thesisId",
  authenticate,
  isReviewer,
  hodUpload.fields([
    { name: "review1", maxCount: 1 },
    { name: "review2", maxCount: 1 }
  ]),
  uploadSignedReview,
)

reviewRouter.post("/signed-review/:thesisId", authenticate, isReviewer, hodUpload.fields([
  { name: "review1", maxCount: 1 },
  { name: "review2", maxCount: 1 }
]), signedReview)

reviewRouter.get("/download-signed-review/:thesisId", authenticate, isReviewerReview, downloadSignedReview)

export default reviewRouter
