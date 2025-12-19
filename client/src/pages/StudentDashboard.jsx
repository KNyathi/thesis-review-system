import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiUpload,
  FiCheck,
  FiClock,
  FiUser,
  FiRefreshCw,
  FiLogOut,
  FiAlertCircle,
  FiEye,
  FiSend,
  FiBook,
  FiUsers,
  FiMessageSquare,
  FiRotateCw,
  FiSearch,
  FiX,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
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
  const [availableSupervisors, setAvailableSupervisors] = useState([]) 
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false)
  const [requestingStates, setRequestingStates] = useState({})
  const [myRequests, setMyRequests] = useState([])
  const [supervisorInfo, setSupervisorInfo] = useState(null)
  const [consultantInfo, setConsultantInfo] = useState(null)
  const [reviewerInfo, setReviewerInfo] = useState(null)
  
  const [showTopicResponseModal, setShowTopicResponseModal] = useState(false)
  const [responseComments, setResponseComments] = useState("")
  const [isResponding, setIsResponding] = useState(false)

  // Используем ref для предотвращения бесконечных циклов при начальной загрузке
  const fetchedRef = useRef(false)
  const lastUserUpdateRef = useRef(null)

  const fetchThesis = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true)

        // Обновляем данные пользователя только при принудительном обновлении или если данные устарели
        if (forceRefresh || !lastUserUpdateRef.current || Date.now() - lastUserUpdateRef.current > 30000) {
          await refreshUser()
          lastUserUpdateRef.current = Date.now()
        }

        const data = await thesisAPI.getMyThesis()
        setThesis(data)
        // Устанавливаем название из утверждённой темы
        setTitle(data?.title || user?.thesisTopic || "")

        // Устанавливаем предложение темы из данных пользователя, если доступно
        if (user?.thesisTopic) {
          setTopicProposal(user.thesisTopic)
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error("Ошибка при получении дипломной работы:", error)
        }
        setThesis(null)
      } finally {
        setIsLoading(false)
        fetchedRef.current = true
      }
    },
    [refreshUser, user?.thesisTopic],
  )

  const fetchAvailableSupervisors = useCallback(async () => {
    try {
      setIsLoadingSupervisors(true)

      const response = await thesisAPI.getAvailableSupervisors()

      const supervisorUsers = Array.isArray(response?.supervisors) ? response.supervisors : []

      const normalizedSupervisors = supervisorUsers.map((sup) => ({
        ...sup,
        fullName: sup.fullName || sup.name || "Имя не указано",
        department: sup.department || "",
        position: sup.position || "",
        email: sup.email || "",
      }))

      console.log("Загружено научных руководителей:", normalizedSupervisors.length)
      setAvailableSupervisors(normalizedSupervisors)
    } catch (error) {
      console.error("Ошибка при получении научных руководителей:", error)
      console.error("Детали ошибки:", error.response?.data)
      showToast("Не удалось загрузить список научных руководителей", "error")
      setAvailableSupervisors([])
    } finally {
      setIsLoadingSupervisors(false)
    }
  }, [showToast])

  const fetchMyRequests = useCallback(async () => {
    try {
      const response = await thesisAPI.getMySupervisorRequests()
      const requests = response?.requests || []
      setMyRequests(requests)
    } catch (error) {
      console.error("Ошибка при получении моих запросов:", error)
      setMyRequests([])
    }
  }, [])

  // Начальная загрузка данных
  useEffect(() => {
    if (!user || user.role !== "student") return
    if (fetchedRef.current) return

    const initData = async () => {
      await fetchThesis()
      // Получаем объединённый список участников команды
      await fetchAvailableSupervisors()
      await fetchMyRequests()
    }

    initData()
  }, [user, fetchThesis, fetchAvailableSupervisors, fetchMyRequests])

  // Повторная загрузка при изменении видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        console.log("Страница стала видимой, обновляем данные")
        refreshUser()
        fetchAvailableSupervisors()
        fetchMyRequests()
        if (fetchedRef.current) {
          fetchThesis(false)
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user, refreshUser, fetchAvailableSupervisors, fetchMyRequests, fetchThesis])

  // Обновление названия при изменении данных пользователя
  useEffect(() => {
    if (user?.thesisTopic && !thesis && fetchedRef.current) {
      setTitle(user.thesisTopic)
      setTopicProposal(user.thesisTopic)
    }
  }, [user?.thesisTopic, thesis])

  // Установка информации о команде с использованием списка availableSupervisors
  useEffect(() => {
    if (!availableSupervisors || availableSupervisors.length === 0) return

    const allUsersList = availableSupervisors

    if (user?.supervisor) {
      const supervisor = allUsersList.find((u) => u.id === user.supervisor)
      setSupervisorInfo(supervisor || null)
    } else {
      setSupervisorInfo(null)
    }

    if (user?.consultant) {
      const consultant = allUsersList.find((u) => u.id === user.consultant)
      setConsultantInfo(consultant || null)
    } else {
      setConsultantInfo(null)
    }

    if (user?.reviewer) {
      const reviewer = allUsersList.find((u) => u.id === user.reviewer)
      setReviewerInfo(reviewer || null)
    } else {
      setReviewerInfo(null)
    }
  }, [user, availableSupervisors])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleRefresh = async () => {
    fetchedRef.current = false
    await Promise.all([fetchThesis(true), fetchAvailableSupervisors(), fetchMyRequests()])
    showToast("Данные обновлены", "success")
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        showToast("Пожалуйста, выберите PDF файл", "error")
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        showToast("Размер файла должен быть меньше 10МБ", "error")
        return
      }
      setFile(selectedFile)
    }
  }

  const handleRequestSupervisor = async (supervisorId) => {
    if (!supervisorId) {
      showToast("Пожалуйста, выберите научного руководителя", "error")
      return
    }

    try {
      setRequestingStates((prev) => ({ ...prev, [supervisorId]: true }))
      console.log("Отправка запроса научному руководителю:", supervisorId)

      const result = await thesisAPI.requestSupervisor(supervisorId, "")
      console.log("Запрос успешен:", result)

      showToast("Запрос на научного руководителя отправлен!", "success")

      await Promise.all([refreshUser(), fetchMyRequests(), fetchAvailableSupervisors()])
    } catch (error) {
      console.error("Ошибка при запросе научного руководителя:", error)
      console.error("Ответ ошибки:", error.response?.data)
      const errorMessage = error.response?.data?.error || "Не удалось отправить запрос"
      showToast(errorMessage, "error")
    } finally {
      setRequestingStates((prev) => ({ ...prev, [supervisorId]: false }))
    }
  }

  // Функция для ответа на предложенную тему
  const handleRespondToTopic = async (accepted, comments = "") => {
    if (!accepted && !comments.trim()) {
      showToast("Пожалуйста, укажите причину отклонения", "error")
      return
    }

    try {
      setIsResponding(true)
      
      const response = await thesisAPI.respondToProposedTopic(accepted, comments)
      
      showToast(accepted ? "Тема принята!" : "Тема отклонена", "success")
      
      await refreshUser()
      
      // Закрываем модальное окно если оно открыто
      if (showTopicResponseModal) {
        setShowTopicResponseModal(false)
        setResponseComments("")
      }
      
    } catch (error) {
      showToast(error.response?.data?.error || "Не удалось отправить ответ", "error")
    } finally {
      setIsResponding(false)
    }
  }

  const handleSubmitTopic = async (e) => {
    e.preventDefault()

    if (!topicProposal.trim()) {
      showToast("Пожалуйста, введите тему диплома", "error")
      return
    }

    try {
      setIsSubmittingTopic(true)
      await thesisAPI.submitTopic(topicProposal)
      showToast("Тема отправлена на утверждение!", "success")
      await refreshUser()
      setTopicProposal("")
    } catch (error) {
      showToast("Не удалось отправить тему", "error")
    } finally {
      setIsSubmittingTopic(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const requiredProfileFields = ["faculty", "group", "subjectArea", "educationalProgram"]
    const missingFields = requiredProfileFields.filter((field) => !user[field] || user[field].trim() === "")

    if (missingFields.length > 0) {
      showToast(`Пожалуйста, заполните профиль (отсутствует: ${missingFields.join(", ")})`, "error")
      return
    }

    if (!file) {
      showToast("Пожалуйста, выберите файл диплома", "error")
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      // Используем утверждённую тему из user.thesisTopic
      formData.append("title", user?.thesisTopic || "Дипломная работа")
      formData.append("thesisFile", file)

      await thesisAPI.submitThesis(formData)
      showToast(thesis ? "Работа успешно обновлена!" : "Работа успешно отправлена!", "success")

      await fetchThesis(true)
      setFile(null)
      setShowReupload(false)

      const fileInput = document.getElementById("thesisFile")
      if (fileInput) fileInput.value = ""
    } catch (error) {
      showToast(error.response?.data?.error || "Не удалось отправить работу", "error")
    } finally {
      setIsUploading(false)
    }
  }

  const handleViewPDF = async () => {
    try {
      const blob = await thesisAPI.viewThesis(thesis?.id)
      const blobUrl = URL.createObjectURL(blob)
      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Просмотр работы</title>
              <style>body { margin: 0; overflow: hidden; } iframe { width: 100vw; height: 100vh; border: none; }</style>
            </head>
            <body><iframe src="${blobUrl}"></iframe></body>
          </html>
        `)
      } else {
        showToast("Попап заблокирован - пожалуйста, разрешите всплывающие окна", "warning")
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch (error) {
      showToast("Не удалось открыть файл", "error")
    }
  }

  const handleResubmitThesis = async () => {
    try {
      setIsUploading(true)
      await thesisAPI.studentResubmitThesis(thesis.id)
      showToast("Работа отправлена на повторную проверку!", "success")
      await fetchThesis(true)
    } catch (error) {
      showToast("Не удалось отправить повторно", "error")
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusColor = (thesis) => {
    if (thesis?.finalGrade && thesis?.status === "evaluated") return "text-green-400"
    if (thesis?.finalGrade && thesis?.status === "under_review") return "text-yellow-400"

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
    if (thesis?.finalGrade && thesis?.status === "evaluated") return "Оценено - Рецензия подписана"
    if (thesis?.finalGrade && thesis?.status === "under_review") return "Проверка завершена - Ожидание подписи"

    switch (thesis?.status) {
      case "submitted":
        return "Отправлено - Ожидание назначения"
      case "with_consultant":
        return "На проверке у консультанта"
      case "with_supervisor":
        return "На проверке у руководителя"
      case "under_review":
        return "На финальной проверке"
      case "revisions_requested":
        return "Требуются исправления"
      case "evaluated":
        return "Оценено"
      default:
        return "Не отправлено"
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

  const hasAssignedSupervisor = !!user?.supervisor
  const hasAssignedTeam = !!(user?.supervisor || user?.consultant || user?.reviewer)
  const canUploadThesis = hasAssignedSupervisor && 
    (user?.isTopicApproved || 
     (user?.topicProposedBy === "supervisor" && user?.studentTopicResponse?.status === "accepted"))
  const hasSupervisorProposedTopic = user?.topicProposedBy === "supervisor" && 
    user?.studentTopicResponse?.status === "pending"
  const currentThesisTitle = user?.thesisTopic || ""

  const filteredSupervisors = useMemo(() => {
    // Список из выделенного endpoint
    if (!Array.isArray(availableSupervisors)) return []

    if (!searchQuery.trim()) {
      return availableSupervisors
    }

    const query = searchQuery.toLowerCase()

    return availableSupervisors.filter((sup) => {
      const name = (sup.fullName || "").toLowerCase()
      const position = (sup.position || "").toLowerCase()
      const department = (sup.department || "").toLowerCase()
      const email = (sup.email || "").toLowerCase()

      return name.includes(query) || position.includes(query) || department.includes(query) || email.includes(query)
    })
  }, [availableSupervisors, searchQuery])

  const getSupervisorRequestStatus = useCallback(
    (supervisorId) => {
      const request = myRequests.find((req) => req.supervisorId === supervisorId)
      return request?.status || null
    },
    [myRequests],
  )

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

  return (
    <div className="min-h-screen bg-white">
      <Toast {...toast} onClose={hideToast} />

      {/* Модальное окно для комментария при отклонении темы */}
      {showTopicResponseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Укажите причину отклонения</h3>
            
            <div className="mb-4">
              <label htmlFor="rejectionComments" className="block text-sm font-medium text-gray-700 mb-2">
                Комментарий (обязательно)
              </label>
              <textarea
                id="rejectionComments"
                value={responseComments}
                onChange={(e) => setResponseComments(e.target.value)}
                placeholder="Почему вы отклоняете предложенную тему?"
                rows="4"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTopicResponseModal(false)
                  setResponseComments("")
                }}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleRespondToTopic(false, responseComments)}
                disabled={isResponding || !responseComments.trim()}
                className="flex-1 bg-red-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResponding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <FiX className="w-4 h-4" />
                    Отклонить тему
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              {hasAssignedTeam ? "Информация о вашей дипломной работе" : "Выбор научного руководителя"}
            </h1>
            <p className="text-gray-600">
              {hasAssignedTeam
                ? "Управляйте своей дипломной работой и следите за процессом проверки."
                : "Сначала выберите научного руководителя. Консультант назначается позднее администрацией."}
            </p>
          </div>

          {/* Если студент может загружать диплом (шаг 3) - показываем команду и тему сверху */}
          {canUploadThesis ? (
            <>
              {/* Команда */}
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <FiUsers className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Назначенная команда</h2>
                    <p className="text-gray-600">Ваша команда для работы над дипломом</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {supervisorInfo && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-orange-700 text-xs font-medium mb-1">Научный руководитель</p>
                      <p className="text-gray-900 font-medium text-sm">
                        {supervisorInfo.fullName || supervisorInfo.name}
                      </p>
                      {supervisorInfo.email && <p className="text-gray-600 text-xs mt-1">{supervisorInfo.email}</p>}
                    </div>
                  )}
                  {consultantInfo && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-700 text-xs font-medium mb-1">Консультант</p>
                      <p className="text-gray-900 font-medium text-sm">
                        {consultantInfo.fullName || consultantInfo.name}
                      </p>
                      {consultantInfo.email && <p className="text-gray-600 text-xs mt-1">{consultantInfo.email}</p>}
                    </div>
                  )}
                  {reviewerInfo && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-xs font-medium mb-1">Рецензент</p>
                      <p className="text-gray-900 font-medium text-sm">{reviewerInfo.fullName || reviewerInfo.name}</p>
                      {reviewerInfo.email && <p className="text-gray-600 text-xs mt-1">{reviewerInfo.email}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Утверждённая тема */}
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <FiBook className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Утверждённая тема ВКР</h2>
                    <p className="text-gray-600">Ваша утверждённая тема дипломной работы</p>
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-medium text-green-800 mb-2">Тема дипломной работы:</p>
                  <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                  <p className="text-gray-500 text-sm mt-2">
                    {user.topicProposedBy === "supervisor" 
                      ? "Предложена и утверждена научным руководителем" 
                      : "Предложена вами и утверждена научным руководителем"}
                  </p>
                </div>
              </div>

              {/* Форма загрузки диплома (Шаг 3) */}
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <FiUpload className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Шаг 3: Загрузка диплома</h2>
                    <p className="text-gray-600">
                      Загрузите ваш диплом в формате PDF. Размер файла не должен превышать 10МБ.
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Название диплома: <span className="font-medium">"{user.thesisTopic}"</span>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="thesisFile" className="block text-sm font-medium text-gray-700 mb-2">
                      Файл диплома
                    </label>
                    <input
                      id="thesisFile"
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isUploading || !file}
                      className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        "Загрузить диплом"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <>
              {/* Если студент не может загружать диплом - показываем обычный порядок шагов */}
              {!hasAssignedTeam ? (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FiUser className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Шаг 1: Выбор научного руководителя</h2>
                      <p className="text-gray-600 text-sm mt-1">
                        Выберите научного руководителя из списка специалистов вашего факультета
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Поиск по имени, кафедре, должности..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {isLoadingSupervisors ? (
                      <div className="py-8 text-center text-gray-500">
                        <div className="w-6 h-6 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p>Загрузка научных руководителей...</p>
                      </div>
                    ) : filteredSupervisors.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <FiUser className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-gray-700">Научные руководители не найдены</p>
                        <p className="text-sm mt-1">
                          {searchQuery
                            ? "Попробуйте изменить поисковый запрос"
                            : "Список пуст. Попробуйте обновить страницу."}
                        </p>
                      </div>
                    ) : (
                      filteredSupervisors.map((supervisor) => {
                        const requestStatus = getSupervisorRequestStatus(supervisor.id)
                        const hasPendingRequest = requestStatus === "pending"
                        const isAccepted = requestStatus === "accepted"
                        const isDeclined = requestStatus === "declined"
                        const isRequesting = requestingStates[supervisor.id] || false

                        return (
                          <div
                            key={supervisor.id}
                            className="p-4 border border-gray-200 rounded-lg hover:border-[#372579] hover:bg-blue-50 transition-all bg-white"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">{supervisor.fullName}</p>
                                  {hasPendingRequest && (
                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                      <FiClock className="w-3 h-3" /> Ожидание ответа
                                    </span>
                                  )}
                                  {isAccepted && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                      <FiCheck className="w-3 h-3" /> Запрос принят
                                    </span>
                                  )}
                                  {isDeclined && (
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                      <FiAlertCircle className="w-3 h-3" /> Отклонено
                                    </span>
                                  )}
                                </div>
                                {supervisor.position && <p className="text-sm text-gray-600 mt-1">{supervisor.position}</p>}
                                {supervisor.department && (
                                  <p className="text-sm text-gray-500 mt-0.5">{supervisor.department}</p>
                                )}
                                {supervisor.email && <p className="text-xs text-gray-400 mt-1">{supervisor.email}</p>}
                                {isDeclined &&
                                  (() => {
                                    const declinedRequest = myRequests.find(
                                      (req) => req.supervisorId === supervisor.id && req.status === "declined",
                                    )
                                    return declinedRequest?.declineReason ? (
                                      <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded">
                                        Причина: {declinedRequest.declineReason}
                                      </p>
                                    ) : null
                                  })()}
                              </div>
                              <button
                                onClick={() => handleRequestSupervisor(supervisor.id)}
                                disabled={hasPendingRequest || isAccepted || isRequesting}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all text-sm font-medium whitespace-nowrap ${
                                  hasPendingRequest || isAccepted
                                    ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                    : "bg-[#372579] text-white hover:bg-[#2a1d5f] disabled:opacity-50 disabled:cursor-not-allowed"
                                }`}
                              >
                                {isRequesting ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Отправка...
                                  </>
                                ) : hasPendingRequest ? (
                                  <>
                                    <FiClock className="w-4 h-4" />
                                    Ожидание
                                  </>
                                ) : isAccepted ? (
                                  <>
                                    <FiCheck className="w-4 h-4" />
                                    Принято
                                  </>
                                ) : isDeclined ? (
                                  <>
                                    <FiSend className="w-4 h-4" />
                                    Отправить снова
                                  </>
                                ) : (
                                  <>
                                    <FiSend className="w-4 h-4" />
                                    Отправить запрос
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {myRequests.filter((req) => req.status === "pending").length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <FiClock className="inline w-4 h-4 mr-1" />У вас есть{" "}
                        {myRequests.filter((req) => req.status === "pending").length} ожидающих запросов
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FiUsers className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Шаг 1: Назначенная команда</h2>
                      <p className="text-gray-600">Вам назначена команда для работы над дипломом</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {supervisorInfo && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-orange-700 text-xs font-medium mb-1">Научный руководитель</p>
                        <p className="text-gray-900 font-medium text-sm">
                          {supervisorInfo.fullName || supervisorInfo.name}
                        </p>
                        {supervisorInfo.email && <p className="text-gray-600 text-xs mt-1">{supervisorInfo.email}</p>}
                      </div>
                    )}
                    {consultantInfo && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-purple-700 text-xs font-medium mb-1">Консультант</p>
                        <p className="text-gray-900 font-medium text-sm">
                          {consultantInfo.fullName || consultantInfo.name}
                        </p>
                        {consultantInfo.email && <p className="text-gray-600 text-xs mt-1">{consultantInfo.email}</p>}
                      </div>
                    )}
                    {reviewerInfo && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-700 text-xs font-medium mb-1">Рецензент</p>
                        <p className="text-gray-900 font-medium text-sm">{reviewerInfo.fullName || reviewerInfo.name}</p>
                        {reviewerInfo.email && <p className="text-gray-600 text-xs mt-1">{reviewerInfo.email}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Шаг 2: Предложение темы (только когда нельзя загружать диплом) */}
              {hasAssignedTeam && !canUploadThesis && (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FiBook className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Шаг 2: Утверждение темы диплома</h2>
                      
                      {/* Если руководитель предложил тему и ждёт ответа студента */}
                      {user?.topicProposedBy === "supervisor" && user?.studentTopicResponse?.status === "pending" && (
                        <div className="space-y-4">
                          <p className="text-gray-600">
                            Ваш научный руководитель предложил тему. Пожалуйста, примите или отклоните её.
                          </p>
                          
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="font-medium text-blue-800 mb-2">Предложенная тема:</p>
                            <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                            <p className="text-gray-500 text-sm mt-2">
                              Предложена: {new Date(user.topicProposedAt).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleRespondToTopic(true, "")}
                              disabled={isResponding}
                              className="flex-1 bg-green-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {isResponding ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <FiCheck className="w-4 h-4" />
                                  Принять тему
                                </>
                              )}
                            </button>
                            
                            <button
                              onClick={() => setShowTopicResponseModal(true)}
                              disabled={isResponding}
                              className="flex-1 bg-red-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <FiX className="w-4 h-4" />
                              Отклонить тему
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Если студент отклонил тему руководителя появляется возможность предложить свою тему */}
                      {user?.topicProposedBy === "supervisor" && user?.studentTopicResponse?.status === "declined" && (
                        <div className="space-y-6">
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="font-medium text-yellow-800 mb-2">Вы отклонили предложенную тему</p>
                            <p className="text-gray-600">
                              Вы отклонили тему "{user.thesisTopic}" предложенную научным руководителем.
                            </p>
                            {user.studentTopicResponse?.comments && (
                              <p className="text-gray-700 mt-2">
                                <span className="font-medium">Ваш комментарий:</span> {user.studentTopicResponse.comments}
                              </p>
                            )}
                          </div>
                          
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900 mb-2">Дальнейшие действия:</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <h4 className="font-medium text-blue-800 mb-2">Ждать новое предложение</h4>
                                  <p className="text-gray-600 text-sm mb-3">
                                    Дождитесь, пока научный руководитель предложит новую тему.
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Рекомендуется связаться с руководителем для обсуждения темы.
                                  </p>
                                </div>
                                
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                  <h4 className="font-medium text-purple-800 mb-2">Предложить свою тему</h4>
                                  <p className="text-gray-600 text-sm mb-3">
                                    Или вы можете сами предложить тему для утверждения.
                                  </p>
                                  <button
                                    onClick={() => {
                                      // Сбрасываем форму, чтобы студент мог предложить свою тему
                                      setTopicProposal("")
                                    }}
                                    className="w-full bg-[#372579] text-white font-medium py-2 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all"
                                  >
                                    Предложить свою тему
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Форма для предложения своей темы */}
                            {!user?.thesisTopic && (
                              <form onSubmit={handleSubmitTopic} className="space-y-4">
                                <div>
                                  <label htmlFor="topicProposal" className="block text-sm font-medium text-gray-700 mb-2">
                                    Ваша предлагаемая тема диплома
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
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      "Предложить свою тему"
                                    )}
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Если студент предложил тему и ждёт утверждения руководителем */}
                      {user?.topicProposedBy === "student" && !user?.isTopicApproved && (
                        <div className="space-y-4">
                          <p className="text-gray-600">
                            Вы предложили тему. Ожидайте утверждения научным руководителем.
                          </p>
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="font-medium text-yellow-800 mb-2">Ваша предложенная тема:</p>
                            <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                            <p className="text-gray-500 text-sm mt-2">
                              Отправлена на утверждение: {new Date(user.topicSubmittedAt).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          
                          {user.topicRejectionComments && (
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                              <p className="font-medium text-red-800 mb-2">Тема отклонена руководителем:</p>
                              <p className="text-red-600">{user.topicRejectionComments}</p>
                              <p className="text-gray-600 text-sm mt-2">
                                Вы можете предложить новую тему ниже:
                              </p>
                              
                              <form onSubmit={handleSubmitTopic} className="space-y-4 mt-4">
                                <div>
                                  <label htmlFor="topicProposal" className="block text-sm font-medium text-gray-700 mb-2">
                                    Новая предлагаемая тема
                                  </label>
                                  <textarea
                                    id="topicProposal"
                                    value={topicProposal}
                                    onChange={(e) => setTopicProposal(e.target.value)}
                                    placeholder="Введите новую предлагаемую тему диплома..."
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
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      "Предложить новую тему"
                                    )}
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Если тема утверждена */}
                      {user?.isTopicApproved && (
                        <div className="space-y-4">
                          <p className="text-gray-600">
                            Тема утверждена. Теперь вы можете загрузить диплом.
                          </p>
                          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <p className="font-medium text-green-800 mb-2">Утверждённая тема:</p>
                            <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                            <p className="text-gray-500 text-sm mt-2">
                              {user.topicProposedBy === "supervisor" 
                                ? "Предложена и утверждена научным руководителем" 
                                : "Предложена вами и утверждена научным руководителем"}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Если нет темы и нет предложений от руководителя */}
                      {!user?.thesisTopic && !user?.isTopicApproved && user?.topicProposedBy !== "supervisor" && (
                        <form onSubmit={handleSubmitTopic} className="space-y-4">
                          <p className="text-gray-600">
                            Предложите тему диплома для утверждения научным руководителем.
                          </p>
                          
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
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "Отправить тему"
                              )}
                            </button>
                          </div>
                        </form>
                      )}
                      
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!hasAssignedTeam && myRequests.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiMessageSquare className="w-5 h-5 text-blue-600" />
                Мои запросы ({myRequests.length})
              </h3>
              <div className="space-y-3">
                {myRequests.map((request) => (
                  <div key={request.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{request.supervisor?.name}</p>
                        <p className="text-sm text-gray-600">{request.supervisor?.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {request.status === "pending" && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                              <FiClock className="w-3 h-3" /> Ожидает ответа
                            </span>
                          )}
                          {request.status === "accepted" && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                              <FiCheck className="w-3 h-3" /> Принято
                            </span>
                          )}
                          {request.status === "declined" && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                              <FiAlertCircle className="w-3 h-3" /> Отклонено
                            </span>
                          )}
                        </div>
                        {request.declineReason && (
                          <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded">
                            Причина отклонения: {request.declineReason}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Отправлено:{" "}
                          {new Date(request.createdAt).toLocaleString("ru-RU", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Шаг 4 */}
          {thesis && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FiEye className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Просмотр диплома</h2>
                  <p className="text-gray-600">Просмотрите загруженный диплом в PDF формате.</p>
                </div>
              </div>

              <button
                onClick={handleViewPDF}
                className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm"
              >
                <FiEye className="w-4 h-4" />
                Просмотреть диплом
              </button>
            </div>
          )}

          {/* Шаг 5 */}
          {thesis && thesis.status === "revisions_requested" && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FiSend className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Повторная отправка диплома</h2>
                  <p className="text-gray-600">Отправьте диплом на повторную проверку.</p>
                </div>
              </div>

              <button
                onClick={handleResubmitThesis}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Отправка...
                  </>
                ) : (
                  "Отправить на повторную проверку"
                )}
              </button>
            </div>
          )}

          {/* Шаг 6: Подпись рецензии */}
          {thesis && thesis.status === "evaluated" && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Рецензия на диплом</h2>
                  <p className="text-gray-600">Просмотрите и подпишите рекензию на диплом.</p>
                </div>
              </div>

              <SignedReviewViewer thesis={thesis} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
