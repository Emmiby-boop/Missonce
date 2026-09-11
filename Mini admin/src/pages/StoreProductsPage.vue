<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">小店商品管理</h2>
          <p class="panel-sub">管理微信小店商品 ID，小程序「小店」页面会展示这些商品卡片</p>
        </div>
        <div class="flex gap-2">
          <button class="btn" @click="loadConfig" :disabled="loading">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
            重新加载
          </button>
          <button class="btn-primary" @click="saveConfig" :disabled="saving">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 添加商品 -->
    <section class="glass-panel">
      <h3 class="text-base font-semibold mb-4">添加商品</h3>
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[240px]">
          <label class="form-label">商品 ID</label>
          <input
            v-model="newProductId"
            type="text"
            class="input"
            placeholder="输入微信小店商品 ID"
            @keyup.enter="addProduct"
          />
        </div>
        <div class="flex-1 min-w-[240px]">
          <label class="form-label">商品名称（备注，选填）</label>
          <input
            v-model="newProductName"
            type="text"
            class="input"
            placeholder="例如：小辣椒会员周卡"
            @keyup.enter="addProduct"
          />
        </div>
        <button class="btn-primary" @click="addProduct" :disabled="!newProductId.trim()">
          添加
        </button>
      </div>
      <p class="text-xs text-[var(--text-sub)] mt-3">
        获取方式：登录 <a href="https://store.weixin.qq.com" target="_blank" class="text-[var(--primary)] underline">微信小店管理后台</a> -> 商品管理 -> 找到对应商品 -> 复制「商品ID」
      </p>
    </section>

    <!-- 商品列表 -->
    <section class="glass-panel">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold">
          商品列表
          <span class="text-sm font-normal text-[var(--text-sub)] ml-2">共 {{ products.length }} 个</span>
        </h3>
        <div class="flex gap-2" v-if="products.length > 0">
          <button class="btn-soft text-sm" @click="moveUp(-1)" :disabled="loading">上移</button>
          <button class="btn-soft text-sm" @click="moveDown(-1)" :disabled="loading">下移</button>
        </div>
      </div>

      <div v-if="loading && products.length === 0" class="text-center py-12 text-[var(--text-sub)]">
        加载中...
      </div>

      <div v-else-if="products.length === 0" class="text-center py-12 text-[var(--text-sub)]">
        <div class="text-4xl mb-3">🛍️</div>
        <p>暂无商品，请在上方添加商品 ID</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="(product, index) in products"
          :key="product.id + '-' + index"
          class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-body)] transition-colors"
        >
          <!-- 序号 -->
          <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-sm font-medium">
            {{ index + 1 }}
          </span>

          <!-- 商品信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium truncate">{{ product.name || '未命名商品' }}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-[var(--bg-body)] text-[var(--text-sub)]">{{ product.id }}</span>
            </div>
          </div>

          <!-- 排序按钮 -->
          <div class="flex items-center gap-1">
            <button
              class="p-1.5 rounded hover:bg-[var(--bg-body)] disabled:opacity-30 transition-colors"
              @click="moveUp(index)"
              :disabled="index === 0"
              title="上移"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            </button>
            <button
              class="p-1.5 rounded hover:bg-[var(--bg-body)] disabled:opacity-30 transition-colors"
              @click="moveDown(index)"
              :disabled="index === products.length - 1"
              title="下移"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <button
              class="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
              @click="removeProduct(index)"
              title="删除"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 提示 -->
    <section class="glass-panel">
      <h3 class="text-base font-semibold mb-3">说明</h3>
      <ul class="text-sm text-[var(--text-sub)] space-y-2 list-disc list-inside">
        <li>商品 ID 是微信小店中商品的唯一标识，用于 <code class="px-1 py-0.5 rounded bg-[var(--bg-body)]">store-product</code> 组件展示商品卡片</li>
        <li>商品顺序即小程序展示顺序，可用上移/下移调整</li>
        <li>商品名称仅为备注，方便你识别，不会在小程序中显示</li>
        <li>保存后立即生效，小程序下次打开小店页面即可看到最新商品</li>
        <li>如果商品列表为空，小程序小店页面会显示「暂无商品」提示</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConfigStore } from '../stores/config'
import { useMessage } from 'naive-ui'

interface StoreProduct {
  id: string
  name: string
}

const message = useMessage()
const configStore = useConfigStore()

const loading = ref(false)
const saving = ref(false)
const products = ref<StoreProduct[]>([])
const newProductId = ref('')
const newProductName = ref('')

const CONFIG_KEY = 'storeProducts'

const loadConfig = async () => {
  loading.value = true
  try {
    const data = await configStore.get<StoreProduct[]>(CONFIG_KEY, 0)
    products.value = Array.isArray(data) ? data : []
  } catch {
    message.error('加载配置失败')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    const ok = await configStore.set(CONFIG_KEY, products.value)
    if (ok) {
      message.success('保存成功！小程序小店页面已更新')
    } else {
      message.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}

const addProduct = () => {
  const id = newProductId.value.trim()
  if (!id) return
  if (products.value.some(p => p.id === id)) {
    message.warning('该商品 ID 已存在')
    return
  }
  products.value.push({
    id,
    name: newProductName.value.trim()
  })
  newProductId.value = ''
  newProductName.value = ''
}

const removeProduct = (index: number) => {
  products.value.splice(index, 1)
}

const moveUp = (index: number) => {
  if (index === -1) return
  if (index <= 0) return
  const arr = products.value
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
}

const moveDown = (index: number) => {
  if (index === -1) return
  const arr = products.value
  if (index >= arr.length - 1) return
  ;[arr[index + 1], arr[index]] = [arr[index], arr[index + 1]]
}

onMounted(() => {
  loadConfig()
})
</script>
