# Implementation Roadmap — สิ่งที่ต้องทำเพิ่มทั้งหมด (พร้อมวิธีทำ)

> Urban IntelliFlow · แผนพัฒนาสู่ Production ฉบับละเอียด
> สัญลักษณ์: **P0** = ต้องมีก่อน production · **P1** = สำคัญ · **P2** = ต่อยอด
> effort = (เวลาทีมคน / เวลาเมื่อใช้ AI ช่วย)

---

# 0. สถานะปัจจุบัน (Baseline ที่ทำเสร็จแล้ว)

✅ Frontend React+TS (4-5 หน้า, light/dark, login portal ผู้ใช้/ตำรวจ, RAG assistant)
✅ Backend FastAPI + Orchestrator + 5 agents (rule-based) + RAG + auth (demo) + 11 tests
✅ Simulator ขับ dashboard สด · แผนที่ขอนแก่นจริง · provisioning status ซื่อสัตย์
✅ Edge `detector.py` (YOLO26+ByteTrack) · docker-compose (Kafka/Mongo/PostGIS/MinIO/Mosquitto)

> ทุกอย่างข้างบนคือ **โปรโตไทป์** — ด้านล่างคือสิ่งที่ต้องทำให้เป็นของจริง

---

# Workstream A — Edge & Hardware (จาก simulator → Jetson จริง)

### A1. ติดตั้ง Jetson + รัน YOLO26 บนเครื่องจริง **[P0 · 1-2 สัปดาห์/แยก]**
- **ทำยังไง:** flash JetPack → ติดตั้ง `ultralytics`+PyTorch → รัน `detector.py` กับ RTSP จริง → export โมเดลเป็น **TensorRT** เพื่อเร่งความเร็ว (`yolo export format=engine`)
- **เครื่องมือ:** JetPack, TensorRT, DeepStream (ออปชัน), OpenCV
- **เสร็จเมื่อ:** Jetson นับรถจากกล้องจริงได้ ≥15 FPS ส่ง metadata ออก MQTT

### A2. ปรับเทียบกล้อง (Homography Calibration) **[P0 · 2-3 วัน/แยก]**
- **ทำยังไง:** วัดจุดอ้างอิงบนถนน 4 จุด → คำนวณ homography → แปลงพิกเซลเป็นเมตร → ได้ความเร็ว/คิว (เมตร) จริง
- **ข้อมูล:** จุดพิกัดจริงบนผิวถนน (วัดหน้างาน/จาก 3D scan)
- **เสร็จเมื่อ:** avg_speed_kmh, queue_length_m แม่นเทียบ ground truth ±15%

### A3. ต่อ Smart PLC ผ่าน Modbus **[P0 · 1 สัปดาห์]**
- **ทำยังไง:** ใช้ `pymodbus` เขียนค่าเข้า register ของ relay (ตามผัง Modbus ที่ทีมออกแบบ: coil 1-6 = ไฟ NS/EW, holding 40001 watchdog ฯลฯ)
- **เครื่องมือ:** Waveshare Modbus relay, pymodbus
- **เสร็จเมื่อ:** สั่งเปลี่ยนไฟจริงที่แยกนำร่องได้ + watchdog heartbeat ทำงาน

### A4. Fail-safe (Aerospace pattern) **[P1 · 1 สัปดาห์]**
- **ทำยังไง:** microcontroller สำรองอ่าน DS3231 RTC → ถ้า heartbeat หาย >5s ตกไป Alternate Law (ตารางเวลาคงที่/ไฟกระพริบ)
- **เสร็จเมื่อ:** ถอดปลั๊ก Jetson แล้วไฟยังทำงานปลอดภัย

---

# Workstream B — Data Pipeline (ต่อท่อจริง + ฐานข้อมูล)

### B1. MQTT → Kafka → Spark Streaming จริง **[P0 · 1-2 สัปดาห์]**
- **ทำยังไง:** bridge MQTT→Kafka → Spark Structured Streaming อ่าน topic `intelliflow.metrics` → คำนวณ 30s window → เขียนลง Mongo/Postgres (แทน simulator)
- **เครื่องมือ:** `aiokafka`/confluent-kafka, PySpark, **Schema Registry** (Avro/Protobuf) กัน schema พัง
- **เสร็จเมื่อ:** ปิด `INTELLIFLOW_SIM` แล้ว dashboard ยังมีข้อมูลจาก edge จริง

### B2. MongoDB (Data Lake) จริง **[P0 · 3-5 วัน]**
- **ทำยังไง:** ODM `Beanie/Motor` → สร้าง collections: `metrics_30s`, `incidents`, `agent_logs`, `complaints`, `comments`, `camera_events`
- **ข้อมูล:** สตรีม metric จาก edge; ตั้ง **TTL index** (เช่น 90 วัน) เพื่อ retention (PDPA)
- **เสร็จเมื่อ:** อ่าน/เขียนผ่าน ODM, มี index (junction_id, ts)

### B3. PostgreSQL + PostGIS จริง **[P0 · 1 สัปดาห์]**
- **ทำยังไง:** SQLAlchemy/SQLModel + **Alembic** migration → สร้างตาราง: `users, consents, junctions(geom), road_network, edge_nodes, cameras, signal_plans, time_of_day_plans, trips, kpi_daily, audit_log`
- **ข้อมูล:** **OSM road network ขอนแก่น** → PostGIS ด้วย `osm2pgrouting`; พิกัดแยก; ทะเบียนกล้อง
- **เสร็จเมื่อ:** routing (pgRouting) ทำงานบนถนนจริง + consent/audit เก็บได้

### B4. MinIO + Data Quality + Lineage **[P1 · 3-5 วัน]**
- **ทำยังไง:** MinIO เก็บ object (วิดีโอ transient/point cloud/logs); **Great Expectations** ตรวจคุณภาพข้อมูล; data catalog
- **เสร็จเมื่อ:** มี validation gate ก่อนเข้า warehouse

### B5. Spark Batch รายวัน → Time-of-Day Plan **[P1 · 1 สัปดาห์]**
- **ทำยังไง:** งาน batch รวมข้อมูลย้อนหลัง → สร้างแผนเวลาไฟต่อช่วงเวลา + KPI daily; orchestrate ด้วย **Airflow/Dagster**
- **เสร็จเมื่อ:** มี time_of_day_plans + kpi_daily อัปเดตทุกคืน

---

# Workstream C — ML / AI (ทำให้ฉลาดจริง + เรียนรู้เอง)

### C1. 🔴 โมเดลพยากรณ์จราจร (ขาดสำคัญสุด) **[P1 · 3-4 สัปดาห์]**
- **ทำยังไง:** เทรน **Spatio-Temporal GNN** (DCRNN/Graph WaveNet) หรือ **Temporal Fusion Transformer** บนข้อมูลย้อนหลัง → ทำนายความหนาแน่นล่วงหน้า 15-30 นาที → ป้อน Signal Timing ให้ปรับ "ก่อน" รถติด
- **ข้อมูล:** ประวัติ metrics + ปฏิทินอีเวนต์/วันหยุด/สภาพอากาศ
- **เสร็จเมื่อ:** MAE พยากรณ์ < เกณฑ์ + dashboard โชว์ "คาดการณ์ 30 นาที"

### C2. Re-ID + Anomaly ML **[P1 · 1-2 สัปดาห์]**
- **ทำยังไง:** ใส่โมเดล **OSNet/FastReID** สำหรับรวมรถซ้ำข้ามกล้อง; **autoencoder/Isolation Forest** เสริม z-score
- **เสร็จเมื่อ:** unique count แม่นขึ้น + จับ anomaly ได้ดีกว่า z-score เดี่ยว

### C3. RL Signal Control (ในซิม) **[P2 · 4-6 สัปดาห์]**
- **ทำยังไง:** สร้างซิม **SUMO/CityFlow** ของแยกขอนแก่น → เทรน **PPO/DQN** (reward = −person-delay) → รัน **shadow mode** → ครอบด้วย rule-based เสมอ
- **เครื่องมือ:** SUMO, Ray RLlib
- **เสร็จเมื่อ:** ลด delay ในซิม >10% และผ่าน safety check ทุกกรณี

### C4. Self-Optimization Loop (เรียนรู้เองจาก feedback) **[P1 · 2-3 สัปดาห์]**
- **ทำยังไง:** **Active learning** (edge อัปโหลดเฉพาะ crop ที่ไม่มั่นใจ) + auto-label จาก ByteTrack + **nightly fine-tune** + **federated learning** (ส่ง weight ไม่ส่งภาพ) + drift detection → trigger retrain
- **Feedback คน:** ตำรวจแก้ label → active learning; ตำรวจ override → imitation learning; 👍/👎 ผู้ช่วย → RLHF/DPO (เฉพาะ assistant)
- **⚠️ กันปั่น:** aggregate + ถ่วงน้ำหนัก feedback (ตำรวจ > ประชาชนนิรนาม)
- **เสร็จเมื่อ:** mAP ดีขึ้นจาก data จริงโดยอัตโนมัติ + MLOps loop ทำงาน

### C5. RAG → Production grounding **[P1 · 1 สัปดาห์]**
- **ทำยังไง:** เปลี่ยน retriever เป็น **pgvector/Qdrant** + embedding ไทย **BGE-M3** + re-ranker → ground ด้วย **ข้อมูลปฏิบัติการ** (incidents, junction metadata, SOP, พ.ร.บ.) แทน README → กลายเป็น Operations Copilot
- **เสร็จเมื่อ:** ตอบ "ทำไมแยกนี้ปรับเวลา" จาก log จริง + มี citation

### C6. Gemini จริง + LLM ไทย self-host **[P1 · 3-5 วัน]**
- **ทำยังไง:** ใส่ `GEMINI_API_KEY` (Agent 2/5); ทางเลือก self-host **Typhoon/Qwen/Llama** เพื่อ PDPA (ข้อมูลไม่ออกนอกประเทศ)
- **เสร็จเมื่อ:** บรรยายเหตุ/จัดเรื่องร้องเรียนด้วย LLM จริง

---

# Workstream D — Backend/API & Auth

### D1. Keycloak + OIDC (แทน auth in-memory) **[P0 · 1-2 สัปดาห์]**
- **ทำยังไง:** ติดตั้ง **Keycloak** (self-host) → federate **LINE/Google/ThaiID** (ประชาชน) + **SSO องค์กร + MFA** (เจ้าหน้าที่) → FastAPI ตรวจ OIDC token ด้วย `Authlib`
- **เสร็จเมื่อ:** login ผ่าน LINE/Google ได้จริง + เจ้าหน้าที่ใช้บัญชีองค์กร + RBAC จาก token

### D2. ความแข็งแรงของ API **[P1 · 3-5 วัน]**
- **ทำยังไง:** rate limiting, input validation, pagination, error handling, OpenAPI docs, CORS เฉพาะ origin
- **เสร็จเมื่อ:** ผ่าน security review เบื้องต้น

---

# Workstream E — Control & Safety (Rule-Based เป็นแกน)

### E1. Rule-Based Safety Layer **[P0 · 1-2 สัปดาห์]**
- **ทำยังไง:** ใส่กฎแข็ง: min/max green, **all-red clearance**, เวลาคนข้ามขั้นต่ำ, **conflict monitor** (ห้ามเขียวชนกัน) → ML เสนอได้เฉพาะในกรอบนี้
- **เสร็จเมื่อ:** ทุกแผนจาก ML ถูกกรองด้วยกฎ ไม่มีสถานะอันตราย

### E2. Shadow Mode + Apply Plan **[P1 · 1 สัปดาห์]**
- **ทำยังไง:** รัน optimizer แบบ shadow (log แต่ไม่สั่ง) เทียบผลก่อน → ค่อยเปิด apply จริงทีละแยก
- **เสร็จเมื่อ:** มีรายงานเทียบ shadow vs ของเดิม

---

# Workstream F — Frontend / Apps

### F1. ความซื่อสัตย์ของ Business Value **[P0 · 1 วัน]**
- **ทำยังไง:** ติดป้าย **"ประมาณการจากสมมติฐาน"** + แสดงที่มา/สูตร จนกว่าจะมีข้อมูล pilot จริง
- **เสร็จเมื่อ:** ผู้ใช้รู้ว่าตัวเลขไหนวัดจริง ตัวเลขไหนประมาณการ

### F2. Consent UI + สิทธิ์เจ้าของข้อมูล **[P0 · 3-5 วัน]**
- **ทำยังไง:** หน้า consent (เก็บ trip/GPS), ปุ่ม **ดาวน์โหลด/ลบข้อมูลของฉัน**, privacy notice
- **เสร็จเมื่อ:** ใช้สิทธิ์ PDPA (เข้าถึง/ลบ/คัดค้าน) ได้จริง

### F3. ปรับปรุงเทคนิค + Power BI **[P1-P2 · 1 สัปดาห์]**
- **ทำยังไง:** ใช้ **TanStack Query** แทน polling เอง; เชื่อม **Power BI** กับ warehouse จริง (ผู้บริหาร); ฟีเจอร์ "ออกตอนไหนดี" (ใช้ prediction)
- **เสร็จเมื่อ:** dashboard ผู้บริหารใช้ข้อมูลจริง

---

# Workstream G — Governance / PDPA / Security (P0 ทั้งหมด)

### G1. DPIA + DPO + RoPA **[P0 · 1-2 สัปดาห์]**
- ทำ Data Protection Impact Assessment ก่อน deploy · แต่งตั้ง DPO (ม.41) · ขึ้นทะเบียนกิจกรรมประมวลผล

### G2. มาตรการเชิงเทคนิค **[P0 · 1-2 สัปดาห์]**
- ป้ายแจ้ง+privacy notice ทุกแยก · retention auto-delete · anonymize/blur ป้ายทะเบียน · **RBAC + audit log** · encryption at-rest/in-transit · แผน breach (แจ้ง สคส. ใน 72 ชม.)
- ผู้รับผิด: **เทศบาล = Data Controller**, ทีม dev = Processor (ต้องมี **DPA**); แชร์ให้ตำรวจ = **MOU/DSA**

---

# Workstream H — Infra / DevOps / MLOps

### H1. Container + Orchestration **[P0/P1 · 1-2 สัปดาห์]**
- Docker (มีบางส่วน) → **Kubernetes/K3s** (K3s ที่ edge) + Helm

### H2. Observability **[P1 · 1 สัปดาห์]**
- **Prometheus + Grafana + Loki** + **OpenTelemetry** + data/model **drift monitoring**

### H3. MLOps **[P1-P2 · 2 สัปดาห์]**
- **MLflow** (model registry) + **NVIDIA Triton** (serving) + **OTA edge fleet** (Balena/Jetson) อัปเดตโมเดลทางไกล + CI/CD (GitHub Actions มีแล้วบางส่วน)

---

# Workstream I — Pilot & Validation (ทำให้ตัวเลขเป็นจริง)

### I1. Pilot 1-3 แยก + วัด before/after **[P0 · 4-6 สัปดาห์]**
- **ทำยังไง:** เก็บ baseline 2-4 สัปดาห์ก่อนเปิดระบบ → เปิด adaptive → วัดเวลารอ/throughput/ความเร็ว → คำนวณ **เวลา/น้ำมัน/PM2.5/ROI จริง** พร้อมช่วงความเชื่อมั่น
- **เสร็จเมื่อ:** แทนค่าสมมติฐานในหน้า Business Value ด้วยตัวเลขวัดจริง

---

# ลำดับความสำคัญ (ถ้ามีเวลาจำกัด ทำ P0 ก่อน)

**Phase 1 (ต่อท่อจริง):** A1 A2 A3 · B1 B2 B3 · D1 · E1 · F1 F2 · G1 G2
**Phase 2 (สมอง+เรียนรู้):** B4 B5 · C1 C2 C4 C5 C6 · E2 · H1 H2
**Phase 3 (ต่อยอด):** A4 · C3(RL) · D2 · F3 · H3 · I1 (pilot วัดจริง)

> **ขั้นต่ำเพื่อให้น่าเชื่อถือระดับ production:** ทุกข้อ **P0** + pilot วัดจริง (I1)

---

# สรุปข้อมูลที่ต้องไปหา (Data Sources ที่ยังขาด)
OSM road network ขอนแก่น · พิกัดแยก/ทะเบียนกล้องจริง · ปฏิทินอีเวนต์/วันหยุด/ตารางโรงเรียน ·
สภาพอากาศ (TMD) · PM2.5 (Air4Thai) · ประวัติอุบัติเหตุ/งานถนน/น้ำท่วม · ตารางขนส่งสาธารณะ ·
Traffy Fondue · ข้อมูล baseline ก่อน/หลังจาก pilot (สำคัญสุดสำหรับ Business Value)

*Urban IntelliFlow — จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน*
