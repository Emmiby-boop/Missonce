# Missonce Admin Mini Program — UI/UX 优化方案

> **适用范围**：后期添加的功能页面（home-tabs、topic-list、ad-config、resource-upload、user-list、user-detail、ai-config、category-tags）
> **核心约束**：整体风格样式不动（CSS 变量、色彩系统、字体系统、间距系统、圆角、阴影保持原样）
> **优化目标**：让这些页面符合微信小程序的操作逻辑，所有弹窗可滑动编辑，触控可达，键盘不遮挡，返回符合预期。

---

## 一、问题分析总结

通过对 8 个功能页面的 WXML/WXSS/JS 详细审查，发现以下 6 类系统性问题：

### 1.1 弹窗滚动实现不一致（最严重，用户直接痛点）

| 页面 | sheet max-height | sheet overflow:hidden | sheet flex 列 | body 组件 | body 滚动方式 | 规范度 |
|------|------------------|----------------------|--------------|----------|-------------|-------|
| topic-list | 85vh | ✓ | ✓ | scroll-view | scroll-y | ★★★★★ |
| home-tabs | 85vh | ✓ | ✓ | scroll-view | scroll-y | ★★★★★ |
| ad-config | 90vh | ✗ | ✓ | view | overflow-y:auto | ★★★ |
| ai-config | 90vh | ✗ | ✓ | view | overflow-y:auto | ★★★ |
| category-tags | ✗ | ✗ | ✗ | view | overflow-y:auto | ★ |
| resource-upload | （页面级滚动，无弹窗） | — | — | — | — | — |
| user-list | （页面级滚动，无弹窗） | — | — | — | — | — |
| user-detail | （页面级滚动，无弹窗） | — | — | — | — | — |

**根因**：`view + overflow-y: auto` 在微信小程序 Android 端滚动不可靠，尤其是 `position: fixed` 的弹窗内。只有 `scroll-view` 组件能保证跨端一致的可滚动体验。

### 1.2 触控目标普遍不足（违反 44pt 最小值规范）

| 元素类型 | 当前尺寸 | 规范要求 | 问题页面 |
|---------|---------|---------|---------|
| 卡片图标按钮（编辑/删除/排序） | 48rpx（24pt） | ≥88rpx（44pt） | topic-list、ad-config |
| 状态切换胶囊 | 高度 ~36rpx | ≥88rpx | topic-list |
| 角标选择按钮 | 高度 ~36rpx | ≥88rpx | topic-list |
| 精选星标按钮 | 48rpx | ≥88rpx | topic-list |
| 勾选框 | 40rpx | ≥88rpx | topic-list |
| 排序上下箭头 | 48rpx | ≥88rpx | topic-list、home-tabs |
| chip 标签 | padding 12rpx 24rpx（约 56rpx 高） | ≥88rpx | 所有页面 |
| segment 分段项 | 高度 ~64rpx | ≥88rpx | category-tags、ai-config |
| modal-close 关闭按钮 | 56rpx | ≥88rpx | 所有弹窗 |

**根因**：复刻 Web 端紧凑布局时未按小程序触控规范放大。

### 1.3 键盘遮挡（系统性）

- 所有弹窗内的 `<input>` / `<textarea>` 均未设置 `adjust-position` 和 `cursor-spacing`
- 弹窗为 `position: fixed`，微信默认的 `adjust-position` 机制对 fixed 元素无效，需要手动处理
- resource-upload 的 fixed 底部操作栏在键盘弹起时会被遮挡
- user-detail 的会员等级选择如果在底部，键盘弹起时也会被遮挡

**影响页面**：topic-list、ad-config、ai-config、category-tags、resource-upload、user-detail

### 1.4 返回逻辑缺失（系统性）

5 个含弹窗的页面（topic-list、home-tabs、ad-config、ai-config、category-tags）均未拦截物理返回键。弹窗打开时按返回键会直接退出页面，而非关闭弹窗——这违反微信小程序的交互预期。

### 1.5 缺少错误状态

8 个页面均有 loading / empty 状态，但**均无 error 状态分支**。当云函数失败且 DB 回退也失败时，页面会卡在 loading 或显示空数据，用户无从知晓发生了什么。

### 1.6 其他问题

| 页面 | 问题 | 严重度 |
|------|------|-------|
| category-tags | 使用 `longpress` 作为主要交互（编辑/删除），可发现性差 | 中 |
| ai-config | 状态指示器重复（Tab 上有，列表里又有） | 低 |
| ai-config | 白名单 Tab 保存逻辑混乱（分类/标签混在一个表单） | 中 |
| topic-list | 大量使用 `backdrop-filter`，Android 低版本兼容性差 | 低 |
| topic-list | 卡片操作按钮挤在底部，与批量操作栏易误触 | 中 |
| ad-config | 双层弹窗结构（广告单元 + 广告位）切换逻辑不清晰 | 中 |
| resource-upload | 上传列表项信息过密，缺少进度可视化 | 低 |
| user-detail | 会员等级用 picker，到期时间自动计算但无明确提示 | 低 |

---

## 二、设计原则（小程序操作逻辑）

遵循微信小程序官方设计指南 + Web Interface Guidelines + ui-ux-pro-max 规则：

### 2.1 触控优先
- **最小触控目标 88rpx × 88rpx（44pt × 44pt）**——这是不可妥协的硬性规范
- 触控元素间距 ≥ 16rpx（8pt），避免误触
- 重要操作放在拇指可达区（屏幕下半部分）

### 2.2 滚动可靠
- **所有可滚动区域一律使用 `<scroll-view>` 组件**，不使用 `view + overflow-y: auto`
- 弹窗内容区必须 `flex: 1; min-height: 0`，配合 `scroll-y` 实现自适应滚动
- 弹窗 sheet 必须 `overflow: hidden` 防止内容溢出

### 2.3 键盘友好
- 所有 `<input>` / `<textarea>` 设置 `adjust-position="{{false}}"` + `cursor-spacing="0"`，由弹窗 scroll-view 主动滚动到可视区
- 或在简单场景下保留 `adjust-position` 默认值，但确保弹窗本身不被键盘推动错位
- 底部固定栏在键盘弹起时上移（监听 `onKeyboardHeightChange`）

### 2.4 返回符合预期
- 弹窗打开时拦截物理返回键（`onBackPress` 或 `wx.enableAlertBeforeUnload` 不适用，需用页面栈方案）
- 推荐方案：弹窗打开时 `wx.navigateTo` 一个透明占位页，返回时先关闭弹窗，再按返回才真正离开

### 2.5 状态完备
- 每个数据页面具备 4 态：loading（骨架屏）、empty（空状态）、**error（错误重试）**、success
- 错误状态必须提供「重试」按钮，不能只是静态文案

### 2.6 操作直达
- 高频操作（编辑、删除、排序）放在卡片可见位置，不藏在长按菜单里
- 低频危险操作（批量删除）放在底部操作栏，需要二次确认

---

## 三、统一弹窗组件规范（核心修复）

### 3.1 标准弹窗结构

所有弹窗必须采用以下结构（参照 topic-list 已实现的最佳实践）：

```html
<!-- 遮罩层 -->
<view class="modal-mask" wx:if="{{showModal}}" catchtap="closeModal">
  <!-- sheet 容器：catchtap 阻止冒泡 -->
  <view class="modal-sheet" catchtap="noop">
    <!-- 头部：固定不动 -->
    <view class="modal-header">
      <view class="modal-title">{{modalTitle}}</view>
      <view class="modal-close" catchtap="closeModal" aria-label="关闭">
        <image class="modal-close-icon" src="{{icons.close}}" />
      </view>
    </view>

    <!-- 内容区：scroll-view 保证可滚动 -->
    <scroll-view class="modal-body" scroll-y enhanced show-scrollbar="{{false}}">
      <!-- 表单内容 -->
    </scroll-view>

    <!-- 底部操作：固定不动 -->
    <view class="modal-footer">
      <button class="btn btn--default btn--flex1" catchtap="closeModal">取消</button>
      <button class="btn btn--primary btn--flex1" catchtap="onSave" loading="{{saving}}">保存</button>
    </view>
  </view>
</view>
```

### 3.2 标准弹窗样式（所有页面统一）

```css
/* ============================================
 * 弹窗（统一规范，所有页面必须使用）
 * 不改变视觉风格，仅修正滚动结构
 * ============================================ */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.modal-sheet {
  width: 100%;
  background: var(--bg-card);
  border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  animation: slideUp 0.25s ease-out;
  /* 三要素：max-height + flex 列 + overflow hidden */
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  flex-shrink: 0;  /* 头部不压缩 */
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  /* 触控目标 ≥ 88rpx */
  width: 88rpx;
  height: 88rpx;
  margin: -12rpx -12rpx -12rpx 0;  /* 视觉不变，触控区扩大 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-icon {
  width: 36rpx;
  height: 36rpx;
}

.modal-body {
  flex: 1;
  min-height: 0;  /* 关键：允许 flex 子项收缩 */
  /* 不再设置 overflow-y: auto，由 scroll-view 接管 */
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  flex-shrink: 0;  /* 底部不压缩 */
  padding-top: 16rpx;
  border-top: 1rpx solid var(--divider);
}

.btn--flex1 {
  flex: 1;
}
```

### 3.3 各页面弹窗修复清单

| 页面 | 修复内容 |
|------|---------|
| **ad-config** | sheet 添加 `overflow: hidden`；body 的 `<view>` 改为 `<scroll-view scroll-y>`；移除 `overflow-y: auto` |
| **ai-config** | 同 ad-config |
| **category-tags** | sheet 添加 `max-height: 85vh` + `display: flex; flex-direction: column` + `overflow: hidden`；body 改为 `<scroll-view scroll-y>`；移除 `max-height: 60vh` + `overflow-y: auto` |
| **topic-list** | 已符合规范，仅需微调：modal-close 扩大触控区 |
| **home-tabs** | 同 topic-list |

---

## 四、触控目标优化方案

### 4.1 通用规则

```css
/* 所有可点击元素的触控区至少 88rpx × 88rpx */
/* 视觉尺寸可以小，但触控热区必须大 */
/* 使用 padding 或负 margin 扩大触控区，不改变视觉大小 */

/* 示例：图标按钮视觉 48rpx，触控 88rpx */
.icon-btn {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 视觉上的图标尺寸不变 */
}
.icon-btn .action-icon {
  width: 32rpx;  /* 图标视觉尺寸 */
  height: 32rpx;
}

/* 紧凑场景：用 padding 扩大触控区 */
.icon-btn--compact {
  width: auto;
  height: auto;
  padding: 20rpx;  /* 触控区 = 图标 + padding*2 */
}
```

### 4.2 各页面触控优化清单

#### topic-list（最严重）
| 元素 | 当前 | 优化后 |
|------|------|-------|
| `.sort-btn`（排序上下） | 48×48rpx | 88×88rpx（图标视觉保持 32rpx） |
| `.icon-btn`（编辑/删除） | 48×48rpx | 88×88rpx |
| `.featured-btn`（精选星标） | 48×48rpx | 72×72rpx（封面右上角，空间有限，但需 ≥72rpx） |
| `.card-checkbox`（勾选框） | 40×40rpx | 64×64rpx（选择模式下触控区） |
| `.card-status`（状态切换） | 高度 36rpx | 高度 56rpx + padding 扩展触控到 88rpx |
| `.card-badge`（角标选择） | 高度 36rpx | 高度 56rpx + padding 扩展触控 |

#### home-tabs
| 元素 | 当前 | 优化后 |
|------|------|-------|
| 排序上下箭头 | 48×48rpx | 88×88rpx |
| toggle 开关 | 84×48rpx | 保持（已是合理尺寸） |

#### ad-config
| 元素 | 当前 | 优化后 |
|------|------|-------|
| 广告位启用/停用 toggle | 标准 | 保持 |
| 编辑按钮 | 48×48rpx | 88×88rpx |

#### ai-config
| 元素 | 当前 | 优化后 |
|------|------|-------|
| Tab 切换项 | 高度 ~64rpx | 高度 88rpx |
| segment 分段项 | 高度 ~64rpx | 高度 88rpx |
| 测试连接按钮 | btn--sm 60rpx | 保持 btn--sm 但确保宽度足够 |
| 删除 API Key 按钮 | 48×48rpx | 88×88rpx |

#### category-tags
| 元素 | 当前 | 优化后 |
|------|------|-------|
| segment 分段项 | 高度 ~64rpx | 高度 88rpx |
| 标签项（长按编辑） | padding 12rpx 24rpx | 高度 88rpx + 改为点击编辑（非长按） |

#### resource-upload
| 元素 | 当前 | 优化后 |
|------|------|-------|
| 移除按钮 | 48×48rpx | 88×88rpx |
| 选择类别 chip | 标准 | 确保高度 ≥88rpx |

---

## 五、键盘适配方案

### 5.1 弹窗内输入框

所有弹窗内的 `<input>` 和 `<textarea>` 添加键盘适配属性：

```html
<!-- 简单场景：依赖微信默认 adjust-position -->
<input
  class="input"
  value="{{form.title}}"
  bindinput="onInput"
  adjust-position="{{true}}"
  cursor-spacing="20"
  placeholder="请输入标题"
/>

<!-- textarea 同理 -->
<textarea
  class="textarea"
  value="{{form.description}}"
  bindinput="onInput"
  adjust-position="{{true}}"
  cursor-spacing="20"
  show-confirm-bar="{{false}}"
  placeholder="请输入描述"
/>

<!-- 弹窗内输入框：scroll-view 主动滚动 -->
<!-- 在 bindfocus 时记录当前输入框，bindfocus 时滚动到可见区 -->
```

### 5.2 弹窗 scroll-view 主动滚动（推荐方案）

对于内容较多的弹窗，在 input 获取焦点时主动滚动 scroll-view：

```js
// 页面 JS
data: {
  scrollTop: 0,
  scrollIntoView: ''
},

// input 获取焦点时滚动到该输入框
onInputFocus(e) {
  const { id } = e.currentTarget
  this.setData({ scrollIntoView: id })
},

// 失焦后清空
onInputBlur() {
  this.setData({ scrollIntoView: '' })
},
```

```html
<scroll-view
  class="modal-body"
  scroll-y
  scroll-into-view="{{scrollIntoView}}"
  scroll-with-animation
>
  <input
    id="title-input"
    class="input"
    adjust-position="{{false}}"
    bindfocus="onInputFocus"
    bindblur="onInputBlur"
  />
</scroll-view>
```

### 5.3 底部固定栏键盘适配（resource-upload）

```js
data: {
  keyboardHeight: 0,
  isKeyboardVisible: false
},

onLoad() {
  wx.onKeyboardHeightChange(this.onKeyboardHeightChange)
},

onUnload() {
  wx.offKeyboardHeightChange(this.onKeyboardHeightChange)
},

onKeyboardHeightChange(res) {
  this.setData({
    keyboardHeight: res.height,
    isKeyboardVisible: res.height > 0
  })
},
```

```css
/* 底部栏在键盘弹起时上移 */
.bottom-bar--keyboard {
  bottom: calc({{keyboardHeight}}px);  /* 通过 style 绑定 */
  /* 或用 transform */
  transform: translateY(-{{keyboardHeight}}px);
}
```

---

## 六、返回逻辑拦截方案

### 6.1 推荐方案：onBackPress 拦截（不可用，小程序无此 API）

微信小程序没有原生的 `onBackPress` 拦截能力。需要用以下替代方案。

### 6.2 实际可行方案：弹窗状态 + 提示

弹窗打开时，按物理返回键会直接退出页面。可行方案：

**方案 A（推荐）：弹窗打开时阻止返回**
- 利用 `wx.enableAlertBeforeUnload`，但仅在小程序后台有效，对小程序内 navigateBack 无效
- ❌ 不可行

**方案 B（推荐）：弹窗打开时用 navigateTo 占位页**
- 弹窗打开时 `wx.navigateTo({ url: '/pages/placeholder/placeholder' })`
- 占位页 `onShow` 时立即 `wx.navigateBack()`，但通过事件通道通知原页面关闭弹窗
- 复杂度高，不推荐

**方案 C（最佳实践）：将弹窗内容改为独立页面**
- 对于复杂表单（如 topic-list 编辑、ad-config 编辑），改为 `wx.navigateTo` 到独立编辑页
- 独立页面天然支持返回键
- 但改动量大，与"整体风格不动"有冲突

**方案 D（推荐，折中）：保留弹窗 + 弹窗内显眼关闭按钮 + 数据丢失提示**
- 弹窗内右上角和底部都有显眼的关闭按钮
- 用户编辑过内容后，关闭时弹出 `wx.showModal` 确认是否放弃修改
- 物理返回键虽然直接退出页面，但用户重新进入时恢复草稿（localStorage）

### 6.3 最终采用方案

采用 **方案 D**（保留弹窗 + 草稿恢复 + 关闭确认）：

```js
data: {
  showModal: false,
  formDirty: false,  // 表单是否有修改
  draftKey: ''       // 草稿存储 key
},

// 关闭弹窗前检查
closeModal() {
  if (this.data.formDirty) {
    wx.showModal({
      title: '提示',
      content: '有未保存的修改，确定要关闭吗？',
      confirmText: '放弃',
      confirmColor: '#FA5151',
      success: (res) => {
        if (res.confirm) {
          this.saveDraft()  // 保存草稿
          this.setData({ showModal: false, formDirty: false })
        }
      }
    })
  } else {
    this.setData({ showModal: false })
  }
},

// 保存草稿
saveDraft() {
  if (this.data.draftKey) {
    wx.setStorageSync(this.data.draftKey, this.data.form)
  }
},

// 恢复草稿
restoreDraft() {
  if (this.data.draftKey) {
    const draft = wx.getStorageSync(this.data.draftKey)
    if (draft) {
      wx.showModal({
        title: '恢复草稿',
        content: '检测到上次未保存的修改，是否恢复？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ form: draft })
          } else {
            wx.removeStorageSync(this.data.draftKey)
          }
        }
      })
    }
  }
},
```

**适用页面**：topic-list、home-tabs、ad-config、ai-config、category-tags

---

## 七、错误状态补充方案

### 7.1 标准错误状态组件

```html
<!-- 错误状态 -->
<view class="error-state" wx:if="{{loadError}}">
  <image class="error-state__icon" src="{{icons.errorCloud}}" />
  <view class="error-state__text">{{errorMsg || '加载失败'}}</view>
  <view class="error-state__action">
    <button class="btn btn--ghost btn--sm" bindtap="retryLoad">重试</button>
  </view>
</view>
```

```css
/* 复用 empty-state 样式，仅改图标和文案 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 32rpx;
  gap: 20rpx;
}

.error-state__icon {
  width: 120rpx;
  height: 120rpx;
  opacity: 0.4;
}

.error-state__text {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.error-state__action {
  margin-top: 8rpx;
}
```

### 7.2 页面状态分支模板

```html
<view class="page-container">
  <!-- 加载态：骨架屏 -->
  <block wx:if="{{loading && !list.length}}">
    <view class="skeleton-card" wx:for="{{[1,2,3]}}" wx:key="*this">
      <!-- 骨架屏内容 -->
    </view>
  </block>

  <!-- 错误态 -->
  <view class="error-state" wx:elif="{{loadError}}">
    <image class="error-state__icon" src="{{icons.errorCloud}}" />
    <view class="error-state__text">{{errorMsg}}</view>
    <button class="btn btn--ghost btn--sm" bindtap="retryLoad">重试</button>
  </view>

  <!-- 空状态 -->
  <view class="empty-state" wx:elif="{{!list.length}}">
    <image class="empty-state__icon" src="{{icons.emptyBox}}" />
    <view class="empty-state__text">暂无数据</view>
    <button class="btn btn--primary btn--sm" bindtap="onAdd" wx:if="{{canAdd}}">立即添加</button>
  </view>

  <!-- 正常内容 -->
  <block wx:else>
    <!-- 列表内容 -->
  </block>
</view>
```

### 7.3 JS 错误处理模板

```js
data: {
  loading: false,
  loadError: false,
  errorMsg: '',
  list: []
},

async loadData() {
  this.setData({ loading: true, loadError: false })
  try {
    const res = await api.getTopics()
    this.setData({
      list: res.data || [],
      loading: false
    })
  } catch (err) {
    console.warn('[page] 加载失败:', err)
    this.setData({
      loading: false,
      loadError: true,
      errorMsg: err.message || '网络异常，请稍后重试'
    })
  }
},

retryLoad() {
  this.loadData()
},
```

**适用页面**：所有 8 个功能页面

---

## 八、各页面专项优化

### 8.1 topic-list（专题列表）

**问题**：卡片操作按钮挤在底部 + backdrop-filter 兼容性 + 触控目标过小

**优化方案**：

1. **卡片操作重构**：将底部操作按钮从卡片内移到卡片长按菜单或滑动操作
   - 主操作（编辑）：点击卡片整体进入编辑
   - 次操作（排序、删除）：放在编辑弹窗内或长按菜单
   - 批量选择：进入"管理模式"后显示勾选框

2. **backdrop-filter 兼容性**：添加 fallback 背景
   ```css
   .card-status--on {
     background: rgba(34, 197, 94, 0.85);  /* fallback */
   }
   @supports (backdrop-filter: blur(8rpx)) {
     .card-status--on {
       background: rgba(34, 197, 94, 0.25);
       backdrop-filter: blur(8rpx);
     }
   }
   ```

3. **触控目标放大**：sort-btn、icon-btn 从 48rpx 扩大到 88rpx

4. **弹窗**：已符合规范，仅需扩大 modal-close 触控区

### 8.2 home-tabs（首页 Tab 管理）

**问题**：触控目标过小

**优化方案**：
1. 排序上下箭头从 48rpx 扩大到 88rpx
2. 弹窗已符合规范，微调 modal-close 触控区

### 8.3 ad-config（广告配置）

**问题**：弹窗滚动不可靠 + 双层弹窗切换逻辑不清晰 + 触控目标小

**优化方案**：
1. **弹窗滚动修复**：modal-body 改为 scroll-view，sheet 添加 overflow:hidden
2. **双层弹窗优化**：
   - 广告单元列表 → 点击进入广告位配置（同一弹窗内切换视图，而非叠加弹窗）
   - 顶部显示面包屑：`广告单元 / adunit-xxx / 广告位配置`
   - 左上角返回按钮回到广告单元列表
3. **触控目标**：编辑按钮扩大到 88rpx
4. **键盘适配**：adUnitId 输入框添加 adjust-position + cursor-spacing

### 8.4 resource-upload（资源上传）

**问题**：底部固定栏键盘遮挡 + 上传列表信息过密

**优化方案**：
1. **底部栏键盘适配**：监听 onKeyboardHeightChange，键盘弹起时底部栏上移
2. **上传列表项优化**：
   - 每个上传项显示：缩略图 + 文件名 + 进度条 + 状态标签 + 移除按钮
   - 进度条用 `progress` 组件或 CSS 实现
   - 状态标签：等待中（灰）/ 上传中（蓝）/ 识别中（紫）/ 完成（绿）/ 失败（红）
3. **触控目标**：移除按钮扩大到 88rpx

### 8.5 user-list（用户列表）

**问题**：无错误状态

**优化方案**：
1. 添加错误状态分支
2. 搜索失败时显示错误提示 + 重试按钮

### 8.6 user-detail（用户详情）

**问题**：会员等级选择体验 + 键盘适配

**优化方案**：
1. **会员等级选择**：从 picker 改为弹窗内的分段选择器（segment），更直观
   - 选择等级后自动计算到期时间，并显示明确提示文案
   - 例：选择"月度会员" → 显示"到期时间：2026-08-08 10:16"
2. **积分输入框**：添加 adjust-position + cursor-spacing
3. **底部保存按钮**：键盘弹起时上移

### 8.7 ai-config（AI 配置）

**问题**：弹窗滚动不可靠 + 状态指示器重复 + 白名单 Tab 保存逻辑混乱 + 触控目标小

**优化方案**：
1. **弹窗滚动修复**：modal-body 改为 scroll-view
2. **状态指示器去重**：只在 API Key 列表项显示状态，Tab 标签上不重复显示
3. **白名单 Tab 拆分**：
   - 将"分类白名单"和"标签白名单"拆为两个子 Tab
   - 各自独立保存，避免混淆
4. **触控目标**：Tab 切换项、segment 分段项高度提升到 88rpx
5. **测试连接按钮**：添加 loading 状态，防止重复点击

### 8.8 category-tags（分类标签）

**问题**：弹窗滚动不可靠（最严重） + 长按交互可发现性差 + 触控目标小

**优化方案**：
1. **弹窗滚动修复**（最优先）：
   - sheet 添加 `max-height: 85vh` + `display: flex; flex-direction: column` + `overflow: hidden`
   - modal-body 改为 `<scroll-view scroll-y>`
   - 移除 `max-height: 60vh` + `overflow-y: auto`
2. **长按改为点击**：
   - 点击标签项直接打开编辑弹窗
   - 删除操作放在编辑弹窗内（底部红色"删除"按钮）
   - 不再依赖 longpress
3. **触控目标**：segment 分段项高度提升到 88rpx，标签项高度提升到 88rpx
4. **添加错误状态**

---

## 九、实施优先级和清单

### Phase 1：弹窗滚动修复（最高优先级，用户直接痛点）

**目标**：所有弹窗可滑动编辑

| 序号 | 任务 | 页面 | 复杂度 |
|------|------|------|-------|
| 1.1 | modal-body 改为 scroll-view + sheet 添加 overflow:hidden | ad-config | 低 |
| 1.2 | 同上 | ai-config | 低 |
| 1.3 | sheet 添加 max-height + flex 列 + overflow:hidden + body 改 scroll-view | category-tags | 中 |
| 1.4 | modal-close 触控区扩大到 88rpx | 所有弹窗页面 | 低 |

### Phase 2：触控目标优化（高优先级）

**目标**：所有可点击元素 ≥ 88rpx

| 序号 | 任务 | 页面 |
|------|------|------|
| 2.1 | sort-btn、icon-btn 扩大到 88rpx | topic-list、home-tabs |
| 2.2 | 编辑/删除按钮扩大到 88rpx | ad-config、ai-config |
| 2.3 | segment 分段项高度提升到 88rpx | category-tags、ai-config |
| 2.4 | 标签项高度提升到 88rpx + 改为点击编辑 | category-tags |

### Phase 3：键盘适配（高优先级）

**目标**：键盘不遮挡输入框

| 序号 | 任务 | 页面 |
|------|------|------|
| 3.1 | input/textarea 添加 adjust-position + cursor-spacing | 所有弹窗页面 |
| 3.2 | 底部固定栏键盘上移 | resource-upload、user-detail |
| 3.3 | 弹窗 scroll-view 主动滚动到焦点输入框 | 复杂表单弹窗 |

### Phase 4：返回逻辑 + 草稿恢复（高优先级）

**目标**：弹窗关闭前确认未保存修改

| 序号 | 任务 | 页面 |
|------|------|------|
| 4.1 | 表单脏数据标记 + 关闭确认 | topic-list、home-tabs、ad-config、ai-config、category-tags |
| 4.2 | 草稿存储 + 恢复提示 | 同上 |

### Phase 5：错误状态补充（中优先级）

**目标**：所有数据页面具备 error 状态

| 序号 | 任务 | 页面 |
|------|------|------|
| 5.1 | 添加 error-state 模板和样式 | 所有 8 个页面 |
| 5.2 | loadData 添加 try-catch + loadError 状态 | 所有 8 个页面 |
| 5.3 | 重试按钮 | 所有 8 个页面 |

### Phase 6：页面专项优化（中优先级）

| 序号 | 任务 | 页面 |
|------|------|------|
| 6.1 | category-tags 长按改点击 | category-tags |
| 6.2 | ai-config 状态指示器去重 + 白名单 Tab 拆分 | ai-config |
| 6.3 | ad-config 双层弹窗改为单弹窗内视图切换 | ad-config |
| 6.4 | topic-list 卡片操作重构 + backdrop-filter fallback | topic-list |
| 6.5 | resource-upload 上传列表进度可视化 | resource-upload |
| 6.6 | user-detail 会员等级改分段选择器 + 到期时间提示 | user-detail |

---

## 十、不变项（明确约束）

以下内容在优化过程中**绝对不能改动**：

1. **CSS 变量系统**：`--pri`、`--bg-page`、`--bg-card`、`--text-primary` 等所有色彩变量
2. **色彩系统**：主色 #07C160、语义色、中性色、深色模式配色
3. **字体系统**：字号、字重、行高、字体族
4. **间距系统**：Page Padding 32rpx、Section Gap 40rpx、Card Padding 32rpx
5. **圆角系统**：`--r-lg: 20rpx`、`--r-md: 16rpx`、`--r-sm: 12rpx`、`--r-pill: 100rpx`
6. **阴影系统**：`--shadow-card: 0 2rpx 12rpx rgba(0,0,0,0.03)`
7. **组件视觉风格**：卡片、列表项、徽章、按钮、开关、筛选栏、空状态的视觉外观
8. **图标系统**：Feather Icons 风格 SVG
9. **导航架构**：TabBar 4 个标签 + 子页面 navigateTo

---

## 十一、验收标准

优化完成后，需满足以下验收标准：

### 弹窗滚动
- [ ] 所有弹窗内容超出屏幕时，可流畅上下滑动
- [ ] 滑动时头部和底部操作栏固定不动
- [ ] Android 和 iOS 表现一致

### 触控目标
- [ ] 所有可点击元素触控区 ≥ 88rpx × 88rpx
- [ ] 触控元素间距 ≥ 16rpx
- [ ] 无误触情况

### 键盘适配
- [ ] 弹窗内输入框获取焦点时，输入框不被键盘遮挡
- [ ] 底部固定栏在键盘弹起时上移，不被遮挡
- [ ] 键盘收起后布局恢复正常

### 返回逻辑
- [ ] 弹窗内有未保存修改时，关闭前提示确认
- [ ] 重新进入弹窗时恢复草稿（如有）
- [ ] 弹窗内显眼位置有关闭按钮

### 错误状态
- [ ] 网络异常时显示错误状态，而非卡在 loading
- [ ] 错误状态提供「重试」按钮
- [ ] 错误状态文案明确（如"网络异常，请稍后重试"）

### 视觉一致性
- [ ] 所有页面的弹窗视觉风格一致（圆角、阴影、动画）
- [ ] 所有页面的按钮、输入框、开关视觉风格一致
- [ ] 深色模式下所有元素正确显示
- [ ] 整体风格样式与优化前保持一致
