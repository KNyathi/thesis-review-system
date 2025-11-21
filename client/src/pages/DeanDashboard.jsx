import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiClock,
  FiCheck,
  FiDownload,
  FiLogOut,
  FiFilter,
  FiCalendar,
  FiRefreshCw,
  FiEdit,
  FiUsers,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"

const DeanDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [allTheses, setAllTheses] = useState([])
  const [readyForSigning, setReadyForSigning] = useState([])
  const [signedTheses, setSignedTheses] = useState([])
  const [filteredTheses, setFilteredTheses] = useState([])
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)
  const [filterOption, setFilterOption] = useState("all")
  const [sortOption, setSortOption] = useState("newest")
  const { toast, showToast, hideToast } = useToast()

  const fetchedRef = useRef(false)
  const isFetchingRef = useRef(false)

  const fetchTheses = useCallback(async () => {
    if (isFetchingRef.current) return

    try {
      isFetchingRef.current = true
      setIsLoading(true)

      const [all, ready, signed] = await Promise.allSettled([
        thesisAPI.getDeanTheses(),
        thesisAPI.getDeanThesesReadyForSigning(),
        thesisAPI.getDeanSignedTheses(),
      ])

      const allData = all.status === "fulfilled" ? all.value : []
      const readyData = ready.status === "fulfilled" ? ready.value : []
      const signedData = signed.status === "fulfilled" ? signed.value : []

      setAllTheses(allData)
      setReadyForSigning(readyData)
      setSignedTheses(signedData)
      fetchedRef.current = true

      if (all.status === "rejected" || ready.status === "rejected" || signed.status === "rejected") {
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
    if (user && user.role === "dean" && !fetchedRef.current) {
      fetchTheses()
    }
  }, [user])

  // Filter and sort theses
  useEffect(() => {
    let filtered = [...allTheses]

    if (filterOption === "evaluated") {
      filtered = filtered.filter((thesis) => thesis.status === "evaluated")
    } else if (filterOption === "under_review") {
      filtered = filtered.filter((thesis) => thesis.status === "under_review")
    } else if (filterOption === "submitted") {
      filtered = filtered.filter((thesis) => thesis.status === "submitted")
    }

    if (sortOption === "newest") {
      filtered.sort((a, b) => new Date(b.submissionDate || 0) - new Date(a.submissionDate || 0))
    } else if (sortOption === "oldest") {
      filtered.sort((a, b) => new Date(a.submissionDate || 0) - new Date(b.submissionDate || 0))
    }

    setFilteredTheses(filtered)
  }, [allTheses, filterOption, sortOption])

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

      showToast("Download completed successfully!", "success")
    } catch (error) {
      showToast("Failed to download thesis", "error")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleRefresh = () => {
    fetchedRef.current = false
    fetchTheses()
  }

  const getCircleColor = (status) => {
    switch (status) {
      case "submitted":
        return "from-blue-500 to-blue-600"
      case "under_review":
        return "from-yellow-500 to-orange-500"
      case "evaluated":
        return "from-green-500 to-green-600"
      default:
        return "from-gray-500 to-gray-600"
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case "submitted":
        return "Submitted"
      case "under_review":
        return "Under Review"
      case "evaluated":
        return "Evaluated"
      default:
        return "Unknown"
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "submitted":
        return "text-blue-400"
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

  const handleSignReview = (thesisId) => {
    navigate(`/sign-dean/${thesisId}`)
  }

  if (isLoading && !fetchedRef.current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели декана...</p>
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
                    .slice(0, 2) || "Д"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs capitalize">{user?.role === "dean" ? "Декан" : user?.role}</p>
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
              <span className="text-white font-bold text-xl">Д</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Панель декана</h1>
            <p className="text-gray-600">Управление и утверждение дипломных работ факультета</p>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "all" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Все работы ({allTheses.length})
            </button>
            <button
              onClick={() => setActiveTab("ready")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "ready" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Готовы к подписи ({readyForSigning.length})
            </button>
            <button
              onClick={() => setActiveTab("signed")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "signed" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Подписанные ({signedTheses.length})
            </button>
          </div>

          {activeTab === "all" && (
            <div className="flex gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <FiFilter className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700 text-sm">Фильтр:</span>
                <select
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-3 py-1 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#372579]"
                >
                  <option value="all">Все работы</option>
                  <option value="submitted">Отправленные</option>
                  <option value="under_review">На рецензии</option>
                  <option value="evaluated">Оценённые</option>
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
            {activeTab === "all" ? (
              filteredTheses.length > 0 ? (
                filteredTheses.map((thesis) => (
                  <div
                    key={thesis.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-10 h-10 bg-gradient-to-br ${getCircleColor(thesis.status)} rounded-full flex items-center justify-center`}
                          >
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
                          <p className="text-gray-900 font-medium mb-1">{thesis.title || "Название работы пока нет"}</p>
                          <p className="text-gray-600 text-sm mb-2">
                            {thesis.student?.faculty} - {thesis.student?.group}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            {thesis.submissionDate && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FiClock className="w-4 h-4" />
                                <span>Отправлено {new Date(thesis.submissionDate).toLocaleDateString("ru-RU")}</span>
                              </div>
                            )}
                            <div className={`flex items-center gap-2 ${getStatusColor(thesis.status)}`}>
                              <FiClock className="w-4 h-4" />
                              <span className="font-medium">{getStatusText(thesis.status)}</span>
                            </div>
                            {thesis.finalGrade && (
                              <div className="flex items-center gap-2 text-green-600">
                                <FiCheck className="w-4 h-4" />
                                <span className="font-medium">Оценка: {thesis.finalGrade}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Р��боты не найдены</h3>
                  <p className="text-gray-500">Нет работ, соответствующих текущим критериям фильтра.</p>
                </div>
              )
            ) : activeTab === "ready" ? (
              readyForSigning.length > 0 ? (
                readyForSigning.map((thesis) => (
                  <div
                    key={thesis.id}
                    className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
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
                          <p className="text-gray-900 font-medium mb-1">{thesis.title}</p>
                          <p className="text-gray-600 text-sm mb-2">
                            {thesis.student?.faculty} - {thesis.student?.group}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            {thesis.submissionDate && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FiClock className="w-4 h-4" />
                                <span>Отправлено {new Date(thesis.submissionDate).toLocaleDateString("ru-RU")}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-orange-600">
                              <FiClock className="w-4 h-4" />
                              <span className="font-medium">Готово к подписи декана</span>
                            </div>
                            {thesis.finalGrade && (
                              <div className="flex items-center gap-2 text-green-600">
                                <FiCheck className="w-4 h-4" />
                                <span className="font-medium">Оценка: {thesis.finalGrade}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                          Скачать работу
                        </button>
                        <button
                          onClick={() => handleSignReview(thesis.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
                        >
                          <FiEdit className="w-4 h-4" />
                          Подписать рецензии
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <FiEdit className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Нет работ для подписи</h3>
                  <p className="text-gray-500">
                    Нет работ, готовых к подписи декана. Работы появятся здесь после подписи заведующим кафедрой.
                  </p>
                </div>
              )
            ) : signedTheses.length > 0 ? (
              signedTheses.map((thesis) => (
                <div
                  key={thesis.id}
                  className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
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
                        <p className="text-gray-900 font-medium mb-1">{thesis.title}</p>
                        <p className="text-gray-600 text-sm mb-2">
                          {thesis.student?.faculty} - {thesis.student?.group}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          {thesis.deanSignedDate && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <FiClock className="w-4 h-4" />
                              <span>Подписано {new Date(thesis.deanSignedDate).toLocaleDateString("ru-RU")}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-green-600">
                            <FiCheck className="w-4 h-4" />
                            <span className="font-medium">Подписано деканом</span>
                          </div>
                          {thesis.finalGrade && (
                            <div className="flex items-center gap-2 text-green-600">
                              <FiCheck className="w-4 h-4" />
                              <span className="font-medium">Оценка: {thesis.finalGrade}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
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
                        Скачать работу
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Нет подписанных работ</h3>
                <p className="text-gray-500">Вы еще не подписали ни одной работы.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeanDashboard
