import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { FiDownload, FiSend, FiAlertCircle, FiCheck, FiX, FiLoader, FiRefreshCw, FiCheckCircle } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"

const SupervisorReviewAssessment = ({ thesisId, thesis, onClose }) => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [comments, setComments] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState("revisions")
  const { toast, showToast, hideToast } = useToast()
  
  // Состояния для антиплагиата
  const [plagiarismStatus, setPlagiarismStatus] = useState(null)
  const [isCheckingPlagiarism, setIsCheckingPlagiarism] = useState(false)
  const [plagiarismCheckDone, setPlagiarismCheckDone] = useState(false)
  const [plagiarismError, setPlagiarismError] = useState(null)

  // Состояния для детальной оценки
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
  const [conclusion, setConclusion] = useState("")

  useEffect(() => {
    loadThesisPDF()
    if (thesis?.plagiarismCheck) {
      setPlagiarismStatus(thesis.plagiarismCheck)
      setPlagiarismCheckDone(thesis.plagiarismCheck.isChecked || false)
    }
  }, [thesisId, thesis])

  const loadThesisPDF = async () => {
    try {
      setIsLoading(true)
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

  const handlePlagiarismCheck = async () => {
    try {
      setIsCheckingPlagiarism(true)
      setPlagiarismError(null)
      
      const result = await thesisAPI.checkPlagiarismStart(thesisId)
      
      if (result.result) {
        const isApproved = result.result.isApproved
        const similarityScore = result.result.similarityScore
        
        setPlagiarismStatus({
          isChecked: true,
          similarityScore: similarityScore,
          isApproved: isApproved,
          reportUrl: result.result.reportUrl
        })
        setPlagiarismCheckDone(true)
        
        if (isApproved) {
          showToast(`Проверка на антиплагиат пройдена! Взаимствования: ${similarityScore}%`, "success")
        } else {
          showToast(`Проверка не пройдена. Взаимствования: ${similarityScore}% (требуется не менее 85%)`, "error")
        }
      }
    } catch (err) {
      console.error("Ошибка при проверке антиплагиата:", err)
      const errorMsg = err.response?.data?.error || "Не удалось выполнить проверку на антиплагиат"
      setPlagiarismError(errorMsg)
      showToast(errorMsg, "error")
    } finally {
      setIsCheckingPlagiarism(false)
    }
  }

  const handleDownloadPlagiarismReport = async () => {
    try {
      const blob = await thesisAPI.downloadPlagiarismReport(thesisId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `plagiarism_report_${thesisId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      showToast("Отчет скачан успешно!", "success")
    } catch (err) {
      console.error("Ошибка при скачивании отчета:", err)
      showToast("Не удалось скачать отчет о проверке на антиплагиат", "error")
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

    if (!plagiarismCheckDone || !plagiarismStatus?.isApproved) {
      showToast("Сначала необходимо пройти проверку на антиплагиат. Работа должна иметь оригинальность не менее 85%", "error")
      return
    }

    if (reviewMode === "revisions" && !comments.trim()) {
      showToast("Пожалуйста, введите комментарий для отправки на доработку", "error")
      return
    }

    if (reviewMode === "approve") {
      const validQuestions = questions.filter(q => q.trim())
      const validAdvantages = advantages.filter(a => a.trim())
      const validDisadvantages = disadvantages.filter(d => d.trim())
      
      if (!comments.trim()) {
        showToast("Пожалуйста, заполните комментарии", "error")
        return
      }
      
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
    }

    try {
      setIsSubmitting(true)

      if (reviewMode === "approve") {
        const assessmentData = {
          section1: assessmentScores,
          section2: {
            questions: questions.filter(q => q.trim()),
            advantages: advantages.filter(a => a.trim()),
            disadvantages: disadvantages.filter(d => d.trim())
          }
        }
        
        const reviewData = {
          comments: comments.trim(),
          assessment: assessmentData,
          isFinalApproval: true
        }
        
        const response = await thesisAPI.submitSupervisorReview(thesisId, reviewData)
        console.log("Server response:", response)
        
        showToast("Рецензия создана и отправлена студенту на подпись!", "success")
        setTimeout(() => {
          onClose()
          window.location.reload()
        }, 2000)
        
      } else {
        const reviewData = {
          comments: comments.trim(),
          isFinalApproval: false
        }
        
        await thesisAPI.submitSupervisorReview(thesisId, reviewData)
        showToast("Работа отправлена на доработку", "success")
        setTimeout(() => {
          onClose()
          window.location.reload()
        }, 1500)
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      const errorMsg = error.response?.data?.error || "Не удалось отправить рецензию"
      showToast(errorMsg, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmitReview = plagiarismCheckDone && plagiarismStatus?.isApproved

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

        {/* Антиплагиат */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FiAlertCircle className="w-5 h-5 text-[#372579]" />
              Проверка на антиплагиат
            </h3>
          </div>
          <div className="p-4">
            {!plagiarismCheckDone ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Минимальный порог оригинальности: <span className="font-bold text-[#372579]">85%</span></p>
                {plagiarismError && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{plagiarismError}</div>}
                <button onClick={handlePlagiarismCheck} disabled={isCheckingPlagiarism} className="flex items-center gap-2 px-4 py-2 bg-[#372579] text-white rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50">
                  {isCheckingPlagiarism ? <><FiLoader className="w-4 h-4 animate-spin" /> Проверка...</> : <><FiRefreshCw className="w-4 h-4" /> Запустить проверку на антиплагиат</>}
                </button>
              </div>
            ) : (
              <div className={`p-3 rounded-lg ${plagiarismStatus?.isApproved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-medium">{plagiarismStatus?.isApproved ? <span className="text-green-700 flex items-center gap-1"><FiCheckCircle className="w-4 h-4" /> Проверка пройдена</span> : <span className="text-red-700 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" /> Проверка НЕ пройдена</span>}</p>
                    <p className="text-sm mt-1">Взаимствования: <span className="font-bold">{plagiarismStatus?.similarityScore}%</span>{!plagiarismStatus?.isApproved && " (требуется не менее 85%)"}</p>
                  </div>
                  {plagiarismStatus?.reportUrl && (
                    <button onClick={handleDownloadPlagiarismReport} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                      <FiDownload className="w-4 h-4" /> Скачать отчет
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Форма рецензии */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Рецензирование работы</h3>
          </div>

          {!canSubmitReview && plagiarismCheckDone && !plagiarismStatus?.isApproved ? (
            <div className="p-6 text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <FiAlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-red-700 font-medium">Работа не прошла проверку на антиплагиат</p>
                <p className="text-sm text-red-600 mt-1">Взаимствования работы составляет {plagiarismStatus?.similarityScore}%, что ниже требуемого порога в 85%.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="p-4 space-y-6">
              {/* Выбор действия */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Действие</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="reviewMode" value="revisions" checked={reviewMode === "revisions"} onChange={() => setReviewMode("revisions")} className="w-4 h-4 text-[#372579]" />
                    <span className="text-gray-700 text-sm flex items-center gap-1"><FiX className="w-4 h-4 text-red-500" /> Отправить на доработку</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="reviewMode" value="approve" checked={reviewMode === "approve"} onChange={() => setReviewMode("approve")} className="w-4 h-4 text-[#372579]" />
                    <span className="text-gray-700 text-sm flex items-center gap-1"><FiCheck className="w-4 h-4 text-green-500" /> Одобрить работу</span>
                  </label>
                </div>
              </div>

              {reviewMode === "approve" && (
                <>
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
                </>
              )}

              {/* Комментарий */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{reviewMode === "approve" ? "Общее заключение" : "Замечания для доработки"} *</label>
                <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#372579]" required />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200">Отмена</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-[#372579] text-white py-3 rounded-lg hover:bg-[#2a1d5f] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? <FiLoader className="w-5 h-5 animate-spin" /> : (
                    <>
                      <FiSend className="w-5 h-5" />
                      {reviewMode === "approve" ? "Создать рецензию и отправить студенту" : "Отправить на доработку"}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default SupervisorReviewAssessment
