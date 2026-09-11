/**
 * ECharts 统一注册入口
 *
 * 所有页面统一使用此模块注册 ECharts 组件，
 * 避免在每个组件中重复注册。
 */
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  LineChart,
  PieChart,
  BarChart,
  ScatterChart,
  RadarChart,
} from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
} from "echarts/components";

// 一次性注册所有需要的 ECharts 组件
use([
  CanvasRenderer,
  LineChart,
  PieChart,
  BarChart,
  ScatterChart,
  RadarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
]);

// 导出 VChart 供页面使用
export { default as VChart } from "vue-echarts";
