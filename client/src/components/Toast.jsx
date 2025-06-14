import { useState, useEffect } from "react"
import { FiCheck, FiX, FiAlertCircle } from "react-icons/fi"

export const Toast = ({ message, type, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FiCheck className="w-5 h-5" />
      case "error":
        return <FiX className="w-5 h-5" />
      default:
        return <FiAlertCircle className="w-5 h-5" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case "success":
        return "bg-green-600 text-white"
      case "error":
        return "bg-red-600 text-white"
      default:
        return "bg-blue-600 text-white"
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${getStyles()}`}>
        {getIcon()}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Toast hook for easy usage
export const useToast = () => {
  const [toast, setToast] = useState({
    message: "",
    type: "info",
    isVisible: false,
  })

  const showToast = (message, type = "info") => {
    setToast({ message, type, isVisible: true })
  }

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }))
  }

  return { toast, showToast, hideToast }
}
