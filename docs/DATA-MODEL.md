# 数据模型补充说明

## H-UMDG 引用字段

`asset.asset` 新增 H-UMDG 引用字段。它们是外部主数据引用和快照，不是本地权威库。

装备字典引用：

- `hmdm_equipment_category_code`
- `hmdm_equipment_category_name`
- `hmdm_equipment_name_code`
- `hmdm_standard_name`
- `hmdm_regulatory_major_category`
- `hmdm_primary_product_category`
- `hmdm_secondary_product_category`
- `hmdm_management_class`

厂商机构引用：

- `manufacturer_org_code`
- `manufacturer_name`
- `supplier_org_code`
- `supplier_name`
- `after_sales_org_code`
- `after_sales_name`
- `service_provider_org_code`
- `service_provider_name`

`asset_code`、`brand`、`model`、`serial_number`、`department_name`、`location`、`purchase_date`、`original_value`、`warranty_status`、`main_status` 等仍是具体设备业务属性，由 H-MELC 维护。

设备新增页面保存 H-UMDG 返回的标准名称、分类、监管属性和厂商机构编码/名称快照；附件资料当前停留在前端选择态，正式上传仍需后续接入附件接口。

## 只读缓存

表：`integration.hmdm_dictionary_cache`

用途：

- 提升设备新增、检索和联调页面加载速度。
- H-UMDG 暂时不可用时提供只读备选。
- 保留最近一次成功同步的数据。

规则：

- 缓存不是权威数据。
- 用户不能直接编辑缓存。
- 缓存过期时前端需要提示。
- 外部 API 恢复后应自动或手动刷新。

## 候选申请

表：

- `integration.equipment_standard_name_request`
- `integration.manufacturer_vendor_request`

这些表只记录候选申请和待同步状态，不成为本系统的标准名称或厂商机构权威库。
