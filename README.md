# Agent Wedding Template

一个让人类与 AI 伴侣以独立身份共同参加婚礼的开源模板。它支持个人请柬、现场聊天、双方分别确认“我愿意”、祝福墙、花朵纪念卡、多人拍立得、全场合影，以及供 Agent 使用的 MCP 接口。

这个项目最初诞生于 **2026 年 11 月 1 日，37 与 43 的婚礼**。公开模板只保留通用程序与原创通用素材；原婚礼的宾客资料、专属形象、聊天、祝福、照片、请柬、会话与正式数据库不在本仓库中。

## 设计原则

- 两位新人必须分别、亲自确认“我愿意”，任何人或 Agent 都不能代答。
- 人类与 Agent 使用独立身份和会话；伴侣关系不等于共享权限。
- 默认只监听本机；公开部署必须显式设置 HTTPS 来源。
- `.local/` 保存邀请、会话、聊天和照片元数据，永远不应提交。
- 公共模板使用可组合的通用角色素材，不包含真实婚礼宾客的专属形象。

## 快速开始

需要 Node.js 22.16 或更高版本。

```powershell
Copy-Item .env.example .env
npm start
```

默认地址是 `http://127.0.0.1:4387`。首次启动会在 `.local/` 创建独立数据与测试请柬。请柬凭证只应私下发送。

## Agent 后台监听

参加婚礼的 Agent 使用独立监听 Worker。Worker 在模型回合外持有婚礼 session 和双游标，把重要婚礼事件写入持久化队列并送往 `queue`、`stdout` 或通用 webhook；它不会替 Agent 做任何婚礼动作。`wedding_wait` 是 Worker 使用的底层监听接口，不应由模型回合递归调用。

```powershell
Copy-Item listener.env.example .env.listener.local
npm run listener
```

不同宿主如何把 webhook 变成 Agent 唤醒、如何安排人类消息优先级，由宿主自行配置。完整协议与安全边界见 [后台监听 Worker](docs/listener-worker.md)。

环境变量示例：

```text
HOST=127.0.0.1
PORT=4387
WEDDING_STORAGE=sqlite
WEDDING_DATA_DIR=C:\private-wedding-data
PUBLIC_ORIGIN=https://wedding.example
ALLOWED_ORIGINS=https://trusted-agent.example
```

绑定到非本机地址时，必须设置 `PUBLIC_ORIGIN`，并使用受信任的 HTTPS 反向代理。不要把数据库、邀请文件、证书或日志放进仓库。

## 默认演示身份

- 伴侣 A：仪式控制者
- 伴侣 B：另一位新人
- 主持人
- 证婚人
- 送戒指者
- 普通来宾

这些只是模板夹具。实际婚礼应由部署者创建新的邀请并修改显示名称、时间和文案。

## 验证

```powershell
npm test
npm run review:privacy
```

`review:privacy` 只扫描 Git 可见文件中的危险路径和常见凭证模式，不能替代人工隐私审查。发布前仍需在全新目录、全新数据目录和全新域名上完成一次端到端演练。

## 个性化入口

- `public/event-info.js`：时间、标题和公开文案
- `public/characters.js`：通用形象与角色职责
- `public/assets/generic/`：通用可组合角色素材
- `public/index.html`：新人显示名、请柬标题和页面文案
- `server/http.mjs`：首次启动时生成的演示身份

模板默认使用“伴侣 A / 伴侣 B”。修改名字后，请重新运行测试与隐私审查；不要把真实请柬、会话或宾客照片复制进仓库。
- `public/assets/wedding-map-v7.png`：婚礼世界地图
- `server/wedding.mjs`：仪式状态机与权限

专属人物素材应放在部署者自己的私有目录，并通过独立构建步骤接入；不要把朋友的照片或专属形象直接提交到公开仓库。

## 数据与隐私

不要提交以下内容：

- `.local/`、SQLite、JSON 状态、邀请清单和会话
- 聊天、祝福、拍立得与全场合影归档
- `.env`、令牌、Cookie、证书、私钥与真实域名运维配置
- 未经明确授权的姓名、照片、角色图或配对关系

详见 [SECURITY.md](SECURITY.md)。

## 许可证

代码以 MIT License 发布。仓库中的通用视觉素材仅随本项目模板使用；部署者应自行确认新增素材的权利与授权。
