/* =====================================================================
 * Mini Admin — Naive UI Theme Overrides (对齐用户 redesign 的 slate 令牌)
 * 让 Naive 组件与 tokens.css 同一套色板/字体/圆角，终结双轨割裂。
 * 在 App.vue 的 NConfigProvider 中按当前主题选用 light / dark。
 * ===================================================================== */
import type { GlobalThemeOverrides } from "naive-ui";

const light: GlobalThemeOverrides = {
  common: {
    primaryColor: "#07C160",
    primaryColorHover: "#06AD56",
    primaryColorPressed: "#059a4d",
    primaryColorSuppl: "#06AD56",
    successColor: "#07C160",
    warningColor: "#F59E0B",
    errorColor: "#EF4444",
    infoColor: "#3B82F6",

    bodyColor: "#F8FAFC",
    cardColor: "#FFFFFF",
    modalColor: "#FFFFFF",
    popoverColor: "#FFFFFF",
    tableColor: "#FFFFFF",
    tableHeaderColor: "#F8FAFC",

    borderColor: "#E2E8F0",
    dividerColor: "#F1F5F9",

    textColorBase: "#0F172A",
    textColor1: "#0F172A",
    textColor2: "#0F172A",
    textColor3: "#475569",
    textColor4: "#94A3B8",
    placeholderColor: "#94A3B8",

    borderRadius: "10px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif",
    fontFamilyMono: "'IBM Plex Mono', 'SF Mono', monospace",
  },
  Card: { borderRadius: "10px", color: "#FFFFFF", boxShadow: "0 4px 12px rgba(15,23,42,.06)" },
  Button: { borderRadius: "6px", fontWeight: "500" },
  Input: { borderRadius: "6px", color: "#F8FAFC", colorFocus: "#FFFFFF" },
  Select: { borderRadius: "6px" },
  Dialog: { borderRadius: "14px" },
  Tag: { borderRadius: "100px" },
  DataTable: { borderRadius: "10px" },
  Message: { borderRadius: "10px" },
};

const dark: GlobalThemeOverrides = {
  common: {
    primaryColor: "#07C160",
    primaryColorHover: "#1fd676",
    primaryColorPressed: "#06AD56",
    primaryColorSuppl: "#1fd676",
    successColor: "#07C160",
    warningColor: "#F59E0B",
    errorColor: "#EF4444",
    infoColor: "#3B82F6",

    bodyColor: "#0B0F19",
    cardColor: "#111827",
    modalColor: "#111827",
    popoverColor: "#1E293B",
    tableColor: "#111827",
    tableHeaderColor: "#0B0F19",

    borderColor: "#1E293B",
    dividerColor: "#1E293B",

    textColorBase: "#F1F5F9",
    textColor1: "#F1F5F9",
    textColor2: "#F1F5F9",
    textColor3: "#94A3B8",
    textColor4: "#64748B",
    placeholderColor: "#64748B",

    borderRadius: "10px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif",
    fontFamilyMono: "'IBM Plex Mono', 'SF Mono', monospace",
  },
  Card: { borderRadius: "10px", color: "#111827" },
  Button: { borderRadius: "6px", fontWeight: "500" },
  Input: { borderRadius: "6px" },
  Select: { borderRadius: "6px" },
  Dialog: { borderRadius: "14px" },
  Tag: { borderRadius: "100px" },
};

export const themeOverrides = { light, dark };
