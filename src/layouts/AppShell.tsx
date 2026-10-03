import "./AppShell.css"
import type { ReactNode } from "react"
import { PublicNav } from "../components/PublicNav"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <PublicNav />
      </header>

      <main className="app-shell__main">
        {children}
      </main>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <span>© 2026 NorthStarBank</span>
          <span>Secure digital banking services</span>
        </div>
      </footer>
    </div>
  )
}
