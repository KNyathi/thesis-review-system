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
  FiDownload,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import SignedReviewViewer from "../components/SignedReviewViewer"
import Modal from "../components/Modal"

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
  const [selectedThesisForReview, setSelectedThesisForReview] = useState(null)
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

  // Состояния для формы объёмного задания
  const [showThesisContentModal, setShowThesisContentModal] = useState(false)
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [thesisContent, setThesisContent] = useState({
    sourceData: [''],
    introduction: {
      title: '',
      percentage: '',
      deadline: ''
    },
    chapters: [{
      title: '',
      percentage: '',
      deadline: '',
      subchapters: ['']
    }],
    conclusion: {
      title: '',
      percentage: '',
      deadline: ''
    },
    sources: {
      title: ''
    },
    appendix: {
      title: ''
    }
  })

  const fetchedRef = useRef(false)
  const lastUserUpdateRef = useRef(null)

  const fetchThesis = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true)

        if (forceRefresh || !lastUserUpdateRef.current || Date.now() - lastUserUpdateRef.current > 30000) {
          await refreshUser()
          lastUserUpdateRef.current = Date.now()
        }

        const data = await thesisAPI.getMyThesis()
        setThesis(data)
        setTitle(data?.title || user?.thesisTopic || "")

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
      setAvailableSupervisors(normalizedSupervisors)
    } catch (error) {
      console.error("Ошибка при получении научных руководителей:", error)
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

  useEffect(() => {
    if (!user || user.role !== "student") return
    if (fetchedRef.current) return

    const initData = async () => {
      await fetchThesis()
      await fetchAvailableSupervisors()
      await fetchMyRequests()
    }

    initData()
  }, [user, fetchThesis, fetchAvailableSupervisors, fetchMyRequests])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
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

  useEffect(() => {
    if (user?.thesisTopic && !thesis && fetchedRef.current) {
      setTitle(user.thesisTopic)
      setTopicProposal(user.thesisTopic)
    }
  }, [user?.thesisTopic, thesis])

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
      const result = await thesisAPI.requestSupervisor(supervisorId, "")
      showToast("Запрос на научного руководителя отправлен!", "success")
      await Promise.all([refreshUser(), fetchMyRequests(), fetchAvailableSupervisors()])
    } catch (error) {
      console.error("Ошибка при запросе научного руководителя:", error)
      const errorMessage = error.response?.data?.error || "Не удалось отправить запрос"
      showToast(errorMessage, "error")
    } finally {
      setRequestingStates((prev) => ({ ...prev, [supervisorId]: false }))
    }
  }

  const handleRespondToTopic = async (accepted, comments = "", newTopic = "") => {
    if (!accepted) {
      if (!comments.trim()) {
        showToast("Пожалуйста, укажите причину отказа", "error")
        return
      }
      if (!newTopic.trim()) {
        showToast("Пожалуйста, предложите свою тему", "error")
        return
      }
    }

    try {
      setIsResponding(true)
      const requestData = {
        accepted: accepted,
        ...(comments.trim() && { comments: comments.trim() }), 
        ...(!accepted && { newTopic: newTopic.trim() }) 
      }
      
      const response = await thesisAPI.respondToProposedTopic(requestData)
      showToast(accepted ? "Тема принята!" : "Ваша тема отправлена на утверждение!", "success")
      await refreshUser()
      await fetchThesis(true)
      await fetchAvailableSupervisors()
      
      if (showTopicResponseModal) {
        setShowTopicResponseModal(false)
        setResponseComments("")
        setTopicProposal("")
      }
    } catch (error) {
      console.error("Ошибка при ответе на тему:", error)
      showToast(error.response?.data?.error || "Не удалось отправить тему", "error")
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
      showToast(error.response?.data?.error || "Не удалось отправить тему", "error")
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

    if (!file && !thesis) {
      showToast("Пожалуйста, выберите файл диплома", "error")
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append("title", user?.thesisTopic || "Дипломная работа")
      if (file) {
        formData.append("thesisFile", file)
      }

      if (thesis) {
        if (thesis.status !== "revisions_requested") {
          showToast("Нельзя обновить работу на текущем этапе", "error")
          return
        }
        await thesisAPI.submitThesis(formData)
        showToast("Исправленная версия успешно отправлена!", "success")
      } else {
        await thesisAPI.submitThesis(formData)
        showToast("Работа успешно отправлена!", "success")
      }

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

  const handleDownloadThesis = async () => {
    try {
      const blob = await thesisAPI.downloadThesis(thesis?.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${thesis?.title || "дипломная_работа"}.pdf`
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      showToast("Не удалось скачать файл", "error")
    }
  }

  // Функции для формы объёмного задания
  const addSourceData = () => {
    setThesisContent(prev => ({
      ...prev,
      sourceData: [...prev.sourceData, '']
    }))
  }

  const removeSourceData = (index) => {
    setThesisContent(prev => ({
      ...prev,
      sourceData: prev.sourceData.filter((_, i) => i !== index)
    }))
  }

  const updateSourceData = (index, value) => {
    const newSourceData = [...thesisContent.sourceData]
    newSourceData[index] = value
    setThesisContent(prev => ({ ...prev, sourceData: newSourceData }))
  }

  const addChapter = () => {
    setThesisContent(prev => ({
      ...prev,
      chapters: [...prev.chapters, {
        title: '',
        percentage: '',
        deadline: '',
        subchapters: ['']
      }]
    }))
  }

  const removeChapter = (index) => {
    setThesisContent(prev => ({
      ...prev,
      chapters: prev.chapters.filter((_, i) => i !== index)
    }))
  }

  const updateChapter = (index, field, value) => {
    const newChapters = [...thesisContent.chapters]
    newChapters[index][field] = value
    setThesisContent(prev => ({ ...prev, chapters: newChapters }))
  }

  const addSubchapter = (chapterIndex) => {
    const newChapters = [...thesisContent.chapters]
    newChapters[chapterIndex].subchapters.push('')
    setThesisContent(prev => ({ ...prev, chapters: newChapters }))
  }

  const removeSubchapter = (chapterIndex, subIndex) => {
    const newChapters = [...thesisContent.chapters]
    newChapters[chapterIndex].subchapters = newChapters[chapterIndex].subchapters.filter((_, i) => i !== subIndex)
    setThesisContent(prev => ({ ...prev, chapters: newChapters }))
  }

  const updateSubchapter = (chapterIndex, subIndex, value) => {
    const newChapters = [...thesisContent.chapters]
    newChapters[chapterIndex].subchapters[subIndex] = value
    setThesisContent(prev => ({ ...prev, chapters: newChapters }))
  }

  const saveThesisContent = async () => {
    if (!thesisContent.introduction.title.trim()) {
      showToast("Пожалуйста, заполните название введения", "error")
      return
    }
    if (!thesisContent.introduction.percentage) {
      showToast("Пожалуйста, укажите процент выполнения введения", "error")
      return
    }
    if (!thesisContent.introduction.deadline) {
      showToast("Пожалуйста, укажите дедлайн для введения", "error")
      return
    }
    
    const validChapters = thesisContent.chapters.filter(ch => ch.title.trim())
    if (validChapters.length === 0) {
      showToast("Пожалуйста, добавьте хотя бы одну главу", "error")
      return
    }
    
    for (const chapter of thesisContent.chapters) {
      if (chapter.title.trim() && (!chapter.percentage || !chapter.deadline)) {
        showToast(`Пожалуйста, заполните процент и дедлайн для главы "${chapter.title}"`, "error")
        return
      }
    }
    
    if (!thesisContent.conclusion.title.trim()) {
      showToast("Пожалуйста, заполните название заключения", "error")
      return
    }
    if (!thesisContent.conclusion.percentage) {
      showToast("Пожалуйста, укажите процент выполнения заключения", "error")
      return
    }
    if (!thesisContent.conclusion.deadline) {
      showToast("Пожалуйста, укажите дедлайн для заключения", "error")
      return
    }

    try {
      setIsSavingContent(true)
      
      const cleanedContent = {
        sourceData: thesisContent.sourceData.filter(s => s.trim()),
        introduction: {
          title: thesisContent.introduction.title.trim(),
          percentage: thesisContent.introduction.percentage,
          deadline: thesisContent.introduction.deadline
        },
        chapters: thesisContent.chapters
          .filter(ch => ch.title.trim())
          .map(ch => ({
            title: ch.title.trim(),
            percentage: ch.percentage,
            deadline: ch.deadline,
            subchapters: ch.subchapters.filter(s => s.trim())
          })),
        conclusion: {
          title: thesisContent.conclusion.title.trim(),
          percentage: thesisContent.conclusion.percentage,
          deadline: thesisContent.conclusion.deadline
        },
        sources: {
          title: thesisContent.sources.title.trim() || "Список использованных источников"
        },
        appendix: {
          title: thesisContent.appendix.title.trim() || "Приложение"
        }
      }
      
      await thesisAPI.saveThesisContent(cleanedContent)
      showToast("Объёмное задание успешно сохранено!", "success")
      setShowThesisContentModal(false)
      await refreshUser()
      await fetchThesis(true)
      
    } catch (error) {
      console.error("Error saving thesis content:", error)
      showToast(error.response?.data?.error || "Не удалось сохранить объёмное задание", "error")
    } finally {
      setIsSavingContent(false)
    }
  }

  const getStatusColor = (thesis) => {
    if (thesis?.finalGrade && thesis?.status === "evaluated") return "text-green-400 bg-green-50"
    switch (thesis?.status) {
      case "submitted": return "text-blue-400 bg-blue-50"
      case "with_consultant": return "text-purple-400 bg-purple-50"
      case "with_supervisor": return "text-orange-400 bg-orange-50"
      case "under_review": return "text-yellow-400 bg-yellow-50"
      case "revisions_requested": return "text-red-400 bg-red-50"
      case "evaluated": return "text-green-400 bg-green-50"
      case "awaiting_student_signature": return "text-blue-400 bg-blue-50"
      case "awaiting_consultant_signature": return "text-purple-400 bg-purple-50"
      case "awaiting_supervisor_signature": return "text-indigo-400 bg-indigo-50"
      default: return "text-gray-400 bg-gray-50"
    }
  }

  const getStatusText = (thesis) => {
    if (thesis?.finalGrade && thesis?.status === "evaluated") return "Оценено - Рецензия подписана"
    if (thesis?.finalGrade && thesis?.status === "under_review") return "Проверка завершена - Ожидание подписи"
    switch (thesis?.status) {
      case "submitted": return "Отправлено - Ожидание назначения"
      case "with_consultant": return user?.consultant ? "На проверке у консультанта" : "На проверке у руководителя"
      case "with_supervisor": return "На проверке у руководителя"
      case "under_review": return "На финальной проверке"
      case "revisions_requested": return "Требуются исправления"
      case "evaluated": return "Оценено"
      case "awaiting_student_signature": return "Ожидает вашей подписи"
      case "awaiting_consultant_signature": return "Ожидает подписи консультанта"
      case "awaiting_supervisor_signature": return "Ожидает подписи руководителя"
      default: return "Не отправлено"
    }
  }

  const hasAssignedSupervisor = !!user?.supervisor
  const hasAssignedConsultant = !!user?.consultant
  const hasAssignedTeam = !!(user?.supervisor || user?.consultant || user?.reviewer)
  const canUploadThesis = hasAssignedSupervisor && user?.isTopicApproved
  const hasSupervisorProposedTopic = user?.topicProposedBy === "supervisor" && user?.studentTopicResponse?.status === "pending"

  const filteredSupervisors = useMemo(() => {
    if (!Array.isArray(availableSupervisors)) return []
    if (!searchQuery.trim()) return availableSupervisors
    const query = searchQuery.toLowerCase()
    return availableSupervisors.filter((sup) => {
      const name = (sup.fullName || "").toLowerCase()
      const position = (sup.position || "").toLowerCase()
      const department = (sup.department || "").toLowerCase()
      const email = (sup.email || "").toLowerCase()
      return name.includes(query) || position.includes(query) || department.includes(query) || email.includes(query)
    })
  }, [availableSupervisors, searchQuery])

  const getSupervisorRequestStatus = useCallback((supervisorId) => {
    const request = myRequests.find((req) => req.supervisorId === supervisorId)
    return request?.status || null
  }, [myRequests])

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

      {/* Модальное окно для ответа на предложенную тему */}
      <Modal
        isOpen={showTopicResponseModal}
        onClose={() => {
          setShowTopicResponseModal(false)
          setResponseComments("")
          setTopicProposal("")
        }}
        title="Предложение своей темы дипломной работы"
        subtitle={`Научный руководитель: ${supervisorInfo?.fullName || supervisorInfo?.name}`}
        size="full"
      >
        <div className="p-4">
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-[#372579] text-white p-5 rounded-lg">
              <div className="flex items-center gap-3">
                <FiAlertCircle className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-semibold">Предложение своей темы ВКР</h3>
                  <p className="text-sm opacity-90 mt-1">Научный руководитель предложил тему. Вы можете отклонить её и предложить свою</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FiUser className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-800">Предложенная научным руководителем тема:</p>
              </div>
              <p className="text-gray-900 pl-6">"{user?.thesisTopic || 'Тема не указана'}"</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Причина отказа <span className="text-red-500">*</span></label>
                <textarea
                  value={responseComments}
                  onChange={(e) => setResponseComments(e.target.value)}
                  placeholder="Пожалуйста, укажите причину, почему вы отклоняете предложенную тему..."
                  rows="4"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#372579]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ваша предлагаемая тема <span className="text-red-500">*</span></label>
                <textarea
                  value={topicProposal}
                  onChange={(e) => setTopicProposal(e.target.value)}
                  placeholder="Введите вашу предлагаемую тему дипломной работы..."
                  rows="6"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#372579]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button onClick={() => setShowTopicResponseModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200">
                Отмена
              </button>
              <button
                onClick={() => handleRespondToTopic(false, responseComments, topicProposal.trim())}
                disabled={isResponding || !responseComments.trim() || !topicProposal.trim()}
                className="flex-1 bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResponding ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Отклонить и предложить свою тему</>}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#372579] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">Д</span>
            </div>
            <button onClick={() => navigate("/profile")} className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
              <div className="w-8 h-8 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.fullName?.split(" ").map((name) => name[0]).join("").toUpperCase().slice(0, 2) || "П"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs capitalize">{user?.role === "student" ? "Студент" : user?.role}</p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm">
              <FiRefreshCw className="w-4 h-4" />
              Обновить
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
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
              {hasAssignedTeam ? "Управляйте своей дипломной работой и следите за процессом проверки." : "Сначала выберите научного руководителя."}
            </p>
          </div>

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
                      <p className="text-gray-900 font-medium text-sm">{supervisorInfo.fullName || supervisorInfo.name}</p>
                    </div>
                  )}
                  {consultantInfo && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-700 text-xs font-medium mb-1">Консультант</p>
                      <p className="text-gray-900 font-medium text-sm">{consultantInfo.fullName || consultantInfo.name}</p>
                    </div>
                  )}
                  {reviewerInfo && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-xs font-medium mb-1">Рецензент</p>
                      <p className="text-gray-900 font-medium text-sm">{reviewerInfo.fullName || reviewerInfo.name}</p>
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
                </div>
              </div>

              {/* Кнопка для заполнения объёмного задания */}
              {!thesis && user?.isTopicApproved && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowThesisContentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors"
                  >
                    <FiBook className="w-4 h-4" />
                    Заполнить объёмное задание
                  </button>
                  <p className="text-xs text-gray-500 mt-2">Заполните структуру работы для формирования задания</p>
                </div>
              )}

              {/* Форма загрузки диплома */}
              {thesis ? (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FiUpload className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Загруженная дипломная работа</h2>
                      <p className="text-gray-600">Ваша дипломная работа загружена и находится на проверке</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-900 font-medium">{thesis.title}</p>
                          <p className="text-sm text-gray-500">Статус: {getStatusText(thesis)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleDownloadThesis} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                            <FiDownload className="w-4 h-4" /> Скачать
                          </button>
                          <button onClick={handleViewPDF} className="flex items-center gap-2 px-3 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f]">
                            <FiEye className="w-4 h-4" /> Просмотреть
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Отображение итоговой оценки */}
                    {thesis.finalGrade && thesis.status === "evaluated" && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-medium text-green-800">Итоговая оценка:</p>
                        <p className="text-2xl font-bold text-green-600">{thesis.finalGrade}</p>
                      </div>
                    )}

                    {thesis.status === "revisions_requested" && (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-3">
                          <FiAlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800 mb-1">Комментарий научного руководителя:</p>
                            <p className="text-gray-700">{thesis.supervisorFeedback?.comments || "Требуются исправления"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {thesis.status === "revisions_requested" && (
                      <div className="border-t border-gray-200 pt-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Загрузить исправленную версию</label>
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3" />
                          </div>
                          <button type="submit" disabled={isUploading || !file} className="w-full bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50">
                            {isUploading ? "Загрузка..." : "Загрузить исправленную версию"}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FiUpload className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Загрузка диплома</h2>
                      <p className="text-gray-600">Загрузите ваш диплом в формате PDF</p>
                    </div>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="file" accept="application/pdf" onChange={handleFileChange} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3" required />
                    <button type="submit" disabled={isUploading || !file} className="w-full bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50">
                      {isUploading ? "Загрузка..." : "Загрузить диплом"}
                    </button>
                  </form>
                </div>
              )}

              {/* Блок подписания рецензии студентом */}
              {thesis && thesis.status === "awaiting_student_signature" && (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FiBook className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Подписание рецензии</h2>
                      <p className="text-gray-600">
                        Научный руководитель сформировал рецензию. Пожалуйста, подпишите её и загрузите обратно.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={async () => {
                        try {
                          const blob = await thesisAPI.getUnsignedReviewForStudent(thesis.id);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `review_to_sign_${thesis.id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          showToast("PDF загружен. Откройте в Chrome, подпишите и вернитесь для загрузки.", "success");
                        } catch (err) {
                          console.error(err);
                          showToast("Не удалось загрузить рецензию", "error");
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors"
                    >
                      <FiDownload className="w-4 h-4" />
                      Скачать рецензию для подписи
                    </button>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Загрузить подписанную рецензию</p>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          try {
                            await thesisAPI.uploadStudentSignedReview(thesis.id, file);
                            if (user?.consultant) {
                              showToast("Подписанная рецензия загружена! Теперь ожидает подписи консультанта.", "success");
                            } else {
                              showToast("Подписанная рецензия загружена! Теперь ожидает подписи руководителя.", "success");
                            }
                            await fetchThesis(true);
                            await refreshUser();
                          } catch (err) {
                            console.error(err);
                            showToast(err.response?.data?.error || "Ошибка загрузки", "error");
                          }
                        }}
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Подпишите PDF с помощью встроенных инструментов Chrome (значок пера/рисования), затем сохраните и загрузите файл.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Блок информирования о том, что рецензия у консультанта на подписи */}
              {thesis && thesis.status === "awaiting_consultant_signature" && (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <FiUsers className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Рецензия на подписи у консультанта</h2>
                      <p className="text-gray-600">
                        Вы подписали рецензию. Теперь её должен подписать консультант, после чего она поступит научному руководителю.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {!hasAssignedTeam ? (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FiUser className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Шаг 1: Выбор научного руководителя</h2>
                      <p className="text-gray-600 text-sm mt-1">Выберите научного руководителя из списка специалистов вашего факультета</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Поиск по имени, кафедре, должности..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#372579]" />
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {isLoadingSupervisors ? (
                      <div className="py-8 text-center text-gray-500">Загрузка...</div>
                    ) : filteredSupervisors.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">Научные руководители не найдены</div>
                    ) : (
                      filteredSupervisors.map((supervisor) => {
                        const requestStatus = getSupervisorRequestStatus(supervisor.id)
                        const hasPendingRequest = requestStatus === "pending"
                        const isAccepted = requestStatus === "accepted"
                        const isDeclined = requestStatus === "declined"
                        const isRequesting = requestingStates[supervisor.id] || false

                        return (
                          <div key={supervisor.id} className="p-4 border border-gray-200 rounded-lg hover:border-[#372579] hover:bg-blue-50 transition-all bg-white">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">{supervisor.fullName}</p>
                                  {hasPendingRequest && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Ожидание ответа</span>}
                                  {isAccepted && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Принято</span>}
                                  {isDeclined && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Отклонено</span>}
                                </div>
                                {supervisor.position && <p className="text-sm text-gray-600 mt-1">{supervisor.position}</p>}
                                {supervisor.department && <p className="text-sm text-gray-500 mt-0.5">{supervisor.department}</p>}
                              </div>
                              <button
                                onClick={() => handleRequestSupervisor(supervisor.id)}
                                disabled={hasPendingRequest || isAccepted || isRequesting}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${hasPendingRequest || isAccepted ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-[#372579] text-white hover:bg-[#2a1d5f]"}`}
                              >
                                {isRequesting ? "Отправка..." : hasPendingRequest ? "Ожидание" : isAccepted ? "Принято" : "Отправить запрос"}
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FiUsers className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Назначенная команда</h2>
                      <p className="text-gray-600">Вам назначена команда для работы над дипломом</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {supervisorInfo && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-orange-700 text-xs font-medium mb-1">Научный руководитель</p>
                        <p className="text-gray-900 font-medium text-sm">{supervisorInfo.fullName || supervisorInfo.name}</p>
                      </div>
                    )}
                    {consultantInfo && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-purple-700 text-xs font-medium mb-1">Консультант</p>
                        <p className="text-gray-900 font-medium text-sm">{consultantInfo.fullName || consultantInfo.name}</p>
                      </div>
                    )}
                    {reviewerInfo && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-700 text-xs font-medium mb-1">Рецензент</p>
                        <p className="text-gray-900 font-medium text-sm">{reviewerInfo.fullName || reviewerInfo.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasAssignedTeam && (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FiBook className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Шаг 2: Утверждение темы диплома</h2>
                      
                      {user?.topicProposedBy === "supervisor" && user?.studentTopicResponse?.status === "pending" && (
                        <div className="space-y-4">
                          <p className="text-gray-600">Ваш научный руководитель предложил тему. Пожалуйста, примите или отклоните её.</p>
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="font-medium text-blue-800 mb-2">Предложенная тема:</p>
                            <p className="text-gray-900 text-lg">"{user.thesisTopic || 'Тема не указана'}"</p>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => handleRespondToTopic(true, "Принято")} disabled={isResponding} className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50">
                              Принять тему
                            </button>
                            <button onClick={() => setShowTopicResponseModal(true)} disabled={isResponding} className="flex-1 bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50">
                              Предложить свою тему
                            </button>
                          </div>
                        </div>
                      )}

                      {user?.topicProposedBy === "supervisor" && user?.studentTopicResponse?.status === "accepted" && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="font-medium text-green-800 mb-2">Вы приняли предложенную тему</p>
                          <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                        </div>
                      )}

                      {user?.topicProposedBy === "student" && !user?.isTopicApproved && (
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="font-medium text-yellow-800 mb-2">Ваша предложенная тема:</p>
                          <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                          <p className="text-gray-500 text-sm mt-2">Отправлена на утверждение</p>
                        </div>
                      )}

                      {user?.isTopicApproved && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="font-medium text-green-800 mb-2">Тема утверждена</p>
                          <p className="text-gray-900 text-lg">"{user.thesisTopic}"</p>
                        </div>
                      )}

                      {!user?.thesisTopic && !user?.isTopicApproved && user?.topicProposedBy !== "supervisor" && (
                        <form onSubmit={handleSubmitTopic} className="space-y-4">
                          <p className="text-gray-600">Предложите тему диплома для утверждения научным руководителем.</p>
                          <textarea value={topicProposal} onChange={(e) => setTopicProposal(e.target.value)} placeholder="Введите предлагаемую тему..." rows="4" className="w-full border border-gray-300 rounded-lg px-4 py-3" required />
                          <button type="submit" disabled={isSubmittingTopic} className="w-full bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50">
                            Отправить тему
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Просмотр подписанной рецензии */}
          {showSignedReview && selectedThesisForReview && (
            <SignedReviewViewer
              thesisId={selectedThesisForReview.id}
              onClose={() => {
                setShowSignedReview(false)
                setSelectedThesisForReview(null)
              }}
              isStudent={true}
            />
          )}

          {thesis && thesis.status === "evaluated" && !showSignedReview && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Рецензия на диплом</h2>
                  <p className="text-gray-600">Просмотрите подписанную рецензию.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedThesisForReview(thesis)
                  setShowSignedReview(true)
                }}
                className="px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors"
              >
                <FiEye className="w-4 h-4 inline mr-2" />
                Просмотреть подписанную рецензию
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно для объёмного задания */}
      <Modal
        isOpen={showThesisContentModal}
        onClose={() => setShowThesisContentModal(false)}
        title="Объёмное задание на выпускную квалификационную работу"
        size="full"
      >
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Исходные данные */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Исходные данные</h3>
              {thesisContent.sourceData.map((data, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input type="text" value={data} onChange={(e) => updateSourceData(idx, e.target.value)} placeholder={`Исходное данное ${idx + 1}`} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#372579]" />
                  <button type="button" onClick={() => removeSourceData(idx)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"><FiX className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={addSourceData} className="text-sm text-[#372579] hover:underline mt-2">+ Добавить исходное данное</button>
            </div>

            {/* Введение */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Введение</h3>
              <div className="space-y-3">
                <input type="text" value={thesisContent.introduction.title} onChange={(e) => setThesisContent(prev => ({ ...prev, introduction: { ...prev.introduction, title: e.target.value } }))} placeholder="Название введения" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={thesisContent.introduction.percentage} onChange={(e) => setThesisContent(prev => ({ ...prev, introduction: { ...prev.introduction, percentage: e.target.value } }))} placeholder="Процент выполнения (например: 5%)" className="px-4 py-2 border border-gray-300 rounded-lg" />
                  <input type="text" value={thesisContent.introduction.deadline} onChange={(e) => setThesisContent(prev => ({ ...prev, introduction: { ...prev.introduction, deadline: e.target.value } }))} placeholder="Дедлайн" className="px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Главы */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Главы</h3>
              {thesisContent.chapters.map((chapter, chIdx) => (
                <div key={chIdx} className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-700">Глава {chIdx + 1}</h4>
                    <button type="button" onClick={() => removeChapter(chIdx)} className="text-red-600 hover:text-red-800"><FiX className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-3">
                    <input type="text" value={chapter.title} onChange={(e) => updateChapter(chIdx, 'title', e.target.value)} placeholder="Название главы" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={chapter.percentage} onChange={(e) => updateChapter(chIdx, 'percentage', e.target.value)} placeholder="Процент выполнения" className="px-4 py-2 border border-gray-300 rounded-lg" />
                      <input type="text" value={chapter.deadline} onChange={(e) => updateChapter(chIdx, 'deadline', e.target.value)} placeholder="Дедлайн" className="px-4 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    
                    <div className="ml-4 mt-3">
                      <p className="text-sm font-medium text-gray-600 mb-2">Подглавы:</p>
                      {chapter.subchapters.map((sub, subIdx) => (
                        <div key={subIdx} className="flex gap-2 mb-2">
                          <input type="text" value={sub} onChange={(e) => updateSubchapter(chIdx, subIdx, e.target.value)} placeholder={`Подглава ${subIdx + 1}`} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                          <button type="button" onClick={() => removeSubchapter(chIdx, subIdx)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"><FiX className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addSubchapter(chIdx)} className="text-sm text-[#372579] hover:underline">+ Добавить подглаву</button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addChapter} className="text-sm text-[#372579] hover:underline mt-2">+ Добавить главу</button>
            </div>

            {/* Заключение */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">4. Заключение</h3>
              <div className="space-y-3">
                <input type="text" value={thesisContent.conclusion.title} onChange={(e) => setThesisContent(prev => ({ ...prev, conclusion: { ...prev.conclusion, title: e.target.value } }))} placeholder="Название заключения" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={thesisContent.conclusion.percentage} onChange={(e) => setThesisContent(prev => ({ ...prev, conclusion: { ...prev.conclusion, percentage: e.target.value } }))} placeholder="Процент выполнения" className="px-4 py-2 border border-gray-300 rounded-lg" />
                  <input type="text" value={thesisContent.conclusion.deadline} onChange={(e) => setThesisContent(prev => ({ ...prev, conclusion: { ...prev.conclusion, deadline: e.target.value } }))} placeholder="Дедлайн" className="px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Список литературы и Приложение */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Список литературы</h3>
                <input type="text" value={thesisContent.sources.title} onChange={(e) => setThesisContent(prev => ({ ...prev, sources: { title: e.target.value } }))} placeholder="Название раздела" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Приложение</h3>
                <input type="text" value={thesisContent.appendix.title} onChange={(e) => setThesisContent(prev => ({ ...prev, appendix: { title: e.target.value } }))} placeholder="Название раздела" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button onClick={() => setShowThesisContentModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200">Отмена</button>
              <button onClick={saveThesisContent} disabled={isSavingContent} className="flex-1 bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingContent ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Сохранить задание"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default StudentDashboard
