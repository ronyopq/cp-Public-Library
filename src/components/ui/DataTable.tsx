import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
}

export function DataTable<T>({
  columns,
  items,
  empty,
}: {
  columns: TableColumn<T>[]
  items: T[]
  empty?: ReactNode
}) {
  if (items.length === 0 && empty) {
    return <>{empty}</>
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
