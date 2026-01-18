# 云端寻踪 Pro 2.0 管理后台功能升级设计

## 一、功能模块概览

### 1. 用户管理增强 👥
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 用户详情查看 | 查看用户完整信息、积分余额、注册时间等 | 高 |
| 积分手动调整 | 增加/扣除用户积分，需填写原因 | 高 |
| 账户状态管理 | 启用/禁用用户账户 | 高 |
| 密码重置 | 为用户重置密码 | 高 |
| 用户搜索 | 按邮箱、ID搜索用户 | 高 |
| 批量操作 | 批量调整积分、批量禁用等 | 中 |

### 2. 订单管理增强 💰
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 订单详情查看 | 查看完整订单信息、支付状态、时间线 | 高 |
| 手动确认支付 | 输入交易哈希手动确认订单 | 高 |
| 订单退款 | 退还积分并标记订单为已退款 | 高 |
| 订单取消 | 取消未支付订单 | 中 |
| 订单搜索 | 按订单号、用户、状态搜索 | 高 |
| 订单导出 | 导出订单数据为Excel | 低 |

### 3. 用户活动日志 📋
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 搜索记录查看 | 查看用户的所有搜索历史 | 高 |
| 积分变动记录 | 查看用户积分的所有变动 | 高 |
| 登录记录 | 查看用户登录历史（IP、时间、设备） | 中 |
| 操作日志 | 查看用户的所有操作记录 | 中 |

### 4. 系统监控 📊
| 功能 | 描述 | 优先级 |
|------|------|--------|
| API调用统计 | Apollo API调用次数、成功率、费用 | 高 |
| 实时在线用户 | 当前在线用户数量和列表 | 中 |
| 系统错误日志 | 查看系统错误和异常 | 高 |
| 性能监控 | 响应时间、请求量统计 | 低 |
| 数据统计面板 | 用户增长、收入趋势图表 | 中 |

### 5. 公告通知系统 📢
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 系统公告 | 发布全站公告，所有用户可见 | 高 |
| 用户消息 | 向特定用户发送私信 | 中 |
| 公告管理 | 编辑、删除、置顶公告 | 高 |
| 消息模板 | 预设常用消息模板 | 低 |

### 6. 前端用户对应功能 🖥️
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 公告展示 | 用户端显示系统公告 | 高 |
| 消息中心 | 用户查看收到的消息 | 中 |
| 积分明细 | 用户查看积分变动历史 | 高 |
| 搜索历史 | 用户查看自己的搜索记录 | 中 |
| 账户安全 | 修改密码、查看登录记录 | 中 |

---

## 二、数据库Schema扩展

### 新增表

```sql
-- 用户活动日志表
CREATE TABLE user_activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,  -- login, search, recharge, etc.
  details JSON,                  -- 详细信息
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 积分变动记录表（已存在，需确认）
CREATE TABLE credit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount INT NOT NULL,           -- 正数增加，负数扣除
  balance INT NOT NULL,          -- 变动后余额
  type VARCHAR(50) NOT NULL,     -- recharge, consume, adjust, refund
  description TEXT,
  operator_id INT,               -- 操作人（管理员调整时）
  order_id VARCHAR(50),          -- 关联订单
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统公告表
CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info',  -- info, warning, success, error
  is_pinned BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户消息表
CREATE TABLE user_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'system',  -- system, support, notification
  is_read BOOLEAN DEFAULT FALSE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 管理员操作日志表
CREATE TABLE admin_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),       -- user, order, config, etc.
  target_id VARCHAR(50),
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API调用统计表
CREATE TABLE api_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  api_name VARCHAR(50) NOT NULL,  -- apollo_search, etc.
  call_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  UNIQUE KEY unique_date_api (date, api_name)
);
```

---

## 三、API路由设计

### 用户管理API
```
POST /api/trpc/admin.getUserDetail      - 获取用户详情
POST /api/trpc/admin.adjustCredits      - 调整用户积分
POST /api/trpc/admin.toggleUserStatus   - 启用/禁用用户
POST /api/trpc/admin.resetPassword      - 重置用户密码
POST /api/trpc/admin.searchUsers        - 搜索用户
POST /api/trpc/admin.getUserActivityLogs - 获取用户活动日志
POST /api/trpc/admin.getUserCreditLogs  - 获取用户积分记录
POST /api/trpc/admin.getUserSearchHistory - 获取用户搜索历史
```

### 订单管理API
```
POST /api/trpc/admin.getOrderDetail     - 获取订单详情
POST /api/trpc/admin.confirmOrder       - 手动确认订单
POST /api/trpc/admin.refundOrder        - 退款订单
POST /api/trpc/admin.cancelOrder        - 取消订单
POST /api/trpc/admin.searchOrders       - 搜索订单
```

### 公告通知API
```
POST /api/trpc/admin.createAnnouncement - 创建公告
POST /api/trpc/admin.updateAnnouncement - 更新公告
POST /api/trpc/admin.deleteAnnouncement - 删除公告
POST /api/trpc/admin.getAnnouncements   - 获取公告列表
POST /api/trpc/admin.sendMessage        - 发送用户消息
POST /api/trpc/admin.getMessages        - 获取消息列表

POST /api/trpc/user.getAnnouncements    - 用户获取公告
POST /api/trpc/user.getMessages         - 用户获取消息
POST /api/trpc/user.markMessageRead     - 标记消息已读
```

### 系统监控API
```
POST /api/trpc/admin.getApiStats        - 获取API统计
POST /api/trpc/admin.getErrorLogs       - 获取错误日志
POST /api/trpc/admin.getOnlineUsers     - 获取在线用户
POST /api/trpc/admin.getSystemStats     - 获取系统统计
```

---

## 四、前端页面设计

### 管理后台新增/改进页面

1. **用户管理页面改进**
   - 用户列表增加搜索、筛选功能
   - 用户详情弹窗（积分、订单、日志）
   - 积分调整对话框
   - 密码重置确认框

2. **订单管理页面改进**
   - 订单搜索和筛选
   - 订单详情弹窗（时间线、支付信息）
   - 手动确认支付对话框
   - 退款确认对话框

3. **用户日志页面（新增）**
   - 活动日志列表
   - 搜索记录列表
   - 积分变动记录

4. **系统监控页面（新增）**
   - API调用统计图表
   - 错误日志列表
   - 在线用户列表

5. **公告管理页面（新增）**
   - 公告列表
   - 创建/编辑公告
   - 消息发送

### 用户前端新增页面

1. **消息中心**
   - 公告列表
   - 私信列表
   - 未读消息提示

2. **积分明细**
   - 积分变动历史
   - 按类型筛选

3. **搜索历史**
   - 历史搜索记录
   - 重新搜索功能

4. **账户安全**
   - 修改密码
   - 登录记录

---

## 五、实施计划

### 第一阶段：用户管理增强
- [ ] 数据库Schema更新
- [ ] 用户详情API
- [ ] 积分调整功能
- [ ] 账户状态管理
- [ ] 密码重置功能

### 第二阶段：订单管理增强
- [ ] 订单详情API
- [ ] 手动确认支付
- [ ] 退款功能
- [ ] 订单搜索

### 第三阶段：用户日志系统
- [ ] 活动日志记录
- [ ] 日志查看API
- [ ] 搜索历史查看
- [ ] 积分变动记录

### 第四阶段：系统监控
- [ ] API统计记录
- [ ] 错误日志记录
- [ ] 监控面板

### 第五阶段：公告通知
- [ ] 公告系统
- [ ] 用户消息
- [ ] 前端展示

---

## 六、安全考虑

1. **权限验证** - 所有管理API需验证管理员身份
2. **操作日志** - 记录所有管理员操作
3. **敏感操作确认** - 积分调整、退款等需二次确认
4. **数据脱敏** - 用户敏感信息部分隐藏
5. **频率限制** - 防止API滥用
