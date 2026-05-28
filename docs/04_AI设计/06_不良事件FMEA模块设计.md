# 不良事件 FMEA 模块设计 V1.0

# 《不良事件 FMEA 模块设计 V1.0》
## 一、模块定位
该模块用于把设备维修、故障、投诉、巡检异常与医疗器械不良事件管理联动起来。
核心目标：
  * 发现疑似不良事件
  * 判断风险等级
  * 形成调查记录
  * 完成 FMEA 风险分析
  * 生成 CAPA 整改措施
  * 沉淀风险知识库
  * 支持后续监管上报材料准备


---
## 二、触发来源
| 来源    | 触发场景        |
|-------|-------------|
| 维修工单  | 设备故障影响临床使用  |
| 科室报修  | 涉及患者安全或治疗中断 |
| 巡检记录  | 发现高风险隐患     |
| PM记录  | 发现重复性缺陷     |
| 厂家反馈  | 产品设计或批次问题   |
| 供应商外修 | 发现系统性故障     |
| AI分析  | 识别疑似不良事件    |


---
## 三、AI疑似不良事件识别规则
AI重点识别：
| 识别维度        | 示例              |
|-------------|-----------------|
| 是否涉及患者伤害    | 监护报警失效、输液异常     |
| 是否存在潜在伤害    | 呼吸机异常、除颤仪故障     |
| 是否重复发生      | 同型号多台同类故障       |
| 是否高风险设备     | 生命支持、急救、放射治疗    |
| 是否影响诊疗      | 手术中断、检查延误       |
| 是否疑似设计缺陷    | 结构、软件、材料、报警逻辑问题 |
| 是否涉及注册证产品质量 | 同批次、同厂家、同型号问题   |


---
## 四、不良事件流程
```
异常发现→ AI初筛→ 人工确认→ 创建不良事件调查→ 风险分级→ FMEA分析→ CAPA整改→ 责任人落实→ 效果验证→ 关闭归档→ 知识库沉淀
```

---
## 五、不良事件状态机
| 状态               | 含义      |
|------------------|---------|
| SUSPECTED        | 疑似事件    |
| CONFIRMED        | 已确认     |
| INVESTIGATING    | 调查中     |
| RISK_ASSESSED    | 已完成风险评估 |
| CAPA_PENDING     | 待整改     |
| CAPA_IN_PROGRESS | 整改中     |
| EFFECT_VERIFYING | 效果验证中   |
| CLOSED           | 已关闭     |
| REJECTED         | 排除不良事件  |


---
## 六、FMEA评分模型
FMEA核心指标：
| 指标  | 含义                         |
|-----|----------------------------|
| S   | Severity，严重度               |
| O   | Occurrence，发生度             |
| D   | Detection，探测度              |
| RPN | Risk Priority Number，风险优先数 |


计算公式：
```
RPN = S × O × D
```

---
## 七、严重度 S 评分
| 分值   | 标准                   |
|------|----------------------|
| 1-2  | 无明显影响，仅一般提示          |
| 3-4  | 轻微影响设备使用，不影响诊疗       |
| 5-6  | 影响诊疗效率，需临时替代         |
| 7-8  | 可能影响患者安全或造成治疗中断      |
| 9-10 | 可能导致严重伤害、抢救延误或重大安全事件 |


---
## 八、发生度 O 评分
| 分值   | 标准             |
|------|----------------|
| 1-2  | 极少发生，历史无类似记录   |
| 3-4  | 偶发，年度内少量发生     |
| 5-6  | 间断发生，同型号有多起记录  |
| 7-8  | 频繁发生，短期内重复出现   |
| 9-10 | 高概率发生，已形成系统性风险 |


---
## 九、探测度 D 评分
| 分值   | 标准              |
|------|-----------------|
| 1-2  | 极易发现，有自动报警或日常点检 |
| 3-4  | 较易发现，常规巡检可识别    |
| 5-6  | 中等，需专业检测或维修发现   |
| 7-8  | 较难发现，临床使用中才暴露   |
| 9-10 | 极难发现，发生前几乎无法识别  |


---
## 十、RPN风险分级
| RPN范围   | 风险等级 | 处理要求         |
|---------|------|--------------|
| 1-80    | 低风险  | 记录观察         |
| 81-160  | 中风险  | 制定改进措施       |
| 161-240 | 高风险  | 限期整改，跟踪验证    |
| >240    | 极高风险 | 建议停用、上报、专项整改 |


---
## 十一、CAPA整改管理
CAPA包括：
| 类型                | 内容   |
|-------------------|------|
| Corrective Action | 纠正措施 |
| Preventive Action | 预防措施 |


整改措施示例：
  * 暂停使用设备
  * 更换配件
  * 增加PM频次
  * 修改操作流程
  * 增加使用培训
  * 要求厂家技术分析
  * 批量排查同型号设备
  * 调整采购准入标准
  * 纳入更新计划


---
## 十二、CAPA字段设计
| 字段                     | 说明    |
|------------------------|-------|
| capa_code              | 整改编号  |
| incident_id            | 关联事件  |
| action_type            | 纠正/预防 |
| action_content         | 整改内容  |
| responsible_department | 责任科室  |
| responsible_person     | 责任人   |
| deadline               | 完成期限  |
| completion_status      | 完成状态  |
| verification_method    | 验证方式  |
| verification_result    | 验证结果  |


---
## 十三、数据库表建议
### adverse_event
```
CREATE TABLE risk.adverse_event ( id UUID PRIMARY KEY, event_code VARCHAR(64) UNIQUE NOT NULL, source_type VARCHAR(64), source_id UUID, asset_id UUID, event_title VARCHAR(255), event_description TEXT, patient_involved BOOLEAN DEFAULT FALSE, clinical_impact TEXT, event_status VARCHAR(64), risk_level VARCHAR(64), ai_suggested BOOLEAN DEFAULT FALSE, ai_result_id UUID, created_by UUID, created_at TIMESTAMP DEFAULT now(), closed_at TIMESTAMP);
```

### fmea_analysis
```
CREATE TABLE risk.fmea_analysis ( id UUID PRIMARY KEY, adverse_event_id UUID NOT NULL REFERENCES risk.adverse_event(id), failure_mode TEXT, failure_cause TEXT, failure_effect TEXT, severity_score INTEGER, occurrence_score INTEGER, detection_score INTEGER, rpn INTEGER, risk_level VARCHAR(64), recommended_action TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now());
```

### capa_action
```
CREATE TABLE risk.capa_action ( id UUID PRIMARY KEY, adverse_event_id UUID NOT NULL REFERENCES risk.adverse_event(id), action_type VARCHAR(64), action_content TEXT, responsible_department_id UUID, responsible_person_id UUID, deadline DATE, completion_status VARCHAR(64), verification_method TEXT, verification_result TEXT, created_at TIMESTAMP DEFAULT now(), completed_at TIMESTAMP);
```

---
## 十四、AI辅助调查报告
AI可生成初稿：
```
一、事件基本情况二、涉及设备信息三、故障现象描述四、历史类似事件五、初步原因分析六、FMEA风险评分建议七、是否建议停用八、整改措施建议九、是否建议上报
```

人工审核后才能形成正式报告。
---
## 十五、页面设计
### 不良事件列表
  * 事件编号
  * 设备名称
  * 科室
  * 风险等级
  * RPN
  * 当前状态
  * 责任人
  * 截止日期


### 不良事件详情
  * 事件经过
  * 设备信息
  * 维修关联
  * AI分析
  * FMEA表
  * CAPA整改
  * 附件资料
  * 审批记录
  * 关闭验证


---
## 十六、与维修模块联动
维修工单关闭前，系统检查：
  * 是否高风险设备
  * 是否重复故障
  * 是否影响临床
  * 是否AI提示疑似事件


若满足条件：
```
提示工程师/设备科负责人确认是否发起不良事件流程
```

---
## 十七、与知识库联动
事件关闭后，自动沉淀：
  * 风险案例
  * 故障模式
  * 处置措施
  * FMEA评分
  * CAPA整改经验
  * 厂家反馈


---
下一步建议继续进入：
# 《供应商信用评分与付款优先级模型 V1.0》