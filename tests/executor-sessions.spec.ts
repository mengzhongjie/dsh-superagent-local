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
