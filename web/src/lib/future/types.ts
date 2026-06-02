export type FutureRunStatus = "generating" | "completed" | "failed";

export interface StudentProfileInput {
  province: string;
  subjectTrack: string;
  scoreBand: string;
  personalityTags: string[];
  interests: string[];
  riskTolerance: number;
  familySupport: string;
  goals: string;
}

export interface ChoiceEvidence {
  label: string;
  text: string;
}

export interface FutureChoiceContext {
  school: string;
  major?: string;
  city?: string;
  province?: string;
  schoolTags: string[];
  evidence: ChoiceEvidence[];
}

export interface FutureRunInput {
  profile: StudentProfileInput;
  choiceContext: FutureChoiceContext;
  pathCount: number;
}

export interface FutureBranchPlan {
  index: number;
  name: string;
  riskTone: ProbabilityTone;
  focus: string;
  assumptions: string[];
  requiredTradeoffs: string[];
}

export interface FutureValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  diversityScore: number;
}

export type FutureScoreKey =
  | "income"
  | "stability"
  | "growth"
  | "happiness"
  | "risk"
  | "school_fit"
  | "major_fit";

export interface FutureScoreItem {
  value: number;
  reason: string;
}

export type FutureScores = Record<FutureScoreKey, FutureScoreItem>;

export interface FutureTimelineItem {
  stage: string;
  text: string;
  key_events: string[];
}

export type ProbabilityTone = "稳健" | "均衡" | "冒险";

export interface FuturePath {
  index: number;
  label: string;
  tagline: string;
  probability_tone: ProbabilityTone;
  fit_score: number;
  branch_ref?: string;
  scores: FutureScores;
  timeline: FutureTimelineItem[];
  key_risks: string[];
  turning_points: string[];
  advice: string;
}

export interface FutureStructuredOutput {
  title: string;
  summary: string;
  choice_context: {
    school: string;
    major?: string;
    city?: string;
    assumptions: string[];
  };
  paths: FuturePath[];
  comparison: {
    best_for_income: string;
    best_for_stability: string;
    best_for_growth: string;
    highest_risk: string;
    most_balanced: string;
  };
  branch_plan?: FutureBranchPlan[];
  validation?: FutureValidationReport;
  overall_advice: string;
}

export interface FutureRunRecord {
  id: string;
  status: FutureRunStatus;
  input?: FutureRunInput;
  output?: FutureStructuredOutput | null;
  model?: string;
  promptVersion?: string;
  error?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FutureRunResult {
  run: FutureRunRecord;
  output: FutureStructuredOutput | null;
}
