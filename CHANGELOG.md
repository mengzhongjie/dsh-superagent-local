# Changelog

本仓库是 dsh-superagent（研究方向原型）的本地改造版。下面是相对上游 0.1.0 的改动。

## 0.2.2 — 2026-11-08

### 修复：展开工作区时下面那一组会先弹一下

- 插件自建会话（`worker-` / `orchestrator-`）原来靠 `MutationObserver` 在行渲染之后写
  行内 `display: none`（`hide` / `hideOwn`）。宿主的侧栏列表用 FLIP 动画
  （`AnimatedRows`）：React 提交那一帧就把所有行摆好，并在同一个 tick 里读每行的
  `getBoundingClientRect` 当动画起点。观察者回调写在提交之后，宿主量到的还是"这些行还在"
  的更高布局，随后行被压掉，列表实际只长高一小截 —— 动画从过高起点下落，就是视觉上的弹一下。
- 新增 `src/client/sidebar-hide.ts`：把"插件自建会话不占一行"写成静态样式表，
  在 `installMainSessionEntry` 里挂到 `document.head`（`data-superagent-sidebar-hide` 标记，
  卸载时移除）。静态规则在首次布局之前就生效，宿主量到的就是最终布局。
- `hide()` / `hideOwn()` 改成先看 computed `display`：样式表已经收起这一行时不再写行内
  `style.display`，观察者每轮跑一遍也只剩一次布局变更。标题为 `superagent` 的伪工作区行
  仍只能靠观察者（CSS 不能按文本匹配）。
- 实测（macOS 桌面版宿主，1.15 页面缩放，装主题与另一个插件）：修复前下方组首帧比落点高
  34px（过冲比例 0.5），修复后 0；纯宿主基线本来就是 0。

## 0.2.0 — 2026-11-01

### 新增：需求来自本机操作者

- `src/sources/dsh.ts`，作为 `./local-watch` 导出，注册 Source kind `dsh`
  （标题「本机操作者」）。主会话里由人手输入的消息（`message.source.kind === 'user'`）
  变成 Trigger，主会话的回复回到同一条会话。
- 消息里带的图片和文件随需求一起走：Trigger 的 `meta.attachments` 记录附件 id，
  Executor 在派给 Worker 的任务说明里附上 `~/.dsh/attachments/v1/objects/<前两位>/<id>`
  路径，Worker 用 `read_image` 打开后再动手。
- 本地部署不再要求 GitHub 仓库：`resolveDeployment` 在没有远端时返回空 repository，
  GitHub watcher 报 `paused` 而不是反复失败。

### 新增：每个工作区一条主会话

- `KV.runtime.masters` 记录 workspaceId 到 sessionId 的映射，重启后恢复。
- `GET /orchestrator/api/master?workspace=<id>` 按需创建并返回该工作区的主会话，
  会话 id 由工作区路径确定性生成，cwd 就是该工作区目录。
- `Runtime.isMaster()` 让所有主会话都套 router preset、挂路由工具；主会话只有
  路由类工具，没有 bash 和文件写入。
- 客户端在每个工作区组标题行注入 ★ 按钮（`data-main-session-entry`），点它打开
  该工作区的主会话，并把主会话行从侧栏列表里隐藏。

### 修复：一次需求一张工单

- `meta.newTicket` 让本地来源的每条消息都开新工单，不再被同 thread 的运行中工单
  吸收，也不会复活已结束的工单。修正前第二条需求会挂到第一张工单上、复用同一个
  Worker 会话。
- 本地需求的 Worker 会话与主会话同组，产物落在该工作区目录，不再为每张工单建
  `work/<工单名>` 工作区。

### 改进：结果回给发起它的主会话

- `relay` 与 `notice` 两个 effect 载荷带上 `sessionId`，工单结束通知回到创建它的
  那条主会话，而不是固定回默认主会话。
- 工单卡片带 `workspace` 字段说明产物目录，提示词要求主会话去那里读文件。
