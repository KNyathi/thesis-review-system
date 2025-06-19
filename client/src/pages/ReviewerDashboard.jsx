import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiFile,
  FiClock,
  FiCheck,
  FiUser,
  FiDownload,
  FiEye,
  FiLogOut,
  FiFilter,
  FiCalendar,
  FiBook,
  FiRefreshCw,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"
import ReviewerAssessment from "../components/ReviewerAssessment"

const ReviewerDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [assignedStudents, setAssignedStudents] = useState([])
  const [completedStudents, setCompletedStudents] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("assigned")
  const [isLoading, setIsLoading] = useState(true)
  const [reviewMode, setReviewMode] = useState("new")
  const [downloadingId, setDownloadingId] = useState(null)
  const [filterOption, setFilterOption] = useState("all")
  const [sortOption, setSortOption] = useState("newest")
  const { toast, showToast, hideToast } = useToast()

  // ИСПРАВЛЕНО: Используем ref для предотвращения бесконечных циклов
  const fetchedRef = useRef(false)
  const isFetchingRef = useRef(false)

  // ИСПРАВЛЕНО: Убираем зависимости, которые могут вызывать бесконечные циклы
  const fetchStudents = useCallback(async () => {
    // Предотвращаем одновременные запросы
    if (isFetchingRef.current) {
      return
    }

    try {
      isFetchingRef.current = true
      setIsLoading(true)

      const [assigned, completed] = await Promise.allSettled([
        thesisAPI.getAssignedTheses(),
        thesisAPI.getCompletedReviews(),
      ])

      // Обработка назначенных тезисов
      const assignedData = assigned.status === "fulfilled" ? assigned.value : []
      const completedData = completed.status === "fulfilled" ? completed.value : []

      console.log("Assigned theses:", assignedData)
      console.log("Completed reviews:", completedData)

      // Обработка всех тезисов
      const allTheses = [...assignedData, ...completedData]

      // Убираем дубликаты по ID
      const uniqueTheses = allTheses.filter(
        (thesis, index, self) => index === self.findIndex((t) => t._id === thesis._id),
      )

      // Разделяем на назначенные и завершенные
      const validAssigned = []
      const validCompleted = []

      uniqueTheses
        .filter((thesis) => thesis && thesis.student && thesis.student.fullName)
        .forEach((thesis) => {
          const studentData = {
            ...thesis.student,
            thesis: thesis,
            thesisId: thesis._id,
            thesisTitle: thesis.title || "Untitled Thesis",
            submissionDate: thesis.submissionDate,
            status: thesis.status,
            finalGrade: thesis.finalGrade,
            hasUploaded: !!thesis.fileUrl,
          }

          // Если работа оценена (есть финальная оценка) или статус "evaluated", то она завершена
          if (thesis.finalGrade || thesis.status === "evaluated") {
            validCompleted.push(studentData)
          } else {
            // Иначе она все еще назначена для рецензирования
            validAssigned.push(studentData)
          }
        })

      setAssignedStudents(validAssigned)
      setCompletedStudents(validCompleted)
      fetchedRef.current = true

      if (assigned.status === "rejected" || completed.status === "rejected") {
        showToast("Some data could not be loaded", "warning")
      }
    } catch (error) {
      console.error("Error fetching students:", error)
      showToast("Failed to fetch students", "error")
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, []) // ИСПРАВЛЕНО: Убрали showToast из зависимостей

  // ИСПРАВЛЕНО: Загружаем данные только при монтировании компонента
  useEffect(() => {
    if (user && user.role === "reviewer" && !fetchedRef.current) {
      fetchStudents()
    }
  }, [user]) // ИСПРАВЛЕНО: Убрали fetchStudents из зависимостей

  // Filter and sort students
  useEffect(() => {
    let filtered = [...assignedStudents]

    if (filterOption === "uploaded") {
      filtered = filtered.filter((student) => student.hasUploaded)
    } else if (filterOption === "not_uploaded") {
      filtered = filtered.filter((student) => !student.hasUploaded)
    }

    if (sortOption === "newest") {
      filtered.sort((a, b) => new Date(b.submissionDate || 0) - new Date(a.submissionDate || 0))
    } else if (sortOption === "oldest") {
      filtered.sort((a, b) => new Date(a.submissionDate || 0) - new Date(b.submissionDate || 0))
    }

    setFilteredStudents(filtered)
  }, [assignedStudents, filterOption, sortOption])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleStudentClick = (student, mode = "new") => {
    if (!student.hasUploaded) {
      showToast("Student hasn't uploaded their thesis yet", "info")
      return
    }
    setSelectedStudent(student)
    setReviewMode(mode)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedStudent(null)
    // ИСПРАВЛЕНО: Обновляем данные только после закрытия модального окна
    fetchStudents()
  }

  const handleDownload = async (thesisId, title) => {
    try {
      setDownloadingId(thesisId)
      const blob = await thesisAPI.downloadThesis(thesisId)

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`
      a.style.display = "none"

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      showToast("Download completed successfully!", "success")
    } catch (error) {
      showToast("Failed to download thesis", "error")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleReReview = async (student) => {
    try {
      await thesisAPI.reReviewThesis(student.thesisId)
      showToast("Thesis moved back for re-review", "success")
      fetchStudents() // Обновляем данные
    } catch (error) {
      showToast("Failed to move thesis for re-review", "error")
    }
  }

  // ИСПРАВЛЕНО: Ручное обновление
  const handleRefresh = () => {
    fetchedRef.current = false
    fetchStudents()
  }

  const getCircleColor = (status, hasUploaded) => {
    if (!hasUploaded) {
      return "from-red-900 to-red-700"
    }
    switch (status) {
      case "submitted":
        return "from-blue-500 to-blue-600"
      case "assigned":
      case "under_review":
        return "from-yellow-500 to-orange-500"
      case "evaluated":
        return "from-sky-400 to-green-400"
      default:
        return "from-gray-500 to-gray-600"
    }
  }

  const getStatusText = (status, hasUploaded) => {
    if (!hasUploaded) {
      return "Not submitted"
    }
    switch (status) {
      case "submitted":
        return "Pending Review"
      case "assigned":
        return "Pending Review"
      case "under_review":
        return "Under Review"
      case "evaluated":
        return "Review Completed"
      default:
        return "Unknown"
    }
  }

  const getStatusColor = (status, hasUploaded) => {
    if (!hasUploaded) {
      return "text-red-400"
    }
    switch (status) {
      case "submitted":
        return "text-blue-400"
      case "assigned":
      case "under_review":
        return "text-orange-400"
      case "evaluated":
        return "text-green-400"
      default:
        return "text-gray-400"
    }
  }

  const getInitials = (fullName) => {
    if (!fullName || typeof fullName !== "string") return "?"
    return fullName
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading reviewer dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Toast {...toast} onClose={hideToast} />

      {/* Top Navigation Bar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
              <FiBook className="w-4 h-4 text-white" />
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
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-black font-bold text-xl">T</span>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">Reviewer Dashboard</h1>
            <p className="text-gray-400">Review and evaluate assigned student theses</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("assigned")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "assigned" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Assigned Students ({assignedStudents.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "completed" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Completed Reviews ({completedStudents.length})
            </button>
          </div>

          {/* Filters for Assigned Students */}
          {activeTab === "assigned" && (
            <div className="flex gap-4 mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
              <div className="flex items-center gap-2">
                <FiFilter className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 text-sm">Filter:</span>
                <select
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="all">All Students</option>
                  <option value="uploaded">Uploaded Only</option>
                  <option value="not_uploaded">Not Uploaded</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 text-sm">Sort:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="newest">Newest Submissions</option>
                  <option value="oldest">Oldest Submissions</option>
                </select>
              </div>
            </div>
          )}

          {/* Student List */}
          <div className="space-y-4">
            {activeTab === "assigned" ? (
              filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <div
                    key={student.thesisId}
                    className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-10 h-10 bg-gradient-to-br ${getCircleColor(
                              student.status,
                              student.hasUploaded,
                            )} rounded-full flex items-center justify-center`}
                          >
                            <span className="text-white font-semibold text-sm">{getInitials(student.fullName)}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{student.fullName}</h3>
                            <p className="text-gray-400 text-sm">{student.email}</p>
                          </div>
                        </div>
                        <div className="ml-13">
                          <p className="text-white font-medium mb-1">{student.thesisTitle || "No thesis title yet"}</p>
                          <p className="text-gray-400 text-sm mb-2">{student.institution}</p>
                          <div className="flex items-center gap-4 text-sm">
                            {student.hasUploaded && student.submissionDate ? (
                              <div className="flex items-center gap-2 text-gray-400">
                                <FiClock className="w-4 h-4" />
                                <span>Submitted {new Date(student.submissionDate).toLocaleDateString()}</span>
                              </div>
                            ) : null}
                            <div
                              className={`flex items-center gap-2 ${getStatusColor(
                                student.status,
                                student.hasUploaded,
                              )}`}
                            >
                              <FiFile className="w-4 h-4" />
                              <span className="font-medium">{getStatusText(student.status, student.hasUploaded)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {student.hasUploaded && (
                          <button
                            onClick={() => handleDownload(student.thesisId, student.thesisTitle)}
                            disabled={downloadingId === student.thesisId}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                          >
                            {downloadingId === student.thesisId ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FiDownload className="w-4 h-4" />
                            )}
                            Download
                          </button>
                        )}
                        <button
                          onClick={() => handleStudentClick(student, "new")}
                          disabled={!student.hasUploaded}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiEye className="w-4 h-4" />
                          {student.hasUploaded ? "Review Thesis" : "Waiting for Upload"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <FiUser className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">No Students Found</h3>
                  <p className="text-gray-500">No students match the current filter criteria.</p>
                </div>
              )
            ) : completedStudents.length > 0 ? (
              completedStudents.map((student) => (
                <div key={student.thesisId} className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-10 h-10 bg-gradient-to-br ${getCircleColor(
                            student.status,
                            student.hasUploaded,
                          )} rounded-full flex items-center justify-center`}
                        >
                          <span className="text-white font-semibold text-sm">{getInitials(student.fullName)}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{student.fullName}</h3>
                          <p className="text-gray-400 text-sm">{student.email}</p>
                        </div>
                      </div>
                      <div className="ml-13">
                        <p className="text-white font-medium mb-1">{student.thesisTitle}</p>
                        <p className="text-gray-400 text-sm mb-2">{student.institution}</p>
                        <div className="flex items-center gap-4 text-sm">
                          {student.submissionDate && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <FiClock className="w-4 h-4" />
                              <span>Submitted {new Date(student.submissionDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-green-400">
                            <FiCheck className="w-4 h-4" />
                            <span className="font-medium">Review Completed</span>
                          </div>
                        </div>
                        {student.finalGrade && (
                          <div className="mt-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/20 text-green-400 border border-green-800">
                              Grade: {student.finalGrade}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(student.thesisId, student.thesisTitle)}
                        disabled={downloadingId === student.thesisId}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {downloadingId === student.thesisId ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiDownload className="w-4 h-4" />
                        )}
                        Download
                      </button>
                      <button
                        onClick={() => handleStudentClick(student, "view")}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <FiEye className="w-4 h-4" />
                        View Review
                      </button>
                      <button
                        onClick={() => handleReReview(student)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                      >
                        <FiRefreshCw className="w-4 h-4" />
                        Re-Review
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <FiCheck className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400 mb-2">No Completed Reviews</h3>
                <p className="text-gray-500">You haven't completed any thesis reviews yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={`${reviewMode === "edit" ? "Edit Review" : reviewMode === "view" ? "View Review" : "Review Thesis"} - ${selectedStudent?.fullName}`}
        size="full"
      >
        {selectedStudent && (
          <ReviewerAssessment
            thesisId={selectedStudent.thesisId}
            student={selectedStudent}
            mode={reviewMode}
            onClose={handleCloseModal}
          />
        )}
      </Modal>
    </div>
  )
}

export default ReviewerDashboard
