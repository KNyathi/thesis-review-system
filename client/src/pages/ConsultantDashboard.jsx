import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FiClock, FiCheck, FiDownload, FiLogOut, FiRefreshCw, FiEdit, FiUsers, FiMessageSquare } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"
import ConsultantReviewAssessment from "../components/ConsultantReviewAssessment"

const ConsultantDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [assignedTheses, setAssignedTheses] = useState([])
  const [completedReviews, setCompletedReviews] = useState([])
  const [activeTab, setActiveTab] = useState("assigned")
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedThesis, setSelectedThesis] = useState(null)
  const [showSignedReview, setShowSignedReview] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  const fetchedRef = useRef(false)
  const isFetchingRef = useRef(false)

  const fetchTheses = useCallback(async () => {
    if (isFetchingRef.current) return

    try {
      isFetchingRef.current = true
      setIsLoading(true)

      const [assigned, completed] = await Promise.allSettled([
        thesisAPI.getConsultantAssignedTheses(),
        thesisAPI.getConsultantCompletedReviews(),
      ])

      const assignedData = assigned.status === "fulfilled" ? assigned.value : []
      const completedData = completed.status === "fulfilled" ? completed.value : []

      setAssignedTheses(assignedData)
      setCompletedReviews(completedData)
      fetchedRef.current = true

      if (assigned.status === "rejected" || completed.status === "rejected") {
        showToast("Не удалось загрузить некоторые данные", "warning")
      }
    } catch (error) {
      console.error("Error fetching theses:", error)
      showToast("Не удалось загрузить данные", "error")
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [showToast])

  useEffect(() => {
    if (user && user.role === "consultant" && !fetchedRef.current) {
      fetchTheses()
    }
  }, [user, fetchTheses])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
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

      showToast("Загрузка завершена успешно!", "success")
    } catch (error) {
      showToast("Не удалось загрузить работу", "error")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleRefresh = () => {
    fetchedRef.current = false
    fetchTheses()
  }

  const handleViewThesis = (thesis) => {
    setSelectedThesis(thesis)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedThesis(null)
    fetchTheses()
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "with_consultant":
        return "bg-purple-100 text-purple-700 border-purple-200"
      case "approved":
        return "bg-green-100 text-green-700 border-green-200"
      case "under_review":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "evaluated":
        return "bg-green-100 text-green-700 border-green-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case "with_consultant":
        return "На рассмотрении консультанта"
      case "approved":
        return "Одобрено"
      case "under_review":
        return "На рассмотрении"
      case "evaluated":
        return "Оценено"
      case "revisions_requested":
        return "Требуются исправления"
      default:
        return status
    }
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели консультанта...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Toast {...toast} onClose={hideToast} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center">
              <FiUsers className="w-4 h-4 text-white" />
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
                    .slice(0, 2) || "К"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs">Консультант</p>
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

      {/* Main Content */}
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-xl">К</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Панель консультанта</h1>
            <p className="text-gray-600">Управление студентами и консультирование дипломных работ</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("assigned")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "assigned" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              На рассмотрении ({assignedTheses.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "completed" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Завершённые ({completedReviews.length})
            </button>
          </div>

          {/* Assigned Theses Tab */}
          {activeTab === "assigned" && (
            <div className="space-y-4">
              {assignedTheses.length > 0 ? (
                assignedTheses.map((thesis) => (
                  <div
                    key={thesis.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {getInitials(thesis.student?.fullName)}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{thesis.student?.fullName}</h3>
                            <p className="text-gray-600 text-sm">{thesis.student?.email}</p>
                          </div>
                        </div>

                        <div className="ml-13">
                          <p className="text-gray-900 font-medium mb-1">
                            {thesis.title || "Название работы не указано"}
                          </p>
                          <p className="text-gray-600 text-sm mb-2">
                            {thesis.student?.faculty} - {thesis.student?.group}
                          </p>

                          <div className="flex flex-wrap items-center gap-3">
                            {thesis.submissionDate && (
                              <div className="flex items-center gap-2 text-gray-600 text-sm">
                                <FiClock className="w-4 h-4" />
                                <span>Отправлено {new Date(thesis.submissionDate).toLocaleDateString("ru-RU")}</span>
                              </div>
                            )}
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                                thesis.status,
                              )}`}
                            >
                              {getStatusText(thesis.status)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleDownload(thesis.id, thesis.title)}
                          disabled={downloadingId === thesis.id}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                        >
                          {downloadingId === thesis.id ? (
                            <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiDownload className="w-4 h-4" />
                          )}
                          Скачать
                        </button>
                        <button
                          onClick={() => handleViewThesis(thesis)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
                        >
                          <FiEdit className="w-4 h-4" />
                          Консультировать
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiMessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Работ для консультирования не найдено</h3>
                  <p className="text-gray-500">В данный момент нет работ, назначенных для вашего консультирования.</p>
                </div>
              )}
            </div>
          )}

          {/* Completed Reviews Tab */}
          {activeTab === "completed" && (
            <div className="space-y-4">
              {completedReviews.length > 0 ? (
                completedReviews.map((review) => {
                  const isAwaitingSignature = review.status === "approved"
                  const isAwaitingStudentFix = review.status === "revisions_requested"

                  return (
                    <div
                      key={review.id}
                      className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className={`w-10 h-10 bg-gradient-to-br ${isAwaitingSignature ? "from-green-500 to-green-600" : "from-yellow-500 to-yellow-600"} rounded-full flex items-center justify-center`}
                            >
                              <span className="text-white font-semibold text-sm">
                                {getInitials(review.student?.fullName)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{review.student?.fullName}</h3>
                              <p className="text-gray-600 text-sm">{review.student?.email}</p>
                            </div>
                          </div>

                          <div className="ml-13">
                            <p className="text-gray-900 font-medium mb-1">{review.title}</p>
                            <p className="text-gray-600 text-sm mb-2">
                              {review.student?.faculty} - {review.student?.group}
                            </p>

                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                                  isAwaitingSignature
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                }`}
                              >
                                {isAwaitingSignature ? "Готово к подписанию" : "Требуется доработка"}
                              </span>
                              {isAwaitingSignature && (
                                <span className="text-xs text-green-600 font-medium">✓ Одобрено</span>
                              )}
                              {isAwaitingStudentFix && (
                                <span className="text-xs text-yellow-600 font-medium">
                                  ⏳ Ожидание исправлений студента
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleDownload(review.id, review.title)}
                            disabled={downloadingId === review.id}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                          >
                            {downloadingId === review.id ? (
                              <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FiDownload className="w-4 h-4" />
                            )}
                            Скачать
                          </button>
                          {isAwaitingSignature && (
                            <button
                              onClick={() => navigate(`/consultant-sign/${review.id}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                            >
                              <FiEdit className="w-4 h-4" />
                              Подписать
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Нет завершённых консультаций</h3>
                  <p className="text-gray-500">Как только вы оцените работу, она появится здесь.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={`Консультирование работы - ${selectedThesis?.student?.fullName}`}
        size="full"
      >
        {selectedThesis && (
          <ConsultantReviewAssessment thesisId={selectedThesis.id} thesis={selectedThesis} onClose={handleCloseModal} />
        )}
      </Modal>
    </div>
  )
}

export default ConsultantDashboard
