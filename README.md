# Header Modifier

一个轻量级 Chrome 扩展，用于修改 HTTP 请求头（Request Headers），功能类似 ModHeader。

---

## 功能

- **全局开关** — 顶栏 Toggle 一键启用/禁用所有规则
- **多 Tab** — 每个 Tab 独立管理一组 Headers，只有当前激活 Tab 的规则生效
- **Header 操作** — 支持 Set / Append / Remove 三种操作
- **预设下拉** — Header-Name 支持预设选项（`X-Forwarded-For`），也可手动输入
- **注释字段** — 每行支持添加备注，不影响实际请求
- **持久化** — 规则写入 `declarativeNetRequest`，浏览器重启后依然生效

---

## 安装

1. 打开 Chrome，进入 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择本项目目录

---

## 使用

### Tab 管理

| 操作 | 说明 |
|------|------|
| 点击 Tab | 切换到该 Tab |
| 点击 `+` | 新建 Tab |
| 双击 Tab 名 | 内联重命名，Enter / 失焦保存，Esc 取消 |
| 点击 Tab 上的 `×` | 删除该 Tab（至少保留一个） |

### Header 管理

| 字段 | 说明 |
|------|------|
| 左侧 Toggle | 单条规则启用/禁用 |
| 操作下拉 | Set（覆盖）/ Append（追加）/ Remove（删除该 Header） |
| Header-Name | 手动输入，或点击 `▾` 从预设列表选择 |
| Value | Header 的值，操作为 Remove 时自动隐藏 |
| `# note...` | 备注，仅本地保存，不影响请求 |
| `×` | 删除该行 |

> **注意**：切换 Tab 后规则立即生效，其他 Tab 的 Headers 不会发送。

---

## 文件结构

```
headers/
├── manifest.json   # 扩展描述，MV3，声明权限
├── background.js   # Service Worker，初始化默认 state
├── popup.html      # 弹窗 HTML 骨架
├── popup.js        # UI 逻辑、状态管理、规则同步
└── styles.css      # 深色主题 UI
```

---

## 技术说明

- **Manifest V3** — 使用 `declarativeNetRequest` API 修改请求头，符合 Chrome 最新扩展规范
- **动态规则持久化** — `updateDynamicRules` 写入的规则跨会话保留，无需 Service Worker 常驻
- **存储** — 配置通过 `chrome.storage.local` 持久化

### 添加更多预设 Header

编辑 `popup.js` 顶部的 `HEADER_SUGGESTIONS` 数组：

```js
const HEADER_SUGGESTIONS = [ 'X-Forwarded-For', 'Authorization', 'X-Api-Key'];
```
