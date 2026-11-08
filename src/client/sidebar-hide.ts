/**
 * 侧栏里“插件自建会话不占一行”的那张静态样式表。
 *
 * 为什么是静态样式表，而不是等 MutationObserver 回调去写行内 display：
 * 宿主侧栏的行列表用 FLIP 动画（内部叫 AnimatedRows）——React 提交那一帧就把所有行按新布局
 * 摆好，并在同一个 tick 里读每行的 getBoundingClientRect 当动画起点。观察者回调写在提交之后，
 * 宿主量到的还是“这些行还在”的更高布局，随后行被压掉，列表实际只长高一小截，
 * 动画便从过高的起点往下落，视觉上就是「展开一个工作区，下面那组先弹一下」。
 * 静态规则在首次布局之前就生效，宿主量到的就是最终布局，这段多余动画根本不会产生。
 *
 * 前缀来自插件自己的会话 id 命名（见 src/executor/dsh.ts 的 workerSessionId 与
 * src/app/runtime.ts 的 orchestrator-<hash>）：都是插件控制的名字，可以按属性选择器静态匹配。
 *
 * 写成 TS 常量而不是 .css 文件，是因为构建（tsdown 的 raw 插件）与单元测试（vitest）对
 * `?raw` 的处理不同：tsdown 里能拿到文本，vitest 里拿到空串，测试就没法断言这张表的内容。
 */
export const SIDEBAR_HIDE_STYLE = [
  '/* 插件自建会话（worker- / orchestrator-）不占侧栏一行；第一帧布局就生效。 */',
  '[data-row-key^="session:worker-"],',
  '[data-row-key^="session:orchestrator-"] {',
  '  display: none !important;',
  '}',
  '',
].join('\n')
