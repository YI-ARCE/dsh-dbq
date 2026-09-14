window.__ModuleLoader__.load({
	id: "dsh-dbq",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = null;
		try { primitives = require("@deepseek-ai/dsh-client-ui-primitives"); } catch (e) { primitives = null; }
		const createElement = react.createElement;
		const useState = react.useState;
		const useEffect = react.useEffect;
		const useSyncExternalStore = react.useSyncExternalStore;
		//#region shared constants
		const SETTINGS_NS = "dsh-dbq";
		const DEFAULT_LIMITS = { maxRows: 200, timeoutMs: 8000, cellChars: 2000, resultBytes: 262144 };
		const DB_TYPES = [
			{ value: "mysql", label: "MySQL" },
			{ value: "postgres", label: "PostgreSQL" },
			{ value: "sqlite", label: "SQLite（database 填文件路径）" },
		];
		//#endregion
		//#region normalize
		/** 规整设置快照为可信结构（镜像宿主半逻辑，防御畸形数据）。 */
		function normalizeConfig(raw) {
			const src = raw !== null && typeof raw === "object" ? raw : {};
			const d = src.defaults !== null && typeof src.defaults === "object" ? src.defaults : {};
			const num = (v, def) => {
				const n = Math.floor(Number(v));
				return n === n && n > 0 ? n : def;
			};
			const list = Array.isArray(src.connections) ? src.connections : [];
			return {
				defaults: {
					maxRows: num(d.maxRows, DEFAULT_LIMITS.maxRows),
					timeoutMs: num(d.timeoutMs, DEFAULT_LIMITS.timeoutMs),
					cellChars: num(d.cellChars, DEFAULT_LIMITS.cellChars),
					resultBytes: num(d.resultBytes, DEFAULT_LIMITS.resultBytes),
				},
				dbqPath: typeof src.dbqPath === "string" ? src.dbqPath.trim() : "",
				connections: list.filter((c) => c !== null && typeof c === "object" && typeof c.id === "string" && c.id !== ""),
			};
		}
		function emptyConn() {
			return {
				id: "", label: "", type: "mysql", host: "127.0.0.1", port: 3306,
				database: "", user: "",
				passwordSource: "inline", passwordValue: "", passwordEnv: "", passwordRef: "",
				readOnly: true, enabled: true, maxRows: 0, timeoutMs: 0,
				denyTables: [], allowSchemas: [], note: "",
			};
		}
		//#endregion
		//#region styles
		const STYLE_ID = "dsh-dbq/settings.css";
		const STYLE_TEXT = [
			".dbqSection{display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.55}",
			".dbqCard{border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}",
			".dbqRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dbqBadge{display:inline-block;padding:1px 8px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l4);font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dbqBadgeRo{color:var(--dsw-alias-label-positive,#7bd88f);border-color:rgba(123,216,143,.5)}",
			".dbqBadgeRw{color:var(--dsw-alias-label-warning,#e2b93b);border-color:rgba(226,185,59,.5)}",
			".dbqBadgeOff{color:var(--dsw-alias-label-tertiary)}",
			".dbqInput{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:30px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:12px;min-width:0;width:100%;box-sizing:border-box}",
			".dbqInput:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}",
			".dbqBtn{font:inherit;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;color:var(--dsw-alias-label-primary);padding:4px 12px;font-size:12px;cursor:pointer;line-height:1.5}",
			".dbqBtn:hover{background:var(--dsw-alias-bg-layer-4,var(--dsw-alias-bg-layer-3))}",
			".dbqBtnPrimary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}",
			".dbqBtnDanger{color:var(--dsw-alias-label-error)}",
			".dbqErr{color:var(--dsw-alias-label-error);white-space:pre-wrap;font-size:12px}",
			".dbqOk{color:var(--dsw-alias-label-positive,#7bd88f);font-size:12px}",
			".dbqMuted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:0}",
			".dbqForm{display:grid;grid-template-columns:130px 1fr;gap:6px 10px;align-items:center}",
			".dbqForm label{color:var(--dsw-alias-label-secondary);font-size:12px}",
			".dbqTablewrap{overflow:auto;max-height:340px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px}",
			".dbqTable{border-collapse:collapse;font-size:12px;width:100%}",
			".dbqTable th,.dbqTable td{border-bottom:.5px solid var(--dsw-alias-border-l2);padding:3px 8px;text-align:left;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis}",
			".dbqTable th{position:sticky;top:0;background:var(--dsw-alias-bg-layer-3);font-weight:600}",
			".dbqMono{font-family:ui-monospace,Consolas,monospace;font-size:11px}",
			".dbqSql{margin:4px 0;padding:6px 8px;background:var(--dsw-alias-bg-layer-3);border-radius:6px;max-height:100px;overflow:auto;white-space:pre-wrap}",
			".dbqHead{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:1.5}",
			".dbqAdd{background:var(--dsw-specific-selector);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;display:grid}",
			".dbqAdd:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}",
			".dbqAdd:disabled{opacity:.5;cursor:default}",
			".uV2eYG_tools>.uV2eYG_add:nth-of-type(1){order:-2}",
			".uV2eYG_tools>.uV2eYG_add:nth-of-type(2){order:-1}",
			".uV2eYG_tools>.uV2eYG_modes{order:1}",
		].join("");
		function installStyles() {
			if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-dbq";
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = STYLE_TEXT;
			document.head.appendChild(tag);
			return () => {
				if (tag.parentElement !== null) tag.parentElement.removeChild(tag);
			};
		}
		//#endregion
		//#region db_query card
		function qParseArgs(block) {
			const raw = (block && block.argsRaw) || (block && block.call && block.call.argsRaw) || "";
			try {
				const v = JSON.parse(raw);
				return v !== null && typeof v === "object" ? v : {};
			} catch (e) { return {}; }
		}
		function qExtract(block) {
			const content = (block && block.content) || [];
			for (let i = 0; i < content.length; i++) {
				const b = content[i];
				const text = b !== null && typeof b === "object" && typeof b.text === "string" ? b.text : "";
				if (text === "") continue;
				try {
					const v = JSON.parse(text);
					if (v !== null && typeof v === "object" && Array.isArray(v.columns) && Array.isArray(v.rows)) return v;
				} catch (e) { /* not the result block */ }
			}
			return null;
		}
		function qErrorText(block) {
			const content = (block && block.content) || [];
			const parts = [];
			for (let i = 0; i < content.length; i++) {
				const b = content[i];
				if (b !== null && typeof b === "object" && typeof b.text === "string") parts.push(b.text);
			}
			return parts.join("\n") || "查询失败";
		}
		function QTable(data) {
			const cols = data.columns || [];
			const rows = data.rows || [];
			const shown = rows.length > 100 ? rows.slice(0, 100) : rows;
			const head = createElement("tr", { key: "h" }, cols.map((c, i) =>
				createElement("th", { key: i, title: c.type || "" }, c.name)));
			const body = shown.map((r, ri) =>
				createElement("tr", { key: ri }, (r || []).map((v, ci) => {
					let s;
					if (v === null || v === undefined) s = "NULL";
					else if (typeof v === "object") s = JSON.stringify(v);
					else s = String(v);
					return createElement("td", { key: ci, title: s }, s);
				})));
			return createElement("div", { className: "dbqTablewrap" },
				createElement("table", { className: "dbqTable" },
					createElement("thead", null, head), createElement("tbody", null, body)));
		}
		function DbQueryView(props) {
			const block = (props && props.block) || {};
			const settled = block.kind === "tool-result";
			const args = qParseArgs(block);
			const conn = String(args.connection || "?");
			const sql = String(args.sql || "");
			if (!settled) {
				return createElement("div", { className: "dbqSection", style: { gap: "6px" } },
					createElement("div", { className: "dbqRow" },
						createElement("span", { className: "dbqBadge" }, "db_query"),
						createElement("span", { className: "dbqMuted" }, "正在查询 " + conn + " …")),
					createElement("pre", { className: "dbqMono dbqSql" }, sql));
			}
			if (block.isError) {
				return createElement("div", { className: "dbqSection", style: { gap: "6px" } },
					createElement("div", { className: "dbqRow" },
						createElement("span", { className: "dbqBadge" }, "db_query"),
						createElement("span", { className: "dbqBadgeRw dbqBadge" }, "失败"),
						createElement("span", { className: "dbqMuted" }, conn)),
					createElement("pre", { className: "dbqMono dbqSql" }, sql),
					createElement("div", { className: "dbqErr" }, qErrorText(block)));
			}
			const data = qExtract(block);
			if (data === null) {
				return createElement("div", { className: "dbqSection", style: { gap: "6px" } },
					createElement("div", { className: "dbqRow" },
						createElement("span", { className: "dbqBadge" }, "db_query"),
						createElement("span", { className: "dbqMuted" }, conn)),
					createElement("pre", { className: "dbqMono dbqSql" }, sql),
					createElement("p", { className: "dbqMuted" }, "（无结构化结果，见原始输出）"));
			}
			const kids = [
				createElement("div", { className: "dbqRow", key: "head" },
					createElement("span", { className: "dbqBadge dbqBadgeRo" }, "db_query"),
					createElement("span", { className: "dbqMuted" }, conn),
					createElement("span", { className: "dbqMuted" }, data.rowCount + " 行" + (data.elapsedMs !== undefined && data.elapsedMs !== null ? " / " + data.elapsedMs + "ms" : "")),
					data.truncated === true ? createElement("span", { className: "dbqBadge dbqBadgeRw" }, "已截断（达到限额）") : null),
				createElement("pre", { className: "dbqMono dbqSql", key: "sql" }, sql),
				createElement("div", { key: "tbl" }, QTable(data)),
			];
			if ((data.rows || []).length > 100) {
				kids.push(createElement("p", { className: "dbqMuted", key: "more" }, "卡片仅显示前 100 行，完整 " + data.rowCount + " 行见模型侧结果"));
			}
			return createElement("div", { className: "dbqSection", style: { gap: "6px" } }, kids);
		}
		//#endregion
		//#region settings section
		function ConnForm(props) {
			const draft = props.draft;
			const setDraft = props.setDraft;
			const onSave = props.onSave;
			const onCancel = props.onCancel;
			const isNew = props.isNew;
			const setField = (key, value) => {
				const next = Object.assign({}, draft);
				next[key] = value;
				setDraft(next);
			};
			const textField = (labelText, key, placeholder, type) => [
				createElement("label", { key: "l" + key }, labelText),
				createElement("input", {
					key: "i" + key, className: "dbqInput", type: type || "text", placeholder: placeholder || "",
					value: draft[key] === null || draft[key] === undefined ? "" : String(draft[key]),
					onChange: (e) => setField(key, type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value),
				}),
			];
			const flagField = (labelText, key) => [
				createElement("label", { key: "l" + key }, labelText),
				createElement("input", {
					key: "i" + key, type: "checkbox", checked: draft[key] === true,
					onChange: (e) => setField(key, e.target.checked),
				}),
			];
			return createElement("div", { className: "dbqCard" },
				createElement("div", { className: "dbqRow" },
					createElement("h3", { className: "dbqHead" }, isNew ? "新增连接" : "编辑连接 " + draft.id),
					createElement("span", { style: { flex: 1 } }),
					createElement("button", { className: "dbqBtn dbqBtnPrimary", onClick: onSave }, "保存连接"),
					createElement("button", { className: "dbqBtn", onClick: onCancel }, "取消")),
				createElement("div", { className: "dbqForm" },
					textField("连接 id", "id", "如 shop-mysql（保存后作为引用名）"),
					textField("备注名", "label", "显示名称"),
					createElement("label", { key: "ltype" }, "类型"),
					createElement("select", {
						key: "itype", className: "dbqInput", value: draft.type,
						onChange: (e) => {
							const next = Object.assign({}, draft);
							next.type = e.target.value;
							if (next.type === "postgres") next.port = 5432;
							else if (next.type === "mysql") next.port = 3306;
							setDraft(next);
						},
					}, DB_TYPES.map((t) => createElement("option", { key: t.value, value: t.value }, t.label))),
					textField("主机", "host", "127.0.0.1"),
					textField("端口", "port", "3306", "number"),
					textField("数据库", "database", "库名 / SQLite 文件路径"),
					textField("用户名", "user", ""),
					createElement("label", { key: "lpsrc" }, "密码来源"),
					createElement("select", {
						key: "ipsrc", className: "dbqInput", value: draft.passwordSource || "inline",
						onChange: (e) => setField("passwordSource", e.target.value),
					},
						createElement("option", { value: "inline" }, "inline（明文存 settings.yaml，本地单用户）"),
						createElement("option", { value: "env" }, "env（网关进程环境变量名）"),
						createElement("option", { value: "credential" }, "credential（DSH 凭据库 dbq/<id>）")),
					draft.passwordSource === "env"
						? textField("环境变量名", "passwordEnv", "如 MYSQL_PASS")
						: draft.passwordSource === "credential"
							? textField("凭据 ref", "passwordRef", "留空 = dbq/<连接id>")
							: textField("密码", "passwordValue", "", "password"),
					flagField("只读", "readOnly"),
					flagField("启用", "enabled"),
					textField("最大行数(0=默认)", "maxRows", "200", "number"),
					textField("超时毫秒(0=默认)", "timeoutMs", "8000", "number"),
					textField("禁止表(逗号分隔)", "denyTablesCsv", "users.password_hash"),
					textField("备注", "note", "")),
				createElement("p", { className: "dbqMuted" },
					"denyTables 命中即拒绝；只读连接仅允许单条 SELECT/WITH/SHOW/EXPLAIN。"));
		}
		//#region settings/gateway card
		function GatewayCard(props) {
			const disabled = props.disabled;
			const save = props.save;
			const dbqPath = props.dbqPath;
			const [pathInput, setPathInput] = useState(dbqPath || "");
			const [status, setStatus] = useState(null);
			const [tick, setTick] = useState(0);
			useEffect(() => { setPathInput(dbqPath || ""); }, [dbqPath]);
			useEffect(() => {
				let live = true;
				setStatus(null);
				fetch("/dbq-api/status").then((r) => r.json()).then((v) => {
					if (live) setStatus(v !== null && typeof v === "object" && v.ok === true && v.gateway !== null && typeof v.gateway === "object" ? v.gateway : { error: "状态响应无法解析" });
				}, () => {
					if (live) setStatus({ error: "无法访问 /dbq-api/status（宿主半未加载或需重启 dsh web）" });
				});
				return () => { live = false; };
			}, [tick]);
			let badge;
			if (status === null) badge = createElement("span", { className: "dbqBadge dbqBadgeOff" }, "检查中…");
			else if (status.error !== undefined && status.error !== null) badge = createElement("span", { className: "dbqBadge dbqBadgeRw" }, "状态未知");
			else if (status.supported === false) badge = createElement("span", { className: "dbqBadge dbqBadgeRw" }, "仅支持 Windows");
			else if (status.alive === true) badge = createElement("span", { className: "dbqBadge dbqBadgeRo" }, "就绪");
			else if (status.exists === true) badge = createElement("span", { className: "dbqBadge dbqBadgeRw" }, "已找到但未响应");
			else badge = createElement("span", { className: "dbqBadge dbqBadgeRw" }, "未找到");
			const applySave = (value, okText) => {
				save({ dbqPath: value }, okText);
				setTimeout(() => setTick((t) => t + 1), 400);
			};
			return createElement("div", { className: "dbqCard" },
				createElement("div", { className: "dbqRow" },
					createElement("h3", { className: "dbqHead" }, "网关（dbq.exe）"),
					badge,
					createElement("span", { style: { flex: 1 } }),
					createElement("button", { className: "dbqBtn", disabled, onClick: () => setTick((t) => t + 1) }, "重新检测")),
				status !== null && status.path ? createElement("div", { className: "dbqMuted dbqMono" },
					status.path + (status.source === "settings" ? "（设置）" : status.source === "vendored" ? "（插件内置）" : "（默认位置）")) : null,
				status !== null && status.error ? createElement("div", { className: "dbqErr" }, status.error) : null,
				status !== null && status.hint ? createElement("p", { className: "dbqMuted" }, status.hint) : null,
				createElement("div", { className: "dbqForm" },
					createElement("label", null, "dbq.exe 路径"),
					createElement("input", {
						className: "dbqInput", placeholder: "留空 = 插件内置 vendor/dbq.exe，其次 %USERPROFILE%\.dsh\dbq\dbq.exe",
						value: pathInput, disabled,
						onChange: (e) => setPathInput(e.target.value),
					})),
				createElement("div", { className: "dbqRow" },
					createElement("button", {
						className: "dbqBtn dbqBtnPrimary", disabled,
						onClick: () => applySave(pathInput.trim(), pathInput.trim() === "" ? "已恢复默认网关路径" : "已保存网关路径"),
					}, "保存网关路径"),
					pathInput !== "" ? createElement("button", {
						className: "dbqBtn", disabled,
						onClick: () => { setPathInput(""); applySave("", "已恢复默认网关路径"); },
					}, "清空（用默认）") : null),
				createElement("p", { className: "dbqMuted" },
					"仅支持 Windows。网关已随插件内置（vendor/dbq.exe），通常无需安装；仅当状态异常时，从插件仓库获取 dbq.exe 放到 %USERPROFILE%\.dsh\dbq\ 或在上方填写完整路径。对话里的 db_* 工具与 #db 表引用选择器都依赖它。"));
		}
		//#endregion
		function SettingsPage(props) {
			const scope = props.scope;
			const snapshot = useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot());
			const cfg = normalizeConfig(snapshot === undefined || snapshot === null ? undefined : snapshot.value);
			const unavailable = snapshot !== undefined && snapshot !== null && snapshot.status === "unavailable";
			const readonly = snapshot !== undefined && snapshot !== null && snapshot.status === "ready" && snapshot.writable === false;
			const disabled = unavailable || readonly;
			const [editing, setEditing] = useState(null);
			const [defaults, setDefaults] = useState(cfg.defaults);
			const [msg, setMsg] = useState(null);
			useEffect(() => {
				setDefaults(cfg.defaults);
			}, [JSON.stringify(cfg.defaults)]);
			const save = (patch, okText) => {
				if (disabled) return;
				Promise.all(Object.keys(patch).map((key) => scope.set(key, patch[key]))).then(() => {
					setMsg({ ok: true, text: okText || "已保存" });
				}, (reason) => {
					setMsg({ ok: false, text: "保存失败: " + (reason instanceof Error ? reason.message : String(reason)) });
				});
			};
			const saveDraft = () => {
				const d = editing.draft;
				if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(d.id)) { setMsg({ ok: false, text: "连接 id 非法（仅字母数字-）" }); return; }
				const dup = cfg.connections.some((c) => c.id === d.id && editing.isNew);
				if (dup) { setMsg({ ok: false, text: "连接 id 已存在: " + d.id }); return; }
				const clean = Object.assign({}, d);
				delete clean.denyTablesCsv;
				const next = cfg.connections.filter((c) => c.id !== d.id).concat([clean]);
				setEditing(null);
				save({ connections: next }, "已保存连接 " + d.id);
			};
			const removeConn = (id) => {
				const next = cfg.connections.filter((c) => c.id !== id);
				save({ connections: next }, "已删除连接 " + id);
			};
			const kids = [];
			kids.push(createElement("div", { className: "dbqCard", key: "info" },
				createElement("h2", { className: "dbqHead" }, "数据库连接（dbq）"),
				createElement("p", { className: "dbqMuted" },
					"对话中可用工具：db_connections / db_tables / db_describe / db_query（默认只读，带语句白名单与限额）。网关 dbq.exe（Windows）已随插件内置，可在下方「网关」卡查看状态或自定义路径；连接与限额保存到 ~/.dsh/settings.yaml 的 dsh-dbq 段。"),
				unavailable ? createElement("p", { className: "dbqErr", role: "status" },
					"配置服务不可用：宿主半未注册 dsh-dbq 命名空间（可能需要重启 dsh web）。") : null,
				readonly ? createElement("p", { className: "dbqErr", role: "status" }, "当前配置文档只读，修改不会被保存。") : null));
			kids.push(createElement(GatewayCard, { key: "gateway", disabled, save, dbqPath: cfg.dbqPath }));
			if (cfg.connections.length === 0) {
				kids.push(createElement("div", { className: "dbqCard dbqMuted", key: "empty" },
					"还没有连接。点击下方「新增连接」添加 MySQL / PostgreSQL / SQLite 连接。"));
			}
			cfg.connections.forEach((c, idx) => {
				kids.push(createElement("div", { className: "dbqCard", key: "conn" + idx },
					createElement("div", { className: "dbqRow" },
						createElement("strong", null, c.id),
						c.label ? createElement("span", { className: "dbqMuted" }, c.label) : null,
						createElement("span", { className: "dbqBadge" }, c.type),
						c.readOnly !== false
							? createElement("span", { className: "dbqBadge dbqBadgeRo" }, "只读")
							: createElement("span", { className: "dbqBadge dbqBadgeRw" }, "可写"),
						c.passwordSource === "inline" ? null : createElement("span", { className: "dbqBadge" }, "密码: " + c.passwordSource),
						c.enabled === false ? createElement("span", { className: "dbqBadge dbqBadgeOff" }, "已禁用") : null),
					createElement("div", { className: "dbqMuted dbqMono" },
						c.type === "sqlite"
							? (c.database || "-")
							: ((c.host || "127.0.0.1") + ":" + (c.port || 0) + "/" + (c.database || "") + " @ " + (c.user || "-"))),
					createElement("div", { className: "dbqRow" },
						createElement("button", {
							className: "dbqBtn", disabled,
							onClick: () => setEditing({ isNew: false, draft: Object.assign({}, c) }),
						}, "编辑"),
						createElement("button", { className: "dbqBtn dbqBtnDanger", disabled, onClick: () => removeConn(c.id) }, "删除"))));
			});
			if (editing !== null) {
				const draft = editing.draft;
				const withCsv = Object.assign({}, draft);
				withCsv.denyTablesCsv = Array.isArray(draft.denyTables) ? draft.denyTables.join(",") : "";
				withCsv.denyTables = undefined;
				kids.push(createElement(ConnForm, {
					key: "form",
					draft: withCsv,
					setDraft: (d) => {
						const clean = Object.assign({}, d);
						clean.denyTables = String(clean.denyTablesCsv || "").split(",").map((s) => s.trim()).filter((s) => s !== "");
						delete clean.denyTablesCsv;
						setEditing({ isNew: editing.isNew, draft: clean });
					},
					isNew: editing.isNew,
					onSave: saveDraft,
					onCancel: () => setEditing(null),
				}));
			} else {
				kids.push(createElement("div", { className: "dbqRow", key: "add" },
					createElement("button", {
						className: "dbqBtn dbqBtnPrimary", disabled,
						onClick: () => setEditing({ isNew: true, draft: emptyConn() }),
					}, "新增连接")));
			}
			kids.push(createElement("div", { className: "dbqCard", key: "defaults" },
				createElement("h3", { className: "dbqHead" }, "默认限额"),
				createElement("div", { className: "dbqForm" },
					createElement("label", null, "最大行数"),
					createElement("input", { className: "dbqInput", type: "number", value: defaults.maxRows, disabled, onChange: (e) => setDefaults(Object.assign({}, defaults, { maxRows: Number(e.target.value) })) }),
					createElement("label", null, "超时毫秒"),
					createElement("input", { className: "dbqInput", type: "number", value: defaults.timeoutMs, disabled, onChange: (e) => setDefaults(Object.assign({}, defaults, { timeoutMs: Number(e.target.value) })) }),
					createElement("label", null, "单元格字符"),
					createElement("input", { className: "dbqInput", type: "number", value: defaults.cellChars, disabled, onChange: (e) => setDefaults(Object.assign({}, defaults, { cellChars: Number(e.target.value) })) }),
					createElement("label", null, "结果字节"),
					createElement("input", { className: "dbqInput", type: "number", value: defaults.resultBytes, disabled, onChange: (e) => setDefaults(Object.assign({}, defaults, { resultBytes: Number(e.target.value) })) })),
				createElement("div", { className: "dbqRow" },
					createElement("button", { className: "dbqBtn", disabled, onClick: () => save({ defaults }, "已保存默认限额") }, "保存默认限额"))));
			if (msg !== null) {
				kids.push(createElement("div", { key: "msg", className: msg.ok ? "dbqOk" : "dbqErr" }, msg.text));
			}
			return createElement("div", { className: "dbqSection" }, kids);
		}
		//#endregion
		//#region apply
		const inject = ["slots", "settingsScope", "sessions", "inputTriggers"];
		function apply(ctx) {
			ctx.effect(installStyles, "dsh-dbq: section styles");
			const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NS });
			ctx.slots.inject("settings.section", () => {
				try {
					return ctx.slots.register({
						name: "settings.section",
						id: "dbq",
						order: 170,
						label: "数据库连接",
					}, (props) => createElement(SettingsPage, { scope }));
				} catch (e) {
					return () => {};
				}
			});
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register(
				{ name: "tool.call.toolview", key: "db_query" },
				DbQueryView,
			));
			function dbqSource(sectionLabel) {
				return {
					showGroupTitle: false,
					async candidates(session, req) {
						const q = String((req && req.query) || "").trim();
						if (req && req.quoted === true) return [];
						const snapshot = scope.getSnapshot();
						const cfg = normalizeConfig(snapshot === undefined || snapshot === null ? undefined : snapshot.value);
						const enabled = cfg.connections.filter((c) => c.enabled !== false);
						if (enabled.length === 0) return [];
						if (req && req.signal && req.signal.aborted) return [];
						const multi = enabled.length > 1;
						const lists = await Promise.all(enabled.map((c) =>
							fetch("/dbq-api/tables?connection=" + encodeURIComponent(c.id) + (q === "" ? "" : "&pattern=" + encodeURIComponent(q)), { signal: req ? req.signal : undefined })
								.then((r) => r.json()).then((v) => {
									if (v === null || typeof v !== "object" || v.ok !== true) return [];
									return ((v.data && v.data.tables) || []).map((t) => {
										const ref = c.id + (t.schema ? "." + t.schema : "") + "." + t.name;
										const desc = [];
										if (multi) desc.push(c.id);
										if (t.schema) desc.push(t.schema);
										if (t.rows !== undefined && t.rows !== null) desc.push(t.rows + " 行");
										if (t.comment) desc.push(t.comment);
										return { name: t.name, description: desc.join(" · "), section: sectionLabel, value: { ref, table: t.name } };
									});
								}, () => [])
						));
						if (req && req.signal && req.signal.aborted) return [];
						const rows = lists.flat();
						const ranked = (primitives !== null && primitives !== undefined && primitives.rankByName) ? primitives.rankByName(rows, q) : rows;
						return ranked.slice(0, 50);
					},
					onPick(payload) {
						const v = payload && payload.candidate && payload.candidate.value;
						if (v === undefined || v === null) return undefined;
						return { insert: {
							source: "dbq",
							ref: v.ref,
							label: v.table,
							clipboardText: "#db:" + v.ref,
						} };
					},
					codec: {
						clipboardText: (ref) => "#db:" + ref,
						serialize: (ref) => Promise.resolve("#db:" + ref),
					},
				};
			}
			ctx.effect(() => {
				const inputTriggers = ctx.get("inputTriggers");
				if (inputTriggers === undefined) {
					console.error("dsh-dbq: inputTriggers 服务不可用，表候选源未注册");
					return () => {};
				}
				const offHash = inputTriggers.registerSource(Object.assign(dbqSource("数据库表"), { trigger: "#", name: "dbq" }));
				const offAt = inputTriggers.registerSource(Object.assign(dbqSource("数据库表"), { trigger: "@", name: "dbq-at" }));
				return () => { offHash(); offAt(); };
			}, "dsh-dbq: trigger sources");
			function DbIcon(props) {
				const s = (props && props.size) || 14;
				return createElement("svg", {
					width: s, height: s, viewBox: "0 0 16 16", fill: "none",
					stroke: "currentColor", strokeWidth: "1.3",
					strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
				},
					createElement("ellipse", { cx: "8", cy: "3.6", rx: "5.4", ry: "2.1" }),
					createElement("path", { d: "M2.6 3.6v8.8c0 1.16 2.42 2.1 5.4 2.1s5.4-.94 5.4-2.1V3.6" }),
					createElement("path", { d: "M2.6 8c0 1.16 2.42 2.1 5.4 2.1s5.4-.94 5.4-2.1" }));
			}
			function DbqMenuButton(props) {
				const sessionId = props.sessionId;
				const scope2 = props.scope;
				const snapshot = useSyncExternalStore((listener) => scope2.subscribe(listener), () => scope2.getSnapshot());
				const cfg = normalizeConfig(snapshot === undefined || snapshot === null ? undefined : snapshot.value);
				const enabled = cfg.connections.filter((c) => c.enabled !== false);
				if (sessionId === undefined || sessionId === null || enabled.length === 0) return null;
				return createElement("button", {
					type: "button",
					className: "dbqAdd",
					"aria-label": "引用数据库表",
					title: "引用数据库表（选中后插入表标签，发送为 #db: 记号）",
					onMouseDown: (e) => e.preventDefault(),
					onClick: () => {
						try {
							const inputTriggers = ctx.get("inputTriggers");
							if (inputTriggers === undefined) return;
							const actx = ctx.sessions.scope(sessionId);
							if (actx === undefined) return;
							const controller = inputTriggers.sessionOf(actx);
							let draftRev = 0;
							let caret = 0;
							try {
								const conversation = actx.get("conversation");
								const shell = (conversation !== undefined && conversation.input && typeof conversation.input.for === "function") ? conversation.input.for(actx) : undefined;
								if (shell !== undefined && shell.snapshot !== undefined) {
									draftRev = shell.snapshot.draftRev !== undefined ? shell.snapshot.draftRev : 0;
									const proj = shell.projection;
									const detectText = (proj && typeof proj.detectText === "string") ? proj.detectText : "";
									const pc = (proj && typeof proj.caret === "number") ? proj.caret : null;
									caret = pc !== null ? Math.min(Math.max(pc, 0), detectText.length) : detectText.length;
								}
							} catch (e2) { /* shell 不可用时退化为草稿末尾 */ }
							controller.toggleSource("dbq", {
								trigger: "#",
								query: "",
								quoted: false,
								position: "inline",
								span: { start: caret, end: caret, draftRev },
							});
						} catch (e) {
							console.error("dsh-dbq: 打开表菜单失败:", e && e.message);
						}
					},
				}, createElement(DbIcon, { size: 14 }));
			}
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register(
				{ name: "conversation.input.left", id: "dbq", order: 30, inject: (sessionId) => ({ sessionId }) },
				(props) => createElement(DbqMenuButton, Object.assign({}, props, { scope })),
			));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
