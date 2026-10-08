<script setup lang="ts">
/**
 * 全局 dialog 实例注册器（无渲染组件）
 *
 * 为什么独立成组件：useDialog() 内部是 inject(NDialogProvider 的 provide)，
 * 只有在 NDialogProvider 的**后代组件**里调用才能拿到实例。
 * App.vue 本身是 Provider 的父级（模板层级在 Provider 外面），
 * 在 App.vue 的 setup/onMounted 里调用 useDialog() 只会拿到 null ——
 * 表现为 confirmDialog() 一律走「实例未注册，默认拒绝执行」兜底。
 * 本组件被放在 App.vue 模板的 NModalProvider 内部（NDialogProvider 的后代），
 * 只要 App 渲染就必然完成注册，与当前路由（登录页/后台）无关。
 */
import { useDialog } from 'naive-ui'
import { registerDialogInstance } from '../composables/useDialog'

registerDialogInstance(useDialog())
</script>

<template>
  <!-- 无渲染组件：仅用于在 Provider 内部完成 dialog 实例注册 -->
  <span hidden aria-hidden="true"></span>
</template>
