import express from "express"
import { submitReview, getAssignedTheses, getCompletedReviews, reReviewThesis, signedReview } from "../controllers/reviewController"
import { authenticate, isReviewer } from "../middleware/auth"
import fs from "fs"
import path from "path"
import multer from "multer"


const reviewRouter = express.Router()

// Ensure upload directory exists
const uploadDir = "reviews/signed/"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

// File filter for PDF only
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type, only PDF is allowed!"), false)
  }
}

// Configure Multer with file size limit
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
})



// Reviewer-only routes
reviewRouter.get("/assigned-theses", authenticate, isReviewer, getAssignedTheses)
reviewRouter.get("/completed-theses", authenticate, isReviewer, getCompletedReviews)
reviewRouter.post("/submit-review/:thesisId", authenticate, isReviewer, submitReview)
reviewRouter.post("/re-review/:thesisId", authenticate, isReviewer, reReviewThesis)

// signed review file
reviewRouter.post("/signed-review/:thesisId", authenticate, isReviewer, upload.single("thesisFile"), signedReview) //RECEIVE SIGNED PDF FROM CLIENT

// download review file (MAY NOT BE REQUIRED - WILL SEE)
reviewRouter.get("/download-review/:filename", (req, res) => {
  const filePath = path.join(__dirname, "../../reviews", req.params.filename)

  if (fs.existsSync(filePath)) {
    res.download(filePath)
  } else {
    res.status(404).json({ error: "File not found" })
  }
})

export default reviewRouter
