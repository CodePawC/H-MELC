const KEY_LS = 'mep_admin_access_token'
const KEY_SS = 'mep_admin_access_token_ss'

export function isMockToken(token: string | null | undefined): boolean {
  return !!token && token.startsWith('MOCK_TOKEN:')
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEY_LS) ?? sessionStorage.getItem(KEY_SS)
}

export function setAccessToken(token: string, remember: boolean) {
  clearAccessToken()
  if (remember) localStorage.setItem(KEY_LS, token)
  else sessionStorage.setItem(KEY_SS, token)
}

export function clearAccessToken() {
  localStorage.removeItem(KEY_LS)
  sessionStorage.removeItem(KEY_SS)
}
