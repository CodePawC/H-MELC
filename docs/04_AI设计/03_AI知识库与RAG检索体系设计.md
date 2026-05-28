# AI知识库与RAG检索体系设计 V1.0

# 《AI知识库与RAG检索体系设计 V1.0》
## 一、模块定位
AI知识库不是简单文件库，而是平台的“经验大脑”。
核心目标：
  * 让工程师快速查找维修经验
  * 让AI基于医院真实资料回答
  * 让制度、流程、案例、票据、供应商经验沉淀
  * 支持维修、不良事件、付款、ROI、合规等模块智能分析


---
## 二、知识库分类
| 知识库    | 内容               |
|--------|------------------|
| 维修案例库  | 工单、故障原因、处理方法     |
| 厂家资料库  | 说明书、维修手册、电路图     |
| 制度流程库  | 医学装备制度、财务制度、采购制度 |
| 合规法规库  | 放射、辐射、计量、特种设备要求  |
| 不良事件库  | 调查报告、FMEA、CAPA   |
| 供应商知识库 | 资质、履约、报价、维修记录    |
| 财务对账库  | 发票、随货同行、付款规则     |
| ROI分析库 | 设备效益、调拨、更新案例     |


---
## 三、RAG处理流程
```
文件上传/业务沉淀→ 文档解析→ 文本清洗→ 文档切片→ 元数据标注→ 向量化→ 入库→ 权限绑定→ 检索→ 重排序→ AI生成回答→ 引用来源→ 人工反馈
```

---
## 四、知识来源
| 来源     | 示例          |
|--------|-------------|
| 人工上传   | 厂家手册、制度文件   |
| 业务自动生成 | 维修报告、巡检报告   |
| AI自动总结 | 故障案例、付款分析   |
| 外部资料   | 法规、标准、说明书   |
| 供应商资料  | 注册证、授权书、报价单 |
| 设备档案   | 验收、培训、计量证书  |


---
## 五、知识文档元数据
每个文档必须带元数据：
| 字段               | 说明     |
|------------------|--------|
| document_type    | 文档类型   |
| source_module    | 来源模块   |
| source_object_id | 来源业务对象 |
| asset_id         | 关联设备   |
| supplier_id      | 关联供应商  |
| manufacturer_id  | 关联厂家   |
| model_id         | 关联型号   |
| department_id    | 关联科室   |
| visibility_scope | 可见范围   |
| security_level   | 安全级别   |
| effective_date   | 生效日期   |
| version          | 版本号    |


---
## 六、切片策略
不同文档采用不同切片方式：
| 文档类型    | 切片策略           |
|---------|----------------|
| 维修报告    | 按故障现象、原因、方法、结论 |
| 厂家手册    | 按章节、标题、步骤      |
| 制度文件    | 按条款            |
| 发票/随货同行 | 按结构化字段         |
| FMEA报告  | 按失效模式、原因、措施    |
| 会议纪要    | 按议题            |
| 设备说明书   | 按功能模块          |


---
## 七、向量库设计
一期建议使用：
# PostgreSQL + pgvector
核心表：
```
knowledge_documentknowledge_chunkknowledge_embeddingknowledge_feedbackai_retrieval_reference
```

---
## 八、核心表设计
### knowledge_document
```
CREATE TABLE knowledge.knowledge_document ( id UUID PRIMARY KEY, title VARCHAR(255) NOT NULL, document_type VARCHAR(64), source_module VARCHAR(64), source_object_id UUID, file_id UUID, content_text TEXT, visibility_scope VARCHAR(64), security_level VARCHAR(64), created_by UUID, created_at TIMESTAMP DEFAULT now());
```

### knowledge_chunk
```
CREATE TABLE knowledge.knowledge_chunk ( id UUID PRIMARY KEY, document_id UUID NOT NULL REFERENCES knowledge.knowledge_document(id), chunk_index INTEGER NOT NULL, chunk_title VARCHAR(255), chunk_text TEXT NOT NULL, metadata JSONB, created_at TIMESTAMP DEFAULT now());
```

### knowledge_embedding
```
CREATE TABLE knowledge.knowledge_embedding ( id UUID PRIMARY KEY, chunk_id UUID NOT NULL REFERENCES knowledge.knowledge_chunk(id), embedding VECTOR(1536), embedding_model VARCHAR(128), created_at TIMESTAMP DEFAULT now());
```

### ai_retrieval_reference
```
CREATE TABLE ai.ai_retrieval_reference ( id UUID PRIMARY KEY, ai_task_id UUID, ai_result_id UUID, chunk_id UUID, relevance_score NUMERIC(5,4), used_in_answer BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT now());
```

---
## 九、权限控制
知识库必须继承业务权限。
例如：
| 用户   | 可检索内容           |
|------|-----------------|
| 科室人员 | 本科室设备说明、使用流程    |
| 工程师  | 维修案例、厂家手册、历史工单  |
| 财务   | 发票、付款、合同相关知识    |
| 供应商  | 本供应商资料与公开规则     |
| 院领导  | 汇总分析、风险报告       |
| 普通用户 | 不可检索敏感财务与不良事件详情 |


原则：
# 用户看不到的数据，AI也不能检索。
---
## 十、检索策略
建议采用混合检索：
```
关键词检索 + 向量检索 + 元数据过滤 + 权限过滤 + 重排序
```

例如工程师查询：
> “迈瑞监护仪NIBP模块压力异常怎么处理？”
系统应优先检索：
  * 同品牌
  * 同型号
  * 同故障类型
  * 同科室历史案例
  * 厂家手册相关章节
  * 已确认有效维修报告


---
## 十一、AI回答格式
AI回答必须包含：
```
{ "answer": "建议排查袖带管路、电磁阀、压力传感器及NIBP模块供电。", "confidence": 0.86, "sources": [ { "document_title": "迈瑞监护仪维修案例", "chunk_id": "uuid", "relevance_score": 0.91 } ], "limitations": "未检索到该型号厂家原厂维修手册。"}
```

---
## 十二、知识沉淀机制
业务流程关闭后自动沉淀：
| 流程     | 沉淀知识    |
|--------|---------|
| 维修完成   | 故障案例    |
| 不良事件关闭 | 风险案例    |
| 竞价结束   | 供应商报价经验 |
| 发票审核   | 票据问题案例  |
| PM巡检   | 维护经验    |
| ROI分析  | 配置决策案例  |


---
## 十三、人工反馈机制
用户可对AI回答进行反馈：
| 反馈  | 用途   |
|-----|------|
| 有用  | 提升权重 |
| 无用  | 降低权重 |
| 错误  | 进入复核 |
| 需补充 | 添加知识 |
| 过期  | 标记失效 |


---
## 十四、知识生命周期
```
草稿→ 待审核→ 已发布→ 需更新→ 已过期→ 已归档
```

重要知识必须有版本管理，尤其：
  * 制度文件
  * 法规依据
  * 厂家手册
  * 不良事件案例
  * 财务规则


---
## 十五、下一步建议
继续进入：
# 《工作流引擎详细设计 V1.0》