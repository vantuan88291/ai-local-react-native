import { useCallback, useRef, useState, useEffect, useMemo } from "react"
import { FlatList, Keyboard, Platform } from "react-native"

import { Message } from "@/screens/ai/hooks/models"
import { promptAI } from "@/utils/aiHelper"
import { load, remove, save } from "@/utils/storage"

const SCROLL_DEBOUNCE_MS = 100

export const createMessage = (text: string, isUser: boolean): Message => ({
  id: `${Date.now()}-${Math.random()}`,
  text,
  isUser,
  timestamp: new Date(),
  includeInContext: true,
  remainTokens: 0,
})

interface UseMessagesOptions {
  modelId?: string
}

export const useMessages = (options: UseMessagesOptions = {}) => {
  const { modelId } = options

  const [messagesState, setMessagesState] = useState<Message[]>([])
  const [conversationSummary, setConversationSummary] = useState<string | null>(null)

  const msgRef = useRef<Message[]>([])
  const listRef = useRef<FlatList<Message>>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef<boolean>(true)

  // Custom setMessages that syncs msgRef immediately
  const setMessages = useCallback((updater: React.SetStateAction<Message[]>) => {
    setMessagesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      msgRef.current = next
      return next
    })
  }, [])

  const messages = messagesState

  const scrollToBottomDebounced = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true })
      }
    }, SCROLL_DEBOUNCE_MS)
  }, [])

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  /**
   * Clear all conversation messages
   */
  const clearConversation = useCallback(() => {
    if (!modelId) return

    setMessages([])
    msgRef.current = []

    try {
      remove(modelId)
    } catch (error) {
      console.error("[useMessages] Failed to clear conversation:", error)
    }
  }, [modelId, setMessages])

  /**
   * Update a specific message by ID
   */
  const updateMessage = useCallback(
    (messageId: string, updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? updater(msg) : msg)))
    },
    [setMessages],
  )

  /**
   * Add messages to the beginning (newest first for inverted list)
   */
  const prependMessages = useCallback(
    (...newMessages: Message[]) => {
      setMessages((prev) => [...newMessages, ...prev])
    },
    [setMessages],
  )

  /**
   * Calculate total tokens from context messages
   */
  const totalToken = useMemo(() => {
    return messages
      .filter((item) => item.includeInContext)
      .map((item) => item.text)
      .join("").length
  }, [messages])

  /**
   * Get remaining tokens from the last message
   */
  const remainTokens = useMemo(() => {
    return messages?.[messages?.length - 1]?.remainTokens
  }, [messages])

  /**
   * Load messages and setup keyboard listener on mount
   */
  useEffect(() => {
    isMountedRef.current = true

    // Load persisted messages (only if modelId exists)
    if (modelId) {
      const listMsg = load<Message[]>(modelId) || []
      if (listMsg?.length) {
        // Storage is chronological; state is newest-first
        setMessages(
          [...listMsg]
            .map((m) => ({ ...m, includeInContext: m?.includeInContext !== false }))
            .reverse(),
        )

        // Generate conversation summary
        promptAI(modelId, "", {
          messages: [
            ...listMsg
              .map((msg) => ({
                role: msg.isUser ? ("user" as const) : ("assistant" as const),
                content: msg.text,
              }))
              .slice(0, 5),
            {
              role: "user",
              content:
                "Summarize this conversation in one sentence, using the same language as the conversation.",
            },
          ],
        }).then((data) => {
          if (isMountedRef.current) {
            setConversationSummary(data)
          }
        })
      }
    }

    // Keyboard listener for auto-scroll
    function onKeyboardDidShow() {
      setTimeout(() => {
        scrollToBottomDebounced()
      }, 500)
    }

    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      onKeyboardDidShow,
    )

    return () => {
      showSubscription.remove()

      // Persist messages on unmount (only if modelId exists)
      if (modelId && msgRef.current?.length) {
        save(
          modelId,
          [...msgRef.current]
            .map((m) => ({ ...m, includeInContext: m?.includeInContext !== false }))
            .reverse(),
        )
      }

      msgRef.current = []
      isMountedRef.current = false

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId])

  return {
    messages,
    setMessages,
    listRef,
    msgRef,
    isMountedRef,
    clearConversation,
    updateMessage,
    prependMessages,
    scrollToBottom,
    scrollToBottomDebounced,
    conversationSummary,
    totalToken,
    remainTokens,
  }
}
