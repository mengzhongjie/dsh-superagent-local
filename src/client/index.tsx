/** Browser plugin entry point registering the sidebar icon, main management panel, and Plugin Manager config view. */
import { useCallback, useEffect, useRef } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SidebarPanelIconOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { openKnownSession, SessionNavigationError } from '../navigation.ts'
import { App } from './app.tsx'
import { PluginConfig, usePageForm } from './deployment.tsx'
import { en, zh } from './locales.ts'
import type { T } from './text.ts'

type ClientContext = Context & { sessions: ISessions }
const NS = 'dshSuperagent'
const PANEL_ID = 'dsh-superagent' as MainPanelId
const ENTRY = 'dsh-superagent'

function HammerIcon({ size }: SidebarPanelIconOwnerProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 3.5h9l3.5 1.75v2.5L15 9.5H6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z" /><path d="M10 9.5v10.25a1.75 1.75 0 0 0 3.5 0V9.5" /><path d="M10 15.5h3.5" />
  </svg>
}

/** Mounted panel wrapper; cancels any pending Session navigation when a new one starts or the panel unmounts. */
function Mounted({ ctx, t }: { ctx: ClientContext; t: T }) {
  const pending = useRef<AbortController>(undefined)
  useEffect(() => () => { pending.current?.abort() }, [])
  const openSession = useCallback(async (id: string) => {
    pending.current?.abort()
    const request = new AbortController(); pending.current = request
    try {
      await openKnownSession(ctx.sessions, id as SessionId, target => { ctx.uiWorkspace.openSession(target) }, request.signal)
    } catch (error) {
      if (error instanceof SessionNavigationError) throw new Error(t(error.code === 'not-ready' ? 'sessionListNotReady' : 'sessionNotListed'))
      throw error
    }
  }, [ctx, t])
  const form = usePageForm(ctx.get('configForms')?.get<Record<string, unknown>>(ENTRY))
  return <App t={t} openSession={openSession} deploymentForm={form} />
}

/** 按钮上的标记属性：既用来找自己，也用来避免重复插入。 */
const ENTRY_ATTR = 'data-main-session-entry'

/**
 * 侧栏工作区组标题行的「主会话」入口。
 *
 * 为什么是 DOM 注入：ui-workspace 把整个侧栏声明成 single 独占插槽，组标题行也没有任何子插槽，
 * 插件用 slots 挂不进去；`data-row-key` 是业务属性（不像 class 带构建哈希），适合当锚点。
 * 打开会话复用现成的 openKnownSession，和面板里跳会话走同一条路。
 */
function installMainSessionEntry(ctx: ClientContext, t: T): () => void {
  // 服务端记着"每个工作区的主子是谁"。整页生命周期里这份账基本不变，取到一次就缓存。
  let known: { masterId?: string; masterIds?: string[] } | undefined
  const mainState = async (): Promise<{ masterId?: string; masterIds?: string[] }> => {
    if (known) return known
    // 拼成绝对地址：相对路径在测试宿主里解析不了，而真实页面里两者等价。
    const url = new URL('/orchestrator/api/state', window.location.href)
    // 取不到就当没有，界面退化成"只有面板、没有侧栏入口"，不影响其他功能。
    const response = await fetch(url, { headers: { 'x-orchestrator-request': '1' } }).catch(() => undefined)
    if (response?.ok !== true) return {}
    known = (await response.json()) as { masterId?: string; masterIds?: string[] }
    return known
  }
  // 某个工作区的主子：服务端按需创建，点一次就有一条，之后再点还是同一条。
  const masterOf = async (workspaceId: string): Promise<string | undefined> => {
    const url = new URL('/orchestrator/api/master', window.location.href)
    url.searchParams.set('workspace', workspaceId)
    const response = await fetch(url, { headers: { 'x-orchestrator-request': '1' } }).catch(() => undefined)
    if (response?.ok !== true) return undefined
    const id = ((await response.json()) as { masterId?: string }).masterId
    // 新建出来的主子也要排进隐藏名单，否则它一会儿就会以普通会话的样子冒出来。
    if (id) {
      known = { ...known, masterIds: [...new Set([...(known?.masterIds ?? []), id])] }
      if (!hidden.includes(id)) { hidden = [...hidden, id]; hide(hidden) }
    }
    return id
  }
  // 主子不占工作区组里的一行：★ 按钮就是它的入口，列表里再出现一次只是噪音。
  // 没有从 Host 的会话清单里摘掉它 —— 摘掉之后 uiWorkspace.openSession 就不再认这个 id，
  // ★ 反而打不开。所以分流留在这一层：数据完整，只有侧栏这里不画。
  // 用 style 而不是删节点，是因为行由 React 渲染，删掉会在下次渲染时又回来。
  const hide = (ids: readonly string[]) => {
    for (const id of ids) {
      // 测试宿主没有 CSS.escape，回退成原样拼接；会话 id 只含字母数字和连字符。
      const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
      for (const row of document.querySelectorAll<HTMLElement>(`[data-row-key="session:${escaped}"]`)) {
        if (row.style.display !== 'none') row.style.display = 'none'
      }
    }
  }
  // 点开某个工作区的主子；没带工作区时退回默认那一条。
  const open = async (workspaceId?: string) => {
    // 指明了工作区就不能退回默认主子：那会让人以为进了 A，实际打开的是默认工作区。
    // 只有压根没带工作区（比如没有所在组行）时才用默认那条。
    const id = workspaceId ? await masterOf(workspaceId) : (await mainState()).masterId
    if (!id) return
    // 目标会话可能还没出现在列表里（刚启动），openKnownSession 会等到列表就绪。
    await openKnownSession(ctx.sessions, id as SessionId, target => { ctx.uiWorkspace.openSession(target) }, new AbortController().signal)
  }
  // 按钮所在的组行带着工作区 id，所以点哪一组就打开哪一组自己的主子。
  const workspaceOf = (node: HTMLElement): string | undefined => {
    const row = node.closest<HTMLElement>('[data-row-key^="workspace:"]')
    const key = row?.getAttribute('data-row-key') ?? ''
    return key.startsWith('workspace:') ? key.slice('workspace:'.length) : undefined
  }
  let hidden: string[] = []
  // 名单是服务端给的，而服务端会随着“有人点了别的工作区的 ★”而变多。
  // 每次 DOM 变动都重取一遍太费，节流到 3 秒，保证新出现的主子几秒内也被藏掉。
  let syncedAt = 0
  const syncHidden = async () => {
    if (Date.now() - syncedAt < 3_000) return
    syncedAt = Date.now()
    known = undefined
    const state = await mainState()
    if (state.masterIds?.length) { hidden = state.masterIds; hide(hidden) }
  }
  const insert = () => {
    // 隐藏排在插入之后：同一轮 DOM 变动里先保证入口在，再把列表项压掉。
    hide(hidden)
    for (const row of document.querySelectorAll<HTMLElement>('[data-row-key^="workspace:"]')) {
      // 已经有按钮说明这一行处理过了，跳过可以避免每次 DOM 变动都重建节点。
      if (row.querySelector(`[${ENTRY_ATTR}]`)) continue
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute(ENTRY_ATTR, '1')
      button.title = t('mainEntry')
      button.setAttribute('aria-label', t('mainEntry'))
      button.textContent = '★'
      // 绝对定位而不是排在行里：行右侧的动作区（「…」与「＋」）在鼠标移入时才显形，
      // 一旦占位就会把行里的元素推来推去，按钮在指针下的位置随之改变，点下去会落到隔壁的
      // 「新建会话」上。脱离布局流之后，行怎么变它都在原处。
      button.style.cssText = 'position:absolute;right:30px;top:50%;transform:translateY(-50%);'
        + 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;'
        + 'margin:0;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;opacity:.5;'
        + 'cursor:pointer;font-size:12px;line-height:1'
      button.addEventListener('mouseenter', () => { button.style.opacity = '1' })
      button.addEventListener('mouseleave', () => { button.style.opacity = '.5' })
      // 这一行整行可拖拽（draggable="true"）：鼠标按下如果冒泡到行上就会启动原生拖拽，
      // 拖拽一开始 click 就不再派发，按钮表现为"点不动"。所以在按下阶段就拦掉。
      button.draggable = false
      button.addEventListener('pointerdown', event => { event.stopPropagation() })
      button.addEventListener('mousedown', event => { event.preventDefault(); event.stopPropagation() })
      // 阻止冒泡：这一行本身可点击（折叠/展开工作区），点按钮不该顺带切换。
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void open(workspaceOf(button)) })
      // 绝对定位需要一个定位祖先：行默认是 static，补上 relative 即可，别的样式一概不动。
      if (getComputedStyle(row).position === 'static') row.style.position = 'relative'
      // 位置由 right 决定，插在行尾即可，不再依赖是哪一段 flex 流。
      row.append(button)
    }
    void syncHidden()
  }
  // 侧栏是 React 渲染的，重渲染会抹掉外部插入的节点和行上的 display，所以持续观察并补回。
  const observer = new MutationObserver(insert)
  observer.observe(document.body, { childList: true, subtree: true })
  insert()
  // 先把手里的主子取到，隐藏才能开始生效；拿不到就只保留按钮，不影响使用。
  void mainState().then(state => { if (state.masterIds?.length) { hidden = state.masterIds; insert() } })
  return () => observer.disconnect()
}

export const inject = ['slots', 'locale', 'sessions', 'uiWorkspace']
/** Registers the panel, sidebar icon, and Plugin Manager config view; `configForms` is optional (without it, machine settings are read-only). */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-superagent: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({}) },
    (props: { t: T }) => <Mounted ctx={ctx} t={props.t} />))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 10, label: () => t('panel'), locale: NS }, HammerIcon))
  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: `${ENTRY}#${ENTRY}`, locale: NS },
    (props: PluginConfigViewProps & { t: T }) => <PluginConfig t={props.t} view={props.view} form={props.form} />))
  // 侧栏每个工作区组标题行都放一个主会话入口；卸载时断开观察，避免留下活着的监听器。
  ctx.effect(() => installMainSessionEntry(ctx, t), 'dsh-superagent: sidebar main-session entry')
}
