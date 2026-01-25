import { useCallback, useState, useMemo, useEffect } from "react"
import { useRoute } from "@react-navigation/native"

import { AppStackScreenProps } from "@/navigators/navigationTypes"
import { ModelLoadingState } from "@/screens/ai/hooks/models"
import { remove } from "@/utils/storage"

import { useMessages } from "./useMessages"
import { useMessageStream } from "./useMessageStream"
import { useModelSetup } from "./useModelSetup"

/**
 * Main AI Chat hook that orchestrates model setup, messages, and streaming.
 * This hook composes smaller, focused hooks for better maintainability.
 */
export const useAiChat = () => {
  const route = useRoute<AppStackScreenProps<"ai">["route"]>()
  const model = route.params?.model
  const modelId = model?.id

  const [inputText, setInputTextState] = useState("")
  const [useContextHistory, setUseContextHistory] = useState<boolean>(true)

  const setInputText = useCallback((text: string) => {
    setInputTextState(text)
  }, [])

  // Messages hook
  const {
    messages,
    setMessages,
    listRef,
    isMountedRef,
    clearConversation: clearMessagesFromStorage,
    scrollToBottom,
    conversationSummary,
    totalToken,
    remainTokens,
  } = useMessages({ modelId })

  // Model setup hook
  const {
    modelRef,
    modelStatus,
    downloadProgress,
    selectedModelId,
    setupModel,
    removeModel: removeModelFromDevice,
    removeModelById,
  } = useModelSetup({ initialModelId: modelId })

  // Message streaming hook
  const {
    isLoading,
    handleSend: streamHandleSend,
    abortStream,
  } = useMessageStream({
    modelRef,
    isMountedRef,
    messages,
    setMessages,
    scrollToBottom,
    useContextHistory,
  })

  /**
   * Handle sending a message
   */
  const handleSend = useCallback(async () => {
    if (modelStatus !== "ready") return
    setInputTextState("")
    const templeInputText = inputText
    streamHandleSend(templeInputText)
  }, [inputText, modelStatus, streamHandleSend])

  /**
   * Remove model and clear associated data
   */
  const removeModel = useCallback(async () => {
    if (modelId) {
      remove(modelId)
    }
    setMessages([])
    await removeModelFromDevice()
  }, [modelId, setMessages, removeModelFromDevice])

  /**
   * Clear conversation
   */
  const clearConversation = useCallback(() => {
    clearMessagesFromStorage()
  }, [clearMessagesFromStorage])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      abortStream()
    }
  }, [abortStream])

  // Derived state
  const modelLoadingState: ModelLoadingState =
    modelStatus === "downloading" || modelStatus === "preparing" ? modelStatus : "idle"

  const selectedModelName = useMemo(() => {
    return model?.name || null
  }, [model])

  return {
    // Messages
    messages,
    inputText,
    setInputText,
    handleSend,
    isLoading,
    listRef,

    // Model
    modelStatus,
    modelLoadingState,
    downloadProgress,
    setupModel,
    removeModel,
    removeModelById,
    clearConversation,
    selectedModel: model || null,
    selectedModelId,
    selectedModelName,
    model: modelRef.current,

    // Context
    useContextHistory,
    setUseContextHistory,
    conversationSummary,
    totalToken,
    remainTokens,
  }
}
