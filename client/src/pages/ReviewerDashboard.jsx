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
  FiEdit,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"
import ReviewerAssessment from "../components/ReviewerAssessment"
import SignedReviewViewer from "../components/SignedReviewViewer"

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
  const [showSignedReview, setShowSignedReview] = useState(false)
  const [selectedThesisForSignedReview, setSelectedThesisForSignedReview] = useState(null)

  const fetchedRef = useRef(false)
  const isFetchingRef = useRef(false)

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

      const assignedData = assigned.status === "fulfilled" ? assigned.value : []
      const completedData = completed.status === "fulfilled" ? completed.value : []

      console.log("Assigned theses:", assignedData)
      console.log("Completed reviews:", completedData)

      const allTheses = [...assignedData, ...completedData]

      const uniqueTheses = allTheses.filter(
        (thesis, index, self) => index === self.findIndex((t) => t.id === thesis.id),
      )

      const validAssigned = []
      const validCompleted = []

      uniqueTheses
        .filter((thesis) => thesis && thesis.student && thesis.student.fullName)
        .forEach((thesis) => {
          const studentData = {
            ...thesis.student,
            thesis: thesis,
            thesisId: thesis.id,
            thesisTitle: thesis.title || "Untitled Thesis",
            submissionDate: thesis.submissionDate,
            status: thesis.status,
            finalGrade: thesis.finalGrade,
            hasUploaded: !!thesis.fileUrl,
            hasSignedReview: thesis.hasSignedReview || false,
          }

          if (thesis.finalGrade || thesis.status === "evaluated") {
            validCompleted.push(studentData)
          } else {
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
  }, [])

  useEffect(() => {
    if (user && user.role === "reviewer" && !fetchedRef.current) {
      fetchStudents()
    }
  }, [user])

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
      fetchStudents()
    } catch (error) {
      showToast("Failed to move thesis for re-review", "error")
    }
  }

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

  const handleViewSignedReview = (student) => {
    setSelectedThesisForSignedReview(student.thesisId)
    setShowSignedReview(true)
  }

  const handleSignReview = (student) => {
    navigate(`/sign/${student.thesisId}`)
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели рецензента...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Toast {...toast} onClose={hideToast} />

      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
              <FiBook className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.fullName
                    ?.split(" ")
                    .map((name) => name[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "П"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs capitalize">
                  {user?.role === "reviewer" ? "Рецензент" : user?.role}
                </p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm"
            >
              <FiRefreshCw className="w-4 h-4" />
              Обновить
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <FiLogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-xl">Р</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Панель рецензента</h1>
            <p className="text-gray-600">Рецензирование и оценка назначенных студенческих работ</p>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("assigned")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "assigned" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Назначенные студенты ({assignedStudents.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "completed" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Завершенные рецензии ({completedStudents.length})
            </button>
          </div>

          {activeTab === "assigned" && (
            <div className="flex gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <FiFilter className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700 text-sm">Фильтр:</span>
                <select
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-3 py-1 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#372579]"
                >
                  <option value="all">Все студенты</option>
                  <option value="uploaded">Только загруженные</option>
                  <option value="not_uploaded">Не загружено</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700 text-sm">Сортировка:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-3 py-1 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#372579]"
                >
                  <option value="newest">Новые отправки</option>
                  <option value="oldest">Старые отправки</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {activeTab === "assigned" ? (
              filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <div
                    key={student.thesisId}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
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
                            <h3 className="text-lg font-semibold text-gray-900">{student.fullName}</h3>
                            <p className="text-gray-600 text-sm">{student.email}</p>
                          </div>
                        </div>
                        <div className="ml-13">
                          <p className="text-gray-900 font-medium mb-1">
                            {student.thesisTitle || "Название работы пока нет"}
                          </p>
                          <p className="text-gray-600 text-sm mb-2">{student.institution}</p>
                          <div className="flex items-center gap-4 text-sm">
                            {student.hasUploaded && student.submissionDate ? (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FiClock className="w-4 h-4" />
                                <span>Отправлено {new Date(student.submissionDate).toLocaleDateString("ru-RU")}</span>
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
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                          >
                            {downloadingId === student.thesisId ? (
                              <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FiDownload className="w-4 h-4" />
                            )}
                            Скачать
                          </button>
                        )}
                        <button
                          onClick={() => handleStudentClick(student, "new")}
                          disabled={!student.hasUploaded}
                          className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiEye className="w-4 h-4" />
                          {student.hasUploaded ? "Рецензировать" : "Ожидание загрузки"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <FiUser className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Студенты не найдены</h3>
                  <p className="text-gray-500">Нет студентов, соответствующих текущим критериям фильтра.</p>
                </div>
              )
            ) : completedStudents.length > 0 ? (
              completedStudents.map((student) => (
                <div key={student.thesisId} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
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
                          <h3 className="text-lg font-semibold text-gray-900">{student.fullName}</h3>
                          <p className="text-gray-600 text-sm">{student.email}</p>
                        </div>
                      </div>
                      <div className="ml-13">
                        <p className="text-gray-900 font-medium mb-1">{student.thesisTitle}</p>
                        <p className="text-gray-600 text-sm mb-2">{student.institution}</p>
                        <div className="flex items-center gap-4 text-sm">
                          {student.submissionDate && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <FiClock className="w-4 h-4" />
                              <span>Отправлено {new Date(student.submissionDate).toLocaleDateString("ru-RU")}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-green-600">
                            <FiCheck className="w-4 h-4" />
                            <span className="font-medium">Рецензия завершена</span>
                          </div>
                        </div>
                        {student.finalGrade && (
                          <div className="mt-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                              Оценка: {student.finalGrade}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(student.thesisId, student.thesisTitle)}
                        disabled={downloadingId === student.thesisId}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                      >
                        {downloadingId === student.thesisId ? (
                          <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiDownload className="w-4 h-4" />
                        )}
                        Скачать работу
                      </button>
                      <button
                        onClick={() => handleStudentClick(student, "view")}
                        className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
                      >
                        <FiEye className="w-4 h-4" />
                        Просмотр рецензии
                      </button>
                      {student.hasSignedReview || student.status === "evaluated" ? (
                        <button
                          onClick={() => handleViewSignedReview(student)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          <FiEye className="w-4 h-4" />
                          Подписанная рецензия
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSignReview(student)}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                        >
                          <FiEdit className="w-4 h-4" />
                          Подписать рецензию
                        </button>
                      )}
                      <button
                        onClick={() => handleReReview(student)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                      >
                        <FiRefreshCw className="w-4 h-4" />
                        Повторная рецензия
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Нет завершенных рецензий</h3>
                <p className="text-gray-500">Вы еще не завершили ни одной рецензии работы.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={`${reviewMode === "edit" ? "Редактировать рецензию" : reviewMode === "view" ? "Просмотр рецензии" : "Рецензировать работу"} - ${selectedStudent?.fullName}`}
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
      <Modal
        isOpen={showSignedReview}
        onClose={() => {
          setShowSignedReview(false)
          setSelectedThesisForSignedReview(null)
        }}
        title="Подписанная рецензия"
        size="full"
      >
        {selectedThesisForSignedReview && (
          <SignedReviewViewer
            thesisId={selectedThesisForSignedReview}
            onClose={() => {
              setShowSignedReview(false)
              setSelectedThesisForSignedReview(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

export default ReviewerDashboard
