export type RunCreateRequest = {
  name: string;
  scenarios_path: string;
  spells_path: string;
  baseline_model: string;
  candidate_model: string;
  judge_model: string;
  baseline_prompt_version: string;
  candidate_prompt_version: string;
  judge_prompt_version: string;
  margin_threshold: number;
};

export type CandidateOutput = {
  primary_spell: string;
  targeting: string;
  why_now: string;
  backup_spells: string[];
  rules_assumptions: string[];
};

export type JudgeResult = {
  winner: "baseline" | "candidate" | "tie";
  margin: number;
  scores: {
    baseline: {
      tactical_fit: number;
      efficiency: number;
      risk: number;
      rules_soundness: number;
      weighted_total: number;
    };
    candidate: {
      tactical_fit: number;
      efficiency: number;
      risk: number;
      rules_soundness: number;
      weighted_total: number;
    };
  };
  assumption_penalty: {
    applied_to: "baseline" | "candidate" | "none";
    amount: number;
    reason: string;
  };
  rationale: string;
};
