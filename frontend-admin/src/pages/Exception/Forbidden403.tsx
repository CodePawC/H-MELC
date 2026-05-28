import type { ReactNode } from 'react'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

type Forbidden403PageProps = {
  title?: string
  subTitle?: ReactNode
}

export function Forbidden403Page({
  title = '403',
  subTitle = '您没有权限访问该页面，如需开通请联系医学装备科或信息科管理员。',
}: Forbidden403PageProps) {
  const nav = useNavigate()
  return (
    <Result
      status="403"
      title={title}
      subTitle={subTitle}
      extra={
        <Button type="primary" onClick={() => nav('/')}>
          返回工作台
        </Button>
      }
    />
  )
}
