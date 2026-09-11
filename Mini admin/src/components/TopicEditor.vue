<template>
  <!-- Create Modal -->
  <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/60 backdrop-blur-sm" @click="closeCreate">
    <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all border border-[var(--border-color)]" @click.stop>
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
        <h3 class="text-lg font-bold text-[var(--text-main)]">新增专题</h3>
        <button class="text-[var(--text-sub)] hover:text-[var(--text-main)] p-1 rounded-lg hover:bg-[var(--bg-body)] transition-colors" @click="closeCreate">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-5">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[var(--text-main)]">专题标题</label>
          <input v-model="form.title" class="input w-full" placeholder="例如：二次元专场" @keyup.enter="createTopic" />
        </div>

        <!-- 专题描述 -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[var(--text-main)]">专题描述</label>
          <input v-model="form.description" class="input w-full" placeholder="一句话描述（可选）" />
        </div>

        <!-- 封面上传（所有类型都需要） -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[var(--text-main)]">专题封面</label>
          <div class="flex gap-3 items-center">
            <div class="w-24 h-24 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden flex-shrink-0">
              <img v-if="form.coverPreview" :src="form.coverPreview" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)] text-center px-1">点击右侧<br/>选择图片</div>
            </div>
            <div class="flex flex-col gap-2 flex-1">
              <button class="btn-primary text-sm px-4 py-2" @click="pickCover">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" /></svg>
                {{ form.coverPreview ? '修改封面' : '选择封面' }}
              </button>
              <button v-if="form.coverPreview" class="btn text-xs px-3 py-1.5" :style="{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }" @click="clearFormCover">
                移除封面
              </button>
            </div>
          </div>
          <p class="text-xs text-[var(--text-sub)]">建议 16:9 横图，将裁剪后上传</p>
        </div>

        <!-- 跳转类型选择 -->
        <div class="bg-[var(--bg-body)] rounded-xl p-4 border border-[var(--border-color)] space-y-4">
          <div class="flex items-center gap-2 text-[var(--text-main)] font-medium pb-2 border-b border-[var(--border-color)]/50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V6a1 1 0 112 0v6.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            跳转类型
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="opt in linkTypeOptions"
              :key="opt.value"
              class="px-3 py-2.5 rounded-lg text-sm font-medium border transition-all"
              :style="form.linkType === opt.value
                ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                : { background: 'var(--bg-card)', color: 'var(--text-sub)', borderColor: 'var(--border-color)' }"
              @click="form.linkType = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <p class="text-xs text-[var(--text-sub)] -mt-1">
            {{ linkTypeOptions.find(o => o.value === form.linkType)?.desc }}
          </p>

          <!-- 资源列表模式：筛选规则 -->
          <div v-if="form.linkType === 'resource'" class="grid grid-cols-3 gap-4 pt-2 border-t border-[var(--border-color)]/50">
            <div class="col-span-1 space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-sub)]">筛选类型</label>
              <select v-model="form.filterType" class="select w-full">
                <option value="tag">标签</option>
                <option value="category">分类</option>
              </select>
            </div>
            <div class="col-span-2 space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-sub)]">筛选值</label>
              <input v-model="form.filterValue" class="input w-full" placeholder="例如：可爱" />
            </div>
          </div>

          <!-- 内部页面模式：快捷选择 + 自定义输入 -->
          <div v-else-if="form.linkType === 'page'" class="space-y-3 pt-2 border-t border-[var(--border-color)]/50">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-sub)]">常用页面快捷选择</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="p in pagePresets"
                  :key="p.value"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  :style="form.linkUrl === p.value
                    ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                    : { background: 'var(--bg-card)', color: 'var(--text-sub)', borderColor: 'var(--border-color)' }"
                  @click="form.linkUrl = p.value"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-sub)]">页面路径</label>
              <input v-model="form.linkUrl" class="input w-full" :placeholder="targetPlaceholder" />
              <p class="text-xs text-[var(--text-sub)]">小程序内部页面路径，以 / 开头</p>
            </div>
          </div>

          <!-- 网页链接模式 -->
          <div v-else class="space-y-1.5 pt-2 border-t border-[var(--border-color)]/50">
            <label class="text-sm font-medium text-[var(--text-sub)]">网页链接</label>
            <input v-model="form.linkUrl" class="input w-full" :placeholder="targetPlaceholder" />
            <p class="text-xs text-[var(--text-sub)]">以 https:// 开头的外部链接，将在 webview 中打开</p>
          </div>
        </div>

        <!-- 精选 + 角标 -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">精选推荐</label>
            <div class="flex items-center gap-2 bg-[var(--bg-body)] rounded-lg px-3 py-2.5 border border-[var(--border-color)]">
              <button
                class="w-9 h-5 rounded-full relative transition-all"
                :style="form.isFeatured ? { background: 'var(--primary)' } : { background: '#d1d5db' }"
                @click="form.isFeatured = !form.isFeatured"
              >
                <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm" :style="{ transform: form.isFeatured ? 'translateX(16px)' : '' }"></span>
              </button>
              <span class="text-sm text-[var(--text-sub)]">{{ form.isFeatured ? '显示在专题页顶部' : '不置顶' }}</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">角标</label>
            <select v-model="form.badge" class="select w-full">
              <option value="">无角标</option>
              <option value="hot">热门</option>
              <option value="new">新品</option>
              <option value="limited">限时</option>
            </select>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end gap-3 rounded-b-2xl">
        <button class="px-4 py-2 text-sm font-medium text-[var(--text-sub)] hover:bg-[var(--bg-card)] rounded-lg transition-colors" @click="closeCreate">取消</button>
        <button class="btn-soft px-6" @click="createTopic" :disabled="!form.title || creating || (form.linkType === 'resource' ? !form.filterValue : !form.linkUrl)">
          <svg v-if="creating" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ creating ? '创建中...' : '创建' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Edit Modal (page/webview 类型专用) -->
  <div v-if="showEdit" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/60 backdrop-blur-sm" @click="closeEdit">
    <div class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all border border-[var(--border-color)]" @click.stop>
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
        <h3 class="text-lg font-bold text-[var(--text-main)]">编辑专题</h3>
        <button class="text-[var(--text-sub)] hover:text-[var(--text-main)] p-1 rounded-lg hover:bg-[var(--bg-body)] transition-colors" @click="closeEdit">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-5">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[var(--text-main)]">专题标题</label>
          <input v-model="editForm.title" class="input w-full" placeholder="例如：每日推荐" />
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[var(--text-main)]">专题描述</label>
          <input v-model="editForm.description" class="input w-full" placeholder="一句话描述（可选）" />
        </div>

        <!-- 封面 -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[var(--text-main)]">专题封面</label>
          <div class="flex gap-3 items-center">
            <div class="w-24 h-24 bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] overflow-hidden flex-shrink-0">
              <img v-if="editForm.coverPreview" :src="editForm.coverPreview" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)] text-center px-1">点击右侧<br/>选择图片</div>
            </div>
            <div class="flex flex-col gap-2 flex-1">
              <button class="btn-primary text-sm px-4 py-2" @click="pickEditCover">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" /></svg>
                {{ editForm.coverPreview ? '修改封面' : '选择封面' }}
              </button>
              <button v-if="editForm.coverPreview" class="btn text-xs px-3 py-1.5" :style="{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }" @click="clearEditCover">
                移除封面
              </button>
            </div>
          </div>
        </div>

        <!-- 跳转目标 -->
        <div class="bg-[var(--bg-body)] rounded-xl p-4 border border-[var(--border-color)] space-y-3">
          <div class="flex items-center gap-2 text-[var(--text-main)] font-medium pb-2 border-b border-[var(--border-color)]/50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V6a1 1 0 112 0v6.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            跳转目标
          </div>
          <!-- 内部页面 -->
          <div v-if="editForm.linkType === 'page'" class="space-y-3">
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-sub)]">常用页面快捷选择</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="p in pagePresets"
                  :key="p.value"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  :style="editForm.linkUrl === p.value
                    ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                    : { background: 'var(--bg-card)', color: 'var(--text-sub)', borderColor: 'var(--border-color)' }"
                  @click="editForm.linkUrl = p.value"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-[var(--text-sub)]">页面路径</label>
              <input v-model="editForm.linkUrl" class="input w-full" placeholder="例如: /subpackages/daily-picks/daily-picks" />
            </div>
          </div>
          <!-- 网页链接 -->
          <div v-else class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-sub)]">网页链接</label>
            <input v-model="editForm.linkUrl" class="input w-full" placeholder="例如: https://example.com" />
          </div>
        </div>

        <!-- 精选 + 角标 -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">精选推荐</label>
            <div class="flex items-center gap-2 bg-[var(--bg-body)] rounded-lg px-3 py-2.5 border border-[var(--border-color)]">
              <button
                class="w-9 h-5 rounded-full relative transition-all"
                :style="editForm.isFeatured ? { background: 'var(--primary)' } : { background: '#d1d5db' }"
                @click="editForm.isFeatured = !editForm.isFeatured"
              >
                <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm" :style="{ transform: editForm.isFeatured ? 'translateX(16px)' : '' }"></span>
              </button>
              <span class="text-sm text-[var(--text-sub)]">{{ editForm.isFeatured ? '置顶' : '不置顶' }}</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-[var(--text-main)]">角标</label>
            <select v-model="editForm.badge" class="select w-full">
              <option value="">无角标</option>
              <option value="hot">热门</option>
              <option value="new">新品</option>
              <option value="limited">限时</option>
            </select>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-body)] flex justify-end gap-3 rounded-b-2xl">
        <button class="px-4 py-2 text-sm font-medium text-[var(--text-sub)] hover:bg-[var(--bg-card)] rounded-lg transition-colors" @click="closeEdit">取消</button>
        <button class="btn-soft px-6" @click="saveEditTopic" :disabled="!editForm.title || !editForm.linkUrl || savingEdit">
          <svg v-if="savingEdit" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ savingEdit ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { callCloudFunction, app } from '../utils/cloudbase';
import { useMessage } from 'naive-ui';
import { useCache } from '../composables/useCache';
import type { TopicItem, TopicLinkType } from '../types';

const message = useMessage();

const props = defineProps<{
  editItem: TopicItem | null;
  topicCount: number;
}>();

const emit = defineEmits<{
  created: [payload: { id: string; linkType: TopicLinkType }];
  updated: [];
}>();

const showCreate = defineModel<boolean>('showCreate', { required: true });
const showEdit = defineModel<boolean>('showEdit', { required: true });

const { clear: clearCache } = useCache<unknown[]>('topics_cache');

const creating = ref(false);
const savingEdit = ref(false);

const form = reactive({
  title: '',
  description: '',
  filterType: 'tag',
  filterValue: '',
  status: 'active',
  sort: 0,
  resourceType: 'all',
  defaultSort: 'latest',
  isFeatured: false,
  badge: '',
  linkType: 'resource' as TopicLinkType,
  linkUrl: '',
  coverPreview: '',
  coverFileID: ''
});

const editForm = reactive({
  _id: '',
  title: '',
  description: '',
  coverPreview: '',
  coverFileID: '',
  linkType: 'page' as TopicLinkType,
  linkUrl: '',
  isFeatured: false,
  badge: ''
});

// 常用内部页面快捷选项
const pagePresets = [
  { label: '每日推荐', value: '/subpackages/daily-picks/daily-picks' },
  { label: '灵感文案', value: '/subpackages/inspiration-writer/inspiration-writer' },
  { label: '小辣椒小店', value: '/subpackages/store/store' },
  { label: '搜索', value: '/subpackages/search/search' },
  { label: '我的收藏', value: '/subpackages/favorites/favorites' },
  { label: '积分中心', value: '/subpackages/points/points' },
  { label: '头像DIY', value: '/subpackages/avatar-diy/avatar-diy' },
  { label: '通知中心', value: '/subpackages/notifications/notifications' }
];

const linkTypeOptions: { value: TopicLinkType; label: string; desc: string }[] = [
  { value: 'resource', label: '资源列表', desc: '按标签/分类筛选资源，跳转到通用资源列表页' },
  { value: 'page', label: '内部页面', desc: '跳转到小程序内指定页面（如每日推荐、小店等）' },
  { value: 'webview', label: '网页链接', desc: '跳转到外部 H5 网页（需 https:// 开头）' }
];

const targetPlaceholder = computed(() => {
  switch (form.linkType) {
    case 'page': return '例如: /subpackages/daily-picks/daily-picks';
    case 'webview': return '例如: https://example.com';
    default: return '';
  }
});

// 创建弹窗打开时重置表单
watch(showCreate, (val) => {
  if (!val) return;
  form.title = '';
  form.description = '';
  form.filterType = 'tag';
  form.filterValue = '';
  form.status = 'active';
  form.sort = props.topicCount;
  form.isFeatured = false;
  form.badge = '';
  form.linkType = 'resource';
  form.linkUrl = '';
  if (form.coverPreview) { URL.revokeObjectURL(form.coverPreview); form.coverPreview = ''; }
  form.coverFileID = '';
});

// 编辑弹窗打开时填充表单
watch(showEdit, (val) => {
  if (!val || !props.editItem) return;
  const item = props.editItem;
  editForm._id = item._id;
  editForm.title = item.title || '';
  editForm.description = item.description || '';
  editForm.coverPreview = item.cover || '';
  editForm.coverFileID = item.coverFileID || (item.cover && item.cover.startsWith('cloud://') ? item.cover : '');
  editForm.linkType = item.linkType || 'page';
  editForm.linkUrl = item.linkUrl || '';
  editForm.isFeatured = !!item.isFeatured;
  editForm.badge = item.badge || '';
});

const closeCreate = () => { showCreate.value = false; };
const closeEdit = () => { showEdit.value = false; };

// 选择封面文件（创建弹窗）
const pickCover = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (form.coverPreview) URL.revokeObjectURL(form.coverPreview);
    form.coverPreview = URL.createObjectURL(file);
    try {
      const cloudPath = `topics/covers/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
      const res = await app.uploadFile({ cloudPath, filePath: file as unknown as string });
      form.coverFileID = res.fileID;
    } catch (err) {
      console.error('封面上传失败:', err);
      message.error('封面上传失败');
      if (form.coverPreview) { URL.revokeObjectURL(form.coverPreview); form.coverPreview = ''; }
    }
  };
  input.click();
};

const clearFormCover = () => {
  if (form.coverPreview) { URL.revokeObjectURL(form.coverPreview); form.coverPreview = ''; }
  form.coverFileID = '';
};

// 选择封面文件（编辑弹窗）
const pickEditCover = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (editForm.coverPreview) URL.revokeObjectURL(editForm.coverPreview);
    editForm.coverPreview = URL.createObjectURL(file);
    try {
      const cloudPath = `topics/covers/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
      const res = await app.uploadFile({ cloudPath, filePath: file as unknown as string });
      editForm.coverFileID = res.fileID;
    } catch (err) {
      console.error('封面上传失败:', err);
      message.error('封面上传失败');
    }
  };
  input.click();
};

const clearEditCover = () => {
  if (editForm.coverPreview) { URL.revokeObjectURL(editForm.coverPreview); editForm.coverPreview = ''; }
  editForm.coverFileID = '';
};

const createTopic = async () => {
  if (!form.title || creating.value) return;
  if (form.linkType === 'resource' && !form.filterValue) return;
  if (form.linkType !== 'resource' && !form.linkUrl) {
    message.error('请填写跳转目标');
    return;
  }

  creating.value = true;
  try {
    const res = await callCloudFunction('manageTopics', {
      action: 'create',
      data: {
        title: form.title,
        description: form.description,
        cover: form.coverFileID || '',
        coverFileID: form.coverFileID || '',
        filterType: form.filterType,
        filterValue: form.linkType === 'resource' ? form.filterValue : '',
        status: form.status,
        sort: form.sort,
        resourceType: form.resourceType,
        defaultSort: form.defaultSort,
        isFeatured: form.isFeatured,
        badge: form.badge,
        linkType: form.linkType,
        linkUrl: form.linkType !== 'resource' ? form.linkUrl : ''
      }
    });

    showCreate.value = false;
    message.success('专题创建成功');
    clearCache();
    emit('created', { id: res.id, linkType: form.linkType });
  } catch (err) {
    console.error('创建失败', err);
    message.error('创建失败，请重试');
  } finally {
    creating.value = false;
  }
};

const saveEditTopic = async () => {
  if (!editForm.title || !editForm.linkUrl || savingEdit.value) return;
  savingEdit.value = true;
  try {
    await callCloudFunction('manageTopics', {
      action: 'update',
      id: editForm._id,
      data: {
        title: editForm.title,
        description: editForm.description,
        cover: editForm.coverFileID || editForm.coverPreview || '',
        coverFileID: editForm.coverFileID || '',
        linkType: editForm.linkType,
        linkUrl: editForm.linkUrl,
        isFeatured: editForm.isFeatured,
        badge: editForm.badge
      }
    });
    showEdit.value = false;
    message.success('保存成功');
    clearCache();
    emit('updated');
  } catch (err) {
    console.error('保存失败', err);
    message.error('保存失败');
  } finally {
    savingEdit.value = false;
  }
};
</script>

<style scoped>
.input {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}

.select {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  cursor: pointer;
}

.select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
}
</style>
