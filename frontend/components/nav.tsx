"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/run-eval", label: "Run Eval" },
  { href: "/compare-runs", label: "Compare Runs" },
  { href: "/dashboard", label: "Metrics Dashboard" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Primary">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`app-nav__link${isActive ? " app-nav__link--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
