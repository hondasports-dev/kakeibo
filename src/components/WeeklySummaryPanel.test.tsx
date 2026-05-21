import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { WeeklySummaryPanel } from './WeeklySummaryPanel'

describe('WeeklySummaryPanel', () => {
  it('レシート0件では空状態と予算未設定を表示する', () => {
    // Given: 今週のレシートがまだ登録されていない
    renderWithProviders(
      <WeeklySummaryPanel
        count={0}
        totalAmountYen={0}
        byCategory={[]}
        prevWeekTotalAmountYen={null}
        receipts={[]}
      />,
    )

    // When: 週次サマリーを確認する
    // Then: 空状態と予算未設定が表示される
    expect(screen.getByText('0円')).toBeInTheDocument()
    expect(screen.getByText('未設定')).toBeInTheDocument()
    expect(screen.getAllByText('まだレシートがありません')).toHaveLength(2)
    expect(screen.getByText('0件')).toBeInTheDocument()
  })

  it('複数レシートの合計、カテゴリ別、前週比、支出一覧を表示する', () => {
    // Given: カテゴリ別に集計済みのレシートがある
    renderWithProviders(
      <WeeklySummaryPanel
        count={2}
        totalAmountYen={6280}
        budgetAmountYen={10000}
        byCategory={[
          {
            categoryId: 'cat-food',
            categoryName: '食費',
            categoryColor: '#2563EB',
            totalAmountYen: 4280,
            count: 1,
          },
          {
            categoryId: 'cat-daily',
            categoryName: '日用品',
            categoryColor: '#16A34A',
            totalAmountYen: 2000,
            count: 1,
          },
        ]}
        prevWeekTotalAmountYen={7000}
        receipts={[
          {
            _id: 'receipt-1',
            date: '2026-05-18',
            shopName: 'スーパー北浜',
            amountYen: 4280,
            categoryId: 'cat-food',
            categoryName: '食費',
            categoryColor: '#2563EB',
          },
          {
            _id: 'receipt-2',
            date: '2026-05-19',
            shopName: 'ドラッグストア南',
            amountYen: 2000,
            categoryId: 'cat-daily',
            categoryName: '日用品',
            categoryColor: '#16A34A',
          },
        ]}
      />,
    )

    // When: 週次サマリーを確認する
    // Then: 合計・予算・カテゴリ別・支出一覧が表示される
    expect(screen.getByText('6,280円')).toBeInTheDocument()
    expect(screen.getByText(/10,000円 中 63% 消化/)).toBeInTheDocument()
    expect(screen.getByText('-720円')).toBeInTheDocument()
    expect(screen.getByText('スーパー北浜')).toBeInTheDocument()
    expect(screen.getByText('ドラッグストア南')).toBeInTheDocument()
    expect(screen.getAllByText('食費')).toHaveLength(2)
    expect(screen.getAllByText('日用品')).toHaveLength(2)
  })
})
