/** Ant Design 5 浅色后台主题（全局）；侧栏深色由 ProLayout token + hospitalProLayout.css 单独控制 */

import type { ThemeConfig } from 'antd'
import { theme as antdTheme } from 'antd'

export const enterpriseTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1677ff',
    colorTextBase: '#1f2937',
    colorText: '#1f2937',
    colorTextSecondary: '#6b7280',
    colorTextTertiary: '#9ca3af',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#f0f0f0',
    colorBgLayout: '#f5f7fa',
    colorBgContainer: '#ffffff',
    borderRadius: 10,
    wireframe: false,
    fontSize: 14,
    controlHeight: 36,
  },
  components: {
    Layout: {
      bodyBg: '#f5f7fa',
      headerBg: '#ffffff',
      footerBg: '#f5f7fa',
      siderBg: '#08233f',
      lightSiderBg: '#ffffff',
      triggerBg: '#071a32',
      triggerColor: '#cbd5e1',
    },
    Menu: {
      itemBg: '#ffffff',
      subMenuItemBg: '#fafafa',
      itemColor: '#374151',
      itemHoverBg: '#f5f7fa',
      itemHoverColor: '#1677ff',
      itemSelectedBg: 'rgba(22, 119, 255, 0.12)',
      itemSelectedColor: '#1677ff',
      activeBarHeight: 0,
      activeBarBorderWidth: 0,
    },
    Card: {
      colorBgContainer: '#ffffff',
      paddingLG: 20,
      borderRadiusLG: 10,
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#374151',
      colorBgContainer: '#ffffff',
      borderColor: '#f0f0f0',
      rowHoverBg: '#f5f7fa',
      rowSelectedBg: '#e6f4ff',
      rowSelectedHoverBg: '#bae0ff',
    },
    Button: {
      primaryShadow: 'none',
    },
  },
}

/** 主内容区嵌套 ConfigProvider：强制 defaultAlgorithm，避免 ProLayout navTheme=realDark 污染表格/卡片 */
export const hospitalContentLightTheme: ThemeConfig = {
  ...enterpriseTheme,
  algorithm: antdTheme.defaultAlgorithm,
}
