# 统一广告管理组件

## 功能特性

1. **顶部悬浮广告**：导航栏下方固定，下滑显示（阈值可配置）、回顶隐藏
2. **过渡动画**：添加了 opacity 和 transform 动画，无闪屏/抖动
3. **广告配置管理**：通过云函数获取后台配置，支持全局引入
4. **缓存机制**：组件初始化时调用云函数，缓存配置避免重复请求
5. **兼容性**：适配不同机型/小程序基础库版本
6. **异常处理**：云函数请求失败/广告ID为空时隐藏组件

## 使用方法

### 1. 在页面中引入组件

在页面的 JSON 文件中添加组件引用：

```json
{
  "usingComponents": {
    "ad-unit": "../../components/ad-unit/ad-unit"
  }
}
```

### 2. 在页面 WXML 中使用组件

#### 顶部悬浮广告

```wxml
<ad-unit 
  position="top" 
  kind="native" 
  page-path="{{pagePath}}"
  threshold="200"
  debug="{{debug}}"
/>
```

#### 底部固定广告

```wxml
<ad-unit 
  position="bottom" 
  kind="native" 
  page-path="{{pagePath}}"
  fixed-bottom="true"
  debug="{{debug}}"
/>
```

#### 激励视频广告

```wxml
<ad-unit 
  kind="rewarded" 
  page-path="{{pagePath}}"
  reward-cloud-name="userPoints"
  reward-cloud-action="rewardAdWatch"
  reward-points="10"
  button-text="观看激励视频"
  debug="{{debug}}"
  bind:rewarded="onRewarded"
/>
```

## 配置选项

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| position | String | 'bottom' | 广告位置：'top'、'middle'、'bottom' |
| kind | String | 'native' | 广告类型：'native'、'rewarded'、'interstitial' |
| pagePath | String | '' | 页面路径，用于获取对应页面的广告配置 |
| customClass | String | '' | 自定义类名 |
| adIntervals | Number | 60 | 广告刷新间隔（秒） |
| fixedBottom | Boolean | false | 是否固定在底部 |
| immediate | Boolean | false | 是否立即显示 |
| threshold | Number | 200 | 顶部广告显示阈值（px） |
| extStyle | String | '' | 额外样式 |
| rewardCloudName | String | 'userPoints' | 激励广告回调云函数名 |
| rewardCloudAction | String | 'rewardAdWatch' | 激励广告回调云函数动作 |
| rewardPoints | Number | 0 | 激励广告奖励积分 |
| buttonText | String | '观看激励视频' | 激励广告按钮文本 |
| showButton | Boolean | true | 是否显示激励广告按钮 |
| debug | Boolean | false | 是否开启调试模式 |

## 后台配置

通过云函数 `getAdConfig` 获取广告配置，配置项包括：

| 字段 | 类型 | 说明 |
|------|------|------|
| adUnitId | String | 广告单元ID |
| type | String | 广告类型：'native_top'、'native_bottom'、'rewarded' 等 |
| position | String | 广告位置：'top'、'middle'、'bottom' |
| isEnable | Boolean | 是否启用 |
| threshold | Number | 顶部广告显示阈值（px） |
| height | Number | 广告高度（px） |
| pagePath | String | 页面路径 |

## 事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| rewarded | 激励广告观看完成 | { success: Boolean, added: Number, error: String } |

## 示例代码

### 页面使用示例

```wxml
<view class="container">
  <!-- 顶部悬浮广告 -->
  <ad-unit 
    position="top" 
    kind="native" 
    page-path="/pages/index/index"
    debug="{{false}}"
  />
  
  <!-- 页面内容 -->
  <view class="content">
    <!-- 页面内容 -->
  </view>
  
  <!-- 底部固定广告 -->
  <ad-unit 
    position="bottom" 
    kind="native" 
    page-path="/pages/index/index"
    fixed-bottom="true"
    debug="{{false}}"
  />
</view>
```

### 激励广告使用示例

```javascript
Page({
  data: {
    points: 0
  },
  onRewarded(e) {
    if (e.detail.success) {
      this.setData({
        points: this.data.points + e.detail.added
      })
      wx.showToast({ title: `获得 ${e.detail.added} 积分`, icon: 'success' })
    } else {
      wx.showToast({ title: e.detail.error || '观看失败', icon: 'none' })
    }
  }
})
```

## 注意事项

1. 确保云函数 `getAdConfig` 已部署并正常运行
2. 顶部广告的显示阈值可通过后台配置或组件属性设置
3. 广告配置会缓存 5 分钟，避免重复请求
4. 当云函数请求失败或广告ID为空时，组件会自动隐藏
5. 顶部广告通过页面滚动监听实现显示/隐藏逻辑
6. 组件会自动适配不同机型和小程序基础库版本

## 调试模式

开启 `debug` 属性可以在控制台看到详细的日志信息，便于调试。

```wxml
<ad-unit 
  position="top" 
  kind="native" 
  page-path="{{pagePath}}"
  debug="true"
/>
```