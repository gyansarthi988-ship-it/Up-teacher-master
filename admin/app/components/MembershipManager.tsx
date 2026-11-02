"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Plan = { id:string; code:string; name_en:string; name_hi:string; duration_days:number; price_paise:number; is_active:boolean; display_order:number };
type Subscription = { id:string; user_id:string; status:string; starts_at:string; expires_at:string; profiles?:{full_name:string|null;email:string|null;phone:string|null}|null; membership_plans?:{name_en:string}|null };
export default function MembershipManager(){
 const [plans,setPlans]=useState<Plan[]>([]); const [subs,setSubs]=useState<Subscription[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [loading,setLoading]=useState(true);
 async function load(){setLoading(true); const [p,s]=await Promise.all([supabase.from("membership_plans").select("*").order("display_order"),supabase.from("user_subscriptions").select("id,user_id,status,starts_at,expires_at,profiles(full_name,email,phone),membership_plans(name_en)").order("created_at",{ascending:false}).limit(100)]); if(p.error||s.error)setMessage(p.error?.message||s.error?.message||"Unable to load memberships"); else {setPlans(p.data||[]);setSubs((s.data||[]) as unknown as Subscription[]);} setLoading(false);}
 useEffect(()=>{void load()},[]);
 async function save(plan:Plan){setBusy(true);setMessage("");const {error}=await supabase.from("membership_plans").update({price_paise:Math.round(Number(plan.price_paise)),is_active:plan.is_active,name_en:plan.name_en,name_hi:plan.name_hi,duration_days:Number(plan.duration_days),updated_at:new Date().toISOString()}).eq("id",plan.id);setBusy(false);setMessage(error?error.message:`${plan.name_en} saved.`);if(!error)await load();}
 async function revoke(id:string){if(!confirm("Revoke this membership? This cannot be undone."))return;setBusy(true);const {error}=await supabase.rpc("admin_revoke_membership",{p_subscription_id:id,p_reason:"Revoked by administrator"});setBusy(false);setMessage(error?.message||"Membership revoked.");if(!error)await load();}
 if(loading)return <section className="card">Loading membership data…</section>;
 return <section className="card" style={{marginTop:20}}><h2>Premium Membership Manager</h2><p className="muted">Configure prices and availability. Changes affect new orders; existing paid orders retain their recorded amount.</p>
 {message&&<p role="status">{message}</p>}<h3>Subscription Plans</h3>
 {plans.map(p=><div key={p.id} style={{border:"1px solid #dbe3ef",borderRadius:12,padding:14,marginBottom:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
 <label>Plan<input value={p.name_en} onChange={e=>setPlans(xs=>xs.map(x=>x.id===p.id?{...x,name_en:e.target.value}:x))}/></label>
 <label>Hindi name<input value={p.name_hi} onChange={e=>setPlans(xs=>xs.map(x=>x.id===p.id?{...x,name_hi:e.target.value}:x))}/></label>
 <label>Duration (days)<input type="number" min="1" max="3660" value={p.duration_days} onChange={e=>setPlans(xs=>xs.map(x=>x.id===p.id?{...x,duration_days:Number(e.target.value)}:x))}/></label>
 <label>Price (₹)<input type="number" min="1" step="1" value={p.price_paise/100} onChange={e=>setPlans(xs=>xs.map(x=>x.id===p.id?{...x,price_paise:Math.round(Number(e.target.value)*100)}:x))}/></label>
 <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={p.is_active} onChange={e=>setPlans(xs=>xs.map(x=>x.id===p.id?{...x,is_active:e.target.checked}:x))}/> Active for sale</label>
 <button disabled={busy||p.price_paise<100||p.duration_days<1} onClick={()=>void save(p)}>Save plan</button></div>)}
 <h3 style={{marginTop:24}}>Recent Memberships (latest 100)</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th align="left">User</th><th align="left">Plan</th><th align="left">Status</th><th align="left">Expiry</th><th>Action</th></tr></thead><tbody>{subs.map(s=><tr key={s.id} style={{borderTop:"1px solid #e5eaf1"}}><td>{s.profiles?.full_name||s.profiles?.email||s.user_id.slice(0,8)}<br/><small>{s.profiles?.phone||s.profiles?.email||s.user_id}</small></td><td>{s.membership_plans?.name_en||"Admin grant"}</td><td>{s.status}</td><td>{new Date(s.expires_at).toLocaleDateString()}</td><td><button disabled={busy||s.status!=="active"} onClick={()=>void revoke(s.id)}>Revoke</button></td></tr>)}</tbody></table>{!subs.length&&<p className="muted">No memberships recorded yet.</p>}</div>
 <p className="muted" style={{marginTop:12}}>Payment verification remains webhook-controlled. Admins cannot mark a payment order as paid from this screen.</p></section>
}
