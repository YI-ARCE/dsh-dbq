# dsh-dbq

[DSH](https://github.com/deepseek-ai/deepseek-harness) 插件：数据库连接查询。在对话里通过 4 个模型工具（`db_connections` / `db_tables` / `db_describe` / `db_query`）探索并查询数据库，查询结果在界面渲染为表格卡片；输入框 `@` 触发表引用选择器，先列连接、Tab/回车进入后再选表（官方 @文件 同款 drill 交互）。执行层是单文件 Go 网关 `dbq.exe`（纯 Go 驱动，无 CGO），支持 **MySQL / PostgreSQL / SQLite**。

> **仅支持 Windows**（网关二进制为 `dbq.exe`）。

## 安装

### 1) 安装插件（网关已内置）

```powershell
# npm
dsh plugin --profile web add dsh-dbq

# 或直接从 GitHub 仓库装（仓库内自带 vendor/dbq.exe，无需单独下载）
dsh plugin --profile web add github:YI-ARCE/dsh-dbq
```

也支持本地 tarball：`dsh plugin --profile web add .\dsh-dbq-0.2.0.tgz`。

> git 安装首次会被 pnpm 拦构建脚本：按提示把打印的 key 加进 profile 目录 `pnpm-workspace.yaml` 的 `allowBuilds` 再重跑即可（本插件无构建脚本，通常不会遇到）。

### 2) 重启 dsh web（桌面壳 = 关掉窗口重开）

boot graph 在启动时组装，插件、模型工具与设置页都在重启后生效。装完打开 **设置 → 数据库连接 → 网关**，「就绪」徽章即一切正常。

## 网关解析顺序与手动放置（可选）

插件按以下顺序取 `dbq.exe`，通常内置副本直接命中：

1. **设置项**：设置 → 数据库连接 → 网关 中填写的完整路径（路径不存在会明确报错，不静默回退）；
2. **插件内置**：插件包内 `vendor/dbq.exe`（npm / git / tarball 安装都自带）；
3. **默认位置**：`%USERPROFILE%\.dsh\dbq\dbq.exe`。

手动放置仅在内置副本缺失时需要——从仓库直接下载
[`vendor/dbq.exe`](https://github.com/YI-ARCE/dsh-dbq/raw/main/vendor/dbq.exe)
放到默认位置，或在设置页填完整路径。

## 配置连接

**设置 → 数据库连接**：

| 字段 | 说明 |
|---|---|
| 连接 id | 对话中引用的名字，如 `shop-mysql` |
| 类型 | MySQL（3306）/ PostgreSQL（5432）/ SQLite（database 填文件路径） |
| 密码来源 | `inline` 明文存当前 profile 的 `cordis.patch.yml`（默认）；`env` 网关进程环境变量；`credential` DSH 凭据库（ref 默认 `dbq/<连接id>`，经 `DBQ_PASSWORD_<ID>` 注入网关） |
| 只读 | 默认开；语句白名单只放行单条 `SELECT / WITH / SHOW / EXPLAIN / DESC` |
| 禁止表 | `denyTables` 词法黑名单，逗号分隔，如 `users.password_hash` |
| 限额 | 行数 / 超时可按连接覆盖全局默认（默认 200 行 / 8s / 单元格 2000 字符 / 结果 256KB） |

保存即时生效：设置页通过 `configForms` 修改 `tool-dbq` 条目的实时 Config，并持久化到当前 profile 的 Cordis patch。升级自旧版时，请将备份 `settings.yaml.imported` 的 `dsh-dbq` 段迁到 `tool-dbq` 的 `config`；不要删除备份。

## 使用

对话里直接说；或在输入框敲 `@` 打开表引用选择器：第一级列出启用的**连接**，Tab / 回车（或点行尾箭头）进入某个连接后第二级列出该库的**表**，顶部面包屑可返回上级；也可以直接输入 `连接.` 前缀（如 `@shop-mysql.`）直达该库的表列表。查询匹配不到任何连接名时，回退为跨连接的表名搜索。选中后插入表标签，发送为 `#db:连接[.schema].表` 记号；输入框左侧的数据库按钮等价于替你敲了一个 `@`。

> 查一下 shop-mysql 里订单量前十的用户

模型会依次 `db_connections` → `db_tables` / `db_describe` → `db_query`，查询结果以表格卡片展示，超限截断会标记 `truncated`。

## 安全模型（网关强制）

1. 语句白名单：单条 `SELECT / WITH / SHOW / EXPLAIN / DESC`；禁止引号外分号（多语句）、`FOR UPDATE/SHARE`、`INTO OUTFILE/DUMPFILE`。
2. 会话级只读：PG `default_transaction_read_only`；MySQL 会话 `transaction_read_only`；SQLite `mode=ro`。
3. 限额：行数 / 单元格字符 / 结果字节 / 超时，可全局或按连接、按调用覆盖。
4. 连接级 `denyTables` 词法黑名单。
5. 网关配置经 stdin 传入（`--stdin-config`），密码不落命令行；stdout 恒为 JSON 信封。

## 故障排查

| 现象 | 处理 |
|---|---|
| 模型工具列表没有 db_* | 插件未生效：`dsh plugin --profile web` 确认已装 dsh-dbq，并重启 dsh web |
| 设置页网关显示「未找到」 | 内置副本与默认位置都没有 dbq.exe：按「网关解析顺序」手动放置，或在网关卡填完整路径后「重新检测」 |
| 「已找到但未响应」 | dbq.exe 可能被杀软拦截或损坏：重新下载放入，或加入白名单 |
| 工具报「设置的网关路径不存在」 | 网关卡清空路径，回退插件内置副本 |

## 卸载

```powershell
dsh plugin --profile web remove dsh-dbq
```

（当前 profile 的插件配置不会随插件卸载自动清除；`%USERPROFILE%\.dsh\dbq\` 下手动放置的网关也不会自动删除。）

## 开发

| 文件 | 作用 |
|---|---|
| `lib/index.js` | 宿主半：实时 Config（schemastery）+ 4 个模型工具 + `/dbq-api`（表清单、网关状态） |
| `lib/client.js` | 客户端半（预构建 bundle）：设置页（连接管理 + 网关状态卡）+ `db_query` 表格卡片 + `@` 表引用选择器（连接 → 表 两级 drill） |
| `vendor/dbq.exe` | 随包分发的 Go 网关（Windows x64）；更新网关后需重新发布插件版本 |
| `cordis.patch.yml` | bundle patch：官方层之后插入本插件 row |

本地开发：`dsh plugin --profile web add C:/path/to/dsh-dbq`；改 `lib/client.js` 有约 500ms 热替换，改 `lib/index.js` 需重启 dsh web。发布前 `npm pack --dry-run` 核对包内容。
