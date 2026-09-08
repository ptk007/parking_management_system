import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/staff/LoginView.vue'
import DashboardView from '@/views/staff/DashboardView.vue'
import HistoryView from '@/views/staff/HistoryView.vue'
import AdminDashboardView from '@/views/admin/DashboardView.vue'
import MyVehicleView from '@/views/user/MyVehicleView.vue'
import { useAuthStore } from '@/stores/auth'

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
      meta: { requiresParkingManagement: true },
    },
    {
      path: '/my-vehicle',
      name: 'MyVehicle',
      component: MyVehicleView,
    },
    {
      path: '/admin/dashboard',
      name: 'AdminDashboard',
      component: AdminDashboardView,
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/staff',
      name: 'AdminStaff',
      component: AdminDashboardView,
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/setup',
      name: 'AdminSetup',
      component: AdminDashboardView,
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin',
      redirect: '/admin/dashboard',
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

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) authStore.initFromStorage()

  if (to.path === '/login') return true
  if (!authStore.isAuthenticated) return '/login'
  if (to.meta.requiresAdmin && !authStore.isAdmin) return '/dashboard'
  if (to.meta.requiresParkingManagement && !authStore.canManageParking) return '/dashboard'

  return true
})

export default router
