/**
 * Naive UI 全局配置
 * 主题色对齐项目 --primary (#07c160)
 * 暗色模式通过 NConfigProvider 控制
 */
import type { GlobalThemeOverrides } from 'naive-ui'

/** 亮色主题覆盖 */
export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#07c160',
    primaryColorHover: '#06ad56',
    primaryColorPressed: '#059648',
    primaryColorSuppl: '#07c160',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
  },
  Tag: {
    borderRadius: '9999px',
  },
}

/** 暗色主题覆盖 */
export const darkThemeOverrides: GlobalThemeOverrides = {
  ...lightThemeOverrides,
  common: {
    ...lightThemeOverrides.common,
    bodyColor: '#111827',
    cardColor: '#1f2937',
    modalColor: '#1f2937',
    popoverColor: '#1f2937',
    borderColor: '#374151',
    inputColor: '#1f2937',
    tableColor: '#1f2937',
  },
}
