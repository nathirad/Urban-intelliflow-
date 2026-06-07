# Mock vs Real — เวอร์ชันปัจจุบันต้องทำอะไรต่อ + ต้องใช้ข้อมูลจริงอะไรบ้าง

> Urban IntelliFlow · สรุปตามสภาพโค้ดจริง (ณ เวอร์ชันปัจจุบัน)
> เป้าหมาย: ให้เห็นภาพชัด ว่าตอนนี้ "จำลอง (Mock)" ตรงไหน · จะเปลี่ยนเป็น "ของจริง" ต้องใช้ข้อมูล/อุปกรณ์อะไร · ทำที่ไฟล์ไหน · ทำยังไง

---

# 1. หลักการ (อ่านก่อน)

ระบบนี้ออกแบบให้ **รันโชว์ได้ทั้งหมดด้วยข้อมูลจำลอง** เพื่อสาธิต แต่เราติดป้ายความจริงไว้ทุกจุด
(เช่น ปุ่มเชื่อม Jetson ที่ปฏิเสธจริง, social login ที่บอกว่า "เดโม"). เอกสารนี้ไล่ทีละส่วนว่า
**Mock ตรงไหน → ต้องมีข้อมูลจริงอะไร → ทำที่ไฟล์ไหน → ทำยังไง**

สวิตช์หลัก: `INTELLIFLOW_SIM=1` (ค่าเริ่มต้น) = เปิด simulator. ตั้ง `=0` เมื่อจะต่อข้อมูลจริง

---

# 2. ตารางสรุป Mock → Real (ภาพรวม)

| # | ส่วน | ตอนนี้ (Mock) | อยู่ไฟล์ไหน | ข้อมูล/ของจริงที่ต้องใช้ |
|---|---|---|---|---|
| 1 | ข้อมูลจราจร | สุ่มตาม rush-hour curve | `backend/orchestrator.py` `_mock_event()` | กล้อง CCTV จริง + Jetson + YOLO26 |
| 2 | ที่เก็บสถานะ | in-memory | `backend/state.py` `STATE` | MongoDB + PostgreSQL/PostGIS |
| 3 | มูลค่าเศรษฐกิจ | ค่าคงที่ (สมมติฐาน) | `backend/agents/business_value.py` | วัด before/after จาก pilot |
| 4 | เข้าสู่ระบบ | in-memory + consent จำลอง | `backend/auth.py`, `oauth.py` | client id/secret + Keycloak |
| 5 | สถานะ Jetson/กล้อง | จำลอง (2 แยก "online") | `backend/state.py` `NODE_STAGE` | อุปกรณ์จริง + ทะเบียน device |
| 6 | เหตุการณ์ + คำบรรยาย | seed + z-score; Gemini เป็น template | `backend/agents/anomaly_detector.py` | `GEMINI_API_KEY` + เฟรมจริง |
| 7 | ผู้ช่วย AI (RAG) | ค้นจากเอกสารโปรเจกต์ (extractive) | `backend/rag.py` | pgvector + embedding + ข้อมูลปฏิบัติการ |
| 8 | แนะนำเส้นทาง | กราฟ 4 จุด hardcode | `backend/agents/route_guidance.py` `_GRAPH` | OSM road network + pgRouting |
| 9 | สั่งสัญญาณไฟ | rule-based บนข้อมูลจำลอง (print) | `backend/orchestrator.py` `_to_control_layer` | PLC จริง + Modbus |
| 10 | ประวัติเดินทาง/ความเห็น | seed + in-memory | `backend/state.py` `trips/comments` | การกระทำผู้ใช้จริง + consent |
| 11 | Heatmap/วิเคราะห์ | seed 24 ชม. + สุ่ม | `backend/state.py` `seed_demo_history()` | Spark batch จากประวัติจริง |
| 12 | สถิติตรวจจับกล้อง | สังเคราะห์จาก event | `backend/state.py` `update_junction()` | นับจาก Jetson จริง |

---

# 3. รายละเอียดทีละส่วน (ทำยังไง + ต้องมีข้อมูลอะไรจริง ๆ)

### 3.1 ข้อมูลจราจร (หัวใจ — Mock อันใหญ่สุด)
- **ตอนนี้:** `_mock_event()` สุ่มจำนวนรถ/ความเร็ว/คะแนนความหนาแน่นตามเวลา
- **ต้องมีข้อมูลจริง:** สตรีม **RTSP จากกล้อง CCTV** ทุกแยก + กล่อง **Jetson** ที่รัน `edge/detector.py` (YOLO26+ByteTrack)
- **ทำยังไง:** รัน edge จริง → ส่ง payload (node_id, junction_id, vehicle_count, queue_length_m, avg_speed_kmh, congestion_score, by_class) ผ่าน MQTT → Kafka → Spark → เขียนลง DB; ตั้ง `INTELLIFLOW_SIM=0`
- **ข้อมูลที่ต้องเตรียม:** รายการ RTSP URL ต่อกล้อง, การปรับเทียบ homography (แปลงพิกเซล→เมตร) ต่อแยก

### 3.2 ที่เก็บสถานะ (in-memory → DB จริง)
- **ตอนนี้:** ทุกอย่างอยู่ใน RAM (`state.py`) หายเมื่อ restart
- **ต้องมี:** **MongoDB** (metrics_30s, incidents, agent_logs, complaints, comments) + **PostgreSQL/PostGIS** (users, consents, junctions(geom), road_network, edge_nodes, cameras, signal_plans, trips, kpi_daily, audit_log)
- **ทำยังไง:** เพิ่ม ODM (Beanie/Motor) + SQLAlchemy/SQLModel + Alembic migration; เปลี่ยน reader/writer ใน `state.py` ให้อ่าน/เขียน DB
- **ข้อมูลที่ต้องเตรียม:** **OSM road network ขอนแก่น** (→ PostGIS ด้วย osm2pgrouting), **พิกัดแยกจริง**, ทะเบียนกล้อง/อุปกรณ์

### 3.3 มูลค่าเศรษฐกิจ (สมมติฐาน → วัดจริง)  ← ที่คุณถามบ่อย
- **ตอนนี้:** ค่าคงที่ใน `business_value.py` (เช่น TIME_SAVED_MIN_PER_COMMUTER=2.0, FUEL_*, PM25_*) = **สมมติฐานที่เราตั้งเอง**
- **ต้องมีข้อมูลจริง:** **baseline ก่อนติดตั้ง** (เวลารอ/ความเร็ว/ปริมาณรถ 2-4 สัปดาห์) + **หลังติดตั้ง** เพื่อหาส่วนต่างจริง
- **ทำยังไง:** เก็บจาก YOLO เอง + คำนวณ time/fuel/PM2.5 จริง พร้อมช่วงความเชื่อมั่น → แทนค่าคงที่; **ติดป้าย "ประมาณการ" จนกว่าจะมีข้อมูล pilot** (P0 ที่ทำได้เลย)
- **ข้อมูลที่ต้องเตรียม:** ปริมาณรถ baseline, ราคาน้ำมันจริง, ค่าปล่อย PM2.5 (Air4Thai), จำนวนผู้สัญจร/แยก

### 3.4 เข้าสู่ระบบ (โครงพร้อม รอ creds)
- **ตอนนี้:** บัญชี in-memory + เดโม; social login เด้ง **consent จำลอง** (มีโค้ด OAuth จริงใน `oauth.py` แล้ว)
- **ต้องมีข้อมูลจริง:** ลงทะเบียนแอปที่ LINE/Meta/Google/ThaiID → ได้ **client_id + client_secret** + ตั้ง **redirect URI**
- **ทำยังไง:** ใส่ env (`LINE_CHANNEL_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`) → ปุ่มจะ redirect ไป login จริงทันที (ไม่ต้องแก้โค้ด); production ใช้ **Keycloak** เป็น IdP กลาง + เจ้าหน้าที่ใช้ SSO+MFA

### 3.5 สถานะ Jetson/กล้อง (จำลอง แต่ซื่อสัตย์แล้ว)
- **ตอนนี้:** `NODE_STAGE` กำหนด 2 แยก online / 1 connecting / 2 planned; ปุ่มเชื่อม **ปฏิเสธจริง** ถ้าไม่มี `device_registered`
- **ต้องมีข้อมูลจริง:** Jetson จริงที่ลงทะเบียน (heartbeat MQTT) + RTSP handshake กับกล้องจริง
- **ทำยังไง:** ตั้ง `device_registered=True` เมื่อ Jetson จริงรายงานตัว; เปลี่ยน `connect_node` ให้ ping อุปกรณ์จริง/ทดสอบ RTSP
- **ข้อมูลที่ต้องเตรียม:** device id/serial, RTSP URL, network ของแต่ละแยก

### 3.6 เหตุการณ์ + Gemini (template → จริง)
- **ตอนนี้:** z-score บนข้อมูลจำลอง + seed; คำบรรยาย Gemini เป็น **ข้อความสำเร็จรูป** (ไม่มี API key)
- **ต้องมี:** `GEMINI_API_KEY` + เฟรมภาพจริงตอน anomaly
- **ทำยังไง:** ใส่ key → `anomaly_detector._describe_incident()` / `feedback_classifier` เรียก Gemini จริง (โค้ดมี comment ตัวอย่างไว้แล้ว)

### 3.7 ผู้ช่วย AI / RAG (เอกสาร → ข้อมูลปฏิบัติการ)
- **ตอนนี้:** `rag.py` ค้นแบบ lexical จาก **เอกสารโปรเจกต์ (docs/*.md)** + live state จำลอง, ตอบแบบ extractive
- **ต้องมี:** **pgvector/Qdrant** + embedding ไทย (BGE-M3) + ข้อมูลปฏิบัติการ (ประวัติเหตุการณ์, SOP, พ.ร.บ., metadata แยก) + (ออปชัน) LLM จริง
- **ทำยังไง:** เปลี่ยน retriever เป็น vector search; index ข้อมูลปฏิบัติการ → กลายเป็น Operations Copilot

### 3.8 แนะนำเส้นทาง (กราฟจิ๋ว → ถนนจริง)
- **ตอนนี้:** `_GRAPH` มี 4 จุด hardcode ใน `route_guidance.py`
- **ต้องมี:** **โครงข่ายถนนขอนแก่นจริง** ใน PostGIS + **pgRouting**
- **ทำยังไง:** import OSM → เปลี่ยน `_dijkstra` เป็น query pgRouting ถ่วงน้ำหนัก congestion จริง

### 3.9 สั่งสัญญาณไฟ (print → PLC จริง)
- **ตอนนี้:** `_to_control_layer()` แค่ print แผนเวลาไฟ
- **ต้องมี:** **PLC/relay จริง** ต่อ **Modbus** + **rule-based safety layer** (min/max green, conflict check)
- **ทำยังไง:** ใช้ `pymodbus` เขียนค่าเข้า register ตามผัง Modbus ของทีม; ML เสนอแผนภายใต้กรอบกฎ

### 3.10-3.12 ประวัติ/ความเห็น/heatmap/สถิติกล้อง
- **ตอนนี้:** seed + in-memory + สังเคราะห์จาก event จำลอง
- **ต้องมี:** การกระทำผู้ใช้จริง (+consent), Spark batch จากประวัติจริงใน Mongo, การนับจาก Jetson จริง

---

# 4. ✅ Checklist "ข้อมูล/ของจริงที่ต้องเตรียม" (รวมศูนย์)

**ฮาร์ดแวร์/เครือข่าย**
- [ ] กล้อง CCTV + RTSP URL ต่อแยก
- [ ] Jetson Nano/Orin ต่อแยก (+ device id, heartbeat)
- [ ] Modbus relay/PLC + ผัง register ของตู้ไฟ
- [ ] เครือข่าย (fiber/4G/LoRa) ต่อแยก

**ข้อมูล (Datasets)**
- [ ] **OSM road network ขอนแก่น** → PostGIS (routing) ← สำคัญสุด
- [ ] พิกัดแยกจริง + ทะเบียนกล้อง/อุปกรณ์
- [ ] **Baseline ก่อน/หลังติดตั้ง** (เวลารอ/ความเร็ว/ปริมาณรถ) ← ทำให้ตัวเลขเศรษฐกิจจริง
- [ ] สภาพอากาศ (TMD), PM2.5 (Air4Thai), ปฏิทินอีเวนต์/วันหยุด
- [ ] ข้อมูลปฏิบัติการสำหรับ RAG (SOP, พ.ร.บ.จราจร, ประวัติเหตุการณ์)

**Credentials/Config**
- [ ] OAuth: LINE/Facebook/Google/ThaiID client id + secret + redirect URI
- [ ] `GEMINI_API_KEY` (หรือ LLM ไทย self-host)
- [ ] MongoDB / PostgreSQL+PostGIS / MinIO / Kafka (โปรดักชัน)
- [ ] homography calibration ต่อกล้อง

---

# 5. ลำดับเปลี่ยน Mock → Real (ทำอันไหนก่อน)

1. **ทำได้เลย (ไม่ต้องรอฮาร์ดแวร์):** ติดป้าย "ประมาณการ" ที่ Business Value · ต่อ DB จริง (Mongo/Postgres) + OSM routing · ใส่ Keycloak/OAuth creds · ใส่ `GEMINI_API_KEY`
2. **รอฮาร์ดแวร์ pilot:** Jetson+กล้อง 1-3 แยก → ปิด simulator → ต่อ MQTT/Kafka/Spark จริง → Modbus PLC
3. **วัดผลจริง:** เก็บ before/after → แทนตัวเลขสมมติฐาน → RAG ต่อข้อมูลปฏิบัติการ → RL ในซิม

> **สรุป:** สิ่งที่ "จริง" แล้วในเวอร์ชันนี้ = สถาปัตยกรรม, โค้ด agents/edge/OAuth flow, UI ครบ, ความซื่อสัตย์ของสถานะ.
> สิ่งที่ "ยังจำลอง" = ข้อมูลจราจร, DB, ตัวเลขเศรษฐกิจ, อุปกรณ์ — ซึ่งเปลี่ยนเป็นจริงได้ตาม checklist ข้อ 4 โดยโครงสร้างไม่ต้องรื้อ

*Urban IntelliFlow — จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน*
