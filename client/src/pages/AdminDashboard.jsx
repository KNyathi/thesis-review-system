import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiUsers,
  FiFilter,
  FiLogOut,
  FiUser,
  FiClock,
  FiTrash2,
  FiAlertTriangle,
  FiMoreHorizontal,
  FiRefreshCw,
  FiBook,
  FiAward,
  FiHelpCircle,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"

const AdminDashboard = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [allUsers, setUsers] = useState([])
  const [theses, setTheses] = useState([])
  const [approvedReviewers, setApprovedReviewers] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [consultants, setConsultants] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [activeTab, setActiveTab] = useState("students")
  const [isLoading, setIsLoading] = useState(true)
  const [filterOption, setFilterOption] = useState("all")
  const [userFilterOption, setUserFilterOption] = useState("all")
  const [assigningStudent, setAssigningStudent] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [assignmentData, setAssignmentData] = useState(null)
  const [selectedSupervisor, setSelectedSupervisor] = useState("")
  const [selectedConsultant, setSelectedConsultant] = useState("")
  const [selectedReviewer, setSelectedReviewer] = useState("")
  const [openDropdown, setOpenDropdown] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  const fetchedRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!user || user.role !== "admin") return

    try {
      setIsLoading(true)
      console.log("[v0] Fetching admin data")

      const [usersResponse, thesesResponse] = await Promise.allSettled([
        thesisAPI.getAllUsers(),
        thesisAPI.getAllTheses(),
      ])

      const usersData = usersResponse.status === "fulfilled" ? usersResponse.value : []
      const thesesData = thesesResponse.status === "fulfilled" ? thesesResponse.value : []

      console.log("[v0] Users fetched:", usersData.length)
      console.log("[v0] Theses fetched:", thesesData.length)

      setUsers(Array.isArray(usersData) ? usersData : [])
      setTheses(Array.isArray(thesesData) ? thesesData : [])

      const supervisorUsers = Array.isArray(usersData)
        ? usersData.filter((user) => user && user.role === "supervisor")
        : []
      const consultantUsers = Array.isArray(usersData)
        ? usersData.filter((user) => user && user.role === "consultant")
        : []
      const reviewerUsers = Array.isArray(usersData) ? usersData.filter((user) => user && user.role === "reviewer") : []
      const studentUsers = Array.isArray(usersData) ? usersData.filter((user) => user && user.role === "student") : []

      console.log("[v0] Supervisors:", supervisorUsers.length)
      console.log("[v0] Consultants:", consultantUsers.length)
      console.log("[v0] Reviewers:", reviewerUsers.length)
      console.log("[v0] Students:", studentUsers.length)

      setSupervisors(supervisorUsers)
      setConsultants(consultantUsers)
      setApprovedReviewers(reviewerUsers)
      setStudents(studentUsers)

      fetchedRef.current = true
    } catch (error) {
      console.error("[v0] Error fetching admin data:", error)
      showToast("Не удалось загрузить данные", "error")
    } finally {
      setIsLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    if (user && user.role === "admin" && !fetchedRef.current) {
      fetchData()
    }
  }, [user])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && user.role === "admin") {
        console.log("[v0] Page became visible, refreshing admin data")
        fetchedRef.current = false
        fetchData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user, fetchData])

  useEffect(() => {
    let filtered = [...students]

    if (filterOption === "assigned") {
      filtered = filtered.filter((student) => student.reviewer || student.supervisor || student.consultant)
    } else if (filterOption === "not_assigned") {
      filtered = filtered.filter((student) => !student.reviewer && !student.supervisor && !student.consultant)
    }

    setFilteredStudents(filtered)
  }, [students, filterOption])

  useEffect(() => {
    let filtered = [...allUsers]

    if (userFilterOption === "students") {
      filtered = filtered.filter((user) => user.role === "student")
    } else if (userFilterOption === "reviewers") {
      filtered = filtered.filter((user) => user.role === "reviewer")
    } else if (userFilterOption === "admins") {
      filtered = filtered.filter((user) => user.role === "admin")
    } else if (userFilterOption === "supervisors") {
      filtered = filtered.filter((user) => user.role === "supervisor")
    } else if (userFilterOption === "consultants") {
      filtered = filtered.filter((user) => user.role === "consultant")
    } else if (userFilterOption === "heads") {
      filtered = filtered.filter((user) => user.role === "head")
    } else if (userFilterOption === "deans") {
      filtered = filtered.filter((user) => user.role === "dean")
    }

    setFilteredUsers(filtered)
  }, [allUsers, userFilterOption])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleAssignTeam = async (studentId) => {
    if (!selectedSupervisor && !selectedConsultant && !selectedReviewer) {
      showToast("Пожалуйста, выберите хотя бы одного члена команды", "error")
      return
    }

    try {
      setAssigningStudent(studentId)

      console.log("[v0] Assigning team to student:", studentId)
      console.log("[v0] Supervisor:", selectedSupervisor)
      console.log("[v0] Consultant:", selectedConsultant)
      console.log("[v0] Reviewer:", selectedReviewer)

      await thesisAPI.assignThesisTeam({
        studentId,
        supervisorId: selectedSupervisor || undefined,
        consultantId: selectedConsultant || undefined,
        reviewerId: selectedReviewer || undefined,
      })

      console.log("[v0] Team assigned successfully")
      showToast("Команда успешно назначена!", "success")

      fetchedRef.current = false
      await fetchData()

      setShowAssignmentModal(false)
      setSelectedSupervisor("")
      setSelectedConsultant("")
      setSelectedReviewer("")
      setAssignmentData(null)
    } catch (error) {
      console.error("[v0] Error assigning team:", error)
      showToast(error.response?.data?.error || "Не удалось назначить команду", "error")
    } finally {
      setAssigningStudent(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      setDeletingUser(userToDelete.id)
      await thesisAPI.deleteUser(userToDelete.id)
      showToast(`Пользователь ${userToDelete.fullName} успешно удален!`, "success")
      fetchedRef.current = false
      await fetchData()
      setShowDeleteModal(false)
      setUserToDelete(null)
    } catch (error) {
      showToast("Не удалось удалить пользователя", "error")
    } finally {
      setDeletingUser(null)
    }
  }

  const openDeleteModal = (user) => {
    setUserToDelete(user)
    setShowDeleteModal(true)
    setOpenDropdown(null)
  }

  const openAssignmentModal = (student) => {
    setAssignmentData(student)
    setSelectedSupervisor(student.supervisor || "")
    setSelectedConsultant(student.consultant || "")
    setSelectedReviewer(student.reviewer || "")
    setShowAssignmentModal(true)
    setOpenDropdown(null)
  }

  const toggleDropdown = (userId) => {
    setOpenDropdown(openDropdown === userId ? null : userId)
  }

  const getStatusColor = (status, hasUploaded, hasTeam) => {
    if (!hasUploaded) {
      return "text-red-500"
    }
    if (!hasTeam) {
      return "text-amber-500"
    }
    switch (status) {
      case "submitted":
        return "text-blue-500"
      case "under_review":
        return "text-amber-500"
      case "evaluated":
        return "text-green-500"
      default:
        return "text-gray-500"
    }
  }

  const getStatusText = (status, hasUploaded, hasTeam) => {
    if (!hasUploaded) {
      return "Не загружено"
    }
    if (!hasTeam) {
      return "Ожидает н��значения команды"
    }
    switch (status) {
      case "under_review":
        return "На проверке"
      case "evaluated":
        return "Оценено"
      default:
        return "Ожидает отправки"
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case "student":
        return "bg-blue-100 text-blue-700"
      case "reviewer":
        return "bg-green-100 text-green-700"
      case "admin":
        return "bg-purple-100 text-purple-700"
      case "supervisor":
        return "bg-orange-100 text-orange-700"
      case "consultant":
        return "bg-indigo-100 text-indigo-700"
      case "head":
        return "bg-pink-100 text-pink-700"
      case "dean":
        return "bg-teal-100 text-teal-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getRoleText = (role) => {
    switch (role) {
      case "student":
        return "Студент"
      case "reviewer":
        return "Рецензент"
      case "admin":
        return "Администратор"
      case "supervisor":
        return "Научный руководитель"
      case "consultant":
        return "Консультант"
      case "head":
        return "Заведующий кафедрой"
      case "dean":
        return "Декан"
      default:
        return role
    }
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-montserrat">
        <div className="text-center">
          <h1 className="text-2xl font-comfortaa font-bold text-gray-900 mb-4">Доступ запрещен</h1>
          <p className="text-gray-600 mb-6">У вас нет прав для доступа к этой странице.</p>
          <button
            onClick={() => navigate(`/${user?.role || "login"}`)}
            className="px-6 py-3 bg-[#372579] text-white rounded-lg hover:bg-[#2a1a5e] transition-colors font-medium"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    )
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-montserrat">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели администратора...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-montserrat">
      <Toast {...toast} onClose={hideToast} />

      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
              >
                <div className="w-10 h-10 bg-[#372579] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm font-comfortaa">
                    {user?.fullName
                      ?.split(" ")
                      .map((name) => name[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "A"}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-gray-900 font-medium">{user?.fullName}</p>
                  <p className="text-gray-500 text-sm">{getRoleText(user?.role)}</p>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchedRef.current = false
                  fetchData()
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FiRefreshCw className="w-4 h-4" />
                Обновить
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1a5e] transition-colors"
              >
                <FiLogOut className="w-4 h-4" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-comfortaa font-bold text-gray-900 mb-2">Панель администратора</h1>
          <p className="text-gray-600">Управление студентами и пользователями системы</p>
        </div>

        <div className="flex gap-3 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === "students"
                ? "text-[#372579] border-b-2 border-[#372579]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Студенты ({students.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === "users" ? "text-[#372579] border-b-2 border-[#372579]" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Все пользователи ({allUsers.length})
          </button>
        </div>

        {activeTab === "students" ? (
          <>
            <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FiFilter className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 font-medium">Фильтр:</span>
                <select
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                >
                  <option value="all">Все студенты</option>
                  <option value="assigned">С назначенной командой</option>
                  <option value="not_assigned">Без назначенной команды</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const reviewer = approvedReviewers.find((r) => r.id === student.reviewer)
                  const supervisor = supervisors.find((s) => s.id === student.supervisor)
                  const consultant = consultants.find((c) => c.id === student.consultant)
                  const thesis = theses?.find((t) => t.student === student.id)
                  const hasTeam = !!(student.reviewer || student.supervisor || student.consultant)

                  return (
                    <div
                      key={student.id}
                      className="bg-white rounded-lg p-6 border border-gray-200 hover:border-[#372579] hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold font-comfortaa">
                                {student.fullName
                                  .split(" ")
                                  .map((name) => name[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{student.fullName}</h3>
                              <p className="text-gray-600 text-sm">{student.email}</p>
                            </div>
                          </div>
                          <div className="ml-15">
                            <p className="text-gray-900 font-medium mb-1">
                              {student.thesisTopic || "Тема работы не указана"}
                            </p>
                            <p className="text-gray-600 text-sm mb-3">{student.institution}</p>
                            <div className="flex items-center gap-4 text-sm mb-4">
                              {student.thesisFile && thesis?.submissionDate && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <FiClock className="w-4 h-4" />
                                  <span>Загружено {new Date(thesis.submissionDate).toLocaleDateString("ru-RU")}</span>
                                </div>
                              )}
                              <div
                                className={`flex items-center gap-2 font-medium ${getStatusColor(
                                  student.thesisStatus,
                                  !!student.thesisFile,
                                  hasTeam,
                                )}`}
                              >
                                <FiUser className="w-4 h-4" />
                                <span>{getStatusText(student.thesisStatus, !!student.thesisFile, hasTeam)}</span>
                              </div>
                            </div>

                            {hasTeam && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {student.supervisor && (
                                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-orange-700 text-xs font-medium mb-1">Научный руководитель</p>
                                    <p className="text-gray-900 font-medium text-sm">{supervisor?.fullName}</p>
                                  </div>
                                )}
                                {student.consultant && (
                                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <p className="text-indigo-700 text-xs font-medium mb-1">Консультант</p>
                                    <p className="text-gray-900 font-medium text-sm">{consultant?.fullName}</p>
                                  </div>
                                )}
                                {student.reviewer && (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-green-700 text-xs font-medium mb-1">Рецензент</p>
                                    <p className="text-gray-900 font-medium text-sm">{reviewer?.fullName}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAssignmentModal(student)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1a5e] transition-colors font-medium"
                          >
                            <FiUsers className="w-4 h-4" />
                            Назначить команду
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => toggleDropdown(student.id)}
                              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <FiMoreHorizontal className="w-5 h-5" />
                            </button>
                            {openDropdown === student.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                                <button
                                  onClick={() => openDeleteModal(student)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium rounded-lg"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                  Удалить
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
                  <FiUsers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-comfortaa font-semibold text-gray-700 mb-2">Студенты не найдены</h3>
                  <p className="text-gray-500">Нет студентов, соответствующих выбранному фильтру.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Updated All Users tab */
          <>
            <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FiFilter className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 font-medium">Фильтр:</span>
                <select
                  value={userFilterOption}
                  onChange={(e) => setUserFilterOption(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                >
                  <option value="all">Все пользователи</option>
                  <option value="students">Студенты</option>
                  <option value="reviewers">Рецензенты</option>
                  <option value="supervisors">Научные руководители</option>
                  <option value="consultants">Консультанты</option>
                  <option value="heads">Заведующие кафедрой</option>
                  <option value="deans">Деканы</option>
                  <option value="admins">Администраторы</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((userItem) => (
                  <div
                    key={userItem.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 hover:border-[#372579] hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold font-comfortaa">
                              {userItem.fullName
                                .split(" ")
                                .map((name) => name[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{userItem.fullName}</h3>
                            <p className="text-gray-600 text-sm">{userItem.email}</p>
                          </div>
                        </div>
                        <div className="ml-15">
                          <p className="text-gray-900 font-medium mb-2">{userItem.institution}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(userItem.role)}`}
                            >
                              {getRoleText(userItem.role)}
                            </span>
                            <div className="flex items-center gap-2 text-gray-600 text-sm">
                              <FiClock className="w-4 h-4" />
                              <span>Регистрация: {new Date(userItem.createdAt).toLocaleDateString("ru-RU")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {userItem.id !== user.id && (
                          <div className="relative">
                            <button
                              onClick={() => toggleDropdown(userItem.id)}
                              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <FiMoreHorizontal className="w-5 h-5" />
                            </button>
                            {openDropdown === userItem.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                                <button
                                  onClick={() => openDeleteModal(userItem)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium rounded-lg"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                  Удалить
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
                  <FiUsers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-comfortaa font-semibold text-gray-700 mb-2">Пользователи не найдены</h3>
                  <p className="text-gray-500">Нет пользователей, соответствующих выбранному фильтру.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setUserToDelete(null)
        }}
        title="Подтверждение удаления"
        size="medium"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <FiAlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-comfortaa font-bold text-gray-900">Удалить пользователя</h3>
              <p className="text-gray-600 text-sm">Это действие нельзя отменить</p>
            </div>
          </div>

          {userToDelete && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#372579] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm font-comfortaa">
                    {userToDelete.fullName
                      .split(" ")
                      .map((name) => name[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">{userToDelete.fullName}</p>
                  <p className="text-gray-600 text-sm">{userToDelete.email}</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userToDelete.role)}`}
                  >
                    {getRoleText(userToDelete.role)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className="text-gray-700 mb-6">
            Вы уверены, что хотите удалить пользователя{" "}
            <span className="font-semibold text-gray-900">{userToDelete?.fullName}</span>? Это приведет к безвозвратному
            удалению учетной записи и всех связанных данных.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setUserToDelete(null)
              }}
              className="flex-1 bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="flex-1 bg-red-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deletingUser ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiTrash2 className="w-5 h-5" />
                  Удалить
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false)
          setAssignmentData(null)
          setSelectedSupervisor("")
          setSelectedConsultant("")
          setSelectedReviewer("")
        }}
        title="Назначение команды"
        size="medium"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center">
              <FiUsers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-comfortaa font-bold text-gray-900">Назначить команду</h3>
              <p className="text-gray-600 text-sm">Выберите научного руководителя, консультанта и рецензента</p>
            </div>
          </div>

          {assignmentData && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#372579] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm font-comfortaa">
                    {assignmentData.fullName
                      .split(" ")
                      .map((name) => name[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">{assignmentData.fullName}</p>
                  <p className="text-gray-600 text-sm">{assignmentData.email}</p>
                  <p className="text-gray-600 text-sm">{assignmentData.thesisTopic || "Тема не указана"}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <FiBook className="w-4 h-4 text-orange-600" />
                  <span>Научный руководитель</span>
                </div>
              </label>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all"
              >
                <option value="">Выберите научного руководителя</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.fullName || supervisor.name} {supervisor.department && `- ${supervisor.department}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <FiHelpCircle className="w-4 h-4 text-indigo-600" />
                  <span>Консультант</span>
                </div>
              </label>
              <select
                value={selectedConsultant}
                onChange={(e) => setSelectedConsultant(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all"
              >
                <option value="">Выберите консультанта (необязательно)</option>
                {consultants.map((consultant) => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.fullName || consultant.name} {consultant.department && `- ${consultant.department}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <FiAward className="w-4 h-4 text-green-600" />
                  <span>Рецензент</span>
                </div>
              </label>
              <select
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent transition-all"
              >
                <option value="">Выберите рецензента (необязательно)</option>
                {approvedReviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.fullName || reviewer.name} {reviewer.department && `- ${reviewer.department}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAssignmentModal(false)
                setAssignmentData(null)
                setSelectedSupervisor("")
                setSelectedConsultant("")
                setSelectedReviewer("")
              }}
              className="flex-1 bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => handleAssignTeam(assignmentData?.id)}
              disabled={assigningStudent || (!selectedSupervisor && !selectedConsultant && !selectedReviewer)}
              className="flex-1 bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1a5e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {assigningStudent ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiUsers className="w-5 h-5" />
                  Назначить команду
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {openDropdown && <div className="fixed inset-0 z-5" onClick={() => setOpenDropdown(null)} />}
    </div>
  )
}

export default AdminDashboard
