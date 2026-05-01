import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

const SK = "flow_v7";

// ── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAJGY4M8BDI97CrI_QQSXIuqIcLAzo1rCA",
  authDomain: "proto-carlo.firebaseapp.com",
  projectId: "proto-carlo",
  storageBucket: "proto-carlo.firebasestorage.app",
  messagingSenderId: "457805890194",
  appId: "1:457805890194:web:998ad81774c3f48bef5c4b"
};
const fbApp = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
const fbDb = getFirestore(fbApp);
const fbProvider = new GoogleAuthProvider();

// ── Fitness Milestones (Carlo's actual data) ─────────────────────────────────
const FITNESS_BASELINES = {
  mile:     { current: "7:28", pr_date: "Apr 16 2026", target_3mo: "7:00", unit: "pace" },
  two_mile: { current: "17:08 (8:34/mi)", pr_date: "Apr 28 2026", target_3mo: "16:30", unit: "time" },
  fiveK:    { current: "27:16 (8:47/mi)", pr_date: "Apr 28 2026", target_3mo: "26:00 (8:22/mi)", unit: "time" },
  tenK:     { current: "untested", pr_date: null, target_3mo: "55:00 (8:52/mi)", unit: "time" },
  half:     { current: "~2:22 (embedded)", pr_date: "Mar 7 2026", target_3mo: "2:15 (official race)", unit: "time" },
  marathon: { current: "16.71 mi long run", pr_date: "Mar 7 2026", target_3mo: "18 mi long run by Sep", unit: "distance" },
};

const MARATHON_MILESTONES = [
  { id:"m1",  text:"Run a 10K race (baseline)", done:false },
  { id:"m2",  text:"Sub-27:00 5K",              done:false },
  { id:"m3",  text:"Official half marathon race — target 2:15", done:false },
  { id:"m4",  text:"18-mile long run by September 2026", done:false },
  { id:"m5",  text:"20-mile long run by November 2026",  done:false },
  { id:"m6",  text:"Register for Miami Marathon 2027",   done:false },
  { id:"m7",  text:"Nail fueling — gel every 45 min from mile 3", done:false },
  { id:"m8",  text:"Sub-5:00 marathon finish — Miami Jan 2027",   done:false },
];

// ── Identities ───────────────────────────────────────────────────────────────

const IDENTITIES = [
  { id:"stoic",     emoji:"🏛️", name:"Stoic",             color:"#a78bfa" },
  { id:"opera",     emoji:"🎭", name:"Opera Ambassador",   color:"#f472b6" },
  { id:"kite",      emoji:"🪁", name:"Kite Surfer",        color:"#38bdf8" },
  { id:"politics",  emoji:"🗳️", name:"Local Politician",   color:"#fb923c" },
  { id:"env",       emoji:"🌿", name:"Env. Advocate",      color:"#4ade80" },
  { id:"marathon",  emoji:"🏃", name:"Marathon Runner",    color:"#facc15" },
  { id:"reader",    emoji:"📚", name:"Reader",             color:"#c084fc" },
  { id:"arts",      emoji:"🎨", name:"Arts Patron",        color:"#f87171" },
  { id:"nature",    emoji:"🦜", name:"Bird/Plant Knower",  color:"#6ee7b7" },
  { id:"history",   emoji:"🗺️", name:"FL Historian",       color:"#fbbf24" },
  { id:"italian",   emoji:"🇮🇹", name:"Italian/Spanish",    color:"#60a5fa" },
  { id:"handy",     emoji:"🔧", name:"Competently Handy",  color:"#94a3b8" },
  { id:"animals",   emoji:"🐊", name:"Animal Knower",      color:"#34d399" },
  { id:"mangrove",  emoji:"🌴", name:"Mangrove Steward",   color:"#2dd4bf" },
  { id:"organized", emoji:"📋", name:"Organized",          color:"#a3e635" },
  { id:"charisma",  emoji:"🎤", name:"Confident Speaker",  color:"#f59e0b" },
];

// ── Workouts ─────────────────────────────────────────────────────────────────

const WORKOUTS = {
  fb1_full:  { label:"Full Body 1 — Full",    icon:"💪", duration:60, location:"gym",
    exercises:[{name:"DB Bench Press",sets:"4×6",note:"70 lbs → 75 when 4×6 clean"},{name:"DB Romanian Deadlift",sets:"3×8",note:"80 lbs, 3-sec eccentric"},{name:"Wide Grip Lat Pulldown",sets:"3×10",note:"140 lbs"},{name:"Reverse Grip Lat Pulldown",sets:"2×10",note:"140 lbs"},{name:"DB Step-Up",sets:"3×10 each",note:"Single-leg"},{name:"Lateral Raise Machine",sets:"3×12",note:"70 lbs"},{name:"Overhead Tricep Extension",sets:"2×12",note:"57.5 lbs"},{name:"Pallof Press",sets:"3×12 each",note:"Anti-rotation"},{name:"Calf Press Machine",sets:"3×15",note:"Slow eccentric — PT priority"}]},
  fb1_short: { label:"Full Body 1 — Short",   icon:"💪", duration:30, location:"gym",
    exercises:[{name:"DB Bench Press",sets:"3×6",note:"70 lbs"},{name:"DB Romanian Deadlift",sets:"3×8",note:"Slow eccentric"},{name:"Lat Pulldown",sets:"2×10",note:"140 lbs"},{name:"DB Step-Up",sets:"2×10 each",note:""},{name:"Pallof Press",sets:"2×12 each",note:""}]},
  fb2_full:  { label:"Full Body 2 — Full",    icon:"💪", duration:60, location:"gym",
    exercises:[{name:"Hack Squat",sets:"3×8",note:"230 lbs"},{name:"Incline Smith Press",sets:"3×8",note:"130 lbs — cap here"},{name:"T-Bar Row",sets:"3×8",note:"Start 70, work to 90"},{name:"DB Split Squat",sets:"3×8 each",note:"APT + hip stability"},{name:"Bicep Curl EZ Bar",sets:"3×8",note:"65–70 lbs"},{name:"Kneeling Cable Crunch",sets:"3×12",note:""},{name:"Outer Thigh Machine",sets:"2×15",note:"Knee + hip stability"},{name:"Suitcase Carry",sets:"3×30m each",note:""},{name:"Dead Bug",sets:"2×8 each",note:"APT fix"}]},
  fb2_short: { label:"Full Body 2 — Short",   icon:"💪", duration:30, location:"gym",
    exercises:[{name:"Hack Squat",sets:"3×8",note:"230 lbs"},{name:"Incline Smith Press",sets:"3×6",note:"130 lbs"},{name:"T-Bar Row",sets:"3×8",note:""},{name:"DB Split Squat",sets:"2×8 each",note:""},{name:"Dead Bug",sets:"2×8 each",note:""}]},
  kb:        { label:"Kettlebell — Roof",      icon:"🔔", duration:30, location:"home",
    exercises:[{name:"Double KB Swing",sets:"4×15",note:"Two 20kg"},{name:"Double KB Goblet Squat",sets:"3×10",note:""},{name:"Single KB Romanian DL",sets:"3×10 each",note:"Slow eccentric"},{name:"Double KB Row",sets:"3×10",note:""},{name:"Single KB Press",sets:"3×8 each",note:""},{name:"KB Suitcase Carry",sets:"3×30m each",note:""},{name:"Dead Bug",sets:"2×8 each",note:""}]},
  tempo:     { label:"Tempo Run",              icon:"⚡", duration:45, location:"outside", exercises:[{name:"10 min easy warmup",sets:"",note:"Zone 2"},{name:"20–25 min tempo",sets:"",note:"Comfortably hard"},{name:"10 min cooldown",sets:"",note:""}]},
  intervals: { label:"Intervals",              icon:"⚡", duration:45, location:"outside", exercises:[{name:"10 min warmup",sets:"",note:""},{name:"6–8 × 400m hard",sets:"",note:"Full recovery between"},{name:"10 min cooldown",sets:"",note:""}]},
  long_run:  { label:"Long Run",               icon:"🏃‍♂️",duration:90, location:"outside", exercises:[{name:"Easy aerobic pace",sets:"",note:"Zone 2. Miami Marathon 2027 base build."}]},
  easy_run:  { label:"Easy Run",               icon:"🏃", duration:40, location:"outside", exercises:[{name:"30–40 min Zone 2",sets:"",note:"Conversational pace"}]},
  recovery:  { label:"Active Recovery/Pilates",icon:"🧘", duration:60, location:"gym",    exercises:[{name:"Pilates class",sets:"",note:"Anatomy Wednesdays"},{name:"Cold plunge",sets:"2–3 min",note:"Mental fortitude"},{name:"Infrared sauna",sets:"10–15 min",note:"Recovery"}]},
  pt_only:   { label:"PT Routine Only",        icon:"🦵", duration:20, location:"home",   exercises:[]},
  rest:      { label:"Rest — Walk or Hike",    icon:"🚶", duration:60, location:"outside", exercises:[{name:"Walk or light hike",sets:"",note:"Full recovery"}]},
};

const DOW_DEFAULT = {0:"rest",1:"fb1_full",2:"tempo",3:"recovery",4:"fb2_full",5:"easy_run",6:"long_run"};

function suggestWorkout(dow){
  const total=new Date().getHours()*60+new Date().getMinutes();
  const def=DOW_DEFAULT[dow];
  if(total>=480&&(def==="fb1_full"||def==="fb2_full")) return "kb";
  if(total>=450&&def==="fb1_full") return "fb1_short";
  if(total>=450&&def==="fb2_full") return "fb2_short";
  return def;
}

// Listening suggestions based on workout location + current book
function getListeningSuggestions(woId, readingList){
  const wo = WORKOUTS[woId];
  const currentBook = (readingList||[]).find(b=>b.status==="reading"&&b.type==="audiobook");
  const suggestions = [];

  // Always first: current audiobook
  if(currentBook){
    suggestions.push({ icon:"🎧", label:currentBook.title, sub:`by ${currentBook.author}`, highlighted:true });
  } else {
    suggestions.push({ icon:"🎧", label:"A Guide to the Good Life", sub:"William Irvine — your current audiobook", highlighted:true });
  }

  // 2nd + 3rd based on location/identity
  if(wo?.location==="outside"){
    suggestions.push({ icon:"🎙️", label:"Deep Focus — Jon Kiriakou", sub:"Latest episode · focus & flow" });
    suggestions.push({ icon:"🏛️", label:"The Daily Stoic Podcast", sub:"Ryan Holiday · stoicism in practice" });
  } else if(wo?.location==="gym"){
    suggestions.push({ icon:"🎭", label:"Met Opera Radio", sub:"Full performances · opera identity XP" });
    suggestions.push({ icon:"🗺️", label:"Florida Humanities Podcast", sub:"FL history · local knowledge" });
  } else {
    suggestions.push({ icon:"🧘", label:"Waking Up — Sam Harris", sub:"Meditation & philosophy" });
    suggestions.push({ icon:"🎭", label:"Met Opera Radio", sub:"Full performances · opera identity XP" });
  }

  return suggestions.slice(0,3);
}

// ── Recurring work blocks ────────────────────────────────────────────────────

const RECURRING = {
  1: [ // Monday
    { time:"14:00", label:"📊 Fox search data update", duration:20, color:"#f59e0b" },
  ],
  2: [ // Tuesday
    { time:"9:00",  label:"📧 Situate — email check", duration:10, color:"#60a5fa" },
    { time:"9:10",  label:"🦊 Fox report — heads down", duration:110, color:"#f87171" },
    { time:"11:00", label:"🦊 Fox report presentation", duration:30, color:"#f87171" },
    { time:"11:30", label:"👔 1:1 with boss", duration:30, color:"#a78bfa" },
  ],
};

// ── Schedule blocks ──────────────────────────────────────────────────────────

const BASE_WORK_BLOCKS = [
  {time:"9:00",  label:"Work start — catch up & prioritize", nudge:false},
  {time:"9:30",  label:"Deep focus block",                   nudge:false},
  {time:"10:00", label:"Deep focus block",                   nudge:false},
  {time:"10:30", label:"Deep focus block",                   nudge:false},
  {time:"11:00", label:"💧 Water + stand up",                nudge:true},
  {time:"11:30", label:"Deep focus block",                   nudge:false},
  {time:"12:00", label:"Deep focus block",                   nudge:false},
  {time:"12:30", label:"Deep focus block",                   nudge:false},
  {time:"13:00", label:"🧘 Midday reset — 10 min meditation",nudge:true},
  {time:"13:10", label:"🍎 Snack + free time",               nudge:true},
  {time:"13:40", label:"🎯 Goal work or rest",               nudge:true},
  {time:"14:00", label:"Deep focus block",                   nudge:false},
  {time:"14:30", label:"🌬️ Box breathing — 5 min",          nudge:true},
  {time:"15:00", label:"Deep focus block",                   nudge:false},
  {time:"15:30", label:"Deep focus block",                   nudge:false},
  {time:"16:00", label:"Admin / emails / low-effort tasks",  nudge:false},
  {time:"16:30", label:"📋 Wrap up — set tomorrow's top 3",  nudge:true},
  {time:"17:00", label:"🏁 Work ends",                       nudge:true},
];

function getWorkBlocks(dow){
  const recurring = RECURRING[dow]||[];
  if(recurring.length===0) return BASE_WORK_BLOCKS;

  // Overlay recurring blocks onto base schedule
  const overrideTimes = new Set(recurring.map(r=>r.time));
  const base = BASE_WORK_BLOCKS.filter(b=>!overrideTimes.has(b.time));

  const recurringBlocks = recurring.map(r=>({
    time: r.time,
    label: r.label,
    nudge: false,
    recurring: true,
    color: r.color,
  }));

  const all = [...base, ...recurringBlocks].sort((a,b)=>{
    const ta = a.time.split(":").map(Number); const tb = b.time.split(":").map(Number);
    return (ta[0]*60+ta[1])-(tb[0]*60+tb[1]);
  });
  return all;
}

const LIFE_BLOCKS = [
  {time:"6:00", label:"Wake up / open FLOW"},
  {time:"6:30", label:"Morning wizard"},
  {time:"7:00", label:"Workout window"},
  {time:"7:30", label:"Workout / PT"},
  {time:"8:00", label:"Shower / wrap up"},
  {time:"8:30", label:"Clean / fuel / prep"},
  {time:"17:30",label:"Post-work — identity block"},
  {time:"18:00",label:"Identity / project time"},
  {time:"18:30",label:"Identity / project time"},
  {time:"19:00",label:"Dinner / social / culture"},
  {time:"19:30",label:"Evening activity"},
  {time:"20:00",label:"Reading / learning"},
  {time:"20:30",label:"Reading / wind down"},
  {time:"21:00",label:"Wind-down routine starts"},
];

const WIND_DOWN_LIST = [
  "Heated eye mask (stye prevention)","Tomorrow's top 3 written",
  "One thing you're proud of today","No screens 30 min before bed",
  "Stretch / breathe","Clothes laid out for tomorrow",
];

const MORNING_CHECKS = ["Brush teeth — nondominant hand","Get clothes on","Meditate (Calm app)"];

const MOVEMENT_OPTIONS = [
  { id:"chinese", icon:"🌀", label:"Chinese Medicine", desc:"50 lymphatic jumps, body taps, shaking" },
  { id:"prerun",  icon:"🏃", label:"Pre-Run Warmup",   desc:"Dynamic stretch, hip circles, leg swings" },
  { id:"lazy",    icon:"🧘", label:"Lazy Stretch",      desc:"15 min — hip opener, spinal decompression" },
  { id:"skip",    icon:"⏭️", label:"Skip today",        desc:"Straight to the gym" },
];

const PT = [
  "Straight leg raises 3×10","Lunge heel raise 3×10",
  "Single leg balance on pad — front press 10 lbs","Clamshells (standing & laying)",
  "Hip abduction","Calf stretch + foam roll","Thoracic rotation","Calf stretch ×2 today",
  "Single leg bridge on ball","Glute bridge (marching)","Hamstring stretch",
  "Banded squat (mirror — check alignment)",
];

const DEFAULT_READING = [
  {id:"ltop", title:"Last Train to Paradise",    author:"Les Standiford",          type:"physical",  status:"to-read"},
  {id:"rog",  title:"A River of Grass",          author:"Marjory Stoneman Douglas", type:"physical",  status:"to-read"},
  {id:"agtgl",title:"A Guide to the Good Life",  author:"William Irvine",           type:"audiobook", status:"reading"},
  {id:"semi", title:"The Seminole Wars",         author:"John & Mary Lou Missall",  type:"physical",  status:"reading"},
];

const SEED_EVENTS = [
  {id:"hamburger",  title:"🍔 Hamburger House Party",             time:"3:00 PM", date:"Sat May 2",  cal:"Personal", color:"#f472b6"},
  {id:"telehealth", title:"🩺 Telehealth — Barbara Hayes-Murray", time:"2:00 PM", date:"Thu May 7",  cal:"Personal", color:"#38bdf8"},
];

// ── Storage ──────────────────────────────────────────────────────────────────

function load(){ try{return JSON.parse(localStorage.getItem(SK)||"{}");}catch{return {};} }
function save(d){ try{localStorage.setItem(SK,JSON.stringify(d));}catch{} }

function cloudSave(uid, data){
  if(!uid) return;
  try{
    setDoc(doc(fbDb, "users", uid), data || {}).catch(e => console.warn("[FLOW] cloud save failed:", e.message));
  }catch(e){ console.warn("[FLOW] cloud save threw:", e.message); }
}
function signInGoogle(){ signInWithPopup(fbAuth, fbProvider).catch(e => alert("Sign-in failed: " + e.message)); }
function signOutNow(){ signOut(fbAuth).catch(e => console.warn(e)); }

function exportBackup(){
  try{
    const data=localStorage.getItem(SK)||"{}";
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const stamp=new Date().toISOString().split("T")[0];
    const a=document.createElement("a");
    a.href=url; a.download=`flow-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }catch(err){ alert("Backup failed: "+err.message); }
}

function importBackup(file, onLoaded){
  const reader=new FileReader();
  reader.onload=(e)=>{
    try{
      const parsed=JSON.parse(e.target.result);
      if(typeof parsed!=="object"||parsed===null||Array.isArray(parsed)) throw new Error("Not a valid FLOW backup file");
      if(!window.confirm("This will REPLACE all your current FLOW data with the contents of the backup file. Continue?")) return;
      localStorage.setItem(SK,JSON.stringify(parsed));
      onLoaded(parsed);
      alert("Restore complete. Your data has been loaded.");
    }catch(err){ alert("Restore failed: "+err.message); }
  };
  reader.onerror=()=>alert("Could not read file.");
  reader.readAsText(file);
}
function todayKey(){ return new Date().toISOString().split("T")[0]; }
function todayDow(){ return new Date().getDay(); }
function isWeekday(){ const d=todayDow(); return d>=1&&d<=5; }
function curBlockIdx(dow){
  const blocks=getWorkBlocks(dow);
  const t=new Date().getHours()*60+new Date().getMinutes();
  for(let i=blocks.length-1;i>=0;i--){
    const[h,m]=blocks[i].time.split(":").map(Number);
    if(t>=h*60+m) return i;
  }
  return 0;
}
function liveTime(){ return new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}); }
function liveDate(){ return new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",timeZone:"America/New_York"}); }
function getTimeGreeting(){
  const total=new Date().getHours()*60+new Date().getMinutes();
  if(total<450) return {text:"Full workout window — get after it.",urgent:false};
  if(total<480) return {text:"Getting tight — consider short or KB on the roof.",urgent:true};
  if(total<540) return {text:"Running late — KB or PT only. Work at 9.",urgent:true};
  return {text:"Work window. Stay focused.",urgent:false};
}

function buildCoachingExport(store, today){
  const log=today?.log||{};
  const goals=(store.goals||[]);
  const xp=store.xp||{};
  const savings=store.savings||{};
  const reading=store.readingList||DEFAULT_READING;
  const weeklyTasks=store.weeklyTasks||[];
  const days=[];
  for(let i=0;i<7;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    const k=d.toISOString().split("T")[0];
    const dd=store[k]||{}; const l=dd.log||{};
    days.push(`${k}: wt=${l.weight||"?"} slp=${l.sleep||"?"} nrg=${l.energy||"?"} wo=${dd.workout||"?"}`);
  }
  const idXP=IDENTITIES.map(id=>{const pts=xp[id.id]?.points||0;return pts>0?`${id.name}:${pts}`:null;}).filter(Boolean).join("|");
  const activeGoals=goals.filter(g=>!g.done).map(g=>`[${g.type}]${g.text}`).join("\n");
  const currentBook=reading.find(b=>b.status==="reading");
  return `=FLOW COACHING ${new Date().toDateString()}=
VITALS:\n${days.join("\n")}
GOALS:\n${activeGoals||"none"}
XP: ${idXP||"none"}
KITE: $${savings.kite||0}/$1425
BOOK: ${currentBook?`${currentBook.title}(${currentBook.type})`:"none"}
TASKS: ${weeklyTasks.filter(t=>!t.done).map(t=>`[${t.priority}]${t.text}`).join("|")||"none"}
=END=`;
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function App(){
  const [store,setStore]=useState(load);
  const [tab,setTab]=useState("home");
  const [time,setTime]=useState(liveTime());
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const skipNextCloudWrite=useRef(false);
  const key=todayKey();
  const dow=todayDow();
  const today=store[key]||{};

  useEffect(()=>{ const iv=setInterval(()=>setTime(liveTime()),30000); return()=>clearInterval(iv); },[]);
  useEffect(()=>{
    const n={...store}; let dirty=false;
    if(!store.readingList){n.readingList=DEFAULT_READING;dirty=true;}
    if(!store.calEvents){n.calEvents=SEED_EVENTS;dirty=true;}
    if(!store.goals){n.goals=[];dirty=true;}
    if(!store.milestones?.marathon){ n.milestones={...(store.milestones||{}),marathon:MARATHON_MILESTONES}; dirty=true; }
    if(dirty){setStore(n);save(n);}
  },[]);

  // Firebase Auth listener
  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,(u)=>{ setUser(u); setAuthReady(true); });
    return ()=>unsub();
  },[]);

  // Firestore live sync when signed in
  useEffect(()=>{
    if(!user) return;
    const ref=doc(fbDb,"users",user.uid);
    const unsub=onSnapshot(ref,(snap)=>{
      if(snap.exists()){
        const cloudData=snap.data()||{};
        // Avoid overwriting local state with an empty cloud doc
        if(Object.keys(cloudData).length>0){
          skipNextCloudWrite.current=true;
          setStore(cloudData);
          save(cloudData);
        }
      } else {
        // First time signing in on this account — push current local data to cloud
        const local=load();
        if(Object.keys(local).length>0) cloudSave(user.uid, local);
      }
    },(err)=>console.warn("[FLOW] snapshot err:",err.message));
    return ()=>unsub();
  },[user]);

  function pt(p){
    const n={...store,[key]:{...today,...p}};
    setStore(n); save(n);
    if(user && !skipNextCloudWrite.current) cloudSave(user.uid, n);
    skipNextCloudWrite.current=false;
  }
  function pg(p){
    const n={...store,...p};
    setStore(n); save(n);
    if(user && !skipNextCloudWrite.current) cloudSave(user.uid, n);
    skipNextCloudWrite.current=false;
  }

  const TABS=[
    {id:"home",     icon:"🏠", label:"Home"},
    {id:"day",      icon:"📅", label:"Day"},
    {id:"week",     icon:"📊", label:"Week"},
    {id:"identity", icon:"⚡", label:"Identity"},
    {id:"journal",  icon:"✍️",  label:"Journal"},
  ];

  return (
    <div style={S.root}>
      <div style={S.app}>
        <header style={S.hdr}>
          <span style={S.logo}>FLOW</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {authReady && (user ? (
                <button
                  onClick={signOutNow}
                  title={`Synced as ${user.email}. Click to sign out.`}
                  style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}
                >☁ Synced</button>
              ) : (
                <button
                  onClick={signInGoogle}
                  title="Sign in with Google to sync your data across devices"
                  style={{background:C.purpleFaint,border:`1px solid ${C.purple}`,color:C.purpleText,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}
                >Sign in to sync</button>
              ))}
              <button
                onClick={exportBackup}
                title="Download a JSON backup of all your FLOW data"
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}
              >⬇</button>
              <label
                title="Restore data from a previously downloaded backup file"
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600,display:"inline-block"}}
              >
                ⬆
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{display:"none"}}
                  onChange={(e)=>{
                    const f=e.target.files&&e.target.files[0];
                    if(f) importBackup(f,(data)=>{ setStore(data); if(user) cloudSave(user.uid, data); });
                    e.target.value="";
                  }}
                />
              </label>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontVariantNumeric:"tabular-nums"}}>{time}</div>
              <div style={{fontSize:11,color:C.muted}}>{liveDate()}</div>
            </div>
          </div>
        </header>
        <main style={S.main}>
          {tab==="home"     && <HomeTab     today={today} patch={pt} store={store} pg={pg} dow={dow}/>}
          {tab==="day"      && <DayTab      today={today} patch={pt} store={store} pg={pg} dow={dow}/>}
          {tab==="week"     && <WeekTab     store={store} pg={pg}/>}
          {tab==="identity" && <IdentityTab today={today} patch={pt} store={store} pg={pg}/>}
          {tab==="journal"  && <JournalTab  today={today} patch={pt} store={store} pg={pg} storeKey={key}/>}
        </main>
        <nav style={S.nav}>
          {TABS.map(t=>(
            <button key={t.id} style={{...S.navBtn,...(tab===t.id?S.navActive:{})}} onClick={()=>setTab(t.id)}>
              <span style={{fontSize:18}}>{t.icon}</span>
              <span style={S.navLabel}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ── Morning Wizard ───────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  {id:"vitals",    title:"Good morning, Carlo.", emoji:"☀️"},
  {id:"checklist", title:"Morning checklist",    emoji:"✅"},
  {id:"grateful",  title:"What are you grateful for?", emoji:"🙏"},
  {id:"enjoyed",   title:"What did you enjoy yesterday?", emoji:"😊"},
  {id:"goals",     title:"Today's goals",        emoji:"🎯"},
  {id:"movement",  title:"Morning activation",   emoji:"🌀"},
  {id:"overview",  title:"You're set.",           emoji:"🚀"},
];

function MorningWizard({today, patch, store, pg, onComplete, onSkipAll}){
  const [step,setStep]=useState(0);
  const dow=todayDow();
  const woId=today.workout||suggestWorkout(dow);
  const wo=WORKOUTS[woId];
  const checks=today.checks||{};
  const log=today.log||{};
  const [grateful,setGrateful]=useState(log.grateful||"");
  const [enjoyed,setEnjoyed]=useState(log.enjoyed||"");
  const [jGoals,setJGoals]=useState(log.jGoals||"");
  const [movement,setMovement]=useState(today.movement||"");
  const [newGoalText,setNewGoalText]=useState("");
  const [newGoalType,setNewGoalType]=useState("personal");
  const [showAddGoal,setShowAddGoal]=useState(false);
  const [selectedListening,setSelectedListening]=useState(0);
  const goals=store.goals||[];
  const todayGoals=goals.filter(g=>!g.done);
  const greeting=getTimeGreeting();
  const listenOptions=getListeningSuggestions(woId, store.readingList);

  function tog(item){patch({checks:{...checks,[item]:!checks[item]}});}
  function setLog(k,v){patch({log:{...log,[k]:v}});}
  function addGoal(){
    if(!newGoalText.trim()) return;
    pg({goals:[...goals,{id:Date.now(),text:newGoalText.trim(),type:newGoalType,done:false,created:todayKey()}]});
    setNewGoalText(""); setShowAddGoal(false);
  }
  function finish(){
    patch({log:{...log,grateful,enjoyed,jGoals},movement,morningDone:true});
    onComplete();
  }
  function next(){ if(step<WIZARD_STEPS.length-1) setStep(s=>s+1); }
  function back(){ if(step>0) setStep(s=>s-1); }

  const morningChecksDone=MORNING_CHECKS.filter(c=>checks[c]).length;
  const isLast=step===WIZARD_STEPS.length-1;

  return (
    <div style={S.wizard}>
      {/* Header with skip all */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 4px"}}>
        <div style={S.wizProgress}>
          {WIZARD_STEPS.map((_,i)=>(
            <button key={i} style={{...S.wizDot,...(i<=step?{background:C.purple}:{}),cursor:"pointer",border:"none"}} onClick={()=>setStep(i)}/>
          ))}
        </div>
        <button style={S.skipAllBtn} onClick={onSkipAll}>Skip all →</button>
      </div>

      {/* Step content */}
      <div style={S.wizStep}>
        <div style={S.wizEmoji}>{WIZARD_STEPS[step].emoji}</div>
        <h2 style={S.wizTitle}>{WIZARD_STEPS[step].title}</h2>

        {/* Step 0: Vitals */}
        {step===0&&(
          <>
            <p style={{...S.wizSub,...(greeting.urgent?{color:"#fbbf24"}:{color:C.green})}}>{greeting.text}</p>
            <div style={{...S.card,marginTop:16}}>
              <CT>Quick vitals</CT>
              <div style={S.grid2}>
                <LI label="Weight (lbs)" value={log.weight||""} onChange={v=>setLog("weight",v)} type="number" ph="—"/>
                <LI label="Sleep (1–5)"  value={log.sleep||""}  onChange={v=>setLog("sleep",v)}  type="number" ph="—"/>
                <LI label="Energy (1–5)" value={log.energy||""} onChange={v=>setLog("energy",v)} type="number" ph="—"/>
                <LI label="Meditation"   value={log.meditation||""} onChange={v=>setLog("meditation",v)} type="number" ph="min"/>
              </div>
            </div>
          </>
        )}

        {/* Step 1: Checklist */}
        {step===1&&(
          <>
            <p style={S.wizSub}>{morningChecksDone}/{MORNING_CHECKS.length} done</p>
            <div style={{...S.card,marginTop:16,gap:14}}>
              {MORNING_CHECKS.map(item=><CR key={item} label={item} checked={!!checks[item]} onToggle={()=>tog(item)} big/>)}
            </div>
            <div style={{...S.card,marginTop:12,borderColor:C.purple+"55",background:C.purple+"0d"}}>
              <p style={{margin:0,fontSize:12,fontWeight:700,color:C.purpleText}}>💪 Today's workout</p>
              <p style={{margin:"4px 0 0",fontSize:15,fontWeight:600,color:C.text}}>{wo?.icon} {wo?.label} · ~{wo?.duration} min</p>
            </div>
          </>
        )}

        {/* Step 2: Grateful */}
        {step===2&&(
          <textarea style={{...S.jfBig,marginTop:20}} rows={7} value={grateful} onChange={e=>setGrateful(e.target.value)} placeholder="Today I'm grateful for..."/>
        )}

        {/* Step 3: Enjoyed */}
        {step===3&&(
          <textarea style={{...S.jfBig,marginTop:20}} rows={7} value={enjoyed} onChange={e=>setEnjoyed(e.target.value)} placeholder="Yesterday I enjoyed..."/>
        )}

        {/* Step 4: Goals */}
        {step===4&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
            {todayGoals.slice(0,5).map(g=>(
              <div key={g.id} style={{...S.goalChip,borderColor:g.type==="professional"?"#60a5fa44":"#4ade8044",background:g.type==="professional"?"#60a5fa0d":"#4ade800d"}}>
                <span style={{fontSize:11,fontWeight:700,color:g.type==="professional"?"#60a5fa":"#4ade80"}}>{g.type==="professional"?"💼":"🌿"}</span>
                <span style={{fontSize:13,color:C.text,flex:1,marginLeft:8}}>{g.text}</span>
              </div>
            ))}
            {!showAddGoal&&<button style={S.ghostBtn} onClick={()=>setShowAddGoal(true)}>+ Add goal for today</button>}
            {showAddGoal&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <textarea style={S.jfBig} rows={3} value={newGoalText} onChange={e=>setNewGoalText(e.target.value)} placeholder="Describe the goal..."/>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.tBtn,...(newGoalType==="personal"?{borderColor:"#4ade80",color:"#4ade80",background:"#4ade800d"}:{})}} onClick={()=>setNewGoalType("personal")}>🌿 Personal</button>
                  <button style={{...S.tBtn,...(newGoalType==="professional"?{borderColor:"#60a5fa",color:"#60a5fa",background:"#60a5fa0d"}:{})}} onClick={()=>setNewGoalType("professional")}>💼 Professional</button>
                </div>
                <div style={S.addRow}>
                  <button style={{...S.addBtn,flex:1,width:"auto",fontSize:13}} onClick={addGoal}>Add</button>
                  <button style={{...S.addBtn,background:C.border,flex:1,width:"auto",fontSize:13}} onClick={()=>setShowAddGoal(false)}>Cancel</button>
                </div>
              </div>
            )}
            <textarea style={{...S.jfBig,marginTop:4}} rows={3} value={jGoals} onChange={e=>setJGoals(e.target.value)} placeholder="Anything else on your mind today..."/>
          </div>
        )}

        {/* Step 5: Movement */}
        {step===5&&(
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:16}}>
            {MOVEMENT_OPTIONS.map(m=>(
              <button key={m.id} style={{...S.movCard,...(movement===m.id?S.movCardActive:{})}} onClick={()=>setMovement(m.id)}>
                <span style={{fontSize:24,flexShrink:0}}>{m.icon}</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <p style={{margin:0,fontSize:14,fontWeight:600,color:movement===m.id?C.purpleText:C.text}}>{m.label}</p>
                  <p style={{margin:"2px 0 0",fontSize:12,color:C.muted}}>{m.desc}</p>
                </div>
                {movement===m.id&&<span style={{color:C.purple,fontSize:18,flexShrink:0}}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Step 6: Overview + listening */}
        {step===6&&(
          <>
            <p style={S.wizSub}>Pick your listening, then go.</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
              {listenOptions.map((opt,i)=>(
                <button key={i} style={{...S.listenCard,...(selectedListening===i?S.listenActive:{}),...(opt.highlighted&&selectedListening===i?{borderColor:C.green,background:C.greenBg}:{})}} onClick={()=>setSelectedListening(i)}>
                  <span style={{fontSize:22,flexShrink:0}}>{opt.icon}</span>
                  <div style={{flex:1,textAlign:"left"}}>
                    <p style={{margin:0,fontSize:14,fontWeight:600,color:selectedListening===i?C.text:C.muted}}>{opt.label}</p>
                    <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>{opt.sub}</p>
                  </div>
                  {opt.highlighted&&<span style={{fontSize:9,fontWeight:800,color:C.green,background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:4,padding:"2px 6px",flexShrink:0}}>NOW</span>}
                  {selectedListening===i&&!opt.highlighted&&<span style={{color:C.purple,fontSize:16,flexShrink:0}}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{...S.card,marginTop:12}}>
              <CT>Today's focus</CT>
              {(store.goals||[]).filter(g=>!g.done).slice(0,3).map(g=>(
                <div key={g.id} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:g.type==="professional"?"#60a5fa":"#4ade80"}}>{g.type==="professional"?"💼":"🌿"}</span>
                  <span style={{fontSize:13,color:C.text}}>{g.text}</span>
                </div>
              ))}
              {isWeekday()&&<p style={{margin:"8px 0 0",fontSize:12,color:C.green}}>🧘 Midday reset at 1:00 PM</p>}
              {dow===2&&<p style={{margin:"4px 0 0",fontSize:12,color:"#f87171"}}>🦊 Fox report morning — heads down after 9:10</p>}
              {dow===1&&<p style={{margin:"4px 0 0",fontSize:12,color:"#f59e0b"}}>📊 Fox search data update at 2:00 PM</p>}
            </div>
            <button style={{...S.bigBtn,marginTop:20,background:"#4ade80",color:"#0a1f0f"}} onClick={finish}>
              Let's go 🔥
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <div style={S.wizNav}>
        {step>0
          ? <button style={S.wizBack} onClick={back}>← Back</button>
          : <div/>
        }
        {!isLast&&(
          <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
            <button style={S.skipStepBtn} onClick={next}>Skip</button>
            <button style={S.wizNextBtn} onClick={next}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({onSave, onClose}){
  const [title,setTitle]=useState("");
  const [date,setDate]=useState("");
  const [time,setEvtTime]=useState("");
  const [cal,setCal]=useState("Personal");
  const [color,setColor]=useState("#a89fff");

  function save(){
    if(!title.trim()) return;
    onSave({id:Date.now().toString(),title,date,time,cal,color,addedToGcal:false});
    onClose();
  }

  return (
    <div style={S.modalBg}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontSize:16,fontWeight:700,color:C.text}}>Add Event</p>
          <button style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}} onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <LI label="Title" value={title} onChange={setTitle} type="text" ph="Event name" wide/>
          <div style={S.grid2}>
            <LI label="Date" value={date} onChange={setDate} type="text" ph="May 5"/>
            <LI label="Time" value={time} onChange={setEvtTime} type="text" ph="2:00 PM"/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted}}>Calendar</label>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              {["Personal","Work","Home"].map(c=>(
                <button key={c} style={{...S.tBtn,flex:1,...(cal===c?S.tActive:{})}} onClick={()=>setCal(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted}}>Color</label>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              {["#a89fff","#f472b6","#38bdf8","#4ade80","#f59e0b","#f87171"].map(cl=>(
                <button key={cl} style={{width:28,height:28,borderRadius:"50%",background:cl,border:color===cl?`3px solid #fff`:`3px solid transparent`,cursor:"pointer"}} onClick={()=>setColor(cl)}/>
              ))}
            </div>
          </div>
          <div style={{...S.addRow,marginTop:4}}>
            <button style={{...S.bigBtn,flex:1}} onClick={save}>Add Event</button>
            <button style={{...S.bigBtn,flex:1,background:C.border}} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Home Tab ─────────────────────────────────────────────────────────────────

function HomeTab({today,patch,store,pg,dow}){
  const [showWizard,setShowWizard]=useState(false);
  const woId=today.workout||suggestWorkout(dow);
  const wo=WORKOUTS[woId];
  const identity=IDENTITIES.find(i=>i.id===today.identity);
  const goals=(store.goals||[]).filter(g=>!g.done);
  const calEvents=store.calEvents||[];
  const checks=today.checks||{};
  const morningChecks=MORNING_CHECKS.filter(c=>checks[c]).length;
  const blocks=getWorkBlocks(dow);
  const nowIdx=curBlockIdx(dow);
  const nowBlock=blocks[nowIdx];
  const isNight=new Date().getHours()>=20;
  const todayXP=IDENTITIES.reduce((acc,id)=>{
    const logs=(store.xp?.[id.id]?.log||[]).filter(l=>l.date===todayKey());
    return acc+logs.reduce((s,l)=>s+l.pts,0);
  },0);

  if(showWizard) return <MorningWizard today={today} patch={patch} store={store} pg={pg} onComplete={()=>setShowWizard(false)} onSkipAll={()=>{ patch({morningDone:true}); setShowWizard(false); }}/>;

  return (
    <div style={S.sec}>
      {!today.morningDone&&!isNight&&(
        <button style={S.bigGreenBtn} onClick={()=>setShowWizard(true)}>
          <span style={{fontSize:28}}>☀️</span>
          <span style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>GOOD MORNING</span>
        </button>
      )}
      {isNight&&(
        <button style={{...S.bigGreenBtn,background:"#0d0d1f",borderColor:C.purple}}>
          <span style={{fontSize:28}}>🌙</span>
          <span style={{fontSize:20,fontWeight:800,color:C.purpleText}}>WIND DOWN</span>
        </button>
      )}

      {/* RIGHT NOW */}
      <div style={{...S.card,borderColor:C.purple,background:C.purple+"15"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={S.nowPillLarge}>RIGHT NOW</span>
          <span style={{fontSize:12,color:C.muted}}>{nowBlock?.time}</span>
        </div>
        <p style={{margin:"6px 0 0",fontSize:16,fontWeight:700,color:nowBlock?.recurring?nowBlock.color:C.text}}>{nowBlock?.label}</p>
      </div>

      {/* Priorities */}
      {goals.length>0&&(
        <div style={S.card}>
          <CT>Today's priorities</CT>
          {goals.slice(0,3).map(g=>(
            <div key={g.id} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:g.type==="professional"?"#60a5fa":"#4ade80",flexShrink:0}}/>
              <span style={{fontSize:14,color:C.text}}>{g.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Checklist ring + workout */}
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <ProgressRing pct={Math.round((morningChecks/MORNING_CHECKS.length)*100)} color={C.green} size={48}/>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:14,fontWeight:600,color:C.text}}>Morning routine</p>
            <p style={{margin:0,fontSize:12,color:C.muted}}>{morningChecks}/{MORNING_CHECKS.length} done</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#facc15"}}>{wo?.icon} {wo?.label}</p>
            <p style={{margin:0,fontSize:11,color:C.muted}}>~{wo?.duration} min</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      {calEvents.length>0&&(
        <div style={S.card}>
          <CT>📅 Upcoming</CT>
          {calEvents.slice(0,3).map(e=>(
            <div key={e.id} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:e.color||C.purple,flexShrink:0}}/>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:C.text}}>{e.title}</p>
                <p style={{margin:0,fontSize:11,color:C.muted}}>{e.date} · {e.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Identity */}
      {identity&&(
        <div style={{...S.card,borderColor:identity.color+"44",background:identity.color+"0d"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>{identity.emoji}</span>
            <div style={{flex:1}}>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:identity.color}}>Today: {identity.name}</p>
              <p style={{margin:0,fontSize:11,color:C.muted}}>{todayXP} XP earned today</p>
            </div>
          </div>
        </div>
      )}

      {/* Wind down */}
      {isNight&&(
        <div style={S.card}>
          <CT>Wind-Down Checklist</CT>
          {WIND_DOWN_LIST.map(item=>(
            <CR key={item} label={item} checked={!!(today.wdChecks||{})[item]} onToggle={()=>patch({wdChecks:{...(today.wdChecks||{}),[item]:!(today.wdChecks||{})[item]}})}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Day Tab ──────────────────────────────────────────────────────────────────

function DayTab({today,patch,store,pg,dow}){
  const tasks=today.tasks||{};
  const lifeBlocks=today.lifeBlocks||{};
  const workEvents=today.workEvents||[];
  const calEvents=store.calEvents||[];
  const [mode,setMode]=useState("work");
  const [showTomorrow,setShowTomorrow]=useState(false);
  const [showAddEvent,setShowAddEvent]=useState(false);
  const [showWorkEventForm,setShowWorkEventForm]=useState(false);
  const [newWorkEvent,setNewWorkEvent]=useState({title:"",time:""});
  const blocks=getWorkBlocks(dow);
  const nowIdx=curBlockIdx(dow);
  const refs=useRef({});

  useEffect(()=>{ const el=refs.current[nowIdx]; if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); },[]);

  function addWorkEvent(){
    if(!newWorkEvent.title.trim()) return;
    patch({workEvents:[...workEvents,{...newWorkEvent,id:Date.now(),addedToGcal:false}]});
    setNewWorkEvent({title:"",time:""}); setShowWorkEventForm(false);
  }
  function saveCalEvent(evt){
    pg({calEvents:[...(store.calEvents||[]),evt]});
  }

  return (
    <Sec>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <SH icon="📅" title="Today" sub="full schedule"/>
        <button style={S.plusBtn} onClick={()=>setShowAddEvent(true)}>+</button>
      </div>

      {showAddEvent&&<AddEventModal onSave={saveCalEvent} onClose={()=>setShowAddEvent(false)}/>}

      {/* Work events */}
      <div style={S.card}>
        <CT>📋 Work meetings → GCal</CT>
        {workEvents.map(e=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,color:e.addedToGcal?C.green:C.text,flex:1}}>{e.time&&`${e.time} · `}{e.title}</span>
            {!e.addedToGcal&&<button style={{...S.microBtn,color:"#4ade80",borderColor:"#4ade8033"}} onClick={()=>patch({workEvents:workEvents.map(ev=>ev.id===e.id?{...ev,addedToGcal:true}:ev)})}>✓ sent</button>}
            {e.addedToGcal&&<span style={{fontSize:10,color:C.green}}>✅</span>}
            <button style={{...S.microBtn,color:C.muted,borderColor:C.border}} onClick={()=>patch({workEvents:workEvents.filter(ev=>ev.id!==e.id)})}>✕</button>
          </div>
        ))}
        {!showWorkEventForm&&<button style={S.ghostBtn} onClick={()=>setShowWorkEventForm(true)}>+ Add work meeting</button>}
        {showWorkEventForm&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={S.grid2}>
              <LI label="Meeting" value={newWorkEvent.title} onChange={v=>setNewWorkEvent({...newWorkEvent,title:v})} type="text" ph="Standup" wide/>
              <LI label="Time" value={newWorkEvent.time} onChange={v=>setNewWorkEvent({...newWorkEvent,time:v})} type="text" ph="10:00 AM"/>
            </div>
            <div style={S.addRow}>
              <button style={{...S.addBtn,flex:1,width:"auto",fontSize:13}} onClick={addWorkEvent}>Add</button>
              <button style={{...S.addBtn,background:C.border,flex:1,width:"auto",fontSize:13}} onClick={()=>setShowWorkEventForm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={S.toggle}>
        <button style={{...S.tBtn,...(mode==="work"?S.tActive:{})}} onClick={()=>setMode("work")}>9–5</button>
        <button style={{...S.tBtn,...(mode==="life"?S.tActive:{})}} onClick={()=>setMode("life")}>Full Day</button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {mode==="work"&&blocks.map((b,i)=>{
          const isNow=i===nowIdx;
          return (
            <div key={b.time+i} ref={el=>refs.current[i]=el}
              style={{...S.block,...(isNow?S.blockNow:{}),...(b.nudge?S.blockGreen:{}),...(b.recurring?{borderColor:b.color+"66",background:b.color+"0d"}:{})}}>
              <div style={S.bTime}>
                <span style={{...S.bTL,...(isNow?{color:C.purple}:{}),...(b.recurring?{color:b.color}:{})}}>{b.time}</span>
                {isNow&&<span style={S.nowPill}>NOW</span>}
              </div>
              <div style={S.bBody}>
                <p style={{...S.bDesc,...(b.nudge?{color:C.green,fontWeight:600}:{}),...(b.recurring?{color:b.color,fontWeight:600}:{})}}>{b.label}</p>
                {!b.nudge&&!b.recurring&&<input style={S.tInput} placeholder="+ add task" value={tasks[b.time]||""} onChange={e=>patch({tasks:{...tasks,[b.time]:e.target.value}})}/>}
              </div>
            </div>
          );
        })}
        {mode==="life"&&LIFE_BLOCKS.map(b=>(
          <div key={b.time} style={S.block}>
            <div style={S.bTime}><span style={S.bTL}>{b.time}</span></div>
            <div style={S.bBody}>
              <p style={S.bDesc}>{b.label}</p>
              <input style={S.tInput} placeholder="+ add" value={lifeBlocks[b.time]||""} onChange={e=>patch({lifeBlocks:{...lifeBlocks,[b.time]:e.target.value}})}/>
            </div>
          </div>
        ))}
      </div>

      <button style={S.ghostBtn} onClick={()=>setShowTomorrow(!showTomorrow)}>
        {showTomorrow?"▾ Hide tomorrow":"▸ Preview tomorrow"}
      </button>
      {showTomorrow&&(
        <div style={S.card}>
          <CT>Tomorrow</CT>
          {(()=>{ const tDow=(dow+1)%7; const tWo=WORKOUTS[DOW_DEFAULT[tDow]]; return <p style={{margin:0,fontSize:13,color:C.text}}>{tWo?.icon} {tWo?.label} · ~{tWo?.duration} min</p>; })()}
          {(RECURRING[(dow+1)%7]||[]).map(r=><p key={r.time} style={{margin:"4px 0 0",fontSize:12,color:r.color}}>{r.time} · {r.label}</p>)}
        </div>
      )}
    </Sec>
  );
}

// ── Week Tab ─────────────────────────────────────────────────────────────────

function WeekTab({store,pg}){
  const [showAddEvent,setShowAddEvent]=useState(false);
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const k=d.toISOString().split("T")[0];
    const dd=store[k]||{}; const l=dd.log||{};
    const checksDone=MORNING_CHECKS.filter(c=>(dd.checks||{})[c]).length;
    const dow2=d.getDay();
    days.push({k,l,checksDone,dayLabel:["Su","Mo","Tu","We","Th","Fr","Sa"][dow2],isToday:i===0,dow2});
  }
  const weeklyTasks=store.weeklyTasks||[];
  const [newTask,setNewTask]=useState("");
  const PC={high:"#ef4444",medium:"#f59e0b",low:"#6ee7b7"};

  function addTask(){ if(!newTask.trim()) return; pg({weeklyTasks:[...weeklyTasks,{text:newTask.trim(),priority:"medium",done:false,id:Date.now()}]}); setNewTask(""); }
  function togTask(id){ pg({weeklyTasks:weeklyTasks.map(t=>t.id===id?{...t,done:!t.done}:t)}); }
  function cycP(id){ const o=["low","medium","high"]; pg({weeklyTasks:weeklyTasks.map(t=>t.id===id?{...t,priority:o[(o.indexOf(t.priority)+1)%3]}:t)}); }

  const weekXP=IDENTITIES.map(id=>{
    const logs=(store.xp?.[id.id]?.log||[]);
    const pts=logs.filter(l=>{ const d=new Date(l.date); return (new Date()-d)<7*24*3600*1000; }).reduce((s,l)=>s+l.pts,0);
    return pts>0?{...id,weekPts:pts}:null;
  }).filter(Boolean).sort((a,b)=>b.weekPts-a.weekPts);

  function saveCalEvent(evt){ pg({calEvents:[...(store.calEvents||[]),evt]}); }

  return (
    <Sec>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <SH icon="📊" title="This Week" sub="progress · tasks · XP"/>
        <button style={S.plusBtn} onClick={()=>setShowAddEvent(true)}>+</button>
      </div>

      {showAddEvent&&<AddEventModal onSave={saveCalEvent} onClose={()=>setShowAddEvent(false)}/>}

      <div style={S.card}>
        <CT>Daily log</CT>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {days.map(({k,l,checksDone,dayLabel,isToday,dow2})=>{
            const wo=WORKOUTS[DOW_DEFAULT[dow2]];
            return (
              <div key={k} style={{...S.dayCell,...(isToday?S.dayCellToday:{})}}>
                <p style={{margin:0,fontSize:9,fontWeight:700,color:isToday?C.purpleText:C.muted,textAlign:"center"}}>{dayLabel}</p>
                <p style={{margin:"4px 0 0",fontSize:16,textAlign:"center"}}>{wo?.icon||"•"}</p>
                <p style={{margin:"2px 0 0",fontSize:9,color:checksDone>0?C.green:C.border,textAlign:"center"}}>{checksDone>0?"✓":"–"}</p>
                {l.weight&&<p style={{margin:"2px 0 0",fontSize:8,color:C.muted,textAlign:"center"}}>{l.weight}lb</p>}
              </div>
            );
          })}
        </div>
      </div>

      {weekXP.length>0&&(
        <div style={S.card}>
          <CT>Identity XP this week</CT>
          {weekXP.slice(0,5).map(id=>(
            <div key={id.id} style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>{id.emoji}</span>
              <span style={{fontSize:13,color:C.text,flex:1}}>{id.name}</span>
              <span style={{fontSize:12,fontWeight:700,color:id.color}}>+{id.weekPts} XP</span>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <CT>Weekly tasks</CT>
        {weeklyTasks.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:8}}>
            <button style={S.pBadge(PC[t.priority])} onClick={()=>cycP(t.id)}>{t.priority}</button>
            <span style={{fontSize:13,color:C.text,flex:1,textDecoration:t.done?"line-through":"none",opacity:t.done?0.4:1,cursor:"pointer"}} onClick={()=>togTask(t.id)}>{t.text}</span>
          </div>
        ))}
        <div style={S.addRow}>
          <input style={S.addInput} placeholder="Add task..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()}/>
          <button style={S.addBtn} onClick={addTask}>+</button>
        </div>
      </div>

      <div style={{...S.card,borderColor:"#38bdf844"}}>
        <CT>🪁 Kite savings</CT>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}>
          <span style={{fontSize:26,fontWeight:800,color:C.text}}>${store.savings?.kite||0}</span>
          <span style={{fontSize:13,color:C.muted}}>/ $1425</span>
          <span style={{fontSize:12,fontWeight:700,color:"#38bdf8",marginLeft:"auto"}}>{Math.round(((store.savings?.kite||0)/1425)*100)}%</span>
        </div>
        <div style={S.xpBg}><div style={{...S.xpFill,width:`${Math.min(((store.savings?.kite||0)/1425)*100,100)}%`,background:"#38bdf8"}}/></div>
      </div>
    </Sec>
  );
}

// ── Identity Tab ─────────────────────────────────────────────────────────────

function IdentityTab({today,patch,store,pg}){
  const xp=store.xp||{};
  const milestones=store.milestones||{};
  const [activeId,setActiveId]=useState(today.identity||IDENTITIES[0].id);
  const [activityId,setActivityId]=useState("");
  const [customText,setCustomText]=useState("");
  const [duration,setDuration]=useState("");
  const [newMS,setNewMS]=useState("");
  const identity=IDENTITIES.find(i=>i.id===activeId);
  const myXP=xp[activeId]||{points:0,log:[]};
  const myMS=milestones[activeId]||[];
  const level=Math.floor(myXP.points/100)+1;
  const prog=myXP.points%100;

  const ACTS=[
    {id:"audiobook",label:"🎧 Audiobook",pts:10},{id:"physbook",label:"📖 Physical Book",pts:15},
    {id:"podcast",  label:"🎙️ Podcast",   pts:8}, {id:"run",   label:"🏃 Run",          pts:15},
    {id:"workout",  label:"💪 Workout",    pts:15},{id:"community",label:"🤝 Community",pts:20},
    {id:"italian",  label:"🇮🇹 Italian/Spanish",pts:12},{id:"nature",label:"🦜 Nature obs",pts:10},
    {id:"custom",   label:"✨ Custom...",  pts:10},
  ];

  function selectToday(id){patch({identity:id});setActiveId(id);}
  function logActivity(){
    const text=activityId==="custom"?customText:ACTS.find(a=>a.id===activityId)?.label||"";
    if(!text.trim()) return;
    const pts=ACTS.find(a=>a.id===activityId)?.pts||10;
    const label=duration?`${text} — ${duration} min`:text;
    pg({xp:{...xp,[activeId]:{points:myXP.points+pts,log:[{text:label,date:todayKey(),pts},...(myXP.log||[])]}}});
    setActivityId("");setCustomText("");setDuration("");
  }
  function addMS(){if(!newMS.trim()) return;pg({milestones:{...milestones,[activeId]:[...myMS,{text:newMS.trim(),done:false,id:Date.now()}]}});setNewMS("");}
  function togMS(id){pg({milestones:{...milestones,[activeId]:myMS.map(m=>m.id===id?{...m,done:!m.done}:m)}});}

  return (
    <Sec>
      <SH icon="⚡" title="ProtoCarlo" sub="choose identity · log XP · milestones"/>
      <div style={S.card}>
        <CT>Today I Am Embodying</CT>
        <div style={S.idGrid}>
          {IDENTITIES.map(id=>{
            const isToday2=today.identity===id.id; const isActive=activeId===id.id;
            const pts=xp[id.id]?.points||0;
            return (
              <button key={id.id} style={{...S.idChip,borderColor:id.color+(isToday2?"ff":isActive?"88":"33"),background:id.color+(isToday2?"33":isActive?"18":"0d"),color:id.color}} onClick={()=>selectToday(id.id)}>
                <span style={{fontSize:14}}>{id.emoji}</span>
                <span style={{fontSize:11,fontWeight:600,flex:1,lineHeight:1.2,textAlign:"left"}}>{id.name}</span>
                {pts>0&&<span style={{fontSize:9,fontWeight:800}}>Lv{Math.floor(pts/100)+1}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{...S.card,borderColor:identity.color+"55"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
          <span style={{fontSize:26}}>{identity.emoji}</span>
          <div style={{flex:1}}>
            <p style={{margin:0,fontWeight:700,color:identity.color,fontSize:16}}>{identity.name}</p>
            <p style={{margin:0,fontSize:12,color:C.muted}}>Level {level} · {myXP.points} XP</p>
          </div>
        </div>
        <div style={S.xpBg}><div style={{...S.xpFill,width:`${prog}%`,background:identity.color}}/></div>
        <p style={{margin:"3px 0 10px",fontSize:10,color:C.muted}}>{prog}/100 to Level {level+1}</p>
        <CT>Log an Activity</CT>
        <select style={S.sel} value={activityId} onChange={e=>setActivityId(e.target.value)}>
          <option value="">— select —</option>
          {ACTS.map(a=><option key={a.id} value={a.id}>{a.label} (+{a.pts})</option>)}
        </select>
        {activityId==="custom"&&<input style={S.addInput} placeholder="Describe..." value={customText} onChange={e=>setCustomText(e.target.value)}/>}
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}><label style={{fontSize:11,color:C.muted}}>Duration (min)</label><input style={S.li} type="number" value={duration} placeholder="—" onChange={e=>setDuration(e.target.value)}/></div>
          <button style={{...S.addBtn,background:identity.color}} onClick={logActivity}>Log</button>
        </div>
        {myXP.log?.slice(0,5).map((e,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"4px 0",borderTop:`1px solid ${C.border}`,alignItems:"center"}}>
            <span style={{fontSize:10,color:C.muted,minWidth:68}}>{e.date}</span>
            <span style={{fontSize:12,color:C.text,flex:1}}>{e.text}</span>
            <span style={{fontSize:11,fontWeight:700,color:identity.color}}>+{e.pts}</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <CT>Milestones — {identity.name}</CT>
        {myMS.map(m=><CR key={m.id} label={m.text} checked={m.done} onToggle={()=>togMS(m.id)} color={identity.color}/>)}
        <div style={S.addRow}>
          <input style={S.addInput} placeholder="Add milestone..." value={newMS} onChange={e=>setNewMS(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMS()}/>
          <button style={{...S.addBtn,background:identity.color}} onClick={addMS}>+</button>
        </div>
      </div>

      {activeId==="marathon"&&(
        <div style={{...S.card,borderColor:"#facc1544"}}>
          <CT>🏃 Running PRs + Targets</CT>
          {Object.entries(FITNESS_BASELINES).map(([key,v])=>(
            <div key={key} style={{display:"flex",flexDirection:"column",gap:2,padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,fontWeight:700,color:"#facc15",minWidth:70,textTransform:"uppercase",letterSpacing:"0.04em"}}>{key.replace("_"," ")}</span>
                <span style={{fontSize:13,color:C.text,flex:1}}>{v.current}</span>
                <span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>→ {v.target_3mo}</span>
              </div>
              {v.pr_date&&<span style={{fontSize:10,color:C.muted,marginLeft:78}}>{v.pr_date}</span>}
            </div>
          ))}
          <div style={{...S.card,borderColor:"#f8717144",background:"#f871710d",marginTop:4}}>
            <p style={{margin:0,fontSize:12,color:"#f87171",fontWeight:600}}>⚠️ Fueling reminder</p>
            <p style={{margin:"4px 0 0",fontSize:12,color:C.muted}}>Gel every 45 min starting at mile 3 — you hit the wall at 13.91 on Mar 7 because of this. Practice on every run over 10 miles.</p>
          </div>
          <p style={{margin:0,fontSize:11,color:C.muted,fontStyle:"italic"}}>Miami Marathon 2027 — target: sub-5:00, ideally 4:45</p>
        </div>
      )}
    </Sec>
  );
}

// ── Journal Tab ──────────────────────────────────────────────────────────────

function JournalTab({today,patch,store,pg,storeKey}){
  const log=today.log||{};
  const wd=today.wd||{};
  const [copied,setCopied]=useState(false);
  const readingList=store.readingList||DEFAULT_READING;
  const [bookFilter,setBookFilter]=useState("all");
  const [showAddBook,setShowAddBook]=useState(false);
  const [newBook,setNewBook]=useState({title:"",author:"",type:"audiobook"});
  const [sInput,setSInput]=useState("");

  function setLog(k,v){patch({log:{...log,[k]:v}});}
  function setWd(k,v){patch({wd:{...wd,[k]:v}});}
  function cycleStatus(id){
    const order=["to-read","reading","done"];
    pg({readingList:readingList.map(b=>b.id===id?{...b,status:order[(order.indexOf(b.status)+1)%3]}:b)});
  }
  function addBook(){
    if(!newBook.title.trim()) return;
    pg({readingList:[...readingList,{...newBook,id:Date.now().toString(),status:"to-read"}]});
    setNewBook({title:"",author:"",type:"audiobook"}); setShowAddBook(false);
  }
  function addSaving(){
    const prev=store.savings?.kite||0; const amt=Number(sInput);
    if(!amt) return;
    pg({savings:{...(store.savings||{}),kite:Math.min(prev+amt,1425)}}); setSInput("");
  }
  function copyExport(){
    const txt=buildCoachingExport(store,today);
    navigator.clipboard.writeText(txt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  }

  const filtered=bookFilter==="all"?readingList:readingList.filter(b=>b.type===bookFilter||b.status===bookFilter);
  const statusColor={reading:"#38bdf8","to-read":C.muted,done:"#4ade80"};
  const statusIcon={reading:"📖","to-read":"📋",done:"✅"};

  return (
    <Sec>
      <SH icon="✍️" title="Journal" sub="reflection · reading · coaching"/>

      <div style={S.card}>
        <CT>Morning Journal</CT>
        <JF label="Grateful for" value={log.grateful||""} onChange={v=>setLog("grateful",v)}/>
        <JF label="Enjoyed yesterday" value={log.enjoyed||""} onChange={v=>setLog("enjoyed",v)}/>
        <JF label="Goals / intentions" value={log.jGoals||""} onChange={v=>setLog("jGoals",v)}/>
      </div>

      <div style={S.card}>
        <CT>Evening Reflection</CT>
        <div style={S.grid2}>
          <LI label="Day (1–5)" value={wd.rating||""} onChange={v=>setWd("rating",v)} type="number" ph="—"/>
          <LI label="Anger moment?" value={wd.anger||""} onChange={v=>setWd("anger",v)} type="text" ph="yes/no"/>
        </div>
        <JF label="Stoic reframe" value={wd.angerNote||""} onChange={v=>setWd("angerNote",v)}/>
        <JF label="Proud of today" value={wd.proud||""} onChange={v=>setWd("proud",v)}/>
        <JF label="Tomorrow's top 3" value={wd.tomorrow||""} onChange={v=>setWd("tomorrow",v)}/>
      </div>

      <div style={S.card}>
        <CT>Reading List</CT>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all","audiobook","physical","reading","to-read","done"].map(f=>(
            <button key={f} style={{...S.filterChip,...(bookFilter===f?S.filterActive:{})}} onClick={()=>setBookFilter(f)}>{f}</button>
          ))}
        </div>
        {filtered.map(b=>(
          <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
            <div style={{flex:1}}>
              <p style={{margin:0,fontSize:14,fontWeight:600,color:C.text}}>{b.title}</p>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>{b.author} · {b.type==="audiobook"?"🎧":"📖"}</p>
            </div>
            <button style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:6,border:`1px solid ${statusColor[b.status]}44`,color:statusColor[b.status],background:statusColor[b.status]+"11",cursor:"pointer",whiteSpace:"nowrap"}} onClick={()=>cycleStatus(b.id)}>
              {statusIcon[b.status]} {b.status}
            </button>
          </div>
        ))}
        {!showAddBook&&<button style={S.ghostBtn} onClick={()=>setShowAddBook(true)}>+ Add book</button>}
        {showAddBook&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <LI label="Title" value={newBook.title} onChange={v=>setNewBook({...newBook,title:v})} type="text" ph="Title" wide/>
            <LI label="Author" value={newBook.author} onChange={v=>setNewBook({...newBook,author:v})} type="text" ph="Author" wide/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.tBtn,...(newBook.type==="audiobook"?S.tActive:{})}} onClick={()=>setNewBook({...newBook,type:"audiobook"})}>🎧</button>
              <button style={{...S.tBtn,...(newBook.type==="physical"?S.tActive:{})}} onClick={()=>setNewBook({...newBook,type:"physical"})}>📖</button>
            </div>
            <div style={S.addRow}>
              <button style={{...S.addBtn,flex:1,width:"auto",fontSize:13}} onClick={addBook}>Add</button>
              <button style={{...S.addBtn,background:C.border,flex:1,width:"auto",fontSize:13}} onClick={()=>setShowAddBook(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{...S.card,borderColor:"#38bdf844"}}>
        <CT>🪁 Kite savings</CT>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}>
          <span style={{fontSize:26,fontWeight:800,color:C.text}}>${store.savings?.kite||0}</span>
          <span style={{fontSize:13,color:C.muted}}>/ $1425</span>
          <span style={{fontSize:12,fontWeight:700,color:"#38bdf8",marginLeft:"auto"}}>{Math.round(((store.savings?.kite||0)/1425)*100)}%</span>
        </div>
        <div style={S.xpBg}><div style={{...S.xpFill,width:`${Math.min(((store.savings?.kite||0)/1425)*100,100)}%`,background:"#38bdf8"}}/></div>
        <div style={{...S.addRow,marginTop:6}}>
          <input style={S.addInput} type="number" placeholder="Add $" value={sInput} onChange={e=>setSInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSaving()}/>
          <button style={{...S.addBtn,background:"#38bdf8"}} onClick={addSaving}>+</button>
        </div>
      </div>

      <div style={{...S.card,borderColor:C.purple+"55",background:C.purple+"08"}}>
        <CT>📤 Weekly Coaching Export</CT>
        <p style={{margin:0,fontSize:12,color:C.muted,lineHeight:1.5}}>Tap to copy your week's data. Paste into this project for coaching — no questions, straight to insights.</p>
        <button style={{...S.bigBtn,background:copied?"#4ade80":C.purple,color:copied?"#0a1f0f":"#fff",marginTop:8}} onClick={copyExport}>
          {copied?"✓ Copied!":"📋 Copy Weekly Summary"}
        </button>
      </div>
    </Sec>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

function Sec({children}){return <div style={S.sec}>{children}</div>;}
function SH({icon,title,sub}){
  return <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:26}}>{icon}</span><div><h2 style={S.sh1}>{title}</h2>{sub&&<p style={S.sh2}>{sub}</p>}</div></div>;
}
function CT({children}){return <p style={S.ct}>{children}</p>;}
function CR({label,checked,onToggle,color="#7c6bff",big}){
  return (
    <button style={{...S.cr,...(big?{padding:"8px 0"}:{})}} onClick={onToggle}>
      <span style={{...S.cbox,...(big?{width:26,height:26,borderRadius:8}:{}),...(checked?{background:color,borderColor:color}:{})}}>{checked&&<span style={{color:"#fff",fontSize:big?14:11,fontWeight:800}}>✓</span>}</span>
      <span style={{fontSize:big?15:14,color:checked?C.muted:C.text,textDecoration:checked?"line-through":"none",textAlign:"left",lineHeight:1.4}}>{label}</span>
    </button>
  );
}
function LI({label,value,onChange,type,ph,wide}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:wide?"span 2":undefined}}>
      <label style={{fontSize:11,color:C.muted}}>{label}</label>
      <input style={S.li} type={type} value={value} placeholder={ph} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
}
function JF({label,value,onChange}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <label style={{fontSize:11,color:C.muted}}>{label}</label>
      <textarea style={S.jf} rows={3} value={value} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
}
function ProgressRing({pct,color,size}){
  const r=size/2-4; const circ=2*Math.PI*r; const dash=circ*(pct/100);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={3}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
    </svg>
  );
}

// ── Design ───────────────────────────────────────────────────────────────────

const C={bg:"#0d0d12",surface:"#13131b",card:"#191921",border:"#23233a",purple:"#7c6bff",purpleFaint:"#7c6bff18",purpleText:"#a89fff",green:"#6ee7b7",greenBg:"#0a1f0f",greenBorder:"#1a3a1f",text:"#eaeaf4",muted:"#55556a"};

const S={
  root:{background:C.bg,minHeight:"100vh",display:"flex",justifyContent:"center",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"},
  app:{width:"100%",maxWidth:500,display:"flex",flexDirection:"column",minHeight:"100vh"},
  hdr:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10},
  logo:{fontSize:17,fontWeight:800,letterSpacing:"0.28em",color:C.purpleText},
  main:{flex:1,overflowY:"auto",paddingBottom:72},
  sec:{padding:"16px",display:"flex",flexDirection:"column",gap:14},
  sh1:{margin:0,fontSize:20,fontWeight:700,color:C.text,letterSpacing:"-0.02em"},
  sh2:{margin:"2px 0 0",fontSize:12,color:C.muted},
  card:{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:10},
  ct:{margin:0,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.muted},
  grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},
  li:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:15,fontWeight:600,outline:"none",width:"100%",boxSizing:"border-box"},
  jf:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:14,outline:"none",resize:"vertical",fontFamily:"inherit",lineHeight:1.6},
  jfBig:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",color:C.text,fontSize:15,outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.7,width:"100%",boxSizing:"border-box"},
  cr:{display:"flex",alignItems:"flex-start",gap:10,background:"none",border:"none",cursor:"pointer",padding:"3px 0",textAlign:"left",width:"100%"},
  cbox:{width:20,height:20,borderRadius:6,border:`2px solid ${C.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1,transition:"all 0.15s"},
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:500,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:20},
  navBtn:{flex:1,background:"none",border:"none",cursor:"pointer",padding:"10px 2px 12px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:C.muted},
  navActive:{color:C.purpleText},
  navLabel:{fontSize:9,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"},
  bigGreenBtn:{background:"#0f2a1a",border:"2px solid #4ade80",borderRadius:16,padding:"20px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,cursor:"pointer",width:"100%",color:"#4ade80"},
  bigBtn:{background:C.purple,border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",width:"100%",transition:"background 0.2s"},
  plusBtn:{background:C.purple,border:"none",borderRadius:10,width:36,height:36,fontSize:22,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:300},
  wizard:{display:"flex",flexDirection:"column",padding:"0 16px 16px",minHeight:"calc(100vh - 60px)"},
  wizProgress:{display:"flex",gap:6,alignItems:"center"},
  wizDot:{width:8,height:8,borderRadius:"50%",background:C.border,transition:"background 0.3s",padding:0},
  wizStep:{flex:1,display:"flex",flexDirection:"column",paddingTop:8},
  wizEmoji:{fontSize:48,textAlign:"center",marginBottom:8},
  wizTitle:{margin:0,fontSize:24,fontWeight:800,color:C.text,textAlign:"center",letterSpacing:"-0.03em"},
  wizSub:{margin:"8px 0 0",fontSize:14,color:C.muted,textAlign:"center"},
  wizNav:{display:"flex",gap:8,paddingTop:16,paddingBottom:8,alignItems:"center"},
  wizBack:{background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",color:C.muted,fontSize:14,cursor:"pointer"},
  wizNextBtn:{background:C.purple,border:"none",borderRadius:10,padding:"12px 24px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"},
  skipStepBtn:{background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",color:C.muted,fontSize:14,cursor:"pointer"},
  skipAllBtn:{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"4px 8px"},
  toggle:{display:"flex",gap:8},
  tBtn:{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:8,color:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"},
  tActive:{background:C.purpleFaint,border:`1px solid ${C.purple}`,color:C.purpleText},
  block:{display:"flex",gap:12,padding:"10px 12px",borderRadius:10,background:C.card,border:`1px solid ${C.border}`,alignItems:"flex-start"},
  blockNow:{border:`1px solid ${C.purple}`,background:C.purpleFaint},
  blockGreen:{border:`1px solid ${C.greenBorder}`,background:C.greenBg},
  bTime:{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:42},
  bTL:{fontSize:11,fontWeight:700,color:C.muted,fontVariantNumeric:"tabular-nums"},
  nowPill:{fontSize:8,fontWeight:800,color:C.purple,background:C.purpleFaint,borderRadius:4,padding:"1px 4px"},
  nowPillLarge:{fontSize:10,fontWeight:800,color:C.purple,background:C.purpleFaint,borderRadius:6,padding:"3px 8px",letterSpacing:"0.08em"},
  bBody:{flex:1,display:"flex",flexDirection:"column",gap:4},
  bDesc:{margin:0,fontSize:12,color:C.muted},
  tInput:{background:"transparent",border:"none",borderBottom:`1px solid ${C.border}`,padding:"2px 0",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",width:"100%"},
  idGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7},
  idChip:{display:"flex",alignItems:"center",gap:6,padding:"7px 9px",borderRadius:10,border:"1.5px solid",cursor:"pointer",background:"none"},
  xpBg:{height:5,background:C.border,borderRadius:99,overflow:"hidden",width:"100%"},
  xpFill:{height:"100%",borderRadius:99,transition:"width 0.4s ease"},
  sel:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:14,outline:"none",width:"100%",fontFamily:"inherit"},
  addRow:{display:"flex",gap:8},
  addInput:{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit"},
  addBtn:{background:C.purple,border:"none",borderRadius:8,color:"#fff",fontSize:20,width:36,cursor:"pointer",fontWeight:700,flexShrink:0},
  ghostBtn:{background:"none",border:`1px dashed ${C.border}`,borderRadius:8,color:C.muted,fontSize:13,padding:"8px",cursor:"pointer",width:"100%"},
  pBadge:(color)=>({background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",padding:"2px 7px",cursor:"pointer",minWidth:52,flexShrink:0}),
  filterChip:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 10px",fontSize:11,color:C.muted,cursor:"pointer"},
  filterActive:{borderColor:C.purple,color:C.purpleText,background:C.purpleFaint},
  microBtn:{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,border:"1px solid",cursor:"pointer",background:"none"},
  movCard:{display:"flex",alignItems:"center",gap:14,padding:"14px",borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",width:"100%",textAlign:"left"},
  movCardActive:{borderColor:C.purple,background:C.purpleFaint},
  listenCard:{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",width:"100%",textAlign:"left"},
  listenActive:{borderColor:C.purple,background:C.purpleFaint},
  goalChip:{display:"flex",alignItems:"center",padding:"10px 12px",borderRadius:10,border:"1px solid"},
  dayCell:{background:C.surface,borderRadius:8,padding:"6px 2px",border:`1px solid ${C.border}`},
  dayCellToday:{borderColor:C.purple,background:C.purpleFaint},
  modalBg:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{background:C.card,borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:500,border:`1px solid ${C.border}`},
};
