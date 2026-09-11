<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="glass-panel">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="panel-title">下载管理</h2>
          <p class="panel-sub">管理用户下载行为：广告、免费次数、辣度值消耗，修改后实时生效</p>
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

    <!-- Flow Diagram + Config Form + Preview: 三栏融合 -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">

      <!-- 左侧：下载流程示意 -->
      <section class="glass-panel xl:col-span-1">
        <h3 class="text-base font-semibold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
          下载流程示意
        </h3>

        <div class="flow-container">
          <!-- Step 1: 用户点击下载 -->
          <div class="flow-node flow-start">
            <div class="flow-icon bg-blue-500/10 text-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </div>
            <span class="text-sm font-medium">用户点击下载</span>
          </div>

          <div class="flow-arrow">
            <svg class="h-4 w-4 text-[var(--text-sub)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </div>

          <!-- Step 2: 是会员？ -->
          <div class="flow-node flow-decision">
            <div class="flow-icon bg-purple-500/10 text-purple-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
            <span class="text-sm font-medium">是会员？</span>
          </div>

          <!-- Yes path -->
          <div class="flow-branch">
            <div class="flow-yes">
              <span class="flow-badge badge-green">是</span>
              <span class="text-xs text-[var(--text-sub)]">→ 直接下载</span>
            </div>
            <div class="flow-no">
              <span class="flow-badge badge-red">否</span>
              <span class="text-xs text-[var(--text-sub)]">↓</span>
            </div>
          </div>

          <div class="flow-arrow">
            <svg class="h-4 w-4 text-[var(--text-sub)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </div>

          <!-- Step 3: 广告开启？ -->
          <div class="flow-node flow-decision" v-if="config.rewardAdEnabled">
            <div class="flow-icon bg-amber-500/10 text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/>
              </svg>
            </div>
            <span class="text-sm font-medium">看激励广告</span>
          </div>

          <div class="flow-arrow" v-if="config.rewardAdEnabled">
            <svg class="h-4 w-4 text-[var(--text-sub)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </div>

          <!-- Step 4: 免费下载次数 -->
          <div class="flow-node flow-action" v-if="config.rewardAdEnabled">
            <div class="flow-icon bg-green-500/10 text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
            <span class="text-sm font-medium">免费下载 {{ config.freeDownloadsAfterAd }} 次</span>
          </div>

          <div class="flow-arrow" v-if="config.rewardAdEnabled">
            <svg class="h-4 w-4 text-[var(--text-sub)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </div>

          <!-- Step 5: 辣度值下载 -->
          <div class="flow-node flow-end">
            <div class="flow-icon bg-red-500/10 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/>
              </svg>
            </div>
            <span class="text-sm font-medium">扣 {{ config.downloadCostPoints }} 辣度值下载</span>
          </div>
        </div>
      </section>

      <!-- 中间：规则配置表单 -->
      <section class="glass-panel xl:col-span-1">
        <h3 class="text-base font-semibold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
          规则配置
        </h3>

        <div class="space-y-5">
          <!-- 激励广告开关 -->
          <div class="config-item">
            <div class="flex items-center justify-between">
              <div>
                <label class="form-label mb-0">激励广告开关</label>
                <p class="text-xs text-[var(--text-sub)] mt-0.5">关闭后所有用户下载无需看广告</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer select-none">
                <input type="checkbox" v-model="config.rewardAdEnabled" class="sr-only peer" />
                <div class="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-[var(--primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
              </label>
            </div>
          </div>

          <div class="border-t border-[var(--border-color)]"></div>

          <!-- 新用户赠送辣度值 -->
          <div class="config-item">
            <label class="form-label">新用户赠送辣度值</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="config.newUserPoints"
                type="number"
                class="form-input w-24 text-center"
                min="0"
                max="500"
              />
              <span class="text-sm text-[var(--text-sub)]">辣度值 / 人</span>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-1">新用户首次进入小程序自动赠送的辣度值数量（建议 20-30）</p>
          </div>

          <div class="border-t border-[var(--border-color)]"></div>

          <!-- 免费下载次数 -->
          <div class="config-item">
            <label class="form-label">观看广告后免费下载次数</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="config.freeDownloadsAfterAd"
                type="number"
                class="form-input w-24 text-center"
                min="0"
                max="100"
              />
              <span class="text-sm text-[var(--text-sub)]">次 / 天</span>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-1">用户看完激励广告后，当天可免费下载的次数。设为 0 则看广告只能获得辣度值</p>
          </div>

          <div class="border-t border-[var(--border-color)]"></div>

          <!-- 每次下载消耗辣度值 -->
          <div class="config-item">
            <label class="form-label">每次下载消耗辣度值</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="config.downloadCostPoints"
                type="number"
                class="form-input w-24 text-center"
                min="0"
                max="1000"
              />
              <span class="text-sm text-[var(--text-sub)]">辣度值 / 次</span>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-1">免费次数用完后，每次下载扣多少辣度值。设为 0 则无需辣度值</p>
          </div>

          <div class="border-t border-[var(--border-color)]"></div>

          <!-- 看广告奖励辣度值 -->
          <div class="config-item">
            <label class="form-label">观看广告奖励辣度值</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="config.pointsPerAdWatch"
                type="number"
                class="form-input w-24 text-center"
                min="0"
                max="1000"
              />
              <span class="text-sm text-[var(--text-sub)]">辣度值 / 次</span>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-1">每看一次激励视频获得的辣度值奖励</p>
          </div>

          <div class="border-t border-[var(--border-color)]"></div>

          <!-- 每日看广告上限 -->
          <div class="config-item">
            <label class="form-label">每日看广告上限</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="config.dailyAdWatchLimit"
                type="number"
                class="form-input w-24 text-center"
                min="1"
                max="100"
              />
              <span class="text-sm text-[var(--text-sub)]">次 / 天</span>
            </div>
            <p class="text-xs text-[var(--text-sub)] mt-1">一天最多通过看广告获取辣度值和免费下载的次数</p>
          </div>
        </div>
      </section>

      <!-- 右侧：实时预览 -->
      <section class="glass-panel xl:col-span-1">
        <h3 class="text-base font-semibold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--primary)]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
          实时预览
        </h3>

        <div class="space-y-4">
          <!-- 模拟新用户场景 -->
          <div class="bg-[var(--bg-body)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--primary)] mb-3">👤 新用户首次下载体验</h4>
            <div class="space-y-2 text-sm">
              <div class="flex items-start gap-2">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold">1</span>
                <span>首次进入小程序，自动获得 <b class="text-[var(--primary)]">{{ config.newUserPoints }}</b> 辣度值</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold">2</span>
                <span>点击下载按钮</span>
              </div>
              <div class="flex items-start gap-2" v-if="config.rewardAdEnabled">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold">3</span>
                <span>观看激励广告，获得 <b class="text-[var(--primary)]">{{ config.freeDownloadsAfterAd }}</b> 次免费下载额度</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center text-xs font-bold">{{ config.rewardAdEnabled ? '4' : '3' }}</span>
                <span v-if="config.freeDownloadsAfterAd > 0">免费下载成功，额度 -1</span>
                <span v-else>扣 {{ config.downloadCostPoints }} 辣度值下载</span>
              </div>
              <div class="flex items-start gap-2" v-if="config.freeDownloadsAfterAd > 0">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-xs font-bold">{{ config.rewardAdEnabled ? '5' : '4' }}</span>
                <span>免费额度用完，后续每次下载扣 <b class="text-red-500">{{ config.downloadCostPoints }}</b> 辣度值</span>
              </div>
            </div>
          </div>

          <!-- 辣度值经济 -->
          <div class="bg-[var(--bg-body)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--primary)] mb-3">🌶️ 辣度值经济预览</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">新用户注册赠送</span>
                <span class="font-medium text-[var(--primary)]">{{ config.newUserPoints }} 分</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">签到1天得辣度值</span>
                <span class="font-medium">10 分</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">看1次广告得辣度值</span>
                <span class="font-medium text-[var(--primary)]">{{ config.pointsPerAdWatch }} 分</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">1次下载扣辣度值</span>
                <span class="font-medium text-red-500">{{ config.downloadCostPoints }} 分</span>
              </div>
              <div class="border-t border-[var(--border-color)] my-2"></div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">签到1天 → 可免费下载</span>
                <span class="font-medium">{{ Math.floor(10 / config.downloadCostPoints) }} 次</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">看1次广告 → 可免费下载</span>
                <span class="font-medium">{{ Math.floor(config.pointsPerAdWatch / config.downloadCostPoints) }} 次</span>
              </div>
              <div class="flex justify-between" v-if="config.rewardAdEnabled && config.freeDownloadsAfterAd > 0">
                <span class="text-[var(--text-sub)]">看广告额外免费下载</span>
                <span class="font-medium text-green-500">{{ config.freeDownloadsAfterAd }} 次/天</span>
              </div>
            </div>
          </div>

          <!-- 当前配置摘要 -->
          <div class="bg-[var(--bg-body)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--primary)] mb-3">📋 配置摘要</h4>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">激励广告</span>
                <span class="font-medium" :class="config.rewardAdEnabled ? 'text-green-600' : 'text-[var(--text-sub)]'">
                  {{ config.rewardAdEnabled ? '开启' : '关闭' }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">新用户赠送</span>
                <span class="font-medium">{{ config.newUserPoints }} 辣度值</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">看广告免费下载</span>
                <span class="font-medium">{{ config.freeDownloadsAfterAd }} 次/天</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">下载辣度值消耗</span>
                <span class="font-medium">{{ config.downloadCostPoints }} 分/次</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">看广告得辣度值</span>
                <span class="font-medium">{{ config.pointsPerAdWatch }} 分/次</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-sub)]">每日看广告上限</span>
                <span class="font-medium">{{ config.dailyAdWatchLimit }} 次</span>
              </div>
            </div>
          </div>

          <!-- 等级用户对比 -->
          <div class="bg-[var(--bg-body)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--primary)] mb-3">🎯 不同用户对比</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-[var(--text-sub)] text-xs">
                    <th class="text-left pb-2">用户类型</th>
                    <th class="text-center pb-2">下载条件</th>
                    <th class="text-right pb-2">每日上限</th>
                  </tr>
                </thead>
                <tbody class="space-y-1">
                  <tr class="border-t border-[var(--border-color)]">
                    <td class="py-2">
                      <span class="badge badge-purple text-xs">会员</span>
                    </td>
                    <td class="py-2 text-center text-green-600 font-medium">无限免费</td>
                    <td class="py-2 text-right">无限制</td>
                  </tr>
                  <tr class="border-t border-[var(--border-color)]">
                    <td class="py-2">
                      <span class="badge badge-green text-xs">看广告</span>
                    </td>
                    <td class="py-2 text-center">{{ config.freeDownloadsAfterAd }}次免费 + 辣度值</td>
                    <td class="py-2 text-right">{{ config.dailyAdWatchLimit }}次广告</td>
                  </tr>
                  <tr class="border-t border-[var(--border-color)]">
                    <td class="py-2">
                      <span class="badge badge-default text-xs">普通</span>
                    </td>
                    <td class="py-2 text-center text-red-500">{{ config.downloadCostPoints }}辣度值/次</td>
                    <td class="py-2 text-right">辣度值余额</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 保存成功提示 -->
    <div v-if="showSaved" class="fixed bottom-6 right-6 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-slide-up">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      配置已保存并生效
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useConfigStore } from '../stores/config'
import { logger } from '../utils/logger'
import { useMessage } from 'naive-ui'

const message = useMessage()

const loading = ref(false)
const saving = ref(false)
const showSaved = ref(false)
const configStore = useConfigStore()

const config = reactive({
  rewardAdEnabled: true,
  freeDownloadsAfterAd: 1,
  downloadCostPoints: 6,
  pointsPerAdWatch: 20,
  dailyAdWatchLimit: 15,
  newUserPoints: 25,
})

onMounted(() => {
  loadConfig()
})

async function loadConfig() {
  loading.value = true
  try {
    const v = await configStore.get<{
      rewardAdEnabled?: boolean
      freeDownloadsAfterAd?: number
      downloadCostPoints?: number
      pointsPerAdWatch?: number
      dailyAdWatchLimit?: number
      newUserPoints?: number
    }>('downloadConfig')
    if (v) {
      if (typeof v.rewardAdEnabled === 'boolean') config.rewardAdEnabled = v.rewardAdEnabled
      if (typeof v.freeDownloadsAfterAd === 'number') config.freeDownloadsAfterAd = v.freeDownloadsAfterAd
      if (typeof v.downloadCostPoints === 'number') config.downloadCostPoints = v.downloadCostPoints
      if (typeof v.pointsPerAdWatch === 'number') config.pointsPerAdWatch = v.pointsPerAdWatch
      if (typeof v.dailyAdWatchLimit === 'number') config.dailyAdWatchLimit = v.dailyAdWatchLimit
      if (typeof v.newUserPoints === 'number') config.newUserPoints = v.newUserPoints
    }
  } catch (err: any) {
    logger.error('加载下载配置失败:', err)
    message.error('加载配置失败: ' + (err.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (config.freeDownloadsAfterAd < 0 || config.downloadCostPoints < 0 || config.pointsPerAdWatch < 0 || config.dailyAdWatchLimit < 1 || config.newUserPoints < 0) {
    message.warning('配置值不能为负数')
    return
  }

  saving.value = true
  try {
    const ok = await configStore.set('downloadConfig', {
      rewardAdEnabled: config.rewardAdEnabled,
      freeDownloadsAfterAd: config.freeDownloadsAfterAd,
      downloadCostPoints: config.downloadCostPoints,
      pointsPerAdWatch: config.pointsPerAdWatch,
      dailyAdWatchLimit: config.dailyAdWatchLimit,
      newUserPoints: config.newUserPoints,
    })
    if (!ok) {
      message.error('保存失败，请重试')
      return
    }

    showSaved.value = true
    setTimeout(() => { showSaved.value = false }, 3000)
    message.success('配置已保存')
  } catch (err: any) {
    logger.error('保存下载配置失败:', err)
    message.error('保存失败: ' + (err.message || '未知错误'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.flow-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.flow-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 12px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  width: 100%;
  transition: all 0.2s;
}

.flow-node:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(7, 193, 96, 0.1);
}

.flow-decision {
  border-style: dashed;
  border-color: var(--primary);
  background: rgba(7, 193, 96, 0.03);
}

.flow-action {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.03);
}

.flow-end {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.03);
}

.flow-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.flow-arrow {
  display: flex;
  justify-content: center;
  padding: 2px 0;
}

.flow-branch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 8px;
}

.flow-yes, .flow-no {
  display: flex;
  align-items: center;
  gap: 6px;
}

.flow-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}

.badge-green {
  background: #dcfce7;
  color: #166534;
}

.badge-red {
  background: #fee2e2;
  color: #991b1b;
}

.badge-purple {
  background: #ede9fe;
  color: #5b21b6;
}

.badge-default {
  background: #f3f4f6;
  color: #6b7280;
}

.config-item {
  padding: 0;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
</style>
