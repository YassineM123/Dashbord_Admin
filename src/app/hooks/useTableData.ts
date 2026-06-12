import { useState, useMemo } from 'react';
import { filterBySearch, paginate, sortBy, getPaginationInfo } from '../utils/helpers';
import { DEFAULT_PAGE_SIZE } from '../constants';

export interface UseTableDataOptions<T> {
  data: T[];
  searchFields?: (keyof T)[];
  defaultPageSize?: number;
  defaultSortKey?: keyof T;
  defaultSortOrder?: 'asc' | 'desc';
}

export function useTableData<T>({
  data,
  searchFields = [],
  defaultPageSize = DEFAULT_PAGE_SIZE,
  defaultSortKey,
  defaultSortOrder = 'asc',
}: UseTableDataOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!searchQuery || searchFields.length === 0) return data;
    return filterBySearch(data, searchQuery, searchFields);
  }, [data, searchQuery, searchFields]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return sortBy(filteredData, sortKey, sortOrder);
  }, [filteredData, sortKey, sortOrder]);

  // Paginate data
  const paginatedData = useMemo(() => {
    return paginate(sortedData, currentPage, pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Pagination info
  const paginationInfo = useMemo(() => {
    return getPaginationInfo(sortedData.length, currentPage, pageSize);
  }, [sortedData.length, currentPage, pageSize]);

  // Handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page on page size change
  };

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      // Toggle sort order if same key
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort key, default to ascending
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleSelectRow = (id: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      const allIds = paginatedData.map((item: any) => item.id);
      setSelectedRows(new Set(allIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedRows(new Set());
  };

  return {
    // Data
    data: paginatedData,
    filteredData,
    sortedData,
    totalCount: sortedData.length,

    // Search
    searchQuery,
    setSearchQuery: handleSearch,

    // Pagination
    currentPage,
    pageSize,
    paginationInfo,
    setCurrentPage: handlePageChange,
    setPageSize: handlePageSizeChange,

    // Sorting
    sortKey,
    sortOrder,
    handleSort,

    // Selection
    selectedRows,
    handleSelectRow,
    handleSelectAll,
    handleClearSelection,
    isAllSelected: selectedRows.size === paginatedData.length && paginatedData.length > 0,
  };
}
