import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isAxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import type { ChatTicket, NewSupportTicket } from '@/types'
import { chatService } from '@/services/api'

const errorMessage = (error: unknown, fallback: string) =>
  (isAxiosError<{ message?: string }>(error) && error.response?.data?.message) || fallback

export const useChatStore = defineStore('chat', () => {
  const tickets = ref<ChatTicket[]>([])
  const currentTicket = ref<ChatTicket | null>(null)
  const selectedTicketId = ref<string | null>(null)
  const isLoading = ref(false)
  const isLoadingThread = ref(false)
  const isSending = ref(false)
  const error = ref('')
  const actionError = ref('')
  const isOpen = ref(false)
  const unreadCount = computed(() =>
    tickets.value.reduce((count, ticket) => count + ticket.unreadCount, 0),
  )
  let session = 0
  let revision = 0
  let threadRequest = 0
  let refreshing = false

  const upsert = (ticket: ChatTicket) => {
    revision++
    tickets.value = [ticket, ...tickets.value.filter((item) => item._id !== ticket._id)].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )
    if (selectedTicketId.value === ticket._id) currentTicket.value = ticket
  }

  const reset = () => {
    session++
    revision++
    threadRequest++
    tickets.value = []
    currentTicket.value = null
    selectedTicketId.value = null
    isOpen.value = false
    isLoading.value = false
    isLoadingThread.value = false
    isSending.value = false
    error.value = ''
    actionError.value = ''
  }

  const loadTickets = async (quiet = false) => {
    const currentSession = session
    const currentRevision = revision
    if (!quiet) isLoading.value = true
    try {
      const response = await chatService.getTickets()
      if (currentSession !== session) return
      if (currentRevision === revision) tickets.value = response.data.tickets
      error.value = ''
    } catch (err) {
      if (currentSession === session)
        error.value = errorMessage(err, 'เชื่อมต่อ Support ไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      if (currentSession === session && !quiet) isLoading.value = false
    }
  }

  const loadTicket = async (ticketId: string, quiet = false) => {
    const request = ++threadRequest
    const currentSession = session
    if (!quiet) {
      selectedTicketId.value = ticketId
      currentTicket.value = null
      isLoadingThread.value = true
      actionError.value = ''
    }
    try {
      const response = await chatService.getTicket(ticketId)
      if (
        currentSession !== session ||
        request !== threadRequest ||
        selectedTicketId.value !== ticketId
      )
        return
      if (
        !currentTicket.value ||
        Date.parse(response.data.ticket.updatedAt) >= Date.parse(currentTicket.value.updatedAt)
      )
        upsert(response.data.ticket)
      error.value = ''
    } catch (err) {
      if (currentSession === session && request === threadRequest)
        error.value = errorMessage(err, 'โหลดบทสนทนาไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      if (currentSession === session && request === threadRequest) isLoadingThread.value = false
    }
  }

  const mutate = async (request: () => Promise<AxiosResponse<{ ticket: ChatTicket }>>) => {
    if (isSending.value) return null
    const currentSession = session
    isSending.value = true
    actionError.value = ''
    try {
      const response = await request()
      if (currentSession !== session) return null
      upsert(response.data.ticket)
      return response.data.ticket
    } catch (err) {
      if (currentSession === session)
        actionError.value = errorMessage(err, 'ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง')
      return null
    } finally {
      if (currentSession === session) isSending.value = false
    }
  }

  const createTicket = async (data: NewSupportTicket) => {
    const ticket = await mutate(() => chatService.createTicket(data))
    if (ticket) {
      selectedTicketId.value = ticket._id
      currentTicket.value = ticket
    }
    return ticket
  }
  const sendMessage = (ticketId: string, message: string) =>
    mutate(() => chatService.sendMessage(ticketId, message))
  const claimTicket = (ticketId: string) => mutate(() => chatService.claimTicket(ticketId))
  const updateTicketStatus = (ticketId: string, status: 'open' | 'done') =>
    mutate(() => chatService.updateTicketStatus(ticketId, status))

  const markRead = async () => {
    const ticket = currentTicket.value
    const message = ticket?.messages?.[ticket.messages.length - 1]
    if (!ticket || !message || !ticket.unreadCount) return
    const currentSession = session
    try {
      await chatService.markRead(ticket._id, message._id)
      if (currentSession !== session) return
      const summary = tickets.value.find((item) => item._id === ticket._id)
      if (summary && summary.lastMessage?._id === message._id) summary.unreadCount = 0
      if (
        currentTicket.value?._id === ticket._id &&
        currentTicket.value?.lastMessage?._id === message._id
      )
        currentTicket.value.unreadCount = 0
    } catch {
      // Keep the unread badge until the server confirms the read position.
    }
  }

  const refresh = async () => {
    if (refreshing) return
    const currentSession = session
    refreshing = true
    try {
      await loadTickets(true)
      if (
        currentSession === session &&
        isOpen.value &&
        selectedTicketId.value &&
        !isSending.value &&
        !isLoadingThread.value
      ) {
        await loadTicket(selectedTicketId.value, true)
      }
    } finally {
      refreshing = false
    }
  }

  const openChat = () => {
    isOpen.value = true
  }
  const closeChat = () => {
    isOpen.value = false
  }
  const clearSelection = () => {
    threadRequest++
    selectedTicketId.value = null
    currentTicket.value = null
    isLoadingThread.value = false
    actionError.value = ''
  }

  return {
    tickets,
    currentTicket,
    selectedTicketId,
    isLoading,
    isLoadingThread,
    isSending,
    error,
    actionError,
    unreadCount,
    isOpen,
    loadTickets,
    loadTicket,
    createTicket,
    sendMessage,
    claimTicket,
    updateTicketStatus,
    markRead,
    refresh,
    openChat,
    closeChat,
    clearSelection,
    reset,
  }
})
