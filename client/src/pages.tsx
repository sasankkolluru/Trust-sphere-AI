import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { type Analysis } from "./api";
import {
  useAnalyses,
  useCreateAnalysis,
  useEntities,
  useNotifications,
  useRealtimeEvents,
} from "./hooks";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  RiskIndicator,
  Table,
  TrustScore,
} from "./components";

const sampleAnalyses: Analysis[] = [
  {
    _id: "a1",
    entity: "Northstar Labs",
    domain: "Web presence",
    status: "completed",
    riskLevel: "low",
    trustScore: 91,
    riskScore: 9,
    createdAt: new Date().toISOString(),
  },
  {
    _id: "a2",
    entity: "Vertex Finance",
    domain: "Business identity",
    status: "completed",
    riskLevel: "high",
    trustScore: 48,
    riskScore: 52,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "a3",
    entity: "Aperture Health",
    domain: "Web presence",
    status: "processing",
    riskLevel: "medium",
    trustScore: 72,
    riskScore: 28,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

function AuthPage({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="auth-layout">
      <div className="auth-art">
        <Link className="brand" to="/">
          <span className="brand-mark">TS</span>
          <span>
            TrustSphere <em>AI</em>
          </span>
        </Link>
        <div>
          <p className="eyebrow">TRUST INTELLIGENCE, REIMAGINED</p>
          <h1>Make every decision with confidence.</h1>
          <p className="muted">
            A clear, explainable view of the signals that shape digital trust.
          </p>
        </div>
        <small>© 2026 TrustSphere AI</small>
      </div>
      <div className="auth-panel">
        <div className="auth-form">
          <p className="eyebrow">{register ? "CREATE YOUR WORKSPACE" : "WELCOME BACK"}</p>
          <h2>{register ? "Start seeing trust clearly." : "Sign in to your workspace."}</h2>
          <p className="muted">
            {register
              ? "Create an account to begin your first analysis."
              : "Enter your details to continue."}
          </p>
          {register && <Input placeholder="Full name" />}
          {register && <Input placeholder="Workspace name" />}
          {<Input type="email" placeholder="Work email" />}
          {<Input type="password" placeholder="Password" />}
          <Button onClick={() => navigate("/dashboard")}>
            {register ? "Create workspace" : "Sign in"}
          </Button>
          <p className="form-footer">
            {register ? "Already have an account?" : "New to TrustSphere?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand" to="/">
          <span className="brand-mark">TS</span>
          <span>
            TrustSphere <em>AI</em>
          </span>
        </Link>
        <nav>
          <a href="#platform">Platform</a>
          <a href="#principles">Principles</a>
          <Link to="/login">Sign in</Link>
          <Link className="button button-primary" to="/register">
            Get started
          </Link>
        </nav>
      </header>
      <main className="hero" id="platform">
        <div className="hero-copy">
          <p className="eyebrow">THE TRUST OPERATING SYSTEM</p>
          <h1>
            Know what to trust <span>before it matters.</span>
          </h1>
          <p>
            TrustSphere AI turns complex signals into transparent, actionable intelligence for every
            entity and every decision.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/register">
              Explore the platform <span>→</span>
            </Link>
            <a className="text-link" href="#principles">
              How it works ↓
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orb" />
          <div className="floating-card float-top">
            <span className="live-dot" /> Live analysis <strong>+24.8%</strong>
          </div>
          <div className="floating-card float-bottom">
            <span className="mini-ring">94</span>
            <div>
              <strong>High confidence</strong>
              <small>Northstar Labs</small>
            </div>
          </div>
        </div>
      </main>
      <section className="landing-footer" id="principles">
        <span>BUILT FOR CLARITY</span>
        <span>EXPLAINABLE BY DEFAULT</span>
        <span>READY FOR WHAT'S NEXT</span>
      </section>
    </div>
  );
}
export function LoginPage() {
  return <AuthPage />;
}
export function RegisterPage() {
  return <AuthPage register />;
}

function DashboardStat({
  label,
  value,
  trend,
  tone = "",
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: string;
}) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon ${tone}`}>✦</div>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {trend && <small className="trend">↗ {trend}</small>}
    </Card>
  );
}

export function DashboardPage() {
  const analysesQuery = useAnalyses();
  const entitiesQuery = useEntities();
  const analyses = analysesQuery.data?.data ?? sampleAnalyses;
  const entities = entitiesQuery.data?.data ?? [];
  const realtimeEvents = useRealtimeEvents();
  const highRisk = analyses.filter((a) => ["high", "critical"].includes(a.riskLevel)).length;
  const avgTrust = analyses.length
    ? Math.round(analyses.reduce((sum, a) => sum + (a.trustScore ?? 0), 0) / analyses.length)
    : 0;
  return (
    <div className="page">
      <PageHeader
        eyebrow="OVERVIEW"
        title="Good morning, Sarah."
        description="Here is what is happening across your trust workspace today."
        action={
          <Link className="button button-primary" to="/analyses/new">
            + New analysis
          </Link>
        }
      />
      <div className="stat-grid">
        <DashboardStat label="Total analyses" value="1,284" trend="+12.4% this month" />
        <DashboardStat
          label="High-risk entities"
          value={String(highRisk || 28)}
          trend="8 need attention"
          tone="orange"
        />
        <DashboardStat label="Critical alerts" value="06" trend="2 new today" tone="red" />
        <DashboardStat
          label="Average trust score"
          value={`${avgTrust || 84}`}
          trend="+4.2% this month"
          tone="green"
        />
      </div>
      <div className="dashboard-grid">
        <Card className="wide-card">
          <div className="card-heading">
            <div>
              <h3>Risk distribution</h3>
              <p className="muted">Across all analyzed entities</p>
            </div>
            <Badge tone="neutral">Last 30 days ▾</Badge>
          </div>
          <div className="risk-chart">
            <div className="donut">
              <strong>1,284</strong>
              <span>analyses</span>
            </div>
            <div className="legend">
              <span>
                <i className="dot green" />
                Low <b>62%</b>
              </span>
              <span>
                <i className="dot yellow" />
                Medium <b>24%</b>
              </span>
              <span>
                <i className="dot orange" />
                High <b>10%</b>
              </span>
              <span>
                <i className="dot red" />
                Critical <b>4%</b>
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <h3>Live activity</h3>
              <p className="muted">Real-time workspace events</p>
            </div>
            <span className="live-dot" />
          </div>
          <div className="activity-list">
            {(realtimeEvents.length
              ? realtimeEvents.slice(0, 4)
              : [
                  {
                    name: "analysis:completed",
                    payload: { entityId: "Northstar Labs" },
                    receivedAt: new Date().toISOString(),
                  },
                ]
            ).map((event) => (
              <div key={`${event.name}-${event.receivedAt}`}>
                <span
                  className={`activity-icon ${event.name.includes("failed") || event.name.includes("risk") ? "orange" : "green"}`}
                >
                  {event.name.includes("completed") ? "✓" : "!"}
                </span>
                <p>
                  <strong>{event.name}</strong>
                  <small>
                    {String(event.payload.entityId ?? event.payload.analysisId ?? "Workspace")} ·{" "}
                    {new Date(event.receivedAt).toLocaleTimeString()}
                  </small>
                </p>
              </div>
            ))}
          </div>
          <Link className="card-link" to="/analyses/history">
            View all activity →
          </Link>
        </Card>
      </div>
      <Card>
        <div className="card-heading">
          <div>
            <h3>Recent analyses</h3>
            <p className="muted">Your latest trust intelligence</p>
          </div>
          <Link className="text-link" to="/analyses/history">
            View history →
          </Link>
        </div>
        {analysesQuery.isLoading ? (
          <LoadingState />
        ) : analysesQuery.isError ? (
          <ErrorState />
        ) : (
          <Table
            headers={["Entity", "Domain", "Trust score", "Risk level", "Status", "Date"]}
            rows={analyses
              .slice(0, 5)
              .map((a) => [
                <strong>{typeof a.entity === "string" ? a.entity : a.entity.name}</strong>,
                a.domain,
                <TrustScore score={a.trustScore} />,
                <RiskIndicator level={a.riskLevel} />,
                <Badge tone={a.status}>{a.status}</Badge>,
                new Date(a.createdAt).toLocaleDateString(),
              ])}
          />
        )}
      </Card>
      {entities.length > 0 && (
        <p className="muted dashboard-footnote">
          {entities.length} entities connected to this workspace.
        </p>
      )}
    </div>
  );
}

export function AnalysisPage() {
  const mutation = useCreateAnalysis();
  const [entity, setEntity] = useState("");
  const [domain, setDomain] = useState("Web presence");
  const [input, setInput] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ entity, domain, inputType: "text", input: { value: input } });
  }
  return (
    <div className="page narrow">
      <PageHeader
        eyebrow="ANALYSIS STUDIO"
        title="Start a new analysis"
        description="Combine multiple signals into a clear, explainable trust assessment."
      />
      <Card>
        <form className="analysis-form" onSubmit={submit}>
          <label>
            Entity identifier
            <Input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="Paste a domain, company ID, or URL"
              required
            />
          </label>
          <label>
            Analysis domain
            <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option>Web presence</option>
              <option>Business identity</option>
              <option>Digital footprint</option>
            </select>
          </label>
          <label>
            Additional context
            <textarea
              className="input textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add context to improve the assessment..."
            />
          </label>
          {mutation.isError && <ErrorState />}
          {mutation.isSuccess && (
            <div className="success">Analysis queued successfully. View it in history.</div>
          )}
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? "Queuing analysis..." : "Run analysis →"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function AnalysisHistoryPage() {
  const query = useAnalyses("?limit=20&sort=-createdAt");
  const [page, setPage] = useState(1);
  if (query.isLoading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (query.isError)
    return (
      <div className="page">
        <ErrorState />
      </div>
    );
  const data = query.data?.data ?? [];
  return (
    <div className="page">
      <PageHeader
        eyebrow="INTELLIGENCE LOG"
        title="Analysis history"
        description="Review every assessment and its supporting signals."
        action={
          <Link className="button button-primary" to="/analyses/new">
            + New analysis
          </Link>
        }
      />
      <Card>
        <div className="filters">
          <Input placeholder="Search analyses..." />
          <select className="input">
            <option>All risk levels</option>
            <option>High risk</option>
            <option>Critical</option>
          </select>
          <Badge tone="neutral">{query.data?.pagination.total ?? data.length} results</Badge>
        </div>
        <Table
          headers={["Entity", "Domain", "Trust score", "Risk level", "Status", "Created"]}
          rows={data.map((a) => [
            <strong>{typeof a.entity === "string" ? a.entity : a.entity.name}</strong>,
            a.domain,
            <TrustScore score={a.trustScore} />,
            <RiskIndicator level={a.riskLevel} />,
            <Badge tone={a.status}>{a.status}</Badge>,
            new Date(a.createdAt).toLocaleString(),
          ])}
        />
        {!data.length && <EmptyState message="No analyses yet. Start your first assessment." />}
        <Pagination page={page} pages={query.data?.pagination.pages ?? 1} onChange={setPage} />
      </Card>
    </div>
  );
}

export function EntityDetailsPage() {
  const { entityId } = useParams();
  const entities = useEntities();
  const analyses = useAnalyses(`?entity=${entityId}&limit=20&sort=-createdAt`);
  const entity = entities.data?.data.find((item) => item._id === entityId);
  return (
    <div className="page">
      <PageHeader
        eyebrow="ENTITY PROFILE"
        title={entity?.name ?? "Entity details"}
        description={entity?.identifier ?? "Connected trust profile"}
        action={<Button variant="secondary">Export profile</Button>}
      />
      <div className="detail-grid">
        <Card>
          <p className="muted">Current trust score</p>
          <TrustScore score={analyses.data?.data[0]?.trustScore ?? 86} />
          <div className="detail-meta">
            <span>
              Entity type <strong>{entity?.type ?? "Organization"}</strong>
            </span>
            <span>
              Last analyzed <strong>Today, 09:42</strong>
            </span>
          </div>
        </Card>
        <Card>
          <h3>Risk posture</h3>
          <div className="posture">
            <RiskIndicator level={analyses.data?.data[0]?.riskLevel ?? "low"} />
            <strong>Healthy profile</strong>
            <p className="muted">No critical signals detected in the latest assessment.</p>
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-heading">
          <h3>Analysis timeline</h3>
          <Link className="text-link" to="/analyses/history">
            View all →
          </Link>
        </div>
        {analyses.isLoading ? (
          <LoadingState />
        ) : (
          <Table
            headers={["Domain", "Trust score", "Risk", "Status", "Date"]}
            rows={(analyses.data?.data ?? []).map((a) => [
              a.domain,
              <TrustScore score={a.trustScore} />,
              <RiskIndicator level={a.riskLevel} />,
              <Badge tone={a.status}>{a.status}</Badge>,
              new Date(a.createdAt).toLocaleDateString(),
            ])}
          />
        )}
      </Card>
    </div>
  );
}

export function NotificationsPage() {
  const query = useNotifications();
  return (
    <div className="page">
      <PageHeader
        eyebrow="WORKSPACE UPDATES"
        title="Notifications"
        description="Stay on top of the signals that need your attention."
      />
      <Card>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState />
        ) : query.data?.data.length ? (
          query.data.data.map((n) => (
            <div className={`notification ${n.read ? "" : "unread"}`} key={n._id}>
              <span className={`activity-icon ${n.type === "risk" ? "orange" : "blue"}`}>!</span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </div>
              <Badge tone={n.type}>{n.type}</Badge>
            </div>
          ))
        ) : (
          <EmptyState message="You are all caught up." />
        )}
      </Card>
    </div>
  );
}
export function ProfilePage() {
  return (
    <div className="page narrow">
      <PageHeader
        eyebrow="ACCOUNT"
        title="Your profile"
        description="Manage your workspace identity and preferences."
      />
      <Card>
        <div className="profile-header">
          <div className="profile-avatar">SA</div>
          <div>
            <h3>Sarah Analyst</h3>
            <p className="muted">Workspace owner · sarah@trustsphere.ai</p>
          </div>
          <Button variant="secondary">Edit profile</Button>
        </div>
        <div className="profile-fields">
          <label>
            Full name
            <Input value="Sarah Analyst" readOnly />
          </label>
          <label>
            Work email
            <Input value="sarah@trustsphere.ai" readOnly />
          </label>
          <label>
            Workspace
            <Input value="TrustSphere Labs" readOnly />
          </label>
        </div>
      </Card>
    </div>
  );
}
export function AdminPage() {
  const entities = useEntities();
  const events = useRealtimeEvents();
  return (
    <div className="page">
      <PageHeader
        eyebrow="CONTROL CENTER"
        title="Admin area"
        description="Configure workspace policies, domains, and team access."
      />
      <div className="admin-grid">
        <Card>
          <span className="stat-icon blue">◇</span>
          <h3>Domain configurations</h3>
          <p className="muted">Manage analysis domains and model versions.</p>
          <Link className="card-link" to="/analyses/new">
            Configure domains →
          </Link>
        </Card>
        <Card>
          <span className="stat-icon green">♧</span>
          <h3>Team members</h3>
          <p className="muted">Invite and manage workspace access.</p>
          <Button variant="secondary">Manage team</Button>
        </Card>
        <Card>
          <span className="stat-icon orange">⚙</span>
          <h3>System health</h3>
          <p className="muted">
            {entities.isError ? "API needs attention" : "All systems operational"}
          </p>
          <Badge tone={entities.isError ? "risk-high" : "completed"}>
            {entities.isError ? "Degraded" : "Operational"}
          </Badge>
        </Card>
      </div>
      <Card>
        <div className="card-heading">
          <div>
            <h3>Live operations</h3>
            <p className="muted">Authenticated event stream for administrators</p>
          </div>
          <span className="live-dot" />
        </div>
        {events.length ? (
          events.slice(0, 8).map((event) => (
            <div className="notification" key={`${event.name}-${event.receivedAt}`}>
              <span className="activity-icon blue">↗</span>
              <div>
                <strong>{event.name}</strong>
                <p>
                  {String(
                    event.payload.analysisId ?? event.payload.entityId ?? "Workspace operation",
                  )}
                </p>
                <small>{new Date(event.receivedAt).toLocaleString()}</small>
              </div>
            </div>
          ))
        ) : (
          <EmptyState message="No live events received. Connect an authenticated socket to monitor operations." />
        )}
      </Card>
    </div>
  );
}
