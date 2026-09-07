import { createRouter, createWebHashHistory } from 'vue-router'
import { mihomoModules } from '@/schemas/mihomo'

const moduleIds = new Set(mihomoModules.map((item) => item.id))

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/mihomo/general' },
    {
      path: '/mihomo/:moduleId',
      name: 'mihomo-studio',
      component: () => import('@/views/StudioView.vue'),
      beforeEnter: (to) => moduleIds.has(String(to.params.moduleId)) ? true : '/mihomo/general',
    },
    {
      path: '/sing-box/:pathMatch(.*)*',
      name: 'sing-box-coming-soon',
      component: () => import('@/views/SingBoxPlaceholderView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/mihomo/general' },
  ],
})

export default router
