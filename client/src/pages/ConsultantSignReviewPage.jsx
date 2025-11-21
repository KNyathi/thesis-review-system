import { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { FiSave, FiX, FiArrowLeft, FiDownload, FiUpload, FiEdit3, FiInfo } from "react-icons/fi"
import { Toast, useToast } from "../components/Toast"
import { thesisAPI } from "../services/api"

const ConsultantSignReviewPage = () => {
  const { thesisId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [downloadedFileName, setDownloadedFileName] = useState("")
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadUnsignedReview()
  }, [thesisId])

  const loadUnsignedReview = async () => {
    try {
      setIsLoading(true)
      const blob = await thesisAPI.getUnsignedConsultantReview(thesisId)
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error("Error loading unsigned consultant review:", error)
      showToast("Не удалось загрузить рецензию консультанта", "error")
      navigate("/consultant")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadForSigning = () => {
    if (pdfUrl) {
      const fileName = `consultant_review_${thesisId}.pdf`
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
      await thesisAPI.uploadSignedConsultantReview(thesisId, file)
      showToast("Подписанная рецензия загружена успешно!", "success")

      setTimeout(() => {
        navigate("/consultant")
      }, 1500)
    } catch (error) {
      console.error("Error uploading signed consultant review:", error)
      showToast("Не удалось загрузить подписанную рецензию", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    navigate("/consultant")
  }

  const handleBackToStep1 = () => {
    setCurrentStep(1)
    setDownloadedFileName("")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Загрузка рецензии консультанта...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Toast {...toast} onClose={hideToast} />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              <FiArrowLeft className="w-4 h-4" />
              На панель консультанта
            </button>
            <h1 className="text-xl font-semibold text-white">Подписание консультативной рецензии</h1>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`px-3 py-1 rounded-full ${currentStep >= 1 ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              1. Рецензия
            </div>
            <div
              className={`px-3 py-1 rounded-full ${currentStep >= 2 ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              2. Подпись
            </div>
            <div
              className={`px-3 py-1 rounded-full ${currentStep >= 3 ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              3. Загрузка
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {currentStep === 1 && (
              <button
                onClick={handleDownloadForSigning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <FiDownload className="w-4 h-4" />
                Загрузить & Подписать
              </button>
            )}

            {currentStep === 2 && (
              <>
                <button
                  onClick={handleBackToStep1}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Вернуться к рецензии
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <FiUpload className="w-4 h-4" />
                  Готово к загрузке
                </button>
              </>
            )}

            {currentStep === 3 && (
              <>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
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
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              <FiX className="w-4 h-4" />
              Отмена
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            {/* Step 1: Review Document */}
            {currentStep === 1 && (
              <>
                <div className="p-4 border-b border-gray-800">
                  <h2 className="text-lg font-semibold text-white mb-2">Шаг 1: Проверьте рецензию</h2>
                  <p className="text-sm text-gray-400">
                    Проверьте консультативную рецензию ниже, а затем нажмите "Загрузить & Подписать" для подписания.
                  </p>
                </div>
                <div className="relative bg-white" style={{ height: "80vh" }}>
                  {pdfUrl && (
                    <iframe src={pdfUrl} className="w-full h-full" style={{ border: "none" }} title="Review PDF" />
                  )}
                </div>
              </>
            )}

            {/* Step 2: Sign Instructions */}
            {currentStep === 2 && (
              <div className="p-8">
                <div className="max-w-4xl mx-auto text-center">
                  <div className="mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiEdit3 className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white mb-2">Подпишите рецензию</h2>
                    <p className="text-gray-400">
                      PDF был загружен как <span className="text-blue-400 font-mono">{downloadedFileName}</span>
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      📝 Как подписать, используя инструменты Chrome:
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6 text-left">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                            1
                          </div>
                          <div>
                            <p className="text-white font-medium">Откройте загруженный PDF</p>
                            <p className="text-gray-400 text-sm">Файл должен открыться автоматически в Chrome</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                            2
                          </div>
                          <div>
                            <p className="text-white font-medium">Нажмите значок пера/редактирования</p>
                            <p className="text-gray-400 text-sm">
                              Найдите инструменты рисования в панели инструментов PDF
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                            3
                          </div>
                          <div>
                            <p className="text-white font-medium">Нарисуйте вашу подпись</p>
                            <p className="text-gray-400 text-sm">Подпишитесь в отведённых местах</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                            4
                          </div>
                          <div>
                            <p className="text-white font-medium">Сохраните документ</p>
                            <p className="text-gray-400 text-sm">Используйте Ctrl+S или кнопку сохранения</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                            5
                          </div>
                          <div>
                            <p className="text-white font-medium">Вернитесь сюда для загрузки</p>
                            <p className="text-gray-400 text-sm">Нажмите "Готово к загрузке" когда закончите</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 text-blue-300 mb-2">
                      <FiInfo className="w-5 h-5" />
                      <span className="font-medium">Совет</span>
                    </div>
                    <p className="text-blue-200 text-sm">
                      Инструменты PDF в Chrome предлагают разные размеры и цвета пера. Используйте тёмный цвет (чёрный
                      или синий) для подписи, чтобы она была чётко видна.
                    </p>
                  </div>

                  <div className="text-gray-400 text-sm">
                    <p>
                      Нужна помощь? Инструменты рисования появляются как значок пера в панели инструментов PDF Chrome.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Upload Signed Document */}
            {currentStep === 3 && (
              <div className="p-8">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="mb-8">
                    <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiUpload className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white mb-2">Загрузить подписанную рецензию</h2>
                    <p className="text-gray-400">
                      Выберите подписанный PDF файл для завершения консультативного процесса рецензирования
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-8 mb-6">
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8">
                      <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-white font-medium mb-2">Нажмите для выбора подписанного PDF</p>
                      <p className="text-gray-400 text-sm mb-4">
                        Убедитесь, что вы сохранили PDF после добавления подписи
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSaving}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? "Загрузка..." : "Выбрать подписанный PDF"}
                      </button>
                    </div>
                  </div>

                  <div className="text-gray-400 text-sm">
                    <p>
                      Принимаются только PDF файлы. Файл должен содержать вашу подпись, нарисованную с помощью
                      инструментов PDF Chrome. После загрузки рецензия будет отправлена научному руководителю.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsultantSignReviewPage
