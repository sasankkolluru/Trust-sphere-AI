import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";

export function Button({
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`button button-${variant}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog">
    <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
    <h2>{title}</h2>{children}
  </div></div>;
}

export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <div className="pagination"><Button variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
    <span>Page {page} of {Math.max(pages, 1)}</span><Button variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button></div>;
}

export function LoadingState({ label = "Loading workspace..." }: { label?: string }) {
  return <div className="state"><span className="spinner" />{label}</div>;
}
export function ErrorState() { return <div className="state state-error">Unable to load this data. Check the API connection and try again.</div>; }
export function EmptyState({ message }: { message: string }) { return <div className="state">{message}</div>; }

export function RiskIndicator({ level }: { level: string }) {
  return <Badge tone={`risk-${level}`}>{level === "unknown" ? "Pending" : level}</Badge>;
}

export function TrustScore({ score = 0 }: { score?: number }) {
  const safeScore = Math.max(0, Math.min(score, 100));
  return <div className="trust-score"><div className="score-ring" style={{ "--score": `${safeScore * 3.6}deg` } as React.CSSProperties}><strong>{Math.round(safeScore)}</strong></div><span>Trust score</span></div>;
}

const nav = [
  ["Dashboard", "/dashboard", "⌂"], ["New analysis", "/analyses/new", "+"], ["History", "/analyses/history", "↗"],
  ["Notifications", "/notifications", "!"], ["Profile", "/profile", "○"], ["Admin", "/admin", "◇"],
];

export function AppShell() {
  return <div className="app-layout"><aside className="sidebar">
    <Link className="brand" to="/dashboard"><span className="brand-mark">TS</span><span>TrustSphere <em>AI</em></span></Link>
    <p className="nav-label">Workspace</p><nav>{nav.map(([label, path, icon]) => <NavLink key={path} to={path} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}><span>{icon}</span>{label}</NavLink>)}</nav>
    <div className="sidebar-footer"><div className="avatar">SA</div><div><strong>Sarah Analyst</strong><small>Workspace owner</small></div></div>
  </aside><main className="main-content"><header className="topbar"><div><span className="live-dot" /> Systems operational</div><Link to="/notifications" className="icon-button">◌</Link></header><Outlet /></main></div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>;
}
