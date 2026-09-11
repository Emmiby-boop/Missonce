<template>
  <view class="page-container ai-config-page">
    <!-- 页面标题 -->
    <view class="page-head">
      <text class="page-head__title">AI 智能配置</text>
      <text class="page-head__desc">统一管理视觉 / 文案模型、API Key 与识别规则</text>
    </view>

    <!-- Tab 切换（横向滚动 pill） -->
    <scroll-view class="tab-scroll" scroll-x :show-scrollbar="false">
      <view class="tab-bar">
        <view
          v-for="t in tabs"
          :key="t.id"
          class="tab-item"
          :class="{ 'tab-item--active': activeTab === t.id }"
          @tap="onTabChange(t.id)"
        >
          <view class="tab-dot" :class="{ 'tab-dot--on': statusDots[t.id] }" />
          <text class="tab-label">{{ t.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 加载骨架 -->
    <view v-if="loading">
      <view class="skeleton skeleton-block" style="height: 220rpx; border-radius: 20rpx; margin-bottom: 24rpx;" />
      <view class="skeleton skeleton-block" style="height: 320rpx; border-radius: 20rpx; margin-bottom: 24rpx;" />
      <view class="skeleton skeleton-block" style="height: 160rpx; border-radius: 20rpx;" />
    </view>

    <!-- 错误状态 -->
    <view v-else-if="loadError" class="error-state">
      <mc-icon :path="icons.alertCircle" color="#B8B8C8" :size="120" />
      <view class="error-state__text">{{ errorMsg || '加载失败，请稍后重试' }}</view>
      <view class="error-state__action">
        <button class="btn btn--ghost btn--sm" @tap="retryLoad">重试</button>
      </view>
    </view>

    <block v-else>
      <!-- ==================== Tab 1: 视觉模型 ==================== -->
      <block v-if="activeTab === 'vision'">
        <view class="card form-card">
          <view class="card-head">
            <view class="card-head__icon card-head__icon--green">
              <mc-icon :path="icons.cpu" color="#07C160" :size="40" />
            </view>
            <view class="card-head__info">
              <text class="card-head__title">视觉模型配置</text>
              <text class="card-head__desc">用于图片识别与自动分类</text>
            </view>
          </view>

          <!-- API 厂商 -->
          <view class="input-group">
            <text class="input-label">API 厂商</text>
            <picker mode="selector" :range="providerLabels" :value="visionProviderIndex" @change="onVisionProviderChange">
              <view class="picker-display">
                <text class="picker-display__text">{{ providerLabels[visionProviderIndex] }}</text>
                <text class="picker-display__arrow">▾</text>
              </view>
            </picker>
          </view>

          <!-- 模型名称 -->
          <view class="input-group">
            <text class="input-label">模型名称</text>
            <picker v-if="visionModels.length > 0 && !visionUseCustomModel" mode="selector" :range="visionModelLabels" :value="visionModelIndex" @change="onVisionModelChange">
              <view class="picker-display">
                <text class="picker-display__text">{{ visionModelLabels[visionModelIndex] }}</text>
                <text class="picker-display__arrow">▾</text>
              </view>
            </picker>
            <view v-else class="custom-input-row">
              <input class="input input--mono" :value="visionConfig.MODEL" placeholder="输入模型 ID" @input="onVisionModelInput" :adjust-position="true" :cursor-spacing="20" />
              <text v-if="visionModels.length > 0" class="link-btn" @tap="onVisionUsePresetModel">使用预置列表</text>
            </view>
          </view>

          <!-- API 地址 -->
          <view class="input-group">
            <text class="input-label">API 地址</text>
            <input class="input input--mono" :value="visionConfig.API_URL" placeholder="https://..." @input="onVisionUrlInput" :adjust-position="true" :cursor-spacing="20" />
          </view>

          <!-- API Key -->
          <view class="input-group">
            <text class="input-label">API Key</text>
            <picker v-if="visionKeyOptions.length > 0" mode="selector" :range="visionKeyOptions" range-key="name" :value="visionKeyIndex" @change="onVisionKeyPick">
              <view class="picker-row">
                <text class="picker-value">{{ visionKeyOptions[visionKeyIndex].name }} ({{ visionKeyOptions[visionKeyIndex].provider }})</text>
                <text class="picker-arrow">▾</text>
              </view>
            </picker>
            <view class="input-with-action">
              <input class="input input--mono input--flex" :value="visionConfig.API_KEY" :password="!visionKeyVisible" placeholder="sk-..." @input="onVisionKeyInput" :adjust-position="true" :cursor-spacing="20" />
              <view class="input-action-btn" @tap.stop="onToggleVisionKeyVisible">
                <mc-icon :path="visionKeyVisible ? icons.eyeOff : icons.eye" color="#8C8CA1" :size="36" />
              </view>
            </view>
          </view>

          <!-- 系统提示词 -->
          <view class="input-group input-group--last">
            <view class="label-row">
              <text class="input-label">系统提示词</text>
              <text class="link-btn" @tap="onResetVisionPrompt">恢复默认</text>
            </view>
            <textarea
              class="input textarea textarea--lg"
              :value="visionConfig.SYSTEM_PROMPT"
              placeholder="定义 AI 的角色、任务目标、分类体系及输出格式"
              @input="onVisionPromptInput" :adjust-position="true" :cursor-spacing="20"
              :maxlength="-1"
            />
          </view>

          <!-- AI 识别设置 -->
          <view class="ai-set">
            <view class="ai-set__title">
              <text class="ai-set__icon-text">⚡</text>
              <text>AI 识别设置</text>
            </view>
            <view class="ai-set__row">
              <view class="ai-set__row-info">
                <text class="ai-set__row-label">上传后自动识别</text>
                <text class="ai-set__row-desc">资源上传后自动调用视觉模型识别</text>
              </view>
              <mc-toggle :value="visionConfig.AUTO_RECOGNIZE" @change="onAutoRecognizeToggle" />
            </view>
            <view class="ai-set__row">
              <view class="ai-set__row-info">
                <text class="ai-set__row-label">识别结果自动应用</text>
                <text class="ai-set__row-desc">识别完成后自动写入标题/分类/标签</text>
              </view>
              <mc-toggle :value="visionConfig.AUTO_APPLY" @change="onAutoApplyToggle" />
            </view>
          </view>
        </view>

        <!-- 测试结果 -->
        <view v-if="visionTestResult" class="test-result" :class="visionTestResult.success ? 'test-result--ok' : 'test-result--err'">
          <mc-icon :path="visionTestResult.success ? icons.checkCircle : icons.alertCircle" :color="visionTestResult.success ? '#07C160' : '#FA5151'" :size="32" />
          <text class="test-result__text">{{ visionTestResult.message }}</text>
        </view>

        <!-- 操作栏 -->
        <view class="action-bar">
          <button class="btn btn--ghost btn--flex" @tap="onTestVision" :disabled="testingVision">
            <mc-icon :path="icons.zap" color="#07C160" :size="28" />
            <text>{{ testingVision ? '测试中…' : '测试连接' }}</text>
          </button>
          <button class="btn btn--primary btn--flex" @tap="onSaveVision" :disabled="saving">
            <mc-icon :path="icons.save" color="#FFFFFF" :size="28" />
            <text>{{ saving ? '保存中…' : '保存配置' }}</text>
          </button>
        </view>
      </block>

      <!-- ==================== Tab 2: 文案模型 ==================== -->
      <block v-else-if="activeTab === 'writer'">
        <view class="card form-card">
          <view class="card-head">
            <view class="card-head__icon card-head__icon--blue">
              <mc-icon :path="icons.fileText" color="#10AEFF" :size="40" />
            </view>
            <view class="card-head__info">
              <text class="card-head__title">文案模型配置</text>
              <text class="card-head__desc">用于生成头像/壁纸描述文案</text>
            </view>
          </view>

          <!-- 启用开关 -->
          <view class="input-group">
            <view class="toggle-row">
              <text class="toggle-label">启用文案生成</text>
              <mc-toggle :value="writerConfig.ENABLED" @change="onWriterEnabledToggle" />
            </view>
          </view>

          <!-- API 厂商 -->
          <view class="input-group">
            <text class="input-label">API 厂商</text>
            <picker mode="selector" :range="providerLabels" :value="writerProviderIndex" @change="onWriterProviderChange">
              <view class="picker-display">
                <text class="picker-display__text">{{ providerLabels[writerProviderIndex] }}</text>
                <text class="picker-display__arrow">▾</text>
              </view>
            </picker>
          </view>

          <!-- 模型名称 -->
          <view class="input-group">
            <text class="input-label">模型名称</text>
            <picker v-if="writerModels.length > 0 && !writerUseCustomModel" mode="selector" :range="writerModelLabels" :value="writerModelIndex" @change="onWriterModelChange">
              <view class="picker-display">
                <text class="picker-display__text">{{ writerModelLabels[writerModelIndex] }}</text>
                <text class="picker-display__arrow">▾</text>
              </view>
            </picker>
            <view v-else class="custom-input-row">
              <input class="input input--mono" :value="writerConfig.MODEL" placeholder="输入模型 ID" @input="onWriterModelInput" :adjust-position="true" :cursor-spacing="20" />
              <text v-if="writerModels.length > 0" class="link-btn" @tap="onWriterUsePresetModel">使用预置列表</text>
            </view>
          </view>

          <!-- API 地址 -->
          <view class="input-group">
            <text class="input-label">API 地址（可选）</text>
            <input class="input input--mono" :value="writerConfig.API_URL" placeholder="留空使用默认地址" @input="onWriterUrlInput" :adjust-position="true" :cursor-spacing="20" />
          </view>

          <!-- API Key -->
          <view class="input-group">
            <text class="input-label">API Key</text>
            <picker v-if="writerKeyOptions.length > 0" mode="selector" :range="writerKeyOptions" range-key="name" :value="writerKeyIndex" @change="onWriterKeyPick">
              <view class="picker-row">
                <text class="picker-value">{{ writerKeyOptions[writerKeyIndex].name }} ({{ writerKeyOptions[writerKeyIndex].provider }})</text>
                <text class="picker-arrow">▾</text>
              </view>
            </picker>
            <view class="input-with-action">
              <input class="input input--mono input--flex" :value="writerConfig.API_KEY" :password="!writerKeyVisible" placeholder="输入 API Key" @input="onWriterKeyInput" :adjust-position="true" :cursor-spacing="20" />
              <view class="input-action-btn" @tap.stop="onToggleWriterKeyVisible">
                <mc-icon :path="writerKeyVisible ? icons.eyeOff : icons.eye" color="#8C8CA1" :size="36" />
              </view>
            </view>
          </view>

          <!-- 系统提示词 -->
          <view class="input-group input-group--last">
            <view class="label-row">
              <text class="input-label">文案系统提示词</text>
              <text class="link-btn" @tap="onResetWriterPrompt">恢复默认</text>
            </view>
            <textarea
              class="input textarea textarea--lg"
              :value="writerConfig.SYSTEM_PROMPT"
              placeholder="定义文案生成的角色、风格和输出要求"
              @input="onWriterPromptInput" :adjust-position="true" :cursor-spacing="20"
              :maxlength="-1"
            />
          </view>
        </view>

        <!-- 测试结果 -->
        <view v-if="writerTestResult" class="test-result" :class="writerTestResult.success ? 'test-result--ok' : 'test-result--err'">
          <mc-icon :path="writerTestResult.success ? icons.checkCircle : icons.alertCircle" :color="writerTestResult.success ? '#07C160' : '#FA5151'" :size="32" />
          <text class="test-result__text">{{ writerTestResult.message }}</text>
        </view>

        <!-- 操作栏 -->
        <view class="action-bar">
          <button class="btn btn--ghost btn--flex" @tap="onTestWriter" :disabled="testingWriter">
            <mc-icon :path="icons.zap" color="#07C160" :size="28" />
            <text>{{ testingWriter ? '测试中…' : '测试连接' }}</text>
          </button>
          <button class="btn btn--primary btn--flex" @tap="onSaveWriter" :disabled="saving">
            <mc-icon :path="icons.save" color="#FFFFFF" :size="28" />
            <text>{{ saving ? '保存中…' : '保存配置' }}</text>
          </button>
        </view>
      </block>

      <!-- ==================== Tab 3: API Key ==================== -->
      <block v-else-if="activeTab === 'keys'">
        <view class="section-head">
          <text class="section-title">API Key 管理</text>
        </view>

        <block v-if="keys.length > 0">
          <view v-for="item in keys" :key="item._id" class="card key-card">
            <view class="key-card__head">
              <text class="key-card__name text-ellipsis">{{ item.name }}</text>
              <view class="badge badge--blue">{{ item.provider }}</view>
            </view>
            <view class="key-card__value-row">
              <text class="key-card__value text-ellipsis">{{ visibleKeys[item._id] ? item.key : item.maskedKey }}</text>
              <view class="icon-btn icon-btn--sm" @tap.stop="onToggleKeyVisible(item._id)">
                <mc-icon :path="visibleKeys[item._id] ? icons.eyeOff : icons.eye" color="#8C8CA1" :size="28" />
              </view>
            </view>
            <view v-if="item.notes" class="key-card__notes text-ellipsis">{{ item.notes }}</view>
            <view class="key-card__footer">
              <view v-if="item.createdAtText" class="key-card__time">{{ item.createdAtText }}</view>
              <view class="icon-row">
                <view class="icon-btn" @tap="onCopyKey(item._id)">
                  <mc-icon :path="icons.copy" color="#8C8CA1" :size="32" />
                </view>
                <view class="icon-btn" @tap="onEditKey(item._id)">
                  <mc-icon :path="icons.edit" color="#10AEFF" :size="32" />
                </view>
                <view class="icon-btn" @tap="onDeleteKey(item._id)">
                  <mc-icon :path="icons.trash" color="#FA5151" :size="32" />
                </view>
              </view>
            </view>
          </view>
        </block>

        <view v-else class="empty-state">
          <mc-icon :path="icons.key" color="#B8B8C8" :size="120" />
          <text class="empty-state__text">暂无 API Key</text>
          <view class="empty-state__action">
            <button class="btn btn--primary btn--sm" @tap="onShowAddKey">添加第一个 Key</button>
          </view>
        </view>
      </block>

      <!-- ==================== Tab 4: 标签白名单 ==================== -->
      <block v-else-if="activeTab === 'whitelist'">
        <mc-seg
          class="wl-seg"
          :options="[{ label: '主分类白名单', value: 'categories' }, { label: '标签白名单', value: 'tags' }]"
          :model-value="whitelistSegment"
          @change="onWhitelistSegmentChange"
        />

        <!-- 分类白名单 -->
        <view v-if="whitelistSegment === 'categories'" class="card wl-card">
          <view class="card-head">
            <view class="card-head__icon card-head__icon--green">
              <mc-icon :path="icons.tag" color="#07C160" :size="40" />
            </view>
            <view class="card-head__info">
              <text class="card-head__title">主分类白名单</text>
              <text class="card-head__desc">AI 识别结果必须包含在此列表中</text>
            </view>
          </view>
          <textarea
            class="input textarea textarea--lg"
            :value="whitelistData.categoriesStr"
            placeholder="分类1, 分类2, 分类3..."
            @input="onCategoriesInput" :adjust-position="true" :cursor-spacing="20"
            :maxlength="-1"
          />
          <view class="tag-preview">
            <view v-for="c in whitelistData.categoriesList" :key="c" class="tag-preview__item tag-preview__item--blue">{{ c }}</view>
            <text class="tag-preview__count">共 {{ whitelistData.categoriesList.length }} 个</text>
          </view>
          <view class="action-bar">
            <button class="btn btn--primary btn--block" @tap="onSaveCategories" :disabled="saving">
              <mc-icon :path="icons.save" color="#FFFFFF" :size="28" />
              <text>{{ saving ? '保存中…' : '保存分类' }}</text>
            </button>
          </view>
        </view>

        <!-- 标签白名单 -->
        <view v-else class="card wl-card">
          <view class="card-head">
            <view class="card-head__icon card-head__icon--blue">
              <mc-icon :path="icons.tag" color="#10AEFF" :size="40" />
            </view>
            <view class="card-head__info">
              <text class="card-head__title">标签白名单</text>
              <text class="card-head__desc">用于规范 AI 输出的标签</text>
            </view>
          </view>
          <textarea
            class="input textarea textarea--lg"
            :value="whitelistData.tagsStr"
            placeholder="标签1, 标签2, 标签3..."
            @input="onTagsInput" :adjust-position="true" :cursor-spacing="20"
            :maxlength="-1"
          />
          <view class="tag-preview">
            <view v-for="t in whitelistData.tagsList" :key="t" class="tag-preview__item">{{ t }}</view>
            <text class="tag-preview__count">共 {{ whitelistData.tagsList.length }} 个</text>
          </view>
          <view class="action-bar">
            <button class="btn btn--primary btn--block" @tap="onSaveTags" :disabled="saving">
              <mc-icon :path="icons.save" color="#FFFFFF" :size="28" />
              <text>{{ saving ? '保存中…' : '保存标签' }}</text>
            </button>
          </view>
        </view>
      </block>
    </block>

    <!-- FAB 添加按钮 -->
    <view v-if="!loading" class="fab" @tap="onShowAddKey">
      <mc-icon :path="icons.plus" color="#FFFFFF" :size="44" />
    </view>
  </view>

  <!-- ==================== API Key 弹层（底部 sheet） ==================== -->
  <view v-if="keyModalVisible" class="modal-mask" @tap="onKeyModalMaskTap" @touchmove.stop>
    <view class="modal-sheet" @tap.stop @touchmove.stop>
      <view class="modal-header">
        <text class="modal-title">{{ editingKey ? '编辑 API Key' : '添加 API Key' }}</text>
        <view class="modal-close" @tap="onHideKeyModal()">
          <mc-icon :path="icons.x" color="#8C8CA1" :size="32" />
        </view>
      </view>

      <scroll-view class="modal-body" scroll-y :show-scrollbar="false">
        <view class="input-group">
          <text class="input-label">Key 名称<text class="req-star">*</text></text>
          <input class="input" :value="keyForm.name" placeholder="如：通义千问-生产环境"
            @input="onKeyNameInput" :adjust-position="true" :cursor-spacing="120" />
        </view>

        <view class="input-group">
          <text class="input-label">服务商</text>
          <picker mode="selector" :range="keyProviders" :value="keyProviderIndex" @change="onKeyProviderChange">
            <view class="picker-display">
              <text class="picker-display__text">{{ keyProviders[keyProviderIndex] }}</text>
              <text class="picker-display__arrow">▾</text>
            </view>
          </picker>
        </view>

        <view class="input-group">
          <text class="input-label">API Key<text class="req-star">*</text></text>
          <input class="input input--mono" :value="keyForm.key" placeholder="sk-..."
            @input="onKeyInput" :adjust-position="true" :cursor-spacing="120" />
        </view>

        <view class="input-group input-group--last">
          <text class="input-label">备注（可选）</text>
          <textarea class="input textarea" :value="keyForm.notes" placeholder="添加备注信息..."
            @input="onKeyNotesInput" :adjust-position="true" :cursor-spacing="120" auto-height />
        </view>
      </scroll-view>

      <view class="modal-footer">
        <button class="btn btn--default" @tap="onHideKeyModal()">取消</button>
        <button class="btn btn--primary" @tap="onSaveKey" :disabled="saving">{{ saving ? '保存中…' : (editingKey ? '更新' : '添加') }}</button>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api'
import { toast, showLoading, hideLoading, confirm, formatTime } from '../../utils/format'
import cache from '../../utils/cache'
import { getCloud } from '../../utils/cloud'

const CACHE_KEY_ALL = 'cache:ai-config:all:v2'

// ── 常量定义 ──
const PROVIDERS = [
  { value: 'volcengine', label: '火山方舟(豆包)' },
  { value: 'aliyun', label: '阿里云百炼' },
  { value: 'zhipu', label: '智谱AI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'moonshot', label: 'Moonshot(Kimi)' },
  { value: 'lingyi', label: '零一万物' },
  { value: 'hunyuan', label: '腾讯混元' },
  { value: 'qianfan', label: '百度千帆' },
  { value: 'xiaomi', label: '小米(MiMo)' },
]

const PROVIDER_LABELS = PROVIDERS.map((p) => p.label)

const DEFAULT_API_URLS = {
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  deepseek: 'https://api.deepseek.com/anthropic',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
  lingyi: 'https://api.lingyiwanwu.com/v1/chat/completions',
  hunyuan: 'https://tokenhub.tencentmaas.com/v1/chat/completions',
  qianfan: 'https://qianfan.baidubce.com/v2/chat/completions',
  xiaomi: 'https://api.xiaomimimo.com/v1/chat/completions',
}

const VISION_MODELS = {
  volcengine: [
    { id: 'doubao-seed-2-1-pro-260628', name: 'Doubao-Seed-2.1-Pro' },
    { id: 'doubao-seed-2-1-turbo-260628', name: 'Doubao-Seed-2.1-Turbo' },
    { id: 'doubao-seedance-2-0-260128', name: 'Doubao-Seedance-2.0' },
    { id: 'doubao-seed-2-0-lite-260428', name: 'Doubao-Seed-2.0-Lite' },
    { id: 'doubao-seed-2-0-mini-260428', name: 'Doubao-Seed-2.0-Mini' },
  ],
  aliyun: [
    { id: 'qwen3-vl-plus', name: 'Qwen3-VL-Plus (闭源多模态)' },
    { id: 'qwen3-vl-flash', name: 'Qwen3-VL-Flash (低成本多模态)' },
  ],
  zhipu: [
    { id: 'glm-4v', name: 'GLM-4V' },
    { id: 'glm-4v-plus', name: 'GLM-4V-Plus' },
    { id: 'glm-4v-flash', name: 'GLM-4V-Flash' },
  ],
  deepseek: [
    { id: 'deepseek-vl2', name: 'DeepSeek-VL2' },
    { id: 'deepseek-chat', name: 'DeepSeek-Chat(多模态)' },
  ],
  moonshot: [
    { id: 'moonshot-v1-8k-vision-preview', name: 'Moonshot-V1-8K-Vision' },
    { id: 'moonshot-v1-32k-vision-preview', name: 'Moonshot-V1-32K-Vision' },
  ],
  lingyi: [
    { id: 'yi-vision', name: 'Yi-Vision' },
    { id: 'yi-vision-plus', name: 'Yi-Vision-Plus' },
  ],
  hunyuan: [
    { id: 'glm-5v-turbo', name: 'GLM-5V-Turbo' },
    { id: 'hy3', name: 'HY3' },
    { id: 'minimax-m3', name: 'MiniMax-M3' },
    { id: 'kimi-k2.7-code-highspeed', name: 'Kimi-K2.7-Code-Highspeed' },
  ],
  qianfan: [
    { id: 'ernie-4.5-vl-preview', name: 'ERNIE-4.5-VL' },
    { id: 'ernie-4-vl-turbo', name: 'ERNIE-4-VL-Turbo' },
  ],
  xiaomi: [
    { id: 'mimo-v2.5-pro', name: 'MiMo-V2.5-Pro' },
    { id: 'mimo-v2.5', name: 'MiMo-V2.5' },
  ],
}

const TEXT_MODELS = {
  volcengine: [
    { id: 'doubao-seed-2-1-pro-260628', name: 'Doubao-Seed-2.1-Pro' },
    { id: 'doubao-seed-2-1-turbo-260628', name: 'Doubao-Seed-2.1-Turbo' },
    { id: 'doubao-seedance-2-0-260128', name: 'Doubao-Seedance-2.0' },
    { id: 'doubao-seed-2-0-lite-260428', name: 'Doubao-Seed-2.0-Lite' },
    { id: 'doubao-seed-2-0-mini-260428', name: 'Doubao-Seed-2.0-Mini' },
  ],
  aliyun: [
    { id: 'qwen3.7-plus', name: 'Qwen3.7-Plus' },
    { id: 'qwen3-plus', name: 'Qwen3-Plus' },
    { id: 'qwen3-turbo', name: 'Qwen3-Turbo' },
    { id: 'qwen-turbo', name: 'Qwen-Turbo' },
    { id: 'qwen-max', name: 'Qwen-Max' },
  ],
  zhipu: [
    { id: 'glm-4-flash', name: 'GLM-4-Flash' },
    { id: 'glm-4-plus', name: 'GLM-4-Plus' },
    { id: 'glm-4', name: 'GLM-4' },
  ],
  deepseek: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
    { id: 'deepseek-chat', name: 'DeepSeek-Chat(V3)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-Reasoner(R1)' },
  ],
  moonshot: [
    { id: 'kimi-k2.6', name: 'Kimi K2.6' },
    { id: 'moonshot-v1-8k', name: 'Moonshot-V1-8K' },
    { id: 'moonshot-v1-32k', name: 'Moonshot-V1-32K' },
    { id: 'moonshot-v1-128k', name: 'Moonshot-V1-128K' },
  ],
  lingyi: [
    { id: 'yi-turbo', name: 'Yi-Turbo' },
    { id: 'yi-plus', name: 'Yi-Plus' },
    { id: 'yi-large', name: 'Yi-Large' },
  ],
  hunyuan: [
    { id: 'hy3', name: 'HY3' },
    { id: 'minimax-m3', name: 'MiniMax-M3' },
    { id: 'kimi-k2.7-code-highspeed', name: 'Kimi-K2.7-Code-Highspeed' },
  ],
  qianfan: [
    { id: 'ernie-4.5-turbo', name: 'ERNIE-4.5-Turbo' },
    { id: 'ernie-4-turbo', name: 'ERNIE-4-Turbo' },
    { id: 'ernie-3.5-8k', name: 'ERNIE-3.5-8K' },
  ],
  xiaomi: [
    { id: 'mimo-v2.5-pro', name: 'MiMo-V2.5-Pro' },
    { id: 'mimo-v2.5', name: 'MiMo-V2.5' },
  ],
}

const KEY_PROVIDERS = ['火山方舟(豆包)', '阿里云百炼', '智谱AI', 'DeepSeek', 'Moonshot(Kimi)', '零一万物', '腾讯混元', '百度千帆', '小米(MiMo)', '其他']

const DEFAULT_WRITER_PROMPT = '你是一个专业的文案创作者,擅长为头像和壁纸作品生成吸引人的描述文案。请根据用户描述生成简洁、有创意的文案。'

const DEFAULT_VISION_PROMPT = '# 图片识别与分类任务\n\n## 任务目标\n请你作为专业的图片内容分析引擎,对用户上传的图片进行自动分类并生成描述性标签。\n\n## 核心处理流程\n1. 判断图片用途类型(壁纸 or 头像)\n2. 根据类型进行主分类与打标\n3. 输出 JSON 格式结果'

const TABS = [
  { id: 'vision', label: '视觉模型' },
  { id: 'writer', label: '文案模型' },
  { id: 'keys', label: 'API Key' },
  { id: 'whitelist', label: '白名单' },
]

const CUSTOM_MODEL_OPTION = { id: '__custom__', name: '✎ 自定义输入模型...' }

function providerIndexByValue(value) {
  const idx = PROVIDERS.findIndex((p) => p.value === value)
  return idx >= 0 ? idx : 0
}

function modelIndexByValue(models, value) {
  if (!models || !models.length || !value) return 0
  const idx = models.findIndex((m) => m.id === value)
  return idx >= 0 ? idx : 0
}

function keyProviderIndex(name) {
  const idx = KEY_PROVIDERS.indexOf(name)
  return idx >= 0 ? idx : KEY_PROVIDERS.length - 1
}

function getModelsByProvider(providerValue, type) {
  const map = type === 'vision' ? VISION_MODELS : TEXT_MODELS
  return map[providerValue] || []
}

function modelsToLabels(models) {
  return (models || []).map((m) => m.name)
}

function buildDisplayModels(presetModels) {
  if (!presetModels || presetModels.length === 0) return []
  return presetModels.concat([CUSTOM_MODEL_OPTION])
}

function isInPresetModels(presetModels, modelValue) {
  if (!presetModels || !modelValue) return false
  return presetModels.some((m) => m.id === modelValue)
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

function parseList(str) {
  if (!str) return []
  return str.split(/[,，\n]/).map((s) => s.trim()).filter((s) => s)
}

const SVG = {
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/>',
}

export default {
  data() {
    return {
      loading: true,
      activeTab: 'vision',
      tabs: TABS,
      loadError: false,
      errorMsg: '',

      visionConfig: {
        PROVIDER: '',
        MODEL: '',
        API_URL: '',
        API_KEY: '',
        SYSTEM_PROMPT: '',
        AUTO_RECOGNIZE: true,
        AUTO_APPLY: false,
      },
      visionProviderIndex: 0,
      visionModels: [],
      visionModelLabels: [],
      visionModelIndex: 0,
      visionUseCustomModel: false,
      testingVision: false,
      visionTestResult: null,

      writerConfig: {
        PROVIDER: 'aliyun',
        MODEL: 'qwen-turbo',
        API_URL: '',
        API_KEY: '',
        SYSTEM_PROMPT: DEFAULT_WRITER_PROMPT,
        ENABLED: true,
      },
      writerProviderIndex: 1,
      writerModels: [],
      writerModelLabels: [],
      writerModelIndex: 0,
      writerUseCustomModel: false,
      testingWriter: false,
      writerTestResult: null,

      keys: [],
      keyOptions: [],
      visionKeyIndex: 0,
      writerKeyIndex: 0,
      visionKeyOptions: [],
      writerKeyOptions: [],
      visionKeyVisible: false,
      writerKeyVisible: false,
      visibleKeys: {},
      keyModalVisible: false,
      editingKey: null,
      keyForm: { name: '', provider: '火山方舟(豆包)', key: '', notes: '' },
      keyProviderIndex: 0,

      whitelistSegment: 'categories',
      whitelistData: {
        categoriesStr: '',
        tagsStr: '',
        categoriesList: [],
        tagsList: [],
      },

      saving: false,

      providers: PROVIDERS,
      providerLabels: PROVIDER_LABELS,
      keyProviders: KEY_PROVIDERS,

      statusDots: {
        vision: false,
        writer: false,
        keys: false,
        whitelist: false,
      },

      icons: SVG,
    }
  },

  async onLoad(options) {
    if (options && options.tab) {
      this.activeTab = options.tab
    }
    const cached = cache.getCachedStale(CACHE_KEY_ALL)
    if (cached) {
      Object.assign(this, cached)
      this.computeStatusDots()
      this.syncKeyIndices()
      this.refreshVisionModels()
      this.refreshWriterModels()
      this.loading = false
    }
    // 必须等云开发初始化完成，否则 callFunction 会失败
    await getCloud()
    if (cache.isStale(CACHE_KEY_ALL)) this.loadAll()
  },

  onPullDownRefresh() {
    this.loadAll(true).finally(function () { uni.stopPullDownRefresh() })
  },

  methods: {
    onTabChange(tab) {
      if (!tab || tab === this.activeTab) return
      this.activeTab = tab
    },

    refreshVisionModels() {
      const provider = PROVIDERS[this.visionProviderIndex]
      if (!provider) return
      const presetModels = getModelsByProvider(provider.value, 'vision')
      const currentModel = this.visionConfig.MODEL
      const useCustom = currentModel
        ? !isInPresetModels(presetModels, currentModel)
        : presetModels.length === 0
      const displayModels = buildDisplayModels(presetModels)
      this.visionModels = displayModels
      this.visionModelLabels = modelsToLabels(displayModels)
      this.visionModelIndex = useCustom ? displayModels.length : modelIndexByValue(presetModels, currentModel)
      this.visionUseCustomModel = useCustom
    },

    refreshWriterModels() {
      const provider = PROVIDERS[this.writerProviderIndex]
      if (!provider) return
      const presetModels = getModelsByProvider(provider.value, 'text')
      const currentModel = this.writerConfig.MODEL
      const useCustom = currentModel
        ? !isInPresetModels(presetModels, currentModel)
        : presetModels.length === 0
      const displayModels = buildDisplayModels(presetModels)
      this.writerModels = displayModels
      this.writerModelLabels = modelsToLabels(displayModels)
      this.writerModelIndex = useCustom ? displayModels.length : modelIndexByValue(presetModels, currentModel)
      this.writerUseCustomModel = useCustom
    },

    async loadAll(forceLoading) {
      const hasData = !!(this.visionConfig.MODEL || this.keys.length)
      const shouldShowLoading = forceLoading !== undefined ? forceLoading : !hasData
      if (shouldShowLoading) { this.loading = true; this.loadError = false }
      try {
        const results = await Promise.allSettled([
          this.loadVision(),
          this.loadWriter(),
          this.loadKeys(),
          this.loadWhitelist(),
        ])
        const hasFailure = results.some((r) => r.status === 'rejected')
        if (hasFailure && shouldShowLoading) {
          const rejected = results.find((r) => r.status === 'rejected')
          console.error('[ai-config] 部分加载失败', rejected && rejected.reason)
          this.loadError = true
          this.errorMsg = '部分配置加载失败，请下拉重试'
        }
        this.computeStatusDots()
        this.syncKeyIndices()
        // App 端 storage 是 uni 原生加密持久化，直接保存 API_KEY 可用于回填
        // 小程序/Web 端如担心安全可在此处清空，但会失去回填体验
        cache.setCached(CACHE_KEY_ALL, {
          visionConfig: Object.assign({}, this.visionConfig),
          writerConfig: Object.assign({}, this.writerConfig),
          keys: (this.keys || []).map((k) => Object.assign({}, k)),
          keyOptions: this.keyOptions,
          whitelistData: this.whitelistData,
          visionProviderIndex: this.visionProviderIndex,
          writerProviderIndex: this.writerProviderIndex,
        })
      } catch (err) {
        console.error('[ai-config] 加载失败', err)
        if (shouldShowLoading) {
          this.loadError = true
          this.errorMsg = err.message || '加载失败，请稍后重试'
          toast('加载失败，下拉重试')
        }
      } finally {
        if (shouldShowLoading) this.loading = false
      }
    },

    retryLoad() {
      this.loadAll()
    },

    computeStatusDots() {
      const v = this.visionConfig
      const w = this.writerConfig
      const wl = this.whitelistData
      this.statusDots = {
        vision: !!(v.MODEL && v.API_KEY),
        writer: !!(w.MODEL),
        keys: this.keys.length > 0,
        whitelist: !!(wl.categoriesList.length > 0 && wl.tagsList.length > 0),
      }
    },

    // ── Tab 1: 视觉模型 ──
    async loadVision() {
      try {
        const cfg = await api.getAIConfig()
        if (cfg && cfg.MODEL) {
          const prompt = cfg.SYSTEM_PROMPT || DEFAULT_VISION_PROMPT
          this.visionConfig = {
            PROVIDER: cfg.PROVIDER || '',
            MODEL: cfg.MODEL || '',
            API_URL: cfg.API_URL || '',
            API_KEY: cfg.API_KEY || '',
            SYSTEM_PROMPT: prompt,
            AUTO_RECOGNIZE: cfg.AUTO_RECOGNIZE !== false,
            AUTO_APPLY: cfg.AUTO_APPLY === true,
          }
          this.visionProviderIndex = providerIndexByValue(cfg.PROVIDER)
        } else {
          this.visionConfig.SYSTEM_PROMPT = DEFAULT_VISION_PROMPT
          this.visionProviderIndex = 0
        }
        this.refreshVisionModels()
      } catch (err) {
        console.error('[ai-config] 加载视觉配置失败', err)
      }
    },

    onVisionProviderChange(e) {
      const idx = Number(e.detail.value)
      const provider = PROVIDERS[idx]
      const defaultUrl = DEFAULT_API_URLS[provider.value] || ''
      const presetModels = getModelsByProvider(provider.value, 'vision')
      const displayModels = buildDisplayModels(presetModels)
      const useCustom = presetModels.length === 0
      const matchedKey = (this.keys || []).find((k) => k.provider === provider.label)
      const firstKey = matchedKey ? matchedKey.key : ''
      this.visionProviderIndex = idx
      this.visionConfig.PROVIDER = provider.value
      this.visionConfig.API_URL = defaultUrl
      this.visionConfig.MODEL = ''
      this.visionConfig.API_KEY = firstKey
      this.visionModels = displayModels
      this.visionModelLabels = modelsToLabels(displayModels)
      this.visionModelIndex = 0
      this.visionUseCustomModel = useCustom
      this.visionTestResult = null
      this.syncKeyIndices()
    },

    onVisionModelChange(e) {
      const idx = Number(e.detail.value)
      const models = this.visionModels
      const model = models[idx]
      if (!model) return
      if (model.id === '__custom__') {
        this.visionModelIndex = idx
        this.visionUseCustomModel = true
        this.visionTestResult = null
        return
      }
      this.visionModelIndex = idx
      this.visionConfig.MODEL = model.id
      this.visionUseCustomModel = false
      this.visionTestResult = null
    },

    onVisionUsePresetModel() {
      const presetCount = this.visionModels.length - 1
      if (presetCount <= 0) {
        toast('当前厂商无预置模型')
        return
      }
      this.visionUseCustomModel = false
      this.visionConfig.MODEL = ''
      this.visionModelIndex = 0
      this.visionTestResult = null
    },

    onVisionModelInput(e) {
      this.visionConfig.MODEL = e.detail.value
      this.visionTestResult = null
    },

    onVisionUrlInput(e) {
      this.visionConfig.API_URL = e.detail.value
    },

    onVisionKeyInput(e) {
      this.visionConfig.API_KEY = e.detail.value
    },

    onVisionKeyPick(e) {
      const idx = Number(e.detail.value)
      const key = this.visionKeyOptions[idx]
      if (key) {
        this.visionKeyIndex = idx
        this.visionConfig.API_KEY = key.key
      }
    },

    onToggleVisionKeyVisible() {
      this.visionKeyVisible = !this.visionKeyVisible
    },

    onVisionPromptInput(e) {
      this.visionConfig.SYSTEM_PROMPT = e.detail.value
    },

    onAutoRecognizeToggle(val) {
      this.visionConfig.AUTO_RECOGNIZE = val
    },

    onAutoApplyToggle(val) {
      this.visionConfig.AUTO_APPLY = val
    },

    onResetVisionPrompt() {
      this.visionConfig.SYSTEM_PROMPT = DEFAULT_VISION_PROMPT
      toast('已恢复默认提示词')
    },

    async onSaveVision() {
      const cfg = this.visionConfig
      if (!cfg.MODEL.trim()) { toast('请选择或输入模型名称'); return }
      if (!cfg.API_KEY.trim()) { toast('请填写 API Key'); return }
      if (!cfg.API_URL.trim()) { toast('请填写 API 地址'); return }
      this.saving = true
      showLoading('保存中…')
      try {
        await api.updateAIConfig({
          PROVIDER: cfg.PROVIDER || '',
          MODEL: cfg.MODEL.trim(),
          API_URL: cfg.API_URL.trim(),
          API_KEY: cfg.API_KEY.trim(),
          SYSTEM_PROMPT: cfg.SYSTEM_PROMPT || '',
          AUTO_RECOGNIZE: cfg.AUTO_RECOGNIZE !== false,
          AUTO_APPLY: cfg.AUTO_APPLY === true,
        })
        hideLoading()
        toast('保存成功', 'success')
        this.computeStatusDots()
        cache.clearCached(CACHE_KEY_ALL)
      } catch (err) {
        console.error('[ai-config] 保存视觉配置失败', err)
        hideLoading()
        toast(err.message || '保存失败')
      } finally {
        this.saving = false
      }
    },

    async onTestVision() {
      if (this.testingVision) return
      const cfg = this.visionConfig
      if (!cfg.API_URL.trim() || !cfg.API_KEY.trim() || !cfg.MODEL.trim()) {
        toast('请先填写地址、Key 和模型')
        return
      }
      this.testingVision = true
      this.visionTestResult = null
      showLoading('测试连接中…')
      try {
        // 注意：本项目已移除面向用户的 AI 内容生成能力，此处仅保留管理员对模型连通性的验证调用，未新增任何 AI 生成调用。
        const raw = await api.testAiConnection({
          API_URL: cfg.API_URL.trim(),
          API_KEY: cfg.API_KEY.trim(),
          MODEL: cfg.MODEL.trim(),
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        })
        const result = (raw && raw.result) ? raw.result : raw
        this.visionTestResult = {
          success: !!(result && result.success),
          message: (result && result.message) || (result && result.success ? '连接正常' : '连接失败'),
        }
        hideLoading()
        if (result && result.success) {
          toast('连接正常', 'success')
        } else {
          toast((result && result.message) || '连接失败')
        }
      } catch (err) {
        console.error('[ai-config] 视觉测试失败', err)
        hideLoading()
        this.visionTestResult = { success: false, message: err.message || '调用失败' }
        toast(err.message || '连接失败')
      } finally {
        this.testingVision = false
      }
    },

    // ── Tab 2: 文案模型 ──
    async loadWriter() {
      try {
        const cfg = await api.getAIWriterConfig()
        if (cfg && (cfg.MODEL || cfg.PROVIDER)) {
          this.writerConfig = {
            PROVIDER: cfg.PROVIDER || 'aliyun',
            MODEL: cfg.MODEL || 'qwen-turbo',
            API_URL: cfg.API_URL || '',
            API_KEY: cfg.API_KEY || '',
            SYSTEM_PROMPT: cfg.SYSTEM_PROMPT || DEFAULT_WRITER_PROMPT,
            ENABLED: cfg.ENABLED !== false,
          }
          this.writerProviderIndex = providerIndexByValue(cfg.PROVIDER || 'aliyun')
        } else {
          this.writerConfig.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT
          this.writerProviderIndex = providerIndexByValue('aliyun')
        }
        this.refreshWriterModels()
      } catch (err) {
        console.error('[ai-config] 加载文案配置失败', err)
      }
    },

    onWriterProviderChange(e) {
      const idx = Number(e.detail.value)
      const provider = PROVIDERS[idx]
      const defaultUrl = DEFAULT_API_URLS[provider.value] || ''
      const presetModels = getModelsByProvider(provider.value, 'text')
      const displayModels = buildDisplayModels(presetModels)
      const useCustom = presetModels.length === 0
      const matchedKey = (this.keys || []).find((k) => k.provider === provider.label)
      const firstKey = matchedKey ? matchedKey.key : ''
      this.writerProviderIndex = idx
      this.writerConfig.PROVIDER = provider.value
      this.writerConfig.API_URL = defaultUrl
      this.writerConfig.MODEL = ''
      this.writerConfig.API_KEY = firstKey
      this.writerModels = displayModels
      this.writerModelLabels = modelsToLabels(displayModels)
      this.writerModelIndex = 0
      this.writerUseCustomModel = useCustom
      this.writerTestResult = null
      this.syncKeyIndices()
    },

    onWriterModelChange(e) {
      const idx = Number(e.detail.value)
      const models = this.writerModels
      const model = models[idx]
      if (!model) return
      if (model.id === '__custom__') {
        this.writerModelIndex = idx
        this.writerUseCustomModel = true
        this.writerTestResult = null
        return
      }
      this.writerModelIndex = idx
      this.writerConfig.MODEL = model.id
      this.writerUseCustomModel = false
      this.writerTestResult = null
    },

    onWriterUsePresetModel() {
      const presetCount = this.writerModels.length - 1
      if (presetCount <= 0) {
        toast('当前厂商无预置模型')
        return
      }
      this.writerUseCustomModel = false
      this.writerConfig.MODEL = ''
      this.writerModelIndex = 0
      this.writerTestResult = null
    },

    onWriterModelInput(e) {
      this.writerConfig.MODEL = e.detail.value
      this.writerTestResult = null
    },

    onWriterUrlInput(e) {
      this.writerConfig.API_URL = e.detail.value
    },

    onWriterKeyInput(e) {
      this.writerConfig.API_KEY = e.detail.value
    },

    onWriterKeyPick(e) {
      const idx = Number(e.detail.value)
      const key = this.writerKeyOptions[idx]
      if (key) {
        this.writerKeyIndex = idx
        this.writerConfig.API_KEY = key.key
      }
    },

    onToggleWriterKeyVisible() {
      this.writerKeyVisible = !this.writerKeyVisible
    },

    onWriterPromptInput(e) {
      this.writerConfig.SYSTEM_PROMPT = e.detail.value
    },

    onWriterEnabledToggle(val) {
      this.writerConfig.ENABLED = val
    },

    onResetWriterPrompt() {
      this.writerConfig.SYSTEM_PROMPT = DEFAULT_WRITER_PROMPT
      toast('已恢复默认提示词')
    },

    async onSaveWriter() {
      const cfg = this.writerConfig
      if (!cfg.MODEL.trim()) { toast('请选择或输入模型名称'); return }
      if (!cfg.SYSTEM_PROMPT.trim() || cfg.SYSTEM_PROMPT.trim().length < 10) {
        toast('系统提示词至少需要 10 个字符')
        return
      }
      this.saving = true
      showLoading('保存中…')
      try {
        await api.updateAIWriterConfig({
          SYSTEM_PROMPT: cfg.SYSTEM_PROMPT || '',
          PROVIDER: cfg.PROVIDER || 'aliyun',
          MODEL: cfg.MODEL.trim(),
          API_URL: cfg.API_URL || '',
          API_KEY: cfg.API_KEY || '',
          ENABLED: cfg.ENABLED !== false,
        })
        hideLoading()
        toast('保存成功', 'success')
        this.computeStatusDots()
        cache.clearCached(CACHE_KEY_ALL)
      } catch (err) {
        console.error('[ai-config] 保存文案配置失败', err)
        hideLoading()
        toast(err.message || '保存失败')
      } finally {
        this.saving = false
      }
    },

    async onTestWriter() {
      if (this.testingWriter) return
      const cfg = this.writerConfig
      const apiUrl = cfg.API_URL.trim() || DEFAULT_API_URLS[cfg.PROVIDER] || ''
      if (!apiUrl || !cfg.API_KEY.trim() || !cfg.MODEL.trim()) {
        toast('请先配置地址、Key 和模型')
        return
      }
      this.testingWriter = true
      this.writerTestResult = null
      showLoading('测试连接中…')
      try {
        // 注意：仅保留管理员对模型连通性的验证调用，未新增任何 AI 生成调用。
        const raw = await api.testAiConnection({
          API_URL: apiUrl,
          API_KEY: cfg.API_KEY.trim(),
          MODEL: cfg.MODEL.trim(),
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10,
        })
        const result = (raw && raw.result) ? raw.result : raw
        this.writerTestResult = {
          success: !!(result && result.success),
          message: (result && result.message) || (result && result.success ? '连接正常' : '连接失败'),
        }
        hideLoading()
        if (result && result.success) {
          toast('连接正常', 'success')
        } else {
          toast((result && result.message) || '连接失败')
        }
      } catch (err) {
        console.error('[ai-config] 文案测试失败', err)
        hideLoading()
        this.writerTestResult = { success: false, message: err.message || '调用失败' }
        toast(err.message || '连接失败')
      } finally {
        this.testingWriter = false
      }
    },

    // ── Tab 3: API Key ──
    async loadKeys() {
      try {
        const list = await api.getApiKeys()
        const keys = (list || []).map((k) => this.formatKey(k))
        const keyOptions = keys.map((k) => k.name + ' (' + k.provider + ')')
        this.keys = keys
        this.keyOptions = keyOptions
        this.syncKeyIndices()
      } catch (err) {
        console.error('[ai-config] 加载 API Keys 失败', err)
      }
    },

    syncKeyIndices() {
      const keys = this.keys || []
      const visionKey = this.visionConfig.API_KEY
      const writerKey = this.writerConfig.API_KEY
      let visionIdx = 0
      let writerIdx = 0
      keys.forEach((k, i) => {
        if (visionKey && k.key === visionKey) visionIdx = i
        if (writerKey && k.key === writerKey) writerIdx = i
      })
      this.visionKeyOptions = keys
      this.writerKeyOptions = keys
      this.visionKeyIndex = visionIdx
      this.writerKeyIndex = writerIdx
    },

    formatKey(k) {
      const raw = k.key || k.apiKey || ''
      return {
        _id: k._id || k.id || '',
        name: k.name || k.label || '未命名',
        provider: k.provider || '其他',
        key: raw,
        maskedKey: maskKey(raw),
        notes: k.notes || '',
        createdAtText: k.createdAt ? formatTime(k.createdAt) : '',
      }
    },

    onShowAddKey() {
      this.keyModalVisible = true
      this.editingKey = null
      this.keyFormDirty = false
      this.keyForm = { name: '', provider: '火山方舟(豆包)', key: '', notes: '' }
      this.keyProviderIndex = 0
    },

    onEditKey(id) {
      const item = this.keys.find((k) => k._id === id)
      if (!item) return
      this.keyModalVisible = true
      this.editingKey = item
      this.keyFormDirty = false
      this.keyForm = {
        name: item.name,
        provider: item.provider,
        key: item.key,
        notes: item.notes || '',
      }
      this.keyProviderIndex = keyProviderIndex(item.provider)
    },

    onHideKeyModal(force) {
      if (!force && this.keyFormDirty) {
        uni.showModal({
          title: '提示',
          content: '有未保存的修改，确定要关闭吗？',
          confirmText: '放弃',
          confirmColor: '#FA5151',
          success: (res) => {
            if (res.confirm) {
              this.keyModalVisible = false
              this.editingKey = null
              this.keyFormDirty = false
            }
          },
        })
      } else {
        this.keyModalVisible = false
        this.editingKey = null
        this.keyFormDirty = false
      }
    },

    onKeyModalMaskTap() {
      this.onHideKeyModal()
    },

    onKeyProviderChange(e) {
      const idx = Number(e.detail.value)
      this.keyProviderIndex = idx
      this.keyForm.provider = KEY_PROVIDERS[idx]
      this.keyFormDirty = true
    },

    onKeyNameInput(e) {
      this.keyForm.name = e.detail.value
      this.keyFormDirty = true
    },

    onKeyInput(e) {
      this.keyForm.key = e.detail.value
      this.keyFormDirty = true
    },

    onKeyNotesInput(e) {
      this.keyForm.notes = e.detail.value
      this.keyFormDirty = true
    },

    async onSaveKey() {
      const { keyForm, editingKey } = this
      if (!keyForm.name.trim()) { toast('请输入 Key 名称'); return }
      if (!keyForm.key.trim()) { toast('请输入 API Key'); return }
      this.saving = true
      showLoading(editingKey ? '更新中…' : '添加中…')
      try {
        const payload = {
          name: keyForm.name.trim(),
          provider: keyForm.provider,
          key: keyForm.key.trim(),
          notes: keyForm.notes || '',
        }
        if (editingKey) {
          await api.manageApiKey('update', { id: editingKey._id, item: payload })
        } else {
          await api.manageApiKey('create', { item: payload })
        }
        hideLoading()
        toast(editingKey ? '已更新' : '已添加', 'success')
        this.keyModalVisible = false
        this.editingKey = null
        this.saving = false
        this.keyFormDirty = false
        await this.loadKeys()
        this.computeStatusDots()
        cache.clearCached(CACHE_KEY_ALL)
      } catch (err) {
        console.error('[ai-config] 保存 Key 失败', err)
        hideLoading()
        this.saving = false
        toast(err.message || '操作失败')
      }
    },

    async onDeleteKey(id) {
      const item = this.keys.find((k) => k._id === id)
      if (!item) return
      const ok = await confirm('确定删除「' + item.name + '」？')
      if (!ok) return
      showLoading('删除中…')
      try {
        await api.manageApiKey('delete', { id: item._id })
        hideLoading()
        toast('已删除', 'success')
        await this.loadKeys()
        this.computeStatusDots()
        cache.clearCached(CACHE_KEY_ALL)
      } catch (err) {
        console.error('[ai-config] 删除 Key 失败', err)
        hideLoading()
        toast(err.message || '删除失败')
      }
    },

    onCopyKey(id) {
      const item = this.keys.find((k) => k._id === id)
      if (!item || !item.key) return
      uni.setClipboardData({
        data: item.key,
        success: function () {
          toast('已复制到剪贴板', 'success')
        },
      })
    },

    onToggleKeyVisible(id) {
      this.visibleKeys = Object.assign({}, this.visibleKeys, { [id]: !this.visibleKeys[id] })
    },

    // ── Tab 4: 标签白名单 ──
    onWhitelistSegmentChange(seg) {
      if (!seg || seg === this.whitelistSegment) return
      this.whitelistSegment = seg
    },

    async loadWhitelist() {
      try {
        const [cats, tags] = await Promise.all([
          api.getCategoriesWhitelist(),
          api.getTagsWhitelist(),
        ])
        const categoriesList = Array.isArray(cats) ? cats : []
        const tagsList = Array.isArray(tags) ? tags : []
        this.whitelistData = {
          categoriesStr: categoriesList.join(', '),
          tagsStr: tagsList.join(', '),
          categoriesList: categoriesList,
          tagsList: tagsList,
        }
      } catch (err) {
        console.error('[ai-config] 加载白名单失败', err)
      }
    },

    onCategoriesInput(e) {
      const str = e.detail.value
      const list = parseList(str)
      this.whitelistData.categoriesStr = str
      this.whitelistData.categoriesList = list
    },

    onTagsInput(e) {
      const str = e.detail.value
      const list = parseList(str)
      this.whitelistData.tagsStr = str
      this.whitelistData.tagsList = list
    },

    async onSaveCategories() {
      const list = this.whitelistData.categoriesList
      this.saving = true
      showLoading('保存中…')
      try {
        await api.saveCategoriesWhitelist(list)
        hideLoading()
        toast('分类保存成功', 'success')
        this.computeStatusDots()
        cache.clearCached(CACHE_KEY_ALL)
      } catch (err) {
        console.error('[ai-config] 保存分类失败', err)
        hideLoading()
        toast(err.message || '保存失败')
      } finally {
        this.saving = false
      }
    },

    async onSaveTags() {
      const list = this.whitelistData.tagsList
      this.saving = true
      showLoading('保存中…')
      try {
        await api.saveTagsWhitelist(list)
        hideLoading()
        toast('标签保存成功', 'success')
        this.computeStatusDots()
        cache.clearCached(CACHE_KEY_ALL)
      } catch (err) {
        console.error('[ai-config] 保存标签失败', err)
        hideLoading()
        toast(err.message || '保存失败')
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.fab-icon {
  width: 44rpx;
  height: 44rpx;
}

.ai-config-page {
  padding-bottom: 80rpx;
}

.page-head {
  padding: 12rpx 4rpx 20rpx;
}

.page-head__title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.page-head__desc {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
  line-height: 1.5;
}

/* Tab 切换 */
.tab-scroll {
  margin-bottom: 24rpx;
  white-space: nowrap;
}

.tab-bar {
  display: inline-flex;
  gap: 12rpx;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 28rpx;
  height: 80rpx;
  border-radius: var(--r-pill);
  background: var(--bg-card);
  border: 1rpx solid var(--divider);
  flex-shrink: 0;
  transition: all 0.2s;
}

.tab-item--active {
  background: var(--pri-l);
  border-color: var(--pri);
}

.tab-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
}

.tab-dot--on {
  background: var(--pri);
}

.tab-item--active .tab-dot--on {
  box-shadow: 0 0 0 6rpx rgba(7, 193, 96, 0.25);
}

.tab-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-secondary);
}

.tab-item--active .tab-label {
  color: var(--pri-d);
}

/* 卡片头部 */
.card-head {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.card-head__icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-head__icon--green {
  background: var(--pri-l);
}

.card-head__icon--blue {
  background: var(--info-l);
}

.card-head__info {
  flex: 1;
  min-width: 0;
}

.card-head__title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.card-head__desc {
  display: block;
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 2rpx;
}

/* 表单卡片 */
.form-card {
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.input-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12rpx;
  display: block;
}

.input-group--last {
  margin-bottom: 0;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.label-row .input-label {
  margin-bottom: 0;
}

.link-btn {
  font-size: 22rpx;
  color: var(--pri);
  font-weight: 500;
}

.link-btn:active {
  opacity: 0.6;
}

.input--mono {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.textarea {
  height: 160rpx;
  min-height: 160rpx;
  padding: 20rpx 24rpx;
  line-height: 1.5;
  box-sizing: border-box;
  overflow-y: auto;
}

.textarea--lg {
  height: 240rpx;
  min-height: 240rpx;
}

/* picker 展示样式 */
.picker-display {
  height: 80rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 24rpx;
  font-size: 26rpx;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.picker-display__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-display__arrow {
  font-size: 24rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-left: 12rpx;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80rpx;
  padding: 0 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  margin-bottom: 16rpx;
}

.picker-value {
  font-size: 28rpx;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-arrow {
  font-size: 24rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-left: 12rpx;
}

.input-with-action {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.input--flex {
  flex: 1;
  min-width: 0;
}

.input-action-btn {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  flex-shrink: 0;
}

.input-action-btn:active {
  background: var(--divider);
}

.custom-input-row {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.custom-input-row .input {
  width: 100%;
}

.custom-input-row .link-btn {
  align-self: flex-end;
  font-size: 22rpx;
}

/* 启用开关行 */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-label {
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 500;
}

/* AI 识别设置块 */
.ai-set {
  border-top: 1rpx dashed var(--divider);
  margin-top: 8rpx;
  padding-top: 24rpx;
}

.ai-set__title {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--pri-d);
  letter-spacing: 1rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.ai-set__icon-text {
  font-size: 24rpx;
  line-height: 1;
}

.ai-set__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  gap: 20rpx;
}

.ai-set__row-info {
  flex: 1;
  min-width: 0;
}

.ai-set__row-label {
  display: block;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--text-primary);
}

.ai-set__row-desc {
  display: block;
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

/* 测试结果 */
.test-result {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: var(--r-sm);
  margin-bottom: 20rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.test-result--ok {
  background: var(--pri-l);
  color: var(--pri-d);
}

.test-result--err {
  background: var(--danger-l);
  color: var(--danger);
}

.test-result__text {
  flex: 1;
  min-width: 0;
}

/* 操作按钮栏 */
.action-bar {
  display: flex;
  gap: 20rpx;
  margin-top: 8rpx;
}

.btn--flex {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.btn--block {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.btn-icon {
  width: 28rpx;
  height: 28rpx;
}

/* section 头部 */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 4rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

/* API Key 卡片 */
.key-card {
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
}

.key-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.key-card__name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.key-card__value-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.key-card__value {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  flex: 1;
  min-width: 0;
}

.key-card__notes {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-bottom: 16rpx;
}

.key-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--divider);
}

.key-card__time {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.icon-row {
  display: flex;
  gap: 4rpx;
}

.icon-btn {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  background: var(--divider);
  flex-shrink: 0;
}

.icon-btn:active {
  background: var(--border);
}

.icon-btn--sm {
  width: 48rpx;
  height: 48rpx;
}

/* 白名单 */
.wl-seg {
  margin-bottom: 20rpx;
}

.wl-card {
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
  align-items: center;
}

.tag-preview__item {
  padding: 8rpx 20rpx;
  border-radius: var(--r-pill);
  font-size: 22rpx;
  font-weight: 500;
  background: var(--pri-l);
  color: var(--pri-d);
}

.tag-preview__item--blue {
  background: var(--info-l);
  color: var(--info);
}

.tag-preview__count {
  font-size: 20rpx;
  color: var(--text-tertiary);
  padding: 8rpx 0;
}

/* 弹层 Modal（底部 sheet） */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.modal-sheet {
  width: 100%;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  padding: 0 0 calc(20rpx + env(safe-area-inset-bottom));
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 36rpx 24rpx;
  border-bottom: 1rpx solid var(--divider);
  flex-shrink: 0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--divider);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-close:active {
  background: var(--border);
}

.modal-body {
  flex: 1;
  height: 1px;
  min-height: 400rpx;
  padding: 28rpx 36rpx;
}

.modal-footer {
  flex-shrink: 0;
  padding: 24rpx 36rpx 0;
  border-top: 1rpx solid var(--divider);
  display: flex;
  gap: 20rpx;
}

.modal-footer .btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.req-star {
  color: var(--danger);
  margin-left: 4rpx;
}

/* 骨架屏 */
.skeleton {
  background: var(--divider);
  position: relative;
  overflow: hidden;
}

.skeleton-block {
  width: 100%;
  box-sizing: border-box;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
