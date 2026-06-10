import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiClock,
  FiCheck,
  FiDownload,
  FiEye,
  FiLogOut,
  FiRefreshCw,
  FiEdit,
  FiUsers,
  FiMessageSquare,
  FiBook,
  FiSend,
  FiX,
  FiAlertCircle,
  FiUpload,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"
import SupervisorReviewAssessment from "../components/SupervisorReviewAssessment"
import SignedReviewViewer from "../components/SignedReviewViewer"

const SupervisorDashboard = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [assignedTheses, setAssignedTheses] = useState([])
  const [completedReviews, setCompletedReviews] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [studentRequests, setStudentRequests] = useState([])
  const [myStudents, setMyStudents] = useState([])
  const [studentsStats, setStudentsStats] = useState({})
  const [activeTab, setActiveTab] = useState("students")
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedThesis, setSelectedThesis] = useState(null)
  const [showSignedReview, setShowSignedReview] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [proposedTopic, setProposedTopic] = useState("")
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false)
  const [respondingRequestId, setRespondingRequestId] = useState(null)
  const [studentFilter, setStudentFilter] = useState('all')
  const { toast, showToast, hideToast } = useToast()

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentName, setSelectedStudentName] = useState("")
  const [selectedStudentTopic, setSelectedStudentTopic] = useState("")
  const [rejectComments, setRejectComments] = useState("")

  const fetchedRef = useRef(false)
  const isFetchingRef = useRef(false)

  const fetchTheses = useCallback(async () => {
    if (!user || user.role !== "supervisor") return

    try {
      setIsLoading(true)
      console.log("[Научный руководитель] Загрузка данных для руководителя:", user?.id)

      const [assigned, completed, pending, studentsData, requests] = await Promise.allSettled([
        thesisAPI.getSupervisorAssignedTheses(),
        thesisAPI.getSupervisorCompletedReviews(),
        thesisAPI.getPendingTopicApprovals(),
        thesisAPI.getMyStudents(),
        thesisAPI.getMySupervisorRequests(),
      ])

      const assignedData = assigned.status === "fulfilled" ? assigned.value : []
      const completedData = completed.status === "fulfilled" ? completed.value : []
      const pendingData = pending.status === "fulfilled" ? pending.value?.data || [] : []
      const studentsResult = studentsData.status === "fulfilled" ? studentsData.value : {}
      const requestsData = requests.status === "fulfilled" ? requests.value?.requests || [] : []

      console.log("[Научный руководитель] Получено студентов:", studentsResult.students?.length)
      console.log("[Научный руководитель] Получено запросов:", requestsData?.length)

      setAssignedTheses(Array.isArray(assignedData) ? assignedData : [])
      setCompletedReviews(Array.isArray(completedData) ? completedData : [])
      setPendingApprovals(Array.isArray(pendingData) ? pendingData : [])
      setStudentRequests(Array.isArray(requestsData) ? requestsData : [])

      const studentsWithStages = (studentsResult.students || []).map(student => {
        const thesis = student.hasThesis ? student.thesis : null
        return {
          ...student,
          stage: determineStudentStage(student, thesis)
        }
      })
      
      setMyStudents(studentsWithStages)
      setStudentsStats(studentsResult.stats || {})

      console.log("[Научный руководитель] Количество моих студентов:", studentsResult.students?.length || 0)
      console.log("[Научный руководитель] Статистика студентов:", studentsResult.stats)

      fetchedRef.current = true
    } catch (error) {
      console.error("[Научный руководитель] Ошибка загрузки данных:", error)
      showToast("Не удалось загрузить данные", "error")
    } finally {
      setIsLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    if (user && user.role === "supervisor" && !fetchedRef.current) {
      fetchTheses()
    }
  }, [user, fetchTheses])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && user.role === "supervisor") {
        console.log("[Научный руководитель] Страница стала видимой, обновление данных")
        refreshUser()
        fetchTheses()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user, refreshUser, fetchTheses])

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

  const handleRespondToRequest = async (requestId, action) => {
    try {
      setRespondingRequestId(requestId)

      let declineReason = ""
      if (action === "decline") {
        declineReason = prompt("Укажите причину отклонения заявки (необязательно):")
        if (declineReason === null) {
          setRespondingRequestId(null)
          return
        }
      }

      await thesisAPI.respondToSupervisorRequest(requestId, action, declineReason)

      showToast(action === "accept" ? "Заявка принята! Студент добавлен в ваш список." : "Заявка отклонена", "success")

      await refreshUser()
      await fetchTheses()
    } catch (error) {
      console.error("[Научный руководитель] Ошибка обработки запроса:", error)
      showToast("Не удалось обработать заявку", "error")
    } finally {
      setRespondingRequestId(null)
    }
  }

  const handleDeclineRequest = (requestId) => {
    handleRespondToRequest(requestId, "decline")
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
      case "with_supervisor":
        return "bg-orange-100 text-orange-700 border-orange-200"
      case "with_consultant":
        return "bg-purple-100 text-purple-700 border-purple-200"
      case "under_review":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "revisions_requested":
        return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "evaluated":
        return "bg-green-100 text-green-700 border-green-200"
      case "awaiting_student_signature":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "awaiting_consultant_signature":
        return "bg-purple-100 text-purple-700 border-purple-200"
      case "awaiting_supervisor_signature":
        return "bg-indigo-100 text-indigo-700 border-indigo-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getTopicStatusColor = (student) => {
    if (student.isTopicApproved) return 'bg-green-100 text-green-700 border-green-200';
    if (student.topicProposedBy === 'student') {
      if (student.topicRejectionComments) return 'bg-red-100 text-red-700 border-red-200';
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    if (student.topicProposedBy === 'supervisor') {
      if (student.studentTopicResponse?.status === 'accepted') return 'bg-green-100 text-green-700';
      if (student.studentTopicResponse?.status === 'rejected') return 'bg-red-100 text-red-700';
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const getTopicStatusText = (student) => {
    if (student.isTopicApproved) return 'Утверждена';
    if (student.topicProposedBy === 'student') {
      if (student.topicRejectionComments) return 'Отклонена вами';
      return 'На утверждении';
    }
    if (student.topicProposedBy === 'supervisor') {
      if (student.studentTopicResponse?.status === 'accepted') return 'Принята студентом';
      if (student.studentTopicResponse?.status === 'rejected') return 'Отклонена студентом';
      return 'Предложена руководителем';
    }
    return 'Не определён';
  };

  const getStatusText = (status) => {
    switch (status) {
      case "with_supervisor":
        return "На рассмотрении руководителя"
      case "with_consultant":
        return "На рассмотрении консультанта"
      case "under_review":
        return "На рассмотрении рецензента"
      case "revisions_requested":
        return "Требуются исправления"
      case "evaluated":
        return "Оценено"
      case "submitted":
        return "Отправлено"
      case "awaiting_student_signature":
        return "Ожидает подписи студента"
      case "awaiting_consultant_signature":
        return "Ожидает подписи консультанта"
      case "awaiting_supervisor_signature":
        return "Ожидает финальной подписи руководителя"
      default:
        return status || "Неизвестно"
    }
  }

  const getStatusDisplayText = (student) => {
    if (student.hasThesis) {
      switch (student.thesisStatus) {
        case "with_supervisor":
          return "На рассмотрении руководителя"
        case "with_consultant":
          return "На рассмотрении консультанта"
        case "under_review":
          return "На рассмотрении рецензента"
        case "revisions_requested":
          return "Требуются исправления"
        case "evaluated":
          return "Оценено"
        case "awaiting_student_signature":
          return "Ожидает подписи студента"
        case "awaiting_consultant_signature":
          return "Ожидает подписи консультанта"
        case "awaiting_supervisor_signature":
          return "Ожидает финальной подписи руководителя"  
        default:
          return student.thesisStatus || "Неизвестно"
      }
    }
    
    if (student.isTopicApproved) {
      return "Ожидает загрузки работы"
    }
    
    if (student.stage?.id === 2) {
      return "Тема на утверждении"
    }
    
    return "Не отправлено"
  }

  const getStageBadgeColor = (color) => {
    switch (color) {
      case 'gray':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'blue':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'yellow':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'orange':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'green':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'red':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const determineStudentStage = (student, thesis) => {
      if (!student.thesisTopic || student.thesisTopic.trim() === '') {
        return {
          id: 1,
          name: 'Нет темы',
          description: 'Студент не предложил тему ВКР',
          canProposeTopic: true,
          needsAction: false,
          color: 'gray'
        };
      }
      
      if (student.topicProposedBy === 'student' && !student.isTopicApproved && !student.topicRejectionComments) {
        return {
          id: 2,
          name: 'Тема на утверждении',
          description: 'Студент предложил тему, требуется ваше утверждение',
          canApproveTopic: true,
          canRejectTopic: true,
          needsAction: true,
          color: 'orange'
        };
      }
      
      if (student.topicProposedBy === 'student' && student.topicRejectionComments && !student.isTopicApproved) {
        return {
          id: 2.5,
          name: 'Тема отклонена',
          description: 'Вы отклонили тему студента. Можете предложить свою',
          canProposeTopic: true,
          needsAction: false,
          color: 'red'
        };
      }
      
      if (student.topicProposedBy === 'supervisor' && 
          student.studentTopicResponse?.status === 'pending') {
        return {
          id: 3,
          name: 'Ожидание ответа',
          description: 'Вы предложили тему, ждем ответа студента',
          needsAction: false,
          color: 'blue'
        };
      }

      if (student.topicProposedBy === 'supervisor' && 
          student.studentTopicResponse?.status === 'accepted') {
        return {
          id: 4,
          name: 'Тема принята',
          description: 'Студент принял ваше предложение',
          needsAction: false,
          color: 'green'
        };
      }
      
      if (student.topicProposedBy === 'supervisor' && 
          student.studentTopicResponse?.status === 'rejected' && 
          student.thesisTopic && 
          !student.isTopicApproved) {
        return {
          id: 5,
          name: 'Требуется утверждение',
          description: 'Студент отклонил вашу тему и предложил свою. Требуется ваше утверждение',
          canApproveTopic: true,
          canRejectTopic: true,
          needsAction: true,
          color: 'orange'
        };
      }
      
      if (student.isTopicApproved && (!thesis || student.thesisStatus === 'not_submitted')) {
        return {
          id: 6,
          name: 'Тема утверждена',
          description: 'Тема утверждена, ожидается загрузка дипломной работы',
          needsAction: false,
          color: 'green'
        };
      }
      
      const hasConsultant = !!student.consultant;
      
      if (student.thesisStatus === 'with_consultant' && hasConsultant) {
        return {
          id: 7,
          name: 'У консультанта',
          description: 'Дипломная работа находится на рассмотрении у консультанта',
          needsAction: false,
          color: 'blue'
        };
      }
      
      if (student.thesisStatus === 'with_supervisor' || 
          (student.thesisStatus === 'with_consultant' && !hasConsultant)) {
        return {
          id: 8,
          name: 'У руководителя',
          description: 'Дипломная работа находится на вашем рассмотрении',
          canReviewThesis: true,
          needsAction: true,
          color: 'orange'
        };
      }
      
      if (student.thesisStatus === 'under_review') {
        return {
          id: 9,
          name: 'У рецензента',
          description: 'Дипломная работа находится на рассмотрении у рецензента',
          needsAction: false,
          color: 'blue'
        };
      }
      
      if (student.thesisStatus === 'revisions_requested') {
        return {
          id: 10,
          name: 'Требуются исправления',
          description: student.supervisorRevisionComment || 'Требуются исправления в дипломной работе',
          needsAction: false,
          color: 'yellow'
        };
      }
      
      if (student.thesisStatus === 'evaluated') {
        return {
          id: 11,
          name: 'Оценено',
          description: 'Дипломная работа оценена',
          needsAction: false,
          color: 'green'
        };
      }
      
      if (student.thesisStatus === 'awaiting_student_signature') {
        return {
          id: 12,
          name: 'Ожидает подписи студента',
          description: 'Рецензия сформирована, ожидает подписи студента',
          needsAction: false,
          color: 'blue'
        };
      }
      
      if (student.thesisStatus === 'awaiting_consultant_signature') {
        return {
          id: 13,
          name: 'Ожидает подписи консультанта',
          description: 'Студент подписал рецензию, ожидает подписи консультанта',
          needsAction: false,
          color: 'purple'
        };
      }
      
      if (student.thesisStatus === 'awaiting_supervisor_signature') {
        return {
          id: 14,
          name: 'Ожидает финальной подписи',
          description: 'Студент (и консультант) подписали рецензию, требуется ваша финальная подпись',
          canFinalSign: true,
          needsAction: true,
          color: 'indigo'
        };
      }
      
      return {
        id: 0,
        name: 'Неизвестно',
        description: 'Статус не определен',
        needsAction: false,
        color: 'gray'
      };
  }

  const hasRejectedTopic = (student) => {
    return student.topicProposedBy === 'student' && 
           !student.isTopicApproved && 
           student.topicRejectionComments
  }

  const filteredStudents = useMemo(() => {
    if (studentFilter === 'all') return myStudents
    if (studentFilter === 'needsAction') return myStudents.filter(s => s.stage?.needsAction)
    if (studentFilter === 'noTopic') return myStudents.filter(s => s.stage?.id === 1)
    if (studentFilter === 'topicPending') return myStudents.filter(s => s.stage?.id === 2)
    if (studentFilter === 'topicRejected') return myStudents.filter(hasRejectedTopic)
    return myStudents
  }, [myStudents, studentFilter])

  const openRejectModal = (studentId, studentName, studentTopic) => {
    setSelectedStudentId(studentId)
    setSelectedStudentName(studentName)
    setSelectedStudentTopic(studentTopic)
    setRejectComments("")
    setProposedTopic("")
    setShowRejectModal(true)
  }

  const handleRejectTopic = async () => {
    if (!rejectComments.trim()) {
      showToast("Пожалуйста, укажите причину отклонения", "error")
      return
    }

    try {
      if (proposedTopic.trim()) {
        await thesisAPI.approveStudentTopic(selectedStudentId, false, rejectComments.trim())
        await thesisAPI.proposeTopicToStudent(selectedStudentId, proposedTopic.trim())
        showToast("Тема отклонена и предложена новая тема!", "success")
      } else {
        await thesisAPI.approveStudentTopic(selectedStudentId, false, rejectComments.trim())
        showToast("Тема отклонена", "success")
      }

      setShowRejectModal(false)
      setSelectedStudentId(null)
      setSelectedStudentName("")
      setSelectedStudentTopic("")
      setRejectComments("")
      setProposedTopic("")
      await fetchTheses()
    } catch (error) {
      showToast(error.response?.data?.error || "Не удалось отклонить тему", "error")
    }
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели научного руководителя...</p>
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
            <div className="w-8 h-8 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
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
                    .slice(0, 2) || "РУ"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs">Научный руководитель</p>
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
              <span className="text-white font-bold text-xl">РУ</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Панель научного руководителя</h1>
            <p className="text-gray-600">Управление студентами и рецензирование дипломных работ</p>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "requests" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Запросы студентов ({studentRequests.length})
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "students" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Студенты ({myStudents.length})
            </button>
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

          {/* Запросы студентов */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              {studentRequests.length > 0 ? (
                studentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {getInitials(request.student?.name || request.student?.fullName)}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {request.student?.name || request.student?.fullName}
                            </h3>
                            <p className="text-gray-600 text-sm">{request.student?.email}</p>
                            {request.student?.program && (
                              <p className="text-gray-500 text-xs">{request.student.program}</p>
                            )}
                          </div>
                        </div>
                        <div className="ml-13 space-y-2">
                          <p className="text-sm text-gray-900">
                            Факультет:{" "}
                            <span className="font-medium">
                              {request.faculty || request.student?.faculty || "не указано"}
                            </span>
                          </p>
                          <p className="text-sm text-gray-900">
                            Сообщение студента:{" "}
                            <span className="font-medium">
                              {request.studentMessage?.trim() || "Студент не оставил комментарий"}
                            </span>
                          </p>
                          {request.createdAt && (
                            <p className="text-xs text-gray-500">
                              Отправлено:{" "}
                              {new Date(request.createdAt).toLocaleString("ru-RU", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full max-w-xs">
                        <button
                          onClick={() => handleRespondToRequest(request.id, "accept")}
                          disabled={respondingRequestId === request.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-60"
                        >
                          {respondingRequestId === request.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiCheck className="w-4 h-4" />
                          )}
                          Принять
                        </button>
                        <button
                          onClick={() => handleRespondToRequest(request.id, "decline")}
                          disabled={respondingRequestId === request.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-60"
                        >
                          <FiX className="w-4 h-4" />
                          Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiUsers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Нет новых запросов</h3>
                  <p className="text-gray-500">Студенты ещё не отправили запросы на прикрепление.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "students" && (
            <div className="space-y-4">
              {/* Статистика */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-600 text-xs mb-1">Всего</p>
                  <p className="text-xl font-bold text-gray-900">{myStudents.length}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-orange-600 text-xs mb-1">Требуют действия</p>
                  <p className="text-xl font-bold text-orange-900">
                    {myStudents.filter(s => s.stage?.needsAction === true).length}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-600 text-xs mb-1">На утверждении</p>
                  <p className="text-xl font-bold text-blue-900">{studentsStats.topicPendingApproval || 0}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-600 text-xs mb-1">Утверждено</p>
                  <p className="text-xl font-bold text-green-900">{studentsStats.topicApprovedNoWork || 0}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-purple-600 text-xs mb-1">На рецензии</p>
                  <p className="text-xl font-bold text-purple-900">{studentsStats.withSupervisor || 0}</p>
                </div>
              </div>

              {/* Фильтры */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setStudentFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${studentFilter === 'all' ? 'bg-[#372579] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Все студенты
                </button>
                <button
                  onClick={() => setStudentFilter('needsAction')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${studentFilter === 'needsAction' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                >
                  Требуют действия
                </button>
                <button
                  onClick={() => setStudentFilter('noTopic')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${studentFilter === 'noTopic' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Нет темы
                </button>
                <button
                  onClick={() => setStudentFilter('topicPending')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${studentFilter === 'topicPending' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                  Тема на утверждении
                </button>
                <button
                  onClick={() => setStudentFilter('topicRejected')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${studentFilter === 'topicRejected' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                >
                  Тема отклонена ({myStudents.filter(hasRejectedTopic).length})
                </button>
              </div>

              {/* Список студентов */}
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Заголовок студента */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">{getInitials(student.fullName)}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{student.fullName}</h3>
                                <p className="text-gray-600 text-sm">{student.email}</p>
                                <p className="text-gray-600 text-sm">
                                  {student.faculty} - {student.group}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStageBadgeColor(student.stage?.color)}`}>
                                  {student.stage?.name}
                                </span>
                                {student.stage?.needsAction && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                                    Требует действия
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="text-gray-600 text-sm mt-2">{student.stage?.description}</p>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Тема ВКР */}
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Тема ВКР</p>
                                {student.thesisTopic ? (
                                  <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-gray-900 font-medium">"{student.thesisTopic}"</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTopicStatusColor(student)}`}>
                                        {getTopicStatusText(student)}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {student.topicProposedBy === 'student' ? 'от студента' : 'от вас'}
                                      </span>
                                    </div>
                                    
                                    {student.topicProposedBy === 'supervisor' && 
                                    student.studentTopicResponse?.status === 'rejected' && 
                                    student.originalProposedTopic && (
                                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                                        <p className="text-xs text-blue-700">
                                          <span className="font-medium">Ваша предложенная тема:</span> "{student.originalProposedTopic}"
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Студент отклонил вашу тему и предложил свою
                                        </p>
                                      </div>
                                    )}
                                    
                                    {student.studentTopicResponse?.status === 'rejected' && student.studentTopicResponse?.comments && (
                                      <div className="p-2 bg-yellow-50 rounded border border-yellow-200 mt-2">
                                        <p className="text-xs text-yellow-700">
                                          <span className="font-medium">Комментарий студента:</span> {student.studentTopicResponse.comments}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {student.topicRejectionComments && (
                                      <div className="p-2 bg-red-50 rounded border border-red-200 mt-2">
                                        <p className="text-xs text-red-700">
                                          <span className="font-medium">Ваш комментарий при отклонении:</span> {student.topicRejectionComments}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-gray-500 italic">Тема не предложена</p>
                                )}
                              </div>

                              {/* Статус работы */}
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Статус работы</p>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                  {student.hasThesis ? (
                                    <>
                                      <p className="text-gray-900 font-medium">{student.thesis?.title}</p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeColor(student.thesisStatus)}`}>
                                          {getStatusDisplayText(student)}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          Отправлено: {new Date(student.thesis?.submissionDate).toLocaleDateString('ru-RU')}
                                        </span>
                                      </div>
                                      
                                      {student.thesisStatus === 'revisions_requested' && (
                                        <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                                          <p className="text-xs font-medium text-yellow-800 mb-1">Ваш комментарий к доработке:</p>
                                          <p className="text-xs text-gray-700">
                                            {student.supervisorFeedback?.comments ||
                                            student.thesis?.supervisorFeedback?.comments ||
                                            student.thesis?.supervisorReview?.revisionComment || 
                                            student.thesis?.supervisorReview?.comments || 
                                            "Комментарий не указан"}
                                          </p>
                                        </div>
                                      )}

                                      {/* Блок для статуса "У консультанта" */}
                                      {student.thesisStatus === 'with_consultant' && (
                                        <div className="mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                                          <p className="text-xs text-purple-700">
                                            Работа передана на проверку консультанту.
                                          </p>
                                        </div>
                                      )}
                                    </>
                                  ) : student.isTopicApproved ? (
                                    <p className="text-gray-900">Ожидается загрузка дипломной работы</p>
                                  ) : (
                                    <p className="text-gray-500">Дипломная работа не загружена</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Кнопки действий */}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {/* Этап 1: Нет темы */}
                              {student.stage?.id === 1 && student.stage?.canProposeTopic && (
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student)
                                    setShowTopicModal(true)
                                    setProposedTopic("")
                                  }}
                                  className="px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium flex items-center gap-2"
                                >
                                  <FiBook className="w-4 h-4" />
                                  Предложить тему
                                </button>
                              )}

                              {/* Этап 2: Тема на утверждении (студент предложил тему) */}
                              {student.stage?.id === 2 && student.stage?.canApproveTopic && !student.topicRejectionComments && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await thesisAPI.approveStudentTopic(student.id, true, "")
                                        showToast("Тема утверждена!", "success")
                                        await fetchTheses()
                                      } catch (error) {
                                        showToast("Не удалось утвердить тему", "error")
                                      }
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium flex items-center gap-2"
                                  >
                                    <FiCheck className="w-4 h-4" />
                                    Утвердить тему
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(student.id, student.fullName, student.thesisTopic)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium flex items-center gap-2"
                                  >
                                    <FiX className="w-4 h-4" />
                                    Отклонить тему
                                  </button>
                                </>
                              )}

                              {/* Этап 2.5: Тема была отклонена руководителем */}
                              {(student.stage?.id === 2.5 || (student.topicProposedBy === 'student' && student.topicRejectionComments)) && (
                                <button
                                  onClick={() => {
                                    setSelectedStudent(student)
                                    setShowTopicModal(true)
                                    setProposedTopic("")
                                  }}
                                  className="px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium flex items-center gap-2"
                                >
                                  <FiBook className="w-4 h-4" />
                                  Предложить тему
                                </button>
                              )}

                              {/* Этап 5: Студент отклонил тему руководителя и предложил свою */}
                              {student.stage?.id === 5 && student.stage?.canApproveTopic && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await thesisAPI.approveStudentTopic(student.id, true, "")
                                        showToast("Тема студента утверждена!", "success")
                                        await fetchTheses()
                                      } catch (error) {
                                        showToast("Не удалось утвердить тему", "error")
                                      }
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium flex items-center gap-2"
                                  >
                                    <FiCheck className="w-4 h-4" />
                                    Утвердить тему студента
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(student.id, student.fullName, student.thesisTopic)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium flex items-center gap-2"
                                  >
                                    <FiX className="w-4 h-4" />
                                    Отклонить тему студента
                                  </button>
                                </>
                              )}

                              {/* Этап 8: Дипломная работа у руководителя - требуется рецензия */}
                              {student.stage?.id === 8 && student.stage?.canReviewThesis && student.hasThesis && (
                                <button
                                  onClick={() => handleViewThesis(student.thesis)}
                                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center gap-2"
                                >
                                  <FiEdit className="w-4 h-4" />
                                  Рецензировать работу
                                </button>
                              )}

                              {/* Блок финальной подписи руководителя (статус awaiting_supervisor_signature) */}
                              {student.thesis?.status === "awaiting_supervisor_signature" && (
                                <div className="w-full mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <FiBook className="w-5 h-5 text-indigo-600" />
                                    <h4 className="font-medium text-indigo-800">Финальное подписание рецензии</h4>
                                  </div>
                                  <p className="text-sm text-indigo-700 mb-3">
                                    {student.consultant 
                                      ? "Студент и консультант уже подписали рецензию. Скачайте файл, подпишите его с помощью Chrome PDF-инструментов и загрузите финальную версию."
                                      : "Студент уже подписал рецензию. Скачайте файл, подпишите его с помощью Chrome PDF-инструментов и загрузите финальную версию."
                                    }
                                  </p>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <button
                                      onClick={async () => {
                                        try {
                                          const blob = await thesisAPI.getUnsignedSupervisorReview(student.thesis.id);
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = `final_review_${student.thesis.id}.pdf`;
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                          URL.revokeObjectURL(url);
                                          showToast("Файл загружен. Подпишите его в Chrome.", "success");
                                        } catch (err) {
                                          console.error(err);
                                          showToast("Ошибка загрузки файла", "error");
                                        }
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-[#372579] text-white rounded-lg text-sm hover:bg-[#2a1d5f] transition-colors"
                                    >
                                      <FiDownload className="w-4 h-4" />
                                      Скачать рецензию для подписи
                                    </button>
                                    <div>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        id={`final-upload-${student.id}`}
                                        className="hidden"
                                        onChange={async (e) => {
                                          const file = e.target.files[0];
                                          if (!file) return;
                                          try {
                                            await thesisAPI.uploadFinalSupervisorSignedReview(student.thesis.id, file);
                                            showToast("Финальная подписанная рецензия загружена. Работа передана рецензенту.", "success");
                                            await fetchTheses();
                                          } catch (err) {
                                            console.error(err);
                                            showToast(err.response?.data?.error || "Ошибка загрузки", "error");
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`final-upload-${student.id}`}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors cursor-pointer"
                                      >
                                        <FiUpload className="w-4 h-4" />
                                        Загрузить подписанный PDF
                                      </label>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-3">
                                    После подписания и загрузки работа будет автоматически направлена рецензенту.
                                  </p>
                                </div>
                              )}

                              {/* Общие кнопки для всех студентов с загруженной работой */}
                              {student.hasThesis && (
                                <button
                                  onClick={() => handleDownload(student.thesis.id, student.thesis.title)}
                                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-2"
                                >
                                  <FiDownload className="w-4 h-4" />
                                  Скачать работу
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiUsers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    {studentFilter === 'all' 
                      ? "Нет назначенных студентов" 
                      : "Нет студентов с выбранным фильтром"}
                  </h3>
                  <p className="text-gray-500">
                    {studentFilter === 'all' 
                      ? "Вам ещё не назначены студенты для работы." 
                      : "Попробуйте выбрать другой фильтр."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Assigned Theses Tab */}
          {activeTab === "assigned" && (
            <div className="space-y-4">
              {assignedTheses.filter(thesis => thesis.status !== 'revisions_requested').length > 0 ? (
                assignedTheses
                  .filter(thesis => thesis.status !== 'revisions_requested')
                  .map((thesis) => (
                    <div
                      key={thesis.id}
                      className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Student Info */}
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {getInitials(thesis.student?.fullName)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{thesis.student?.fullName}</h3>
                              <p className="text-gray-600 text-sm">{thesis.student?.email}</p>
                            </div>
                          </div>

                          {/* Thesis Details */}
                          <div className="ml-13 space-y-2">
                            <p className="text-gray-900 font-medium">{thesis.title || "Название работы не указано"}</p>
                            <p className="text-gray-600 text-sm">
                              {thesis.student?.faculty} - {thesis.student?.group}
                            </p>

                            {/* Status and Metadata */}
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

                            {/* Отображение комментария если есть */}
                            {thesis.supervisorReview?.revisionComment && (
                              <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                                <p className="text-xs font-medium text-yellow-800 mb-1">Ваш комментарий к доработке:</p>
                                <p className="text-xs text-gray-700">{thesis.supervisorReview.revisionComment}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
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
                            Рецензировать
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiMessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Работ для рассмотрения не найдено</h3>
                  <p className="text-gray-500">В данный момент нет работ, назначенных для вашего рассмотрения.</p>
                </div>
              )}
            </div>
          )}

          {/* Completed Reviews Tab */}
          {activeTab === "completed" && (
            <div className="space-y-4">
              {completedReviews.length > 0 ? (
                completedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Student Info */}
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {getInitials(review.student?.fullName)}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{review.student?.fullName}</h3>
                            <p className="text-gray-600 text-sm">{review.student?.email}</p>
                          </div>
                        </div>

                        {/* Thesis Details */}
                        <div className="ml-13 space-y-2">
                          <p className="text-gray-900 font-medium">{review.title}</p>
                          <p className="text-gray-600 text-sm">
                            {review.student?.faculty} - {review.student?.group}
                          </p>

                          {/* Status and Grade */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                              <FiClock className="w-4 h-4" />
                              <span>Рецензировано {new Date(review.approvedAt).toLocaleDateString("ru-RU")}</span>
                            </div>
                            <div className="flex items-center gap-2 text-green-600">
                              <FiCheck className="w-4 h-4" />
                              <span className="text-sm font-medium">Одобрено</span>
                            </div>
                            {review.finalGrade && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                Оценка: {review.finalGrade}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
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
                        {review.status === "evaluated" && (
                          <button
                            onClick={() => {
                              setSelectedThesis(review)
                              setShowSignedReview(true)
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            <FiEye className="w-4 h-4" />
                            Подписанная рецензия
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Завершённых рецензий нет</h3>
                  <p className="text-gray-500">Вы ещё не завершили ни одной рецензии.</p>
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
        title={`Рецензия на работу - ${selectedThesis?.student?.fullName}`}
        size="full"
      >
        {selectedThesis && (
          <SupervisorReviewAssessment thesisId={selectedThesis.id} thesis={selectedThesis} onClose={handleCloseModal} />
        )}
      </Modal>

      {/* Signed Review Viewer Modal */}
      {showSignedReview && selectedThesis && (
        <Modal
          isOpen={showSignedReview}
          onClose={() => {
            setShowSignedReview(false)
            setSelectedThesis(null)
          }}
          title="Подписанная рецензия"
          size="full"
        >
          <SignedReviewViewer
            thesisId={selectedThesis.id}
            onClose={() => {
              setShowSignedReview(false)
              setSelectedThesis(null)
            }}
          />
        </Modal>
      )}

      {/* Propose Topic Modal */}
      <Modal
        isOpen={showTopicModal}
        onClose={() => {
          setShowTopicModal(false)
          setSelectedStudent(null)
          setProposedTopic("")
        }}
        title="Предложить тему дипломной работы"
        subtitle={`Студент: ${selectedStudent?.fullName}`}
        size="medium" 
      >
        <div className="p-4"> 
          <div className="space-y-6 max-w-2xl mx-auto"> 
            <div className="bg-[#372579] text-white p-4 rounded-lg"> 
              <div className="flex items-center gap-3">
                <FiBook className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-semibold">Предложение темы ВКР</h3>
                  <p className="text-xs opacity-90 mt-1"> 
                    Введите тему дипломной работы для студента
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5"> 
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тема дипломной работы <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 text-gray-400">
                    <FiBook className="w-4 h-4" />
                  </div>
                  <textarea
                    value={proposedTopic}
                    onChange={(e) => setProposedTopic(e.target.value)}
                    placeholder="Введите тему дипломной работы..."
                    rows="8"
                    className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Тема будет отправлена студенту на рассмотрение. Студент может принять или отклонить её.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-5 border-t border-gray-200"> 
              <button
                onClick={() => {
                  setShowTopicModal(false)
                  setSelectedStudent(null)
                  setProposedTopic("")
                }}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <FiX className="w-4 h-4" />
                Отмена
              </button>
              <button
                onClick={async () => {
                  if (!proposedTopic.trim()) {
                    showToast("Пожалуйста, введите тему", "error")
                    return
                  }
                  try {
                    setIsSubmittingTopic(true)
                    await thesisAPI.proposeTopicToStudent(selectedStudent.id, proposedTopic.trim())
                    showToast("Тема предложена студенту!", "success")
                    setShowTopicModal(false)
                    setSelectedStudent(null)
                    setProposedTopic("")
                    await fetchTheses()
                  } catch (error) {
                    showToast(error.response?.data?.error || "Не удалось предложить тему", "error")
                  } finally {
                    setIsSubmittingTopic(false)
                  }
                }}
                disabled={isSubmittingTopic || !proposedTopic.trim()}
                className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingTopic ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <FiSend className="w-4 h-4" />
                    Предложить тему
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Модальное окно отклонения темы */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setSelectedStudentId(null)
          setSelectedStudentName("")
          setSelectedStudentTopic("")
          setRejectComments("")
          setProposedTopic("")
        }}
        title="Отклонение темы дипломной работы"
        subtitle={`Студент: ${selectedStudentName}`}
        size="full"
      >
        <div className="p-4"> 
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-[#372579] text-white p-5 rounded-lg">
              <div className="flex items-center gap-3">
                <FiAlertCircle className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-semibold">Отклонение темы ВКР</h3>
                  <p className="text-sm opacity-90 mt-1">
                    Укажите причину отклонения и предложите новую тему (опционально)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FiBook className="w-4 h-4 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-800">Предложенная студентом тема:</p>
              </div>
              <p className="text-gray-900 pl-6">"{selectedStudentTopic}"</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина отклонения <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 text-gray-400">
                    <FiMessageSquare className="w-4 h-4" />
                  </div>
                  <textarea
                    value={rejectComments}
                    onChange={(e) => setRejectComments(e.target.value)}
                    placeholder="Пожалуйста, укажите причину, почему вы отклоняете предложенную тему..."
                    rows="4"
                    className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Этот комментарий будет виден студенту.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Предложить свою тему (опционально)
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 text-gray-400">
                    <FiBook className="w-4 h-4" />
                  </div>
                  <textarea
                    value={proposedTopic}
                    onChange={(e) => setProposedTopic(e.target.value)}
                    placeholder="Вы можете сразу предложить студенту свою тему..."
                    rows="4"
                    className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all resize-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Если вы не хотите предлагать тему сейчас, оставьте поле пустым.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedStudentId(null)
                  setSelectedStudentName("")
                  setSelectedStudentTopic("")
                  setRejectComments("")
                  setProposedTopic("")
                }}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <FiX className="w-4 h-4" />
                Отмена
              </button>
              <button
                onClick={handleRejectTopic}
                disabled={!rejectComments.trim()}
                className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] focus:outline-none focus:ring-2 focus:ring-[#372579] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FiAlertCircle className="w-4 h-4" />
                {proposedTopic.trim() ? "Отклонить и предложить новую" : "Отклонить тему"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SupervisorDashboard
