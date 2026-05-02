"use client";

interface FilterBarProps {
  filter985: boolean;
  filter211: boolean;
  filterDoubleFirst: boolean;
  totalCount: number;
  filteredCount: number;
  onToggle985: () => void;
  onToggle211: () => void;
  onToggleDoubleFirst: () => void;
}

export default function FilterBar({
  filter985,
  filter211,
  filterDoubleFirst,
  totalCount,
  filteredCount,
  onToggle985,
  onToggle211,
  onToggleDoubleFirst,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
      <span className="text-sm text-gray-500">
        共 <b className="text-blue-600">{totalCount}</b> 所高校
        {filteredCount !== totalCount && (
          <span className="ml-1">
            → 筛选 <b className="text-green-600">{filteredCount}</b> 所
          </span>
        )}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <FilterTag
          label="985"
          active={filter985}
          onClick={onToggle985}
          color="red"
        />
        <FilterTag
          label="211"
          active={filter211}
          onClick={onToggle211}
          color="orange"
        />
        <FilterTag
          label="双一流"
          active={filterDoubleFirst}
          onClick={onToggleDoubleFirst}
          color="purple"
        />
      </div>
    </div>
  );
}

function FilterTag({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    red: {
      bg: active ? "bg-red-50" : "bg-white",
      text: active ? "text-red-600" : "text-gray-400",
      border: active ? "border-red-300" : "border-gray-200",
    },
    orange: {
      bg: active ? "bg-orange-50" : "bg-white",
      text: active ? "text-orange-600" : "text-gray-400",
      border: active ? "border-orange-300" : "border-gray-200",
    },
    purple: {
      bg: active ? "bg-purple-50" : "bg-white",
      text: active ? "text-purple-600" : "text-gray-400",
      border: active ? "border-purple-300" : "border-gray-200",
    },
  };
  const c = colors[color];

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${c.bg} ${c.text} ${c.border} hover:shadow-sm`}
    >
      {label}
    </button>
  );
}
