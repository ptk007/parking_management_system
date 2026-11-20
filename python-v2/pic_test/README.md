# ทดสอบโมเดลจากภาพนิ่งหลายภาพ

สคริปต์ `test_images.py` ใช้ weights และค่าหลักชุดเดียวกับ CCTV runtime เพื่อประมวลผลภาพหลายภาพในหนึ่งรอบ โดยโหลดโมเดลครั้งเดียวและส่งภาพ/ภาพ crop เข้า YOLO เป็น batch

## ความสามารถ

- ตรวจจับรถด้วย `trained_car_detector.pt` (input size 960, application confidence 0.80)
- วาดกรอบรถสีขาว โดยขยายกรอบแสดงผล 10% ตามค่าใน CCTV; ค่านี้ไม่เปลี่ยนกล่องที่ใช้ตัดสินใจ
- ตรวจจับและติดตามรถด้วย BoT-SORT + ReID ใน `--sequence` mode
- ตรวจป้ายทะเบียนด้วย `best_license_plate_detector.pt` (input size 640, confidence 0.30) หลังพบรถ; ขยาย car crop เพื่อ retry เมื่อผลตรวจป้ายยังอ่อน
- ขยาย plate crop 2 เท่า และเรียก EasyOCR ภาษาไทยหลังตรวจพบป้าย โดยไม่เรียก OCR หาก crop เบลอเกินเกณฑ์
- แสดง candidate OCR และรวมผลโหวตเมื่อมีภาพต่อเนื่องของ track เดียวกัน
- เปิดใช้ slot polygon/overlap ได้เมื่อภาพมาจากมุมกล้องเดียวกับ JSON ที่เลือก
- ส่งออก confidence, box coordinates, track, OCR, slot-overlap และเวลา inference เพื่อให้ตรวจดูได้

## วิธีใช้

เปิด PowerShell ที่โฟลเดอร์ `python-v2` แล้วรันภาพทั้งหมดใน `pic_test`:

```powershell
C:\py_venv\.venv\Scripts\python.exe .\pic_test\test_images.py
```

หากใช้ Python environment อื่นที่มี dependency ใน `requirements.txt` ติดตั้งครบ ให้แทน path ด้านบนด้วย Python ของ environment นั้น ตัวเลือก `--device auto` ใช้ CUDA เมื่อมีให้ใช้ มิฉะนั้นจะเลือก CPU

ทดสอบภาพเดียว:

```powershell
C:\py_venv\.venv\Scripts\python.exe .\pic_test\test_images.py --input .\pic_test\2.jpg --show
```

กำหนด batch size หรือ threshold เอง:

```powershell
C:\py_venv\.venv\Scripts\python.exe .\pic_test\test_images.py --input .\pic_test --batch-size 4 --plate-batch-size 8 --car-conf 0.80 --plate-conf 0.30
```

เปิด slot map **เมื่อ JSON และภาพเป็นมุมกล้องเดียวกันเท่านั้น**:

```powershell
C:\py_venv\.venv\Scripts\python.exe .\pic_test\test_images.py --input .\pic_test --slots-json .\parking_slots\E4_zoneA_cars.json
```

สำหรับภาพหลายภาพที่เป็นลำดับเวลา **จากกล้องเดียวกัน** ใช้ `--sequence`; ชื่อไฟล์จะเรียงแบบ natural order (`1.jpg`, `2.jpg`, `10.jpg`) และ tracker จะคง ID ข้ามภาพ:

```powershell
C:\py_venv\.venv\Scripts\python.exe .\pic_test\test_images.py --input .\pic_test\sequence --sequence --slots-json .\parking_slots\E4_zoneA_cars.json
```

ใช้ `--sequence` เฉพาะเมื่อภาพเป็นลำดับเวลาเดียวกัน ไม่ควรรวมภาพจากรถ/กล้อง/ฉากที่ต่างกัน เพราะ track ID และการโหวต OCR อาจเชื่อมกันผิด สำหรับเปรียบเทียบกับ CCTV ให้เลือกภาพตาม cadence เดียวกัน (runtime ตรวจทุก 8 เฟรม) และคงลำดับเวลาไว้

ตัวเลือกเพิ่มเติม:

```text
--no-plates     ข้ามโมเดลป้ายทะเบียน
--no-ocr        ตรวจกรอบป้าย แต่ไม่เรียก EasyOCR
--no-slots      ปิด slot overlay/overlap
--show          เปิดภาพผลลัพธ์ทีละภาพ (กดปุ่มใดก็ได้เพื่อไปภาพถัดไป, q เพื่อออก)
--output PATH   กำหนดโฟลเดอร์ output เอง
--device cpu    บังคับประมวลผลบน CPU
```

## ไฟล์ผลลัพธ์

แต่ละรอบสร้างโฟลเดอร์ใหม่ใต้ `pic_test/output/run_YYYYMMDD_HHMMSS/`:

| File | ใช้ดูอะไร |
|---|---|
| `annotated/<ชื่อภาพ>_result.jpg` | ภาพ overlay: car box, track ID (sequence mode), plate box, OCR และ slot evidence |
| `image_summary.csv` | จำนวนรถ/slot, slot candidate และเวลา inference ของ car batch |
| `detections.csv` | หนึ่งแถวต่อรถ: car confidence/box, track ID, slot overlap, plate confidence/box, OCR text/confidence, votes และสถานะ lock |
| `results.json` | ค่าตั้งต้นของรอบ, timing รวม และรายละเอียดผลของแต่ละภาพ |
| `slot_transitions.csv` | สร้างเมื่อใช้ `--sequence` และมีการเปลี่ยนสถานะ slot |

`car_batch_inference_ms` คือเวลาของ batch ทั้งชุดและจะแสดงซ้ำในแต่ละภาพที่อยู่ใน batch นั้น ไม่ใช่ latency แยกต่อภาพ ส่วนเวลาเฉลี่ยต่อภาพและเวลา plate/OCR รวมอยู่ใน `results.json`

## วิธีอ่านผลและข้อจำกัด

- `car_conf` คือ confidence ของรถ; detections ต่ำกว่า application threshold จะไม่ถูกส่งต่อ
- `plate_conf` คือ confidence ของกรอบป้าย; `ocr_conf` คือค่าเฉลี่ย confidence จาก EasyOCR
- `ocr_text` คือข้อความดิบที่อ่านได้; `stable_text`, `votes`, `vote_share`, `locked` แสดงการโหวตใน track เดียวกัน การทดสอบภาพแยกกันจะไม่มีการโหวตข้ามภาพ
- `slot_candidate` และ overlap score เป็นหลักฐานเชิงเรขาคณิตจากภาพนั้น ภาพนิ่งเดี่ยวไม่สามารถบอกได้ว่ารถกำลังเข้า จอดนิ่ง หรือกำลังออก
- `--sequence` ใช้ BoT-SORT และกฎหลักเรื่องเข้า slot/อยู่นิ่งเพื่อแสดงสถานะตามลำดับภาพ แต่ไม่ส่ง event เข้า backend และไม่ใช่การทดแทน CCTV runtime แบบเต็ม
- `no_car_detected` หมายถึงโมเดลไม่พบรถใน polygon นั้น ไม่ใช่ข้อพิสูจน์ว่า slot ว่าง
- Script นี้ไม่คำนวณ precision/recall/F1 เอง เพราะต้องมี ground-truth labels สำหรับภาพทดสอบ ให้เทียบผลกับ label ที่ทำไว้ก่อนจึงรายงาน accuracy
- ไฟล์ JSON/CSV อาจมีข้อความทะเบียนจริง ควรเก็บไว้ในที่จำกัดสิทธิ์และลบ/ปกปิดทะเบียนก่อนแชร์

ไฟล์รูปในโฟลเดอร์นี้มีหลายมุมและไม่จำเป็นต้องตรงกับ parking-slot JSON เดียวกันทั้งหมด จึงควรเริ่มโดยไม่ใส่ `--slots-json` แล้วค่อยเลือก JSON ที่ตรงกับกล้องจริง
