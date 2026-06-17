<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">平台监控</h1>
      <p class="text-[var(--text-sub)] mt-1">各平台解析器运行状态</p>
    </div>

    <!-- Stats Cards -->
    <section class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">已支持平台</p>
          <div class="p-2 rounded-lg bg-green-500/10 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold text-[var(--text-main)] mb-2">{{ implementedCount }}</h2>
        <p class="text-sm text-[var(--text-sub)]">覆盖主流视频/图文平台</p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">待实现</p>
          <div class="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold text-[var(--text-main)] mb-2">{{ pendingCount }}</h2>
        <p class="text-sm text-[var(--text-sub)]">解析器开发中</p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">覆盖率</p>
          <div class="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold text-[var(--text-main)] mb-2">{{ coveragePercent }}%</h2>
        <div class="h-2 bg-[var(--bg-body)] rounded-full overflow-hidden mt-2">
          <div class="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all" :style="{ width: coveragePercent + '%' }"></div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-[var(--text-sub)]">服务状态</p>
          <div class="p-2 rounded-lg bg-green-500/10 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
          </div>
        </div>
        <h2 class="text-3xl font-bold mb-2">
          <span :class="serviceOnline ? 'text-green-500' : 'text-red-500'">{{ serviceOnline ? '在线' : '离线' }}</span>
        </h2>
        <p class="text-sm text-[var(--text-sub)]">Media Toolkit API</p>
      </div>
    </section>

    <!-- Platform Grid -->
    <div class="glass-panel">
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-semibold text-[var(--text-main)]">解析器列表</h3>
        <div class="flex gap-2">
          <button
            @click="platformFilter = 'all'"
            :class="['text-xs px-3 py-1 rounded-full transition-colors', platformFilter === 'all' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)]']"
          >全部</button>
          <button
            @click="platformFilter = 'implemented'"
            :class="['text-xs px-3 py-1 rounded-full transition-colors', platformFilter === 'implemented' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)]']"
          >已实现</button>
          <button
            @click="platformFilter = 'pending'"
            :class="['text-xs px-3 py-1 rounded-full transition-colors', platformFilter === 'pending' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-body)] text-[var(--text-sub)]']"
          >待实现</button>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <a
            v-for="p in filteredPlatforms"
            :key="p.name"
            :href="p.url || '#'"
            target="_blank"
            rel="noopener noreferrer"
            class="p-4 rounded-xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md flex flex-col items-center gap-2 cursor-pointer no-underline"
            :class="p.implemented
              ? 'bg-[var(--bg-card)] border-green-500/20 hover:border-green-500/40'
              : 'bg-[var(--bg-card)] border-yellow-500/20 hover:border-yellow-500/40'"
          >
            <div class="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white/5">
              <svg v-if="p.iconType === 'svg'" class="w-7 h-7" viewBox="0 0 24 24" :fill="p.color" xmlns="http://www.w3.org/2000/svg">
                <path :d="p.iconSrc" />
              </svg>
              <img
                v-else
                :src="p.iconSrc"
                :alt="p.name"
                class="w-7 h-7 object-contain"
                @error="onIconError($event, p)"
              />
            </div>
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :class="p.implemented ? 'bg-green-500' : 'bg-yellow-500'"
            ></span>
            <h4 class="text-sm font-semibold text-[var(--text-main)] text-center">{{ p.name }}</h4>
            <p class="text-xs text-[var(--text-sub)]">{{ p.implemented ? '已实现' : '待实现' }}</p>
          <div v-if="p.domains && p.domains.length > 0" class="mt-2 flex flex-wrap gap-1">
            <span v-for="d in p.domains.slice(0, 2)" :key="d" class="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-body)] text-[var(--text-sub)]">
              {{ d }}
            </span>
          </div>
        </a>
      </div>
    </div>

    <!-- API Endpoints Reference -->
    <div class="glass-panel">
      <div class="flex items-center gap-2 mb-4">
        <div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>
          </svg>
        </div>
        <h3 class="font-semibold text-[var(--text-main)]">API 端点</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-[var(--border-color)]">
              <th class="text-left py-3 px-4 text-xs font-medium text-[var(--text-sub)] uppercase tracking-wider">方法</th>
              <th class="text-left py-3 px-4 text-xs font-medium text-[var(--text-sub)] uppercase tracking-wider">端点</th>
              <th class="text-left py-3 px-4 text-xs font-medium text-[var(--text-sub)] uppercase tracking-wider">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ep in apiEndpoints" :key="ep.method + ep.path" class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-body)] transition-colors">
              <td class="py-3 px-4">
                <span :class="getMethodBadgeClass(ep.method)">{{ ep.method }}</span>
              </td>
              <td class="py-3 px-4 text-sm font-mono text-[var(--text-main)]">{{ ep.path }}</td>
              <td class="py-3 px-4 text-sm text-[var(--text-sub)]">{{ ep.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const API_BASE = 'https://api.missonce.cc'

const platformFilter = ref<'all' | 'implemented' | 'pending'>('all')
const serviceOnline = ref(false)

interface Platform {
  name: string
  iconType: 'local' | 'svg'
  iconSrc: string
  color: string
  implemented: boolean
  domains?: string[]
  url?: string
}

const svgPaths: Record<string, { path: string; hex: string }> = {
  Instagram: { path: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077", hex: "E4405F" },
  TikTok: { path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z", hex: "000000" },
  Twitter: { path: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z", hex: "000000" },
  YouTube: { path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z", hex: "FF0000" },
  Facebook: { path: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z", hex: "1877F2" },
  Pinterest: { path: "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z", hex: "BD081C" },
  Snapchat: { path: "M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z", hex: "FFFC00" },
  Reddit: { path: "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z", hex: "FF4500" },
  Vimeo: { path: "M23.9765 6.4168c-.105 2.338-1.739 5.5429-4.894 9.6088-3.2679 4.247-6.0258 6.3699-8.2898 6.3699-1.409 0-2.578-1.294-3.553-3.881l-1.9179-7.1138c-.719-2.584-1.488-3.878-2.312-3.878-.179 0-.806.378-1.8809 1.132l-1.129-1.457a315.06 315.06 0 003.501-3.1279c1.579-1.368 2.765-2.085 3.5539-2.159 1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.5069.5389 2.45 1.1309 3.674 1.7759 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.8679 3.434-5.7568 6.7619-5.6368 2.4729.06 3.6279 1.664 3.4929 4.7969z", hex: "1AB7EA" },
  Bilibili: { path: "M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z", hex: "00A1D6" },
  Weibo: { path: "M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z", hex: "E6162D" },
  Zhihu: { path: "M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.171H9.384a58.104 58.104 0 01-.112 3.797h2.712c.388.023.393 1.251.393 1.266H9.183a9.223 9.223 0 01-.408 2.102l.757-.604c.452.456 1.512 1.712 1.906 2.177.473.681.063 2.081.063 2.081l-2.794-3.382c-.653 2.518-1.845 3.607-1.845 3.607-.523.468-1.58.82-2.64.516 2.218-1.73 3.44-3.917 3.667-6.497H4.491c0-.015.197-1.243.806-1.266h2.71c.024-.32.086-3.254.086-3.797H6.598c-.136.406-.158.447-.268.753-.594 1.095-1.603 1.122-1.907 1.155.906-1.821 1.416-3.6 1.591-4.064.425-1.124 1.671-1.125 1.671-1.125zM13.078 6h6.377v11.33h-2.573l-2.184 1.373-.401-1.373h-1.219zm1.313 1.219v8.86h.623l.263.937 1.455-.938h1.456v-8.86z", hex: "0084FF" },
  Kuaishou: { path: "M18.315 12.264c2.33 0 4.218 1.88 4.218 4.2V19.8c0 2.32-1.888 4.2-4.218 4.2h-6.202a4.218 4.218 0 0 1-4.023-2.938l-3.676 1.833a2.04 2.04 0 0 1-2.731-.903 2.015 2.015 0 0 1-.216-.907v-5.94a2.03 2.03 0 0 1 2.035-2.024 2.044 2.044 0 0 1 .919.218l3.673 1.85a4.218 4.218 0 0 1 4.02-2.925zm-.062 2.162h-6.078c-1.153 0-2.09.921-2.108 2.065v3.247c0 1.148.925 2.081 2.073 2.1h6.113c1.153 0 2.09-.922 2.109-2.065v-3.247a2.104 2.104 0 0 0-2.074-2.1zM4.18 15.72a.554.554 0 0 0-.555.542v3.734a.556.556 0 0 0 .798.496l.01-.004 3.463-1.756V17.51l-3.467-1.73a.557.557 0 0 0-.249-.06zM9.28 0a5.667 5.667 0 0 1 4.98 2.965 4.921 4.921 0 0 1 3.36-1.317c2.714 0 4.913 2.177 4.913 4.863 0 2.686-2.2 4.863-4.912 4.863a4.921 4.921 0 0 1-3.996-2.034 5.651 5.651 0 0 1-4.345 2.034c-3.131 0-5.67-2.546-5.67-5.687C3.61 2.546 6.149 0 9.28 0Zm8.34 3.926c-1.441 0-2.61 1.157-2.61 2.585s1.169 2.585 2.61 2.585c1.443 0 2.612-1.157 2.612-2.585s-1.169-2.585-2.611-2.585zM9.28 2.287a3.395 3.395 0 0 0-3.39 3.4c0 1.877 1.518 3.4 3.39 3.4a3.395 3.395 0 0 0 3.39-3.4c0-1.878-1.518-3.4-3.39-3.4z", hex: "FF4906" },
}

const platforms: Platform[] = [
  { name: '哔哩哔哩', iconType: 'svg', iconSrc: svgPaths.Bilibili.path, color: svgPaths.Bilibili.hex, implemented: true, domains: ['bilibili.com', 'bilivideo.com'], url: 'https://www.bilibili.com' },
  { name: '微博', iconType: 'svg', iconSrc: svgPaths.Weibo.path, color: svgPaths.Weibo.hex, implemented: true, domains: ['weibo.com', 'm.weibo.cn'], url: 'https://weibo.com' },
  { name: '知乎', iconType: 'svg', iconSrc: svgPaths.Zhihu.path, color: svgPaths.Zhihu.hex, implemented: true, domains: ['zhihu.com'], url: 'https://www.zhihu.com' },
  { name: '快手', iconType: 'svg', iconSrc: svgPaths.Kuaishou.path, color: svgPaths.Kuaishou.hex, implemented: true, domains: ['kuaishou.com', 'chenzhongtech.com'], url: 'https://www.kuaishou.com' },
  { name: 'YouTube', iconType: 'svg', iconSrc: svgPaths.YouTube.path, color: svgPaths.YouTube.hex, implemented: true, domains: ['youtube.com', 'youtu.be'], url: 'https://www.youtube.com' },
  { name: 'Instagram', iconType: 'svg', iconSrc: svgPaths.Instagram.path, color: svgPaths.Instagram.hex, implemented: true, domains: ['instagram.com'], url: 'https://www.instagram.com' },
  { name: 'TikTok', iconType: 'svg', iconSrc: svgPaths.TikTok.path, color: svgPaths.TikTok.hex, implemented: true, domains: ['tiktok.com'], url: 'https://www.tiktok.com' },
  { name: 'Twitter/X', iconType: 'svg', iconSrc: svgPaths.Twitter.path, color: svgPaths.Twitter.hex, implemented: true, domains: ['twitter.com', 'x.com'], url: 'https://x.com' },
  { name: '小红书', iconType: 'local', iconSrc: '/icons/xiaohongshu.ico', color: '#FE2C55', implemented: true, domains: ['xiaohongshu.com', 'xhscdn.com'], url: 'https://www.xiaohongshu.com' },
  { name: '抖音', iconType: 'local', iconSrc: '/icons/douyin.ico', color: '#161823', implemented: true, domains: ['douyin.com', 'iesdouyin.com'], url: 'https://www.douyin.com' },
  { name: '好看视频', iconType: 'local', iconSrc: '/icons/haokan.ico', color: '#306CFF', implemented: true, domains: ['haokan.baidu.com'], url: 'https://haokan.baidu.com' },
  { name: '微视', iconType: 'local', iconSrc: '/icons/weishi.ico', color: '#FFD132', implemented: true, domains: ['weishi.qq.com'], url: 'https://weishi.qq.com' },
  { name: '梨视频', iconType: 'local', iconSrc: '/icons/pearvideo.ico', color: '#1AAD19', implemented: true, domains: ['pearvideo.com'], url: 'https://www.pearvideo.com' },
  { name: '皮皮搞笑', iconType: 'local', iconSrc: '/icons/pipigx.ico', color: '#FFD700', implemented: true, domains: ['pipigx.com'], url: 'https://www.pipigx.com' },
  { name: 'AcFun', iconType: 'local', iconSrc: '/icons/acfun.ico', color: '#FD4C5D', implemented: true, domains: ['acfun.cn'], url: 'https://www.acfun.cn' },
  { name: '西瓜视频', iconType: 'local', iconSrc: '/icons/ixigua.ico', color: '#FF0033', implemented: true, domains: ['ixigua.com'], url: 'https://www.ixigua.com' },
  { name: '逗拍', iconType: 'local', iconSrc: '/icons/doupai.ico', color: '#FF6B35', implemented: true, domains: ['doupai.cc'], url: 'https://www.doupai.cc' },
  { name: '虎牙', iconType: 'local', iconSrc: '/icons/huya.ico', color: '#FFB600', implemented: true, domains: ['huya.com'], url: 'https://www.huya.com' },
  { name: '绿洲', iconType: 'local', iconSrc: '/icons/oasis.ico', color: '#00C853', implemented: true, domains: ['oasis.weibo.cn'], url: 'https://oasis.weibo.cn' },
  { name: '美拍', iconType: 'local', iconSrc: '/icons/meipai.ico', color: '#FF6699', implemented: true, domains: ['meipai.com'], url: 'https://www.meipai.com' },
  { name: '皮皮虾', iconType: 'local', iconSrc: '/icons/pipix.ico', color: '#FF5722', implemented: true, domains: ['pipix.com'], url: 'https://www.pipix.com' },
  { name: '全民小视频', iconType: 'local', iconSrc: '/icons/quanmin.ico', color: '#3F86FF', implemented: true, domains: ['quanmin.baidu.com'], url: 'https://quanmin.baidu.com' },
  { name: '全民K歌', iconType: 'local', iconSrc: '/icons/kg.ico', color: '#36B36F', implemented: true, domains: ['kg.qq.com'], url: 'https://kg.qq.com' },
  { name: '六间房', iconType: 'local', iconSrc: '/icons/6cn.ico', color: '#FF6600', implemented: true, domains: ['6.cn'], url: 'https://www.6.cn' },
  { name: '新片场', iconType: 'local', iconSrc: '/icons/xinpianchang.ico', color: '#C9A96E', implemented: true, domains: ['xinpianchang.com'], url: 'https://www.xinpianchang.com' },
  { name: '最右', iconType: 'local', iconSrc: '/icons/izuiyou.ico', color: '#5B8FF9', implemented: true, domains: ['izuiyou.com', 'xiaochuankeji.cn'], url: 'https://www.izuiyou.com' },
  { name: 'Facebook', iconType: 'svg', iconSrc: svgPaths.Facebook.path, color: svgPaths.Facebook.hex, implemented: false, url: 'https://www.facebook.com' },
  { name: 'Pinterest', iconType: 'svg', iconSrc: svgPaths.Pinterest.path, color: svgPaths.Pinterest.hex, implemented: false, url: 'https://www.pinterest.com' },
  { name: 'Snapchat', iconType: 'svg', iconSrc: svgPaths.Snapchat.path, color: svgPaths.Snapchat.hex, implemented: false, url: 'https://www.snapchat.com' },
  { name: 'Reddit', iconType: 'svg', iconSrc: svgPaths.Reddit.path, color: svgPaths.Reddit.hex, implemented: false, url: 'https://www.reddit.com' },
  { name: 'Vimeo', iconType: 'svg', iconSrc: svgPaths.Vimeo.path, color: svgPaths.Vimeo.hex, implemented: false, url: 'https://www.vimeo.com' },
]

const apiEndpoints = [
  { method: 'POST', path: '/api/parse', desc: '解析链接，提取视频/图片/音频信息' },
  { method: 'POST', path: '/api/download', desc: '获取下载地址' },
  { method: 'GET', path: '/api/proxyDownload', desc: '代理下载（流式传输）' },
]

const implementedCount = computed(() => platforms.filter(p => p.implemented).length)
const pendingCount = computed(() => platforms.filter(p => !p.implemented).length)
const coveragePercent = computed(() => Math.round((implementedCount.value / platforms.length) * 100))

const filteredPlatforms = computed(() => {
  if (platformFilter.value === 'all') return platforms
  return platforms.filter(p => platformFilter.value === 'implemented' ? p.implemented : !p.implemented)
})

const getMethodBadgeClass = (method: string) => {
  const base = 'px-2 py-0.5 rounded text-xs font-medium'
  const map: Record<string, string> = {
    GET: `${base} bg-green-500/10 text-green-500`,
    POST: `${base} bg-blue-500/10 text-blue-500`,
    PUT: `${base} bg-yellow-500/10 text-yellow-500`,
    DELETE: `${base} bg-red-500/10 text-red-500`,
  }
  return map[method] || `${base} bg-gray-500/10 text-gray-500`
}

const checkService = async () => {
  try {
    // no-cors 模式绕过 CORS 限制，只要服务器可达即为在线
    await fetch(`${API_BASE}/api/health`, { mode: 'no-cors', cache: 'no-cache' })
    serviceOnline.value = true
  } catch {
    serviceOnline.value = false
  }
}

const onIconError = (event: Event, platform: any) => {
  const img = event.target as HTMLImageElement
  if (img) {
    img.style.display = 'none'
    const parent = img.parentElement
    if (parent) {
      parent.style.backgroundColor = platform.color + '15'
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', platform.color)
      svg.setAttribute('width', '28')
      svg.setAttribute('height', '28')
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', '12')
      text.setAttribute('y', '17')
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('font-size', '16')
      text.setAttribute('font-weight', 'bold')
      text.textContent = platform.name.charAt(0)
      svg.appendChild(text)
      img.replaceWith(svg)
    }
  }
}

onMounted(() => {
  checkService()
})
</script>

<style scoped>
.stat-card {
  @apply bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg;
}

a[rel="noopener noreferrer"] {
  text-decoration: none;
  color: inherit;
}
</style>
