"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import ContentStudio from "./components/ContentStudio";
import MockTestBuilder from "./components/MockTestBuilder";
import QuestionQualityCenter from "./components/QuestionQualityCenter";
import QuestionBulkImportCenter from "./components/QuestionBulkImportCenter";
import MembershipManager from "./components/MembershipManager";
import AnnouncementManager from "./components/AnnouncementManager";
import DoubtReviewCenter from "./components/DoubtReviewCenter";

type Exam = { id: string; code: string; name_en: string; name_hi: string };

// Never treat an arbitrary non-student role as an administrator.
const ADMIN_ROLES = new Set([
  "super_admin",
  "content_admin",
  "question_manager",
  "test_manager",
  "support_staff",
]);

export default function AdminHome() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setChecking(true);
    setError("");
    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUser(currentUser?.email ?? currentUser?.phone ?? null);
      if (!currentUser) {
        setAllowed(false);
        setExams([]);
        return;
      }

      const { data, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);
      if (roleError) throw roleError;

      const roles = (data ?? []).map((item: { role: string }) => item.role);
      const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));
      setAllowed(isAdmin);
      if (!isAdmin) {
        setExams([]);
        return;
      }

      const result = await supabase
        .from("exams")
        .select("id,code,name_en,name_hi")
        .order("display_order");
      if (result.error) throw result.error;
      setExams(result.data ?? []);
    } catch (err) {
      setAllowed(false);
      setExams([]);
      setError(err instanceof Error ? err.message : "Unable to verify administrator access.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setBusy(false);
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    setEmail("");
    setPassword("");
    setUser(null);
    setAllowed(false);
    setExams([]);
    setError("");
  }

  if (checking) return <main><section className="card"><p>Verifying secure administrator access…</p></section></main>;

  if (!user) return <main><section className="card" style={{maxWidth:440,margin:"8vh auto"}}>
    <h1>UP Teacher Master</h1><p className="muted">Private Admin Control Panel</p>
    <form onSubmit={signIn}>
      <label>Email</label><input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} />
      <label>Password</label><input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} />
      <button disabled={busy}>{busy ? "Signing in…" : "Admin Sign In"}</button>
    </form>
    {error && <p role="alert" style={{color:"crimson"}}>{error}</p>}
    <small>Access is limited to accounts explicitly assigned an administrator role. Public admin registration is disabled.</small>
  </section></main>;

  if (!allowed) return <main><section className="card">
    <h1>Access not authorized</h1><p>This account does not have an approved administrator role.</p>
    {error && <p role="alert" style={{color:"crimson"}}>{error}</p>}
    <button disabled={busy} onClick={()=>void signOut()}>Sign out</button>
  </section></main>;

  return <main>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <div><h1>UP Teacher Master</h1><p className="muted">Private Admin Control Centre · {user}</p></div>
      <button disabled={busy} onClick={()=>void signOut()}>Sign out</button>
    </header>
    <div className="grid">
      {[
        ["Examinations", String(exams.length)],
        ["Content Management", "Phase 2"],
        ["Question Bank", "Phase 2"],
        ["Mock Tests", "Phase 3"]
      ].map(([label,value])=><section className="card" key={label}><small>{label}</small><h2>{value}</h2></section>)}
    </div>
    <section className="card">
      <h2>Configured examinations</h2>
      {exams.map(exam=><p key={exam.id}><b>{exam.name_en}</b> · {exam.name_hi} <small>({exam.code})</small></p>)}
      {!exams.length && <p className="muted">No active exams found. Run the Phase 1 database migration.</p>}
    </section>
    <MockTestBuilder exams={exams} />
    <QuestionQualityCenter />
    <QuestionBulkImportCenter exams={exams} onImported={async()=>{}} />
    <MembershipManager />
    <AnnouncementManager exams={exams} />
    <DoubtReviewCenter />
    <ContentStudio />
  </main>;
}
