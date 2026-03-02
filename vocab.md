# Eval Vocabulary (Top 5)

## 1) Benchmark
A benchmark is a stable, repeatable set of test cases used to compare systems fairly over time. The key idea is consistency: if you change models, prompts, or logic, you still measure against the same core scenarios so differences in results are meaningful.

In this project, your benchmark is the scenario dataset loaded from `scenarios_path` (for example `data/scenarios/scenarios_v1.json`). Every run evaluates baseline and candidate models across that same scenario set, which makes win-rate and legality comparisons interpretable.

## 2) Metric
A metric is a quantitative score used to summarize performance. Good eval metrics are specific, measurable, and tied to product goals, such as quality, safety, speed, cost, or reliability.

In this project, examples include candidate win rate, baseline win rate, tie rate, illegal answer rates, and average margin. These are computed from run samples and surfaced in the Run Eval and Dashboard pages.

## 3) Baseline
A baseline is the reference system you compare against. It is your “current best known” or “current production” behavior. Without a baseline, it is hard to say whether a new model is actually an improvement.

In this project, `baseline_model` is selected in Run Eval and used to generate one side of each pairwise judgement. The baseline’s outcomes and legality are tracked separately so you can detect regressions as you test candidate changes.

## 4) Candidate
A candidate is the proposed replacement or experiment you want to evaluate against the baseline. The candidate is judged under the same conditions so you can isolate the effect of the model/prompt change.

In this project, `candidate_model` is the experimental side in each run. Its outputs are compared scenario-by-scenario against the baseline, then judged pairwise with tie logic and margin thresholding.

## 5) Ground Truth
Ground truth is the trusted target answer used to determine correctness directly. In many eval systems this comes from human labels, gold datasets, or authoritative references.

In this project, there is limited direct ground truth for “best spell choice.” Instead, you use a structured judge process and rule-based legality checks as proxies for correctness. That means your system is primarily a comparative eval (baseline vs candidate) rather than a pure gold-label accuracy eval.

## 6) Judge
A judge is the evaluator that decides which output is better in a comparison, often using a rubric. In LLM evals, a judge can be another model, a deterministic scoring function, a human reviewer, or a combination.

In this project, the judge runs pairwise scoring between baseline and candidate outputs, then produces winner/margin signals used to determine outcomes. You also run multiple judge passes and aggregate, which helps reduce one-off variance from any single judgement.
