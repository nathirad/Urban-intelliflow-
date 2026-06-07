"""
rag.py — lightweight Retrieval-Augmented Generation for the Urban IntelliFlow
AI assistant ("ผู้ช่วย AI").

Why RAG here: the adaptive-signal *control* loop does not need RAG (that is computer
vision + optimization). But a citizen/officer assistant that answers natural-language
questions — "ตอนนี้แยกไหนรถติดสุด", "ระบบประหยัดงบยังไง", "โหมด Manual คืออะไร",
"PDPA ทำยังไง" — benefits hugely from grounding answers in (a) the project's own
documentation and (b) the live system state, instead of free-form hallucination.

Design (no heavy deps, runs offline):
  1. Knowledge base = curated FAQ cards + chunks parsed from docs/*.md, CLAUDE.md.
  2. Live state is injected as a fresh "document" each query (so the assistant can
     answer real-time questions from state.py).
  3. Retriever = hybrid lexical score: English word overlap + Thai 3-gram overlap
     (Thai has no spaces, so character shingles retrieve well) + tag/keyword boosts.
  4. Generation = Gemini 1.5 Flash if GEMINI_API_KEY is set; otherwise an extractive
     composer that stitches the top chunks + live facts into a grounded answer.

Swap the lexical retriever for pgvector/FAISS + an embedding model in production;
the API and the rest of the app stay identical.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from state import STATE

_DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
_ROOT = Path(__file__).resolve().parent.parent

# --- Curated FAQ knowledge cards (high-signal, keyword-tagged) ---------------
_FAQ: list[dict] = [
    {"title": "ต้นทุนและการประหยัด (Cost & Savings)",
     "tags": "ต้นทุน ราคา ประหยัด งบ cost price saving roi คืนทุน 150000 2500000 94",
     "text": "Urban IntelliFlow ลดต้นทุนต่อแยกจากระบบ adaptive เดิม ~2,500,000 บาท เหลือ "
             "~150,000 บาท (ประหยัด ~94%) ด้วยการนำโครงสร้างเดิม (เสา ตู้ไฟ สายไฟ) มาใช้ซ้ำ "
             "แล้วเสริมกล้อง CCTV + กล่อง Edge-AI (Jetson) + รีเลย์ Modbus เท่านั้น. "
             "ระยะคืนทุน (ROI) ประมาณ 2–5 เดือนจากค่าน้ำมัน/เวลาที่ประหยัดได้."},
    {"title": "โหมด Auto กับ Manual (Operating Modes)",
     "tags": "โหมด auto manual อัตโนมัติ เจ้าหน้าที่ plc officer mode ควบคุม",
     "text": "ระบบมี 2 โหมด: (1) Automatic — Smart PLC + Edge AI ควบคุมแยกสำคัญอัตโนมัติ. "
             "(2) Manual — แยกงบจำกัด เจ้าหน้าที่จราจรได้รับคำแนะนำเวลาไฟในแอปแล้วกดเอง "
             "ไม่ต้องอัปเกรดฮาร์ดแวร์ ทำให้ขยายได้ทั้งเมืองในงบประหยัด."},
    {"title": "Edge AI: YOLO26 + ByteTrack",
     "tags": "yolo yolo26 bytetrack jetson กล้อง ตรวจจับ นับรถ มอเตอร์ไซค์ detection edge",
     "text": "ที่แต่ละแยก กล่อง Jetson รัน YOLO26 (รุ่น nano สำหรับ Jetson Nano / medium สำหรับ Orin) "
             "ตรวจจับยานพาหนะ และ ByteTrack ติดตามรถข้ามเฟรมเพื่อนับจำนวนไม่ซ้ำ. "
             "YOLO26 เด่นเรื่องวัตถุเล็ก (STAL) ช่วยนับมอเตอร์ไซค์ซึ่งมีมากในขอนแก่น. "
             "Edge ส่งเฉพาะ metadata (จำนวน/ความยาวคิว/คะแนนความหนาแน่น) ไม่ส่งวิดีโอดิบ."},
    {"title": "Multi-Agent Orchestration (5 agents)",
     "tags": "agent orchestrator multi-agent สัญญาณไฟ anomaly route business feedback",
     "text": "Orchestrator Agent ประสาน 5 sub-agents: 1) Signal Timing Optimizer ปรับเวลาไฟ, "
             "2) Anomaly & Incident Detector (z-score + Gemini บรรยายเหตุการณ์), "
             "3) Route Guidance (Dijkstra ถ่วงน้ำหนักความหนาแน่น), "
             "4) Business Value & Cost (คำนวณ ROI/เวลา/น้ำมัน/PM2.5), "
             "5) Citizen Feedback Classifier (จัดประเภทเรื่องร้องเรียนด้วย Gemini)."},
    {"title": "Data Pipeline (สายข้อมูล)",
     "tags": "pipeline kafka spark mqtt mongodb postgis data ข้อมูล สตรีม streaming",
     "text": "สายข้อมูล: CCTV (RTSP) → Jetson (YOLO26+ByteTrack) → MQTT → Kafka "
             "→ Spark Streaming (สรุปทุก 30 วิ) → MongoDB (data lake) + PostgreSQL/PostGIS (GIS+users) "
             "→ Orchestrator Agent → Control Layer + Dashboards. Spark Batch รายวันสร้าง Time-of-Day Plan."},
    {"title": "ความเป็นส่วนตัว PDPA / ISO 27001",
     "tags": "pdpa iso ความปลอดภัย privacy security ยินยอม consent เข้ารหัส",
     "text": "วิดีโอดิบไม่ออกจากแยก ส่งเฉพาะ metadata. ข้อมูลตำแหน่ง/ตัวตนประชาชนต้องได้รับ "
             "ความยินยอม (consent) และถูกปกปิด (anonymize) ก่อนจัดเก็บตาม PDPA. "
             "ISO 27001: เข้ารหัสข้อมูลทั้ง at-rest/in-transit, RBAC, audit log."},
    {"title": "ทำไมต้องขอนแก่น (Context)",
     "tags": "ขอนแก่น khon kaen รถติด congestion เมือง ปัญหา 44.8 81",
     "text": "ขอนแก่นเป็นเมืองรถติดอันดับ 4 ของไทย (ความหนาแน่น 44.8%) และเป็นเมืองเดียวใน Top-5 "
             "ที่แย่ลงเรื่อย ๆ. ผู้เดินทางเสียเวลา ~81 ชม./ปีในชั่วโมงเร่งด่วน. "
             "LRT แพง (~26,900 ล้าน/สาย) และระบบ adaptive เต็มรูปแบบแพงเกินจะปูทั้งเมือง."},
]


def _read_doc_chunks() -> list[dict]:
    chunks: list[dict] = []
    files = list(_DOCS_DIR.glob("*.md")) if _DOCS_DIR.exists() else []
    for extra in ("CLAUDE.md", "README.md", "DEMO.md"):
        p = _ROOT / extra
        if p.exists():
            files.append(p)
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except Exception:
            continue
        # Split on blank lines into paragraphs, keep the nearest heading as title.
        heading = f.stem
        for para in re.split(r"\n\s*\n", text):
            para = para.strip()
            if para.startswith("#"):
                heading = para.lstrip("#").strip()[:80]
            clean = re.sub(r"[`*>|#]", "", para).strip()
            if 60 <= len(clean) <= 900:
                chunks.append({"title": f"{f.name} · {heading}", "tags": "", "text": clean})
    return chunks


_KB: list[dict] = _FAQ + _read_doc_chunks()


# --- Lexical retrieval -------------------------------------------------------
_word_re = re.compile(r"[a-zA-Z0-9]+")
_thai_re = re.compile(r"[฀-๿]+")


def _features(text: str) -> tuple[set[str], set[str]]:
    text = text.lower()
    words = set(_word_re.findall(text))
    grams: set[str] = set()
    for run in _thai_re.findall(text):
        for i in range(len(run) - 2):
            grams.add(run[i:i + 3])
        if len(run) <= 3:
            grams.add(run)
    return words, grams


# Pre-compute features per KB entry.
for _e in _KB:
    _e["_f"] = _features(_e["text"] + " " + _e.get("tags", "") + " " + _e["title"])


def _score(qw: set[str], qg: set[str], entry: dict) -> float:
    ew, eg = entry["_f"]
    word_overlap = len(qw & ew)
    gram_overlap = len(qg & eg)
    # tag/keyword hits weigh more
    tag_hits = sum(1 for w in qw if w in entry.get("tags", "").lower())
    return word_overlap * 2.0 + gram_overlap * 0.5 + tag_hits * 3.0


def _live_doc() -> dict:
    s = STATE.summary()
    top = STATE.top_congested(3)
    inc = STATE.incidents_list()[:3]
    top_txt = ", ".join(f"{t['name']} ({int(t['congestion_score']*100)}%)" for t in top)
    inc_txt = "; ".join(f"{i['location']} ({i['severity']})" for i in inc) or "ไม่มี"
    text = (
        f"สถานะระบบเรียลไทม์: เฝ้าระวัง {s['junctions_active']} แยก, "
        f"ความหนาแน่นเฉลี่ย {int(s['avg_congestion']*100)}%, "
        f"โหมด Auto {s['mode_auto']} / Manual {s['mode_manual']}, "
        f"เหตุการณ์ที่กำลังเกิด {s['active_incidents']} รายการ. "
        f"แยกที่หนาแน่นสุดตอนนี้: {top_txt}. เหตุการณ์ล่าสุด: {inc_txt}."
    )
    return {"title": "สถานะเรียลไทม์ (Live State)", "tags": "ตอนนี้ เรียลไทม์ สถานะ รถติด แยกไหน เหตุการณ์ now status live",
            "text": text}


def retrieve(query: str, k: int = 4) -> list[dict]:
    qw, qg = _features(query)
    live = _live_doc()
    live["_f"] = _features(live["text"] + " " + live["tags"])
    pool = _KB + [live]
    ranked = sorted(pool, key=lambda e: _score(qw, qg, e), reverse=True)
    out = []
    for e in ranked[:k]:
        if _score(qw, qg, e) <= 0:
            continue
        out.append({"title": e["title"], "snippet": e["text"]})
    return out or [{"title": live["title"], "snippet": live["text"]}]


# --- Generation --------------------------------------------------------------
def _compose_extractive(query: str, ctx: list[dict]) -> str:
    if not ctx:
        return ("ขออภัย ยังไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้ของระบบ "
                "ลองถามเกี่ยวกับ ต้นทุน/โหมด/AI/ข้อมูลเรียลไทม์/PDPA ดูได้ครับ")
    lead = ctx[0]["snippet"]
    extra = ""
    if len(ctx) > 1:
        extra = "\n\nข้อมูลเพิ่มเติม: " + ctx[1]["snippet"]
    return f"{lead}{extra}"


def _compose_gemini(query: str, ctx: list[dict], api_key: str) -> str | None:
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        context = "\n\n".join(f"[{c['title']}]\n{c['snippet']}" for c in ctx)
        prompt = (
            "คุณคือผู้ช่วย AI ของระบบจราจรอัจฉริยะ Urban IntelliFlow เมืองขอนแก่น. "
            "ตอบเป็นภาษาไทย กระชับ สุภาพ และอ้างอิงเฉพาะข้อมูลบริบทด้านล่างเท่านั้น "
            "ถ้าบริบทไม่พอ ให้บอกว่าไม่มีข้อมูล.\n\n"
            f"บริบท:\n{context}\n\nคำถาม: {query}\n\nคำตอบ:"
        )
        resp = model.generate_content(prompt)
        return (resp.text or "").strip() or None
    except Exception:
        return None


def answer(query: str) -> dict:
    query = (query or "").strip()
    if not query:
        return {"answer": "พิมพ์คำถามเกี่ยวกับระบบจราจรได้เลยครับ", "sources": [], "grounded": False, "model": "none"}
    ctx = retrieve(query, k=4)
    key = os.getenv("GEMINI_API_KEY")
    model_used = "extractive"
    text = None
    if key:
        text = _compose_gemini(query, ctx, key)
        model_used = "gemini-1.5-flash" if text else "extractive"
    if not text:
        text = _compose_extractive(query, ctx)
    return {
        "answer": text,
        "sources": [{"title": c["title"]} for c in ctx[:3]],
        "grounded": True,
        "model": model_used,
    }
