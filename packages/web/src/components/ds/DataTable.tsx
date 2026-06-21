'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { cn } from './cn';
import { EmptyWorkbench } from './EmptyWorkbench';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  virtualized?: boolean;
  rowHeight?: number; // Estimated row height for virtualizer
  emptyTitle?: string;
  emptyDescription?: string;
  emptyCodeExample?: string;
  emptyActionLabel?: string;
  onEmptyActionClick?: () => void;
  // URL serialization key for search query
  filterParamKey?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  virtualized = false,
  rowHeight = 44,
  emptyTitle = 'No data available',
  emptyDescription = 'There is currently no database record to display in this list.',
  emptyCodeExample,
  emptyActionLabel,
  onEmptyActionClick,
  filterParamKey = 'q',
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Retrieve initial sorting/filtering from URL or local state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // Sync search filter from URL searchParams
  const filterValue = searchParams.get(filterParamKey) ?? '';

  // Synchronize local filter state when URL searchParams update
  React.useEffect(() => {
    if (filterParamKey) {
      setColumnFilters(
        filterValue ? [{ id: 'globalSearch' as any, value: filterValue }] : []
      );
    }
  }, [filterValue, filterParamKey]);

  // Handle setting/pushing filters to Next.js URL router
  const handleFilterChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set(filterParamKey, val);
    } else {
      params.delete(filterParamKey);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Custom global filter filter function
    globalFilterFn: (row, columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      // Search across all cell string conversions
      return columns.some((col) => {
        const cellValue = row.getValue(col.id || (col as any).accessorKey);
        return String(cellValue).toLowerCase().includes(search);
      });
    },
  });

  const { rows } = table.getRowModel();

  // Setup virtualization container ref and virtualizer hook
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Render Table Head
  const renderHeader = () => (
    <thead className="sticky top-0 bg-ds-panel z-10 border-0 border-b border-solid border-ds-border select-none">
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const isSortable = header.column.getCanSort();
            return (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className={cn(
                  'px-4 py-3 text-left font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-widest border-0 border-b border-solid border-ds-border',
                  isSortable ? 'cursor-pointer hover:text-ds-green hover:bg-ds-panel-2/30 transition-colors' : ''
                )}
                style={{
                  width: header.column.columnDef.size,
                }}
              >
                <div className="flex items-center gap-1.5">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  
                  {/* Sorting indicator symbols */}
                  {isSortable && header.column.getIsSorted() && (
                    <span className="text-ds-green text-[9px]">
                      {header.column.getIsSorted() === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );

  // Render structural skeletons for loading state
  const renderSkeletons = () => {
    const skeletonRowsCount = 5;
    return (
      <tbody>
        {Array.from({ length: skeletonRowsCount }).map((_, idx) => (
          <tr
            key={idx}
            className="border-0 border-b border-solid border-ds-border/50 bg-transparent animate-pulse"
          >
            {columns.map((col, colIdx) => (
              <td key={colIdx} className="px-4 py-3">
                <div
                  className="h-4 bg-ds-border rounded-[4px] opacity-60"
                  style={{
                    // Assign random realistic structural widths for placeholder skeletons
                    width: col.size ? `${col.size}px` : colIdx === 0 ? '120px' : colIdx === 1 ? '240px' : '80px',
                    maxWidth: '100%',
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  };

  // Render Body Rows (Virtual vs Standard layout)
  const renderRows = () => {
    if (rows.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={columns.length} className="px-4 py-8">
              <EmptyWorkbench
                title={emptyTitle}
                description={emptyDescription}
                codeExample={emptyCodeExample}
                actionLabel={emptyActionLabel}
                onActionClick={onEmptyActionClick}
              />
            </td>
          </tr>
        </tbody>
      );
    }

    if (virtualized) {
      const virtualRows = rowVirtualizer.getVirtualItems();
      const totalSize = rowVirtualizer.getTotalSize();

      return (
        <tbody style={{ height: `${totalSize}px`, position: 'relative' }}>
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute w-full border-0 border-b border-solid border-ds-border hover:bg-ds-panel-2/30 transition-colors duration-100 flex"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="flex-1 px-4 py-3 flex items-center text-sm font-ds-sans text-ds-text-2 overflow-hidden truncate"
                    style={{
                      width: cell.column.columnDef.size,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      );
    }

    return (
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="border-0 border-b border-solid border-ds-border hover:bg-ds-panel-2/20 transition-colors duration-100"
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className="px-4 py-3.5 text-sm font-ds-sans text-ds-text-2 truncate"
                style={{
                  width: cell.column.columnDef.size,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4 font-ds-sans">
      {/* Table search filter bar */}
      {filterParamKey && (
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="text"
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Filter list records..."
            className="w-full bg-ds-shell border border-solid border-ds-border rounded-[8px] py-1.5 px-3 font-ds-mono text-xs text-ds-text placeholder:text-ds-text-3 outline-none focus:border-ds-green transition-all"
            aria-label="Filter database list records"
          />
        </div>
      )}

      {/* Main Table Scrolling Wrapper */}
      <div
        ref={tableContainerRef}
        className="w-full overflow-auto rounded-lg border border-solid border-ds-border bg-ds-panel custom-scrollbar"
        style={{
          maxHeight: virtualized ? '500px' : 'none',
        }}
      >
        <table className="w-full border-collapse text-left table-fixed">
          {renderHeader()}
          {loading ? renderSkeletons() : renderRows()}
        </table>
      </div>
    </div>
  );
}
