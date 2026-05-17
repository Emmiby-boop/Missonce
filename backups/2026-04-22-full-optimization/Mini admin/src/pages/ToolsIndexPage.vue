<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-2xl font-semibold mb-4">索引维护</h1>
    <p class="text-gray-600 mb-4">调用云函数 updateDatabaseIndexes，创建/更新必要的数据库索引。</p>

    <div v-if="loading" class="p-4 border rounded bg-yellow-50 border-yellow-200 text-yellow-800">
      正在执行索引更新，请稍候…
    </div>

    <div v-else-if="error" class="p-4 border rounded bg-red-50 border-red-200 text-red-800">
      执行失败：{{ error }}
    </div>

    <div v-else-if="result" class="space-y-4">
      <div class="p-4 border rounded bg-green-50 border-green-200 text-green-800">
        执行完成：成功 {{ result.success?.length || 0 }} 项，失败 {{ result.failed?.length || 0 }} 项
      </div>
      <div>
        <h2 class="font-medium mb-2">成功</h2>
        <ul class="list-disc pl-6">
          <li v-for="(s, i) in result.success" :key="'s-' + i">{{ s }}</li>
        </ul>
      </div>
      <div v-if="result.failed && result.failed.length > 0">
        <h2 class="font-medium mb-2">失败</h2>
        <ul class="list-disc pl-6">
          <li v-for="(f, i) in result.failed" :key="'f-' + i">
            {{ f.index || f.name || '未知' }} - {{ f.error || '未知错误' }}
          </li>
        </ul>
      </div>
      <div v-if="result.manualRequired" class="p-4 border rounded bg-yellow-50 border-yellow-200 text-yellow-800">
        <div class="font-medium mb-2">当前环境无法通过 OpenAPI 自动创建索引，请在 CloudBase 控制台手动创建以下索引：</div>
        <div v-for="(entries, coll) in result.suggestions" :key="coll" class="mb-4">
          <div class="font-semibold">{{ coll }}</div>
          <ul class="list-disc pl-6">
            <li v-for="(def, idx) in entries" :key="coll + '-' + idx">
              {{ def.name }}: 
              <span>
                {{ def.keys.map((k: any) => k.name + (k.direction === '1' ? ' ↑' : ' ↓')).join(', ') }}
                {{ def.unique ? '（唯一）' : '' }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  </template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { callCloudFunction, requireAdmin } from "../utils/cloudbase";

const loading = ref(true);
const error = ref<string | null>(null);
const result = ref<any>(null);

onMounted(async () => {
  try {
    await requireAdmin();
    const res = await callCloudFunction("updateDatabaseIndexes", {});
    result.value = res;
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
</style>
