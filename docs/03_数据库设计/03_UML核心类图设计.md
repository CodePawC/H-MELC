# UML核心类图设计 V1.0

# 《UML核心类图设计 V1.0》
下面用“面向对象模型”的方式，把后端 ORM / Service 设计核心类先确定下来。
---
# 一、核心类总览
```
Asset├─ AssetEvent├─ AssetStatusHistory├─ AssetQRCode├─ RepairOrder├─ MaintenancePlan├─ InspectionTask├─ CalibrationRecord└─ AssetTaxonomyRelationRepairOrder├─ RepairAttachment├─ RepairProcessRecord├─ RepairReport├─ SupplierProject└─ AiAnalysisResultSupplier├─ SupplierUser├─ SupplierQualification├─ SupplierBid├─ Invoice├─ Payable└─ PaymentRecordKnowledgeDocument├─ KnowledgeChunk├─ KnowledgeEmbedding└─ KnowledgeFeedbackWorkflowInstance├─ WorkflowTask└─ WorkflowActionLog
```

---
# 二、Asset 设备资产类
```
class Asset: id: UUID asset_code: str asset_name: str category_code: str model_id: UUID manufacturer_id: UUID supplier_id: UUID serial_number: str department_id: UUID location_id: UUID purchase_date: date install_date: date warranty_end: date original_value: Decimal main_status: str lifecycle_phase: str risk_level: str regulatory_level: str ai_health_score: Decimal usage_score: Decimal roi_score: Decimal events: list[AssetEvent] repair_orders: list[RepairOrder]
```

## 核心方法
```
change_status(to_status, reason, operator)add_event(event_type, content, operator)bind_qrcode()mark_idle()mark_scrapped()calculate_health_score()
```

---
# 三、AssetEvent 生命周期事件类
```
class AssetEvent: id: UUID asset_id: UUID event_type: str event_title: str event_content: str source_module: str source_object_id: UUID operator_id: UUID operator_name: str event_time: datetime metadata: dict
```

用途：
  * 追溯
  * 审计
  * AI训练
  * 设备画像
  * 生命周期时间线


---
# 四、RepairOrder 维修工单类
```
class RepairOrder: id: UUID order_code: str asset_id: UUID report_department_id: UUID reporter_id: UUID reporter_name: str reporter_phone: str fault_description: str fault_level: str priority: str order_status: str assigned_engineer_id: UUID accepted_at: datetime completed_at: datetime confirmed_at: datetime is_outsourced: bool is_return_factory: bool is_chargeable: bool estimated_cost: Decimal actual_cost: Decimal ai_risk_level: str ai_incident_suggestion: bool process_records: list[RepairProcessRecord] attachments: list[RepairAttachment] report: RepairReport
```

## 核心方法
```
claim(engineer)assign(engineer, manager)add_process_record(content)request_outsource()request_return_factory()complete()confirm_by_department()generate_ai_report()check_possible_incident()
```

---
# 五、RepairReport 维修报告类
```
class RepairReport: id: UUID repair_order_id: UUID fault_cause: str repair_method: str replaced_parts: str test_result: str conclusion: str ai_generated: bool ai_result_id: UUID department_confirm_status: str department_confirm_by: UUID department_confirm_at: datetime
```

---
# 六、Supplier 供应商类
```
class Supplier: id: UUID supplier_code: str supplier_name: str unified_social_credit_code: str contact_name: str contact_phone: str contact_email: str supplier_type: str status: str risk_score: Decimal payment_risk_level: str users: list[SupplierUser] qualifications: list[SupplierQualification] invoices: list[Invoice] payments: list[PaymentRecord]
```

## 核心方法
```
update_risk_score()get_unpaid_amount()get_aging_summary()check_qualification_expiry()
```

---
# 七、SupplierProject 竞价项目类
```
class SupplierProject: id: UUID project_code: str project_type: str title: str description: str source_business_type: str source_business_id: UUID status: str publish_at: datetime bid_deadline: datetime created_by: UUID bids: list[SupplierBid]
```

## 核心方法
```
publish()close_bidding()evaluate_bids()select_winner()generate_compare_report()
```

---
# 八、SupplierBid 报价类
```
class SupplierBid: id: UUID project_id: UUID supplier_id: UUID bid_amount: Decimal service_plan: str delivery_days: int warranty_terms: str status: str submitted_at: datetime
```

关键规则：
  * 报价截止前可修改
  * 截止后不可修改
  * 供应商之间不可互看
  * 开标后生成比价表


---
# 九、Invoice 发票类
```
class Invoice: id: UUID invoice_code: str invoice_number: str supplier_id: UUID invoice_type: str invoice_date: date total_amount: Decimal tax_amount: Decimal amount_without_tax: Decimal related_business_type: str related_business_id: UUID ai_extract_status: str match_status: str payment_status: str paid_amount: Decimal unpaid_amount: Decimal file_id: UUID
```

## 核心方法
```
start_ai_extract()match_business_object()review()allocate_payment(amount)mark_disputed()
```

---
# 十、Payable 应付款类
```
class Payable: id: UUID payable_code: str supplier_id: UUID source_type: str source_id: UUID payable_amount: Decimal paid_amount: Decimal unpaid_amount: Decimal payable_status: str due_date: date aging_days: int priority_level: str ai_priority_reason: str
```

---
# 十一、PaymentRecord 付款记录类
```
class PaymentRecord: id: UUID payment_code: str supplier_id: UUID payment_amount: Decimal payment_date: date payment_method: str finance_voucher_no: str allocations: list[PaymentAllocation]
```

## 核心方法
```
allocate_to_invoice(invoice, amount)allocate_to_payable(payable, amount)reverse(reason)
```

---
# 十二、PaymentAllocation 付款分摊类
```
class PaymentAllocation: id: UUID payment_record_id: UUID invoice_id: UUID | None payable_id: UUID | None allocated_amount: Decimal
```

关键校验：
```
allocated_amount <= invoice.unpaid_amountsum(allocations) <= payment_amount
```

---
# 十三、AiTask AI任务类
```
class AiTask: id: UUID task_type: str source_module: str source_object_id: UUID input_type: str input_file_id: UUID input_text: str status: str model_name: str prompt_version: str results: list[AiAnalysisResult]
```

## 核心方法
```
start()complete(result)fail(error)retry()
```

---
# 十四、AiAnalysisResult AI分析结果类
```
class AiAnalysisResult: id: UUID task_id: UUID result_type: str result_json: dict result_text: str confidence_score: Decimal human_review_status: str reviewed_by: UUID reviewed_at: datetime
```

---
# 十五、KnowledgeDocument 知识文档类
```
class KnowledgeDocument: id: UUID title: str document_type: str source_module: str source_object_id: UUID file_id: UUID content_text: str visibility_scope: str chunks: list[KnowledgeChunk]
```

## 核心方法
```
split_into_chunks()generate_embeddings()publish()archive()
```

---
# 十六、WorkflowInstance 工作流实例类
```
class WorkflowInstance: id: UUID workflow_definition_id: UUID business_type: str business_id: UUID current_node_id: UUID status: str tasks: list[WorkflowTask]
```

## 核心方法
```
start()approve(task, user, comment)reject(task, user, comment)transfer_to_next_node()terminate()
```

---
# 十七、AuditLog 审计日志类
```
class AuditLog: id: UUID user_id: UUID username: str role_code: str action: str object_type: str object_id: UUID before_data: dict after_data: dict ip_address: str user_agent: str created_at: datetime
```

---
# 十八、类关系关键约束
| 约束             | 说明                     |
|----------------|------------------------|
| Asset 删除       | 只能逻辑删除                 |
| RepairOrder 关闭 | 必须有维修报告和科室确认           |
| Invoice 付款     | 必须通过 PaymentAllocation |
| AI结果应用         | 必须人工审核                 |
| SupplierBid    | 截止后不可修改                |
| AuditLog       | 不允许修改和删除               |
| PaymentRecord  | 不允许物理删除，只能冲销           |


---
下一步建议继续进入：
# 《时序图设计 V1.0》
重点输出：
  * 扫码报修时序图
  * 工程师接单时序图
  * AI维修报告时序图
  * 发票上传识别时序图
  * 部分付款分摊时序图
  * 供应商竞价时序图