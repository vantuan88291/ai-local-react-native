import { useCallback, useRef, useState, useEffect } from "react"
import { llama } from "@react-native-ai/llama"
import { LlamaLanguageModel } from "@react-native-ai/llama/lib/typescript/ai-sdk"
import { DropdownAlertType } from "react-native-dropdownalert"

import { onAlert } from "@/app"
import { ModelStatus } from "@/screens/ai/hooks/models"

interface DownloadProgressEvent {
  percentage?: number
  loaded?: number
  total?: number
}

interface UseModelSetupOptions {
  initialModelId?: string
  onModelReady?: (model: LlamaLanguageModel) => void
  onModelRemoved?: () => void
}

export const useModelSetup = (options: UseModelSetupOptions = {}) => {
  const { initialModelId, onModelReady, onModelRemoved } = options

  const [modelStatus, setModelStatus] = useState<ModelStatus>("not_setup")
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(initialModelId ?? null)

  const modelRef = useRef<LlamaLanguageModel>(null)
  const isSetupInProgressRef = useRef<boolean>(false)
  const isMountedRef = useRef<boolean>(true)

  /**
   * Centralized error handler
   */
  const handleError = useCallback(
    (
      error: unknown,
      context: string,
      options: { showAlert?: boolean; cleanup?: () => void } = {},
    ) => {
      const { showAlert = true, cleanup } = options
      const errorMessage = error instanceof Error ? error.message : String(error)

      console.error(`[useModelSetup] ${context}:`, error)

      if (cleanup) cleanup()

      if (showAlert) {
        onAlert({
          type: DropdownAlertType.Error,
          title: context,
          message: errorMessage,
        })
      }

      return errorMessage
    },
    [],
  )

  /**
   * Check if model is already downloaded/prepared
   */
  const checkModelExists = useCallback(
    async (modelIdToCheck?: string) => {
      try {
        const targetModelId = modelIdToCheck || selectedModelId
        if (!targetModelId) {
          return false
        }

        const model = llama.languageModel(targetModelId)
        const isDownloaded = await model.isDownloaded()

        if (isDownloaded) {
          setModelStatus("preparing")
          await model.prepare()

          modelRef.current = model
          setSelectedModelId(targetModelId)
          setModelStatus("ready")
          onModelReady?.(model)
          return true
        }

        console.log("[useModelSetup] Model not downloaded yet")
        return false
      } catch (error) {
        handleError(error, "Model Check Failed", {
          cleanup: () => {
            if (modelIdToCheck) {
              const model = llama.languageModel(modelIdToCheck)
              model.remove()
            }
          },
        })
        return false
      }
    },
    [selectedModelId, handleError, onModelReady],
  )

  /**
   * Setup and download model
   */
  const setupModel = useCallback(
    async (modelId: string) => {
      if (isSetupInProgressRef.current) {
        console.warn("[useModelSetup] Setup already in progress, ignoring duplicate call")
        return
      }

      if (modelId === selectedModelId && modelStatus === "ready") {
        return
      }

      isSetupInProgressRef.current = true

      try {
        // If selecting a different model, remove the old one first
        if (modelId !== selectedModelId && selectedModelId) {
          try {
            if (modelRef.current) {
              await modelRef.current.unload()
              modelRef.current = null
            }

            const oldModel = llama.languageModel(selectedModelId)
            await oldModel.remove()
          } catch (error) {
            console.error("[useModelSetup] Error removing old model:", error)
          }

          if (isMountedRef.current) {
            setModelStatus("not_setup")
            setDownloadProgress(0)
          }
        }

        if (!isMountedRef.current) return

        setModelStatus("downloading")
        setDownloadProgress(0)

        const model = llama.languageModel(modelId)

        await model.download((event: DownloadProgressEvent) => {
          if (event?.percentage !== undefined && isMountedRef.current) {
            setDownloadProgress(event.percentage)
          }
        })

        if (!isMountedRef.current) return

        setDownloadProgress(100)
        setModelStatus("preparing")

        await model.prepare()

        if (isMountedRef.current) {
          modelRef.current = model
          setSelectedModelId(modelId)
          setModelStatus("ready")
          onModelReady?.(model)
        }
      } catch (error) {
        handleError(error, `${modelStatus} Error`, {
          cleanup: () => {
            const model = llama.languageModel(modelId)
            model.remove()
          },
        })

        if (isMountedRef.current) {
          setModelStatus("not_setup")
          setDownloadProgress(0)
        }
      } finally {
        isSetupInProgressRef.current = false
      }
    },
    [modelStatus, selectedModelId, handleError, onModelReady],
  )

  /**
   * Remove model from device
   */
  const removeModel = useCallback(async () => {
    try {
      if (modelRef.current) {
        try {
          await modelRef.current.unload()
        } catch (error) {
          console.log("[useModelSetup] Error unloading model:", error)
        }
        modelRef.current = null
      }

      if (!selectedModelId) return

      const model = llama.languageModel(selectedModelId)
      await model.remove()

      setModelStatus("not_setup")
      setDownloadProgress(0)
      setSelectedModelId(null)
      onModelRemoved?.()
    } catch (error) {
      handleError(error, "Failed to Remove Model", { showAlert: false })
    }
  }, [selectedModelId, handleError, onModelRemoved])

  /**
   * Remove specific model by ID
   */
  const removeModelById = useCallback(
    async (modelId: string) => {
      try {
        if (modelId === selectedModelId && modelStatus === "ready") {
          await removeModel()
          return
        }

        const model = llama.languageModel(modelId)
        await model.remove()

        if (modelId === selectedModelId) {
          setSelectedModelId(null)
          setModelStatus("not_setup")
        }
      } catch (error) {
        handleError(error, "Failed to Remove Model", { showAlert: false })
      }
    },
    [selectedModelId, modelStatus, removeModel, handleError],
  )

  /**
   * Initialize on mount and cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true

    if (initialModelId) {
      setSelectedModelId(initialModelId)
      checkModelExists(initialModelId)
        .then((exists) => {
          if (!exists && isMountedRef.current) {
            setModelStatus("not_setup")
          }
        })
        .catch((error) => {
          if (isMountedRef.current) {
            console.error("[useModelSetup] Error checking model:", error)
            setModelStatus("not_setup")
          }
        })
    } else {
      setModelStatus("not_setup")
    }

    return () => {
      isMountedRef.current = false

      if (modelRef.current) {
        modelRef.current.unload().catch((error: unknown) => {
          console.error("[useModelSetup] Error unloading model in cleanup:", error)
        })
        modelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModelId])

  return {
    modelRef,
    modelStatus,
    downloadProgress,
    selectedModelId,
    setupModel,
    removeModel,
    removeModelById,
    checkModelExists,
    isMountedRef,
  }
}
