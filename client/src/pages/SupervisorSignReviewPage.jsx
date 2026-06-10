import { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { FiSave, FiX, FiArrowLeft, FiDownload, FiUpload, FiEdit3, FiInfo, FiCheckCircle } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { thesisAPI } from "../services/api"

const SupervisorSignReviewPage = () => {
  const { thesisId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [downloadedFileName, setDownloadedFileName] = useState("")
  const [thesisInfo, setThesisInfo] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadUnsignedReview()
    loadThesisInfo()
  }, [thesisId])

  const loadThesisInfo = async () => {
    try {
      const data = await thesisAPI.getMyThesis()
      setThesisInfo(data)
    } catch (error) {
      console.error("Error loading thesis info:", error)
    }
  }

  const loadUnsignedReview = async () => {
    try {
      setIsLoading(true)
      // Используем существующий эндпоинт /unsigned-review-supervisor/:thesisId
      const blob = await thesisAPI.getUnsignedSupervisorReview(thesisId)
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error("Error loading unsigned review:", error)
      const errorMsg = error.response?.data?.error || "Не удалось загрузить рецензию для подписания"
      showToast(errorMsg, "error")
      if (error.response?.status === 400) {
        // Студент ещё не подписал работу
        setTimeout(() => navigate("/supervisor"), 2000)
      } else {
        navigate("/supervisor")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadForSigning = () => {
    if (pdfUrl) {
      const fileName = `supervisor_review_${thesisId}.pdf`
      setDownloadedFileName(fileName)

      const link = document.createElement("a")
      link.href = pdfUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setCurrentStep(2)
      showToast("PDF загружен! Откройте его в Chrome и подпишите, используя инструменты рисования.", "success")
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type === "application/pdf") {
      uploadSignedReview(file)
    } else {
      showToast("Пожалуйста, выберите PDF файл", "error")
    }
  }

  const uploadSignedReview = async (file) => {
    try {
      setIsSaving(true)
      // Используем существующий эндпоинт /upload-signed-review-supervisor/:thesisId
      await thesisAPI.uploadSignedSupervisorReview(thesisId, file)
      showToast("Подписанная рецензия загружена успешно!", "success")

      setTimeout(() => {
        navigate("/supervisor")
      }, 1500)
    } catch (error) {
      console.error("Error uploading signed review:", error)
      showToast(error.response?.data?.error || "Не удалось загрузить подписанную рецензию", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    navigate("/supervisor")
  }

  const handleBackToStep1 = () => {
    setCurrentStep(1)
    setDownloadedFileName("")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка рецензии...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Toast {...toast} onClose={hideToast} />

      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <FiArrowLeft className="w-4 h-4" />
              На панель руководителя
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Подписание рецензии</h1>
              {thesisInfo && (
                <p className="text-gray-500 text-sm mt-0.5">Работа: {thesisInfo.title}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <div
              className={`px-4 py-1.5 rounded-full font-medium transition-colors ${
                currentStep >= 1 ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              📄 1. Рецензия
            </div>
            <div
              className={`px-4 py-1.5 rounded-full font-medium transition-colors ${
                currentStep >= 2 ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              ✍️ 2. Подпись
            </div>
            <div
              className={`px-4 py-1.5 rounded-full font-medium transition-colors ${
                currentStep >= 3 ? "bg-[#372579] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              📤 3. Загрузка
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 1 && (
              <button
                onClick={handleDownloadForSigning}
                className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] transition-colors text-sm font-medium"
              >
                <FiDownload className="w-4 h-4" />
                Скачать для подписи
              </button>
            )}

            {currentStep === 2 && (
              <>
                <button
                  onClick={handleBackToStep1}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <FiX className="w-4 h-4" />
                  Вернуться
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  Подписал(а), продолжить
                </button>
              </>
            )}

            {currentStep === 3 && (
              <>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Назад
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiSave className="w-4 h-4" />
                  )}
                  Загрузить подписанный PDF
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              </>
            )}

            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <FiX className="w-4 h-4" />
              Отмена
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-7xl mx-auto">
          {currentStep === 1 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Шаг 1: Проверьте рецензию</h2>
                <p className="text-sm text-gray-600">
                  Проверьте сгенерированную рецензию ниже. Если всё верно, скачайте её для подписания.
                </p>
              </div>
              <div className="relative bg-gray-100" style={{ height: "70vh" }}>
                {pdfUrl && (
                  <iframe src={pdfUrl} className="w-full h-full" style={{ border: "none" }} title="Review PDF" />
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-6">
                <div className="max-w-3xl mx-auto text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-[#372579] rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiEdit3 className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Подпишите рецензию</h2>
                    <p className="text-gray-600">
                      Файл рецензии: <span className="text-[#372579] font-mono">{downloadedFileName}</span>
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FiInfo className="w-5 h-5 text-[#372579]" />
                      Инструкция по подписанию
                    </h3>
                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-[#372579] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">1</div>
                          <div>
                            <p className="text-gray-900 font-medium">Откройте загруженный PDF</p>
                            <p className="text-gray-500 text-sm">Файл должен открыться автоматически в Chrome</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-[#372579] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">2</div>
                          <div>
                            <p className="text-gray-900 font-medium">Нажмите на значок пера</p>
                            <p className="text-gray-500 text-sm">Инструменты рисования находятся в правом верхнем углу PDF</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-[#372579] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">3</div>
                          <div>
                            <p className="text-gray-900 font-medium">Нарисуйте подпись</p>
                            <p className="text-gray-500 text-sm">Подпишитесь в отведённом месте внизу документа</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-[#372579] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">4</div>
                          <div>
                            <p className="text-gray-900 font-medium">Сохраните документ</p>
                            <p className="text-gray-500 text-sm">Используйте Ctrl+S (Cmd+S на Mac)</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-[#372579] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">5</div>
                          <div>
                            <p className="text-gray-900 font-medium">Вернитесь и загрузите</p>
                            <p className="text-gray-500 text-sm">Нажмите "Подписал(а), продолжить" когда закончите</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-700 text-sm">
                      💡 Совет: Используйте чёрный или синий цвет для подписи. Убедитесь, что подпись чётко видна.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-8">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiUpload className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Загрузить подписанную рецензию</h2>
                    <p className="text-gray-600">Выберите PDF файл, который вы подписали на предыдущем шаге</p>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-10 cursor-pointer hover:border-[#372579] hover:bg-gray-50 transition-all"
                  >
                    <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 font-medium mb-1">Нажмите для выбора файла</p>
                    <p className="text-gray-400 text-sm">Поддерживаются только PDF файлы</p>
                  </div>

                  {isSaving && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-gray-600">
                      <div className="w-4 h-4 border-2 border-[#372579] border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SupervisorSignReviewPage
