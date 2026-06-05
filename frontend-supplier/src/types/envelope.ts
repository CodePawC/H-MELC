export type Envelope<T> = {
  code?: number | string
  success?: boolean
  message?: string
  data?: T
}

export type PagedResult<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
}
