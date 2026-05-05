import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import workoutSpec from "./workoutSpec.json";

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
fbProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
fbProvider.setCustomParameters({prompt: 'consent'});

const GCAL_TOKEN_KEY = 'carlo_gcal_token';
function getStoredGCalToken(){
  try{
    const raw = localStorage.getItem(GCAL_TOKEN_KEY);
    if(!raw) return null;
    const {token, expiry} = JSON.parse(raw);
    if(!token || Date.now() > expiry) return null;
    return token;
  }catch{ return null; }
}
function setStoredGCalToken(token){
  if(!token){ localStorage.removeItem(GCAL_TOKEN_KEY); return; }
  // Google access tokens last ~1 hour; conservatively use 50 min
  const expiry = Date.now() + 50*60*1000;
  localStorage.setItem(GCAL_TOKEN_KEY, JSON.stringify({token, expiry}));
}

async function fetchGCalEvents(){
  const token = getStoredGCalToken();
  if(!token) return {events:null, error:'NO_TOKEN'};
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7*24*60*60*1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: weekLater.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  try{
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } });
    if(resp.status === 401){
      setStoredGCalToken(null);
      return {events:null, error:'EXPIRED'};
    }
    if(!resp.ok) return {events:null, error:`HTTP_${resp.status}`};
    const data = await resp.json();
    const items = (data.items || []).map(e => {
      const startObj = e.start || {};
      const endObj   = e.end   || {};
      const startISO = startObj.dateTime || startObj.date;
      const endISO   = endObj.dateTime   || endObj.date;
      const d = new Date(startISO);
      const isAllDay = !startObj.dateTime;
      const endD = endISO ? new Date(endISO) : new Date(d.getTime() + 30*60*1000);
      const dateLabel = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
      const timeLabel = isAllDay
        ? 'All day'
        : `${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} – ${endD.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;
      return {
        id: 'gcal_'+e.id,
        title: e.summary || '(untitled)',
        date: dateLabel,
        time: timeLabel,
        cal: 'GCal',
        color: '#a89fff',
        isGcal: true,
        isAllDay,
        startISO,
        endISO,
        startMs: d.getTime(),
        endMs: endD.getTime(),
      };
    });
    return {events: items, error: null};
  }catch(err){
    return {events:null, error: err.message||'FETCH_FAILED'};
  }
}

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

// ── Workout spec resolution ──────────────────────────────────────────────────
const DOW_NAMES=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function getTodaysWorkoutFromSpec(date){
  const d=date||new Date();
  const dayKey=d.toISOString().split("T")[0];
  const dowName=DOW_NAMES[d.getDay()];
  let templateRef=null, scheduleEntry=null;
  if(workoutSpec.schedule && workoutSpec.schedule[dayKey]){
    scheduleEntry=workoutSpec.schedule[dayKey];
    templateRef=scheduleEntry.templateRef;
  } else if(workoutSpec.dayDefaults && workoutSpec.dayDefaults[dowName]){
    scheduleEntry=workoutSpec.dayDefaults[dowName];
    templateRef=scheduleEntry.templateRef;
  }
  if(!templateRef||!workoutSpec.templates[templateRef]) return null;
  const template=workoutSpec.templates[templateRef];
  return {
    ...template,
    label: scheduleEntry.label||null,
    distance: scheduleEntry.distance||template.distance||null,
    pace: scheduleEntry.pace||null,
    templateRef,
    dowName,
  };
}

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
  // No work blocks on weekends (Carlo works Mon-Fri only)
  if(dow===0||dow===6) return [];
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
  {time:"6:00", label:"Wake up / open CARLO"},
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
  { id:"chinese", icon:"🌀", label:"Chinese Medicine", desc:"~5 min · lymphatic activation",
    exercises:["50 lymphatic jumps","Tap chest, head, arms, legs (1 min)","Shake out wrists & ankles (30 sec)","Tongue circles 10 each direction","Deep belly breaths × 10"] },
  { id:"prerun",  icon:"🏃", label:"Pre-Run Warmup",   desc:"~5 min · dynamic, run-ready",
    exercises:["10 hip circles each direction","10 leg swings front-back each leg","10 leg swings side-side each leg","10 walking knee hugs","10 walking quad pulls","20 walking lunges","Light jog 30 sec"] },
  { id:"lazy",    icon:"🧘", label:"Lazy Stretch",     desc:"~15 min · hip + spine recovery",
    exercises:["Pigeon pose 1 min each side","Couch stretch 1 min each side","Supine spinal twist 1 min each side","Cat-cow 10 reps","Forward fold 1 min","Child's pose 1 min","Reclined butterfly 1 min"] },
  { id:"skip",    icon:"⏭️", label:"Skip today",       desc:"Straight to the gym",
    exercises:[] },
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

const GOAL_SUBCATS = {
  personal: ["Family","Health","House","Friends","Fun","Errand"],
  work:     ["OC","FOX","TSN","ATH","OA","MXM","Other"],
};
function subcatColor(type){ return type==="professional"||type==="work"?"#60a5fa":"#4ade80"; }

const DEFAULT_ACTIVITIES = [
  {id:"audiobook", label:"🎧 Audiobook",         pts:10},
  {id:"physbook",  label:"📖 Physical Book",     pts:15},
  {id:"podcast",   label:"🎙️ Podcast",           pts:8},
  {id:"run",       label:"🏃 Run",               pts:15},
  {id:"workout",   label:"💪 Workout",           pts:15},
  {id:"community", label:"🤝 Community",         pts:20},
  {id:"italian",   label:"🇮🇹 Italian/Spanish",   pts:12},
  {id:"nature",    label:"🦜 Nature obs",        pts:10},
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
function signInGoogle(){
  signInWithPopup(fbAuth, fbProvider).then(result => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential && credential.accessToken;
    if(token) setStoredGCalToken(token);
  }).catch(e => alert("Sign-in failed: " + e.message));
}
function signOutNow(){ setStoredGCalToken(null); signOut(fbAuth).catch(e => console.warn(e)); }

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
      if(typeof parsed!=="object"||parsed===null||Array.isArray(parsed)) throw new Error("Not a valid CARLO backup file");
      if(!window.confirm("This will REPLACE all your current CARLO data with the contents of the backup file. Continue?")) return;
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

// Convert "13:00" → "1:00 PM", "9:00" → "9:00 AM"
function format12h(t){
  if(!t||typeof t!=="string"||!t.includes(":")) return t||"";
  const [hStr,mStr]=t.split(":");
  let h=parseInt(hStr,10);
  if(isNaN(h)) return t;
  const ampm=h>=12?"PM":"AM";
  if(h===0) h=12;
  else if(h>12) h=h-12;
  return `${h}:${mStr} ${ampm}`;
}
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
  const dow=new Date().getDay();
  if(dow===0||dow===6){
    // Weekend — no work pressure
    if(total<540) return {text:"Weekend morning. Move at your pace.",urgent:false};
    if(total<720) return {text:"Open weekend day. Pick something restorative.",urgent:false};
    return {text:"Enjoy the weekend.",urgent:false};
  }
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
  const lines=[
    `=CARLO COACHING ${new Date().toDateString()}=`,
    ``,
    `VITALS (last 7 days):`,
    ...days,
    ``,
    `ACTIVE GOALS:`,
    activeGoals||"  none",
    ``,
    `XP THIS WEEK: ${idXP||"none"}`,
    ``,
    `KITE SAVINGS: $${savings.kite||0} / $1425`,
    ``,
    `CURRENT BOOK: ${currentBook?`${currentBook.title} (${currentBook.type})`:"none"}`,
    ``,
    `WEEKLY TASKS:`,
    weeklyTasks.filter(t=>!t.done).map(t=>`  [${t.priority}] ${t.text}`).join("\n")||"  none",
    ``,
    `=END=`,
  ];
  return lines.join("\n");
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function App(){
  const [store,setStore]=useState(load);
  const [tab,setTab]=useState("home");
  const [time,setTime]=useState(liveTime());
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [gcalEvents,setGcalEvents]=useState([]);
  const [gcalSyncing,setGcalSyncing]=useState(false);
  const [gcalLastSync,setGcalLastSync]=useState(null);
  const [gcalError,setGcalError]=useState(null);
  const skipNextCloudWrite=useRef(false);
  const key=todayKey();
  const dow=todayDow();
  const today=store[key]||{};

  async function syncGCal(silent=false){
    setGcalSyncing(true);
    if(!silent) setGcalError(null);
    const {events, error} = await fetchGCalEvents();
    setGcalSyncing(false);
    if(error){
      if(!silent) {
        setGcalError(error);
        if(error==='NO_TOKEN' || error==='EXPIRED'){
          alert("Google Calendar access not granted (or expired).\n\nTap ☁ to sign out, then Sign in again. Make sure to tap ALLOW on the Google consent screen that says 'View your calendars'.");
        } else {
          alert("GCal sync failed: " + error);
        }
      }
      return;
    }
    setGcalEvents(events||[]);
    setGcalLastSync(Date.now());
    setGcalError(null);
    if(!silent && (events||[]).length===0){
      alert("Synced — but no upcoming events found in your primary Google Calendar for the next 7 days.");
    }
  }

  useEffect(()=>{ const iv=setInterval(()=>setTime(liveTime()),30000); return()=>clearInterval(iv); },[]);
  useEffect(()=>{
    const n={...store}; let dirty=false;
    if(!store.readingList){n.readingList=DEFAULT_READING;dirty=true;}
    if(!store.calEvents){n.calEvents=[];dirty=true;}
    // One-time cleanup: remove the demo events that were seeded into earlier installs
    if(store.calEvents && store.calEvents.some(e=>e.id==="hamburger"||e.id==="telehealth")){
      n.calEvents=(store.calEvents||[]).filter(e=>e.id!=="hamburger" && e.id!=="telehealth");
      dirty=true;
    }
    if(!store.goals){n.goals=[];dirty=true;}
    if(!store.activities){n.activities=DEFAULT_ACTIVITIES;dirty=true;}
    if(!store.milestones?.marathon){ n.milestones={...(store.milestones||{}),marathon:MARATHON_MILESTONES}; dirty=true; }
    if(dirty){setStore(n);save(n);}
  },[]);

  // Firebase Auth listener
  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,(u)=>{ setUser(u); setAuthReady(true); });
    return ()=>unsub();
  },[]);

  // Auto-sync GCal on user change if token exists
  useEffect(()=>{
    if(user && getStoredGCalToken()){ syncGCal(true); }
  },[user]);

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
    {id:"day",      icon:"📅", label:"Day"},
    {id:"week",     icon:"📊", label:"Week"},
    {id:"home",     icon:"🏠", label:"Home"},
    {id:"identity", icon:"⚡", label:"Identity"},
    {id:"journal",  icon:"✍️",  label:"Journal"},
  ];

  return (
    <div style={S.root}>
      <div style={S.app}>
        <header style={S.hdr}>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1}}>
            <span style={S.logo}>CARLO</span>
            <span style={{fontSize:8,color:C.muted,letterSpacing:"0.12em",fontWeight:600,marginTop:2}}>COMMIT · ACT · REFLECT · LEARN · OPTIMIZE</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {authReady && (user ? (
                <>
                  <button
                    onClick={()=>syncGCal(false)}
                    disabled={gcalSyncing}
                    title={gcalLastSync?`${gcalEvents.length} GCal events · synced ${new Date(gcalLastSync).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} · tap to refresh`:"Tap to sync Google Calendar"}
                    style={{background:gcalError?"#3a1a1a":"transparent",border:`1px solid ${gcalError?"#f87171":"#a89fff66"}`,color:gcalError?"#f87171":"#a89fff",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:gcalSyncing?"wait":"pointer",fontWeight:600,opacity:gcalSyncing?0.6:1}}
                  >{gcalSyncing?"⟳":gcalLastSync?`📅 ${gcalEvents.length}`:"📅 GCal"}</button>
                  <button
                    onClick={signOutNow}
                    title={`Synced as ${user.email}. Click to sign out.`}
                    style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}
                  >☁</button>
                </>
              ) : (
                <button
                  onClick={signInGoogle}
                  title="Sign in with Google to sync your data and calendar"
                  style={{background:C.purpleFaint,border:`1px solid ${C.purple}`,color:C.purpleText,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}
                >Sign in</button>
              ))}
              <button
                onClick={exportBackup}
                title="Download a JSON backup of all your CARLO data"
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
          {tab==="home"     && <HomeTab     today={today} patch={pt} store={store} pg={pg} dow={dow} gcalEvents={gcalEvents}/>}
          {tab==="day"      && <DayTab      today={today} patch={pt} store={store} pg={pg} dow={dow} gcalEvents={gcalEvents}/>}
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
  {id:"yesterday", title:"Yesterday's goals",          emoji:"📋"},
  {id:"checklist", title:"Morning checklist",          emoji:"✅"},
  {id:"movement",  title:"Pre-workout activation",     emoji:"🌀"},
  {id:"workout",   title:"Time to move.",              emoji:"💪"},
  {id:"grateful",  title:"Gratitude — post-workout",   emoji:"🙏"},
  {id:"enjoyed",   title:"What did you enjoy yesterday?", emoji:"😊"},
  {id:"goals",     title:"Today's goals",              emoji:"🎯"},
  {id:"vitals",    title:"Quick vitals",               emoji:"📊"},
  {id:"personas",  title:"Pick today's persona",       emoji:"🎭"},
  {id:"overview",  title:"You're set.",                emoji:"🚀"},
];

function MorningWizard({today, patch, store, pg, onComplete, onSkipAll}){
  const todayK=todayKey();
  const yesterdayK=(()=>{ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().split("T")[0]; })();
  const [step,setStep]=useState(()=>typeof today.morningStep==='number'?today.morningStep:0);
  const dow=todayDow();
  const woId=today.workout||suggestWorkout(dow);
  const wo=WORKOUTS[woId];
  const todaysSpecWorkout=getTodaysWorkoutFromSpec(new Date());
  const checks=today.checks||{};
  const log=today.log||{};
  const movementChecks=today.movementChecks||{};
  const [grateful,setGrateful]=useState(log.grateful||"");
  const [enjoyed,setEnjoyed]=useState(log.enjoyed||"");
  const [jGoals,setJGoals]=useState(log.jGoals||"");
  const [movement,setMovement]=useState(today.movement||"");
  const [newGoalText,setNewGoalText]=useState("");
  const [newGoalType,setNewGoalType]=useState("personal");
  const [newGoalSubcat,setNewGoalSubcat]=useState("");
  const [showAddGoal,setShowAddGoal]=useState(false);
  const [selectedListening,setSelectedListening]=useState(0);
  const goals=store.goals||[];
  // Today's open goals — created today or scheduled for today
  const todayGoals=goals.filter(g=>!g.done && (g.created===todayK || g.scheduledDate===todayK));
  // Yesterday's still-open goals (review at start of day)
  const yesterdayGoals=goals.filter(g=>!g.done && (g.created===yesterdayK || g.scheduledDate===yesterdayK));
  const greeting=getTimeGreeting();
  const listenOptions=getListeningSuggestions(woId, store.readingList);
  const movementChoice=MOVEMENT_OPTIONS.find(m=>m.id===movement);

  function tog(item){patch({checks:{...checks,[item]:!checks[item]}});}
  function togMovement(item){patch({movementChecks:{...movementChecks,[item]:!movementChecks[item]}});}
  function setLog(k,v){patch({log:{...log,[k]:v}});}
  function addGoal(){
    if(!newGoalText.trim()) return;
    pg({goals:[...goals,{id:Date.now(),text:newGoalText.trim(),type:newGoalType,subcategory:newGoalSubcat||null,done:false,created:todayK}]});
    setNewGoalText(""); setNewGoalSubcat(""); setShowAddGoal(false);
  }
  function completeYesterdayGoal(id){ pg({goals:goals.map(g=>g.id===id?{...g,done:true}:g)}); }
  function carryOverGoal(id){ pg({goals:goals.map(g=>g.id===id?{...g,created:todayK,scheduledDate:null,scheduledTime:null}:g)}); }
  function dropYesterdayGoal(id){ pg({goals:goals.filter(g=>g.id!==id)}); }
  function pauseAndExit(){
    patch({log:{...log,grateful,enjoyed,jGoals},movement,morningStep:step});
    onComplete();
  }
  function finish(){
    patch({log:{...log,grateful,enjoyed,jGoals},movement,morningDone:true,morningStep:WIZARD_STEPS.length-1});
    onComplete();
  }
  function next(){
    if(step<WIZARD_STEPS.length-1){
      const s2=step+1; setStep(s2); patch({morningStep:s2});
    }
  }
  function back(){
    if(step>0){
      const s2=step-1; setStep(s2); patch({morningStep:s2});
    }
  }
  function jumpTo(i){ setStep(i); patch({morningStep:i}); }

  const morningChecksDone=MORNING_CHECKS.filter(c=>checks[c]).length;
  const isLast=step===WIZARD_STEPS.length-1;

  return (
    <div style={S.wizard}>
      {/* Header with skip all */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 4px"}}>
        <div style={S.wizProgress}>
          {WIZARD_STEPS.map((_,i)=>(
            <button key={i} style={{...S.wizDot,...(i<=step?{background:C.purple}:{}),cursor:"pointer",border:"none"}} onClick={()=>jumpTo(i)}/>
          ))}
        </div>
        <button style={S.skipAllBtn} onClick={onSkipAll}>Skip all →</button>
      </div>

      {/* Step content */}
      <div style={S.wizStep}>
        <div style={S.wizEmoji}>{WIZARD_STEPS[step].emoji}</div>
        <h2 style={S.wizTitle}>{WIZARD_STEPS[step].title}</h2>

        {/* Step 0: Yesterday review */}
        {step===0&&(
          <>
            {yesterdayGoals.length===0 ? (
              <p style={{...S.wizSub,marginTop:16}}>No open goals from yesterday. Clean slate.</p>
            ) : (
              <>
                <p style={S.wizSub}>{yesterdayGoals.length} open goal{yesterdayGoals.length===1?"":"s"} from yesterday. Mark done, carry over, or drop.</p>
                <div style={{...S.card,marginTop:16,display:"flex",flexDirection:"column",gap:6}}>
                  {yesterdayGoals.map(g=>(
                    <div key={g.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
                      <span style={{fontSize:14}}>{g.type==="professional"?"💼":"🌿"}</span>
                      <span style={{fontSize:13,color:C.text,flex:1}}>{g.text}</span>
                      <button onClick={()=>completeYesterdayGoal(g.id)} title="Mark done" style={{background:"#4ade8022",border:"1px solid #4ade8055",borderRadius:4,color:"#4ade80",fontSize:11,fontWeight:700,padding:"4px 8px",cursor:"pointer"}}>✓</button>
                      <button onClick={()=>carryOverGoal(g.id)} title="Carry over to today" style={{background:"#fbbf2422",border:"1px solid #fbbf2455",borderRadius:4,color:"#fbbf24",fontSize:11,fontWeight:700,padding:"4px 8px",cursor:"pointer"}}>↻</button>
                      <button onClick={()=>dropYesterdayGoal(g.id)} title="Drop" style={{background:"transparent",border:"none",color:C.muted,fontSize:14,cursor:"pointer",padding:"2px 4px"}}>✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Step 1: Checklist */}
        {step===1&&(
          <>
            <p style={S.wizSub}>{morningChecksDone}/{MORNING_CHECKS.length} done</p>
            <div style={{...S.card,marginTop:16,gap:14}}>
              {MORNING_CHECKS.map(item=><CR key={item} label={item} checked={!!checks[item]} onToggle={()=>tog(item)} big/>)}
            </div>
            {todaysSpecWorkout
              ? <WorkoutCard workout={todaysSpecWorkout}/>
              : (
                <div style={{...S.card,marginTop:12,borderColor:C.purple+"55",background:C.purple+"0d"}}>
                  <p style={{margin:0,fontSize:12,fontWeight:700,color:C.purpleText}}>💪 Today's workout</p>
                  <p style={{margin:"4px 0 0",fontSize:15,fontWeight:600,color:C.text}}>{wo?.icon} {wo?.label} · ~{wo?.duration} min</p>
                </div>
              )}
          </>
        )}

        {/* Step 2: Pre-workout activation with sub-checklist */}
        {step===2&&(
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
            {movementChoice && movementChoice.exercises && movementChoice.exercises.length>0 && (
              <div style={{...S.card,marginTop:8,borderColor:C.purple+"66",background:C.purple+"0a"}}>
                <CT>{movementChoice.label} — exercises</CT>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {movementChoice.exercises.map(ex=>(
                    <CR key={ex} label={ex} checked={!!movementChecks[ex]} onToggle={()=>togMovement(ex)} color={C.purple}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Workout pause — "Enjoy your workout, Carlo!" */}
        {step===3&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:8}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:64,lineHeight:1}}>💪</div>
              <h2 style={{fontSize:24,fontWeight:800,color:C.text,margin:"4px 0 0",letterSpacing:"-0.02em"}}>Enjoy your workout, Carlo!</h2>
            </div>
            {todaysSpecWorkout
              ? <WorkoutCard workout={todaysSpecWorkout}/>
              : <p style={{fontSize:14,color:C.muted,textAlign:"center",margin:"4px 0 0",lineHeight:1.5}}>{wo?.icon} {wo?.label} · ~{wo?.duration} min</p>
            }
            <p style={{fontSize:13,color:C.muted,margin:"4px 8px 0",lineHeight:1.5,textAlign:"center"}}>Close the app, go crush it. Tap GOOD MORNING again when you're back — we'll pick up here.</p>
            <button onClick={pauseAndExit} style={{background:"#0f2a1a",border:"3px solid #4ade80",borderRadius:14,padding:"18px 24px",color:"#4ade80",fontSize:16,fontWeight:800,cursor:"pointer",width:"100%",marginTop:4}}>⏸  PAUSE &amp; EXIT</button>
            <p style={{fontSize:11,color:C.muted,margin:"4px 0 0",textAlign:"center"}}>(Or tap "Next →" if you've already worked out)</p>
          </div>
        )}

        {/* Step 4: Grateful (post-workout) */}
        {step===4&&(
          <textarea style={{...S.jfBig,marginTop:20}} rows={7} value={grateful} onChange={e=>setGrateful(e.target.value)} placeholder="Post-workout: today I'm grateful for..."/>
        )}

        {/* Step 5: Enjoyed yesterday */}
        {step===5&&(
          <textarea style={{...S.jfBig,marginTop:20}} rows={7} value={enjoyed} onChange={e=>setEnjoyed(e.target.value)} placeholder="Yesterday I enjoyed..."/>
        )}

        {/* Step 6: Today's goals */}
        {step===6&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
            {todayGoals.map(g=>(
              <div key={g.id} style={{...S.goalChip,borderColor:g.type==="professional"?"#60a5fa44":"#4ade8044",background:g.type==="professional"?"#60a5fa0d":"#4ade800d"}}>
                <span style={{fontSize:11,fontWeight:700,color:g.type==="professional"?"#60a5fa":"#4ade80"}}>{g.type==="professional"?"💼":"🌿"}</span>
                {g.subcategory&&<span style={{fontSize:9,fontWeight:800,color:subcatColor(g.type),background:subcatColor(g.type)+"22",padding:"2px 5px",borderRadius:3,marginLeft:6}}>{g.subcategory}</span>}
                <span style={{fontSize:13,color:C.text,flex:1,marginLeft:8}}>{g.text}</span>
              </div>
            ))}
            {!showAddGoal&&<button style={S.ghostBtn} onClick={()=>setShowAddGoal(true)}>+ Add goal for today</button>}
            {showAddGoal&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <textarea style={S.jfBig} rows={3} value={newGoalText} onChange={e=>setNewGoalText(e.target.value)} placeholder="Describe the goal..."/>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.tBtn,...(newGoalType==="personal"?{borderColor:"#4ade80",color:"#4ade80",background:"#4ade800d"}:{})}} onClick={()=>{setNewGoalType("personal");setNewGoalSubcat("");}}>🌿 Personal</button>
                  <button style={{...S.tBtn,...(newGoalType==="professional"?{borderColor:"#60a5fa",color:"#60a5fa",background:"#60a5fa0d"}:{})}} onClick={()=>{setNewGoalType("professional");setNewGoalSubcat("");}}>💼 Professional</button>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {(GOAL_SUBCATS[newGoalType==="professional"?"work":"personal"]||[]).map(sc=>(
                    <button key={sc} style={{...S.tBtn,padding:"4px 10px",fontSize:11,...(newGoalSubcat===sc?{borderColor:subcatColor(newGoalType),color:subcatColor(newGoalType),background:subcatColor(newGoalType)+"15"}:{})}} onClick={()=>setNewGoalSubcat(newGoalSubcat===sc?"":sc)}>{sc}</button>
                  ))}
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

        {/* Step 7: Vitals (after workout/shower so values are known) */}
        {step===7&&(
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

        {/* Step 8: Persona suggestions */}
        {step===8&&(()=>{
          const yId=store[yesterdayK]?.identity;
          const xpData=IDENTITIES.map(id=>({...id,xp:store.xp?.[id.id]?.points||0}));
          const sortedDesc=[...xpData].sort((a,b)=>b.xp-a.xp);
          const sortedAsc=[...xpData].sort((a,b)=>a.xp-b.xp);
          const used=new Set();
          const sugs=[];
          // 1. Strength: top XP
          if(sortedDesc[0]){ sugs.push({...sortedDesc[0],reason:"💪 Strongest persona",reasonColor:"#4ade80"}); used.add(sortedDesc[0].id); }
          // 2. Variety: different from yesterday
          if(yId){
            const variety=xpData.find(p=>!used.has(p.id) && p.id!==yId);
            if(variety){ sugs.push({...variety,reason:"🌀 Different from yesterday",reasonColor:"#a89fff"}); used.add(variety.id); }
          }
          // 3. Develop: lowest XP that isn't already picked
          const dev=sortedAsc.find(p=>!used.has(p.id));
          if(dev){ sugs.push({...dev,reason:dev.xp===0?"🌱 Never tried — explore":"📈 Lowest XP — develop",reasonColor:"#fbbf24"}); used.add(dev.id); }
          return (
            <>
              {yId && <p style={S.wizSub}>Yesterday you were {IDENTITIES.find(i=>i.id===yId)?.emoji} {IDENTITIES.find(i=>i.id===yId)?.name}.</p>}
              {!yId && <p style={S.wizSub}>Pick the persona to embody today.</p>}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
                {sugs.map(s=>(
                  <button key={s.id} onClick={()=>patch({identity:s.id})}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:10,border:`2px solid ${s.color}${today.identity===s.id?'ff':'55'}`,background:today.identity===s.id?s.color+"33":s.color+"0d",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                    <span style={{fontSize:32,flexShrink:0}}>{s.emoji}</span>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontSize:15,fontWeight:800,color:s.color}}>{s.name}</p>
                      <p style={{margin:"2px 0 0",fontSize:11,color:s.reasonColor,fontWeight:600}}>{s.reason}</p>
                      <p style={{margin:"1px 0 0",fontSize:10,color:C.muted}}>Lv {Math.floor(s.xp/100)+1} · {s.xp} XP</p>
                    </div>
                    {today.identity===s.id && <span style={{color:s.color,fontSize:22,flexShrink:0}}>✓</span>}
                  </button>
                ))}
              </div>
              <details style={{marginTop:14}}>
                <summary style={{fontSize:12,color:C.muted,cursor:"pointer",padding:"4px 0"}}>Show all {IDENTITIES.length} personas</summary>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginTop:8}}>
                  {IDENTITIES.map(id=>{
                    const xp=store.xp?.[id.id]?.points||0;
                    const isSel=today.identity===id.id;
                    return (
                      <button key={id.id} onClick={()=>patch({identity:id.id})}
                        style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:6,border:`1px solid ${id.color}${isSel?'aa':'33'}`,background:isSel?id.color+"22":"transparent",cursor:"pointer",textAlign:"left"}}>
                        <span style={{fontSize:14}}>{id.emoji}</span>
                        <span style={{fontSize:11,fontWeight:600,color:id.color,flex:1,lineHeight:1.2}}>{id.name}</span>
                        {xp>0 && <span style={{fontSize:9,color:C.muted}}>{xp}</span>}
                      </button>
                    );
                  })}
                </div>
              </details>
            </>
          );
        })()}

        {/* Step 9: Overview + listening + submit */}
        {step===9&&(
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
              {todayGoals.slice(0,3).map(g=>(
                <div key={g.id} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:g.type==="professional"?"#60a5fa":"#4ade80"}}>{g.type==="professional"?"💼":"🌿"}</span>
                  <span style={{fontSize:13,color:C.text}}>{g.text}</span>
                </div>
              ))}
              {isWeekday()&&<p style={{margin:"8px 0 0",fontSize:12,color:C.green}}>🧘 Midday reset at 1:00 PM</p>}
              {dow===2&&<p style={{margin:"4px 0 0",fontSize:12,color:"#f87171"}}>🦊 Fox report morning — heads down after 9:10</p>}
              {dow===1&&<p style={{margin:"4px 0 0",fontSize:12,color:"#f59e0b"}}>📊 Fox search data update at 2:00 PM</p>}
            </div>
            <button style={{...S.bigBtn,marginTop:20,background:"#4ade80",color:"#0a1f0f",fontSize:16,padding:"16px"}} onClick={finish}>
              ✓ SUBMIT &amp; START DAY
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

// ── Workout Card ─────────────────────────────────────────────────────────────
function WorkoutCard({workout}){
  if(!workout) return null;
  const isLong=workout.type==="run-long";
  const distMi=workout.distance ? parseFloat(workout.distance) : 0;
  const showFuel=isLong || distMi>=10;
  const summaryBits=[workout.totalDuration, workout.distance, workout.pace].filter(Boolean);
  return (
    <div style={{...S.card, borderColor:C.purple+"66", background:C.purple+"08", marginTop:8}}>
      {showFuel && workout.fuelingReminder && (
        <div style={{padding:"8px 10px", background:"#f8717118", border:"1px solid #f8717155", borderRadius:8, marginBottom:10}}>
          <p style={{margin:0, fontSize:11, fontWeight:800, color:"#f87171", letterSpacing:"0.04em"}}>⚠️ FUELING REMINDER</p>
          <p style={{margin:"3px 0 0", fontSize:12, color:C.text, lineHeight:1.4}}>{workout.fuelingReminder}</p>
        </div>
      )}
      {workout.label && <p style={{margin:0, fontSize:10, fontWeight:800, color:C.purpleText, textTransform:"uppercase", letterSpacing:"0.08em"}}>{workout.label}</p>}
      <h3 style={{margin:"4px 0 0", fontSize:18, fontWeight:800, color:C.text, letterSpacing:"-0.01em"}}>{workout.displayName}</h3>
      {workout.summary && <p style={{margin:"4px 0 0", fontSize:13, color:C.muted, lineHeight:1.4}}>{workout.summary}</p>}
      {summaryBits.length>0 && (
        <p style={{margin:"6px 0 0", fontSize:11, color:C.purpleText, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em"}}>⏱ {summaryBits.join(" · ")}</p>
      )}
      {workout.segments && workout.segments.length>0 && (
        <div style={{marginTop:12, display:"flex", flexDirection:"column", gap:10}}>
          {workout.segments.map((seg,i)=>(<WorkoutSegmentRow key={i} seg={seg}/>))}
        </div>
      )}
      {workout.coachingCue && (
        <p style={{margin:"12px 0 0", fontSize:12, color:C.muted, fontStyle:"italic", borderTop:`1px solid ${C.border}`, paddingTop:10, lineHeight:1.5}}>{workout.coachingCue}</p>
      )}
    </div>
  );
}

function WorkoutSegmentRow({seg}){
  const phaseLabel=seg.label || (seg.phase ? seg.phase.charAt(0).toUpperCase()+seg.phase.slice(1) : "");
  // Interval segment with nested work/rest
  if(seg.work && seg.rest){
    return (
      <div>
        <p style={{margin:0, fontSize:13, fontWeight:800, color:C.text}}>▸ {phaseLabel}{seg.rounds?` · ${seg.rounds} rounds`:""}</p>
        <div style={{marginLeft:8, marginTop:6, display:"flex", flexDirection:"column", gap:4}}>
          <div style={{padding:"6px 10px", background:"#f8717115", borderLeft:"3px solid #f87171", borderRadius:3}}>
            <p style={{margin:0, fontSize:12, color:C.text, fontWeight:700}}>WORK · {seg.work.duration}{seg.work.pace?` @ ${seg.work.pace}`:""}{seg.work.effort?` · ${seg.work.effort}`:""}</p>
            {seg.work.cue && <p style={{margin:"3px 0 0", fontSize:11, color:C.muted, lineHeight:1.4}}>{seg.work.cue}</p>}
          </div>
          <div style={{padding:"6px 10px", background:"#4ade8015", borderLeft:"3px solid #4ade80", borderRadius:3}}>
            <p style={{margin:0, fontSize:12, color:C.text, fontWeight:700}}>REST · {seg.rest.duration}{seg.rest.pace?` @ ${seg.rest.pace}`:""}{seg.rest.effort?` · ${seg.rest.effort}`:""}</p>
            {seg.rest.cue && <p style={{margin:"3px 0 0", fontSize:11, color:C.muted, lineHeight:1.4}}>{seg.rest.cue}</p>}
          </div>
        </div>
      </div>
    );
  }
  // Optional/list segment (rest day)
  if(seg.options){
    return (
      <div>
        <p style={{margin:0, fontSize:13, fontWeight:700, color:C.text}}>▸ {phaseLabel}</p>
        <ul style={{margin:"4px 0 0 20px", padding:0, fontSize:12, color:C.muted, lineHeight:1.5}}>
          {seg.options.map((o,i)=><li key={i}>{o}</li>)}
        </ul>
      </div>
    );
  }
  // Items list (warmup, mobility, strength rounds, etc)
  if(seg.items){
    const meta=[seg.duration, seg.format].filter(Boolean).join(" · ");
    return (
      <div>
        <p style={{margin:0, fontSize:13, fontWeight:700, color:C.text}}>▸ {phaseLabel}{meta?` · ${meta}`:""}</p>
        <ul style={{margin:"4px 0 0 20px", padding:0, fontSize:12, color:C.muted, lineHeight:1.5}}>
          {seg.items.map((it,i)=><li key={i}>{it}</li>)}
        </ul>
      </div>
    );
  }
  // Fueling rule
  if(seg.rule){
    return (
      <div style={{padding:"6px 10px", background:"#f8717118", border:"1px solid #f8717155", borderRadius:6}}>
        <p style={{margin:0, fontSize:12, color:"#f87171", fontWeight:800}}>⚠ {phaseLabel}</p>
        <p style={{margin:"3px 0 0", fontSize:12, color:C.text, fontWeight:600}}>{seg.rule}</p>
        {seg.cue && <p style={{margin:"3px 0 0", fontSize:11, color:C.muted, fontStyle:"italic"}}>{seg.cue}</p>}
      </div>
    );
  }
  // Standard segment
  const meta=[seg.duration, seg.distance, seg.pace, seg.effort].filter(Boolean).join(" · ");
  return (
    <div>
      <p style={{margin:0, fontSize:13, fontWeight:700, color:C.text}}>▸ {phaseLabel}</p>
      {meta && <p style={{margin:"2px 0 0", fontSize:12, color:C.muted}}>{meta}</p>}
      {seg.cue && <p style={{margin:"3px 0 0", fontSize:11, color:C.muted, fontStyle:"italic", lineHeight:1.4}}>{seg.cue}</p>}
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

function HomeTab({today,patch,store,pg,dow,gcalEvents=[]}){
  const [showWizard,setShowWizard]=useState(false);
  const woId=today.workout||suggestWorkout(dow);
  const wo=WORKOUTS[woId];
  const identity=IDENTITIES.find(i=>i.id===today.identity);
  const todayK=todayKey();
  // Only today's open goals (created today, scheduled today, or no date yet)
  const goals=(store.goals||[]).filter(g=>!g.done && (g.created===todayK || g.scheduledDate===todayK || !g.created));
  const nowMs=Date.now();
  const calEvents=[...(store.calEvents||[]),...gcalEvents]
    .filter(e=>{
      // Drop events with a past start time
      if(e.startMs && e.startMs < nowMs - 60*60*1000) return false;
      // Drop the legacy demo events if they're still around
      if(e.id==="hamburger" || e.id==="telehealth") return false;
      return true;
    })
    .sort((a,b)=>{
      if(a.startMs && b.startMs) return a.startMs - b.startMs;
      if(a.startMs) return -1;
      if(b.startMs) return 1;
      return 0;
    });
  const hasPausedMorning = !today.morningDone && typeof today.morningStep==='number' && today.morningStep>0;
  const checks=today.checks||{};
  const morningChecks=MORNING_CHECKS.filter(c=>checks[c]).length;
  const workBlocks=getWorkBlocks(dow);
  const wbTimes=new Set(workBlocks.map(b=>b.time));
  const mergedNow=[...workBlocks, ...LIFE_BLOCKS.filter(b=>!wbTimes.has(b.time))]
    .sort((a,b)=>{ const [ah,am]=a.time.split(":").map(Number); const [bh,bm]=b.time.split(":").map(Number); return (ah*60+am)-(bh*60+bm); });
  const _nowMin=new Date().getHours()*60+new Date().getMinutes();
  let nowBlock=mergedNow[0]||null;
  for(let i=mergedNow.length-1;i>=0;i--){
    const [h,m]=mergedNow[i].time.split(":").map(Number);
    if(_nowMin>=h*60+m){ nowBlock=mergedNow[i]; break; }
  }
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
          <span style={{fontSize:40}}>{hasPausedMorning?"▶️":"☀️"}</span>
          <span style={{fontSize:26,fontWeight:800,letterSpacing:"-0.02em"}}>{hasPausedMorning?"RESUME MORNING":"GOOD MORNING"}</span>
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
          <span style={{fontSize:12,color:C.muted}}>{format12h(nowBlock?.time)}</span>
        </div>
        <p style={{margin:"6px 0 0",fontSize:16,fontWeight:700,color:nowBlock?.recurring?nowBlock.color:C.text}}>{nowBlock?.label}</p>
      </div>

      {/* Priorities */}
      {goals.length>0&&(
        <div style={S.card}>
          <CT>Today's priorities ({goals.length})</CT>
          {goals.map(g=>(
            <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"3px 0"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:g.type==="professional"?"#60a5fa":"#4ade80",flexShrink:0}}/>
              {g.subcategory&&<span style={{fontSize:9,fontWeight:800,color:subcatColor(g.type),background:subcatColor(g.type)+"22",padding:"2px 5px",borderRadius:3}}>{g.subcategory}</span>}
              <span style={{fontSize:14,color:C.text,flex:1}}>{g.text}</span>
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
          {calEvents.slice(0,6).map(e=>(
            <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"3px 0"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:e.color||C.purple,flexShrink:0}}/>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:C.text}}>{e.title}</p>
                <p style={{margin:0,fontSize:11,color:C.muted}}>{e.date} · {e.time}</p>
              </div>
              {e.isGcal && <span style={{fontSize:9,color:"#a89fff",fontWeight:700,padding:"2px 5px",border:"1px solid #a89fff44",borderRadius:4}}>G</span>}
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

function DayTab({today,patch,store,pg,dow,gcalEvents=[]}){
  const tasks=today.tasks||{};
  const workEvents=today.workEvents||[];
  const calEvents=store.calEvents||[];
  // GCal events that fall on today
  const todayDateStr=new Date().toDateString();
  const todayGcalEvents=gcalEvents.filter(e=>e.startMs && new Date(e.startMs).toDateString()===todayDateStr);
  const [showTomorrow,setShowTomorrow]=useState(false);
  const [showAddEvent,setShowAddEvent]=useState(false);
  const [showWorkEventForm,setShowWorkEventForm]=useState(false);
  const [newWorkEvent,setNewWorkEvent]=useState({title:"",time:""});
  const [showAddGoal,setShowAddGoal]=useState(false);
  const [movingGoalId,setMovingGoalId]=useState(null);
  const [newGoal,setNewGoal]=useState({text:"",duration:30,category:"personal",subcategory:"",scheduleMode:"auto"});
  const workBlocks=getWorkBlocks(dow);
  const refs=useRef({});

  // Build full 24-hour timeline: 48 slots (every 30 min from midnight to 11:30 PM)
  // Overlay any matching workBlock or LIFE_BLOCK label. Empty slots are schedulable.
  const workMap=new Map(workBlocks.map(b=>[b.time,b]));
  const lifeMap=new Map(LIFE_BLOCKS.map(b=>[b.time,b]));
  const baseTimeline=[];
  for(let h=0;h<24;h++){
    for(const m of [0,30]){
      const t=`${h}:${m===0?"00":"30"}`;
      const block=workMap.get(t)||lifeMap.get(t)||{time:t,label:""};
      baseTimeline.push(block);
    }
  }

  // Index GCal events across every 30-min slot they span (start → end)
  // gcalByTime: which events occupy each slot (for marking occupied)
  // gcalStarts: which events START in each slot (for showing title once)
  const gcalByTime={};
  const gcalStarts={};
  const gcalAllDay=[];
  for(const ev of todayGcalEvents){
    if(ev.isAllDay){ gcalAllDay.push(ev); continue; }
    if(!ev.startMs||!ev.endMs) continue;
    const start=new Date(ev.startMs);
    const end=new Date(ev.endMs);
    // Snap start down to the 30-min slot it falls in
    const startSlotMin=start.getHours()*60+(start.getMinutes()>=30?30:0);
    const endMin=end.getHours()*60+end.getMinutes();
    // Make sure end day matches today (for events that cross midnight, just clamp at 23:30)
    const sameDay=start.toDateString()===end.toDateString();
    const finalEndMin=sameDay?endMin:24*60;
    // Title in start slot
    const startKey=`${Math.floor(startSlotMin/60)}:${startSlotMin%60===0?"00":"30"}`;
    if(!gcalStarts[startKey]) gcalStarts[startKey]=[];
    gcalStarts[startKey].push(ev);
    // All slots
    for(let m=startSlotMin;m<finalEndMin;m+=30){
      const h=Math.floor(m/60);
      const mm=m%60;
      const t=`${h}:${mm===0?"00":"30"}`;
      if(!gcalByTime[t]) gcalByTime[t]=[];
      gcalByTime[t].push(ev);
    }
  }

  // Current block index in 48-slot list
  const nowMin=new Date().getHours()*60+new Date().getMinutes();
  let nowIdx=0;
  for(let i=baseTimeline.length-1;i>=0;i--){
    const [h,m]=baseTimeline[i].time.split(":").map(Number);
    if(nowMin>=h*60+m){ nowIdx=i; break; }
  }

  // Scheduled goals — group by start time so we can render them inline
  const goals=store.goals||[];
  const todayK=todayKey();
  const scheduledGoals=goals.filter(g=>!g.done && g.scheduledTime && (g.scheduledDate===todayK || !g.scheduledDate));
  const unscheduledGoals=goals.filter(g=>!g.done && !g.scheduledTime);
  const goalsByTime=scheduledGoals.reduce((acc,g)=>{
    if(!acc[g.scheduledTime]) acc[g.scheduledTime]=[];
    acc[g.scheduledTime].push(g);
    return acc;
  },{});

  useEffect(()=>{ const el=refs.current[nowIdx]; if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); },[]);

  function addWorkEvent(){
    if(!newWorkEvent.title.trim()) return;
    patch({workEvents:[...workEvents,{...newWorkEvent,id:Date.now(),addedToGcal:false}]});
    setNewWorkEvent({title:"",time:""}); setShowWorkEventForm(false);
  }
  function saveCalEvent(evt){
    pg({calEvents:[...(store.calEvents||[]),evt]});
  }

  // Find next free slot for auto-schedule given category preference
  function findFreeSlot(category){
    // Work goals prefer 9:00-17:00, personal prefer outside that or early/lunch
    const taken=new Set([...scheduledGoals.map(g=>g.scheduledTime), ...workBlocks.filter(b=>b.recurring||b.nudge).map(b=>b.time), ...Object.keys(gcalByTime)]);
    const candidates=baseTimeline.map(b=>b.time);
    const inWork=t=>{ const [h]=t.split(":").map(Number); return h>=9 && h<17; };
    const sorted=candidates.sort((a,b)=>{
      const [ah,am]=a.split(":").map(Number);
      const [bh,bm]=b.split(":").map(Number);
      const aMin=ah*60+am, bMin=bh*60+bm;
      // Future slots first
      const aFuture=aMin>=nowMin?0:1;
      const bFuture=bMin>=nowMin?0:1;
      if(aFuture!==bFuture) return aFuture-bFuture;
      return aMin-bMin;
    });
    for(const t of sorted){
      if(taken.has(t)) continue;
      if(category==="work" && !inWork(t)) continue;
      if(category==="personal" && inWork(t)) continue;
      return t;
    }
    // Fallback: any free slot
    return sorted.find(t=>!taken.has(t))||"12:00";
  }

  function addGoal(){
    if(!newGoal.text.trim()) return;
    const id=Date.now();
    let scheduledTime=null;
    if(newGoal.scheduleMode==="auto") scheduledTime=findFreeSlot(newGoal.category);
    pg({goals:[...goals,{id,text:newGoal.text.trim(),duration:Number(newGoal.duration)||30,type:newGoal.category==="work"?"professional":"personal",subcategory:newGoal.subcategory||null,done:false,created:todayK,scheduledTime,scheduledDate:scheduledTime?todayK:null}]});
    setNewGoal({text:"",duration:30,category:"personal",subcategory:"",scheduleMode:"auto"});
    setShowAddGoal(false);
  }
  function moveGoalToTime(goalId, time){
    pg({goals:goals.map(g=>g.id===goalId?{...g,scheduledTime:time,scheduledDate:todayK}:g)});
    setMovingGoalId(null);
  }
  function unscheduleGoal(goalId){
    pg({goals:goals.map(g=>g.id===goalId?{...g,scheduledTime:null,scheduledDate:null}:g)});
  }
  function completeGoal(goalId){
    pg({goals:goals.map(g=>g.id===goalId?{...g,done:true}:g)});
  }
  function deleteGoal(goalId){
    if(!window.confirm("Delete this goal?")) return;
    pg({goals:goals.filter(g=>g.id!==goalId)});
    if(movingGoalId===goalId) setMovingGoalId(null);
  }

  function GoalChip({g, scheduled}){
    const color=g.type==="professional"?"#60a5fa":"#4ade80";
    return (
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:6,border:`1px solid ${color}55`,background:color+"15",marginTop:4}}>
        <span style={{fontSize:12}}>{g.type==="professional"?"💼":"🌿"}</span>
        {g.subcategory&&<span style={{fontSize:9,fontWeight:800,color,background:color+"22",padding:"2px 5px",borderRadius:3}}>{g.subcategory}</span>}
        <span style={{fontSize:12,color:C.text,flex:1}}>{g.text}{g.duration?` · ${g.duration}m`:""}</span>
        {scheduled
          ? <button style={{background:"transparent",border:"none",color:C.muted,fontSize:11,cursor:"pointer"}} onClick={()=>setMovingGoalId(movingGoalId===g.id?null:g.id)} title="Move to a different time">⇅</button>
          : <button style={{background:color,border:"none",borderRadius:4,color:"#fff",fontSize:10,fontWeight:700,padding:"3px 6px",cursor:"pointer"}} onClick={()=>setMovingGoalId(movingGoalId===g.id?null:g.id)}>Schedule</button>
        }
        <button style={{background:"transparent",border:"none",color:"#4ade80",fontSize:13,cursor:"pointer"}} onClick={()=>completeGoal(g.id)} title="Mark done">✓</button>
        <button style={{background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer"}} onClick={()=>deleteGoal(g.id)} title="Delete goal">✕</button>
      </div>
    );
  }

  return (
    <Sec>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <SH icon="📅" title="Today" sub="full day · scrolls to now"/>
        <button style={S.plusBtn} onClick={()=>setShowAddEvent(true)}>+</button>
      </div>

      {showAddEvent&&<AddEventModal onSave={saveCalEvent} onClose={()=>setShowAddEvent(false)}/>}

      {/* Goals */}
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <CT>🎯 Goals</CT>
          {!showAddGoal&&<button style={{background:"transparent",border:`1px solid ${C.purple}`,color:C.purpleText,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowAddGoal(true)}>+ Add</button>}
        </div>
        {showAddGoal&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
            <input style={S.addInput} placeholder="Goal description..." value={newGoal.text} onChange={e=>setNewGoal({...newGoal,text:e.target.value})}/>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,color:C.muted}}>Duration:</span>
              {[15,30,45,60,90].map(d=>(
                <button key={d} style={{...S.tBtn,padding:"4px 8px",fontSize:11,...(newGoal.duration===d?S.tActive:{})}} onClick={()=>setNewGoal({...newGoal,duration:d})}>{d}m</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.tBtn,...(newGoal.category==="personal"?{borderColor:"#4ade80",color:"#4ade80",background:"#4ade800d"}:{})}} onClick={()=>setNewGoal({...newGoal,category:"personal",subcategory:""})}>🌿 Personal</button>
              <button style={{...S.tBtn,...(newGoal.category==="work"?{borderColor:"#60a5fa",color:"#60a5fa",background:"#60a5fa0d"}:{})}} onClick={()=>setNewGoal({...newGoal,category:"work",subcategory:""})}>💼 Work</button>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(GOAL_SUBCATS[newGoal.category]||[]).map(sc=>{
                const col=newGoal.category==="work"?"#60a5fa":"#4ade80";
                return <button key={sc} style={{...S.tBtn,padding:"4px 10px",fontSize:11,...(newGoal.subcategory===sc?{borderColor:col,color:col,background:col+"15"}:{})}} onClick={()=>setNewGoal({...newGoal,subcategory:newGoal.subcategory===sc?"":sc})}>{sc}</button>;
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.tBtn,...(newGoal.scheduleMode==="auto"?S.tActive:{})}} onClick={()=>setNewGoal({...newGoal,scheduleMode:"auto"})}>🤖 Auto-schedule</button>
              <button style={{...S.tBtn,...(newGoal.scheduleMode==="manual"?S.tActive:{})}} onClick={()=>setNewGoal({...newGoal,scheduleMode:"manual"})}>👆 I'll pick</button>
            </div>
            <div style={S.addRow}>
              <button style={{...S.addBtn,flex:1,width:"auto",fontSize:13}} onClick={addGoal}>✓ Submit Goal</button>
              <button style={{...S.addBtn,background:C.border,flex:1,width:"auto",fontSize:13}} onClick={()=>setShowAddGoal(false)}>Cancel</button>
            </div>
          </div>
        )}
        {unscheduledGoals.length>0&&(
          <div style={{marginTop:8}}>
            <p style={{margin:"0 0 2px",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Unscheduled — tap Schedule then a slot</p>
            {unscheduledGoals.map(g=><GoalChip key={g.id} g={g} scheduled={false}/>)}
          </div>
        )}
        {movingGoalId&&<p style={{margin:"6px 0 0",fontSize:11,color:"#fbbf24",fontWeight:600}}>👆 Tap a time slot below to place this goal</p>}
      </div>

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

      {/* All-day GCal events banner */}
      {gcalAllDay.length>0 && (
        <div style={{...S.card,borderColor:"#a89fff44",background:"#a89fff10"}}>
          <CT>📅 All-day today</CT>
          {gcalAllDay.map(ev=>(
            <div key={ev.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0"}}>
              <span style={{fontSize:9,color:"#a89fff",fontWeight:800,letterSpacing:"0.05em"}}>GCAL</span>
              <span style={{fontSize:13,color:C.text,fontWeight:600}}>{ev.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Single 24-hour timeline */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {baseTimeline.map((b,i)=>{
          const isNow=i===nowIdx;
          const blockGoals=goalsByTime[b.time]||[];
          const blockGcalCovers=gcalByTime[b.time]||[];
          const blockGcalStarts=gcalStarts[b.time]||[];
          const isContinuation=blockGcalCovers.length>0 && blockGcalStarts.length===0;
          const hasGcal=blockGcalCovers.length>0;
          const isEmpty=!b.label&&!b.nudge&&!b.recurring&&!hasGcal;
          const slotClickable=movingGoalId!==null;
          return (
            <div key={b.time+i} ref={el=>refs.current[i]=el}
              onClick={slotClickable?()=>moveGoalToTime(movingGoalId,b.time):undefined}
              style={{...S.block,
                ...(isEmpty?{padding:"6px 8px",background:"transparent",borderColor:C.border+"66"}:{}),
                ...(isNow?{borderColor:"#3b82f6",borderWidth:2,background:"#3b82f612",boxShadow:"0 0 0 2px #3b82f644"}:{}),
                ...(b.nudge?S.blockGreen:{}),
                ...(b.recurring?{borderColor:b.color+"66",background:b.color+"0d"}:{}),
                ...(hasGcal?{borderColor:"#a89fff66",background:"#a89fff12"}:{}),
                ...(isContinuation?{padding:"4px 8px",background:"#a89fff15",borderTop:"none"}:{}),
                ...(slotClickable?{cursor:"pointer",borderStyle:"dashed",borderColor:"#fbbf24"}:{}),
              }}>
              <div style={S.bTime}>
                <span style={{...S.bTL,...(isNow?{color:"#3b82f6",fontWeight:800}:{}),...(b.recurring?{color:b.color}:{}),...(hasGcal?{color:"#a89fff"}:{})}}>{format12h(b.time)}</span>
                {isNow&&<span style={{...S.nowPill,background:"#3b82f6",color:"#fff"}}>NOW</span>}
              </div>
              <div style={S.bBody}>
                {!isContinuation && b.label && <p style={{...S.bDesc,...(b.nudge?{color:C.green,fontWeight:600}:{}),...(b.recurring?{color:b.color,fontWeight:600}:{})}}>{b.label}</p>}
                {blockGcalStarts.map(ev=>(
                  <div key={ev.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",borderRadius:4,background:"#a89fff22",border:"1px solid #a89fff44",marginTop:b.label?4:0}}>
                    <span style={{fontSize:9,color:"#a89fff",fontWeight:800,letterSpacing:"0.05em"}}>GCAL</span>
                    <span style={{fontSize:13,color:C.text,fontWeight:600,flex:1}}>{ev.title}</span>
                    <span style={{fontSize:10,color:C.muted}}>{ev.time}</span>
                  </div>
                ))}
                {isContinuation && (
                  <p style={{margin:0,fontSize:11,color:"#a89fff99",fontStyle:"italic"}}>↳ {blockGcalCovers[0].title}</p>
                )}
                {!b.nudge&&!b.recurring&&!slotClickable&&!hasGcal&&<input style={S.tInput} placeholder={b.label?"+ add task":"+ add"} value={tasks[b.time]||""} onChange={e=>patch({tasks:{...tasks,[b.time]:e.target.value}})}/>}
                {blockGoals.map(g=><GoalChip key={g.id} g={g} scheduled={true}/>)}
              </div>
            </div>
          );
        })}
      </div>

      <button style={S.ghostBtn} onClick={()=>setShowTomorrow(!showTomorrow)}>
        {showTomorrow?"▾ Hide tomorrow":"▸ Preview tomorrow"}
      </button>
      {showTomorrow&&(
        <div style={S.card}>
          <CT>Tomorrow</CT>
          {(()=>{ const tDow=(dow+1)%7; const tWo=WORKOUTS[DOW_DEFAULT[tDow]]; return <p style={{margin:0,fontSize:13,color:C.text}}>{tWo?.icon} {tWo?.label} · ~{tWo?.duration} min</p>; })()}
          {(RECURRING[(dow+1)%7]||[]).map(r=><p key={r.time} style={{margin:"4px 0 0",fontSize:12,color:r.color}}>{format12h(r.time)} · {r.label}</p>)}
        </div>
      )}
    </Sec>
  );
}

// ── Week Tab ─────────────────────────────────────────────────────────────────

function WeekTab({store,pg}){
  const [showAddEvent,setShowAddEvent]=useState(false);
  const [weekOffset,setWeekOffset]=useState(0);
  const todayK=todayKey();
  const [selectedDayKey,setSelectedDayKey]=useState(todayK);
  const [showAddDayGoal,setShowAddDayGoal]=useState(false);
  const [newDayGoal,setNewDayGoal]=useState({text:"",type:"personal",subcategory:""});

  // Build Sun-Sat of selected week
  const todayDate=new Date();
  const dowToday=todayDate.getDay();
  const startOfWeek=new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - dowToday + (weekOffset*7));
  const days=[];
  for(let i=0;i<7;i++){
    const d=new Date(startOfWeek); d.setDate(startOfWeek.getDate()+i);
    const k=d.toISOString().split("T")[0];
    const dd=store[k]||{}; const l=dd.log||{};
    const checksDone=MORNING_CHECKS.filter(c=>(dd.checks||{})[c]).length;
    const dow2=d.getDay();
    days.push({k,l,checksDone,dayLabel:["Su","Mo","Tu","We","Th","Fr","Sa"][dow2],dateNum:d.getDate(),isToday:k===todayK,dow2});
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

  // Selected day details
  const goals=store.goals||[];
  const selectedDayGoals=goals.filter(g=>g.created===selectedDayKey || g.scheduledDate===selectedDayKey);
  const selectedDayDate=new Date(selectedDayKey+"T12:00:00");
  const selectedDayLabel=selectedDayDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const selectedIsPast=selectedDayKey<todayK;
  const selectedIsToday=selectedDayKey===todayK;
  const selectedDayData=store[selectedDayKey]||{};
  const selectedDayLog=selectedDayData.log||{};

  function addDayGoal(){
    if(!newDayGoal.text.trim()) return;
    pg({goals:[...goals,{id:Date.now(),text:newDayGoal.text.trim(),type:newDayGoal.type,subcategory:newDayGoal.subcategory||null,done:false,created:selectedDayKey}]});
    setNewDayGoal({text:"",type:"personal",subcategory:""}); setShowAddDayGoal(false);
  }
  function toggleGoalDone(id){ pg({goals:goals.map(g=>g.id===id?{...g,done:!g.done}:g)}); }
  function deleteDayGoal(id){ if(!window.confirm("Delete this goal?")) return; pg({goals:goals.filter(g=>g.id!==id)}); }

  return (
    <Sec>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <SH icon="📊" title="This Week" sub="tap a day to view · ‹ › for other weeks"/>
        <button style={S.plusBtn} onClick={()=>setShowAddEvent(true)}>+</button>
      </div>

      {showAddEvent&&<AddEventModal onSave={saveCalEvent} onClose={()=>setShowAddEvent(false)}/>}

      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <button onClick={()=>setWeekOffset(weekOffset-1)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.text,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700}}>‹</button>
          <CT>{weekOffset===0?"This Week":weekOffset===-1?"Last Week":weekOffset===1?"Next Week":`${Math.abs(weekOffset)} weeks ${weekOffset<0?"ago":"ahead"}`}</CT>
          <button onClick={()=>setWeekOffset(weekOffset+1)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.text,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {days.map(({k,l,checksDone,dayLabel,dateNum,isToday,dow2})=>{
            const wo=WORKOUTS[DOW_DEFAULT[dow2]];
            const isSelected=k===selectedDayKey;
            return (
              <button key={k} onClick={()=>setSelectedDayKey(k)}
                style={{...S.dayCell,...(isToday?S.dayCellToday:{}),...(isSelected?{borderColor:"#3b82f6",borderWidth:2}:{}),cursor:"pointer",background:isSelected?"#3b82f615":"transparent",padding:"6px 2px"}}>
                <p style={{margin:0,fontSize:9,fontWeight:700,color:isToday?C.purpleText:C.muted,textAlign:"center"}}>{dayLabel}</p>
                <p style={{margin:"2px 0 0",fontSize:14,fontWeight:800,color:isToday?C.purpleText:C.text,textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{dateNum}</p>
                <p style={{margin:"2px 0 0",fontSize:14,textAlign:"center"}}>{wo?.icon||"•"}</p>
                <p style={{margin:"2px 0 0",fontSize:9,color:checksDone>0?C.green:C.border,textAlign:"center"}}>{checksDone>0?"✓":"–"}</p>
                {l.weight&&<p style={{margin:"2px 0 0",fontSize:8,color:C.muted,textAlign:"center"}}>{l.weight}lb</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div style={{...S.card,borderColor:"#3b82f644"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <CT>{selectedDayLabel} {selectedIsPast?"· past":selectedIsToday?"· today":"· upcoming"}</CT>
          {!selectedIsPast && !showAddDayGoal && (
            <button style={{background:"#3b82f622",border:"1px solid #3b82f6",color:"#60a5fa",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowAddDayGoal(true)}>+ Goal</button>
          )}
        </div>
        {selectedDayGoals.length===0 && !showAddDayGoal && <p style={{margin:"6px 0 0",fontSize:12,color:C.muted}}>No goals on this day.</p>}
        {selectedDayGoals.map(g=>(
          <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
            <span style={{fontSize:14}}>{g.type==="professional"?"💼":"🌿"}</span>
            {g.subcategory&&<span style={{fontSize:9,fontWeight:800,color:subcatColor(g.type),background:subcatColor(g.type)+"22",padding:"2px 5px",borderRadius:3}}>{g.subcategory}</span>}
            <span style={{fontSize:13,color:g.done?C.muted:C.text,textDecoration:g.done?"line-through":"none",flex:1}}>{g.text}</span>
            <button onClick={()=>toggleGoalDone(g.id)} title={g.done?"Mark not done":"Mark done"} style={{background:g.done?"transparent":"#4ade8022",border:`1px solid ${g.done?C.border:"#4ade8055"}`,color:g.done?C.muted:"#4ade80",borderRadius:4,fontSize:11,fontWeight:700,padding:"3px 7px",cursor:"pointer"}}>{g.done?"↩":"✓"}</button>
            {!selectedIsPast && <button onClick={()=>deleteDayGoal(g.id)} style={{background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer"}}>✕</button>}
          </div>
        ))}
        {showAddDayGoal && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
            <input style={S.addInput} placeholder="Goal description..." value={newDayGoal.text} onChange={e=>setNewDayGoal({...newDayGoal,text:e.target.value})}/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.tBtn,...(newDayGoal.type==="personal"?{borderColor:"#4ade80",color:"#4ade80",background:"#4ade800d"}:{})}} onClick={()=>setNewDayGoal({...newDayGoal,type:"personal",subcategory:""})}>🌿 Personal</button>
              <button style={{...S.tBtn,...(newDayGoal.type==="professional"?{borderColor:"#60a5fa",color:"#60a5fa",background:"#60a5fa0d"}:{})}} onClick={()=>setNewDayGoal({...newDayGoal,type:"professional",subcategory:""})}>💼 Professional</button>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(GOAL_SUBCATS[newDayGoal.type==="professional"?"work":"personal"]||[]).map(sc=>{
                const col=newDayGoal.type==="professional"?"#60a5fa":"#4ade80";
                return <button key={sc} style={{...S.tBtn,padding:"4px 10px",fontSize:11,...(newDayGoal.subcategory===sc?{borderColor:col,color:col,background:col+"15"}:{})}} onClick={()=>setNewDayGoal({...newDayGoal,subcategory:newDayGoal.subcategory===sc?"":sc})}>{sc}</button>;
              })}
            </div>
            <div style={S.addRow}>
              <button style={{...S.addBtn,flex:1,width:"auto",fontSize:13}} onClick={addDayGoal}>Add to {selectedDayLabel}</button>
              <button style={{...S.addBtn,background:C.border,flex:1,width:"auto",fontSize:13}} onClick={()=>setShowAddDayGoal(false)}>Cancel</button>
            </div>
          </div>
        )}
        {selectedDayLog.grateful && <p style={{margin:"8px 0 0",fontSize:11,color:C.muted,fontStyle:"italic"}}>🙏 {selectedDayLog.grateful.slice(0,140)}{selectedDayLog.grateful.length>140?"…":""}</p>}
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
  const [showManageActs,setShowManageActs]=useState(false);
  const [editingAct,setEditingAct]=useState(null); // {id, label, pts}
  const identity=IDENTITIES.find(i=>i.id===activeId);
  const myXP=xp[activeId]||{points:0,log:[]};
  const myMS=milestones[activeId]||[];
  const level=Math.floor(myXP.points/100)+1;
  const prog=myXP.points%100;

  const userActs=store.activities||DEFAULT_ACTIVITIES;
  const ACTS=[...userActs,{id:"custom",label:"✨ Custom...",pts:10}];

  function selectToday(id){patch({identity:id});setActiveId(id);}
  function logActivity(){
    const text=activityId==="custom"?customText:ACTS.find(a=>a.id===activityId)?.label||"";
    if(!text.trim()) return;
    const pts=ACTS.find(a=>a.id===activityId)?.pts||10;
    const label=duration?`${text} — ${duration} min`:text;
    pg({xp:{...xp,[activeId]:{points:myXP.points+pts,log:[{id:Date.now(),text:label,date:todayKey(),pts},...(myXP.log||[])]}}});
    setActivityId("");setCustomText("");setDuration("");
  }
  function deleteActivity(entry){
    if(!window.confirm(`Delete "${entry.text}" (-${entry.pts} XP)?`)) return;
    const newLog=(myXP.log||[]).filter(e=>e!==entry);
    pg({xp:{...xp,[activeId]:{points:Math.max(0,myXP.points-entry.pts),log:newLog}}});
  }
  function saveActivityDef(act){
    const trimmed={...act,label:(act.label||"").trim(),pts:Number(act.pts)||10};
    if(!trimmed.label){ alert("Activity needs a label."); return; }
    const exists=userActs.find(a=>a.id===trimmed.id);
    const next=exists ? userActs.map(a=>a.id===trimmed.id?trimmed:a) : [...userActs, trimmed];
    pg({activities: next});
    setEditingAct(null);
  }
  function deleteActivityDef(id){
    if(!window.confirm("Delete this activity from the list? (Existing log entries are unaffected.)")) return;
    pg({activities: userActs.filter(a=>a.id!==id)});
  }
  function addMS(){if(!newMS.trim()) return;pg({milestones:{...milestones,[activeId]:[...myMS,{text:newMS.trim(),done:false,id:Date.now()}]}});setNewMS("");}
  function togMS(id){pg({milestones:{...milestones,[activeId]:myMS.map(m=>m.id===id?{...m,done:!m.done}:m)}});}
  function delMS(id){if(!window.confirm("Delete this milestone?")) return;pg({milestones:{...milestones,[activeId]:myMS.filter(m=>m.id!==id)}});}

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
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <CT>Log an Activity</CT>
          <button onClick={()=>setShowManageActs(!showManageActs)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{showManageActs?"Done":"⚙ Manage"}</button>
        </div>
        <select style={S.sel} value={activityId} onChange={e=>setActivityId(e.target.value)}>
          <option value="">— select —</option>
          {ACTS.map(a=><option key={a.id} value={a.id}>{a.label} (+{a.pts})</option>)}
        </select>
        {showManageActs && (
          <div style={{...S.card,marginTop:8,borderColor:C.border,background:C.bg+"00"}}>
            <p style={{margin:"0 0 6px",fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:700}}>Edit activity list</p>
            {userActs.map(a=>(
              <div key={a.id} style={{display:"flex",gap:6,padding:"5px 0",borderTop:`1px solid ${C.border}`,alignItems:"center"}}>
                <span style={{fontSize:12,color:C.text,flex:1}}>{a.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:identity.color,minWidth:32,textAlign:"right"}}>+{a.pts}</span>
                <button onClick={()=>setEditingAct({...a})} title="Edit" style={{background:"transparent",border:"none",color:C.purpleText,fontSize:13,cursor:"pointer",padding:"2px 6px"}}>✎</button>
                <button onClick={()=>deleteActivityDef(a.id)} title="Delete" style={{background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer",padding:"2px 6px"}}>✕</button>
              </div>
            ))}
            {!editingAct && (
              <button onClick={()=>setEditingAct({id:"act_"+Date.now(),label:"",pts:10})} style={{...S.ghostBtn,marginTop:8}}>+ Add new activity</button>
            )}
            {editingAct && (
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8,padding:8,border:`1px solid ${identity.color}55`,borderRadius:8,background:identity.color+"08"}}>
                <p style={{margin:0,fontSize:11,color:C.muted}}>{userActs.find(a=>a.id===editingAct.id)?"Editing":"New activity"}</p>
                <input style={S.addInput} placeholder="Label (e.g. 🚴 Bike Ride)" value={editingAct.label} onChange={e=>setEditingAct({...editingAct,label:e.target.value})}/>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <label style={{fontSize:11,color:C.muted}}>XP per log:</label>
                  <input style={{...S.addInput,maxWidth:80}} type="number" value={editingAct.pts} onChange={e=>setEditingAct({...editingAct,pts:e.target.value})}/>
                </div>
                <div style={S.addRow}>
                  <button style={{...S.addBtn,background:identity.color,flex:1,width:"auto",fontSize:13}} onClick={()=>saveActivityDef(editingAct)}>Save</button>
                  <button style={{...S.addBtn,background:C.border,flex:1,width:"auto",fontSize:13}} onClick={()=>setEditingAct(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {activityId==="custom"&&<input style={S.addInput} placeholder="Describe..." value={customText} onChange={e=>setCustomText(e.target.value)}/>}
        <div style={{marginTop:8}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>Duration (min)</label>
          <input style={S.li} type="number" value={duration} placeholder="—" onChange={e=>setDuration(e.target.value)}/>
        </div>
        <button style={{background:identity.color,border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,padding:"12px",cursor:"pointer",width:"100%",marginTop:8}} onClick={logActivity}>+ Log Activity</button>
        {myXP.log?.slice(0,8).map((e,i)=>(
          <div key={e.id||i} style={{display:"flex",gap:8,padding:"6px 0",borderTop:`1px solid ${C.border}`,alignItems:"center"}}>
            <span style={{fontSize:10,color:C.muted,minWidth:68}}>{e.date}</span>
            <span style={{fontSize:12,color:C.text,flex:1}}>{e.text}</span>
            <span style={{fontSize:11,fontWeight:700,color:identity.color}}>+{e.pts}</span>
            <button style={{background:"transparent",border:"none",color:C.muted,fontSize:14,cursor:"pointer",padding:"2px 6px",lineHeight:1}} onClick={()=>deleteActivity(e)} title="Delete this entry">✕</button>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <CT>Milestones — {identity.name}</CT>
        {myMS.map(m=>(
          <div key={m.id} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{flex:1}}><CR label={m.text} checked={m.done} onToggle={()=>togMS(m.id)} color={identity.color}/></div>
            <button style={{background:"transparent",border:"none",color:C.muted,fontSize:14,cursor:"pointer",padding:"2px 6px",lineHeight:1}} onClick={()=>delMS(m.id)} title="Delete milestone">✕</button>
          </div>
        ))}
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
  hdr:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"calc(12px + env(safe-area-inset-top)) 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10},
  logo:{fontSize:17,fontWeight:800,letterSpacing:"0.28em",color:C.purpleText},
  main:{flex:1,overflowY:"auto",paddingBottom:"calc(72px + env(safe-area-inset-bottom))"},
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
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:500,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:20,paddingBottom:"env(safe-area-inset-bottom)"},
  navBtn:{flex:1,background:"none",border:"none",cursor:"pointer",padding:"10px 2px 12px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:C.muted},
  navActive:{color:C.purpleText},
  navLabel:{fontSize:9,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"},
  bigGreenBtn:{background:"#0f2a1a",border:"3px solid #4ade80",borderRadius:20,padding:"32px 24px",display:"flex",alignItems:"center",justifyContent:"center",gap:14,cursor:"pointer",width:"100%",color:"#4ade80",boxShadow:"0 4px 20px rgba(74, 222, 128, 0.15)"},
  bigBtn:{background:C.purple,border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",width:"100%",transition:"background 0.2s"},
  plusBtn:{background:C.purple,border:"none",borderRadius:10,width:36,height:36,fontSize:22,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:300},
  wizard:{display:"flex",flexDirection:"column",padding:"0 16px 0",minHeight:"calc(100vh - 60px)",position:"relative",paddingBottom:"calc(150px + env(safe-area-inset-bottom))"},
  wizProgress:{display:"flex",gap:6,alignItems:"center"},
  wizDot:{width:8,height:8,borderRadius:"50%",background:C.border,transition:"background 0.3s",padding:0},
  wizStep:{flex:1,display:"flex",flexDirection:"column",paddingTop:8},
  wizEmoji:{fontSize:48,textAlign:"center",marginBottom:8},
  wizTitle:{margin:0,fontSize:24,fontWeight:800,color:C.text,textAlign:"center",letterSpacing:"-0.03em"},
  wizSub:{margin:"8px 0 0",fontSize:14,color:C.muted,textAlign:"center"},
  wizNav:{display:"flex",gap:8,padding:"12px 16px",alignItems:"center",position:"fixed",bottom:"calc(72px + env(safe-area-inset-bottom))",left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:500,background:C.bg,borderTop:`1px solid ${C.border}`,zIndex:15,boxShadow:"0 -4px 12px rgba(0,0,0,0.4)"},
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
