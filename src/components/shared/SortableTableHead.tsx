import { useState, useMemo } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}

export const SortableTableHead = ({
  children,
  sortKey,
  currentSort,
  onSort,
  className,
}: SortableTableHeadProps) => {
  const isActive = currentSort.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none transition-colors hover:bg-muted/50 group",
        isActive && "bg-muted/30",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        <span>{children}</span>
        <span className={cn(
          "transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        )}>
          {direction === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : direction === "desc" ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4" />
          )}
        </span>
      </div>
    </TableHead>
  );
};

// Helper to get nested object values like "categories.name"
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

// Hook for sorting logic
export function useSorting<T>(data: T[] | undefined, initialKey = "", initialDirection: SortDirection = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: initialKey,
    direction: initialDirection,
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { key: "", direction: null };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!data || !sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a: any, b: any) => {
      const aValue = getNestedValue(a, sortConfig.key);
      const bValue = getNestedValue(b, sortConfig.key);

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

      // Handle numbers
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr, "pt-BR");
      }
      return bStr.localeCompare(aStr, "pt-BR");
    });
  }, [data, sortConfig]);

  return { sortConfig, handleSort, sortedData };
}
