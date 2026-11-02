"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Exam = { id:string; code:string; name_en:string; name_hi:string };
type Pattern = { id:string; exam_id:string; version_label:string; duration_minutes:number|null; total_questions:number|null; total_marks:number|null; negative_marking:boolean; is_active:boolean };
type Template = { id:string; exam_id:string; exam_pattern_id:string|null; title_en:string; title_hi:string; duration_minutes:number; question_count:number; total_marks:number; default_marks:number; default_negative_marks:number; language_mode:string; question_selection:Record<string,unknown>; is_premium:boolean; is_active:boolean; display_order:number };
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const primary = "rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700";
const defaultDistribution = `{"strategy":"random","published_only":true,"subject_distribution":{},"difficulty_distribution":{"easy":30,"moderate":50,"difficult":20}}`;

export default function MockTestBuilder({ exams }: { exams:Exam[] }) {
  const [patterns,setPatterns] = useState<Pattern[]>([]);
  const [templates,setTemplates] = useState<Template[]>([]);
  const [examId,setExamId] = useState("");
  const [patternId,setPatternId] = useState("");
  const [editing,setEditing] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const [titleEn,setTitleEn] = useState(""); const [titleHi,setTitleHi] = useState("");
  const [descEn,setDescEn] = useState(""); const [descHi,setDescHi] = useState("");
  const [duration,setDuration] = useState("120"); const [count,setCount] = useState("100");
  const [marks,setMarks] = useState("100"); const [perQuestion,setPerQuestion] = useState("1");
  const [negative,setNegative] = useState("0"); const [language,setLanguage] = useState("bilingual");
  const [premium,setPremium] = useState(false); const [active,setActive] = useState(false);
  const [order,setOrder] = useState("0"); const [config,setConfig] = useState(defaultDistribution);
  const selectedPattern = useMemo(()=>patterns.find(p=>p.id===patternId),[patterns,patternId]);

  async function load() {
    setError("");
    const [p,t] = await Promise.all([
      supabase.from("exam_patterns").select("id,exam_id,version_label,duration_minutes,total_questions,total_marks,negative_marking,is_active").order("created_at",{ascending:false}),
      supabase.from("mock_test_templates").select("id,exam_id,exam_pattern_id,title_en,title_hi,duration_minutes,question_count,total_marks,default_marks,default_negative_marks,language_mode,question_selection,is_premium,is_active,display_order").order("display_order").order("created_at",{ascending:false})
    ]);
    if(p.error) setError(p.error.message); else setPatterns(p.data??[]);
    if(t.error) setError(t.error.message); else setTemplates((t.data??[]) as Template[]);
  }
  useEffect(()=>{void load();},[]);
  const examPatterns = patterns.filter(p=>p.exam_id===examId);
  const examTemplates = templates.filter(t=>!examId||t.exam_id===examId);
  function resetForm(){setEditing(null);setPatternId("");setTitleEn("");setTitleHi("");setDescEn("");setDescHi("");setDuration("120");setCount("100");setMarks("100");setPerQuestion("1");setNegative("0");setLanguage("bilingual");setPremium(false);setActive(false);setOrder("0");setConfig(defaultDistribution);}
  function edit(t:Template){setEditing(t.id);setExamId(t.exam_id);setPatternId(t.exam_pattern_id??"");setTitleEn(t.title_en);setTitleHi(t.title_hi);setDescEn("");setDescHi("");setDuration(String(t.duration_minutes));setCount(String(t.question_count));setMarks(String(t.total_marks));setPerQuestion(String(t.default_marks));setNegative(String(t.default_negative_marks));setLanguage(t.language_mode);setPremium(t.is_premium);setActive(t.is_active);setOrder(String(t.display_order));setConfig(JSON.stringify(t.question_selection??{},null,2));}
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice("");setError("");try{
    if(!examId) throw new Error("Select an examination first.");
    const parsed=JSON.parse(config||"{}");
    if(!titleEn.trim()&&!titleHi.trim()) throw new Error("Enter the mock test title in Hindi or English.");
    const q=Number(count),mins=Number(duration); if(!Number.isInteger(q)||q<1||q>300)throw new Error("Question count must be between 1 and 300."); if(!Number.isInteger(mins)||mins<1||mins>600)throw new Error("Duration must be between 1 and 600 minutes.");
    if(selectedPattern?.total_questions && q!==selectedPattern.total_questions) throw new Error(`Selected official pattern specifies ${selectedPattern.total_questions} questions. Match it or choose another pattern.`);
    if(selectedPattern?.duration_minutes && mins!==selectedPattern.duration_minutes) throw new Error(`Selected pattern duration is ${selectedPattern.duration_minutes} minutes. Match it or choose another pattern.`);
    const payload={exam_id:examId,exam_pattern_id:patternId||null,title_en:titleEn.trim()||titleHi.trim(),title_hi:titleHi.trim()||titleEn.trim(),description_en:descEn.trim()||null,description_hi:descHi.trim()||null,duration_minutes:mins,question_count:q,total_marks:Number(marks)||0,default_marks:Number(perQuestion)||1,default_negative_marks:Number(negative)||0,language_mode:language,question_selection:parsed,is_premium:premium,is_active:active,display_order:Number(order)||0,created_by:(await supabase.auth.getUser()).data.user?.id};
    const result=editing?await supabase.from("mock_test_templates").update(payload).eq("id",editing):await supabase.from("mock_test_templates").insert(payload);
    if(result.error)throw result.error;setNotice(editing?"Mock test template updated.":"Mock test template created.");resetForm();await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not save template.");}finally{setBusy(false);}}
  async function toggle(t:Template){setBusy(true);setError("");setNotice("");const {error}=await supabase.from("mock_test_templates").update({is_active:!t.is_active}).eq("id",t.id);if(error)setError(error.message);else{setNotice(t.is_active?"Template unpublished.":"Template published and visible to eligible students.");await load();}setBusy(false);}
  async function remove(t:Template){if(t.is_active){setError("Unpublish the template before deleting it.");return;}if(!window.confirm(`Delete “${t.title_en}”? This cannot be undone.`))return;setBusy(true);const {error}=await supabase.from("mock_test_templates").delete().eq("id",t.id);if(error)setError(error.message);else{setNotice("Draft template deleted.");if(editing===t.id)resetForm();await load();}setBusy(false);}
  return <section className="card" style={{marginTop:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2>Mock Test Builder</h2><p className="muted">Create, preview, publish and manage exam-pattern mock tests.</p></div><button className={secondary} onClick={()=>{resetForm();setNotice("");}}>New template</button></div>
    {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}{error&&<p role="alert" style={{color:"crimson"}}>{error}</p>}
    <form onSubmit={save} className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
      <label>Examination<select className={input} required value={examId} onChange={e=>{setExamId(e.target.value);setPatternId("");}}><option value="">Select exam</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name_en} ({x.code})</option>)}</select></label>
      <label>Verified exam pattern<select className={input} value={patternId} onChange={e=>{setPatternId(e.target.value);const p=patterns.find(x=>x.id===e.target.value);if(p?.duration_minutes)setDuration(String(p.duration_minutes));if(p?.total_questions)setCount(String(p.total_questions));if(p?.total_marks)setMarks(String(p.total_marks));}}><option value="">No pattern linked</option>{examPatterns.map(p=><option key={p.id} value={p.id}>{p.version_label}{p.is_active?" · Active":" · Inactive"}</option>)}</select></label>
      <label>Title (English)<input className={input} value={titleEn} onChange={e=>setTitleEn(e.target.value)} /></label>
      <label>शीर्षक (हिन्दी)<input className={input} value={titleHi} onChange={e=>setTitleHi(e.target.value)} /></label>
      <label>Description (English)<input className={input} value={descEn} onChange={e=>setDescEn(e.target.value)} /></label>
      <label>विवरण (हिन्दी)<input className={input} value={descHi} onChange={e=>setDescHi(e.target.value)} /></label>
      <label>Duration (minutes)<input className={input} type="number" min="1" max="600" value={duration} onChange={e=>setDuration(e.target.value)} required /></label>
      <label>Question count<input className={input} type="number" min="1" max="300" value={count} onChange={e=>setCount(e.target.value)} required /></label>
      <label>Total marks<input className={input} type="number" min="0" step="0.25" value={marks} onChange={e=>setMarks(e.target.value)} /></label>
      <label>Marks per correct answer<input className={input} type="number" min="0" step="0.25" value={perQuestion} onChange={e=>setPerQuestion(e.target.value)} /></label>
      <label>Negative marks per wrong answer<input className={input} type="number" min="0" step="0.25" value={negative} onChange={e=>setNegative(e.target.value)} /></label>
      <label>Language<select className={input} value={language} onChange={e=>setLanguage(e.target.value)}><option value="bilingual">Hindi + English</option><option value="hindi">Hindi</option><option value="english">English</option></select></label>
      <label>Display order<input className={input} type="number" value={order} onChange={e=>setOrder(e.target.value)} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={premium} onChange={e=>setPremium(e.target.checked)} /> Premium template</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} /> Publish immediately</label>
      <label style={{gridColumn:"1 / -1"}}>Question selection configuration (JSON)<textarea className={input} rows={8} value={config} onChange={e=>setConfig(e.target.value)} spellCheck={false}/><small className="muted">Use subject_distribution as subject UUID → question count, and difficulty_distribution as percentages. Keep JSON valid.</small></label>
      <div style={{gridColumn:"1 / -1",display:"flex",gap:8,flexWrap:"wrap"}}><button className={primary} disabled={busy}>{busy?"Saving…":editing?"Update template":"Create template"}</button><button type="button" className={secondary} onClick={resetForm}>Clear form</button></div>
    </form>
    <h3 style={{marginTop:24}}>Existing templates ({examTemplates.length})</h3>
    {examTemplates.map(t=><div key={t.id} style={{borderTop:"1px solid #e2e8f0",padding:"12px 0",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><b>{t.title_en}</b><div className="muted" style={{fontSize:13}}>{t.question_count} questions · {t.duration_minutes} min · {t.total_marks} marks · {t.language_mode} · {t.is_premium?"Premium":"Free"}</div><small>{exams.find(e=>e.id===t.exam_id)?.name_en??"Exam"} · {t.is_active?"Published":"Draft / Unpublished"}</small></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button className={secondary} disabled={busy} onClick={()=>edit(t)}>Edit</button><button className={secondary} disabled={busy} onClick={()=>toggle(t)}>{t.is_active?"Unpublish":"Publish"}</button><button className={secondary} disabled={busy||t.is_active} onClick={()=>remove(t)}>Delete</button></div></div>)}
    {!examTemplates.length&&<p className="muted">No mock-test templates found for this selection.</p>}
  </section>;
}
