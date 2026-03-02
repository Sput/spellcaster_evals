import Link from "next/link";

export default function HomePage() {
  return (
    <section className="card">
      <h2>Project Home</h2>
      <p>Use the nav to start an evaluation run, compare outputs, and review metrics.</p>
      <div className="grid grid-3">
        <Link href="/run-eval">Run Eval</Link>
        <Link href="/compare-runs">Compare Runs</Link>
        <Link href="/dashboard">Metrics Dashboard</Link>
      </div>
    </section>
  );
}
