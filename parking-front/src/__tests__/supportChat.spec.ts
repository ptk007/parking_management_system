import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { chatService } from '@/services/api'
import { useChatStore } from '@/stores/chat'
import type { ChatTicket } from '@/types'

vi.mock('@/services/api', () => ({
  chatService: {
    getTickets: vi.fn(),
    getTicket: vi.fn(),
    createTicket: vi.fn(),
    sendMessage: vi.fn(),
    claimTicket: vi.fn(),
    updateTicketStatus: vi.fn(),
    markRead: vi.fn(),
  },
}))

const response = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const ticket = (
  id = 'one',
  messageId = 'message-one',
  updatedAt = '2026-09-08T09:00:00Z',
): ChatTicket => {
  const message = {
    _id: messageId,
    sender: 'owner',
    senderName: 'User',
    senderType: 'user' as const,
    message: messageId,
    timestamp: updatedAt,
  }
  return {
    _id: id,
    ticketNumber: `SUP-${id}`,
    owner: { _id: 'owner', name: 'User' },
    assignedSupport: null,
    subject: 'Parking issue',
    category: 'parking',
    location: 'E4',
    status: 'open',
    createdAt: updatedAt,
    updatedAt,
    lastMessage: message,
    messages: [message],
    unreadCount: 1,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
})

describe('support conversation state', () => {
  it('does not display an old request after selecting another conversation', async () => {
    const chat = useChatStore()
    const first = deferred<AxiosResponse<{ ticket: ChatTicket }>>()
    vi.mocked(chatService.getTicket)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(response({ ticket: ticket('two') }))
    const loading = chat.loadTicket('one')
    await chat.loadTicket('two')
    first.resolve(response({ ticket: ticket('one') }))
    await loading
    expect(chat.selectedTicketId).toBe('two')
    expect(chat.currentTicket?._id).toBe('two')
    expect(chat.isLoadingThread).toBe(false)
  })

  it('discards responses from a previous account after reset', async () => {
    const chat = useChatStore()
    const sending = deferred<AxiosResponse<{ ticket: ChatTicket }>>()
    vi.mocked(chatService.createTicket).mockReturnValue(sending.promise)
    const creating = chat.createTicket({
      subject: 'Issue',
      category: 'parking',
      location: '',
      message: 'Help',
    })
    chat.reset()
    sending.resolve(response({ ticket: ticket() }))
    expect(await creating).toBeNull()
    expect(chat.tickets).toEqual([])
    expect(chat.currentTicket).toBeNull()
    expect(chat.selectedTicketId).toBeNull()
  })

  it('does not overwrite a sent message with a stale list refresh', async () => {
    const chat = useChatStore()
    const listing = deferred<AxiosResponse<{ tickets: ChatTicket[] }>>()
    vi.mocked(chatService.getTickets).mockReturnValue(listing.promise)
    const loading = chat.loadTickets()
    const latest = ticket('one', 'new-message', '2026-09-08T10:00:00Z')
    vi.mocked(chatService.sendMessage).mockResolvedValue(response({ ticket: latest }))
    await chat.sendMessage('one', 'new-message')
    listing.resolve(response({ tickets: [ticket()] }))
    await loading
    expect(chat.tickets[0]?.lastMessage?._id).toBe('new-message')
  })

  it('does not overwrite a sent message with a stale thread refresh', async () => {
    const chat = useChatStore()
    vi.mocked(chatService.getTicket).mockResolvedValueOnce(response({ ticket: ticket() }))
    await chat.loadTicket('one')
    const refreshing = deferred<AxiosResponse<{ ticket: ChatTicket }>>()
    vi.mocked(chatService.getTicket).mockReturnValueOnce(refreshing.promise)
    const loading = chat.loadTicket('one', true)
    vi.mocked(chatService.sendMessage).mockResolvedValue(
      response({ ticket: ticket('one', 'new-message', '2026-09-08T10:00:00Z') }),
    )
    await chat.sendMessage('one', 'new-message')
    refreshing.resolve(response({ ticket: ticket() }))
    await loading
    expect(chat.currentTicket?.lastMessage?._id).toBe('new-message')
  })

  it('blocks duplicate sends while a request is pending', async () => {
    const chat = useChatStore()
    const sending = deferred<AxiosResponse<{ ticket: ChatTicket }>>()
    vi.mocked(chatService.sendMessage).mockReturnValue(sending.promise)
    const first = chat.sendMessage('one', 'hello')
    expect(await chat.sendMessage('one', 'hello')).toBeNull()
    expect(chatService.sendMessage).toHaveBeenCalledTimes(1)
    sending.resolve(response({ ticket: ticket() }))
    await first
    expect(chat.isSending).toBe(false)
  })

  it('reports a failed send without adding a message and allows retry', async () => {
    const chat = useChatStore()
    vi.mocked(chatService.sendMessage)
      .mockRejectedValueOnce(
        new AxiosError(
          'Unavailable',
          'ERR_BAD_RESPONSE',
          undefined,
          undefined,
          response({ message: 'Please try again.' }),
        ),
      )
      .mockResolvedValueOnce(response({ ticket: ticket() }))
    expect(await chat.sendMessage('one', 'hello')).toBeNull()
    expect(chat.actionError).toBe('Please try again.')
    expect(chat.tickets).toEqual([])
    expect(chat.isSending).toBe(false)
    expect(await chat.sendMessage('one', 'hello')).not.toBeNull()
    expect(chat.actionError).toBe('')
  })

  it('keeps a new message unread when an older read request completes', async () => {
    const chat = useChatStore()
    vi.mocked(chatService.getTicket).mockResolvedValueOnce(response({ ticket: ticket() }))
    await chat.loadTicket('one')
    const reading = deferred<AxiosResponse>()
    vi.mocked(chatService.markRead).mockReturnValue(reading.promise)
    const marking = chat.markRead()
    vi.mocked(chatService.getTicket).mockResolvedValueOnce(
      response({ ticket: ticket('one', 'new-message', '2026-09-08T10:00:00Z') }),
    )
    await chat.loadTicket('one', true)
    reading.resolve(response({ success: true }))
    await marking
    expect(chat.currentTicket?.unreadCount).toBe(1)
    expect(chat.unreadCount).toBe(1)
  })
})
