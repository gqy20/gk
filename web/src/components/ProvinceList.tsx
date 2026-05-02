"use client";

import type { School, ProvinceData } from "@/lib/data";

interface ProvinceListProps {
  provinces: ProvinceData[];
  selectedProvince: string | null;
  selectedSchool: School | null;
  onProvinceClick: (province: string) => void;
  onSchoolClick: (school: School) => void;
}

export default function ProvinceList({
  provinces,
  selectedProvince,
  selectedSchool,
  onProvinceClick,
  onSchoolClick,
}: ProvinceListProps) {
  const displayProvinces = selectedProvince
    ? provinces.filter((p) => p.name === selectedProvince)
    : provinces;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3">
      {displayProvinces.map((prov) => (
        <div key={prov.name} className="mb-3">
          <button
            onClick={() => onProvinceClick(prov.name)}
            className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              selectedProvince === prov.name
                ? "bg-blue-50 text-blue-700"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{prov.name}</span>
            <span className="float-right text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
              {prov.count} 所
            </span>
          </button>

          {(selectedProvince === prov.name || !selectedProvince) && (
            <div className="border border-t-0 border-gray-100 rounded-b">
              {prov.schools.map((school) => (
                <button
                  key={school.name}
                  onClick={() => onSchoolClick(school)}
                  className={`w-full text-left px-4 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                    selectedSchool?.name === school.name
                      ? "bg-blue-100 text-blue-800"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {/* 状态圆点 */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      school.status === "done"
                        ? "bg-green-400"
                        : "bg-gray-300"
                    }`}
                  />
                  <span className="truncate">{school.name}</span>
                  {/* 标签 */}
                  <span className="ml-auto flex-shrink-0 flex gap-1">
                    {school.is985 && (
                      <span className="text-[10px] px-1 py-px bg-red-50 text-red-500 rounded">
                        985
                      </span>
                    )}
                    {school.is211 && !school.is985 && (
                      <span className="text-[10px] px-1 py-px bg-orange-50 text-orange-500 rounded">
                        211
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
