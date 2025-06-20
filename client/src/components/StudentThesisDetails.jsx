import { useState } from "react"
import { FiDownload, FiEye, FiUser, FiCalendar, FiFileText, FiStar, FiAlertCircle } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"
import ReviewerAssessment from "./ReviewerAssessment"

const StudentThesisDetails = ({ thesis, onClose }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  // Early return if no thesis
  if (!thesis) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Thesis Found</h3>
          <p className="text-gray-400 mb-4">You haven't submitted a thesis yet.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const handleDownload = async () => {
    try {
      setIsLoading(true)
      const blob = await thesisAPI.downloadThesis(thesis._id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${thesis.title || "thesis"}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showToast("Download started", "success")
    } catch (error) {
      showToast("Failed to download thesis", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewPDF = async () => {
    try {
      setIsLoading(true)
      const blob = await thesisAPI.viewThesis(thesis._id)
      const blobUrl = URL.createObjectURL(blob)

      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Thesis Viewer</title>
              <style>
                body { margin: 0; overflow: hidden; }
                iframe { width: 100vw; height: 100vh; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${blobUrl}"></iframe>
            </body>
          </html>
        `)
        newWindow.document.close()
        newWindow.focus()
      } else {
        showToast("Popup blocked - please allow popups", "warning")
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch (error) {
      showToast("Failed to open thesis", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "submitted":
        return "bg-blue-600"
      case "assigned":
        return "bg-yellow-600"
      case "evaluated":
        return "bg-green-600"
      default:
        return "bg-gray-600"
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case "submitted":
        return "Submitted - Waiting for Assignment"
      case "assigned":
        return "Assigned to Reviewer"
      case "evaluated":
        return "Evaluated"
      default:
        return "Unknown Status"
    }
  }

  const formatGrade = (grade) => {
    if (!grade) return "Not graded yet"
    return grade
  }

  if (showReview && thesis.status === "evaluated") {
    return (
      <div className="h-full">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowReview(false)} className="text-gray-400 hover:text-white transition-colors">
            ← Back to Details
          </button>
        </div>
        <ReviewerAssessment
          thesisId={thesis._id}
          student={{ fullName: "Current Student", institution: "Current Institution" }}
          mode="view"
          onClose={() => setShowReview(false)}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Toast {...toast} onClose={hideToast} />

      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6 flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-4">{thesis.title || "Untitled Thesis"}</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusColor(thesis.status)}`}>
                {getStatusText(thesis.status)}
              </div>
              {thesis.status === "evaluated" && (
                <div className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                  Grade: {formatGrade(thesis.finalGrade)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 text-gray-400">
              <div className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4" />
                <span className="text-sm">
                  Submitted: {thesis.submissionDate ? new Date(thesis.submissionDate).toLocaleDateString() : "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FiFileText className="w-4 h-4" />
                <span className="text-sm">PDF Document</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiDownload className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleViewPDF}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiEye className="w-4 h-4" />
              View PDF
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Thesis Information */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Thesis Information</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Title</label>
              <p className="text-white">{thesis.title || "Untitled Thesis"}</p>
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Status</label>
              <p className="text-white">{getStatusText(thesis.status)}</p>
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Submission Date</label>
              <p className="text-white">
                {thesis.submissionDate ? new Date(thesis.submissionDate).toLocaleDateString() : "Unknown"}
              </p>
            </div>
            {thesis.status === "evaluated" && (
              <div>
                <label className="block text-gray-300 text-sm mb-1">Final Grade</label>
                <p className="text-white font-medium">{formatGrade(thesis.finalGrade)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Review Information */}
        {thesis.status === "assigned" && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <FiUser className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Review in Progress</h3>
            </div>
            <p className="text-gray-300">
              Your thesis has been assigned to a reviewer and is currently being evaluated. You will be notified once
              the review is complete.
            </p>
          </div>
        )}

        {thesis.status === "evaluated" && (
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FiStar className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Review Completed</h3>
              </div>
              <button
                onClick={() => setShowReview(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                View Review Details
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-gray-300">Your thesis has been successfully reviewed and evaluated.</p>
              <p className="text-white font-medium">Final Grade: {formatGrade(thesis.finalGrade)}</p>
            </div>
          </div>
        )}

        {thesis.status === "submitted" && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <FiCalendar className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">Waiting for Assignment</h3>
            </div>
            <p className="text-gray-300">
              Your thesis has been submitted successfully and is waiting to be assigned to a reviewer. This process
              typically takes 1-3 business days.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentThesisDetails
