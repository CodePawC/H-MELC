export type UserPublic = {
  id: string
  username: string
  display_name: string | null
  roles: string[]
}

export type LoginResult = {
  access_token: string
  token_type: string
  expires_in: number
  user: UserPublic
}
