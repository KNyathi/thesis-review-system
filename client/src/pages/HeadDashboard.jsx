import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FiClock, FiCheck, FiDownload, FiLogOut, FiRefreshCw, FiUsers, FiBook, FiUpload } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { useAuth } from "../context/AuthContext"
import { thesisAPI } from "../services/api"
import Modal from "../components/Modal"
import SignedReviewViewer from "../components/SignedReviewViewer"

const HeadDashboard = () => {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [thesesForSigning, setThesesForSigning] = useState([])
  const [signedTheses, setSignedTheses] = useState([])
  const [activeTab, setActiveTab] = useState("forSigning")
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)
  const [showSignedReview, setShowSignedReview] = useState(false)
  const [selectedThesis, setSelectedThesis] = useState(null)
  const { toast, showToast, hideToast } = useToast()
  const fileInputRef = useRef(null)
  const [currentThesis, setCurrentThesis] = useState(null)

  const fetchedRef = useRef(false)
  const initialLoadDone = useRef(false)

  const fetchData = useCallback(async () => {
    // Предотвращаем множественные вызовы
    if (!user || user.role !== "head_of_department") return
    if (fetchedRef.current) return
    
    try {
      fetchedRef.current = true
      setIsLoading(true)
      console.log("Fetching HOD data...")
      
      const [forSigning, signed] = await Promise.all([
        thesisAPI.getHodThesesForSigning(),
        thesisAPI.getHodSignedTheses(),
      ])

      console.log("Theses for signing:", forSigning)
      console.log("Signed theses:", signed)

      setThesesForSigning(Array.isArray(forSigning) ? forSigning : [])
      setSignedTheses(Array.isArray(signed) ? signed : [])
    } catch (error) {
      console.error("Error fetching data:", error)
      showToast("Не удалось загрузить данные", "error")
      // Даже при ошибке устанавливаем пустые массивы
      setThesesForSigning([])
      setSignedTheses([])
    } finally {
      setIsLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    if (user && user.role === "head_of_department" && !fetchedRef.current) {
      fetchData()
    }
  }, [user, fetchData])

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleRefresh = () => {
    fetchedRef.current = false
    setThesesForSigning([])
    setSignedTheses([])
    fetchData()
  }

  const handleDownload = async (thesisId, title) => {
    try {
      setDownloadingId(thesisId)
      const blob = await thesisAPI.downloadThesis(thesisId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      showToast("Загрузка завершена!", "success")
    } catch (error) {
      showToast("Не удалось загрузить работу", "error")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadForSigning = async (thesis) => {
    try {
      const blob = await thesisAPI.getHodUnsignedReview(thesis.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `hod_review_${thesis.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setCurrentThesis(thesis)
      showToast("Файл загружен. Подпишите его в Chrome и загрузите обратно.", "success")
    } catch (error) {
      console.error(error)
      showToast("Ошибка загрузки файла", "error")
    }
  }

  const handleUploadSignedReview = async () => {
    const file = fileInputRef.current?.files[0]
    if (!file) return
    
    try {
      await thesisAPI.uploadHodSignedReview(currentThesis.id, file)
      showToast("Подписанная рецензия загружена! Работа передана декану.", "success")
      setCurrentThesis(null)
      fileInputRef.current.value = ""
      fetchedRef.current = false
      fetchData()
    } catch (error) {
      console.error(error)
      showToast(error.response?.data?.error || "Ошибка загрузки", "error")
    }
  }

  const getInitials = (fullName) => {
    if (!fullName || typeof fullName !== "string") return "?"
    return fullName.split(" ").map((name) => name[0]).join("").toUpperCase().slice(0, 2)
  }

  // Если загрузка и данные ещё не получены — показываем спиннер
  if (isLoading && thesesForSigning.length === 0 && signedTheses.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка панели заведующего кафедрой...</p>
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
            <button onClick={() => navigate("/profile")} className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#372579] to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">{getInitials(user?.fullName)}</span>
              </div>
              <div className="text-left">
                <p className="text-gray-900 font-medium text-sm">{user?.fullName}</p>
                <p className="text-gray-500 text-xs">Заведующий кафедрой</p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f]">
              <FiRefreshCw className="w-4 h-4" /> Обновить
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <FiLogOut className="w-4 h-4" /> Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#372579] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-xl">ЗК</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Панель заведующего кафедрой</h1>
            <p className="text-gray-600">Подписание итоговых рецензий</p>
          </div>

          <div className="flex gap-4 mb-6">
            <button onClick={() => setActiveTab("forSigning")} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === "forSigning" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              На подпись ({thesesForSigning.length})
            </button>
            <button onClick={() => setActiveTab("signed")} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === "signed" ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              Подписанные ({signedTheses.length})
            </button>
          </div>

          {activeTab === "forSigning" && (
            <div className="space-y-4">
              {thesesForSigning.length > 0 ? (
                thesesForSigning.map((thesis) => (
                  <div key={thesis.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">{getInitials(thesis.student?.fullName)}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{thesis.student?.fullName}</h3>
                            <p className="text-gray-600 text-sm">{thesis.student?.email}</p>
                            <p className="text-gray-500 text-xs">{thesis.student?.faculty} - {thesis.student?.group}</p>
                          </div>
                        </div>
                        <div className="ml-13">
                          <p className="text-gray-900 font-medium">{thesis.title}</p>
                          {thesis.finalGrade && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 mt-2">
                              Оценка: {thesis.finalGrade}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => handleDownload(thesis.id, thesis.title)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                          <FiDownload className="w-4 h-4" /> Скачать работу
                        </button>
                      </div>
                    </div>
                    
                    {/* Блок подписания */}
                    {currentThesis?.id === thesis.id ? (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700 mb-3">Загрузите подписанную рецензию:</p>
                        <input ref={fileInputRef} type="file" accept="application/pdf" className="mb-3" />
                        <div className="flex gap-2">
                          <button onClick={() => setCurrentThesis(null)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm">Отмена</button>
                          <button onClick={handleUploadSignedReview} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">Загрузить</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => handleDownloadForSigning(thesis)} className="mt-4 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] text-sm font-medium">
                        <FiBook className="w-4 h-4 inline mr-2" /> Подписать рецензию
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Нет работ для подписания</h3>
                  <p className="text-gray-500">Работы, ожидающие вашей подписи, появятся здесь.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "signed" && (
            <div className="space-y-4">
              {signedTheses.length > 0 ? (
                signedTheses.map((thesis) => (
                  <div key={thesis.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">{getInitials(thesis.student?.fullName)}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{thesis.student?.fullName}</h3>
                            <p className="text-gray-600 text-sm">{thesis.student?.email}</p>
                          </div>
                        </div>
                        <div className="ml-13">
                          <p className="text-gray-900 font-medium">{thesis.title}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-green-600">✓ Подписано</span>
                            {thesis.finalGrade && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Оценка: {thesis.finalGrade}</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDownload(thesis.id, thesis.title)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                        <FiDownload className="w-4 h-4" /> Скачать работу
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <FiCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Нет подписанных работ</h3>
                  <p className="text-gray-500">Подписанные вами работы появятся здесь.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HeadDashboard
