# MFU Parking Management System

ระบบจัดการลานจอดรถของมหาวิทยาลัยแม่ฟ้าหลวง สำหรับดูสถานะช่องจอดบนแผนผัง จัดการอาคารและกล้อง CCTV และบันทึกประวัติการจอดจากระบบตรวจจับรถและอ่านป้ายทะเบียน

[เริ่มใช้งาน](#getting-started) · [ตั้งค่ากล้องและโมเดล](#cctv-and-detection) · [การยืนยันตัวตนและ API](#authentication-and-api) · [โครงสร้างโปรเจกต์](#project-structure)

## Features

| ผู้ใช้งาน | ความสามารถ |
| --- | --- |
| Guest | เปิด Dashboard และดูแผนผังตัวอย่าง E4 ชั้น 4 |
| Public User (`public`) | สมัครบัญชีเพื่อดูสถานะช่องจอด จัดการข้อมูลรถ ดูประวัติการจอดของตนเอง และส่งคำร้องถึงเจ้าหน้าที่ |
| Student (`user`) | ดูแผนผังและสถานะช่องจอด จัดการข้อมูลรถ ดูประวัติการจอดของตนเอง และส่งคำร้องถึงเจ้าหน้าที่ |
| Staff (`staff`) | ดูช่องจอดและกล้องตามอาคาร ชั้น และประเภทรถ ปรับสถานะช่องจอด ดูประวัติการเปลี่ยนแปลง ส่งออกประวัติการจอดเป็น Excel และตอบคำร้อง |
| Admin (`admin`) | จัดการบัญชีเจ้าหน้าที่ อาคาร ชั้น แผนผัง และ CCTV preset รวมถึงสั่งเปิดหรือปิดการตรวจจับของแต่ละกล้อง |

เว็บใช้ Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS และ PrimeVue ฝั่ง API ใช้ Node.js, Express และ MongoDB ผ่าน Mongoose ส่วน `python-v2` รับภาพจากกล้อง RTSP ผ่าน OpenCV ใช้ YOLO ตรวจจับรถและป้ายทะเบียน ใช้ BoT-SORT ติดตามรถ และใช้ EasyOCR อ่านป้ายทะเบียนไทย

## Getting started

ใช้ Node.js **22.12 ขึ้นไป** พร้อม npm และ MongoDB ที่รันอยู่ แนะนำ Node.js 24 สำหรับการพัฒนา เว็บและ API เริ่มใช้งานได้ก่อนติดตั้ง Python หรือเชื่อมต่อกล้อง

```powershell
git clone https://github.com/ptk007/parking_management_system.git
cd parking_management_system
```

### 1. เปิด Backend

จากโฟลเดอร์หลักของโปรเจกต์

```powershell
cd parking-back
npm ci
npm start
```

ค่าเริ่มต้นคือพอร์ต `3000` และฐานข้อมูล `mongodb://127.0.0.1:27017/parking_management_system` เมื่อเชื่อมต่อ MongoDB และปรับฟิลด์เดิมของอาคาร ชั้น และผู้ใช้เรียบร้อยแล้ว API จะเริ่มรับคำขอ เปิด `http://localhost:3000/` เพื่อตรวจสอบว่า API ตอบกลับ

สร้างไฟล์ `parking-back/.env` เมื่อต้องการเปลี่ยนค่าเริ่มต้นหรือตั้งค่ากล้อง

| ตัวแปร | การใช้งาน |
| --- | --- |
| `PORT` | พอร์ตของ API ค่าเริ่มต้นคือ `3000` |
| `MONGODB_URI` | URI ของ MongoDB |
| `JWT_SECRET` | คีย์สำหรับลงนาม JWT ในโหมดพัฒนา Backend จะสร้างและเก็บคีย์ใน `parking-back/.jwt-secret` ถ้าเว้นค่านี้ไว้ เมื่อกำหนด `NODE_ENV=production` ต้องตั้งคีย์เอง |
| `PARKING_MODEL_API_KEY` | คีย์ร่วมระหว่าง Backend กับ Python สำหรับโหลด preset ซิงก์สถานะ runtime และรับเหตุการณ์จากโมเดล |
| `PARKING_PYTHON_EXECUTABLE` | พาธ Python สำหรับทดสอบการเชื่อมต่อและดูภาพ RTSP ค่าเริ่มต้นบน Windows คือ `C:\py_venv\.venv\Scripts\python.exe` และบนระบบอื่นคือ `python3` |

### 2. เปิด Frontend

เปิดอีกเทอร์มินัลจากโฟลเดอร์หลักของโปรเจกต์

```powershell
cd parking-front
npm ci
npm run dev
```

เปิด URL ที่ Vite แสดง โดยปกติคือ `http://localhost:5173` เว็บจะเรียก API ที่ `http://localhost:3000/api` หาก Backend ใช้ URL อื่น ให้ตั้ง `VITE_API_BASE_URL` ใน `parking-front/.env.development.local` แล้วเปิด Vite ใหม่ สำหรับ production build ให้ตั้งตัวแปรนี้เป็น URL จริงก่อน build เพราะค่าใน `.env.production` เป็นตัวอย่าง

### 3. เข้าสู่ระบบบนฐานข้อมูลใหม่

เลือก **Register** เพื่อสมัครบัญชี **Public User** หรือ **Student** จากนั้นเข้าสู่ระบบด้วยประเภทบัญชีที่เลือกไว้ เลือก **Guest User** เพื่อเปิด Dashboard และดูแผนผังตัวอย่างได้ทันที สำหรับฐานข้อมูลใหม่ ให้สร้าง Admin คนแรกด้วยคำสั่งด้านล่างใน PowerShell จาก `parking-back` หลังจากติดตั้ง npm dependencies และเปิด MongoDB แล้ว

```powershell
@'
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const { randomBytes } = require("node:crypto");
const User = require("./api/models/userModel");
const { getBangkokUpdatedDateTime } = require("./api/utils/dateTime");

async function createLocalAdmin() {
  const uri = process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/parking_management_system";
  await mongoose.connect(uri);

  const username = "local-admin";
  if (await User.exists({ username })) {
    throw new Error("The username local-admin already exists.");
  }

  const password = randomBytes(18).toString("hex");
  await User.create({
    username,
    password,
    name: "Local Admin",
    role: "admin",
    ...getBangkokUpdatedDateTime(),
  });
  console.log({ username, password });
}

createLocalAdmin().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
'@ | node
```

นำชื่อผู้ใช้และรหัสผ่านที่แสดงไปล็อกอินผ่าน **Staff/Admin** จากนั้นสร้างบัญชีเจ้าหน้าที่ใน **Staff Manager** และเพิ่มอาคารกับชั้นใน **System Setup** คำสั่งใช้ User model เพื่อให้ระบบแฮชรหัสผ่านก่อนบันทึก

## CCTV and detection

การตรวจจับแบบสดผ่าน `python-v2` ใช้ Windows, Python Launcher (`py`) และ NVIDIA GPU ที่ใช้ CUDA ได้ เครื่องที่รัน Backend ต้องเข้าถึงเครือข่ายของกล้อง RTSP และจะใช้ไฟล์โมเดลรถกับป้ายทะเบียนใน `python-v2/models/`

1. จาก `python-v2` เตรียม virtual environment ที่ runner ใช้ แล้วติดตั้ง dependencies

   ```powershell
   if (-not (Test-Path 'C:\py_venv\.venv\Scripts\python.exe')) {
     py -m venv C:\py_venv\.venv
   }
   .\install.bat
   ```

2. ตั้ง `PARKING_MODEL_API_KEY` ใน `parking-back/.env` แล้วเปิด Backend ใหม่ บน Windows Backend จะเรียก `python-v2/run.bat` เพื่อรอคำสั่งตรวจจับ และหยุด Python runtime เมื่อปิด Backend
3. ใน **System Setup** เพิ่มอาคารและชั้น นำเข้าไฟล์ JSON แหล่งกล้อง แล้วสร้าง CCTV preset พร้อมแหล่ง RTSP และไฟล์ JSON ที่ระบุตำแหน่งช่องจอดแบบ COCO
4. ใน **Parking Map** ตั้งชั้นเป็น **Disable** เพื่อแก้แผนผังและผูกช่องบนแผนผังกับช่องจอดจาก preset แล้วตั้งชั้นกลับเป็น **Available**
5. เปิด **Detection** ในรายการกล้องหากยังปิดอยู่ กล้องแต่ละตัวจะใช้ worker ของตัวเอง การผูกช่องจอดช่วยให้ผลตรวจจับอัปเดตแผนผังและบันทึกเหตุการณ์เข้า–ออกจากช่องจอด ส่วนการดูภาพตรวจจับทำได้ก่อนผูกช่อง

ภาพดิบจากกล้องใช้ Python/OpenCV และดูได้ขณะปิด Detection เมื่อเปิด Detection เว็บจะแสดงเฟรมที่ worker ประมวลผลแล้ว ดูรายละเอียดการรันและไฟล์ผลลัพธ์เพิ่มเติมใน [Python runtime README](python-v2/README.md)

## Authentication and API

บัญชีจริงใช้รหัสผ่านที่แฮชด้วย bcrypt และ Bearer JWT อายุ 8 ชั่วโมง Backend ตรวจ JWT และสถานะบัญชีบนเส้นทางที่ใช้ middleware ฝั่งเว็บมี route guard สำหรับหน้าผู้ดูแลระบบและหน้าประวัติการจัดการช่องจอด ส่วน Guest มี session ในหน่วยความจำของเว็บจนกว่าจะรีเฟรชหรือออกจากระบบ

| กลุ่ม API | หน้าที่ |
| --- | --- |
| `/api/auth` | สมัครบัญชี Public User และ Student ผ่าน `POST /api/auth/register` เข้าและออกจากระบบ ตรวจ token และอ่านข้อมูลบัญชีปัจจุบัน |
| `/api/users` | จัดการบัญชีเจ้าหน้าที่โดย Admin |
| `/api/vehicles` | ข้อมูลรถและการค้นหารถตามเจ้าของ |
| `/api/admin/system/buildings` และ `/api/admin/system/floors` | จัดการอาคาร ชั้น แผนผัง ไฟล์ช่องจอด และกล้อง รวมถึง catalog ที่ Dashboard ใช้ |
| `/api/parking-logs` | ประวัติการจอดของผู้ใช้และเจ้าหน้าที่ ส่งออก Excel และรับเหตุการณ์จากโมเดล |
| `/api/support/tickets` | เปิดคำร้อง สนทนา รับเรื่อง และเปลี่ยนสถานะคำร้อง |
| `/api/model-runtime` | ส่ง preset ให้ Python และซิงก์สถานะ worker ผ่าน `x-model-api-key` |

ใช้ข้อมูลทดสอบเมื่อรันในเครื่อง ปัจจุบัน `/api/vehicles` เป็น public endpoint ควรจำกัดการเข้าถึง Backend ก่อนเปิดใช้งานภายนอก และเก็บคีย์กับข้อมูลเชื่อมต่อกล้องไว้ฝั่งเซิร์ฟเวอร์ ดูเส้นทางและ middleware ใน [Backend routes](parking-back/api/routes/)

## Project structure

| โฟลเดอร์ | เนื้อหา |
| --- | --- |
| [`parking-front/`](parking-front/) | เว็บ Vue, หน้าจอตามบทบาท, Pinia stores และ API client |
| [`parking-back/`](parking-back/) | Express API, โมเดล MongoDB, migrations และชุดทดสอบ |
| [`python-v2/`](python-v2/) | ตัวอ่าน RTSP, ตัวควบคุม worker, โมเดลตรวจจับ และตัวส่งเหตุการณ์กลับ Backend |
| [`images/`](images/) และ [`json_file/parking_slots/`](json_file/parking_slots/) | รูปอาคารและผู้ใช้ รวมถึงไฟล์ JSON ช่องจอดที่ Backend จัดเก็บ |
| [`cctv/`](cctv/) | ไฟล์รายการกล้อง |
| [`docs/`](docs/) | รายงานโครงงานและแบบอ้างอิง UI |

## Development commands

| โฟลเดอร์ | คำสั่ง | การใช้งาน |
| --- | --- | --- |
| `parking-back` | `npm run dev` | เปิด API ด้วย Nodemon |
| `parking-back` | `npm test` | รัน Node.js tests โดย integration tests ใช้ MongoDB ในเครื่องที่พอร์ต `27017` |
| `parking-front` | `npm run build` | ตรวจชนิดข้อมูลและ build เว็บ |
| `parking-front` | `npm run test:unit -- --run` | รัน Vitest หนึ่งรอบ |
| `parking-front` | `npx playwright install` แล้ว `npm run test:e2e` | ติดตั้งเบราว์เซอร์และรัน Playwright |

## Documentation

- [การตั้งค่าเครื่องมือและคำสั่ง Frontend](parking-front/README.md)
- [การติดตั้งและใช้งาน Python CCTV Runtime](python-v2/README.md)
- [รายงานโมเดลตรวจจับรถ](docs/Parking_Detection_Model_Project_Report.md)
- [ภาพอ้างอิง UI](docs/UI/)
