import multer from "multer"
import fs from "fs"

// Ensure upload directory exists
const uploadDir = "uploads/theses/"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${req?.user?.id}`)
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

export default upload
