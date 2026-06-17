<template>
  <div>
    <button class="chat-launcher" type="button" aria-label="Open support chat" @click="toggleChat">
      <MessageSquare class="h-9 w-9" :stroke-width="2.4" />
      <span>{{ unreadCount }}</span>
    </button>

    <transition name="chat-panel">
      <aside v-if="isOpen" class="chat-drawer">
        <section class="ticket-list">
          <button
            v-for="ticket in displayTickets"
            :key="ticket.id"
            :class="['ticket-row', selectedTicketId === ticket.id ? 'is-selected' : '']"
            type="button"
            @click="selectedTicketId = ticket.id"
          >
            <div class="ticket-avatar" :class="ticket.avatarClass">{{ ticket.initials }}</div>
            <div class="ticket-copy">
              <strong>{{ ticket.name }}</strong>
              <span>{{ ticket.preview }}</span>
            </div>
            <time>{{ ticket.time }}</time>
            <em :class="ticket.status === 'Done' ? 'done' : 'open'">{{ ticket.status }}</em>
          </button>
        </section>

        <section class="chat-thread">
          <header>{{ selectedTicket?.header }}</header>

          <div class="thread-body">
            <div class="message incoming">
              <div class="small-avatar">EN</div>
              <div>
                <p>Hey! my car has got stolen can u help me find my car</p>
                <time>08:31</time>
              </div>
            </div>

            <div class="message outgoing">
              <div>
                <p>Nah,I can't do it</p>
                <time>08:33</time>
              </div>
              <div class="reply-avatar">TP</div>
            </div>
          </div>

          <div class="quick-replies">
            <button 
              v-for="reply in quickReplies" 
              :key="reply" 
              type="button"
              :disabled="isSending"
              @click="handleQuickReply"
            >
              {{ reply }}
            </button>
          </div>
        </section>

        <footer class="reply-box">
          <button type="button" aria-label="Attach file" :disabled="isSending">
            <Paperclip class="h-6 w-6" :stroke-width="1.8" />
          </button>
          <input 
            v-model="replyText" 
            :disabled="isSending"
            :placeholder="`Reply to ${selectedTicket?.shortName || 'Euro'}...`" 
          />
          <button 
            class="send-button" 
            type="button" 
            :disabled="isSending || !replyText.trim()"
            @click="handleSendMessage"
            aria-label="Send message"
          >
            <SendHorizontal class="h-8 w-8" :stroke-width="2.4" />
          </button>
        </footer>
      </aside>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MessageSquare, Paperclip, SendHorizontal } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'

interface DisplayTicket {
  id: string
  initials: string
  name: string
  shortName: string
  preview: string
  time: string
  status: 'Open' | 'Done'
  header: string
  avatarClass: string
}

const chatStore = useChatStore()
const isOpen = ref(false)
const selectedTicketId = ref('ticket-1234')
const replyText = ref('')
const isSending = ref(false)

const mockTickets: DisplayTicket[] = [
  {
    id: 'ticket-1234',
    initials: 'EN',
    name: 'Euro N.',
    shortName: 'Euro',
    preview: 'Hey! my car has got stolen',
    time: '3h',
    status: 'Open',
    header: 'Today Euro  -- Ticket#1234',
    avatarClass: 'avatar-red',
  },
  {
    id: 'ticket-2231',
    initials: 'TG',
    name: 'Tridasdate G.',
    shortName: 'Tridasdate',
    preview: 'CCTV CAM 2 is blurry',
    time: '4h',
    status: 'Open',
    header: 'Today Tridasdate  -- Ticket#2231',
    avatarClass: 'avatar-green',
  },
  {
    id: 'ticket-2232',
    initials: 'TG',
    name: 'Tridasdate G.',
    shortName: 'Tridasdate',
    preview: 'CCTV CAM 2 is blurry',
    time: '5h',
    status: 'Done',
    header: 'Today Tridasdate  -- Ticket#2232',
    avatarClass: 'avatar-green',
  },
]

const displayTickets = computed<DisplayTicket[]>(() => {
  if (!chatStore.tickets.length) return mockTickets

  return chatStore.tickets.slice(0, 3).map((ticket, index) => ({
    id: ticket._id,
    initials: index === 0 ? 'EN' : 'TG',
    name: ticket.subject || 'Support ticket',
    shortName: ticket.subject?.split(' ')[0] || 'Support',
    preview: ticket.messages?.[0]?.message || ticket.subject || 'No message yet',
    time: `${index + 3}h`,
    status: ticket.status === 'done' ? 'Done' : 'Open',
    header: `Today ${ticket.subject || 'Support'}  -- ${ticket.ticketNumber}`,
    avatarClass: index === 0 ? 'avatar-red' : 'avatar-green',
  }))
})

const selectedTicket = computed(
  () => displayTickets.value.find((ticket) => ticket.id === selectedTicketId.value) || displayTickets.value[0],
)

const unreadCount = computed(() => chatStore.unreadCount || 3)
const quickReplies = ['Fixed!', 'Fixed!', 'Fixed!', 'Fixed!']

const toggleChat = () => {
  isOpen.value = !isOpen.value
}

const handleQuickReply = async () => {
  if (isSending.value) return
  
  isSending.value = true
  try {
    // Simulate sending reply
    await new Promise(resolve => setTimeout(resolve, 800))
    // Clear after sending
    replyText.value = ''
  } finally {
    isSending.value = false
  }
}

const handleSendMessage = async () => {
  if (isSending.value || !replyText.value.trim()) return
  
  isSending.value = true
  try {
    // Simulate sending message
    await new Promise(resolve => setTimeout(resolve, 800))
    // Clear after sending
    replyText.value = ''
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  if (isOpen.value) {
    chatStore.loadTickets()
  }
  chatStore.loadTickets()
})
</script>

<style scoped>
.chat-launcher {
  position: fixed;
  right: 31px;
  bottom: 28px;
  z-index: 10000;
  width: 65px;
  height: 65px;
  border-radius: 999px;
  background: #cf3b30;
  color: #fff;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.chat-launcher span {
  position: absolute;
  top: -2px;
  right: -5px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #fff;
  color: #cf3b30;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 800;
}

.chat-drawer {
  position: fixed;
  right: 0;
  bottom: 0;
  z-index: 9999;
  width: 368px;
  max-width: 100vw;
  height: min(738px, calc(100vh - 14px));
  border-radius: 0 0 0 10px;
  background: #fff;
  overflow: hidden;
  box-shadow: -10px 0 26px rgba(0, 0, 0, 0.22);
  display: grid;
  grid-template-rows: auto 1fr auto auto;
}

.ticket-list {
  overflow-y: auto;
  border-bottom: 1px solid #1f1f1f;
  min-height: 0;
}

.ticket-row {
  width: 100%;
  height: 95px;
  display: grid;
  grid-template-columns: 48px 1fr 34px 76px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #2c2c2c;
  background: #fff;
  padding: 0 9px 0 3px;
  text-align: left;
}

.ticket-row.is-selected {
  background: #fdeceb;
}

.ticket-avatar {
  width: 50px;
  height: 50px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
}

.avatar-red {
  color: #a93226;
  background: transparent;
}

.avatar-green {
  background: #e5f1d8;
  color: #4f8c31;
}

.ticket-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.ticket-copy strong {
  color: #202020;
  font-size: 13px;
}

.ticket-copy span {
  color: #a0a0a0;
  font-size: 11px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-row time {
  align-self: start;
  margin-top: 28px;
  color: #8c8c8c;
  font-size: 12px;
}

.ticket-row em {
  width: 76px;
  height: 16px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

.ticket-row em.open {
  background: #cf3b30;
  color: #fff;
}

.ticket-row em.done {
  background: #d7f1e9;
  color: #16855f;
}

.chat-thread {
  min-height: 0;
  background: #f3f3f3;
  border-bottom: 2px solid #1f1f1f;
  display: grid;
  grid-template-rows: 48px 1fr;
  overflow: hidden;
}

.chat-thread header {
  color: #b0b0b0;
  display: grid;
  place-items: center;
  font-size: 13px;
}

.thread-body {
  position: relative;
  overflow-y: auto;
  padding: 6px 10px;
  min-height: 0;
}

.message {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.message p {
  max-width: 224px;
  border-radius: 9px;
  color: #111;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  padding: 10px 8px;
}

.message time {
  display: block;
  margin-top: 4px;
  color: #b0b0b0;
  font-size: 10px;
}

.incoming {
  justify-content: flex-start;
}

.incoming p {
  background: #fff;
}

.outgoing {
  justify-content: flex-end;
  margin-top: 98px;
}

.outgoing p {
  background: #cf3b30;
  color: #fff;
  font-size: 13px;
}

.outgoing time {
  text-align: right;
}

.small-avatar {
  color: #cf3b30;
  font-size: 18px;
  font-weight: 800;
}

.reply-avatar {
  width: 58px;
  height: 58px;
  border-radius: 999px;
  background: #cf3b30;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 800;
}

.quick-replies {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  padding: 8px 10px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  min-height: 0;
}

.quick-replies button {
  height: 15px;
  border: 1px solid #f0b4ae;
  border-radius: 999px;
  background: #fff7f6;
  color: #cf3b30;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-replies button:hover:not(:disabled) {
  background: #ffe8e4;
  border-color: #cf3b30;
}

.quick-replies button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
  color: #ccc;
  border-color: #ddd;
}

.reply-box {
  display: grid;
  grid-template-columns: 36px 1fr 64px;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
  min-height: 0;
}

.reply-box > button:first-child {
  color: #c7c7c7;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 4px;
  border-radius: 8px;
}

.reply-box > button:first-child:hover:not(:disabled) {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.reply-box > button:first-child:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reply-box input {
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: #050505;
  color: #fff;
  padding: 0 8px;
  font-size: 16px;
  font-weight: 800;
  outline: none;
  min-width: 0;
  transition: all 0.2s ease;
}

.reply-box input::placeholder {
  color: #fff;
}

.reply-box input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #3a3a3a;
}

.send-button {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: #cf3b30;
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.send-button:hover:not(:disabled) {
  background: #b92f24;
  transform: scale(1.05);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #999;
}

.chat-panel-enter-active,
.chat-panel-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
