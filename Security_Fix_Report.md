# LeadHunter Pro 安全修复报告

**版本:** 1.0
**日期:** 2026年2月5日
**作者:** Manus AI

---

## 1. 概述

本次安全修复旨在解决对 LeadHunter Pro 平台进行全面安全审计后发现的多个严重漏洞。修复重点在于消除硬编码凭证、防范 SQL 注入攻击以及加强 JWT 令牌的安全性。所有修复均已成功部署到生产环境，并通过了功能验证测试。

## 2. 修复的漏洞详情

下表总结了已识别并修复的关键安全漏洞：

| 漏洞编号 | 漏洞类型 | 风险等级 | 影响文件 | 修复状态 |
| :--- | :--- | :--- | :--- | :--- |
| VULN-001 | 硬编码管理员密码 | **严重** | `server/_core/env.ts` | ✅ 已修复 |
| VULN-002 | SQL 注入 | **严重** | `server/db.ts`, `server/agent/router.ts` | ✅ 已修复 |
| VULN-003 | 硬编码 JWT 密钥 | **高** | `server/_core/env.ts`, `server/agent/router.ts`, `server/agent/agentAuth.ts` | ✅ 已修复 |

### 2.1. VULN-001: 硬编码管理员密码

**问题描述:**
在 `server/_core/env.ts` 文件中，管理员密码被硬编码为默认值 `"bao12345678.."`。这使得任何能够访问代码库的人都能获取管理员权限，对系统构成严重威胁。

**修复措施:**
- **移除硬编码密码:** 从 `env.ts` 文件中完全删除了硬编码的密码。
- **强制环境变量:** 引入了 `requireSecureEnv()` 函数，该函数在应用启动时检查 `ADMIN_PASSWORD` 环境变量。如果生产环境中未设置该变量，应用将无法启动，从而强制要求进行安全配置。

**代码变更 (server/_core/env.ts):**

```typescript
// 旧代码
adminPassword: process.env.ADMIN_PASSWORD ?? "bao12345678..",

// 新代码
adminPassword: requireSecureEnv("ADMIN_PASSWORD"),
```

### 2.2. VULN-002: SQL 注入

**问题描述:**
在两个位置发现了 SQL 注入漏洞，允许攻击者通过构造恶意的搜索参数来执行任意 SQL 命令，可能导致数据泄露、篡改或删除。

1.  **用户搜索 (`server/db.ts`):** `getAllUsers` 函数直接将 `search` 参数拼接到 SQL 查询字符串中。
2.  **代理申请查询 (`server/agent/router.ts`):** `getAgentApplications` 函数同样将 `status` 参数直接拼接到查询中。

**修复措施:**
- **参数化查询:** 所有涉及用户输入的 SQL 查询都已重构，使用 Drizzle ORM 提供的 `sql` 模板标签进行参数化查询。这可以确保用户输入被安全地处理，而不是作为可执行代码。
- **输入验证:** 在 `getAgentApplications` 函数中，对 `status` 参数增加了白名单验证，只允许预定义的值 (`'pending'`, `'approved'`, `'rejected'`) 通过。

**代码变更 (server/db.ts):**

```typescript
// 旧代码 (易受攻击)
whereClause = `WHERE u.email LIKE 
'%${search.replace(/
'/g, "''")}%
' OR u.name LIKE 
'%${search.replace(/
'/g, "''")}%
'`;
const result = await db.execute(sql.raw(`... ${whereClause} ...`));

// 新代码 (安全)
const searchPattern = `%${search}%`;
result = await db.execute(sql`...
      WHERE u.email LIKE ${searchPattern} OR u.name LIKE ${searchPattern}
...`);
```

### 2.3. VULN-003: 硬编码 JWT 密钥

**问题描述:**
系统中多个部分（管理员、代理、普通用户）的 JWT 密钥存在硬编码的默认值或回退值。如果环境变量未设置，系统将使用这些已知的、不安全的密钥，攻击者可以利用这些密钥伪造用户身份。

**修复措施:**
- **移除所有默认值:** 删除了 `env.ts`, `agentAuth.ts` 和 `router.ts` 中所有 JWT 密钥的硬编码回退值。
- **强制环境变量:** 使用 `requireSecureEnv()` 函数确保 `JWT_SECRET`, `ADMIN_JWT_SECRET`, 和 `AGENT_JWT_SECRET` 在生产环境中必须被设置。

**代码变更 (server/agent/router.ts):**

```typescript
// 旧代码
const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'agent-secret-key-change-in-production';

// 新代码
import { ENV } from '../_core/env';
const AGENT_JWT_SECRET = ENV.agentJwtSecret;
```

## 3. 新增环境变量要求

为确保系统安全运行，现在必须在生产环境中配置以下环境变量：

| 环境变量 | 描述 |
| :--- | :--- |
| `ADMIN_PASSWORD` | 管理员后台登录密码。 |
| `JWT_SECRET` | 用于普通用户会话的 JWT 密钥。 |
| `ADMIN_JWT_SECRET` | 用于管理员会话的 JWT 密钥。 |
| `AGENT_JWT_SECRET` | 用于代理后台会话的 JWT 密钥。 |

## 4. 结论

通过本次修复，LeadHunter Pro 平台的关键安全漏洞已得到解决，显著提升了系统的整体安全性。硬编码凭证和 SQL 注入等严重风险已被消除。建议持续进行安全审计，并保持良好的安全开发实践，以应对未来可能出现的威胁。
