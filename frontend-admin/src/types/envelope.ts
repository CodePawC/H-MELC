/** 与后端 `docs/06_接口设计/01_API接口设计.md` 统一前缀 `/api/v1` 信封一致。 */
export type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}
