<template>
  <div class="space-y-6">
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 class="panel-title">文案管理</h2>
          <p class="panel-sub">管理精选文案库</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-soft" @click="togglePromptConfig">
            {{ showPromptConfig ? "收起配置" : "提示词配置" }}
          </button>
          <button class="btn-soft" @click="toggleAIGenerator">
            {{ showAIGenerator ? "收起生成器" : "AI 批量生成" }}
          </button>
          <button class="btn-primary" @click="toggleAddDialog">
            添加文案
          </button>
        </div>
      </div>

      <div v-if="showPromptConfig" class="upload-card">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-[var(--text-main)]">提示词配置</h4>
            <button class="btn-soft text-xs" @click="savePromptConfig" :disabled="savingConfig">
              {{ savingConfig ? "保存中..." : "保存配置" }}
            </button>
          </div>
          <div class="space-y-3">
            <label class="field">
              <span>通用系统提示词</span>
              <textarea v-model="promptConfig.generalPrompt" class="input" rows="3" placeholder="设置通用的 AI 生成提示词"></textarea>
            </label>
            <label class="field">
              <span>分类专属提示词</span>
              <div class="space-y-2 mt-2">
                <div v-for="cat in categories" :key="cat" class="flex flex-col gap-1">
                  <span class="text-xs text-[var(--text-sub)]">{{ cat }}</span>
                  <input 
                    v-model="promptConfig.categoryPrompts[cat]" 
                    class="input text-sm" 
                    :placeholder="`${cat} 的专属提示词`" 
                  />
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div v-if="showAIGenerator" class="upload-card">
        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <label class="field">
            <span>生成数量</span>
            <input v-model.number="aiForm.count" type="number" min="1" max="20" class="input" />
          </label>
          <label class="field">
            <span>分类</span>
            <select v-model="aiForm.category" class="input">
              <option value="">请选择分类</option>
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </label>
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button class="btn-soft" :disabled="generating" @click="handleAIGenerate">
            <span v-if="generating" class="inline-block animate-spin mr-2">⟳</span>
            {{ generating ? "生成中..." : "开始生成" }}
          </button>
        </div>
      </div>
    </section>

    <section class="glass-panel">
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <label class="field">
          <span>关键词</span>
          <input v-model="filters.keyword" class="input" placeholder="搜索文案内容" @keyup.enter="applyFilters" />
        </label>
        <label class="field">
          <span>分类</span>
          <select v-model="filters.category" class="input" @change="applyFilters">
            <option value="">全部</option>
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>状态</span>
          <select v-model="filters.status" class="input" @change="applyFilters">
            <option value="">全部</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button class="btn-soft" @click="applyFilters">筛选</button>
          <button class="btn-soft" @click="resetFilters">重置</button>
        </div>
      </div>
    </section>

    <section class="glass-panel">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 class="panel-title">文案列表</h3>
        <div class="text-sm text-[var(--text-sub)]">
          共 {{ total }} 条文案
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>

      <div v-else class="space-y-4">
        <div v-for="quote in quotes" :key="quote._id" class="quote-card">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="quote-content">{{ quote.content }}</div>
              <div class="flex flex-wrap gap-2 mt-3">
                <span v-if="quote.category" class="quote-tag">{{ quote.category }}</span>
                <span v-for="tag in quote.tags" :key="tag" class="quote-tag quote-tag-secondary">
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <span 
                class="text-xs px-2 py-1 rounded"
                :class="quote.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
              >
                {{ quote.status === 'published' ? '已发布' : '草稿' }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
            <button class="btn-soft text-xs" @click="editQuote(quote)">
              编辑
            </button>
            <button class="btn-soft text-xs" @click="toggleStatus(quote)">
              {{ quote.status === 'published' ? '下架' : '发布' }}
            </button>
            <button class="btn-soft text-xs text-red-600" @click="deleteQuote(quote)">
              删除
            </button>
          </div>
        </div>
      </div>

      <div v-if="!loading && quotes.length === 0" class="text-center py-12 text-[var(--text-sub)]">
        暂无文案
      </div>

      <div v-if="hasMore && !loading" class="flex justify-center mt-6">
        <button class="btn-soft" @click="loadMore">
          加载更多
        </button>
      </div>
    </section>

    <div v-if="showAddDialog" class="modal-overlay" @click.self="toggleAddDialog">
      <div class="modal-content">
        <h3 class="text-lg font-bold mb-4">{{ editingQuote ? '编辑文案' : '添加文案' }}</h3>
        <div class="space-y-4">
          <label class="field">
            <span>文案内容</span>
            <textarea v-model="quoteForm.content" class="input" rows="4" placeholder="输入文案内容"></textarea>
          </label>
          <label class="field">
            <span>分类</span>
            <select v-model="quoteForm.category" class="input">
              <option value="">请选择分类</option>
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>标签（逗号分隔）</span>
            <input v-model="quoteForm.tagsStr" class="input" placeholder="例如：治愈,简约,励志" />
          </label>
          <label class="field">
            <span>状态</span>
            <select v-model="quoteForm.status" class="input">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button class="btn-soft" @click="toggleAddDialog">取消</button>
          <button class="btn-primary" @click="saveQuote">
            {{ editingQuote ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { db, app } from '../utils/cloudbase'

const loading = ref(false)
const quotes = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)

const showAddDialog = ref(false)
const showAIGenerator = ref(false)
const showPromptConfig = ref(false)
const generating = ref(false)
const savingConfig = ref(false)
const editingQuote = ref<any>(null)

const promptConfig = ref({
  generalPrompt: '你是一个专业的文案助手，擅长创作各种类型的优质文案。文案要求简短、有感染力、不超过50字。',
  categoryPrompts: {} as Record<string, string>
})

const categories = ref([
  '朋友圈', '个性签名', '表白文案', '励志文案', 
  '治愈文案', '伤感文案', '生日文案', '节日文案'
])

const filters = ref({
  keyword: '',
  category: '',
  status: ''
})

const quoteForm = ref({
  content: '',
  category: '',
  tagsStr: '',
  status: 'draft'
})

const aiForm = ref({
  count: 5,
  category: ''
})

const fetchQuotes = async (reset = false) => {
  console.log('fetchQuotes called, reset:', reset)
  if (reset) {
    page.value = 1
    quotes.value = []
  }

  loading.value = true
  try {
    const conditions: any = {}
    
    if (filters.value.keyword) {
      conditions.content = db.RegExp({
        regexp: filters.value.keyword,
        options: 'i'
      })
    }
    
    if (filters.value.category) {
      conditions.category = filters.value.category
    }
    
    if (filters.value.status) {
      conditions.status = filters.value.status
    }

    console.log('查询条件:', conditions)

    const query = db.collection('quotes')
      .where(conditions)
      .orderBy('createdAt', 'desc')
    
    console.log('开始查询...')
    const [countRes, dataRes] = await Promise.all([
      query.count(),
      query.skip((page.value - 1) * pageSize.value)
        .limit(pageSize.value)
        .get()
    ])

    console.log('countRes:', countRes)
    console.log('dataRes:', dataRes)

    total.value = countRes.total
    const newQuotes = dataRes.data || []
    console.log('新获取的文案:', newQuotes)
    
    if (reset) {
      quotes.value = newQuotes
    } else {
      quotes.value = [...quotes.value, ...newQuotes]
    }
    
    console.log('当前列表:', quotes.value)
    
    hasMore.value = newQuotes.length === pageSize.value
  } catch (err: any) {
    console.error('获取文案失败:', err)
    console.error('错误详情:', err.message, err.stack)
  } finally {
    loading.value = false
    console.log('fetchQuotes 完成, loading:', loading.value)
  }
}

const loadMore = () => {
  page.value++
  fetchQuotes()
}

const applyFilters = () => {
  fetchQuotes(true)
}

const resetFilters = () => {
  filters.value = { keyword: '', category: '', status: '' }
  fetchQuotes(true)
}

const toggleAddDialog = () => {
  showAddDialog.value = !showAddDialog.value
  if (!showAddDialog.value) {
    resetQuoteForm()
  }
}

const togglePromptConfig = () => {
  showPromptConfig.value = !showPromptConfig.value
}

const toggleAIGenerator = () => {
  showAIGenerator.value = !showAIGenerator.value
}

const loadPromptConfig = async () => {
  try {
    const res = await db.collection('sys_config').doc('quotes_prompt_config').get()
    if (res.data) {
      promptConfig.value = {
        generalPrompt: res.data.generalPrompt || promptConfig.value.generalPrompt,
        categoryPrompts: res.data.categoryPrompts || {}
      }
    }
  } catch (err) {
    console.error('加载提示词配置失败:', err)
  }
}

const savePromptConfig = async () => {
  savingConfig.value = true
  try {
    await db.collection('sys_config').doc('quotes_prompt_config').set({
      generalPrompt: promptConfig.value.generalPrompt,
      categoryPrompts: promptConfig.value.categoryPrompts,
      updatedAt: new Date()
    })
    alert('提示词配置已保存')
  } catch (err) {
    console.error('保存提示词配置失败:', err)
    alert('保存失败，请重试')
  } finally {
    savingConfig.value = false
  }
}

const resetQuoteForm = () => {
  quoteForm.value = {
    content: '',
    category: '',
    tagsStr: '',
    status: 'draft'
  }
  editingQuote.value = null
}

const editQuote = (quote: any) => {
  editingQuote.value = quote
  quoteForm.value = {
    content: quote.content,
    category: quote.category || '',
    tagsStr: (quote.tags || []).join(', '),
    status: quote.status
  }
  showAddDialog.value = true
}

const saveQuote = async () => {
  if (!quoteForm.value.content.trim()) {
    alert('请输入文案内容')
    return
  }

  try {
    const data = {
      content: quoteForm.value.content,
      category: quoteForm.value.category,
      tags: quoteForm.value.tagsStr.split(/[,，]/).map((s: string) => s.trim()).filter((s: string) => s),
      status: quoteForm.value.status,
      updatedAt: new Date()
    }

    if (editingQuote.value) {
      await db.collection('quotes').doc(editingQuote.value._id).update(data)
    } else {
      await db.collection('quotes').add({
        ...data,
        createdAt: new Date()
      })
    }

    toggleAddDialog()
    fetchQuotes(true)
  } catch (err) {
    console.error('保存文案失败:', err)
    alert('保存失败，请重试')
  }
}

const toggleStatus = async (quote: any) => {
  try {
    const newStatus = quote.status === 'published' ? 'draft' : 'published'
    await db.collection('quotes').doc(quote._id).update({
      status: newStatus,
      updatedAt: new Date()
    })
    fetchQuotes(true)
  } catch (err) {
    console.error('更新状态失败:', err)
    alert('操作失败，请重试')
  }
}

const deleteQuote = async (quote: any) => {
  if (!confirm('确定要删除这条文案吗？')) return

  try {
    await db.collection('quotes').doc(quote._id).remove()
    fetchQuotes(true)
  } catch (err) {
    console.error('删除文案失败:', err)
    alert('删除失败，请重试')
  }
}

const handleAIGenerate = async () => {
  generating.value = true
  try {
    let systemPrompt = promptConfig.value.generalPrompt
    
    if (aiForm.value.category && promptConfig.value.categoryPrompts[aiForm.value.category]) {
      systemPrompt = promptConfig.value.categoryPrompts[aiForm.value.category]
    }

    const res = await app.callFunction({
      name: 'aiGenerateText',
      data: {
        action: 'generate',
        systemPrompt: systemPrompt,
        prompt: `请生成${aiForm.value.count}条文案，每条文案不超过50字。

请直接返回文案，每条占一行，不要任何其他文字或格式，不要编号。`,
        count: aiForm.value.count
      }
    })

    console.log('云函数返回结果:', res)
    
    if (res.result && res.result.success && res.result.text) {
      console.log('AI 返回文本:', res.result.text)
      let quotesToAdd: any[] = []
      
      try {
        let textToParse = res.result.text.trim()
        const jsonMatch = textToParse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          textToParse = jsonMatch[0]
        }
        
        const parsed = JSON.parse(textToParse)
        console.log('解析结果:', parsed)
        
        if (parsed.quotes && Array.isArray(parsed.quotes)) {
          quotesToAdd = parsed.quotes
        } else if (Array.isArray(parsed)) {
          quotesToAdd = parsed
        }
      } catch (parseErr) {
        console.log('JSON 解析失败，尝试分行解析:', parseErr)
        const lines = res.result.text.split('\n').filter((line: string) => {
          const trimmed = line.trim()
          return trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('}') && !trimmed.startsWith('[') && !trimmed.startsWith(']')
        })
        
        if (lines.length > 0) {
          quotesToAdd = lines.slice(0, aiForm.value.count).map((line: string) => 
            line.replace(/^\d+[.、)\]\s-]*/, '').replace(/["'`]/g, '').trim()
          ).filter((line: string) => line.length > 0)
        }
      }

      console.log('最终提取的文案:', quotesToAdd)

      if (quotesToAdd.length > 0) {
        const newQuotes = quotesToAdd.map((content: string) => ({
          content,
          category: aiForm.value.category,
          tags: aiForm.value.category ? [aiForm.value.category] : [],
          status: 'published',
          createdAt: new Date(),
          updatedAt: new Date()
        }))

        console.log('准备写入的文案:', newQuotes)

        const writeResults = []
        for (const quote of newQuotes) {
          try {
            const res = await db.collection('quotes').add(quote)
            console.log('写入成功:', res)
            writeResults.push(res)
          } catch (writeErr) {
            console.error('写入失败:', writeErr)
          }
        }

        console.log('写入完成，成功:', writeResults.length)
        alert(`成功生成 ${writeResults.length} 条文案`)
        setTimeout(() => {
          fetchQuotes(true)
        }, 500)
        toggleAIGenerator()
      } else {
        alert('未能解析 AI 返回的内容，已将 AI 返回内容打印到控制台，请检查')
      }
    } else {
      alert(res.result?.error || '生成失败，请重试')
    }
  } catch (err: any) {
    console.error('AI生成失败:', err)
    alert('生成失败：' + (err.message || '请重试'))
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  fetchQuotes(true)
  loadPromptConfig()
})
</script>

<style scoped>
.quote-card {
  padding: 20px;
  background: var(--bg-body);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.quote-content {
  font-size: 16px;
  line-height: 1.8;
  color: var(--text-main);
}

.quote-tag {
  display: inline-block;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 999px;
  background: var(--primary);
  color: white;
}

.quote-tag-secondary {
  background: var(--bg-card);
  color: var(--text-sub);
  border: 1px solid var(--border-color);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}
</style>
