import { useState, useEffect } from "react"
import { FiCheck, FiX, FiAlertCircle, FiInfo, FiAlertTriangle } from "react-icons/fi"

export const Toast = ({ message, type, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000) 
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FiCheck className="w-6 h-6" />
      case "error":
        return <FiX className="w-6 h-6" />
      case "warning":
        return <FiAlertTriangle className="w-6 h-6" />
      case "info":
        return <FiInfo className="w-6 h-6" />
      default:
        return <FiAlertCircle className="w-6 h-6" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-green-600",
          border: "border-green-500",
          text: "text-white",
          shadow: "shadow-green-500/25",
        }
      case "error":
        return {
          bg: "bg-red-600",
          border: "border-red-500",
          text: "text-white",
          shadow: "shadow-red-500/25",
        }
      case "warning":
        return {
          bg: "bg-yellow-600",
          border: "border-yellow-500",
          text: "text-white",
          shadow: "shadow-yellow-500/25",
        }
      case "info":
        return {
          bg: "bg-blue-600",
          border: "border-blue-500",
          text: "text-white",
          shadow: "shadow-blue-500/25",
        }
      default:
        return {
          bg: "bg-gray-600",
          border: "border-gray-500",
          text: "text-white",
          shadow: "shadow-gray-500/25",
        }
    }
  }

  const styles = getStyles()

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={`
          flex items-center gap-4 px-6 py-4 rounded-xl border-2 backdrop-blur-sm
          ${styles.bg} ${styles.border} ${styles.text} ${styles.shadow}
          shadow-2xl min-w-[320px] max-w-[600px] mx-4
          transition-all duration-300 ease-out
        `}
      >
        {/* Icon */}
        <div className="flex-shrink-0">{getIcon()}</div>

        {/* Message */}
        <div className="flex-1">
          <p className="text-base font-medium leading-relaxed">{message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-2 p-1 rounded-lg hover:bg-white/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Close notification"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// Toast hook
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
