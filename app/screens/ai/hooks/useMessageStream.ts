import { useCallback, useRef, useState } from "react"
import { LlamaLanguageModel } from "@react-native-ai/llama/lib/typescript/ai-sdk"
import { streamText } from "ai"

import { Message } from "@/screens/ai/hooks/models"
import { createMessage } from "@/screens/ai/hooks/useMessages"

const KEEP_LATEST_CONTEXT_MESSAGES = 3

const isContextFullError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("context")
}

interface UseMessageStreamOptions {
  modelRef: React.MutableRefObject<LlamaLanguageModel | null>
  isMountedRef: React.MutableRefObject<boolean>
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  scrollToBottom: () => void
  useContextHistory: boolean
}

export const useMessageStream = (options: UseMessageStreamOptions) => {
  const { modelRef, isMountedRef, messages, setMessages, scrollToBottom, useContextHistory } =
    options

  const [isLoading, setIsLoading] = useState(false)
  const streamAbortControllerRef = useRef<AbortController | null>(null)

  /**
   * Handle sending a message and streaming AI response
   */
  const handleSend = useCallback(
    async (inputText: string) => {
      if (!inputText.trim() || isLoading || !modelRef.current) {
        return false
      }

      const userMessageText = inputText.trim()
      const userMessage = createMessage(userMessageText, true)
      const aiMessage = createMessage("", false)
      const aiMessageId = aiMessage.id

      // Build chronological list for AI context
      const chronological = [...messages].reverse()
      const messagesWithNewUser = [...chronological, userMessage, aiMessage]

      // Add newest-first for inverted FlatList
      setMessages((prev) => [aiMessage, userMessage, ...prev])
      setIsLoading(true)
      scrollToBottom()

      const abortController = new AbortController()
      streamAbortControllerRef.current = abortController

      try {
        const model = modelRef.current
        if (!model || !isMountedRef.current) {
          return false
        }

        const attemptMessages = messagesWithNewUser.map((m) => ({
          ...m,
          includeInContext: m.includeInContext !== false,
        }))

        const pruneContextToLatest = (keepN: number) => {
          const eligible = attemptMessages.filter((m) => m.id !== aiMessage.id && m.text.trim())

          const keepIds = new Set<string>()
          keepIds.add(userMessage.id)
          for (let i = Math.max(0, eligible.length - keepN); i < eligible.length; i++) {
            keepIds.add(eligible[i].id)
          }

          for (const m of attemptMessages) {
            if (m.id === aiMessage.id) continue
            if (!m.text.trim()) continue
            m.includeInContext = keepIds.has(m.id)
          }

          setMessages((prev) =>
            prev.map((m) => {
              if (!m.text?.trim()) return m
              if (m.id === aiMessage.id) return m
              return { ...m, includeInContext: keepIds.has(m.id) }
            }),
          )
        }

        const buildStreamParams = () => {
          if (!useContextHistory) return { model, prompt: userMessageText }
          return {
            model,
            messages: attemptMessages
              .filter(
                (msg) =>
                  msg.id !== aiMessageId && msg.text.trim() && msg.includeInContext !== false,
              )
              .map((msg) => ({
                role: msg.isUser ? ("user" as const) : ("assistant" as const),
                content: msg.text,
              })),
          }
        }

        const runStreamOnce = async () => {
          const { textStream } = streamText(buildStreamParams())
          let fullText = ""
          let started = false
          let updateScheduled = false

          const scheduleUpdate = () => {
            if (updateScheduled) return
            updateScheduled = true

            requestAnimationFrame(() => {
              setMessages((prev) =>
                prev.map((msg) => (msg.id === aiMessageId ? { ...msg, text: fullText } : msg)),
              )
              updateScheduled = false
            })
          }

          for await (const delta of textStream) {
            if (!started) {
              fullText = delta
              started = true
            } else {
              fullText += delta
            }
            scheduleUpdate()
          }

          // Final update
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMessageId ? { ...msg, text: fullText } : msg)),
          )
        }

        try {
          await runStreamOnce()
        } catch (error) {
          if (abortController.signal.aborted || !isMountedRef.current) throw error

          if (useContextHistory && isContextFullError(error)) {
            pruneContextToLatest(KEEP_LATEST_CONTEXT_MESSAGES)
            const totalTokens = messages
              .filter((item) => item.includeInContext)
              .map((item) => item.text)
              .join("").length

            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMessageId
                  ? { ...m, text: "", remainTokens: totalTokens }
                  : { ...m, remainTokens: totalTokens },
              ),
            )
            await runStreamOnce()
          } else {
            throw error
          }
        }

        if (isMountedRef.current && !abortController.signal.aborted) {
          setIsLoading(false)
        }
        return true
      } catch (error) {
        if (!isMountedRef.current || abortController.signal.aborted) {
          return false
        }

        console.error("[useMessageStream] Error streaming AI response:", error)

        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiMessageId ? { ...msg, text: String(error) } : msg)),
        )

        setIsLoading(false)
        return false
      } finally {
        streamAbortControllerRef.current = null
      }
    },
    [isLoading, modelRef, isMountedRef, messages, setMessages, scrollToBottom, useContextHistory],
  )

  /**
   * Abort ongoing stream
   */
  const abortStream = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
      streamAbortControllerRef.current = null
    }
  }, [])

  return {
    isLoading,
    handleSend,
    abortStream,
    streamAbortControllerRef,
  }
}
