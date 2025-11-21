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
        newWindow.document.write(`<!DOCTYPE html>
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
        </html>`)
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели студента...</p>
        </div>
      </div>
    )
  }

  // Get the current thesis title - prioritize uploaded thesis title, then user profile topic
  const currentThesisTitle = user?.thesisTopic || ""

  return (
    <div className="min-h-screen bg-white">
      <Toast {...toast} onClose={hideToast} />

      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#372579] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">Д</span>
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
                <p className="text-gray-500 text-xs capitalize">{user?.role === "student" ? "Студент" : user?.role}</p>
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-xl">Д</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {canUploadThesis ? "Подача дипломной работы" : "Предложение темы диплома"}
            </h1>
            <p className="text-gray-600">
              {canUploadThesis
                ? "Загрузите и управляйте своей дипломной работой"
                : "Отправьте тему диплома на утверждение перед загрузкой работы"}
            </p>
          </div>

          {!canUploadThesis && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <FiBook className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Требуется утверждение темы диплома</h2>
                  <p className="text-gray-600">
                    Вам необходимо получить утверждение темы диплома перед загрузкой файла работы.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitTopic} className="space-y-4">
                <div>
                  <label htmlFor="topicProposal" className="block text-sm font-medium text-gray-700 mb-2">
                    Предлагаемая тема диплома
                  </label>
                  <textarea
                    id="topicProposal"
                    value={topicProposal}
                    onChange={(e) => setTopicProposal(e.target.value)}
                    placeholder="Введите предлагаемую тему диплома подробно..."
                    rows="4"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmittingTopic || !topicProposal.trim()}
                    className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmittingTopic ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiSend className="w-5 h-5" />
                        Отправить на утверждение
                      </>
                    )}
                  </button>
                </div>
              </form>

              {user?.thesisTopic && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiClock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-blue-700 font-medium">Тема отправлена на утверждение</p>
                      <p className="text-gray-900 text-sm mt-1">"{user.thesisTopic}"</p>
                      <p className="text-gray-600 text-sm mt-1">
                        Ваша тема ожидает утверждения научным руководителем. Вы получите уведомление после утверждения.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {canUploadThesis && currentThesisTitle && !thesis && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{currentThesisTitle}</h2>
                  <div className="flex items-center gap-2 text-green-600">
                    <FiCheck className="w-4 h-4" />
                    <span className="text-sm">Тема утверждена - Готово к загрузке файла</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm"
                >
                  <FiEdit className="w-4 h-4" />
                  Редактировать в профиле
                </button>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FiCheck className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-green-700 font-medium">Тема утверждена</p>
                    <p className="text-gray-600 text-sm">
                      Ваша тема диплома утверждена. Теперь вы можете загрузить файл работы.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {canUploadThesis && (
            <>
              {thesis && !showReupload ? (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{thesis.title}</h2>
                      <div className={`flex items-center gap-2 ${getStatusColor(thesis)}`}>
                        {getStatusIcon(thesis)}
                        <span className="text-sm font-medium">{getStatusText(thesis)}</span>
                      </div>

                      {(thesis.currentIteration > 0 || thesis.totalReviewCount > 0) && (
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          {thesis.currentIteration > 0 && <span>Итерация: {thesis.currentIteration}</span>}
                          {thesis.totalReviewCount > 0 && <span>Всего рецензий: {thesis.totalReviewCount}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600 text-sm">Отправлено</p>
                      <p className="text-gray-900 font-medium">
                        {new Date(thesis.submissionDate).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>

                  {(thesis.assignedConsultant || thesis.assignedSupervisor || thesis.assignedReviewer) && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-gray-900 font-medium mb-3">Назначенная команда</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {thesis.assignedConsultant && (
                          <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                            <FiUsers className="w-4 h-4 text-purple-600" />
                            <div>
                              <p className="text-purple-700 text-xs">Консультант</p>
                              <p className="text-gray-900 text-sm">
                                {thesis.consultant?.fullName || thesis.assignedConsultant}
                              </p>
                            </div>
                          </div>
                        )}
                        {thesis.assignedSupervisor && (
                          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                            <FiUser className="w-4 h-4 text-orange-600" />
                            <div>
                              <p className="text-orange-700 text-xs">Научный руководитель</p>
                              <p className="text-gray-900 text-sm">
                                {thesis.supervisor?.fullName || thesis.assignedSupervisor}
                              </p>
                            </div>
                          </div>
                        )}
                        {thesis.assignedReviewer && (
                          <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                            <FiMessageSquare className="w-4 h-4 text-yellow-600" />
                            <div>
                              <p className="text-yellow-700 text-xs">Рецензент</p>
                              <p className="text-gray-900 text-sm">
                                {thesis.reviewer?.fullName || thesis.assignedReviewer}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {thesis.status === "revisions_requested" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <FiRotateCw className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="text-red-700 font-medium">Требуются исправления</p>
                          <p className="text-gray-600 text-sm">
                            Ваша работа требует исправлений. Пожалуйста, ознакомьтесь с замечаниями и отправьте работу
                            повторно.
                          </p>
                          {thesis.reviewIterations && thesis.reviewIterations.length > 0 && (
                            <div className="mt-2 p-3 bg-white rounded border border-red-100">
                              <p className="text-gray-900 text-sm font-medium">Последние замечания:</p>
                              <p className="text-gray-700 text-sm mt-1">
                                {thesis.reviewIterations[thesis.reviewIterations.length - 1]?.consultantReview
                                  ?.comments ||
                                  thesis.reviewIterations[thesis.reviewIterations.length - 1]?.supervisorReview
                                    ?.comments ||
                                  "Пожалуйста, проверьте подробную рецензию для конкретных замечаний."}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {thesis.status === "submitted" && !thesis.assignedReviewer && !thesis.finalGrade && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <FiAlertCircle className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-blue-700 font-medium">Ожидание назначения команды</p>
                          <p className="text-gray-600 text-sm">
                            Ваша работа успешно отправлена. Администратор скоро назначит команду для проверки вашей
                            работы.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {thesis.finalGrade && (
                    <div
                      className={`bg-${thesis.status === "evaluated" ? "green" : "yellow"}-50 border border-${thesis.status === "evaluated" ? "green" : "yellow"}-200 rounded-lg p-4 mb-6`}
                    >
                      <div className="flex items-center gap-3">
                        <FiCheck className={`w-5 h-5 text-${thesis.status === "evaluated" ? "green" : "yellow"}-600`} />
                        <div>
                          <p className={`text-${thesis.status === "evaluated" ? "green" : "yellow"}-700 font-medium`}>
                            Итоговая оценка: {thesis.finalGrade}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {thesis.status === "evaluated"
                              ? "Ваша работа оценена и подписана"
                              : "Ваша работа оценена - ожидание подписи"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-gray-600">
                      <FiFile className="w-4 h-4" />
                      <span className="text-sm">PDF документ</span>
                    </div>
                    <div className="flex gap-3">
                      {thesis.status === "revisions_requested" && (
                        <button
                          onClick={handleResubmitThesis}
                          disabled={isUploading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <FiRotateCw className="w-4 h-4" />
                          {isUploading ? "Отправка..." : "Отправить повторно"}
                        </button>
                      )}

                      {!thesis.finalGrade && thesis.status !== "revisions_requested" && (
                        <button
                          onClick={() => setShowReupload(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          <FiRefreshCw className="w-4 h-4" />
                          Загрузить заново
                        </button>
                      )}
                      <button
                        onClick={handleViewPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors"
                      >
                        <FiDownload className="w-4 h-4" />
                        Скачать работу
                      </button>
                      {thesis.finalGrade && thesis.assessment && (
                        <button
                          onClick={() => setShowThesisDetails(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors"
                        >
                          <FiEye className="w-4 h-4" />
                          Просмотр рецензии
                        </button>
                      )}
                      {thesis.status === "evaluated" && thesis.finalGrade && thesis?.id && (
                        <button
                          onClick={() => setShowSignedReview(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <FiEye className="w-4 h-4" />
                          Подписанная рецензия
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                  {showReupload && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FiRefreshCw className="w-5 h-5 text-yellow-600" />
                        <div>
                          <p className="text-yellow-700 font-medium">Повторная загрузка работы</p>
                          <p className="text-gray-600 text-sm">
                            Это заменит текущий файл работы. Старый файл будет удален безвозвратно.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Название работы
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Введите название вашей работы"
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all"
                        required
                      />
                      {user?.thesisTopic && title !== user.thesisTopic && (
                        <p className="text-xs text-gray-500 mt-1">
                          Утвержденная тема: "{user.thesisTopic}" -
                          <button
                            type="button"
                            onClick={() => setTitle(user.thesisTopic)}
                            className="text-[#372579] hover:text-[#2a1d5f] ml-1"
                          >
                            Использовать утвержденную тему
                          </button>
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="thesisFile" className="block text-sm font-medium text-gray-700 mb-2">
                        Файл работы (только PDF, макс. 10МБ)
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
                          className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#372579] transition-colors"
                        >
                          <div className="text-center">
                            <FiUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600">{file ? file.name : "Нажмите для выбора PDF файла"}</p>
                            <p className="text-gray-500 text-sm mt-1">Только PDF, макс. 10МБ</p>
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
                          className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Отмена
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isUploading || !file || !title.trim()}
                        className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <FiUpload className="w-5 h-5" />
                            {showReupload ? "Загрузить заново" : "Отправить работу"}
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

      <Modal isOpen={showThesisDetails} onClose={() => setShowThesisDetails(false)} title="Детали работы" size="full">
        <StudentThesisDetails thesis={thesis} onClose={() => setShowThesisDetails(false)} />
      </Modal>

      {thesis?.status === "evaluated" && thesis?.id && (
        <Modal
          isOpen={showSignedReview}
          onClose={() => setShowSignedReview(false)}
          title="Подписанная рецензия"
          size="full"
        >
          <SignedReviewViewer thesisId={thesis?.id} onClose={() => setShowSignedReview(false)} />
        </Modal>
      )}
    </div>
  )
}

export default StudentDashboard
