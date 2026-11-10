"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import ContentStudio from "./components/ContentStudio";
import MockTestBuilder from "./components/MockTestBuilder";
import QuestionQualityCenter from "./components/QuestionQualityCenter";
import QuestionBulkImportCenter from "./components/QuestionBulkImportCenter";
import MembershipManager from "./components/MembershipManager";
import AnnouncementManager from "./components/AnnouncementManager";
import DoubtReviewCenter from "./components/DoubtReviewCenter";

type Exam = { id: string; code: string; name_en: string; name_hi: string };
type Section = "overview" | "questions" | "mocks" | "content" | "announcements" | "doubts" | "access";
const ADMIN_ROLES = new Set(["super_admin", "content_admin", "question_manager", "test_manager", "support_staff"]);
const NAV: { id: Section; label: string; hint: string; icon: string }[] = [
  { id: "overview", label: "Overview", hint: "Dashboard", icon: "▦" },
  { id: "questions", label: "Question Bank", hint: "Import · review · publish", icon: "▤" },
  { id: "mocks", label: "Mock Tests", hint: "Complete · subject-wise", icon: "◷" },
  { id: "content", label: "Study Material", hint: "Courses · syllabus · files", icon: "▣" },
  { id: "announcements", label: "Announcements", hint: "Student communication", icon: "◉" },
  { id: "doubts", label: "Doubt Centre", hint: "Student support", icon: "◎" },
  { id: "access", label: "Free Access", hint: "Access settings", icon: "◇" },
];

export default function AdminHome() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [questionBankVersion, setQuestionBankVersion] = useState(0);
  const [stats, setStats] = useState({ students: "—", questions: "—", materials: "—", exams: "—" });

  async function refresh() {
    setChecking(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setUser(null); setAllowed(false); setExams([]); return; }
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUser(currentUser?.email ?? currentUser?.phone ?? null);
      if (!currentUser) { setAllowed(false); setExams([]); return; }
      const { data, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", currentUser.id);
      if (roleError) throw roleError;
      const roles = (data ?? []).map((item: { role: string }) => item.role);
      const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));
      setAllowed(isAdmin);
      if (!isAdmin) { setExams([]); return; }
      const result = await supabase.from("exams").select("id,code,name_en,name_hi").order("display_order");
      if (result.error) throw result.error;
      setExams(result.data ?? []);
      const [students, questions, materials] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("study_materials").select("id", { count: "exact", head: true }),
      ]);
      setStats({ students: students.error ? "—" : String(students.count ?? 0), questions: questions.error ? "—" : String(questions.count ?? 0), materials: materials.error ? "—" : String(materials.count ?? 0), exams: String(result.data?.length ?? 0) });
    } catch (err) {
      setAllowed(false); setExams([]);
      setError(err instanceof Error ? err.message : "Unable to verify administrator access.");
    } finally { setChecking(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); const { error: signOutError } = await supabase.auth.signOut(); setBusy(false);
    if (signOutError) { setError(signOutError.message); return; }
    setEmail(""); setPassword(""); setUser(null); setAllowed(false); setExams([]); setError("");
  }

  const activeNav = useMemo(() => NAV.find((item) => item.id === section) ?? NAV[0], [section]);
  function go(id: Section) { setSection(id); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }

  if (checking) return <main className="auth-wrap"><section className="auth-card"><div className="brand-mark">UT</div><h1>UP Teacher Master</h1><p className="muted">Verifying secure administrator access…</p></section></main>;
  if (!user) return <main className="auth-wrap"><section className="auth-card">
    <div className="brand-mark">UT</div><p className="eyebrow">ADMINISTRATION PORTAL</p><h1>Welcome back</h1><p className="muted">Sign in with your authorised administrator account.</p>
    <form onSubmit={signIn}><label>Email address</label><input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="admin@example.com" /><label>Password</label><input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="Enter password" /><button className="btn-primary btn-wide" disabled={busy}>{busy ? "Signing in…" : "Sign in to Admin"}</button></form>
    {error && <p role="alert" className="error-text">{error}</p>}<p className="auth-foot">Private access · Admin accounts only · Student registration is separate</p>
  </section></main>;
  if (!allowed) return <main className="auth-wrap"><section className="auth-card"><div className="brand-mark">UT</div><h1>Access not authorised</h1><p>This account does not have an approved administrator role.</p>{error && <p role="alert" className="error-text">{error}</p>}<button className="btn-primary" disabled={busy} onClick={()=>void signOut()}>Sign out</button></section></main>;

  return <div className="admin-shell">
    <aside className={mobileNav ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-brand"><div className="brand-mark">UT</div><div><strong>UP Teacher</strong><span>MASTER CONTROL</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)} aria-label="Close menu">×</button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">{NAV.map(item=><button key={item.id} className={section===item.id?"nav-item nav-active":"nav-item"} onClick={()=>go(item.id)}><span className="nav-icon">{item.icon}</span><span className="nav-copy"><b>{item.label}</b><small>{item.hint}</small></span>{section===item.id&&<i />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-pill"><span /> Secure admin session</div><div className="user-mini"><div className="avatar">{(user[0]??"A").toUpperCase()}</div><div className="user-copy"><b>Administrator</b><small>{user}</small></div><button className="logout-icon" onClick={()=>void signOut()} title="Sign out">↗</button></div></div>
    </aside>
    {mobileNav&&<button className="nav-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation" />}
    <div className="admin-main">
      <header className="topbar"><button className="menu-toggle" onClick={()=>setMobileNav(true)} aria-label="Open menu">☰</button><div className="breadcrumb">Workspace <span>/</span> <b>{activeNav.label}</b></div><div className="topbar-right"><span className="live-dot" /> <span className="topbar-status">Connected</span><div className="top-avatar">{(user[0]??"A").toUpperCase()}</div></div></header>
      <main className="page-content">
        {error&&<div className="notice-error" role="alert">{error}</div>}
        {section==="overview"&&<><div className="page-heading"><div><p className="eyebrow">ADMIN WORKSPACE</p><h1>Good to see you.</h1><p className="muted">Here’s what’s happening across UP Teacher Master today.</p></div><span className="date-chip">● Live workspace</span></div>
          <div className="stat-grid"><article className="stat-card"><span className="stat-icon indigo">♙</span><small>Total student profiles</small><strong>{stats.students}</strong><span className="stat-foot">Registered accounts</span></article><article className="stat-card"><span className="stat-icon blue">▤</span><small>Question bank</small><strong>{stats.questions}</strong><span className="stat-foot">Questions in database</span></article><article className="stat-card"><span className="stat-icon green">▣</span><small>Study materials</small><strong>{stats.materials}</strong><span className="stat-foot">Learning resources</span></article><article className="stat-card"><span className="stat-icon amber">◇</span><small>Examinations</small><strong>{stats.exams}</strong><span className="stat-foot">Configured courses</span></article></div>
          <div className="overview-grid"><section className="panel-card"><div className="panel-heading"><div><h2>Quick actions</h2><p>Jump straight into your daily work.</p></div></div><div className="quick-grid"><button onClick={()=>go("questions")}><span>＋</span><b>Upload questions</b><small>Excel, CSV or Word</small></button><button onClick={()=>go("mocks")}><span>◷</span><b>Create mock test</b><small>Full or subject-wise</small></button><button onClick={()=>go("content")}><span>▣</span><b>Manage content</b><small>Study material & syllabus</small></button><button onClick={()=>go("announcements")}><span>◉</span><b>Send announcement</b><small>Reach your students</small></button></div></section>
          <section className="panel-card"><div className="panel-heading"><div><h2>Exam courses</h2><p>Configured examinations in the system.</p></div></div><div className="exam-list">{exams.map((exam,index)=><div className="exam-row" key={exam.id}><span className="exam-number">{String(index+1).padStart(2,"0")}</span><div><b>{exam.name_en}</b><small>{exam.name_hi}</small></div><span className="exam-code">{exam.code}</span></div>)}{!exams.length&&<p className="muted">No examinations configured yet.</p>}</div></section></div>
          <section className="panel-card module-overview"><div className="panel-heading"><div><h2>Management modules</h2><p>All administration tools, organised in one place.</p></div></div><div className="module-grid">{NAV.filter(x=>x.id!=="overview").map(item=><button key={item.id} onClick={()=>go(item.id)}><span className="module-icon">{item.icon}</span><b>{item.label}</b><small>{item.hint}</small><span className="module-arrow">→</span></button>)}</div></section>
        </>}
        {section!=="overview"&&<div className="page-heading"><div><p className="eyebrow">MANAGEMENT MODULE</p><h1>{activeNav.label}</h1><p className="muted">{activeNav.hint}</p></div><button className="btn-secondary" onClick={()=>go("overview")}>← Dashboard</button></div>}
        {section==="questions"&&<><div className="module-intro"><b>Question workflow</b><span>Choose exam → choose subject → import → preview → approve → publish.</span></div><QuestionBulkImportCenter exams={exams} onImported={async()=>{setQuestionBankVersion(v=>v+1);}} /><QuestionQualityCenter key={questionBankVersion} /></>}
        {section==="mocks"&&<MockTestBuilder exams={exams} />}
        {section==="content"&&<ContentStudio />}
        {section==="announcements"&&<AnnouncementManager exams={exams} />}
        {section==="doubts"&&<DoubtReviewCenter />}
        {section==="access"&&<><div className="module-intro"><b>Free access policy</b><span>UP Teacher Master is configured as a free-to-use student app. No paid membership or checkout is enabled in this admin workspace.</span></div><MembershipManager /></>}
        <footer className="admin-footer"><span>UP Teacher Master · Admin Control Centre</span><span>Private workspace · v2 interface</span></footer>
      </main>
    </div>
  </div>;
}
