"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import uptetPaperII from "../../data/uptet-paper-ii-syllabus-2026.json";
import uptetPaperI from "../../data/uptet-paper-i-syllabus-2026.json";
import upTgt2026 from "../../data/up-tgt-syllabus-2026.json";
import superTet2026 from "../../data/super-tet-syllabus-2026.json";

type Exam = { id:string; code:string; name_en:string; name_hi:string };
type Subject = { id:string; code:string; name_en:string; name_hi:string };
type Chapter = { id:string; subject_id:string; name_en:string; name_hi:string };
type Topic = { id:string; chapter_id:string; name_en:string; name_hi:string };
type Question = { id:string; question_en:string|null; question_hi:string|null; status:string; difficulty:string; created_at:string };
type Material = { id:string; title_en:string|null; title_hi:string|null; status:string; access_tier:string; storage_path:string|null; exam_id?:string|null; subject_id?:string|null; created_at:string };
type Tab = "syllabus"|"questions"|"import"|"materials";

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const btn = "rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700";

export default function ContentStudio() {
  const [tab,setTab] = useState<Tab>("syllabus");
  const [exams,setExams] = useState<Exam[]>([]);
  const [subjects,setSubjects] = useState<Subject[]>([]);
  const [chapters,setChapters] = useState<Chapter[]>([]);
  const [topics,setTopics] = useState<Topic[]>([]);
  const [questions,setQuestions] = useState<Question[]>([]);
  const [materials,setMaterials] = useState<Material[]>([]);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [questionSearch,setQuestionSearch] = useState("");
  const [questionStatus,setQuestionStatus] = useState("all");
  const [questionSort,setQuestionSort] = useState("newest");
  const [questionPage,setQuestionPage] = useState(1);
  const [materialSearch,setMaterialSearch] = useState("");
  const [materialStatus,setMaterialStatus] = useState("all");
  const [materialTier,setMaterialTier] = useState("all");
  const [materialSort,setMaterialSort] = useState("newest");
  const [materialPage,setMaterialPage] = useState(1);
  const [editingMaterial,setEditingMaterial] = useState<Material|null>(null);
  const [previewBusy,setPreviewBusy] = useState<string|null>(null);
  const pageSize = 10;

  async function loadAll() {
    setError("");
    const [e,s,c,t,q,m] = await Promise.all([
      supabase.from("exams").select("id,code,name_en,name_hi").order("display_order"),
      supabase.from("subjects").select("id,code,name_en,name_hi").order("display_order"),
      supabase.from("chapters").select("id,subject_id,name_en,name_hi").order("display_order"),
      supabase.from("topics").select("id,chapter_id,name_en,name_hi").order("display_order"),
      supabase.from("questions").select("id,question_en,question_hi,status,difficulty,created_at").order("created_at",{ascending:false}).limit(100),
      supabase.from("study_materials").select("id,title_en,title_hi,status,access_tier,storage_path,exam_id,subject_id,created_at").order("created_at",{ascending:false}).limit(100)
    ]);
    for (const r of [e,s,c,t,q,m]) if (r.error) { setError(r.error.message); return; }
    setExams(e.data ?? []); setSubjects(s.data ?? []); setChapters(c.data ?? []);
    setTopics(t.data ?? []); setQuestions(q.data ?? []); setMaterials(m.data ?? []);
  }
  useEffect(()=>{ void loadAll(); },[]);

  const visibleQuestions = useMemo(()=>{
    const term=questionSearch.trim().toLowerCase();
    const filtered=questions.filter(q=>{
      const matchesStatus=questionStatus==="all"||q.status===questionStatus;
      const matchesText=!term||`${q.question_en??""} ${q.question_hi??""} ${q.id}`.toLowerCase().includes(term);
      return matchesStatus&&matchesText;
    });
    return filtered.sort((a,b)=>questionSort==="oldest"?a.created_at.localeCompare(b.created_at):questionSort==="az"?(a.question_en||a.question_hi||"").localeCompare(b.question_en||b.question_hi||""):b.created_at.localeCompare(a.created_at));
  },[questions,questionSearch,questionStatus,questionSort]);
  const questionPages=Math.max(1,Math.ceil(visibleQuestions.length/pageSize));
  const pagedQuestions=visibleQuestions.slice((questionPage-1)*pageSize,questionPage*pageSize);
  const visibleMaterials=useMemo(()=>{
    const term=materialSearch.trim().toLowerCase();
    const filtered=materials.filter(m=>{
      const matchesStatus=materialStatus==="all"||m.status===materialStatus;
      const matchesTier=materialTier==="all"||m.access_tier===materialTier;
      const matchesText=!term||`${m.title_en??""} ${m.title_hi??""} ${m.id}`.toLowerCase().includes(term);
      return matchesStatus&&matchesTier&&matchesText;
    });
    return filtered.sort((a,b)=>materialSort==="oldest"?a.created_at.localeCompare(b.created_at):materialSort==="az"?(a.title_en||a.title_hi||"").localeCompare(b.title_en||b.title_hi||""):b.created_at.localeCompare(a.created_at));
  },[materials,materialSearch,materialStatus,materialTier,materialSort]);
  const materialPages=Math.max(1,Math.ceil(visibleMaterials.length/pageSize));
  const pagedMaterials=visibleMaterials.slice((materialPage-1)*pageSize,materialPage*pageSize);

  async function run(action:()=>Promise<void>, success:string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : "Operation failed"); }
    finally { setBusy(false); }
  }

  async function addSubject(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("subjects").insert({
        code:String(f.get("code")).trim().toUpperCase(),
        name_en:String(f.get("name_en")).trim(), name_hi:String(f.get("name_hi")).trim(),
        display_order:Number(f.get("display_order")||0)
      });
      if(error) throw error; e.currentTarget?.reset?.();
    },"Subject saved.");
  }

  async function addChapter(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("chapters").insert({
        subject_id:String(f.get("subject_id")), code:String(f.get("code")||"").trim()||null,
        name_en:String(f.get("name_en")).trim(), name_hi:String(f.get("name_hi")).trim(),
        display_order:Number(f.get("display_order")||0)
      });
      if(error) throw error;
    },"Chapter saved.");
  }

  async function addTopic(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("topics").insert({
        chapter_id:String(f.get("chapter_id")), code:String(f.get("code")||"").trim()||null,
        name_en:String(f.get("name_en")).trim(), name_hi:String(f.get("name_hi")).trim(),
        display_order:Number(f.get("display_order")||0)
      });
      if(error) throw error;
    },"Topic saved.");
  }

  async function mapSubject(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("exam_subjects").upsert({
        exam_id:String(f.get("exam_id")), subject_id:String(f.get("subject_id")),
        is_compulsory:f.get("is_compulsory")==="on", display_order:Number(f.get("display_order")||0)
      });
      if(error) throw error;
    },"Exam-subject mapping saved.");
  }

  async function mapTopic(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("syllabus_items").upsert({
        exam_id:String(f.get("exam_id")), topic_id:String(f.get("topic_id")),
        weightage:f.get("weightage") ? Number(f.get("weightage")) : null,
        notes_en:String(f.get("notes_en")||"").trim()||null,
        notes_hi:String(f.get("notes_hi")||"").trim()||null,
        source_name:String(f.get("source_name")||"").trim()||null,
        source_url:String(f.get("source_url")||"").trim()||null,
        verified_on:String(f.get("verified_on")||"").trim()||null
      },{onConflict:"exam_id,topic_id"});
      if(error) throw error;
    },"Syllabus topic mapped.");
  }


  async function addExamPattern(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("exam_patterns").insert({
        exam_id:String(f.get("exam_id")), version_label:String(f.get("version_label")).trim(),
        duration_minutes:f.get("duration_minutes")?Number(f.get("duration_minutes")):null,
        total_questions:f.get("total_questions")?Number(f.get("total_questions")):null,
        total_marks:f.get("total_marks")?Number(f.get("total_marks")):null,
        negative_marking:f.get("negative_marking")==="on",
        source_name:String(f.get("source_name")||"").trim()||null,
        source_url:String(f.get("source_url")||"").trim()||null,
        verified_on:String(f.get("verified_on")||"").trim()||null,
        is_active:true
      });
      if(error) throw error;
    },"Examination pattern saved. Verify it against the current official notification.");
  }

  async function createQuestion(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    await run(async()=>{
      const examId=String(f.get("exam_id")), subjectId=String(f.get("subject_id"));
      const qHi=String(f.get("question_hi")||"").trim(), qEn=String(f.get("question_en")||"").trim();
      if(!qHi && !qEn) throw new Error("Enter the question in Hindi or English.");
      const {data: q,error:qErr}=await supabase.from("questions").insert({
        exam_id:examId, subject_id:subjectId,
        topic_id:String(f.get("topic_id")||"")||null,
        question_hi:qHi||null, question_en:qEn||null,
        difficulty:String(f.get("difficulty")), marks:Number(f.get("marks")||1),
        negative_marks:Number(f.get("negative_marks")||0),
        created_by:(await supabase.auth.getUser()).data.user?.id
      }).select("id").single();
      if(qErr || !q) throw qErr ?? new Error("Question was not created.");
      const options=["A","B","C","D"].map(k=>({
        question_id:q.id, option_key:k,
        text_hi:String(f.get(`option_${k.toLowerCase()}_hi`)||"").trim()||null,
        text_en:String(f.get(`option_${k.toLowerCase()}_en`)||"").trim()||null,
        display_order:"ABCD".indexOf(k)+1
      }));
      const {data: inserted,error:oErr}=await supabase.from("question_options").insert(options).select("id,option_key");
      if(oErr || !inserted) { await supabase.from("questions").delete().eq("id",q.id); throw oErr ?? new Error("Options could not be saved."); }
      const answerKey=String(f.get("correct_option"));
      const answer=inserted.find(x=>x.option_key===answerKey);
      if(!answer) { await supabase.from("questions").delete().eq("id",q.id); throw new Error("Correct answer option missing."); }
      const [a,x]=await Promise.all([
        supabase.from("question_answers").insert({question_id:q.id,correct_option_id:answer.id}),
        supabase.from("question_explanations").insert({question_id:q.id,
          explanation_hi:String(f.get("explanation_hi")||"").trim()||null,
          explanation_en:String(f.get("explanation_en")||"").trim()||null})
      ]);
      if(a.error || x.error) { await supabase.from("questions").delete().eq("id",q.id); throw a.error ?? x.error; }
      const source=String(f.get("source_name")||"").trim();
      if(source) {
        const {error:sErr}=await supabase.from("question_sources").insert({
          question_id:q.id,source_name:source,
          exam_year:f.get("exam_year")?Number(f.get("exam_year")):null,
          is_verified:false
        });
        if(sErr) throw sErr;
      }
      form.reset();
    },"Question saved as Draft. Review it before publishing.");
  }

  async function publishQuestion(q:Question) {
    await run(async()=>{
      const {data:opts,error:oErr}=await supabase.from("question_options").select("id,option_key").eq("question_id",q.id);
      if(oErr) throw oErr;
      const {data:ans,error:aErr}=await supabase.from("question_answers").select("correct_option_id").eq("question_id",q.id).maybeSingle();
      if(aErr) throw aErr;
      if((opts??[]).length!==4 || !ans || !(opts??[]).some(o=>o.id===ans.correct_option_id))
        throw new Error("Publishing blocked: question must have four options and one correct answer.");
      const uid=(await supabase.auth.getUser()).data.user?.id;
      const {error:rErr}=await supabase.from("question_reviews").insert({
        question_id:q.id,reviewer_id:uid,decision:"approved",comments:"Approved from Content Studio."
      });
      if(rErr) throw rErr;
      const {error}=await supabase.from("questions").update({
        status:"published",reviewed_by:uid,published_at:new Date().toISOString()
      }).eq("id",q.id);
      if(error) throw error;
    },"Question published.");
  }

  async function uploadPdf(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    const file=f.get("file") as File;
    await run(async()=>{
      if(!file || file.size===0) throw new Error("Choose a PDF file.");
      if(file.type!=="application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Only PDF files are allowed.");
      if(file.size>50*1024*1024) throw new Error("PDF must be 50 MB or smaller.");
      const uid=(await supabase.auth.getUser()).data.user?.id;
      if(!uid) throw new Error("Admin session expired.");
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path=`${uid}/${Date.now()}_${safeName}`;
      const {error:upErr}=await supabase.storage.from("study-materials").upload(path,file,{contentType:"application/pdf",upsert:false});
      if(upErr) throw upErr;
      const {error:dbErr}=await supabase.from("study_materials").insert({
        title_en:String(f.get("title_en")||"").trim()||null,
        title_hi:String(f.get("title_hi")||"").trim()||null,
        exam_id:String(f.get("exam_id")||"")||null,
        subject_id:String(f.get("subject_id")||"")||null,
        material_type:"pdf",storage_path:path,file_size_bytes:file.size,
        access_tier:String(f.get("access_tier")),uploaded_by:uid,status:"draft"
      });
      if(dbErr) { await supabase.storage.from("study-materials").remove([path]); throw dbErr; }
      form.reset();
    },"PDF uploaded as Draft. Review metadata before publishing.");
  }

  async function publishMaterial(m:Material) {
    await run(async()=>{
      const {error}=await supabase.from("study_materials").update({
        status:"published",published_at:new Date().toISOString()
      }).eq("id",m.id);
      if(error) throw error;
    },"Study material published.");
  }


  async function saveMaterialMetadata(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!editingMaterial)return;
    const form=new FormData(e.currentTarget);
    await run(async()=>{
      const {error}=await supabase.from("study_materials").update({
        title_en:String(form.get("title_en")||"").trim()||null,
        title_hi:String(form.get("title_hi")||"").trim()||null,
        exam_id:String(form.get("exam_id")||"")||null,
        subject_id:String(form.get("subject_id")||"")||null,
        access_tier:String(form.get("access_tier")||"free")
      }).eq("id",editingMaterial.id);
      if(error)throw error;
      setEditingMaterial(null);
    },"Study material details updated.");
  }

  async function previewMaterial(m:Material) {
    if(!m.storage_path)return;
    setPreviewBusy(m.id);setError("");
    try{
      const {data,error}=await supabase.storage.from("study-materials").createSignedUrl(m.storage_path,300);
      if(error||!data?.signedUrl)throw error??new Error("Secure preview link could not be created.");
      window.open(data.signedUrl,"_blank","noopener,noreferrer");
    }catch(e){setError(e instanceof Error?e.message:"Unable to preview this PDF.");}
    finally{setPreviewBusy(null);}
  }

  const tabs:[Tab,string][]=[["syllabus","Syllabus"],["questions","Question Bank"],["import","Excel Import"],["materials","PDF Materials"]];
  return <section className="mt-8">
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map(([id,label])=><button key={id} className={tab===id?btn:secondary} onClick={()=>setTab(id)}>{label}</button>)}
      <button className={secondary} onClick={()=>void loadAll()}>Refresh</button>
    </div>
    {message && <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {tab==="syllabus" && <div className="space-y-4">
      <SyllabusDraftAudit drafts={[
        {key:"UPTET1",label:"UPTET Paper I",data:uptetPaperI,status:"Bilingual topic outline · official line-by-line review pending"},
        {key:"UPTET2",label:"UPTET Paper II",data:uptetPaperII,status:"Bilingual topic outline · official line-by-line review pending"},
        {key:"UP_TGT_2026",label:"UP TGT 2026",data:upTgt2026,status:"14-subject checklist · subject PDF transcription pending"},
        {key:"SUPER_TET_2026",label:"Super TET",data:superTet2026,status:"Official PDF identified · section and pattern transcription pending"}
      ]}/>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">UP TGT · 2026 revised syllabus</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{upTgt2026.exam_name_en}</h2>
          <p className="text-sm text-slate-700">{upTgt2026.exam_name_hi}</p>
          <p className="mt-2 text-sm text-slate-700">Official subject-wise syllabus index identified · pattern verification pending</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {upTgt2026.general_knowledge.map((unit:any)=><div key={unit.unit} className="rounded-lg bg-white p-3"><b className="block text-sm">{unit.unit}</b><span className="text-xs text-slate-600">{unit.unit_hi}</span><span className="mt-1 block text-xs text-indigo-700">{unit.topics.length} topic groups</span></div>)}
          </div>
          <div className="mt-3 rounded-lg bg-white p-3">
            <b className="text-sm">Subject-wise syllabus checklist</b>
            <div className="mt-2 flex flex-wrap gap-2">{upTgt2026.subjects.map((subject:any)=><span key={subject.code} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">{subject.name_en} / {subject.name_hi}</span>)}</div>
          </div>
          <p className="mt-3 text-xs text-amber-800">Common GK outline is preliminary. Each subject's official PDF still needs full transcription and review before publishing.</p>
          <a className="mt-2 inline-block text-xs font-semibold text-indigo-800 underline" href={upTgt2026.source.official_page} target="_blank" rel="noreferrer">Open official UPESSC syllabus index</a>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Super TET · Assistant Teacher Recruitment</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{superTet2026.exam_name_en}</h2>
          <p className="text-sm text-slate-700">{superTet2026.exam_name_hi}</p>
          <p className="mt-2 text-sm text-slate-700">Official syllabus PDF identified · exam pattern verification pending</p>
          <p className="mt-3 text-xs text-amber-900">Question count, marks, duration, marking scheme and section-wise topics are awaiting direct transcription from the official PDF. No unverified pattern will be shown or imported.</p>
          <a className="mt-2 inline-block text-xs font-semibold text-amber-900 underline" href={superTet2026.source.official_pdf} target="_blank" rel="noreferrer">Open official Super TET PDF</a>
        </article>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[uptetPaperI,uptetPaperII].map((paper:any)=><article key={paper.exam_code} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">{paper.exam_code} · official syllabus draft</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{paper.exam_name_en}</h2>
          <p className="text-sm text-slate-700">{paper.exam_name_hi}</p>
          <p className="mt-2 text-sm text-slate-700">{paper.pattern.questions} questions · {paper.pattern.marks} marks · {paper.pattern.duration_minutes} minutes · {paper.pattern.negative_marking ? "Negative marking" : "No negative marking"}</p>
          <p className="mt-2 text-xs text-slate-600">UPESSC 2026 Information Booklet, Appendix 5. Topic outline requires admin review before publishing.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {paper.subjects.map((s:any)=><div key={s.code} className="rounded-lg bg-white p-3"><b className="block text-sm">{s.name_en}</b><span className="text-xs text-slate-600">{s.name_hi}</span><span className="mt-1 block text-xs text-indigo-700">{s.chapters.length} chapters</span></div>)}
          </div>
          <a className="mt-3 inline-block text-xs font-semibold text-indigo-800 underline" href={paper.source.official_pdf} target="_blank" rel="noreferrer">Open official UPESSC PDF</a>
        </article>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      <FormCard title="Add Subject" onSubmit={addSubject}>
        <input name="code" required placeholder="Code e.g. ENGLISH" className={field}/>
        <input name="name_en" required placeholder="Subject name (English)" className={field}/>
        <input name="name_hi" required placeholder="विषय का नाम (हिन्दी)" className={field}/>
        <input name="display_order" type="number" placeholder="Display order" className={field}/>
        <button className={btn} disabled={busy}>Save Subject</button>
      </FormCard>
      <FormCard title="Add Chapter" onSubmit={addChapter}>
        <select name="subject_id" required className={field}><option value="">Select subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name_en} / {s.name_hi}</option>)}</select>
        <input name="code" placeholder="Optional chapter code" className={field}/>
        <input name="name_en" required placeholder="Chapter name (English)" className={field}/>
        <input name="name_hi" required placeholder="अध्याय का नाम (हिन्दी)" className={field}/>
        <button className={btn} disabled={busy}>Save Chapter</button>
      </FormCard>
      <FormCard title="Add Topic" onSubmit={addTopic}>
        <select name="chapter_id" required className={field}><option value="">Select chapter</option>{chapters.map(c=><option key={c.id} value={c.id}>{c.name_en} / {c.name_hi}</option>)}</select>
        <input name="code" placeholder="Optional topic code" className={field}/>
        <input name="name_en" required placeholder="Topic name (English)" className={field}/>
        <input name="name_hi" required placeholder="विषय का नाम (हिन्दी)" className={field}/>
        <button className={btn} disabled={busy}>Save Topic</button>
      </FormCard>
      <FormCard title="Map Subject to Examination" onSubmit={mapSubject}>
        <select name="exam_id" required className={field}><option value="">Select examination</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
        <select name="subject_id" required className={field}><option value="">Select subject</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input name="is_compulsory" type="checkbox"/> Compulsory subject</label>
        <button className={btn} disabled={busy}>Save Mapping</button>
      </FormCard>
      <FormCard title="Add / Version Examination Pattern" onSubmit={addExamPattern}>
        <select name="exam_id" required className={field}><option value="">Select examination</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
        <input name="version_label" required placeholder="Version / recruitment cycle e.g. 2026 notification" className={field}/>
        <div className="grid grid-cols-3 gap-2">
          <input name="duration_minutes" type="number" min="1" placeholder="Duration (min)" className={field}/>
          <input name="total_questions" type="number" min="1" placeholder="Questions" className={field}/>
          <input name="total_marks" type="number" min="0" step="0.01" placeholder="Total marks" className={field}/>
        </div>
        <label className="flex items-center gap-2 text-sm"><input name="negative_marking" type="checkbox"/> Negative marking applies</label>
        <input name="source_name" placeholder="Official notification/source" className={field}/>
        <input name="source_url" type="url" placeholder="Official source URL" className={field}/>
        <input name="verified_on" type="date" className={field}/>
        <button className={btn} disabled={busy}>Save Pattern</button>
      </FormCard>
      <FormCard title="Add Topic to Exam Syllabus" onSubmit={mapTopic}>
        <select name="exam_id" required className={field}><option value="">Select examination</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
        <select name="topic_id" required className={field}><option value="">Select topic</option>{topics.map(t=><option key={t.id} value={t.id}>{t.name_en}</option>)}</select>
        <input name="weightage" type="number" step="0.01" placeholder="Optional weightage" className={field}/>
        <input name="notes_en" placeholder="Syllabus note (English, optional)" className={field}/>
        <input name="notes_hi" placeholder="पाठ्यक्रम टिप्पणी (हिन्दी, वैकल्पिक)" className={field}/>
        <input name="source_name" placeholder="Official syllabus source name" className={field}/>
        <input name="source_url" type="url" placeholder="Official source URL" className={field}/>
        <input name="verified_on" type="date" aria-label="Verified on" className={field}/>
        <button className={btn} disabled={busy}>Map Topic</button>
      </FormCard>
      <div className="card">
        <h3 className="mb-2 font-bold">Current catalogue</h3>
        <p className="text-sm text-slate-600">{subjects.length} subjects · {chapters.length} chapters · {topics.length} topics</p>
        <p className="mt-2 text-xs text-slate-500">Create subjects first, then chapters, topics, exam mappings and syllabus mappings. Confirm official syllabus before assigning topics to a recruitment exam.</p>
      </div>
      </div>
    </div>}
    {tab==="questions" && <div className="space-y-4">
      <form onSubmit={createQuestion} className="card space-y-3">
        <h2 className="text-lg font-bold">Create bilingual MCQ — saved as Draft</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select name="exam_id" required className={field}><option value="">Examination</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
          <select name="subject_id" required className={field}><option value="">Subject</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
          <select name="topic_id" className={field}><option value="">Topic (optional)</option>{topics.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="question_hi" rows={3} placeholder="Question in Hindi" className={field}/>
          <textarea name="question_en" rows={3} placeholder="Question in English" className={field}/>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {["A","B","C","D"].map(k=><div key={k} className="rounded-lg border p-3">
            <b className="text-sm">Option {k}</b>
            <input name={`option_${k.toLowerCase()}_hi`} placeholder={`विकल्प ${k} (हिन्दी)`} className={field}/>
            <input name={`option_${k.toLowerCase()}_en`} placeholder={`Option ${k} (English)`} className={field}/>
          </div>)}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <select name="correct_option" required className={field}><option value="">Correct option</option>{["A","B","C","D"].map(k=><option key={k}>{k}</option>)}</select>
          <select name="difficulty" defaultValue="moderate" className={field}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option><option value="advanced">Advanced</option></select>
          <input name="marks" type="number" step="0.01" defaultValue="1" className={field} aria-label="Marks"/>
          <input name="negative_marks" type="number" step="0.01" defaultValue="0" className={field} aria-label="Negative marks"/>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="explanation_hi" rows={3} placeholder="Explanation in Hindi" className={field}/>
          <textarea name="explanation_en" rows={3} placeholder="Explanation in English" className={field}/>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="source_name" placeholder="Source / reference (optional)" className={field}/>
          <input name="exam_year" type="number" placeholder="PYQ year (optional)" className={field}/>
        </div>
        <button className={btn} disabled={busy}>Save Question as Draft</button>
      </form>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Question Bank</h2><p className="text-xs text-slate-500">Showing latest 100 records loaded from the database · {visibleQuestions.length} match(es)</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{questions.filter(q=>q.status==="published").length} published</span></div>
        <div className="grid gap-2 md:grid-cols-3">
          <input className={field} value={questionSearch} onChange={e=>{setQuestionSearch(e.target.value);setQuestionPage(1);}} placeholder="Search question text or ID"/>
          <select className={field} value={questionStatus} onChange={e=>{setQuestionStatus(e.target.value);setQuestionPage(1);}}><option value="all">All statuses</option><option value="draft">Draft</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="published">Published</option></select>
          <select className={field} value={questionSort} onChange={e=>setQuestionSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="az">Question A–Z</option></select>
        </div>
        <div className="space-y-2">{pagedQuestions.map(q=><div key={q.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3">
          <div className="min-w-0 flex-1"><p className="font-medium">{q.question_en || q.question_hi || "Untitled question"}</p>{q.question_en&&q.question_hi&&<p className="mt-1 text-xs text-slate-500">{q.question_hi}</p>}<p className="text-xs text-slate-500">{q.difficulty} · {q.status} · {new Date(q.created_at).toLocaleDateString()} · {q.id.slice(0,8)}</p></div>
          {q.status!=="published" && <button className={btn} disabled={busy} onClick={()=>void publishQuestion(q)}>Approve & Publish</button>}
          {q.status==="published" && <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">Published</span>}
        </div>)}</div>
        {visibleQuestions.length===0&&<p className="py-6 text-center text-sm text-slate-500">No questions match these filters.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span className="text-xs text-slate-500">Page {questionPage} of {questionPages}</span><div className="flex gap-2"><button className={secondary} disabled={questionPage<=1} onClick={()=>setQuestionPage(p=>Math.max(1,p-1))}>Previous</button><button className={secondary} disabled={questionPage>=questionPages} onClick={()=>setQuestionPage(p=>Math.min(questionPages,p+1))}>Next</button></div></div>
      </div>
    </div>}
    {tab==="import" && <BulkImporter exams={exams} subjects={subjects} topics={topics} onDone={loadAll} setMessage={setMessage} setError={setError}/>}
    {tab==="materials" && <div className="space-y-4">
      <form onSubmit={uploadPdf} className="card space-y-3">
        <h2 className="text-lg font-bold">Upload study PDF — private storage</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="title_en" placeholder="Title (English)" className={field}/>
          <input name="title_hi" placeholder="शीर्षक (हिन्दी)" className={field}/>
          <select name="exam_id" className={field}><option value="">All / no exam selected</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
          <select name="subject_id" className={field}><option value="">No subject selected</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name_en}</option>)}</select>
          <select name="access_tier" className={field}><option value="free">Free</option><option value="premium">Premium</option></select>
          <input name="file" type="file" accept="application/pdf,.pdf" required className={field}/>
        </div>
        <p className="text-xs text-slate-500">PDF only · Maximum 50 MB · Uploaded as Draft. Student download/signed-link entitlement flow is implemented in a later phase.</p>
        <button className={btn} disabled={busy}>Upload PDF</button>
      </form>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Study Material Library</h2><p className="text-xs text-slate-500">Latest 100 records loaded · {visibleMaterials.length} match(es)</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{materials.filter(m=>m.status==="published").length} published</span></div>
        <div className="grid gap-2 md:grid-cols-4">
          <input className={field} value={materialSearch} onChange={e=>{setMaterialSearch(e.target.value);setMaterialPage(1);}} placeholder="Search title or ID"/>
          <select className={field} value={materialStatus} onChange={e=>{setMaterialStatus(e.target.value);setMaterialPage(1);}}><option value="all">All statuses</option><option value="draft">Draft</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="published">Published</option></select>
          <select className={field} value={materialTier} onChange={e=>{setMaterialTier(e.target.value);setMaterialPage(1);}}><option value="all">All access levels</option><option value="free">Free</option><option value="premium">Premium</option></select>
          <select className={field} value={materialSort} onChange={e=>setMaterialSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="az">Title A–Z</option></select>
        </div>
        {pagedMaterials.map(m=><div key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3">
          <div className="min-w-0 flex-1"><p className="font-medium">{m.title_en || m.title_hi || "Untitled PDF"}</p>{m.title_en&&m.title_hi&&<p className="text-xs text-slate-500">{m.title_hi}</p>}<p className="text-xs text-slate-500">{m.access_tier} · {m.status} · {new Date(m.created_at).toLocaleDateString()} · {m.id.slice(0,8)}</p></div>
          {m.status!=="published" && <button className={btn} disabled={busy} onClick={()=>void publishMaterial(m)}>Publish</button>}
          {m.status==="published" && <span className="text-xs text-green-700">Published</span>}
        </div>)}
        {visibleMaterials.length===0&&<p className="py-6 text-center text-sm text-slate-500">No materials match these filters.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span className="text-xs text-slate-500">Page {materialPage} of {materialPages}</span><div className="flex gap-2"><button className={secondary} disabled={materialPage<=1} onClick={()=>setMaterialPage(p=>Math.max(1,p-1))}>Previous</button><button className={secondary} disabled={materialPage>=materialPages} onClick={()=>setMaterialPage(p=>Math.min(materialPages,p+1))}>Next</button></div></div>
      </div>
    </div>}
  </section>;
}

function FormCard({title,onSubmit,children}:{title:string;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;children:ReactNode}) {
  return <form onSubmit={onSubmit} className="card space-y-2"><h3 className="font-bold">{title}</h3>{children}</form>;
}

function BulkImporter({exams,subjects,topics,onDone,setMessage,setError}:{
  exams:Exam[];subjects:Subject[];topics:Topic[];onDone:()=>Promise<void>;
  setMessage:(s:string)=>void;setError:(s:string)=>void;
}) {
  const [rows,setRows]=useState<Record<string,unknown>[]>([]);
  const [filename,setFilename]=useState("");
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<string[]>([]);
  const [errors,setErrors]=useState<string[]>([]);
  const subjectByCode=useMemo(()=>new Map(subjects.map(s=>[s.code.toUpperCase(),s])),[subjects]);
  const examByCode=useMemo(()=>new Map(exams.map(e=>[e.code.toUpperCase(),e])),[exams]);
  function downloadTemplate() {
    const headers=["exam_code","subject_code","topic_id","question_hi","question_en","option_a_hi","option_a_en","option_b_hi","option_b_en","option_c_hi","option_c_en","option_d_hi","option_d_en","correct_option","explanation_hi","explanation_en","difficulty","marks","negative_marks","source_name","exam_year"];
    const sample=[["SUPER_TET","CDP","","बाल विकास का अर्थ क्या है?","What does child development mean?","विकास की प्रक्रिया","Process of development","केवल वृद्धि","Only growth","केवल शिक्षा","Only education","इनमें से कोई नहीं","None of these","A","यह विकास की व्यापक प्रक्रिया है।","It is a broad developmental process.","easy",1,0,"Sample reference",""]];
    const ws=XLSX.utils.aoa_to_sheet([headers,...sample]); const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Questions"); XLSX.writeFile(wb,"UP_Teacher_Master_Question_Import_Template.xlsx");
  }
  async function parseFile(e:ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file)return;
    setFilename(file.name); setErrors([]); setReport([]);
    try {
      const data=await file.arrayBuffer();
      const wb=XLSX.read(data,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const json=XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:""});
      if(json.length>500) throw new Error("Maximum 500 rows per import file. Split larger files into batches.");
      const normalized=json.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k.trim().toLowerCase(),v])));
      setRows(normalized);
    } catch(err) { setRows([]); setErrors([err instanceof Error?err.message:"Could not read file"]); }
  }
  async function importRows() {
    setBusy(true);setErrors([]);setReport([]);setMessage("");setError("");
    const rowErrors:string[]=[]; const imported:string[]=[];
    const seenQuestions = new Set<string>();
    for(let i=0;i<rows.length;i++) {
      const r=rows[i]; const rowNo=i+2;
      const exam=examByCode.get(String(r.exam_code||"").trim().toUpperCase());
      const subject=subjectByCode.get(String(r.subject_code||"").trim().toUpperCase());
      const qHi=String(r.question_hi||"").trim(), qEn=String(r.question_en||"").trim();
      const correct=String(r.correct_option||"").trim().toUpperCase();
      if(!exam) {rowErrors.push(`Row ${rowNo}: unknown exam_code.`);continue;}
      if(!subject) {rowErrors.push(`Row ${rowNo}: unknown subject_code.`);continue;}
      if(!qHi&&!qEn) {rowErrors.push(`Row ${rowNo}: question_hi or question_en is required.`);continue;}
      const duplicateKey = `${exam.code}|${subject.code}|${(qEn || qHi).normalize("NFKC").replace(/\s+/g," ").trim().toLowerCase()}`;
      if(seenQuestions.has(duplicateKey)) {rowErrors.push(`Row ${rowNo}: duplicate question within this import file.`);continue;}
      seenQuestions.add(duplicateKey);
      const marksValue = r.marks === "" || r.marks == null ? 1 : Number(r.marks);
      const negativeValue = r.negative_marks === "" || r.negative_marks == null ? 0 : Number(r.negative_marks);
      if(!Number.isFinite(marksValue) || marksValue <= 0 || !Number.isFinite(negativeValue) || negativeValue < 0) {
        rowErrors.push(`Row ${rowNo}: marks must be positive and negative_marks must be zero or greater.`);continue;
      }
      if(!["A","B","C","D"].includes(correct)) {rowErrors.push(`Row ${rowNo}: correct_option must be A/B/C/D.`);continue;}
      const optionRows=["A","B","C","D"].map(k=>({
        option_key:k,
        text_hi:String(r[`option_${k.toLowerCase()}_hi`]||"").trim()||null,
        text_en:String(r[`option_${k.toLowerCase()}_en`]||"").trim()||null,
        display_order:"ABCD".indexOf(k)+1
      }));
      if(optionRows.some(o=>!o.text_hi&&!o.text_en)) {rowErrors.push(`Row ${rowNo}: all four options need text in at least one language.`);continue;}
      const topicId=String(r.topic_id||"").trim();
      if(topicId && !topics.some(t=>t.id===topicId)) {rowErrors.push(`Row ${rowNo}: topic_id is not in the current topic catalogue.`);continue;}
      const {data:q,error:qErr}=await supabase.from("questions").insert({
        exam_id:exam.id,subject_id:subject.id,topic_id:topicId||null,
        question_hi:qHi||null,question_en:qEn||null,
        difficulty:["easy","moderate","difficult","advanced"].includes(String(r.difficulty).toLowerCase())?String(r.difficulty).toLowerCase():"moderate",
        marks:marksValue,negative_marks:negativeValue,
        created_by:(await supabase.auth.getUser()).data.user?.id,status:"draft"
      }).select("id").single();
      if(qErr||!q) {rowErrors.push(`Row ${rowNo}: ${qErr?.message||"question insert failed"}`);continue;}
      const {data:opts,error:oErr}=await supabase.from("question_options").insert(optionRows.map(o=>({...o,question_id:q.id}))).select("id,option_key");
      if(oErr||!opts) {await supabase.from("questions").delete().eq("id",q.id);rowErrors.push(`Row ${rowNo}: ${oErr?.message||"options insert failed"}`);continue;}
      const answer=opts.find(o=>o.option_key===correct)!;
      const [a,x]=await Promise.all([
        supabase.from("question_answers").insert({question_id:q.id,correct_option_id:answer.id}),
        supabase.from("question_explanations").insert({question_id:q.id,
          explanation_hi:String(r.explanation_hi||"").trim()||null,
          explanation_en:String(r.explanation_en||"").trim()||null})
      ]);
      if(a.error||x.error) {await supabase.from("questions").delete().eq("id",q.id);rowErrors.push(`Row ${rowNo}: ${(a.error||x.error)?.message}`);continue;}
      if(r.source_name||r.exam_year) {
        const {error:sErr}=await supabase.from("question_sources").insert({
          question_id:q.id,source_name:String(r.source_name||"").trim()||null,
          exam_year:r.exam_year?Number(r.exam_year):null,is_verified:false
        });
        if(sErr) rowErrors.push(`Row ${rowNo}: question saved, but source metadata failed: ${sErr.message}`);
      }
      imported.push(`Row ${rowNo}: saved as Draft (${q.id.slice(0,8)}).`);
    }
    setReport(imported);setErrors(rowErrors);setBusy(false);
    if(imported.length) {setMessage(`${imported.length} questions imported as Draft. They are not visible to students until reviewed and published.`);await onDone();}
    if(!imported.length&&!rowErrors.length) setError("No rows to import.");
  }
  return <div className="space-y-4">
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">Excel / CSV bulk question import</h2>
      <p className="text-sm text-slate-600">Download the template, fill bilingual question data and upload .xlsx, .xls or .csv. Import limit: 500 rows per file. Every imported question stays Draft until review.</p>
      <button type="button" className={secondary} onClick={downloadTemplate}>Download Excel Template</button>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={parseFile} className={field}/>
      {filename && <p className="text-sm">Selected: <b>{filename}</b> · {rows.length} rows</p>}
      {rows.length>0 && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>Exam</th><th>Subject</th><th>Question</th><th>Answer</th></tr></thead><tbody>
        {rows.slice(0,5).map((r,i)=><tr key={i} className="border-t"><td>{String(r.exam_code||"")}</td><td>{String(r.subject_code||"")}</td><td>{String(r.question_en||r.question_hi||"").slice(0,80)}</td><td>{String(r.correct_option||"")}</td></tr>)}
      </tbody></table><p className="mt-2 text-slate-500">Previewing first {Math.min(5,rows.length)} rows.</p></div>}
      <button className={btn} disabled={busy||rows.length===0} onClick={()=>void importRows()}>{busy?"Importing…":`Validate & Import ${rows.length} Rows`}</button>
    </div>
    {report.length>0&&<div className="card"><h3 className="font-bold">Imported successfully: {report.length}</h3><p className="text-xs text-slate-600">All items are Draft and require review.</p></div>}
    {errors.length>0&&<div className="card"><h3 className="font-bold text-red-700">Rows requiring attention: {errors.length}</h3><ul className="mt-2 list-disc pl-5 text-sm text-red-700">{errors.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
  </div>;
}

function SyllabusDraftAudit({drafts}:{drafts:{key:string;label:string;data:any;status:string}[]}) {
  function countTopics(data:any) {
    return (data.subjects||[]).reduce((total:number,subject:any)=>total+(subject.chapters||[]).reduce((n:number,chapter:any)=>n+(chapter.topics||[]).length,0),0);
  }
  function exportBundle() {
    const bundle={exported_at:new Date().toISOString(),purpose:"Admin review only; not a live database import.",drafts:drafts.map(d=>({exam_code:d.key,label:d.label,status:d.status,data:d.data}))};
    const blob=new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="UP_Teacher_Master_Syllabus_Review_Drafts.json"; a.click();
    URL.revokeObjectURL(url);
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Syllabus draft audit</h2>
      <p className="mt-1 text-sm text-slate-600">Structural check of four course drafts. Export creates a review file only; it does not write to Supabase or publish to students.</p></div>
      <button type="button" className={secondary} onClick={exportBundle}>Export review JSON</button>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {drafts.map(d=>{
        const subjects=d.data.subjects?.length||0;
        const chapters=(d.data.subjects||[]).reduce((n:number,s:any)=>n+(s.chapters?.length||0),0);
        const topics=countTopics(d.data);
        return <article key={d.key} className="rounded-lg border border-slate-200 p-3">
          <b className="block text-sm text-slate-900">{d.label}</b>
          <p className="mt-1 text-xs text-slate-600">{d.status}</p>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center">
            <div className="rounded bg-slate-50 p-2"><b className="block text-base">{subjects}</b><small className="text-slate-500">Subjects</small></div>
            <div className="rounded bg-slate-50 p-2"><b className="block text-base">{chapters}</b><small className="text-slate-500">Chapters</small></div>
            <div className="rounded bg-slate-50 p-2"><b className="block text-base">{topics}</b><small className="text-slate-500">Topics</small></div>
          </div>
          <p className="mt-2 text-xs text-slate-600">{d.data.pattern?"Pattern field present":"Pattern not supplied / pending verification"}</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">{topics===0?"Content transcription required":"Draft only · verify against official PDF"}</p>
        </article>;
      })}
    </div>
    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Counts measure current draft structure, not official completeness. A present pattern is still a draft until verified. No syllabus import or student publishing is enabled here.</p>
  </section>;
}