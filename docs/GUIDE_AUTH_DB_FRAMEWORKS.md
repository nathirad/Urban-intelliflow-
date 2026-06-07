# คู่มือ: ระบบล็อกอิน · Rule-Based vs ML · ฐานข้อมูล · Frameworks

> Urban IntelliFlow · เอกสารวิเคราะห์ + แนวทางปฏิบัติ (Guide)
> *วิเคราะห์ความจำเป็นจริง ไม่ใช่แค่ "ทำได้" — เน้นว่า "ควรทำ/ไม่ควรทำ" เพราะอะไร*

---

# 1. ระบบเข้าสู่ระบบ: LINE / Google / ThaiID / บัญชีกรมตำรวจ

**หลักคิด:** แยกผู้ใช้ 2 กลุ่ม ใช้วิธีล็อกอิน *คนละแบบ* เพราะระดับความเสี่ยง/ความน่าเชื่อถือต่างกัน

| กลุ่ม | วิธีที่แนะนำ | เหตุผล |
|---|---|---|
| **ประชาชน** | **LINE Login** + **Google OAuth** | คนไทยใช้ LINE มากที่สุด, ไม่ต้องจำรหัส, เข้าง่าย → ลด friction |
| ประชาชน (เมื่อต้องยืนยันตัวตนจริง) | **ThaiID (ThaID)** | KYC ระดับชาติ ใช้ตอนร้องเรียนที่มีผลทางกฎหมาย/รับสิทธิ์ — ไม่จำเป็นต้องบังคับทุกคน |
| **เจ้าหน้าที่ / ตำรวจ** | **SSO องค์กร (OIDC/SAML) + MFA** | ห้ามใช้ social login กับบัญชีปฏิบัติการ — ต้องผูกกับระบบ identity ของหน่วยงาน + audit + RBAC |

### ทำยังไง (สถาปัตยกรรม)
- ใช้ **Keycloak** (open-source Identity Provider, self-host) เป็นตัวกลาง:
  - federate **LINE / Google / ThaiID** ให้ประชาชน
  - federate **AD/LDAP/SSO ของเทศบาล-กรมตำรวจ** ให้เจ้าหน้าที่ + บังคับ MFA
  - ออก **OIDC token** มาตรฐานเดียว → backend (FastAPI) ตรวจ token ใบเดียวจบ
- ไลบรารี: `Authlib` (FastAPI), Keycloak adapters
- **PDPA:** ขอ scope เท่าที่จำเป็น, เก็บเฉพาะ claim ที่ใช้ (email/ชื่อ/role), บันทึก consent

### ความจำเป็น (วิเคราะห์)
- **จำเป็น** สำหรับ production — ระบบปัจจุบัน (PBKDF2 + token in-memory) เป็นแค่ demo
- **แต่ไม่ต้องทำทุกอันพร้อมกัน:** เริ่ม LINE + Google (ประชาชน) + บัญชีองค์กร (เจ้าหน้าที่) ก่อน → ThaiID เพิ่มทีหลังเมื่อมีฟีเจอร์ที่ต้องยืนยันตัวตนจริง

---

# 2. ต้องทำ Rule-Based ด้วยมั้ย? — **ต้อง และต้องเป็น "ชั้นหลัก"**

**วิเคราะห์ตรง ๆ:** การคุมสัญญาณไฟเป็น *safety-critical* — ใช้ ML/RL ล้วนไม่ได้ เพราะต้อง
**คาดเดาได้ + อธิบายได้ + ปลอดภัยเสมอ**. คำตอบคือ **Rule-Based เป็นแกนความปลอดภัย, ML เป็นตัว optimize ข้างบน**

```
   ┌─────────────────────────────────────────────┐
   │  ML Layer (advisory): YOLO นับรถ, พยากรณ์,    │  ← เสนอเวลาไฟที่ "ดีที่สุด"
   │  RL/Max-Pressure เสนอแผน                      │
   └───────────────┬─────────────────────────────┘
                   ▼  (ผ่านการกรองด้วยกฎ)
   ┌─────────────────────────────────────────────┐
   │  RULE-BASED (ชั้นหลัก / guardrails):          │  ← ห้ามละเมิดเด็ดขาด
   │  • min/max green, all-red clearance           │
   │  • conflict check (ห้ามเขียวชนกัน)            │
   │  • เวลาคนข้ามขั้นต่ำ                          │
   │  • fail-safe → ไฟกระพริบ/RTC fallback         │
   └─────────────────────────────────────────────┘
```

- นี่คือแนวคิด **"Normal Law / Alternate Law"** จากการบิน (มีในผังของทีมแล้ว): กฎคือเส้นที่ ML ห้ามข้าม
- Rule-based ยังใช้กับ: เกณฑ์ trigger เหตุการณ์, จัดเส้นทางร้องเรียน (keyword fallback), business rules
- **สรุป:** ไม่ใช่ทางเลือก — เป็นรากฐาน. ML ทำให้ "เก่งขึ้น" ภายในกรอบที่กฎกำหนด

---

# 3. หน้า "เศรษฐกิจ/Business Value": ต้องมี AI Agent วิเคราะห์ข้อมูลมั้ย?

**บริบท:** ตัวเลข (2.5M→150k, เวลา/น้ำมัน/PM2.5) ตอนนี้เป็น **สมมติฐานที่เราตั้งเอง ยังไม่ใช่ข้อมูลอ้างอิงจริง** — คุณเข้าใจถูกแล้ว

### วิเคราะห์ความจำเป็น (ตรงไปตรงมา)
> **คุณ *ไม่จำเป็น* ต้องมี "AI Agent/LLM" เพื่อทำให้ตัวเลขเป็นจริง.**
> สิ่งที่ทำให้มันจริงคือ **ข้อมูลวัดจริงจาก pilot + วิธีคำนวณที่โปร่งใส** — AI สร้าง ground truth ขึ้นมาเองไม่ได้

แยกให้ชัดว่าอะไร "จำเป็น" อะไร "เกินจำเป็น":

| สิ่งที่ต้องการ | ใช้อะไร | จำเป็นแค่ไหน |
|---|---|---|
| ทำให้ตัวเลขจริง | **วัด before/after จาก pilot 2-4 สัปดาห์** + สถิติ (ช่วงความเชื่อมั่น) | 🔴 จำเป็นสูง |
| คำนวณ/รวมผล | **pipeline วิเคราะห์ (Spark/Pandas)** ไม่ใช่ LLM | 🔴 จำเป็นสูง |
| อธิบายตัวเลขให้ผู้บริหารฟัง | **LLM agent** (narrate) | 🟡 มีก็ดี |
| วิเคราะห์ความไว (sensitivity: "ถ้าสมมติฐานเปลี่ยน ROI เปลี่ยนไง") | LLM + สูตร | 🟡 มีก็ดี |
| ดึง benchmark จากรายงาน/งานวิจัยมาเทียบ (พร้อม citation) | LLM + RAG | 🟡 มีก็ดี |
| เตือนเมื่อสมมติฐานเริ่มเพี้ยนจากของจริง | rule + monitoring | 🟡 มีก็ดี |

### สรุปคำแนะนำ (เป็นขั้น)
1. **ตอนนี้:** ติดป้ายให้ชัดว่าเป็น **"ประมาณการจากสมมติฐาน (assumptions)"** + แสดงที่มา/สูตร (ซื่อสัตย์ เหมือนปุ่มเชื่อมต่อ Jetson)
2. **Pilot:** วัดจริง → แทนค่าคงที่ด้วยตัวเลขจริง + ระบุความไม่แน่นอน
3. **ค่อยเพิ่ม (ถ้าจะมี):** "Insight/Explainability Agent" (LLM) ที่ **อธิบาย + ทำ sensitivity + อ้างอิงงานวิจัย** — แต่ **วิเคราะห์ ไม่ใช่กุตัวเลข**

> **บทเรียน critical thinking:** อย่าเอา AI ไปแก้ปัญหาที่จริง ๆ ต้องการ *ข้อมูลจริง + สถิติ*. AI agent ที่นี่มีค่าแค่ "อธิบาย/ตรวจสอบความสมเหตุสมผล" ไม่ใช่ "สร้างความจริง"

---

# 4. PostgreSQL + MongoDB: ถ้าจะทำจริง ต้องมีข้อมูลอะไรบ้าง

ตอนนี้มี `docker-compose` ตั้ง service ไว้ แต่ยังไม่มี schema/ข้อมูลจริง. แบ่งหน้าที่:

### 4.1 MongoDB (Data Lake — ข้อมูลไหลเยอะ, schema ยืดหยุ่น)
| Collection | เก็บอะไร | index/หมายเหตุ |
|---|---|---|
| `metrics_30s` | หน้าต่างจาก edge: junction_id, ts, count, queue, speed, congestion, by_class | index (junction_id, ts); **TTL** เพื่อ retention (PDPA) |
| `incidents` | เหตุการณ์ + Gemini description | (junction_id, ts) |
| `agent_logs` | กิจกรรม multi-agent | ts |
| `complaints` / `comments` | เรื่องร้องเรียน/ความเห็น | category, ts |
| `camera_events` / `reid_records` | event กล้อง, re-ID | camera_id, ts |

### 4.2 PostgreSQL + PostGIS (relational + spatial — เน้นความถูกต้อง + GIS + users)
| Table | คอลัมน์หลัก | ใช้ทำอะไร |
|---|---|---|
| `users` | id, email, name, role, auth_provider, created_at | บัญชีผู้ใช้/เจ้าหน้าที่ |
| `consents` | user_id, purpose, granted_at, withdrawn_at | **PDPA** consent log |
| `junctions` | id, name, **geom (POINT)**, zone, mode | แผนที่/ควบคุม |
| `road_network` | **geom (LINESTRING)**, cost, oneway | routing (pgRouting) |
| `edge_nodes` | id, junction_id, jetson_model, device_registered, last_heartbeat | provisioning/สถานะ |
| `cameras` | id, junction_id, rtsp_ref, status | ทะเบียนกล้อง |
| `signal_plans` | junction_id, green_s, red_s, valid_until, source | แผนเวลาไฟ |
| `time_of_day_plans` | junction_id, hour, plan | Spark batch output |
| `trips` | user_id, origin, dest, minutes, ts | **PDPA** ประวัติเดินทาง (consented) |
| `kpi_daily` | date, junction_id, person_delay, throughput | warehouse/รายงาน |
| `audit_log` | actor, action, target, ts | **ISO 27001** ตรวจสอบ |

### 4.3 ทำไมแบ่ง 2 ฐาน
- **Mongo** = firehose ข้อมูล metric/log จำนวนมหาศาล schema เปลี่ยนบ่อย
- **Postgres/PostGIS** = ความถูกต้องเชิงสัมพันธ์ (users/consent/audit) + งานเชิงพื้นที่ (แผนที่/routing) + warehouse

### 4.4 ข้อมูลตั้งต้นที่ต้องหามาใส่
- **โครงข่ายถนนขอนแก่น** (OSM extract → PostGIS ด้วย `osm2pgrouting`)
- **พิกัดแยก** (สำรวจ/OSM) + ทะเบียนกล้อง + node
- บัญชีผู้ใช้ (จาก IdP) + สตรีม metric จาก edge (จริงหรือ simulator)
- เครื่องมือ migration: **Alembic** (Postgres), **Beanie/Motor** (Mongo async)

---

# 5. Frameworks Guide (ใช้ตัวไหนในแต่ละชั้น)

| ชั้น | Frameworks / เครื่องมือ |
|---|---|
| **Edge AI** | Ultralytics (YOLO26), PyTorch, **TensorRT** (เร่งบน Jetson), DeepStream (ออปชัน), OpenCV, paho-mqtt |
| **Messaging** | Mosquitto (MQTT), **Apache Kafka** (`confluent-kafka`/`aiokafka`), Schema Registry (Avro/Protobuf) |
| **Stream/Batch** | **Apache Spark** (PySpark Structured Streaming), (ออปชัน Flink), orchestration: **Airflow/Dagster** |
| **Storage** | MongoDB (**Motor/Beanie**), PostgreSQL+PostGIS (**SQLAlchemy/SQLModel + Alembic**, pgRouting, **pgvector**), MinIO (`boto3`) |
| **Backend/API** | **FastAPI** + Pydantic + Uvicorn (ปัจจุบัน); (ออปชัน Node.js/NestJS) |
| **Auth/IdP** | **Keycloak** (OIDC/SAML, federate LINE/Google/ThaiID), Authlib |
| **AI/LLM/Agents** | Gemini SDK, **LangGraph/LangChain** (agent), **sentence-transformers/BGE-M3** (embedding), **Qdrant/pgvector** (vector), **MLflow** (registry), **NVIDIA Triton** (serving), **SUMO** (จำลองจราจรสำหรับ RL), Ray |
| **Frontend** | **React + Vite + TypeScript** (ปัจจุบัน), OpenLayers, recharts, (แนะนำเพิ่ม) **TanStack Query** แทน polling เอง |
| **Control** | **pymodbus** (Modbus RTU/TCP → PLC) |
| **Infra/DevOps** | Docker, **Kubernetes/K3s** (edge), Helm, **Prometheus+Grafana+Loki**, OpenTelemetry, GitHub Actions (CI) |
| **Security/Gov** | Keycloak (RBAC), **HashiCorp Vault** (secrets), audit logging, ISO 27001/27701 |

---

# 6. RL / RLHF: ให้ AI เรียนรู้เองจาก Feedback ประชาชน + ตำรวจ?

**วิเคราะห์ตรง ๆ:** ไอเดียดี แต่ต้อง "เลือกเครื่องมือให้ถูกงาน" — **RL ใช่, RLHF ส่วนใหญ่ผิดที่**

### 6.1 RL (Reinforcement Learning) สำหรับคุมไฟ — ใช่ แต่มีเงื่อนไข
- งานวิจัยพบ RL (DQN/PPO/multi-agent) ลด delay ได้ ~10-20% เหนือ rule-based
- **แต่ห้ามเทรน/ลองสด** — ต้อง:
  1. เทรนใน **ซิมูเลเตอร์** (SUMO/CityFlow) ก่อน
  2. รันแบบ **shadow mode** (เสนอแต่ไม่สั่งจริง) เทียบผล
  3. **ครอบด้วย rule-based guardrails** เสมอ (RL เสนอได้เฉพาะในกรอบที่ปลอดภัย)
- reward = −person-delay (+throughput, −stops) → **เป็นค่าที่วัดได้จริง** ไม่ต้องใช้คนมาให้คะแนน

### 6.2 RLHF — ผิดที่สำหรับ "คุมไฟ", ถูกที่สำหรับ "ผู้ช่วย AI"
- RLHF คือการ *จูน LLM ให้ตรงใจคน* (แบบ ChatGPT) — ใช้เมื่อ "รางวัล" เป็นความชอบเชิงอัตวิสัย
- **คุมไฟ ไม่ต้องการ RLHF** เพราะรางวัล (delay/throughput) **เป็นกลางและวัดได้** → ใช้ RL ธรรมดาดีกว่า
- **RLHF/DPO เหมาะกับ "ผู้ช่วย AI (RAG)"** — ปุ่ม 👍/👎 บนคำตอบ → จูนให้ตอบดีขึ้น (อันนี้ใช่!)

### 6.3 Feedback ของคน "ใช้ยังไงให้ถูก" (หัวใจของคำถามคุณ)
| แหล่ง feedback | ใช้ทำอะไร (ถูกวิธี) | เทคนิค |
|---|---|---|
| ตำรวจกด override/อนุมัติแผนไฟ | บันทึกเป็น "ตัวอย่างที่ดี" → เลียนแบบ | **Imitation Learning / DAgger / HITL** |
| ตำรวจแจ้ง "ตรงนี้จับผิด/นับพลาด" | แก้ label → เทรน YOLO ใหม่ | **Active Learning** (มีในแผน self-optimize) |
| ประชาชนร้องเรียน "ไฟแดงนานเกินที่ X" | เป็น *สัญญาณ/ข้อมูล* ปรับ reward weight + eval | reward shaping (ไม่ให้คุมไฟตรง ๆ) |
| 👍/👎 บนคำตอบผู้ช่วย AI | จูนผู้ช่วยให้ตอบดีขึ้น | **RLHF/DPO** (เหมาะตรงนี้) |

### 6.4 ความเสี่ยงที่ต้องกัน (critical)
- **อย่าให้ประชาชนเทรนสัญญาณไฟตรง ๆ** — เสี่ยงถูกปั่น (สแปม "ไฟแดงนาน" เพื่อให้ฝั่งตัวเองเขียว)
  → ต้อง *aggregate + ตรวจสอบ + ถ่วงน้ำหนัก* (feedback ตำรวจ > ประชาชนนิรนาม) + anti-gaming
- RL หา policy แปลก ๆ ได้ → ต้อง sim หนัก, มี safety constraint, monitoring, rollback

### 6.5 สรุป
- **RL: ใช่** (ในซิม → shadow → ครอบด้วยกฎ) reward วัดได้ ไม่ต้อง RLHF
- **RLHF: ใช้กับผู้ช่วย AI** (ไม่ใช่กับสัญญาณไฟ)
- **Feedback คน:** ตำรวจ → imitation/active learning; ประชาชน → reward shaping ที่ตรวจสอบแล้ว; ทั้งหมดวนเป็น **continual learning** (data drift → retrain)

---

# สรุปสั้น (Action)
1. **Auth:** Keycloak เป็นแกน — ประชาชนใช้ LINE/Google(+ThaiID), เจ้าหน้าที่ใช้ SSO องค์กร + MFA
2. **Rule-Based:** จำเป็น เป็นชั้นความปลอดภัยหลัก, ML optimize ข้างบนภายในกรอบกฎ
3. **AI Agent เศรษฐกิจ:** ไม่จำเป็นสำหรับ "สร้างตัวเลข" (ต้องวัดจริง) — มีค่าแค่ "อธิบาย/ตรวจสมเหตุสมผล". ตอนนี้ควรติดป้าย "ประมาณการ" ให้ซื่อสัตย์
4. **DB:** Mongo = metric/log firehose; Postgres/PostGIS = users/consent/audit + GIS/routing + warehouse. ต้องหา OSM road network + พิกัดแยกมาใส่
5. **Frameworks:** ตามตารางข้อ 5 — open-source/self-host first
6. **RL/RLHF:** RL คุมไฟ (ในซิม+shadow+กฎครอบ, reward วัดได้); RLHF ใช้กับผู้ช่วย AI; feedback ตำรวจ→imitation/active learning, ประชาชน→reward shaping ที่ตรวจสอบ (กันปั่น)

*Urban IntelliFlow — จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน*
