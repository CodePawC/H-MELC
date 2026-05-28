/**
 * 登录编排：Mock 校验账号/验证码；真实模式走 HTTP。
 */

import { IS_AUTH_MOCK } from '../config/authMode'
import { login as apiLogin } from '../api/auth'
import { findMockAccount } from '../mock/users'
import type { LoginResult } from '../types/auth'
import { hydrateMockProfile } from './permission'
import { persistAuthProfile } from '../lib/authProfileStorage'
import { setAccessToken } from '../lib/token'

export type LoginPayload = {
  username: string
  password: string
  remember: boolean
  captchaExpected: string
  captchaInput: string
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LoginError'
  }
}

function assertCaptcha(expected: string, input: string) {
  if (expected.trim() !== input.trim()) {
    throw new LoginError('验证码不正确')
  }
}

/** 生成简单算术验证码：返回 { question, answer } */
export function createMathCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1
  const b = Math.floor(Math.random() * 9) + 1
  return { question: `${a} + ${b} = ?`, answer: String(a + b) }
}

export async function performLogin(payload: LoginPayload): Promise<LoginResult> {
  assertCaptcha(payload.captchaExpected, payload.captchaInput)

  if (IS_AUTH_MOCK) {
    const acc = findMockAccount(payload.username)
    if (!acc) throw new LoginError('用户名或密码错误')
    if (acc.disabled) throw new LoginError('账号已禁用，请联系管理员')
    if (acc.password !== payload.password) throw new LoginError('用户名或密码错误')

    const profile = hydrateMockProfile({ ...acc, lastLoginAt: new Date().toISOString() })
    const token = `MOCK_TOKEN:${acc.username}`
    setAccessToken(token, payload.remember)
    persistAuthProfile(profile)

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400,
      user: {
        id: profile.id,
        username: profile.username,
        display_name: profile.displayName,
        roles: profile.roles,
      },
    }
  }

  const data = await apiLogin(payload.username.trim(), payload.password)
  setAccessToken(data.access_token, payload.remember)
  return data
}
