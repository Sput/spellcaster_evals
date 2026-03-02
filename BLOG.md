# Evals, Clearly: The Core Vocabulary and Logic That Actually Matter

If you are building with LLMs, evals are how you avoid guessing. A strong eval setup answers one practical question: is the new thing actually better than what we already have? The fastest way to get reliable signal is to pair clear vocabulary with clear decision logic.

## The Problem

Many teams run experiments but cannot explain results consistently. Terms like "better," "quality," or "accuracy" get used loosely, and one noisy run can drive big decisions. Without shared definitions and consistent rules, eval output is hard to trust.

## The Solution

Use a pairwise evaluation loop with explicit terms and explicit rules:
- compare a **baseline** to a **candidate**
- run both on the same **benchmark**
- score with defined **metrics**
- use a **judge** for pairwise decisions
- apply deterministic legality rules so invalid outputs are handled predictably

## Core Vocabulary (Top Terms)

### Benchmark
A stable set of test cases used for repeatable comparison. If the benchmark changes every run, your trend line is noise.

### Metric
A numeric score that summarizes behavior. Typical examples: win rate, tie rate, illegal answer rate, and average score gap.

### Baseline
The current reference system. This is your control group.

### Candidate
The proposed replacement you are testing against the baseline.

### Ground Truth
The trusted target answer. When full ground truth is unavailable, teams often use structured judging plus deterministic rule checks as a practical proxy.

### Judge
The mechanism that decides which output is better in a pairwise comparison, usually with a rubric. Judges can be model-based, human, deterministic, or hybrid.

## How the Eval Logic Works

1. Run baseline and candidate on the same scenario.
2. Check legality/constraint compliance for both outputs.
3. If one output is illegal, the other side wins automatically.
4. If both are legal, judge both outputs and compute margin.
5. Apply tie logic using a margin threshold (small differences become ties).
6. Aggregate outcomes across scenarios into summary metrics.

That flow creates two big advantages: better regression detection and less ambiguity in decision-making.

## Key Design Choices

- Pairwise comparison instead of absolute scoring
- Deterministic legality gate before preference scoring
- Margin threshold to avoid overreacting to tiny score differences
- Multiple judge passes with aggregation to reduce one-off noise

## Quick Walkthrough

Suppose the candidate has a slightly stronger tactical answer, but violates a hard constraint. In this eval logic, that is not a "close win" for the candidate. It is a loss, because invalid outputs are disqualifying. This keeps metrics aligned with real production expectations.