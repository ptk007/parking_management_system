import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatTicket } from '@/types'
import { chatService } from '@/services/api'

export const useChatStore = defineStore('chat', () => {
  const tickets = ref<ChatTicket[]>([])
  const currentTicket = ref<ChatTicket | null>(null)
  const isLoading = ref(false)
  const error = ref<string>('')
  const unreadCount = ref(0)
  const isOpen = ref(false)

  const loadTickets = async () => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await chatService.getTickets()
      tickets.value = response.data
      unreadCount.value = response.data.filter((t: ChatTicket) => t.status === 'open').length
    } catch (err: any) {
      error.value = err.message || 'Failed to load tickets'
    } finally {
      isLoading.value = false
    }
  }

  const loadTicket = async (ticketId: string) => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await chatService.getTicket(ticketId)
      currentTicket.value = response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to load ticket'
    } finally {
      isLoading.value = false
    }
  }

  const createTicket = async (subject: string, message: string) => {
    try {
      const response = await chatService.createTicket(subject, message)
      tickets.value.push(response.data)
      return true
    } catch (err) {
      error.value = 'Failed to create ticket'
      return false
    }
  }

  const sendMessage = async (ticketId: string, message: string) => {
    try {
      await chatService.sendMessage(ticketId, message)
      await loadTicket(ticketId)
      return true
    } catch (err) {
      error.value = 'Failed to send message'
      return false
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await chatService.updateTicketStatus(ticketId, status)
      await loadTickets()
      return true
    } catch (err) {
      error.value = 'Failed to update ticket status'
      return false
    }
  }

  const openChat = () => {
    isOpen.value = true
  }

  const closeChat = () => {
    isOpen.value = false
  }

  return {
    tickets,
    currentTicket,
    isLoading,
    error,
    unreadCount,
    isOpen,
    loadTickets,
    loadTicket,
    createTicket,
    sendMessage,
    updateTicketStatus,
    openChat,
    closeChat,
  }
})
