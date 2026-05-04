import { useCallback, useEffect, useState } from "react";

export const PAGE_SIZE_OPTIONS = [15, 25, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSizeOption = 25;

export function usePagination(totalItems: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const setPageSize = useCallback((size: PageSizeOption) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const paginate = useCallback(<T>(items: T[]): T[] => items.slice(offset, offset + pageSize), [offset, pageSize]);

  return {
    page: safePage,
    pageSize,
    totalPages,
    offset,
    setPage,
    setPageSize,
    paginate,
  };
}
