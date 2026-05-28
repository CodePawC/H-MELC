# PostgreSQL索引与性能优化设计 V1.0

# 《PostgreSQL索引与性能优化设计 V1.0》
## 一、总体原则
本系统数据量会持续增长，尤其是：
  * 设备台账
  * 维修工单
  * 生命周期事件
  * 发票
  * 付款记录
  * 审计日志
  * AI结果
  * 知识库向量


因此数据库设计必须从一开始考虑性能。
---
# 二、必须重点优化的高频查询
| 场景    | 高频查询条件                                   |
|-------|------------------------------------------|
| 设备列表  | 科室、状态、分类、关键字                             |
| 扫码查询  | qr_token、asset_code                      |
| 工单列表  | 状态、工程师、科室、设备、时间                          |
| 供应商发票 | supplier_id、payment_status、review_status |
| 应付款   | supplier_id、payable_status、aging_days    |
| 审计日志  | user_id、object_type、created_at           |
| AI任务  | status、task_type、source_object_id        |
| 知识库   | document_type、visibility_scope、embedding |


---
# 三、设备资产索引
## asset.asset
```
CREATE UNIQUE INDEX idx_asset_asset_codeON asset.asset(asset_code);CREATE INDEX idx_asset_departmentON asset.asset(department_id);CREATE INDEX idx_asset_statusON asset.asset(main_status);CREATE INDEX idx_asset_categoryON asset.asset(category_code);CREATE INDEX idx_asset_modelON asset.asset(model_id);CREATE INDEX idx_asset_supplierON asset.asset(supplier_id);CREATE INDEX idx_asset_status_departmentON asset.asset(main_status, department_id);CREATE INDEX idx_asset_deletedON asset.asset(deleted_at);
```

建议增加全文检索：
```
CREATE INDEX idx_asset_searchON asset.assetUSING gin ( to_tsvector('simple', coalesce(asset_name,'') || ' ' || coalesce(asset_code,'') || ' ' || coalesce(serial_number,'')));
```

---
# 四、二维码索引
## asset.asset_qrcode
```
CREATE UNIQUE INDEX idx_asset_qrcode_tokenON asset.asset_qrcode(qr_token);CREATE INDEX idx_asset_qrcode_assetON asset.asset_qrcode(asset_id);CREATE INDEX idx_asset_qrcode_statusON asset.asset_qrcode(status);
```

扫码必须走 `qr_token` 唯一索引。
---
# 五、生命周期事件索引
## asset.asset_event
```
CREATE INDEX idx_asset_event_asset_timeON asset.asset_event(asset_id, event_time DESC);CREATE INDEX idx_asset_event_typeON asset.asset_event(event_type);CREATE INDEX idx_asset_event_sourceON asset.asset_event(source_module, source_object_id);CREATE INDEX idx_asset_event_timeON asset.asset_event(event_time DESC);
```

如事件量很大，后期建议按年分区。
---
# 六、维修工单索引
## repair.repair_order
```
CREATE UNIQUE INDEX idx_repair_order_codeON repair.repair_order(order_code);CREATE INDEX idx_repair_assetON repair.repair_order(asset_id);CREATE INDEX idx_repair_statusON repair.repair_order(order_status);CREATE INDEX idx_repair_engineerON repair.repair_order(assigned_engineer_id);CREATE INDEX idx_repair_departmentON repair.repair_order(report_department_id);CREATE INDEX idx_repair_createdON repair.repair_order(created_at DESC);CREATE INDEX idx_repair_status_engineerON repair.repair_order(order_status, assigned_engineer_id);CREATE INDEX idx_repair_status_departmentON repair.repair_order(order_status, report_department_id);
```

工单查询最常用组合：
```
状态 + 工程师状态 + 科室设备 + 时间
```

---
# 七、发票索引
## finance.invoice
```
CREATE INDEX idx_invoice_supplierON finance.invoice(supplier_id);CREATE INDEX idx_invoice_payment_statusON finance.invoice(payment_status);CREATE INDEX idx_invoice_review_statusON finance.invoice(review_status);CREATE INDEX idx_invoice_businessON finance.invoice(related_business_type, related_business_id);CREATE INDEX idx_invoice_supplier_paymentON finance.invoice(supplier_id, payment_status);CREATE INDEX idx_invoice_numberON finance.invoice(invoice_number);
```

建议增加防重复索引：
```
CREATE UNIQUE INDEX idx_invoice_unique_number_supplierON finance.invoice(supplier_id, invoice_code, invoice_number)WHERE invoice_code IS NOT NULL AND invoice_number IS NOT NULL;
```

---
# 八、应付款索引
## finance.payable
```
CREATE UNIQUE INDEX idx_payable_codeON finance.payable(payable_code);CREATE INDEX idx_payable_supplierON finance.payable(supplier_id);CREATE INDEX idx_payable_statusON finance.payable(payable_status);CREATE INDEX idx_payable_sourceON finance.payable(source_type, source_id);CREATE INDEX idx_payable_agingON finance.payable(aging_days DESC);CREATE INDEX idx_payable_supplier_statusON finance.payable(supplier_id, payable_status);
```

---
# 九、付款记录索引
## finance.payment_record
```
CREATE UNIQUE INDEX idx_payment_codeON finance.payment_record(payment_code);CREATE INDEX idx_payment_supplierON finance.payment_record(supplier_id);CREATE INDEX idx_payment_dateON finance.payment_record(payment_date DESC);
```

## finance.payment_allocation
```
CREATE INDEX idx_payment_allocation_paymentON finance.payment_allocation(payment_record_id);CREATE INDEX idx_payment_allocation_invoiceON finance.payment_allocation(invoice_id);CREATE INDEX idx_payment_allocation_payableON finance.payment_allocation(payable_id);
```

---
# 十、供应商索引
## supplier.supplier
```
CREATE UNIQUE INDEX idx_supplier_codeON supplier.supplier(supplier_code);CREATE INDEX idx_supplier_nameON supplier.supplier(supplier_name);CREATE INDEX idx_supplier_statusON supplier.supplier(status);CREATE INDEX idx_supplier_credit_codeON supplier.supplier(unified_social_credit_code);
```

---
# 十一、AI任务索引
## ai.ai_task
```
CREATE INDEX idx_ai_task_statusON ai.ai_task(status);CREATE INDEX idx_ai_task_typeON ai.ai_task(task_type);CREATE INDEX idx_ai_task_sourceON ai.ai_task(source_module, source_object_id);CREATE INDEX idx_ai_task_createdON ai.ai_task(created_at DESC);
```

## ai.ai_analysis_result
```
CREATE INDEX idx_ai_result_taskON ai.ai_analysis_result(task_id);CREATE INDEX idx_ai_result_reviewON ai.ai_analysis_result(human_review_status);
```

---
# 十二、知识库索引
## knowledge.knowledge_document
```
CREATE INDEX idx_knowledge_doc_typeON knowledge.knowledge_document(document_type);CREATE INDEX idx_knowledge_doc_visibilityON knowledge.knowledge_document(visibility_scope);CREATE INDEX idx_knowledge_doc_sourceON knowledge.knowledge_document(source_module, source_object_id);
```

## knowledge.knowledge_chunk
```
CREATE INDEX idx_knowledge_chunk_docON knowledge.knowledge_chunk(document_id);
```

## pgvector 向量索引
```
CREATE INDEX idx_knowledge_embedding_vectorON knowledge.knowledge_embeddingUSING ivfflat (embedding vector_cosine_ops)WITH (lists = 100);
```

注意：
```
ANALYZE knowledge.knowledge_embedding;
```

---
# 十三、审计日志索引
## audit.audit_log
```
CREATE INDEX idx_audit_userON audit.audit_log(user_id);CREATE INDEX idx_audit_objectON audit.audit_log(object_type, object_id);CREATE INDEX idx_audit_actionON audit.audit_log(action);CREATE INDEX idx_audit_createdON audit.audit_log(created_at DESC);
```

审计日志后期建议：
# 按月分区
---
# 十四、建议分区表
以下表后期数据量会很大：
| 表                      | 建议分区 |
|------------------------|------|
| asset.asset_event      | 按年   |
| audit.audit_log        | 按月   |
| ai.ai_task             | 按月   |
| ai.ai_analysis_result  | 按月   |
| finance.payment_record | 按年   |
| repair.repair_order    | 按年   |


---
# 十五、JSONB索引
对 metadata 高频字段可建立 GIN：
```
CREATE INDEX idx_asset_event_metadataON asset.asset_eventUSING gin (metadata);
```

但不要滥用，只有明确查询场景再建。
---
# 十六、查询优化建议
| 场景    | 建议          |
|-------|-------------|
| 设备列表  | 分页 + 条件索引   |
| 工单列表  | 状态组合索引      |
| 大屏统计  | 使用物化视图      |
| ROI分析 | 使用定时快照      |
| 账龄分析  | 每日计算快照      |
| 审计日志  | 分区 + 冷归档    |
| AI结果  | 异步生成，不阻塞主流程 |


---
# 十七、物化视图建议
## 设备运行统计
```
CREATE MATERIALIZED VIEW dashboard.asset_summary ASSELECT department_id, main_status, count(*) AS asset_countFROM asset.assetWHERE deleted_at IS NULLGROUP BY department_id, main_status;
```

## 供应商应付款统计
```
CREATE MATERIALIZED VIEW dashboard.supplier_payable_summary ASSELECT supplier_id, sum(payable_amount) AS total_payable, sum(paid_amount) AS total_paid, sum(unpaid_amount) AS total_unpaidFROM finance.payableGROUP BY supplier_id;
```

建议定时刷新：
```
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard.asset_summary;
```

---
# 十八、性能验收指标
| 查询      | 目标      |
|---------|---------|
| 设备列表    | ≤ 500ms |
| 工单列表    | ≤ 800ms |
| 扫码解析    | ≤ 300ms |
| 供应商付款首页 | ≤ 1s    |
| 院领导驾驶舱  | ≤ 3s    |
| 知识库检索   | ≤ 2s    |
| 审计日志查询  | ≤ 2s    |


---
# 十九、下一步建议
继续进入：
# 《医疗设备ROI算法模型设计 V1.0》
重点定义：
  * 使用率
  * 开机率
  * 收入贡献
  * 维修成本
  * 停机损失
  * 折旧成本
  * ROI
  * 投资回收期
  * 调拨建议
  * 更新报废建议
  * AI采购建议