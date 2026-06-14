import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/staff/LoginView.vue'
import DashboardView from '@/views/staff/DashboardView.vue'
import HistoryView from '@/views/staff/HistoryView.vue'
import AdminDashboardView from '@/views/admin/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: LoginView,
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: DashboardView,
    },
    {
      path: '/history',
      name: 'History',
      component: HistoryView,
    },
    {
      path: '/admin/dashboard',
      name: 'AdminDashboard',
      component: AdminDashboardView,
    },
    {
      path: '/admin/login',
      redirect: '/login',
    },
    {
      path: '/',
      redirect: '/login',
    },
  ],
})

export default router
