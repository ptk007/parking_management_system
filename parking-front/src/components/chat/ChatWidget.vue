<template>
  <button
    v-if="!chat.isOpen"
    class="support-launcher"
    type="button"
    aria-label="เปิดแชต Support"
    @click="chat.openChat"
  >
    <Headphones :size="23" /><span>{{ isSupport ? 'Support Inbox' : 'ติดต่อ Support' }}</span>
    <span v-if="chat.unreadCount" class="launcher-count">{{
      chat.unreadCount > 99 ? '99+' : chat.unreadCount
    }}</span>
  </button>
  <dialog
    ref="panel"
    class="support-panel"
    :class="{ 'staff-panel': isSupport }"
    aria-labelledby="support-title"
    @cancel.prevent="chat.closeChat"
    @click.self="chat.closeChat"
  >
    <div class="panel-shell">
      <header class="support-header">
        <span class="header-icon"><Headphones :size="24" /></span>
        <div class="header-copy">
          <h2 id="support-title">{{ isSupport ? 'Support Inbox' : 'MFU Support' }}</h2>
          <p>
            {{
              isSupport ? 'รับเรื่องและช่วยเหลือผู้ใช้งาน' : 'ผู้ช่วยดูแลเรื่องการใช้งานและที่จอดรถ'
            }}
          </p>
        </div>
        <button
          class="header-button"
          type="button"
          aria-label="รีเฟรชแชต"
          :disabled="chat.isLoading || chat.isLoadingThread"
          @click="chat.refresh"
        >
          <RefreshCw :size="18" />
        </button>
        <button
          class="header-button"
          type="button"
          aria-label="ปิดแชต"
          autofocus
          @click="chat.closeChat"
        >
          <X :size="21" />
        </button>
      </header>
      <div v-if="chat.error" class="connection-error" role="alert">
        <span>{{ chat.error }}</span
        ><button type="button" @click="chat.refresh">ลองอีกครั้ง</button>
      </div>
      <div
        class="support-workspace"
        :class="{ 'show-thread': chat.selectedTicketId || showNewTicket }"
      >
        <section class="support-inbox" aria-label="รายการเรื่องที่แจ้ง">
          <div v-if="!isSupport" class="welcome-card">
            <span class="eyebrow">WE'RE HERE TO HELP</span>
            <h3>มีอะไรให้เราช่วยไหม?</h3>
            <p>แจ้งปัญหาให้เจ้าหน้าที่รับเรื่อง<br />และติดตามคำตอบได้ในแชตนี้</p>
            <button class="primary-button" type="button" @click="startNewTicket">
              <Plus :size="17" />แจ้งปัญหาใหม่
            </button>
          </div>
          <div class="inbox-heading">
            <h3>{{ isSupport ? 'เรื่องที่ต้องดูแล' : 'เรื่องของคุณ' }}</h3>
            <span>{{ chat.tickets.length }}</span>
          </div>
          <label v-if="isSupport || chat.tickets.length > 3" class="ticket-search"
            ><Search :size="16" /><input
              v-model="search"
              aria-label="ค้นหาเรื่อง"
              placeholder="ค้นหาหัวข้อหรือชื่อผู้แจ้ง"
          /></label>
          <div class="ticket-filters" aria-label="กรองสถานะเรื่อง">
            <button
              v-for="filter in filters"
              :key="filter.id"
              type="button"
              :class="{ active: activeFilter === filter.id }"
              :aria-pressed="activeFilter === filter.id"
              @click="activeFilter = filter.id"
            >
              {{ filter.label
              }}<span v-if="filter.id === 'open' && waitingCount">{{ waitingCount }}</span>
            </button>
          </div>
          <div class="ticket-list">
            <div v-if="chat.isLoading && !chat.tickets.length" class="empty-state">
              <RefreshCw class="spin" :size="25" />
              <p>กำลังโหลดรายการ...</p>
            </div>
            <div v-else-if="!filteredTickets.length" class="empty-state">
              <Inbox :size="30" /><strong>{{
                chat.error
                  ? 'ยังโหลดรายการไม่ได้'
                  : search || activeFilter !== 'all'
                    ? 'ไม่พบเรื่องที่ตรงกัน'
                    : isSupport
                      ? 'ยังไม่มีเรื่องเข้ามา'
                      : 'ยังไม่มีเรื่องที่แจ้ง'
              }}</strong>
              <p>
                {{
                  isSupport
                    ? 'เรื่องใหม่จากผู้ใช้จะแสดงที่นี่'
                    : 'เมื่อแจ้งปัญหาแล้ว คุณกลับมาติดตามได้ที่นี่'
                }}
              </p>
            </div>
            <button
              v-for="item in filteredTickets"
              :key="item._id"
              type="button"
              class="ticket-row"
              :class="{ selected: chat.selectedTicketId === item._id }"
              @click="selectTicket(item._id)"
            >
              <span class="ticket-avatar"
                ><span v-if="isSupport">{{ initials(item.owner.name) }}</span
                ><MessageSquare v-else :size="19"
              /></span>
              <span class="ticket-copy"
                ><span class="ticket-topline"
                  ><strong>{{ isSupport ? item.owner.name : item.subject }}</strong
                  ><time>{{ listTime(item.updatedAt) }}</time></span
                ><span v-if="isSupport" class="ticket-subject">{{ item.subject }}</span
                ><span class="ticket-preview">{{
                  item.lastMessage?.message || 'เริ่มต้นบทสนทนา'
                }}</span
                ><span class="ticket-bottomline"
                  ><span class="status-badge" :class="item.status">{{
                    statusLabels[item.status]
                  }}</span
                  ><span v-if="item.unreadCount" class="unread-dot">{{ item.unreadCount }}</span
                  ><ChevronRight v-else :size="14" /></span
              ></span>
            </button>
          </div>
          <div class="inbox-footer">
            <ShieldCheck :size="14" /><span>{{
              isSupport
                ? 'เฉพาะ Staff ที่รับเรื่องเป็นผู้ตอบกลับ'
                : 'บทสนทนาของคุณกับเจ้าหน้าที่ Support'
            }}</span>
          </div>
        </section>
        <section v-if="showNewTicket" class="new-ticket-panel">
          <div class="thread-heading">
            <button
              class="icon-button"
              type="button"
              aria-label="กลับไปรายการเรื่อง"
              @click="backToInbox"
            >
              <ArrowLeft :size="20" />
            </button>
            <div>
              <h3>แจ้งปัญหาใหม่</h3>
              <p>เล่าให้เราฟัง เพื่อให้ช่วยเหลือได้ตรงจุด</p>
            </div>
          </div>
          <form class="new-ticket-form" @submit.prevent="submitTicket">
            <fieldset :disabled="chat.isSending">
              <label
                ><span>หัวข้อปัญหา <em>*</em></span
                ><input
                  v-model.trim="newTicket.subject"
                  maxlength="120"
                  required
                  placeholder="เช่น ไม่พบข้อมูลรถที่ลงทะเบียน"
              /></label>
              <div class="form-row">
                <label
                  ><span>ประเภทปัญหา</span
                  ><select v-model="newTicket.category">
                    <option v-for="category in categories" :key="category.id" :value="category.id">
                      {{ category.label }}
                    </option>
                  </select></label
                ><label
                  ><span>อาคาร / ชั้น <small>(ถ้ามี)</small></span
                  ><input
                    v-model.trim="newTicket.location"
                    maxlength="120"
                    placeholder="เช่น E4 ชั้น 4"
                /></label>
              </div>
              <label
                ><span>รายละเอียด <em>*</em></span
                ><textarea
                  v-model.trim="newTicket.message"
                  rows="6"
                  maxlength="4000"
                  required
                  placeholder="อธิบายปัญหาที่พบ เวลา และข้อมูลที่ต้องการให้เจ้าหน้าที่ช่วยตรวจสอบ"
                ></textarea
                ><small class="character-count"
                  >{{ newTicket.message.length.toLocaleString() }} / 4,000</small
                ></label
              >
            </fieldset>
            <p v-if="chat.actionError" class="action-error" role="alert">{{ chat.actionError }}</p>
            <div class="form-note">
              <MessageSquare :size="19" />
              <p>หลังส่งเรื่อง คุณสามารถพิมพ์รายละเอียดเพิ่มเติมและคุยกับ Staff ได้ในแชต</p>
            </div>
            <button
              class="primary-button submit-ticket"
              type="submit"
              :disabled="chat.isSending || !newTicket.subject.trim() || !newTicket.message.trim()"
            >
              <SendHorizontal :size="17" />{{
                chat.isSending ? 'กำลังส่งเรื่อง...' : 'ส่งเรื่องให้ Support'
              }}
            </button>
          </form>
        </section>
        <section
          v-else-if="chat.selectedTicketId"
          class="conversation"
          aria-label="บทสนทนากับ Support"
        >
          <div v-if="chat.isLoadingThread" class="empty-state thread-loading">
            <RefreshCw class="spin" :size="26" />
            <p>กำลังโหลดบทสนทนา...</p>
          </div>
          <template v-else-if="ticket">
            <header class="thread-heading">
              <button
                class="icon-button back-button"
                type="button"
                aria-label="กลับไปรายการเรื่อง"
                @click="backToInbox"
              >
                <ArrowLeft :size="20" />
              </button>
              <div class="thread-title">
                <h3>{{ ticket.subject }}</h3>
                <p>{{ ticket.ticketNumber }}</p>
              </div>
              <span class="status-badge" :class="ticket.status">{{
                statusLabels[ticket.status]
              }}</span>
            </header>
            <div class="ticket-context">
              <span>{{ categoryLabel(ticket.category) }}</span
              ><span v-if="ticket.location"><MapPin :size="13" />{{ ticket.location }}</span>
            </div>
            <div
              v-if="ticket.status !== 'done'"
              class="assignment-banner"
              :class="{ assigned: ticket.assignedSupport }"
            >
              <span class="assignment-copy"
                ><component
                  :is="ticket.assignedSupport ? ShieldCheck : Clock3"
                  :size="17"
                /><span>{{
                  ticket.assignedSupport
                    ? `ดูแลโดย ${ticket.assignedSupport.name}`
                    : 'ส่งเรื่องแล้ว · รอ Staff รับเรื่อง'
                }}</span></span
              >
              <button
                v-if="isSupport && ticket.status === 'open'"
                class="claim-button"
                type="button"
                :disabled="chat.isSending"
                @click="chat.claimTicket(ticket._id)"
              >
                {{ chat.isSending ? 'กำลังรับเรื่อง...' : 'รับเรื่องนี้' }}
              </button>
              <button
                v-else-if="isAssignedToMe"
                class="resolve-button"
                type="button"
                :disabled="chat.isSending"
                @click="chat.updateTicketStatus(ticket._id, 'done')"
              >
                <Check :size="14" />ปิดเรื่อง
              </button>
            </div>
            <div
              ref="messageList"
              class="message-list"
              role="log"
              aria-label="ข้อความในบทสนทนา"
              aria-live="polite"
              @scroll="handleScroll"
            >
              <template v-for="(message, index) in ticket.messages" :key="message._id">
                <div v-if="isNewDay(index)" class="day-divider">
                  <span>{{ dateLabel(message.timestamp) }}</span>
                </div>
                <article
                  class="chat-message"
                  :class="{ outgoing: message.sender === currentUserId }"
                >
                  <span v-if="message.sender !== currentUserId" class="message-avatar"
                    ><Headphones v-if="message.senderType === 'support'" :size="16" /><span
                      v-else
                      >{{ initials(message.senderName) }}</span
                    ></span
                  >
                  <div class="message-copy">
                    <span class="sender-name"
                      >{{ message.sender === currentUserId ? 'คุณ' : message.senderName
                      }}<span v-if="message.senderType === 'support'" class="support-tag"
                        >Support</span
                      ></span
                    >
                    <p>{{ message.message }}</p>
                    <time
                      >{{ timeLabel(message.timestamp)
                      }}<CheckCheck
                        v-if="message.sender === currentUserId"
                        :size="12"
                        aria-label="ส่งแล้ว"
                    /></time>
                  </div>
                </article>
              </template>
              <div v-if="ticket.status === 'done'" class="resolved-card">
                <CircleCheck :size="27" /><strong>เรื่องนี้แก้ไขแล้ว</strong>
                <p>หากยังพบปัญหา คุณสามารถเปิดเรื่องนี้อีกครั้งได้</p>
                <button
                  v-if="!isSupport || isAssignedToMe"
                  type="button"
                  :disabled="chat.isSending"
                  @click="chat.updateTicketStatus(ticket._id, 'open')"
                >
                  เปิดเรื่องอีกครั้ง
                </button>
              </div>
            </div>
            <p v-if="chat.actionError" class="action-error thread-error" role="alert">
              {{ chat.actionError }}
            </p>
            <div v-if="canReply" class="composer-area">
              <div v-if="isSupport" class="quick-replies">
                <button
                  v-for="reply in quickReplies"
                  :key="reply.label"
                  type="button"
                  :disabled="chat.isSending"
                  @click="useQuickReply(reply.text)"
                >
                  {{ reply.label }}
                </button>
              </div>
              <form class="message-composer" @submit.prevent="sendReply">
                <textarea
                  ref="composer"
                  v-model="replyText"
                  rows="2"
                  maxlength="4000"
                  :disabled="chat.isSending"
                  :aria-label="isSupport ? 'ข้อความตอบกลับผู้ใช้' : 'ข้อความถึง Support'"
                  :placeholder="
                    isSupport ? 'พิมพ์ข้อความตอบกลับผู้ใช้...' : 'พิมพ์ข้อความถึง Support...'
                  "
                  @keydown="handleComposerKey"
                ></textarea
                ><button
                  class="send-button"
                  type="submit"
                  :disabled="chat.isSending || !replyText.trim()"
                  aria-label="ส่งข้อความ"
                >
                  <RefreshCw v-if="chat.isSending" class="spin" :size="20" /><SendHorizontal
                    v-else
                    :size="20"
                  />
                </button>
              </form>
              <div class="composer-hint">
                <span>Enter เพื่อส่ง · Shift + Enter ขึ้นบรรทัดใหม่</span
                ><span v-if="replyText.length">{{ replyText.length.toLocaleString() }}/4,000</span>
              </div>
            </div>
            <div v-else-if="ticket.status !== 'done'" class="read-only-note">
              {{
                ticket.assignedSupport
                  ? 'Staff ที่รับเรื่องนี้จะเป็นผู้ตอบกลับ'
                  : 'กดรับเรื่องเพื่อเริ่มตอบกลับผู้ใช้'
              }}
            </div>
          </template>
          <div v-else class="empty-state thread-loading">
            <Inbox :size="30" /><strong>ยังเปิดบทสนทนาไม่ได้</strong
            ><button class="secondary-button" type="button" @click="backToInbox">
              กลับไปรายการเรื่อง
            </button>
          </div>
        </section>
        <div v-else-if="isSupport" class="conversation-placeholder">
          <span class="placeholder-icon"><Headphones :size="36" /></span>
          <h3>พร้อมช่วยเหลือผู้ใช้งาน</h3>
          <p>เลือกเรื่องจากรายการด้านซ้าย<br />แล้วกดรับเรื่องเพื่อเริ่มบทสนทนา</p>
          <span class="placeholder-caption"
            ><ShieldCheck :size="15" />รับเรื่อง · พูดคุย · ติดตามการแก้ไข</span
          >
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  Headphones,
  Inbox,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  ShieldCheck,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { NewSupportTicket, TicketCategory, TicketStatus } from '@/types'

const auth = useAuthStore()
const chat = useChatStore()
const isSupport = computed(() => auth.user?.role === 'staff' && !auth.isGuest)
const currentUserId = computed(() => auth.user?._id || '')
const ticket = computed(() => chat.currentTicket)
const isAssignedToMe = computed(
  () => isSupport.value && ticket.value?.assignedSupport?._id === currentUserId.value,
)
const canReply = computed(
  () =>
    ticket.value && ticket.value.status !== 'done' && (!isSupport.value || isAssignedToMe.value),
)
const panel = ref<HTMLDialogElement | null>(null)
const messageList = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)
const showNewTicket = ref(false)
const search = ref('')
const activeFilter = ref<'all' | TicketStatus>('all')
const drafts = reactive<Record<string, string>>({})
const newTicket = reactive<NewSupportTicket>({
  subject: '',
  category: 'parking',
  location: '',
  message: '',
})
let followMessages = true
let pollTimer: ReturnType<typeof setInterval> | undefined
let pollTicks = 0
const replyText = computed({
  get: () => drafts[chat.selectedTicketId || ''] || '',
  set: (value: string) => {
    if (chat.selectedTicketId) drafts[chat.selectedTicketId] = value
  },
})
const statusLabels: Record<TicketStatus, string> = {
  open: 'รอรับเรื่อง',
  in_progress: 'กำลังดูแล',
  done: 'แก้ไขแล้ว',
}
const categories: { id: TicketCategory; label: string }[] = [
  { id: 'parking', label: 'การจอดรถ' },
  { id: 'vehicle', label: 'ข้อมูลรถ' },
  { id: 'account', label: 'บัญชีผู้ใช้' },
  { id: 'other', label: 'เรื่องอื่น ๆ' },
]
const filters: { id: 'all' | TicketStatus; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'open', label: 'รอรับ' },
  { id: 'in_progress', label: 'กำลังดูแล' },
  { id: 'done', label: 'เสร็จแล้ว' },
]
const quickReplies = [
  {
    label: 'ขอรายละเอียด',
    text: 'สวัสดีครับ รบกวนแจ้งรายละเอียดเพิ่มเติม พร้อมอาคาร ชั้น และเวลาที่พบปัญหา เพื่อให้เราช่วยตรวจสอบได้ครับ',
  },
  {
    label: 'กำลังตรวจสอบ',
    text: 'ได้รับข้อมูลแล้วครับ ขณะนี้กำลังตรวจสอบให้ และจะแจ้งความคืบหน้าในแชตนี้ครับ',
  },
  {
    label: 'แจ้งผลการแก้ไข',
    text: 'ดำเนินการแก้ไขแล้วครับ รบกวนลองใช้งานอีกครั้ง หากยังพบปัญหาสามารถแจ้งในแชตนี้ได้เลยครับ',
  },
]
const waitingCount = computed(() => chat.tickets.filter((item) => item.status === 'open').length)
const filteredTickets = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return chat.tickets.filter(
    (item) =>
      (activeFilter.value === 'all' || item.status === activeFilter.value) &&
      `${item.subject} ${item.owner.name} ${item.ticketNumber}`.toLocaleLowerCase().includes(query),
  )
})
const categoryLabel = (category: TicketCategory) =>
  categories.find((item) => item.id === category)?.label || category
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
const listTime = (value: string) =>
  new Date(value).toDateString() === new Date().toDateString()
    ? timeLabel(value)
    : new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(value))
const isNewDay = (index: number) => {
  const messages = ticket.value?.messages || []
  return (
    index === 0 ||
    new Date(messages[index]!.timestamp).toDateString() !==
      new Date(messages[index - 1]!.timestamp).toDateString()
  )
}
const backToInbox = () => {
  showNewTicket.value = false
  chat.clearSelection()
}
const startNewTicket = () => {
  chat.clearSelection()
  showNewTicket.value = true
}
const selectTicket = async (id: string) => {
  showNewTicket.value = false
  followMessages = true
  await chat.loadTicket(id)
}
const submitTicket = async () => {
  if (!newTicket.subject.trim() || !newTicket.message.trim()) return
  const created = await chat.createTicket({ ...newTicket })
  if (created) {
    showNewTicket.value = false
    followMessages = true
    Object.assign(newTicket, { subject: '', category: 'parking', location: '', message: '' })
  }
}
const sendReply = async () => {
  if (!ticket.value || !canReply.value || !replyText.value.trim() || chat.isSending) return
  const ticketId = ticket.value._id
  const text = replyText.value
  followMessages = true
  if (await chat.sendMessage(ticketId, text.trim())) {
    if (drafts[ticketId] === text) drafts[ticketId] = ''
    await nextTick()
    composer.value?.focus()
  }
}
const useQuickReply = (text: string) => {
  replyText.value = text
  composer.value?.focus()
}
const handleComposerKey = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void sendReply()
  }
}
const handleScroll = () => {
  const element = messageList.value
  if (!element) return
  followMessages = element.scrollHeight - element.scrollTop - element.clientHeight < 60
  if (followMessages && chat.isOpen && document.visibilityState === 'visible') void chat.markRead()
}
const refreshVisible = () => {
  if (document.visibilityState === 'visible') {
    void chat.refresh()
    if (followMessages && chat.isOpen) void chat.markRead()
  }
}
watch(
  () => [auth.user?._id, auth.user?.role],
  () => {
    chat.reset()
    showNewTicket.value = false
    search.value = ''
    activeFilter.value = 'all'
    Object.keys(drafts).forEach((id) => delete drafts[id])
    Object.assign(newTicket, { subject: '', category: 'parking', location: '', message: '' })
    if (auth.isAuthenticated && !auth.isGuest) void chat.loadTickets()
  },
  { immediate: true },
)
watch(
  () => chat.isOpen,
  async (open) => {
    await nextTick()
    if (open) {
      if (!panel.value?.open) panel.value?.showModal()
      void chat.refresh()
    } else panel.value?.close()
  },
)
watch(
  () => [ticket.value?._id, ticket.value?.lastMessage?._id, ticket.value?.status, chat.isOpen],
  async () => {
    await nextTick()
    if (!chat.isOpen || document.visibilityState !== 'visible') return
    if (followMessages && messageList.value) {
      messageList.value.scrollTop = messageList.value.scrollHeight
      void chat.markRead()
    }
  },
)
onMounted(() => {
  pollTimer = setInterval(() => {
    pollTicks++
    if (chat.isOpen || pollTicks % 3 === 0) refreshVisible()
  }, 5000)
  document.addEventListener('visibilitychange', refreshVisible)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', refreshVisible)
  chat.reset()
})
</script>

<style scoped>
.support-launcher {
  position: fixed;
  right: 26px;
  bottom: 24px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 21px;
  border-radius: 28px;
  color: #fff;
  background: #be3b35;
  box-shadow: 0 7px 24px #9e2d2540;
  font-size: 14px;
  font-weight: 600;
  transition:
    transform 0.18s,
    background 0.18s;
}
.support-launcher:hover {
  background: #a92f2a;
  transform: translateY(-2px);
}
.launcher-count {
  position: absolute;
  top: -5px;
  right: -3px;
  min-width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 3px solid #fff;
  border-radius: 20px;
  padding: 0 4px;
  background: #a72e29;
  font-size: 10px;
}
.support-panel {
  position: fixed;
  inset: auto 24px 24px auto;
  width: 440px;
  height: min(760px, calc(100dvh - 48px));
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  margin: 0;
  padding: 0;
  border: 1px solid #eee2de;
  border-radius: 22px;
  color: #292b32;
  background: #fff;
  box-shadow:
    0 22px 80px #29161638,
    0 3px 10px #29161612;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}
.support-panel.staff-panel {
  width: 800px;
}
.support-panel::backdrop {
  background: #201c1c18;
}
.panel-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.support-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 20px;
  color: #fff;
  background: linear-gradient(120deg, #a8322d, #cc4b42);
}
.header-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border: 1px solid #ffffff36;
  border-radius: 15px;
  background: #ffffff16;
}
.header-copy {
  flex: 1;
  min-width: 0;
}
.header-copy h2 {
  color: #fff;
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.3px;
}
.header-copy p {
  margin-top: 3px;
  color: #fff0ed;
  font-size: 11px;
  line-height: 1.5;
}
.header-button {
  display: grid;
  place-items: center;
  width: 29px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}
.header-button:hover {
  background: #ffffff20;
}
.support-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.support-inbox {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.staff-panel .support-inbox {
  width: 295px;
  flex-shrink: 0;
  border-right: 1px solid #eceef1;
}
.support-panel:not(.staff-panel) .show-thread .support-inbox {
  display: none;
}
.welcome-card {
  margin: 19px 19px 8px;
  padding: 20px;
  border: 1px solid #f4e4df;
  border-radius: 16px;
  background: radial-gradient(ellipse at top right, #f9e8dd, #fff8f5 65%);
}
.eyebrow {
  color: #a96050;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.4px;
}
.welcome-card h3 {
  margin-top: 7px;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.5px;
}
.welcome-card p {
  margin: 8px 0 17px;
  color: #80736d;
  font-size: 12px;
  line-height: 1.8;
}
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 17px;
  border-radius: 10px;
  background: #bb3e35;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s;
}
.primary-button:hover:not(:disabled) {
  background: #a92f27;
}
.inbox-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 19px 20px 10px;
}
.inbox-heading h3 {
  font-size: 14px;
  font-weight: 650;
}
.inbox-heading > span {
  display: grid;
  place-items: center;
  min-width: 23px;
  padding: 2px 6px;
  border-radius: 6px;
  background: #f1f2f4;
  color: #747985;
  font-size: 10px;
}
.ticket-search {
  margin: 0 16px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border: 1px solid #e9ebef;
  border-radius: 9px;
  color: #959aa5;
}
.ticket-search input {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: 0;
  color: #313640;
  font-size: 12px;
}
.ticket-filters {
  display: flex;
  flex-shrink: 0;
  gap: 3px;
  padding: 3px 16px 13px;
}
.ticket-filters button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 7px 4px;
  border-radius: 7px;
  color: #858895;
  white-space: nowrap;
  font-size: 11px;
}
.ticket-filters button.active {
  background: #fbeeea;
  color: #af3d33;
  font-weight: 600;
}
.ticket-filters button > span {
  background: #ba4237;
  color: #fff;
  min-width: 15px;
  border-radius: 5px;
  padding: 0 3px;
  font-size: 9px;
}
.ticket-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 10px 12px;
}
.ticket-row {
  width: 100%;
  display: flex;
  gap: 10px;
  padding: 15px 10px;
  border: 1px solid transparent;
  border-bottom-color: #f0f1f3;
  border-radius: 11px;
  text-align: left;
  transition: background 0.15s;
}
.ticket-row:hover {
  background: #faf8f7;
}
.ticket-row.selected {
  border-color: #f1d3cb;
  background: #fff4ef;
}
.ticket-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 35px;
  height: 35px;
  border-radius: 11px;
  background: #f3efec;
  color: #ab5a47;
  font-size: 12px;
  font-weight: 650;
}
.ticket-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1;
}
.ticket-topline {
  display: flex;
  align-items: center;
  gap: 5px;
}
.ticket-topline strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 650;
}
.ticket-topline time {
  flex-shrink: 0;
  color: #9298a2;
  font-size: 10px;
}
.ticket-subject {
  font-size: 12px;
  color: #555d68;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ticket-preview {
  color: #9298a2;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ticket-bottomline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  color: #9ca2ac;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: max-content;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10px;
  line-height: 1.3;
  font-weight: 500;
  white-space: nowrap;
}
.status-badge.open {
  color: #a7711d;
  background: #fff4d9;
}
.status-badge.in_progress {
  color: #4968a6;
  background: #edf2ff;
}
.status-badge.done {
  color: #31826b;
  background: #e8f5ef;
}
.unread-dot {
  display: grid;
  place-items: center;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 10px;
  color: #fff;
  background: #be4037;
  font-size: 10px;
}
.inbox-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 13px 10px;
  border-top: 1px solid #f0f1f3;
  color: #9299a3;
  font-size: 10px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 150px;
  padding: 25px 15px;
  text-align: center;
  color: #a3a9b3;
}
.empty-state strong {
  color: #707885;
  font-size: 13px;
  font-weight: 500;
}
.empty-state p {
  max-width: 240px;
  color: #969eaa;
  font-size: 11px;
  line-height: 1.7;
}
.conversation-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  background: radial-gradient(ellipse at center, #fff, #faf9f8);
  text-align: center;
}
.placeholder-icon {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  border: 1px solid #f4dfd6;
  border-radius: 26px;
  color: #bd5f4e;
  background: #fff4ee;
  box-shadow: 0 9px 28px #b6564310;
}
.conversation-placeholder h3 {
  margin-top: 5px;
  font-size: 18px;
  font-weight: 600;
}
.conversation-placeholder p {
  color: #9397a1;
  font-size: 12px;
  line-height: 1.9;
}
.placeholder-caption {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 22px;
  color: #a8a9b1;
  font-size: 11px;
}
.new-ticket-panel,
.conversation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.thread-heading {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 78px;
  padding: 15px 18px;
  border-bottom: 1px solid #f0f1f3;
  background: #fff;
}
.thread-heading h3 {
  color: #30343b;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.thread-heading p {
  margin-top: 4px;
  color: #959aa4;
  font-size: 10px;
}
.thread-title {
  flex: 1;
  min-width: 0;
}
.icon-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 29px;
  height: 29px;
  border-radius: 8px;
  color: #7b818d;
}
.icon-button:hover {
  background: #f5f5f6;
}
.staff-panel .back-button {
  display: none;
}
.ticket-context {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 20px;
  background: #fff;
  color: #9197a2;
  font-size: 10px;
}
.ticket-context span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  overflow-wrap: anywhere;
}
.assignment-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 18px;
  background: #fffbf0;
  border-top: 1px solid #fff4d9;
  border-bottom: 1px solid #fbefd2;
  color: #a5823e;
  font-size: 11px;
}
.assignment-banner.assigned {
  background: #f2f8f5;
  color: #5e8675;
  border-color: #e9f1ed;
}
.assignment-copy {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
}
.assignment-copy svg {
  flex-shrink: 0;
}
.claim-button,
.resolve-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 9px;
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 11px;
}
.claim-button {
  background: #bb3e35;
  color: #fff;
}
.resolve-button {
  background: #fff;
  border: 1px solid #cce1d6;
  color: #477860;
}
.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 5px 19px 22px;
  background: #f7f8fa;
}
.day-divider {
  display: flex;
  justify-content: center;
  margin: 18px 0 23px;
}
.day-divider span {
  padding: 5px 12px;
  border: 1px solid #eef0f3;
  border-radius: 20px;
  background: #fff;
  color: #9a9faa;
  font-size: 10px;
}
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 19px;
}
.message-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 22px;
  flex-shrink: 0;
  border: 1px solid #e7e9ee;
  border-radius: 9px;
  color: #9c695d;
  background: #fff;
  font-size: 10px;
  font-weight: 600;
}
.message-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 84%;
  min-width: 0;
}
.sender-name {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
  color: #838b96;
  font-size: 10px;
}
.support-tag {
  padding: 1px 5px;
  border-radius: 4px;
  color: #ab5c4c;
  background: #faeae3;
  font-size: 8px;
}
.message-copy p {
  padding: 12px 14px;
  border: 1px solid #eceef1;
  border-radius: 0 14px 14px;
  background: #fff;
  color: #424750;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.message-copy time {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 6px 2px 0;
  color: #a3a9b3;
  font-size: 9px;
}
.chat-message.outgoing {
  justify-content: flex-end;
}
.outgoing .message-copy {
  align-items: flex-end;
}
.outgoing .message-copy p {
  background: #bc443a;
  border-color: #bc443a;
  border-radius: 14px 0 14px 14px;
  color: #fff;
}
.outgoing .message-copy time svg {
  color: #b9766e;
}
.composer-area {
  padding: 12px 17px 13px;
  border-top: 1px solid #eaedf1;
  background: #fff;
}
.quick-replies {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 0 0 11px;
}
.quick-replies button {
  padding: 5px 8px;
  border: 1px solid #ede3df;
  border-radius: 7px;
  color: #a9796c;
  background: #fffbf8;
  font-size: 10px;
}
.quick-replies button:hover {
  border-color: #b96654;
}
.message-composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 9px 10px 9px 13px;
  border: 1px solid #e7e9ee;
  border-radius: 13px;
  background: #fafbfc;
}
.message-composer:focus-within {
  border-color: #d59786;
  box-shadow: 0 0 0 3px #d5978612;
}
.message-composer textarea {
  flex: 1;
  min-width: 0;
  padding: 3px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #3c444f;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
}
.message-composer textarea::placeholder {
  color: #a5acb6;
}
.send-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 37px;
  height: 37px;
  border-radius: 10px;
  background: #b94036;
  color: #fff;
}
.composer-hint {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 7px 2px 0;
  color: #a6abb4;
  font-size: 9px;
}
.read-only-note {
  padding: 20px 15px;
  border-top: 1px solid #eceef2;
  color: #939aa6;
  text-align: center;
  font-size: 12px;
}
.resolved-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 25px 0 5px;
  padding: 22px 15px;
  border: 1px solid #dfede5;
  border-radius: 13px;
  background: #f4faf6;
  color: #659c7c;
  text-align: center;
}
.resolved-card strong {
  color: #4c7861;
  font-size: 14px;
  font-weight: 600;
}
.resolved-card p {
  color: #87a191;
  font-size: 11px;
}
.resolved-card button {
  margin-top: 5px;
  padding: 7px 13px;
  border: 1px solid #c5decc;
  border-radius: 7px;
  color: #57876b;
  background: #fff;
  font-size: 11px;
}
.new-ticket-form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 23px 22px;
}
.new-ticket-form fieldset {
  display: grid;
  gap: 20px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.new-ticket-form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #59616c;
  font-size: 12px;
  min-width: 0;
}
.new-ticket-form label > span {
  font-weight: 500;
}
.new-ticket-form em {
  color: #bf5a4b;
  font-style: normal;
}
.new-ticket-form small {
  color: #a0a5ad;
  font-size: 10px;
  font-weight: 400;
}
.new-ticket-form input,
.new-ticket-form select,
.new-ticket-form textarea {
  width: 100%;
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid #e3e6eb;
  border-radius: 9px;
  background: #fcfcfd;
  outline: 0;
  color: #414a56;
  font: inherit;
  line-height: 1.6;
}
.new-ticket-form input:focus,
.new-ticket-form select:focus,
.new-ticket-form textarea:focus {
  border-color: #cf8d7e;
  box-shadow: 0 0 0 3px #cf8d7e12;
}
.new-ticket-form input::placeholder,
.new-ticket-form textarea::placeholder {
  color: #b1b5be;
}
.new-ticket-form textarea {
  resize: vertical;
  min-height: 130px;
  max-height: 250px;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.character-count {
  align-self: flex-end;
}
.form-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  margin: 18px 0;
  border-radius: 10px;
  background: #f7f8fa;
  color: #959da9;
}
.form-note svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.form-note p {
  font-size: 11px;
  line-height: 1.8;
}
.submit-ticket {
  width: 100%;
}
.connection-error {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  padding: 10px 15px;
  color: #a56035;
  background: #fff2e5;
  font-size: 11px;
  flex-shrink: 0;
}
.connection-error button {
  flex-shrink: 0;
  text-decoration: underline;
}
.action-error {
  margin: 12px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff0ec;
  color: #ad4939;
  font-size: 11px;
  line-height: 1.7;
}
.thread-error {
  margin: 0;
  border-radius: 0;
  flex-shrink: 0;
}
.thread-loading {
  flex: 1;
}
.secondary-button {
  padding: 8px 13px;
  border: 1px solid #e0e3e8;
  border-radius: 8px;
  color: #697380;
  font-size: 12px;
}
.support-panel button {
  cursor: pointer;
}
.support-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.support-panel button:focus-visible,
.support-launcher:focus-visible {
  outline: 2px solid #6c9bc5;
  outline-offset: 3px;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 700px) {
  .support-panel,
  .support-panel.staff-panel {
    inset: auto 10px 10px;
    width: calc(100vw - 20px);
    max-width: calc(100vw - 20px);
    height: min(760px, calc(100dvh - 20px));
    max-height: calc(100dvh - 20px);
    border-radius: 17px;
  }
  .support-header {
    gap: 9px;
    padding: 17px 15px;
  }
  .header-copy h2 {
    font-size: 18px;
  }
  .header-copy p {
    font-size: 10px;
  }
  .staff-panel .support-inbox {
    width: 100%;
    border-right: 0;
  }
  .staff-panel .show-thread .support-inbox {
    display: none;
  }
  .conversation-placeholder {
    display: none;
  }
  .staff-panel .back-button {
    display: grid;
  }
  .support-launcher {
    right: 17px;
    bottom: 18px;
    height: 52px;
    padding: 0 17px;
  }
  .thread-heading {
    gap: 7px;
    padding: 13px 12px;
  }
  .thread-heading h3 {
    font-size: 13px;
  }
  .message-list {
    padding-left: 13px;
    padding-right: 13px;
  }
  .new-ticket-form {
    padding: 20px 17px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
  .support-launcher {
    transition: none;
  }
}
</style>
