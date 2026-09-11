<template>
  <div class="upload-card">
    <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
      <label class="field">
        <span>标题</span>
        <input v-model="uploadForm.title" class="input" placeholder="素材名称" />
      </label>
      <label class="field">
        <span>类型</span>
        <select v-model="uploadForm.type" class="input">
          <option value="auto">自动识别 (AI)</option>
          <option value="avatar">头像</option>
          <option value="wallpaper">壁纸</option>
        </select>
      </label>
      <label class="field">
        <span>分类</span>
        <select v-model="uploadForm.category" class="input">
          <option value="">自动识别 (AI)</option>
          <option v-for="item in categories" :key="item._id" :value="item.name">
            {{ item.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>状态</span>
        <select v-model="uploadForm.status" class="input">
          <option value="draft">草稿</option>
          <option value="review">待审</option>
          <option value="published">已发布</option>
          <option value="offline">已下线</option>
        </select>
      </label>
      <label class="field md:col-span-2">
        <span>标签（逗号分隔）</span>
        <input v-model="uploadForm.tags" class="input" placeholder="例如：治愈,简约,几何" />
      </label>
      <label class="field md:col-span-2">
        <span>素材文件（可多选）</span>
        <input
          ref="fileInput"
          type="file"
          class="input"
          accept="image/*"
          multiple
          @change="handleFileChange"
        />
        <span class="text-xs text-[var(--text-sub)]">
          已选择：{{ selectedFiles.length }} 个文件
        </span>
      </label>
    </div>
    <div class="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <button class="btn-soft" :disabled="uploading || selectedFiles.length === 0" @click="handleUpload">
        <span v-if="uploading" class="inline-block animate-spin mr-2">⟳</span>
        {{ uploading ? (aiTotal > 0 ? `AI 识别中: ${aiCompleted}/${aiTotal}` : "上传中...") : "确认上传" }}
      </button>
      <span class="text-xs text-[var(--text-sub)]">上传后会写入 resources 集合</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { app, db, callFunctionWithAuth } from "../utils/cloudbase";
import { useMessage, useDialog } from 'naive-ui';
import { logger } from '../utils/logger';

const message = useMessage();
const dialog = useDialog();

interface Category {
  _id: string;
  name: string;
  order?: number;
}

defineProps<{
  categories: Category[];
}>();

const emit = defineEmits<{
  uploaded: [];
}>();

const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<File[]>([]);
const aiTotal = ref(0);
const aiCompleted = ref(0);

const uploadForm = reactive({
  title: "",
  type: "auto",
  status: "published",
  category: "",
  tags: "",
});

const handleFileChange = () => {
  if (!fileInput.value?.files) return;
  selectedFiles.value = Array.from(fileInput.value.files);
};

const generateRandomFileName = (file: File, type: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const randomStr = Math.random().toString(36).substring(2, 8);

  const ext = file.name.split('.').pop() || '';
  const folder = type === 'avatar' ? 'avatar' : 'wallpaper';

  return `resources/${folder}/${year}${month}${day}-${hours}${minutes}${seconds}-${randomStr}.${ext}`;
};

const handleUpload = async () => {
  logger.log('Starting Async Upload v2...'); // Force file hash change
  const files = selectedFiles.value;
  if (!files.length) return;

  uploading.value = true;
  aiTotal.value = 0;
  aiCompleted.value = 0;

  try {
    const tags = uploadForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const file of files) {
      // 检查文件名是否已存在
      const checkRes = await db.collection('resources')
        .where({
          originalFileName: file.name
        })
        .count();

      if (checkRes.total > 0) {
        console.warn(`文件已存在，跳过上传: ${file.name}`);
        const confirmed = await dialog.warning({
          title: '提示',
          content: `文件 "${file.name}" 已存在。\n是否继续上传？\n(取消则跳过此文件)`,
          positiveText: '确定',
          negativeText: '取消',
        });
        if (!confirmed) continue;
      }

      let fileType = uploadForm.type;

      let folderType = fileType;
      if (fileType === 'auto') {
        folderType = 'wallpaper';
      }

      const cloudPath = generateRandomFileName(file, folderType);

      try {
          const uploadRes = await app.uploadFile({
            cloudPath,
            filePath: file as unknown as string,
          });

          const callRes = await callFunctionWithAuth("uploadResource", {
            title: uploadForm.title || file.name,
            originalFileName: file.name,
            type: fileType,
            status: uploadForm.status,
            category: uploadForm.category,
            categories: uploadForm.category ? [uploadForm.category] : [],
            tags,
            coverUrl: uploadRes.fileID,
            originUrl: uploadRes.fileID,
            skipAI: false // 开启异步 AI 分析
          });

          logger.log('Upload Result:', callRes.result);

          if (callRes.result && callRes.result.success) {
             // 仅计数，不再前端触发 AI
             aiCompleted.value++;
          }

          if (callRes.result && callRes.result.debugLogs) {
            logger.log(callRes.result.debugLogs);
          }
      } catch (e) {
          logger.error(`上传文件 ${file.name} 失败:`, e);
          message.error(`上传文件 ${file.name} 失败`);
      }
    }

    uploadForm.title = "";
    uploadForm.tags = "";
    uploadForm.category = "";
    uploadForm.type = "auto";
    selectedFiles.value = [];
    if (fileInput.value) fileInput.value.value = "";

    // 延迟一下刷新，让部分数据写入完成
    setTimeout(() => emit('uploaded'), 1000);
    message.success(`批量上传任务已提交！共 ${files.length} 个文件，AI 识别将在后台自动进行。`);

  } finally {
    uploading.value = false;
    aiTotal.value = 0;
    aiCompleted.value = 0;
  }
};
</script>
