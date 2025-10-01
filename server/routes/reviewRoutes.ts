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
} from "../controllers/reviewController"
import { authenticate, isAdmin, isReviewer, isStudent } from "../middleware/auth"
import upload from "../utils/multer"

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
  (req, res, next) => {
    if (req.user?.role === "student") {
      isStudent(req, res, next)
    } else if (req.user?.role === "reviewer") {
      isReviewer(req, res, next)
    } else if (req.user?.role === "admin") {
      isAdmin(req, res, next)
    } else {
      res.status(403).json({ error: "Access denied" })
    }
  },
  getSignedReview,
)

// Chrome native tools upload route
reviewRouter.post(
  "/upload-signed-review/:thesisId",
  authenticate,
  isReviewer,
  upload.single("signedReview"),
  uploadSignedReview,
)

reviewRouter.post("/signed-review/:thesisId", authenticate, isReviewer, signedReview)

export default reviewRouter
