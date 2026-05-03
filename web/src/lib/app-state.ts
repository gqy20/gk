import type { School, ProvinceData } from "@/lib/data";

export interface AppState {
  data: { schools: School[]; provinces: ProvinceData[] } | null;
  loadError: string | null;
  selectedProvince: string | null;
  selectedSchool: School | null;
  previewSchool: School | null;
  query: string;
  filter985: boolean;
  filter211: boolean;
  filterDoubleFirst: boolean;
  compareSchools: School[];
  compareOpen: boolean;
}

export const initialState: AppState = {
  data: null,
  loadError: null,
  selectedProvince: null,
  selectedSchool: null,
  previewSchool: null,
  query: "",
  filter985: false,
  filter211: false,
  filterDoubleFirst: false,
  compareSchools: [],
  compareOpen: false,
};

export type AppAction =
  | { type: "SET_DATA"; payload: { schools: School[]; provinces: ProvinceData[] } | null }
  | { type: "SET_LOAD_ERROR"; payload: string | null }
  | { type: "SELECT_PROVINCE"; payload: string | null }
  | { type: "SELECT_SCHOOL"; payload: School | null }
  | { type: "SET_PREVIEW_SCHOOL"; payload: School | null }
  | { type: "SET_QUERY"; payload: string }
  | { type: "TOGGLE_FILTER"; payload: "985" | "211" | "doubleFirst" }
  | { type: "RESET_FILTERS" }
  | { type: "TOGGLE_COMPARE"; payload: School }
  | { type: "REMOVE_COMPARE"; payload: School }
  | { type: "CLEAR_COMPARE" }
  | { type: "SET_COMPARE_OPEN"; payload: boolean };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, data: action.payload };

    case "SET_LOAD_ERROR":
      return { ...state, loadError: action.payload };

    case "SELECT_PROVINCE": {
      const province = action.payload;
      const isSame = province === state.selectedProvince;
      return {
        ...state,
        selectedProvince: isSame ? null : province,
        selectedSchool: null,
        previewSchool: null,
        compareOpen: false,
      };
    }

    case "SELECT_SCHOOL": {
      const school = action.payload;
      return {
        ...state,
        selectedSchool: school,
        previewSchool: null,
        selectedProvince: school?.province ?? null,
        compareOpen: false,
      };
    }

    case "SET_PREVIEW_SCHOOL": {
      return {
        ...state,
        previewSchool: action.payload,
      };
    }

    case "SET_QUERY":
      return { ...state, query: action.payload };

    case "TOGGLE_FILTER": {
      const key =
        action.payload === "985"
          ? "filter985"
          : action.payload === "211"
            ? "filter211"
            : "filterDoubleFirst";
      return { ...state, [key]: !state[key] } as AppState;
    }

    case "RESET_FILTERS":
      return {
        ...state,
        query: "",
        filter985: false,
        filter211: false,
        filterDoubleFirst: false,
      };

    case "TOGGLE_COMPARE": {
      const school = action.payload;
      const exists = state.compareSchools.some((s) => s.name === school.name);
      if (exists) {
        const next = state.compareSchools.filter((s) => s.name !== school.name);
        return {
          ...state,
          compareSchools: next,
          compareOpen: next.length < 2 ? false : state.compareOpen,
        };
      }
      if (state.compareSchools.length >= 3) return state;
      return {
        ...state,
        compareSchools: [...state.compareSchools, school],
      };
    }

    case "REMOVE_COMPARE": {
      const next = state.compareSchools.filter(
        (s) => s.name !== action.payload.name,
      );
      return {
        ...state,
        compareSchools: next,
        compareOpen: next.length < 2 ? false : state.compareOpen,
      };
    }

    case "CLEAR_COMPARE":
      return { ...state, compareSchools: [], compareOpen: false };

    case "SET_COMPARE_OPEN":
      return { ...state, compareOpen: action.payload };

    default:
      return state;
  }
}
