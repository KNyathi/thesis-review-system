import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiDownload, FiSend, FiAlertCircle, FiLoader } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"

const ReviewerReviewAssessment = ({ thesisId, thesis, onClose }) => {
  const navigate = useNavigate()
  const { toast, showToast, hideToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [grade, setGrade] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Состояния для детальной оценки (8 критериев)
  const [assessmentScores, setAssessmentScores] = useState({
    topicCorrespondence: 5,
    relevanceJustification: 5,
    subjectAreaCorrespondence: 5,
    researchMethodsCorrectness: 5,
    materialPresentation: 5,
    assertionsJustification: 5,
    researchValue: 5,
    researchFindingsIntegration: 5
  })
  const [questions, setQuestions] = useState([""])
  const [advantages, setAdvantages] = useState([""])
  const [disadvantages, setDisadvantages] = useState([""])

  useEffect(() => {
    loadThesisPDF()
  }, [thesisId])

  const loadThesisPDF = async () => {
    try {
      setIsLoading(true)
      // Используем проверенный на антиплагиат файл
      const blob = await thesisAPI.viewThesis(thesisId)
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error("Error loading thesis PDF:", error)
      showToast("Не удалось загрузить PDF работы", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await thesisAPI.downloadThesis(thesisId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${thesis.title || "thesis"}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      showToast("Работа загружена успешно!", "success")
    } catch (error) {
      showToast("Не удалось загрузить работу", "error")
    }
  }

  // Обработчики для динамических полей
  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions]
    newQuestions[index] = value
    setQuestions(newQuestions)
  }

  const addQuestion = () => {
    setQuestions([...questions, ""])
  }

  const removeQuestion = (index) => {
    const newQuestions = questions.filter((_, i) => i !== index)
    setQuestions(newQuestions)
  }

  const handleAdvantageChange = (index, value) => {
    const newAdvantages = [...advantages]
    newAdvantages[index] = value
    setAdvantages(newAdvantages)
  }

  const addAdvantage = () => {
    setAdvantages([...advantages, ""])
  }

  const removeAdvantage = (index) => {
    const newAdvantages = advantages.filter((_, i) => i !== index)
    setAdvantages(newAdvantages)
  }

  const handleDisadvantageChange = (index, value) => {
    const newDisadvantages = [...disadvantages]
    newDisadvantages[index] = value
    setDisadvantages(newDisadvantages)
  }

  const addDisadvantage = () => {
    setDisadvantages([...disadvantages, ""])
  }

  const removeDisadvantage = (index) => {
    const newDisadvantages = disadvantages.filter((_, i) => i !== index)
    setDisadvantages(newDisadvantages)
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()

    if (!grade) {
      showToast("Пожалуйста, выберите оценку", "error")
      return
    }

    const validQuestions = questions.filter(q => q.trim())
    const validAdvantages = advantages.filter(a => a.trim())
    const validDisadvantages = disadvantages.filter(d => d.trim())

    if (validQuestions.length === 0) {
      showToast("Пожалуйста, добавьте хотя бы один вопрос", "error")
      return
    }

    if (validAdvantages.length === 0) {
      showToast("Пожалуйста, добавьте хотя бы одно достоинство", "error")
      return
    }

    if (validDisadvantages.length === 0) {
      showToast("Пожалуйста, добавьте хотя бы один недостаток", "error")
      return
    }

    try {
      setIsSubmitting(true)

      const assessmentData = {
        section1: assessmentScores,
        section2: {
          questions: validQuestions,
          advantages: validAdvantages,
          disadvantages: validDisadvantages,
          critique: []
        }
      }

      const reviewData = {
        grade: grade,
        assessment: assessmentData
      }

      console.log("Sending review data:", reviewData)
      
      const response = await thesisAPI.submitReview(thesisId, reviewData)
      console.log("Server response:", response)

      // Перенаправляем на страницу подписания
      showToast("Рецензия отправлена! Перенаправление на подписание...", "success")
      
      // Используем window.location.href для принудительного перенаправления
      setTimeout(() => {
        window.location.href = `/review/${thesisId}`
      }, 1500)
      
    } catch (error) {
      console.error("Error submitting review:", error)
      const errorMsg = error.response?.data?.error || "Не удалось отправить рецензию"
      showToast(errorMsg, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Toast {...toast} onClose={hideToast} />

      <div className="flex-1 overflow-y-auto p-4">
        {/* PDF Viewer */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{thesis.title}</h2>
                <p className="text-gray-600 text-sm mt-1">Студент: {thesis.student?.fullName}</p>
              </div>
              <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                <FiDownload className="w-4 h-4" />
                Скачать работу
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden" style={{ height: "400px" }}>
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#372579] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Загрузка PDF...</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full" title="Thesis PDF" />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <FiAlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Не удалось загрузить PDF</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review Assessment Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Рецензирование работы</h3>
            <p className="text-gray-600 text-sm mt-1">Заполните рецензию и выставьте оценку</p>
          </div>

          <form onSubmit={handleSubmitReview} className="p-4 space-y-6">
            {/* Оценка */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Оценка <span className="text-red-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#372579] focus:border-transparent"
                required
              >
                <option value="">Выберите оценку</option>
                <option value="5">Отлично (5)</option>
                <option value="4">Хорошо (4)</option>
                <option value="3">Удовлетворительно (3)</option>
                <option value="2">Неудовлетворительно (2)</option>
              </select>
            </div>

            {/* Критерии оценки */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Раздел I. Оценка ВКР</h4>
              <div className="grid gap-3">
                {Object.entries(assessmentScores).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700 w-2/3">
                      {key === 'topicCorrespondence' && 'Соответствие содержания работы утвержденной теме'}
                      {key === 'relevanceJustification' && 'Обоснование актуальности, корректность цели и задач'}
                      {key === 'subjectAreaCorrespondence' && 'Соответствие работы направлению подготовки'}
                      {key === 'researchMethodsCorrectness' && 'Корректность выбора методов исследования'}
                      {key === 'materialPresentation' && 'Качество и логика изложения'}
                      {key === 'assertionsJustification' && 'Обоснованность положений, выносимых на защиту'}
                      {key === 'researchValue' && 'Научная и/или практическая значимость'}
                      {key === 'researchFindingsIntegration' && 'Внедрение результатов работы'}
                    </span>
                    <select value={value} onChange={(e) => setAssessmentScores({...assessmentScores, [key]: parseInt(e.target.value)})} className="w-24 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#372579]">
                      <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Вопросы */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Вопросы</h4>
              {questions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="text" value={q} onChange={(e) => handleQuestionChange(idx, e.target.value)} placeholder={`Вопрос ${idx + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#372579]" />
                  <button type="button" onClick={() => removeQuestion(idx)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                </div>
              ))}
              <button type="button" onClick={addQuestion} className="text-sm text-[#372579] hover:underline">+ Добавить вопрос</button>
            </div>

            {/* Достоинства */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Достоинства</h4>
              {advantages.map((a, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="text" value={a} onChange={(e) => handleAdvantageChange(idx, e.target.value)} placeholder={`Достоинство ${idx + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#372579]" />
                  <button type="button" onClick={() => removeAdvantage(idx)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                </div>
              ))}
              <button type="button" onClick={addAdvantage} className="text-sm text-[#372579] hover:underline">+ Добавить достоинство</button>
            </div>

            {/* Недостатки */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Недостатки и замечания</h4>
              {disadvantages.map((d, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="text" value={d} onChange={(e) => handleDisadvantageChange(idx, e.target.value)} placeholder={`Недостаток ${idx + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#372579]" />
                  <button type="button" onClick={() => removeDisadvantage(idx)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                </div>
              ))}
              <button type="button" onClick={addDisadvantage} className="text-sm text-[#372579] hover:underline">+ Добавить недостаток</button>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200">Отмена</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <FiLoader className="w-5 h-5 animate-spin" /> : <><FiSend className="w-5 h-5" /> Отправить рецензию</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ReviewerReviewAssessment
