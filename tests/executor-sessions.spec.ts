/** 会话归属的两条硬规则：worker 目录不漂移，点击失败不冒充成功。 */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('creates and rebuilds a worker in the directory the ticket records', () => {
  const code = readFileSync('src/executor/dsh.ts', 'utf8')
  // 首次启动与"被删掉后重建"必须走同一个方法：一处用全局工作区、一处用执行目录时，
  // 非默认工作区的 worker 被删掉后会换个目录复活，读写的相对路径全错。
  expect(code.match(/this\.workerDirectory\(ticket\)/g)).toHaveLength(2)
  expect(code).not.toMatch(/sessions\.ensure\(sessionId, this\.host\.machine\.workspace/)
  // 目录的来源顺序：Ticket 记录的执行目录优先，没有时才退回全局工作区。
  expect(code).toContain('return ticket.execution?.directory ?? this.host.machine.workspace ?? this.host.machine.stateDir')
})

it('does not open the default main session when the asked workspace has none', () => {
  const code = readFileSync('src/client/index.tsx', 'utf8')
  // 点了工作区 A 的主子却打不开时，退回默认主子会让人以为进了 A，实际在默认工作区。
  expect(code).not.toMatch(/workspaceId \? await masterOf\(workspaceId\) : undefined\) \?\?/)
  expect(code).toContain('const id = workspaceId ? await masterOf(workspaceId) : (await mainState()).masterId')
})

it('relays a report to the session that asked for the ticket, never to the default one', () => {
  const executor = readFileSync(new URL('../src/executor/dsh.ts', import.meta.url), 'utf8')
  const tools = readFileSync(new URL('../src/app/tools/executor.ts', import.meta.url), 'utf8')
  // relay 自己的 id 是报告 id（report:...），拿它查 Ticket 一定查不到 —— 归属必须由调用方给 ticketId。
  expect(executor).toContain('private relay(relay: { id: string; text: string }, ticketId: string): void')
  expect(executor).not.toContain('this.homeOf(id)')
  expect(executor).toContain("this.relay(resultRelay(updated, 'failed', summary), ticketId)")
  expect(executor).toContain("this.relay(resultRelay(updated, 'waiting', said), ticket.id)")
  // worker 自己上报的状态报告同样要回发起它的主会话。
  expect(tools).toContain('host.sessions.relay(relay.id, relay.text, homeOf(host.store, ticket))')
  expect(tools).toContain("const trigger = store.triggers.get(ticket.origin.triggerId)")
})
