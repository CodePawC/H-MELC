/** 与 docs/06 常见分页信封内 data 对齐 */

export type Paged<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
}
