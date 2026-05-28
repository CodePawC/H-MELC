/**
 * 与需求文档中的 userStore 对齐：本项目使用 Zustand `useAuthSession` 作为用户会话唯一来源。
 */
export { useAuthSession as useUserStore } from './authSession'
export type { AuthUserProfile } from '../types/authProfile'
