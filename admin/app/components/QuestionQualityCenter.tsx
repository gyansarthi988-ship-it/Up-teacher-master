"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Question = { id:string; exam_id:string; subject_id:string; topic_id:string|null; question_hi:string|null; question_en:string|null; difficulty:string; status:string; created_at:string };
type Finding = { code:string; label:string; severity:"error"|"warning" };
type AuditRow = { question:Question; findings:Finding[]; options:number; hasAnswer:boolean; hasExplanation:boolean; duplicateIds:string[] };
const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export default function QuestionQualityCenter(){
  const [rows,setRows]=useState<AuditRow[]>([]); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState<string|null>(null);
  const [filter,setFilter]=useState("all"); const [search,setSearch]=useState(""); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");
    const [q,o,a,x]=await Promise.all([
      supabase.from("questions").select("id,exam_id,subject_id,topic_id,question_hi,question_en,difficulty,status,created_at").order("created_at",{ascending:false}).limit(1000),
      supabase.from("question_options").select("id,question_id,option_key,text_hi,text_en"),
      supabase.from("question_answers").select("question_id,correct_option_id"),
      supabase.from("question_explanations").select("question_id,explanation_hi,explanation_en")
    ]);
    const failure=[q,o,a,x].find(r=>r.error); if(failure?.error){setError(failure.error.message);setRows([]);setLoading(false);return;}
    const questions=(q.data??[]) as Question[]; const options=o.data??[]; const answers=a.data??[]; const explanations=x.data??[];
    const normalized=new Map<string,string[]>();
    for(const item of questions){const key=(item.question_en||item.question_hi||"").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu," ").trim();if(key.length<18)continue;normalized.set(key,[...(normalized.get(key)??[]),item.id]);}
    const next=questions.map(question=>{const ownOptions=options.filter(v=>v.question_id===question.id);const answer=answers.find(v=>v.question_id===question.id);const explanation=explanations.find(v=>v.question_id===question.id);
      const findings:Finding[]=[]; const en=!!question.question_en?.trim(),hi=!!question.question_hi?.trim();
      if(!en||!hi)findings.push({code:"translation",label:"Hindi/English translation missing",severity:"warning"});
      if(ownOptions.length!==4)findings.push({code:"options",label:`Expected 4 options; found ${ownOptions.length}`,severity:"error"});
      if(ownOptions.some(v=>!v.text_en?.trim()||!v.text_hi?.trim()))findings.push({code:"option_translation",label:"One or more options lack bilingual text",severity:"warning"});
      if(!answer)findings.push({code:"answer",label:"Correct answer not configured",severity:"error"});
      else if(!ownOptions.some(v=>v.id===answer.correct_option_id))findings.push({code:"answer_link",label:"Correct answer does not match an option",severity:"error"});
      if(!explanation||(!explanation.explanation_en?.trim()&&!explanation.explanation_hi?.trim()))findings.push({code:"explanation",label:"Explanation missing",severity:"warning"});
      if(!question.topic_id)findings.push({code:"topic",label:"Topic not assigned",severity:"warning"});
      const key=(question.question_en||question.question_hi||"").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu," ").trim();
      const duplicateIds=key.length>=18?(normalized.get(key)??[]).filter(id=>id!==question.id):[];
      if(duplicateIds.length)findings.push({code:"duplicate",label:`Possible duplicate (${duplicateIds.length} match${duplicateIds.length===1?"":"es"})`,severity:"warning"});
      return {question,findings,options:ownOptions.length,hasAnswer:!!answer,hasExplanation:!!explanation,duplicateIds};
    });setRows(next);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  const counts=useMemo(()=>({total:rows.length,errors:rows.filter(r=>r.findings.some(f=>f.severity==="error")).length,warnings:rows.filter(r=>r.findings.some(f=>f.severity==="warning")).length,clean:rows.filter(r=>!r.findings.length).length}),[rows]);
  const visible=useMemo(()=>rows.filter(r=>{const matches=filter==="all"||(filter==="issues"&&r.findings.length>0)||(filter==="errors"&&r.findings.some(f=>f.severity==="error"))||(filter==="clean"&&!r.findings.length)||(filter===r.question.status);const hay=`${r.question.question_en??""} ${r.question.question_hi??""} ${r.question.id}`.toLowerCase();return matches&&hay.includes(search.toLowerCase());}),[rows,filter,search]);
  async function setStatus(row:AuditRow,status:"under_review"|"approved"|"published"|"draft"){setBusy(row.question.id);setError("");setNotice("");
    if(status==="published"&&row.findings.some(f=>f.severity==="error")){setError("Resolve all critical errors before publishing this question.");setBusy(null);return;}
    const uid=(await supabase.auth.getUser()).data.user?.id;
    const payload:Record<string,unknown>={status,reviewed_by:status==="approved"||status==="published"?uid:null};if(status==="published")payload.published_at=new Date().toISOString();
    const {error}=await supabase.from("questions").update(payload).eq("id",row.question.id);if(error)setError(error.message);else{setNotice(`Question moved to ${status.replace("_"," ")}.`);await load();}setBusy(null);
  }
  return <section className="card" style={{marginTop:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2>Question Bank Quality Control</h2><p className="muted">Automated checks for bilingual content, answer keys, explanations, topic mapping and likely duplicates.</p></div><button className={field} onClick={()=>void load()} disabled={loading}>Refresh audit</button></div>
    {error&&<p role="alert" style={{color:"crimson"}}>{error}</p>}{notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
    <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,margin:"14px 0"}}>
      {[ ["Questions scanned",counts.total], ["Critical issue questions",counts.errors], ["Warnings",counts.warnings], ["No detected issues",counts.clean] ].map(([label,value])=><div key={String(label)} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:12}}><small className="muted">{label}</small><h2 style={{margin:"4px 0"}}>{value}</h2></div>)}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}><input className={field} placeholder="Search question text / ID" value={search} onChange={e=>setSearch(e.target.value)} /><select className={field} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All questions</option><option value="issues">All issues</option><option value="errors">Critical errors</option><option value="clean">No detected issues</option><option value="draft">Draft</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="published">Published</option></select></div>
    {loading?<p className="muted">Scanning question bank…</p>:visible.map(row=><article key={row.question.id} style={{borderTop:"1px solid #e2e8f0",padding:"14px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div style={{minWidth:240,flex:1}}><b>{row.question.question_en||row.question.question_hi||"Untitled question"}</b><p className="muted" style={{fontSize:12,margin:"4px 0"}}>{row.question.question_hi||"Hindi version missing"}</p><small className="muted">{row.question.difficulty} · {row.question.status} · {row.options}/4 options · {row.question.id.slice(0,8)}</small>
      {row.findings.length? <ul style={{margin:"8px 0",paddingLeft:18}}>{row.findings.map((f,i)=><li key={`${f.code}-${i}`} style={{fontSize:13,color:f.severity==="error"?"#b91c1c":"#a16207"}}>{f.severity.toUpperCase()}: {f.label}</li>)}</ul>:<p style={{fontSize:13,color:"#166534"}}>No configured quality issues detected.</p>}
      {row.duplicateIds.length>0&&<small className="muted">Possible duplicate IDs: {row.duplicateIds.slice(0,3).join(", ")}</small>}</div>
      <div style={{display:"flex",gap:6,alignItems:"flex-start",flexWrap:"wrap"}}><button className={field} disabled={busy===row.question.id} onClick={()=>void setStatus(row,"under_review")}>Review</button><button className={field} disabled={busy===row.question.id||row.findings.some(f=>f.severity==="error")} onClick={()=>void setStatus(row,"approved")}>Approve</button><button className={field} disabled={busy===row.question.id||row.findings.some(f=>f.severity==="error")} onClick={()=>void setStatus(row,"published")}>Publish</button><button className={field} disabled={busy===row.question.id} onClick={()=>void setStatus(row,"draft")}>Return to draft</button></div></div>
    </article>)}
    {!loading&&!visible.length&&<p className="muted">No questions match this filter.</p>}
    <p className="muted" style={{fontSize:12,marginTop:12}}>Audit scans the latest 1,000 questions. Duplicate detection is a text-normalisation heuristic, not an AI semantic plagiarism check. Questions with critical structural errors are blocked from publishing here.</p>
  </section>;
}
