import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiUser,
  FiMail,
  FiBook,
  FiEdit,
  FiSave,
  FiX,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLogOut,
  FiTrash2,
  FiAlertTriangle,
  FiInfo,
  FiPlus,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import Modal from "../components/Modal"
import api from "../services/api"

const ProfilePage = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    institution: "",
    faculty: "",
    group: "",
    subjectArea: "",
    educationalProgram: "",
    degreeLevel: "bachelors",
    thesisTopic: "",
    positions: [],
    position: "",
    department: "",
    // Новые поля для новых ролей
    newRoleField1: "",
    newRoleField2: "",
  })
  const [originalData, setOriginalData] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (user) {
      const userData = {
        fullName: user.fullName || "",
        email: user.email || "",
        institution: user.institution || "",
        faculty: user.faculty || "",
        group: user.group || "",
        subjectArea: user.subjectArea || "",
        educationalProgram: user.educationalProgram || "",
        degreeLevel: user.degreeLevel || "bachelors",
        thesisTopic: user.thesisTopic || "",
        positions: user.positions && user.positions.length > 0 ? user.positions : [""],
        position: user.position || "",
        department: user.department || "",
        // Новые поля для новых ролей
        newRoleField1: user.newRoleField1 || "",
        newRoleField2: user.newRoleField2 || "",
      }
      setProfileData(userData)
      setOriginalData(userData)
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const hasChanges = () => {
    const currentData = { ...profileData }
    const original = { ...originalData }
    return JSON.stringify(currentData) !== JSON.stringify(original)
  }

  const handleSaveProfile = async () => {
    if (!hasChanges()) {
      showToast("Нет изменений для сохранения", "info")
      return
    }

    try {
      setIsLoading(true)
      const changedFields = {}
      Object.keys(profileData).forEach((key) => {
        if (JSON.stringify(profileData[key]) !== JSON.stringify(originalData[key])) {
          changedFields[key] = profileData[key]
        }
      })

      await api.patch("/profile", changedFields)
      await refreshUser()
      setOriginalData({ ...profileData })
      showToast("Профиль успешно обновлен!", "success")
      setIsEditing(false)
    } catch (error) {
      console.error("Profile update error:", error)
      showToast(error.response?.data?.error || "Не удалось обновить профиль", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setProfileData({ ...originalData })
    setIsEditing(false)
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("Новые пароли не совпадают", "error")
      return
    }

    if (passwordData.newPassword.length < 6) {
      showToast("Пароль должен содержать минимум 6 символов", "error")
      return
    }

    try {
      setIsChangingPassword(true)
      await api.patch("/password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      showToast("Пароль успешно изменен!", "success")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      showToast(error.response?.data?.error || "Не удалось изменить пароль", "error")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showToast("Введите пароль для подтверждения удаления", "error")
      return
    }

    try {
      setIsDeletingAccount(true)
      await api.delete("/profile", {
        data: { password: deletePassword },
      })

      showToast("Аккаунт успешно удален", "success")
      logout()
      navigate("/register", { replace: true })
    } catch (error) {
      showToast(error.response?.data?.error || "Не удалось удалить аккаунт", "error")
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteModal(false)
      setDeletePassword("")
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-['Montserrat']">
      <Toast {...toast} onClose={hideToast} />

      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/${user.role}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-[#372579] transition-colors font-medium"
          >
            <FiX className="w-5 h-5" />
            Назад к панели
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
          >
            <FiLogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-[#372579] to-[#5a3d9f] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white font-bold text-2xl font-['Comfortaa']">
                {user.fullName
                  ?.split(" ")
                  .map((name) => name[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "П"}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 font-['Comfortaa']">Личный кабинет</h1>
            <p className="text-gray-600">Управление информацией аккаунта</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 font-['Comfortaa']">Информация профиля</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
                    >
                      <FiEdit className="w-4 h-4" />
                      Редактировать
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        <FiX className="w-4 h-4" />
                        Отмена
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiSave className="w-4 h-4" />
                        )}
                        Сохранить
                      </button>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FiInfo className="w-4 h-4 text-blue-600" />
                      <p className="text-blue-700 text-sm font-medium">
                        {hasChanges() ? "Есть несохраненные изменения" : "Изменений не обнаружено"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email нельзя изменить</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">ФИО</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      name="fullName"
                      value={profileData.fullName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Institution */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Учебное заведение</label>
                  <div className="relative">
                    <FiBook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      name="institution"
                      value={profileData.institution}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Student-specific fields */}
                {user.role === "student" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Факультет</label>
                        <input
                          type="text"
                          name="faculty"
                          value={profileData.faculty}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: ИПКН"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Группа</label>
                        <input
                          type="text"
                          name="group"
                          value={profileData.group}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: M4255"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Направление</label>
                      <input
                        type="text"
                        name="subjectArea"
                        value={profileData.subjectArea}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Например: 27.04.05 Инноватика"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Образовательная программа
                      </label>
                      <input
                        type="text"
                        name="educationalProgram"
                        value={profileData.educationalProgram}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Например: Искусственный интеллект"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Уровень образования</label>
                      <select
                        name="degreeLevel"
                        value={profileData.degreeLevel}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      >
                        <option value="bachelors">Бакалавриат</option>
                        <option value="masters">Магистратура</option>
                        <option value="specialist">Специалитет</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Тема ВКР</label>
                      <input
                        type="text"
                        name="thesisTopic"
                        value={profileData.thesisTopic}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Введите тему ВКР"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>
                  </>
                )}

                {/* Consultant-specific fields */}
                {user.role === "consultant" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Должность</label>
                        <input
                          type="text"
                          name="position"
                          value={profileData.position}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: Ведущий консультант"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Кафедра</label>
                        <input
                          type="text"
                          name="department"
                          value={profileData.department}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: Кафедра ИТ"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Факультет</label>
                      <input
                        type="text"
                        name="faculty"
                        value={profileData.faculty}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Например: ИПКН"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>
                  </>
                )}

                {/* Dean-specific fields */}
                {user.role === "dean" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Должность</label>
                        <input
                          type="text"
                          name="position"
                          value={profileData.position}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: Декан факультета"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Факультет</label>
                        <input
                          type="text"
                          name="faculty"
                          value={profileData.faculty}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: ИПКН"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Head of Department-specific fields */}
                {user.role === "head_of_department" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Должность</label>
                        <input
                          type="text"
                          name="position"
                          value={profileData.position}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: Зав. кафедрой"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Факультет</label>
                        <input
                          type="text"
                          name="faculty"
                          value={profileData.faculty}
                          onChange={handleChange}
                          disabled={!isEditing}
                          placeholder="Например: ИПКН"
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Кафедра</label>
                      <input
                        type="text"
                        name="department"
                        value={profileData.department}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Например: Кафедра ИТ"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>
                  </>
                )}

                {/* Reviewer-specific fields */}
                {user.role === "reviewer" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Должности</label>
                    <div className="space-y-2">
                      {profileData.positions.map((position, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={position}
                            onChange={(e) => {
                              const newPositions = [...profileData.positions]
                              newPositions[index] = e.target.value
                              setProfileData((prev) => ({ ...prev, positions: newPositions }))
                            }}
                            disabled={!isEditing}
                            placeholder="Введите должность"
                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                          />
                          {isEditing && profileData.positions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newPositions = profileData.positions.filter((_, i) => i !== index)
                                setProfileData((prev) => ({ ...prev, positions: newPositions }))
                              }}
                              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileData((prev) => ({
                              ...prev,
                              positions: [...prev.positions, ""],
                            }))
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
                        >
                          <FiPlus className="w-4 h-4" />
                          Добавить должность
                        </button>
                      )}

                      {profileData.positions.length === 0 && (
                        <p className="text-gray-500 text-sm">Должности не добавлены</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin-specific fields */}
                {user.role === "admin" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Должность</label>
                    <input
                      type="text"
                      name="position"
                      value={profileData.position}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Введите должность"
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                    />
                  </div>
                )}

                {/* New Role-specific fields */}
                {user.role === "newRole" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Новое поле 1</label>
                      <input
                        type="text"
                        name="newRoleField1"
                        value={profileData.newRoleField1}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Введите новое поле 1"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Новое поле 2</label>
                      <input
                        type="text"
                        name="newRoleField2"
                        value={profileData.newRoleField2}
                        onChange={handleChange}
                        disabled={!isEditing}
                        placeholder="Введите новое поле 2"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent disabled:opacity-60"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 font-['Comfortaa']">Управление аккаунтом</h2>
                <p className="text-gray-600 text-sm mt-1">Безопасность и настройки</p>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <FiLock className="w-8 h-8 text-[#372579]" />
                  </div>
                </div>

                <p className="text-center text-gray-700 mb-6 font-medium">Управление безопасностью аккаунта</p>

                <div className="space-y-3 text-sm text-gray-600 mb-6">
                  <p>• Измените пароль для защиты аккаунта</p>
                  <p>• Удалите аккаунт навсегда (действие необратимо)</p>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="border-t border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 font-['Comfortaa']">Изменить пароль</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Текущий пароль</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.current ? "text" : "password"}
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("current")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#372579]"
                      >
                        {showPasswords.current ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Новый пароль</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.new ? "text" : "password"}
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("new")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#372579]"
                      >
                        {showPasswords.new ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Подтвердите новый пароль</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPasswords.confirm ? "text" : "password"}
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility("confirm")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#372579]"
                      >
                        {showPasswords.confirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={
                      isChangingPassword ||
                      !passwordData.currentPassword ||
                      !passwordData.newPassword ||
                      !passwordData.confirmPassword
                    }
                    className="w-full bg-[#372579] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#2a1d5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isChangingPassword ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiLock className="w-5 h-5" />
                        Изменить пароль
                      </>
                    )}
                  </button>

                  {/* Delete Account Button */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full bg-red-500 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiTrash2 className="w-5 h-5" />
                      Удалить аккаунт
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeletePassword("")
        }}
        title="Удаление аккаунта"
        size="medium"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <FiAlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-['Comfortaa']">Удалить аккаунт</h3>
              <p className="text-gray-600">Это действие необратимо</p>
            </div>
          </div>

          <p className="text-gray-700 mb-6">
            Вы уверены, что хотите удалить свой аккаунт? Это приведет к безвозвратному удалению вашего аккаунта и всех
            связанных данных.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Введите пароль для подтверждения удаления
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Введите пароль"
                className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setDeletePassword("")
              }}
              className="flex-1 bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || !deletePassword}
              className="flex-1 bg-red-500 text-white font-medium py-3 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeletingAccount ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiTrash2 className="w-5 h-5" />
                  Удалить аккаунт
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ProfilePage
