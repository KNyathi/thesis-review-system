import { useState, useEffect } from "react"
import { FiDownload, FiX, FiEye } from "react-icons/fi"
import { Toast, useToast } from "./Toast"
import { thesisAPI } from "../services/api"

const SignedReviewViewer = ({ thesisId, onClose }) => {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadSignedReview()
  }, [thesisId])

  const loadSignedReview = async () => {
    try {
      setIsLoading(true)
      const blob = await thesisAPI.getSignedReview(thesisId)
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error("Error loading signed review:", error)
      showToast("Failed to load signed review", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      const blob = await thesisAPI.downloadSignedReview(thesisId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `signed_review_${thesisId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast("Download started successfully!", "success")
    } catch (error) {
      console.error("Error downloading signed review:", error)
      showToast("Failed to download signed review", "error")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleViewInNewTab = () => {
    if (pdfUrl) {
      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Signed Review</title>
              <style>
                body { margin: 0; overflow: hidden; }
                iframe { width: 100vw; height: 100vh; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${pdfUrl}"></iframe>
            </body>
          </html>
        `)
        newWindow.document.close()
        newWindow.focus()
      } else {
        showToast("Popup blocked - please allow popups", "warning")
      }
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading signed review...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Toast {...toast} onClose={hideToast} />

      {/* Full-width modal */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full h-full max-w-7xl max-h-full flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 rounded-t-lg p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Signed Review</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleViewInNewTab}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <FiEye className="w-4 h-4" />
                Open in New Tab
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiDownload className="w-4 h-4" />
                )}
                Download
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <FiX className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>

        {/* PDF Viewer - Full width */}
        <div className="flex-1 bg-white rounded-b-lg overflow-hidden">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" style={{ border: "none" }} title="Signed Review PDF" />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <p className="text-gray-400 mb-2">Failed to load signed review</p>
                <button
                  onClick={loadSignedReview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SignedReviewViewer
