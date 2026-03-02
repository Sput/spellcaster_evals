import "./globals.css";
import type { Metadata } from "next";
import { AppNav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Spellcaster Eval Lab",
  description: "Pairwise LLM evals for D&D spell choices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Spellcaster Eval Lab</h1>
          <p>
            Baseline vs candidate spell choice evaluation with legality gates and pairwise judging.
          </p>
          <AppNav />
          {children}
        </main>
      </body>
    </html>
  );
}
