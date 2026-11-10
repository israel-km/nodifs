/*
NODIFS optional GPT backend setup (run from the nodifs folder):
  npm init -y
  npm install express node-fetch
  Windows PowerShell: $env:OPENAI_API_KEY="sk-..."
  Windows CMD: set OPENAI_API_KEY=sk-...
  macOS/Linux: export OPENAI_API_KEY=...
  node server.js

Never place your API key in client-side JavaScript or commit it to source control.
*/
const express = require("express");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
const app = express();
app.use(express.json({limit:"32kb"}));
const SYSTEM_PROMPT = `You are NODIFS GPT, the official assistant for Nova Dhech International French School (NODIFS) on Kizungu Road, Kampala, Uganda, near Latitude 0°.

YOUR ONLY JOB is to help users with questions about NODIFS, including: admissions and application process, academic programs and curriculum, tuition fees and payment plans, school location, contact info, campus facilities, news, events, announcements, languages offered, extracurricular activities, and any other school-related topic.

STRICT RULES:
1. If a user asks about ANYTHING not related to NODIFS or general school life, politely decline and redirect: "I'm here to help with NODIFS-related questions only. Is there anything about our school I can assist you with?"
2. Never answer questions about politics, religion, other schools, general knowledge, coding, health advice, or anything outside NODIFS business.
3. Do not pretend to be a general-purpose AI. You are NODIFS GPT.
4. Keep answers warm, concise, and helpful for parents and students.
5. Do not invent school policies, fees, phone numbers, dates, accreditations, or other facts. If details are unknown, ask the user to contact the school office.`;
app.post("/api/nodifs-gpt", async (req,res) => {
  const {message,history=[],lang="en"} = req.body || {};
  const LANGS={en:"English",fr:"French",sw:"Swahili",ln:"Lingala",lg:"Luganda"};
  const replyLang=LANGS[lang]||"English";
  if(typeof message !== "string" || !message.trim()) return res.status(400).json({reply:"Please enter a school-related question."});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({reply:"The school assistant service is not configured yet. Please contact the school office."});
  const safeHistory = Array.isArray(history) ? history.filter(m=>m && ["user","assistant"].includes(m.role) && typeof m.content==="string").slice(-8) : [];
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:SYSTEM_PROMPT+`\n\nAlways reply in ${replyLang}, the language the visitor chose on the website.`},...safeHistory,{role:"user",content:message.trim()}],max_tokens:400,temperature:0.4})
    });
    const data=await response.json();
    if(!response.ok) { console.error("OpenAI API error:",data.error?.message || response.status); return res.status(502).json({reply:"I'm having trouble answering right now. Please try again later or contact the school office."}); }
    return res.json({reply:data.choices?.[0]?.message?.content?.trim() || "Please contact the school office for help with this question."});
  } catch(err) { console.error("NODIFS GPT request failed:",err.message); return res.status(502).json({reply:"The assistant service is temporarily unavailable. Please try again later."}); }
});
app.use(express.static(path.join(__dirname)));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`NODIFS website available at http://localhost:${port}`));