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
  FiRefreshCw,
  FiEdit,
  FiUsers,
  FiPenTool,
} from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"

const HeadDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [readyForSigning, setReadyForSigning] = useState([])
  const [signedTheses, setSignedTheses] = useState([])
  const [activeTab, setActiveTab] = useState("ready")
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  const fetchedRef = useRef(false)
  const isFetchingRef = useRef(false)

  const fetchTheses = useCallback(async () => {
    if (isFetchingRef.current) return

    try {
      isFetchingRef.current = true
      setIsLoading(true)

      const [, ready, signed] = await Promise.allSettled([
        thesisAPI.getHodTheses(),
        thesisAPI.getHodThesesReadyForSigning(),
        thesisAPI.getHodSignedTheses(),
      ])

      const readyData = ready.status === "fulfilled" ? ready.value : []
      const signedData = signed.status === "fulfilled" ? signed.value : []

      setReadyForSigning(readyData)
      setSignedTheses(signedData)
      fetchedRef.current = true

      if (ready.status === "rejected" || signed.status === "rejected") {
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
    if (user && user.role === "head_of_department" && !fetchedRef.current) {
      fetchTheses()
    }
  }, [user])

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели заведующего...</p>
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
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center">
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
                    .slice(0, 2) || "З"}
                </span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs">Заведующий кафедрой</p>
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
              <span className="text-white font-bold text-xl">З</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Панель заведующего кафедрой</h1>
            <p className="text-gray-600">Рецензирование и подпись рецензий студентов</p>
          </div>

          <div className="flex gap-4 mb-6">
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

          <div className="space-y-4">
            {activeTab === "ready" ? (
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
                          <p className="text-gray-600 text-sm mb-3">
                            {thesis.student?.faculty} - {thesis.student?.group}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            {thesis.submissionDate && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FiClock className="w-4 h-4" />
                                <span>Отправлено {new Date(thesis.submissionDate).toLocaleDateString("ru-RU")}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-orange-600 font-medium">
                              <FiEdit className="w-4 h-4" />
                              <span>Готово к подписи</span>
                            </div>
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
                        <button
                          onClick={() => navigate(`/sign-head/${thesis.id}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
                        >
                          <FiPenTool className="w-4 h-4" />
                          Подписать рецензии
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiEdit className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Нет работ для подписи</h3>
                  <p className="text-gray-500">Нет работ, готовых к подписи. Работы появятся здесь после рецензирования.</p>
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
                        <p className="text-gray-600 text-sm mb-3">
                          {thesis.student?.faculty} - {thesis.student?.group}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          {thesis.hodSignedDate && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <FiClock className="w-4 h-4" />
                              <span>Подписано {new Date(thesis.hodSignedDate).toLocaleDateString("ru-RU")}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-green-600 font-medium">
                            <FiCheck className="w-4 h-4" />
                            <span>Подписано заведующим</span>
                          </div>
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
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Нет подписанных работ</h3>
                <p className="text-gray-500">Вы ещё не подписали ни одной работы.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HeadDashboard
