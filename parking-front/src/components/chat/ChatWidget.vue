<template>
  <div>
    <!-- Chat Button -->
    <button
      @click="toggleChat"
      class="fixed bottom-6 right-6 w-14 h-14 bg-mfu-red hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition transform hover:scale-110 z-40"
    >
      <div class="relative">
        <i class="pi pi-comments text-xl"></i>
        <span
          v-if="unreadCount > 0"
          class="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 text-mfu-red text-xs rounded-full flex items-center justify-center font-semibold"
        >
          {{ unreadCount }}
        </span>
      </div>
    </button>

    <!-- Chat Panel -->
    <transition name="slide-left">
      <div v-if="isOpen" class="fixed bottom-24 right-6 w-96 bg-white rounded-lg shadow-2xl flex flex-col z-50 h-96">
        <!-- Header -->
        <div class="bg-mfu-red text-white px-4 py-4 rounded-t-lg flex items-center justify-between">
          <h2 class="font-semibold">Support Chat</h2>
          <button @click="isOpen = false" class="text-white hover:text-gray-200">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Content Tabs -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="flex border-b border-gray-200">
            <button
              @click="activeTab = 'list'"
              :class="[
                'flex-1 py-3 px-4 font-medium transition text-center',
                activeTab === 'list'
                  ? 'border-b-2 border-mfu-red text-mfu-red'
                  : 'text-gray-600 hover:text-gray-900',
              ]"
            >
              Tickets
            </button>
            <button
              @click="activeTab = 'create'"
              :class="[
                'flex-1 py-3 px-4 font-medium transition text-center',
                activeTab === 'create'
                  ? 'border-b-2 border-mfu-red text-mfu-red'
                  : 'text-gray-600 hover:text-gray-900',
              ]"
            >
              New
            </button>
          </div>

          <!-- Chat List -->
          <div v-if="activeTab === 'list'" class="flex-1 overflow-auto">
            <div v-if="tickets.length === 0" class="p-4 text-center text-gray-500 text-sm">
              No support tickets
            </div>
            <div
              v-for="ticket in tickets"
              :key="ticket._id"
              @click="selectTicket(ticket)"
              class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <p class="font-medium text-gray-900 text-sm">{{ ticket.ticketNumber }}</p>
                  <p class="text-xs text-gray-600 mt-1 truncate">{{ ticket.subject }}</p>
                </div>
                <span
                  :class="[
                    'px-2 py-1 text-xs rounded font-medium',
                    ticket.status === 'open'
                      ? 'bg-red-100 text-mfu-red'
                      : 'bg-gray-100 text-gray-600',
                  ]"
                >
                  {{ ticket.status }}
                </span>
              </div>
            </div>
          </div>

          <!-- Create Ticket -->
          <div v-if="activeTab === 'create'" class="flex-1 overflow-auto p-4">
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                <input
                  v-model="newTicket.subject"
                  type="text"
                  placeholder="Issue subject"
                  class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  v-model="newTicket.message"
                  placeholder="Describe your issue"
                  class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red"
                  rows="6"
                ></textarea>
              </div>
              <button
                @click="createNewTicket"
                :disabled="!newTicket.subject || !newTicket.message"
                class="w-full bg-mfu-red text-white py-2 px-4 rounded text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import type { ChatTicket } from '@/types'

const chatStore = useChatStore()
const isOpen = ref(false)
const activeTab = ref<'list' | 'create'>('list')
const selectedTicketId = ref<string>('')

const newTicket = ref({
  subject: '',
  message: '',
})

const tickets = computed(() => chatStore.tickets)
const unreadCount = computed(() => chatStore.unreadCount)

const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    chatStore.loadTickets()
  }
}

const selectTicket = (ticket: ChatTicket) => {
  selectedTicketId.value = ticket._id
  chatStore.loadTicket(ticket._id)
}

const createNewTicket = async () => {
  if (newTicket.value.subject && newTicket.value.message) {
    const success = await chatStore.createTicket(newTicket.value.subject, newTicket.value.message)
    if (success) {
      newTicket.value = { subject: '', message: '' }
      activeTab.value = 'list'
    }
  }
}

onMounted(() => {
  chatStore.loadTickets()
})
</script>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from {
  transform: translateX(400px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(400px);
  opacity: 0;
}
</style>
