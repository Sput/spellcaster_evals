export function winnerFromMedian(
  winners: string[],
  baselineTotals: number[],
  candidateTotals: number[],
  margins: number[],
  threshold: number,
): { winner: "baseline" | "candidate" | "tie"; margin: number } {
  const medMargin = median(margins);
  if (medMargin < threshold) {
    return { winner: "tie", margin: round2(medMargin) };
  }

  const baselineMed = median(baselineTotals);
  const candidateMed = median(candidateTotals);
  if (candidateMed > baselineMed) {
    return { winner: "candidate", margin: round2(medMargin) };
  }
  if (baselineMed > candidateMed) {
    return { winner: "baseline", margin: round2(medMargin) };
  }

  const candidateVotes = winners.filter((w) => w === "candidate").length;
  const baselineVotes = winners.filter((w) => w === "baseline").length;
  if (candidateVotes > baselineVotes) {
    return { winner: "candidate", margin: round2(medMargin) };
  }
  if (baselineVotes > candidateVotes) {
    return { winner: "baseline", margin: round2(medMargin) };
  }
  return { winner: "tie", margin: round2(medMargin) };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
