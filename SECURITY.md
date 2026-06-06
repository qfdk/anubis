# 安全审计报告

- **项目**：Anubis（fail2ban Web 管理面板，Express + EJS）
- **日期**：2026-06-06
- **范围**：路由、认证中间件、模板渲染、文件操作、依赖
- **方法**：白盒代码审计 + 本地 mock 环境 POC 复现 + 修复 + 反向验证 + 双服务器部署
- **运行上下文**：面板以 **root** 运行、管理 `/etc/fail2ban` 配置（`reloadFail2ban` 通过 `exec`，配置写入系统目录）。`/admin/*` 全部位于 `auth` 中间件之后。

## 结论概览

| # | 漏洞 | 严重性 | 状态 | 修复 commit |
|---|------|--------|------|-------------|
| 1 | 路径穿越 ×8 → 任意文件读/写（→ root RCE） | 高（post-auth 提权） | 已修复 | `a0a1f3c` |
| 2 | 可预测 session secret（硬编码 `'anubis'`） | **Critical（零凭证）** | 已修复 | `a0a1f3c` |
| 3 | 会话固定（登录不重建 session） | 中高（认证绕过） | 已修复 | `31f2357` |
| 4 | 存储型 XSS（模板未转义输出） | 低（post-auth 纵深防御） | 已修复 | `4b74ba6` |
| 5 | 运行时依赖 CVE（express/ejs 系） | 中 | 已修复 | `0a47459` |

---

## 1. 路径穿越 → 任意文件读 / 写（高）

**位置**：`routes/admin/jail.js`、`routes/admin/filter.js` 共 8 处。
用户输入直接拼进文件路径：`` `${JAIL_PATH}/${用户输入}` ``，从不校验解析结果是否仍落在目标目录内。

**POC**：
```
# 任意文件读取（回显到 Monaco 编辑器）
GET /admin/jails/edit/x?file=../../../.env                 # 泄露 ADMIN_PASSWORD、SESSION_SECRET
GET /admin/jails/edit/x?file=../../../../../../etc/passwd

# 任意文件写入（→ 写 /etc/cron.d 即 root RCE）
POST /admin/jails/doEdit/x   body: configFileName=../../../../tmp/x&content=...
```

**根因**：缺少路径归一化与目录边界校验。

**修复**：新增 `utils/resolveInside(baseDir, name)`——`path.resolve` 后校验前缀，越界抛错；所有文件读/写/删统一走它。单元测试 `test/path-safety.test.js`（已反向验证：去掉校验后拦截用例立即失败）。

## 2. 可预测 session secret（Critical）

**位置**：`app.js` 原 `secret: process.env.SESSION_SECRET || 'anubis'`。

**影响**：未设 `SESSION_SECRET` 时回退到硬编码 `'anubis'`，任何读过源码者均可**离线伪造已登录管理员的 session cookie 签名**，无需任何凭证即可绕过登录。审计中发现 fr.qfdk.me 生产环境正使用该回退值。

**修复**：移除硬编码回退；弱/缺失值改用 `crypto.randomBytes(32)` 随机生成并告警；默认口令 `admin` 启动告警。运维侧已为 fr 写入固定强随机 `SESSION_SECRET`。

## 3. 会话固定（中高）

**位置**：`routes/public.js` 登录处理器。

**影响**：预认证 `GET /` 经 csrf 中间件即创建持久 `connect.sid`；登录时直接在旧会话置 `login=true` 而不重建 ID。攻击者固定的 sid 在受害者登录后即成为已认证会话。

**POC**：登录前后 `connect.sid` 完全相同，且预认证 sid 登录后可访问 `/admin`（200）。

**修复**：登录成功后先 `req.session.regenerate()` 再写登录态，旧 sid 失效（重放确认 → 302）。

## 4. 存储型 XSS（低）

**位置**：EJS 模板用 `<%-`（不转义）输出 `jailname`/`configFile`/`filterName`/`filters[i]`/`info[i].ip`/`country` 等数据。

**POC**：创建文件名 `x"><img src=x onerror=alert(document.domain)>.conf` → 列表页将其作为真实 DOM 元素渲染并执行（浏览器确认 3 个注入元素、`onerror` 触发）。

**威胁定位**：投放该文件需已是面板管理员或具备 `/etc/fail2ban/*.d` 写权限（root），未跨越权限边界，故**实际严重性低**，属纵深防御与正确性修复。

**修复**：所有数据 sink 改 `<%=`（HTML 转义）；`<script>` 内 `JSON.stringify(...)` 追加 `.replace(/</g,'<')` 防 `</script>` 突破；`include()` 与可信 `BASE_PATH` 保持 `<%-`。

## 5. 运行时依赖 CVE（中）

express `~4.16.1` → `^4.21.2`（连带修复 body-parser DoS、path-to-regexp ReDoS/回溯、qs 原型污染）；ejs `~2.6.1` → `^3.1.10`（修复 <3.1.7 模板注入）。已验证 EJS 3 模板全兼容。

---

## 已知但合理保留的风险

- **`flatted` / `minimatch`**：`log4js`（已为最新 6.9.1）的传递依赖；触发需攻击者控制的循环 JSON / glob 模式，本应用日志库不接收外部输入，**不可达**。强制 overrides 收益为零且增加脆弱性。
- **无应用层登录限速**：登录与 `/api` basicAuth 无锁定/限速，可在线爆破（由运行机的 fail2ban 在网络层缓解）。
- **`res.send('ERROR')` 返回 200**：应改为 4xx —— 代码质量问题，非安全。

## 加固建议

1. 部署前务必在 `.env` 设置强随机 `SESSION_SECRET` 与非默认 `ADMIN_PASSWORD`（已加启动告警）。
2. 新增任何文件读写一律通过 `resolveInside` 限定目录。
3. 模板输出数据一律用 `<%=`，仅 `include()` 用 `<%-`。
4. 定期 `pnpm audit --prod` 复查运行时依赖。
