import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiUpload,
  FiFile,
  FiCheck,
  FiClock,
  FiUser,
  FiDownload,
  FiRefreshCw,
  FiLogOut,
  FiAlertCircle,
  FiEye,
  FiEdit,
  FiSend,
  FiBook,
  FiUsers,
  FiMessageSquare,
  FiRotateCw,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"
import StudentThesisDetails from "../components/StudentThesisDetails"
import SignedReviewViewer from "../components/SignedReviewViewer"

const StudentDashboard = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [thesis, setThesis] = useState(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false)
  const [showReupload, setShowReupload] = useState(false)
  const [showThesisDetails, setShowThesisDetails] = useState(false)
  const { toast, showToast, hideToast } = useToast()
  const [showSignedReview, setShowSignedReview] = useState(false)
  const [topicProposal, setTopicProposal] = useState("")

  // Use ref to prevent infinite loops
  const fetchedRef = useRef(false)
  const lastUserUpdateRef = useRef(null)

  const fetchThesis = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true)

        // Only refresh user data if forced or if user data seems stale
        if (forceRefresh || !lastUserUpdateRef.current || Date.now() - lastUserUpdateRef.current > 30000) {
          // 30 seconds
          await refreshUser()
          lastUserUpdateRef.current = Date.now()
        }

        const data = await thesisAPI.getMyThesis()
        setThesis(data)
        setTitle(data?.title || "")
        
        // Set topic proposal from user data if available
        if (user?.thesisTopic) {
          setTopicProposal(user.thesisTopic)
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error("Error fetching thesis:", error)
          showToast("Failed to fetch thesis information", "error")
        }
        // 404 is expected when no thesis exists
        setThesis(null)
      } finally {
        setIsLoading(false)
        fetchedRef.current = true
      }
    },
    [showToast, refreshUser, user?.thesisTopic],
  )

  // Initial fetch - only once
  useEffect(() => {
    if (user && !fetchedRef.current) {
      fetchThesis(true)
    }
  }, [user, fetchThesis])

  // Update title when user data changes (after profile update)
  useEffect(() => {
    if (user?.thesisTopic && !thesis && fetchedRef.current) {
      setTitle(user.thesisTopic)
      setTopicProposal(user.thesisTopic)
    }
  }, [user?.thesisTopic, thesis])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        showToast("Please select a PDF file", "error")
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        showToast("File size must be less than 10MB", "error")
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmitTopic = async (e) => {
    e.preventDefault()
    
    if (!topicProposal.trim()) {
      showToast("Please enter a thesis topic", "error")
      return
    }

    try {
      setIsSubmittingTopic(true)
      
      await thesisAPI.submitTopic(topicProposal)
      showToast("Thesis topic submitted for approval!", "success")
      
      // Refresh user data
      await refreshUser()
      
    } catch (error) {
      showToast("Failed to submit thesis topic", "error")
    } finally {
      setIsSubmittingTopic(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // First check profile completeness
    const requiredProfileFields = ["faculty", "group", "subjectArea", "educationalProgram"]

    const missingFields = requiredProfileFields.filter((field) => !user[field] || user[field].trim() === "")

    if (missingFields.length > 0) {
      showToast(`Please complete your profile first (missing: ${missingFields.join(", ")})`, "error")
      return
    }

    if (!file || !title.trim()) {
      showToast("Please provide both title and file", "error")
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append("title", title.trim())
      formData.append("thesisFile", file)

      await thesisAPI.submitThesis(formData)
      showToast(thesis ? "Thesis re-uploaded successfully!" : "Thesis submitted successfully!", "success")

      // Force refresh after successful upload
      await fetchThesis(true)
      setFile(null)
      setShowReupload(false)

      const fileInput = document.getElementById("thesisFile")
      if (fileInput) fileInput.value = ""
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to submit thesis", "error")
    } finally {
      setIsUploading(false)
    }
  }

  const handleViewPDF = async () => {
    try {
      const blob = await thesisAPI.viewThesis(thesis?.id)
      const blobUrl = URL.createObjectURL(blob)

      // Open in new tab with proper PDF handling
      const newWindow = window.open("", "_blank")
      if (newWindow) {
        // Create a clean HTML document
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

        // Focus the new window
        newWindow.focus()
      } else {
        showToast("Popup blocked - please allow popups", "warning")
      }

      // Clean up after some time
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch (error) {
      showToast("Failed to open thesis", "error")
    }
  }

  // Manual refresh function
  const handleRefresh = () => {
    fetchThesis(true)
  }

  // NEW: Handle thesis resubmission after revisions
  const handleResubmitThesis = async () => {
    try {
      setIsUploading(true)
      await thesisAPI.studentResubmitThesis(thesis.id)
      showToast("Thesis resubmitted for review!", "success")
      await fetchThesis(true)
    } catch (error) {
      showToast("Failed to resubmit thesis", "error")
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusColor = (thesis) => {
    if (thesis?.finalGrade && thesis?.status === "evaluated") {
      return "text-green-400"
    }

    if (thesis?.finalGrade && thesis?.status === "under_review") {
      return "text-yellow-400"
    }

    // NEW: Colors for consultant and supervisor statuses
    switch (thesis?.status) {
      case "submitted":
        return "text-blue-400"
      case "with_consultant":
        return "text-purple-400"
      case "with_supervisor":
        return "text-orange-400"
      case "under_review":
        return "text-yellow-400"
      case "revisions_requested":
        return "text-red-400"
      case "evaluated":
        return "text-green-400"
      default:
        return "text-gray-400"
    }
  }

  const getStatusText = (thesis) => {
    if (thesis?.finalGrade && thesis?.status === "evaluated") {
      return "Evaluated - Review completed and signed"
    }

    if (thesis?.finalGrade && thesis?.status === "under_review") {
      return "Review completed - Waiting for signature"
    }

    // NEW: Status texts for consultant and supervisor workflow
    switch (thesis?.status) {
      case "submitted":
        return "Submitted - Waiting for team assignment"
      case "with_consultant":
        return "Under consultant review"
      case "with_supervisor":
        return "Under supervisor review"
      case "under_review":
        return "Under final review"
      case "revisions_requested":
        return "Revisions requested - Please resubmit"
      case "evaluated":
        return "Evaluated"
      default:
        return "Not submitted"
    }
  }

  const getStatusIcon = (thesis) => {
    switch (thesis?.status) {
      case "with_consultant":
        return <FiUsers className="w-4 h-4" />
      case "with_supervisor":
        return <FiUser className="w-4 h-4" />
      case "revisions_requested":
        return <FiRotateCw className="w-4 h-4" />
      default:
        return <FiClock className="w-4 h-4" />
    }
  }

  // Check if topic is approved and student can upload thesis
  const canUploadThesis = user?.isTopicApproved

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading student dashboard...</p>
        </div>
      </div>
    )
  }

  // Get the current thesis title - prioritize uploaded thesis title, then user profile topic
  const currentThesisTitle = user?.thesisTopic || ""

  return (
    <div className="min-h-screen bg-black">
      <Toast {...toast} onClose={hideToast} />

      {/* Top Navigation Bar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-sm">T</span>
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 hover:bg-gray-800 rounded-lg p-2 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.fullName
                    ?.split(" ")
                    .map((name) => name[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "U"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              <FiLogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-black font-bold text-xl">T</span>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              {canUploadThesis ? "Thesis Submission" : "Thesis Topic Proposal"}
            </h1>
            <p className="text-gray-400">
              {canUploadThesis 
                ? "Upload and manage your graduation thesis" 
                : "Submit your thesis topic for approval before uploading your thesis"}
            </p>
          </div>

          {/* Topic Approval Status */}
          {!canUploadThesis && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                  <FiBook className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">Thesis Topic Approval Required</h2>
                  <p className="text-gray-400">
                    You need to get your thesis topic approved before you can upload your thesis file.
                  </p>
                </div>
              </div>

              {/* Topic Proposal Form */}
              <form onSubmit={handleSubmitTopic} className="space-y-4">
                <div>
                  <label htmlFor="topicProposal" className="block text-sm font-medium text-gray-300 mb-2">
                    Proposed Thesis Topic
                  </label>
                  <textarea
                    id="topicProposal"
                    value={topicProposal}
                    onChange={(e) => setTopicProposal(e.target.value)}
                    placeholder="Enter your proposed thesis topic in detail..."
                    rows="4"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all resize-none"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmittingTopic || !topicProposal.trim()}
                    className="flex-1 bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmittingTopic ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiSend className="w-5 h-5" />
                        Submit for Approval
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Current topic status */}
              {user?.thesisTopic && (
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiClock className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-blue-400 font-medium">Topic Submitted for Approval</p>
                      <p className="text-white text-sm mt-1">"{user.thesisTopic}"</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Your topic is waiting for supervisor approval. You will be notified once it's approved.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show thesis topic even without uploaded file */}
          {canUploadThesis && currentThesisTitle && !thesis && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">{currentThesisTitle}</h2>
                  <div className="flex items-center gap-2 text-green-400">
                    <FiCheck className="w-4 h-4" />
                    <span className="text-sm">Topic Approved - Ready for file upload</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <FiEdit className="w-4 h-4" />
                  Edit in Profile
                </button>
              </div>
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FiCheck className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-400 font-medium">Topic Approved</p>
                    <p className="text-gray-400 text-sm">
                      Your thesis topic has been approved. You can now upload your thesis file.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Thesis Upload Section - Only show if topic is approved */}
          {canUploadThesis && (
            <>
              {thesis && !showReupload ? (
                // Existing thesis display
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white mb-2">{thesis.title}</h2>
                      <div className={`flex items-center gap-2 ${getStatusColor(thesis)}`}>
                        {getStatusIcon(thesis)}
                        <span className="text-sm font-medium">{getStatusText(thesis)}</span>
                      </div>
                      
                      {/* NEW: Show iteration and review count */}
                      {(thesis.currentIteration > 0 || thesis.totalReviewCount > 0) && (
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                          {thesis.currentIteration > 0 && (
                            <span>Iteration: {thesis.currentIteration}</span>
                          )}
                          {thesis.totalReviewCount > 0 && (
                            <span>Total Reviews: {thesis.totalReviewCount}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Submitted on</p>
                      <p className="text-white font-medium">{new Date(thesis.submissionDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* NEW: Team members display */}
                  {(thesis.assignedConsultant || thesis.assignedSupervisor || thesis.assignedReviewer) && (
                    <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                      <h3 className="text-white font-medium mb-3">Assigned Team</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {thesis.assignedConsultant && (
                          <div className="flex items-center gap-2 p-2 bg-purple-900/20 rounded">
                            <FiUsers className="w-4 h-4 text-purple-400" />
                            <div>
                              <p className="text-purple-400 text-xs">Consultant</p>
                              <p className="text-white text-sm">{thesis.assignedConsultant}</p>
                            </div>
                          </div>
                        )}
                        {thesis.assignedSupervisor && (
                          <div className="flex items-center gap-2 p-2 bg-orange-900/20 rounded">
                            <FiUser className="w-4 h-4 text-orange-400" />
                            <div>
                              <p className="text-orange-400 text-xs">Supervisor</p>
                              <p className="text-white text-sm">{thesis.assignedSupervisor}</p>
                            </div>
                          </div>
                        )}
                        {thesis.assignedReviewer && (
                          <div className="flex items-center gap-2 p-2 bg-yellow-900/20 rounded">
                            <FiMessageSquare className="w-4 h-4 text-yellow-400" />
                            <div>
                              <p className="text-yellow-400 text-xs">Reviewer</p>
                              <p className="text-white text-sm">{thesis.assignedReviewer}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* NEW: Revisions requested message */}
                  {thesis.status === "revisions_requested" && (
                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <FiRotateCw className="w-5 h-5 text-red-400" />
                        <div>
                          <p className="text-red-400 font-medium">Revisions Requested</p>
                          <p className="text-gray-400 text-sm">
                            Your thesis requires revisions. Please review the feedback and resubmit your thesis.
                          </p>
                          {/* NEW: Show latest review comments if available */}
                          {thesis.reviewIterations && thesis.reviewIterations.length > 0 && (
                            <div className="mt-2 p-3 bg-gray-800 rounded">
                              <p className="text-white text-sm font-medium">Latest Feedback:</p>
                              <p className="text-gray-300 text-sm mt-1">
                                {thesis.reviewIterations[thesis.reviewIterations.length - 1]?.consultantReview?.comments ||
                                 thesis.reviewIterations[thesis.reviewIterations.length - 1]?.supervisorReview?.comments ||
                                 "Please check the detailed review for specific feedback."}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Special message for students waiting for reviewer assignment */}
                  {thesis.status === "submitted" && !thesis.assignedReviewer && !thesis.finalGrade && (
                    <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <FiAlertCircle className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-blue-400 font-medium">Waiting for Team Assignment</p>
                          <p className="text-gray-400 text-sm">
                            Your thesis has been successfully submitted. An administrator will assign a team to review your thesis soon.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {thesis.finalGrade && (
                    <div className={`bg-${thesis.status === "evaluated" ? "green" : "yellow"}-900/20 border border-${thesis.status === "evaluated" ? "green" : "yellow"}-800 rounded-lg p-4 mb-6`}>
                      <div className="flex items-center gap-3">
                        <FiCheck className={`w-5 h-5 text-${thesis.status === "evaluated" ? "green" : "yellow"}-400`} />
                        <div>
                          <p className={`text-${thesis.status === "evaluated" ? "green" : "yellow"}-400 font-medium`}>
                            Final Grade: {thesis.finalGrade}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {thesis.status === "evaluated"
                              ? "Your thesis has been evaluated and signed"
                              : "Your thesis has been graded - waiting for signature"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="flex items-center gap-2 text-gray-400">
                      <FiFile className="w-4 h-4" />
                      <span className="text-sm">PDF Document</span>
                    </div>
                    <div className="flex gap-3">
                      {/* NEW: Resubmit button for revisions */}
                      {thesis.status === "revisions_requested" && (
                        <button
                          onClick={handleResubmitThesis}
                          disabled={isUploading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <FiRotateCw className="w-4 h-4" />
                          {isUploading ? "Resubmitting..." : "Resubmit Thesis"}
                        </button>
                      )}
                      
                      {!thesis.finalGrade && thesis.status !== "revisions_requested" && (
                        <button
                          onClick={() => setShowReupload(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          <FiRefreshCw className="w-4 h-4" />
                          Re-upload Thesis
                        </button>
                      )}
                      <button
                        onClick={handleViewPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <FiDownload className="w-4 h-4" />
                        Download Thesis
                      </button>
                      {thesis.finalGrade && thesis.assessment && (
                        <button
                          onClick={() => setShowThesisDetails(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FiEye className="w-4 h-4" />
                          View Review
                        </button>
                      )}
                      {thesis.status === "evaluated" && thesis.finalGrade && thesis?.id && (
                        <button
                          onClick={() => setShowSignedReview(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <FiEye className="w-4 h-4" />
                          View Signed Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Upload/Re-upload form
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                  {showReupload && (
                    <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FiRefreshCw className="w-5 h-5 text-yellow-400" />
                        <div>
                          <p className="text-yellow-400 font-medium">Re-uploading Thesis</p>
                          <p className="text-gray-400 text-sm">
                            This will replace your current thesis file. The old file will be permanently deleted.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                        Thesis Title
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter your thesis title"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                        required
                      />
                      {user?.thesisTopic && title !== user.thesisTopic && (
                        <p className="text-xs text-gray-500 mt-1">
                          Approved topic: "{user.thesisTopic}" -
                          <button
                            type="button"
                            onClick={() => setTitle(user.thesisTopic)}
                            className="text-blue-400 hover:text-blue-300 ml-1"
                          >
                            Use approved topic
                          </button>
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="thesisFile" className="block text-sm font-medium text-gray-300 mb-2">
                        Thesis File (PDF only, max 10MB)
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          id="thesisFile"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                          required
                        />
                        <label
                          htmlFor="thesisFile"
                          className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors"
                        >
                          <div className="text-center">
                            <FiUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-400">{file ? file.name : "Click to select PDF file"}</p>
                            <p className="text-gray-500 text-sm mt-1">PDF only, max 10MB</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {showReupload && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowReupload(false)
                            setFile(null)
                            const fileInput = document.getElementById("thesisFile")
                            if (fileInput) fileInput.value = ""
                          }}
                          className="flex-1 bg-gray-800 text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isUploading || !file || !title.trim()}
                        className="flex-1 bg-white text-black font-medium py-3 px-4 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <FiUpload className="w-5 h-5" />
                            {showReupload ? "Re-upload Thesis" : "Submit Thesis"}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Thesis Details Modal */}
      <Modal isOpen={showThesisDetails} onClose={() => setShowThesisDetails(false)} title="Thesis Details" size="full">
        <StudentThesisDetails thesis={thesis} onClose={() => setShowThesisDetails(false)} />
      </Modal>
      
      {/* Signed Review Modal */}
      {thesis?.status === "evaluated" && thesis?.id && (
        <Modal isOpen={showSignedReview} onClose={() => setShowSignedReview(false)} title="Signed Review" size="full">
          <SignedReviewViewer thesisId={thesis?.id} onClose={() => setShowSignedReview(false)} />
        </Modal>
      )}
    </div>
  )
}

export default StudentDashboard