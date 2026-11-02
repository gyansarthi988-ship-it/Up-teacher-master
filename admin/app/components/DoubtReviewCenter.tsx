"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
type Doubt = { id:string; subject:string; question:string; answer:string|null; status:string; created_at:string; user_id:string };
export default function DoubtReviewCenter(){
 const [rows,setRows]=useState<Doubt[]>([]); const [error,setError]=useState("");
 async function load(){ const {data,error}=await supabase.from("study_doubts").select("id,subject,question,answer,status,created_at,user_id").order("created_at",{ascending:false}).limit(100); if(error)setError(error.message); else setRows(data??[]); }
 useEffect(()=>{void load();},[]);
 return <section className="card"><h2>AI Doubt Review</h2><p className="muted">Latest 100 student questions. Review AI responses for accuracy; do not treat generated answers as official exam notices.</p>{error&&<p style={{color:"crimson"}}>{error}</p>}{rows.map(r=><article key={r.id} style={{borderTop:"1px solid #ddd",padding:"12px 0"}}><small>{r.subject} · {r.status} · {new Date(r.created_at).toLocaleString()}</small><p><b>Question:</b> {r.question}</p><p><b>AI answer:</b> {r.answer??"No answer available"}</p><small>User: {r.user_id}</small></article>)}{!rows.length&&!error&&<p className="muted">No student doubts yet.</p>}</section>
}
