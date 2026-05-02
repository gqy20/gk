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

  if (displayProvinces.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#81786a]">
        没有匹配的高校
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f0e6] p-3">
      {displayProvinces.map((prov, index) => {
        const doneCount = prov.schools.filter((school) => school.status === "done").length;
        const progress = Math.round((doneCount / Math.max(prov.schools.length, 1)) * 100);

        return (
        <div key={prov.name} className="mb-3 overflow-hidden rounded-lg border border-black/10 bg-[#fffaf0]">
          <button
            type="button"
            aria-pressed={selectedProvince === prov.name}
            onClick={() => onProvinceClick(prov.name)}
            className={`w-full px-3 py-3 text-left transition ${
              selectedProvince === prov.name
                ? "bg-[#1a342f] text-[#fff9ec]"
                : "bg-[#fffaf0] text-[#181713] hover:bg-[#f0e7d8]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-current/20 text-[11px] font-semibold tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{prov.name}</span>
                  <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs font-semibold">
                    {prov.count} 所
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-[#d8b75d]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] opacity-65">
                  {doneCount} collected · {progress}%
                </div>
              </div>
            </div>
          </button>

          {(selectedProvince === prov.name || !selectedProvince) && (
            <div className="border-t border-black/10 bg-[#fbf5ea]">
              {prov.schools.map((school) => (
                <button
                  type="button"
                  key={school.name}
                  onClick={() => onSchoolClick(school)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs transition ${
                    selectedSchool?.name === school.name
                      ? "bg-[#dfeee8] text-[#163d36]"
                      : "text-[#4f4a40] hover:bg-[#f1e8da]"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      school.status === "done"
                        ? "bg-[#2f9f7a]"
                        : "bg-[#b7afa0]"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{school.name}</span>
                  <span className="ml-auto flex flex-shrink-0 gap-1">
                    {school.is985 && (
                      <span className="rounded border border-[#e3a08b]/50 bg-[#f9ddd4] px-1.5 py-px text-[10px] text-[#9d3b25]">
                        985
                      </span>
                    )}
                    {school.is211 && !school.is985 && (
                      <span className="rounded border border-[#d8b75d]/50 bg-[#f5e4bb] px-1.5 py-px text-[10px] text-[#8a6414]">
                        211
                      </span>
                    )}
                    {school.isDoubleFirstClass && !school.is985 && !school.is211 && (
                      <span className="rounded border border-[#6fc0a5]/50 bg-[#dfeee8] px-1.5 py-px text-[10px] text-[#2c5f55]">
                        双一流
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
