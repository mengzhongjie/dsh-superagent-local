/** Trigger status view listing Threads filtered by subscription and evaluation activity. */
import { useState } from 'react'
import { THREAD_FILTERS, type ThreadFilter } from '../app/api.ts'
import { usePoll } from './api.ts'
import { Pill } from './controls.tsx'
import { usePanel } from './provider.tsx'
import { ThreadLine } from './rows.tsx'
import { errorText } from './text.ts'
import { Empty, ListSection, PageHead, Toolbar } from './widgets.tsx'

export function TriggerStatus({ filter }: { filter: ThreadFilter }) {
  const { t, call, navigate } = usePanel()
  const [limit, setLimit] = useState(20)
  const { data, error, reload } = usePoll(() => call('GET threads', { query: { filter, limit } }), [filter, limit])
  const go = (next: ThreadFilter) => { setLimit(20); navigate({ page: 'trigger', query: next !== 'subscribed' ? { filter: next } : {} },
    true) }
  // 列表页模板（v2）：页面头（标题 + 说明）→ 筛选条（Toolbar）→ 列表（ListSection 管四态）。
  // 一级导航在顶部 TabBar，页面头不显示返回按钮（back={false}）。
  return <>
    <PageHead back={false} title={t('term.thread')} hint={t('triggerIntro')} />
    {/*
      四态统一交给 ListSection：首次加载的骨架出现在筛选条之前，筛选条只在拿到数据后渲染，
      避免加载途中先闪一排筛选项；空列表仍保留筛选条，用户可以立刻换一个过滤条件。
    */}
    <ListSection loading={!data} error={error ? errorText(error) : undefined} onRetry={() => { void reload() }}
      more={data?.next_offset != null} onMore={() => setLimit(limit + 20)}>
      <Toolbar>
        {THREAD_FILTERS.map(value => <Pill key={value} active={filter === value}
          onClick={() => go(value)}>{t(`threadFilter.${value}`)}</Pill>)}
      </Toolbar>
      {data && (data.items.length ? <ul className="dt-list">{data.items.map(thread => <ThreadLine key={thread.key}
        thread={thread} />)}</ul> : <Empty icon="inbox" title={t('emptyList')} hint={t('emptyListHint')} />)}
    </ListSection>
  </>
}
