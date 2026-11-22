# โครงสร้าง UI ทุกหน้า — MFU Parking Management

เอกสารนี้แกะจาก source code ใน `parking-front` ณ วันที่ 7 พฤศจิกายน 2026 ครอบคลุม framework, layout, หน้าตาม route, แท็บ, ฟอร์ม, dialog และแหล่งข้อมูล เป็นการตรวจโค้ด ไม่ใช่ผลการทดสอบหน้าจอผ่าน browser ภาพใน `docs/UI` เป็น reference ที่มีอยู่ในโปรเจกต์ และอาจต่างจาก implementation ปัจจุบัน

## 1. Framework และแนวทางสร้าง UI

| ส่วน | สิ่งที่พบในโปรเจกต์ | หน้าที่ |
| --- | --- | --- |
| UI framework | Vue `^3.5.32` | Single File Component (`.vue`) และ Composition API |
| ภาษา | TypeScript `~6.0.0` | type ของ component, API และ state |
| Build | Vite `^8.0.8` | dev server และ build |
| Routing | Vue Router `^5.0.4` | เปลี่ยนหน้าและตรวจสิทธิ์ก่อนเข้า route |
| State | Pinia `^3.0.4` | auth, admin, dashboard, support chat |
| Styling | Tailwind CSS `^4.3.0` + scoped CSS | utility class ผสม CSS เฉพาะ component |
| UI library | PrimeVue `^4.5.5` | ลงทะเบียนใน `main.ts`; หน้าที่ตรวจส่วนใหญ่สร้าง control ด้วย HTML/CSS เอง |
| Icon | Lucide Vue, PrimeIcons | icon ของเมนูและ action |
| HTTP | Axios | service และแนบ Bearer token |
| แผนผังลานจอด | custom SVG editor | แสดง/วาดช่องจอด รูปร่าง ข้อความ และภาพพื้นหลัง |
| เครื่องมือทดสอบ | Vitest, Vue Test Utils, Playwright | มี config และไฟล์ทดสอบใน repository |

ตัวเลขข้างต้นเป็น version range ใน `package.json` ไม่ใช่การยืนยัน version ที่ติดตั้งจริง ส่วน `socket.io-client` มีใน dependencies แต่ไม่ควรสรุปว่า UI ทุกส่วนรับข้อมูลสดเพียงเพราะติดตั้ง package นี้

## 2. Layout กลางของระบบ

```text
App.vue
├── /login → LoginView เต็มหน้าจอ
└── หน้าอื่น
    ├── Sidebar — fixed ซ้าย กว้าง 138px
    ├── TopBar — sticky ด้านบน สูง 78px
    ├── main → RouterView
    └── ChatWidget — ผู้ใช้ที่ login และไม่ใช่ Guest/Admin
```

Sidebar มีตรามหาวิทยาลัย เมนูตามสิทธิ์ และปุ่มออกจากระบบด้านล่าง TopBar มีชื่อระบบ ชื่อผู้ใช้/บทบาท ข้อความ Online, avatar และปุ่มแจ้งเตือนสำหรับผู้ใช้ที่ไม่ใช่ Admin ปุ่มแจ้งเตือนเปิด support chat; Guest เห็นปุ่มที่ถูก disable

โทนหลัก: sidebar แดง `#cf4647`, active menu ชมพูอ่อน `#fdeceb`/ข้อความแดง `#9e2d25`, พื้นหลังแอปเทา `#d9d9d9`, header และ card สีขาว สถานะช่องจอดแยกสีตาม Available, Incoming, Occupied, Disabled

เนื้อหาหลายหน้ากำหนด `margin-left: 138px` เอง จึงยังไม่ได้รวมระยะ layout ทั้งหมดไว้ใน shell เดียว มี media query เฉพาะบาง component แต่ sidebar และ topbar ยังมีขนาดคงที่ ต้องเปิด browser ตรวจเพิ่มก่อนสรุปว่ารองรับมือถือครบทุกหน้า

## 3. รายการหน้าตาม route

นับได้ **8 route ที่แสดงเนื้อหา** โดยไม่นับ redirect และไม่แยกแท็บ/ฟอร์มที่อยู่ในหน้าเดียวกัน

| Route | หน้า / component | เงื่อนไขใน router |
| --- | --- | --- |
| `/login` | `views/staff/LoginView.vue` | เข้าได้โดยไม่ login |
| `/dashboard` | `views/staff/DashboardView.vue` | authenticated รวม Guest |
| `/history` | `views/staff/HistoryView.vue` | `canManageParking` |
| `/my-vehicle` | `views/user/MyVehicleView.vue` | authenticated รวม Guest |
| `/admin/dashboard` | `views/admin/DashboardView.vue` → dashboard section | Admin |
| `/admin/staff` | component เดียวกัน → staff section | Admin |
| `/admin/setup` | component เดียวกัน → setup section | Admin |
| `/admin/setup/floors/:floorId/parking-map` | `views/admin/ParkingMapView.vue` | Admin; lazy loaded |

Redirect: `/` → `/login`, `/admin/login` → `/login`, `/admin` → `/admin/dashboard`

Router ตรวจ token ก่อนเข้า route; ผู้ไม่มีสิทธิ์ Admin/จัดการลานจอดจะถูกส่งไป `/dashboard` ส่วน `canManageParking` ครอบคลุม Admin และ Staff ที่สถานะไม่ใช่ disable การเลือก Student หรือ Staff/Admin บนหน้า login เป็นสถานะของฟอร์ม ส่วนสิทธิ์ใช้งานจริงอิง auth store

| บทบาท | เมนู Sidebar |
| --- | --- |
| Admin | Dashboard, My Vehicles, Staff Manager, Parking Setup |
| Staff | Dashboard, My Vehicles, Slot Status Log |
| User / Guest | Dashboard, My Vehicles |

Admin เข้า `/history` ได้ตาม guard แต่ไม่มีเมนูนี้ใน Sidebar ของ Admin ส่วน Guest เข้า My Vehicles ได้ตาม route แต่ไม่ซิงก์รถกับ API

## 4. โครง UI รายหน้าและสถานะย่อย

### 4.1 Login — `/login`

```text
พื้นหลังรูปภาพ + พื้นที่ login กลางจอ
  ตรามหาวิทยาลัย / ชื่อระบบ
  [Student] [Staff/Admin]
  Guest User
        ↓ เลือกบทบาท
  [ย้อนกลับ]
  [Username]
  [Password]
  ข้อความผิดพลาด
  [Login / Logging in...]
```

เป็นสองสถานะใน route เดียว: เลือกประเภทผู้ใช้ และกรอกข้อมูลเข้าสู่ระบบ การเข้า Guest ไป dashboard ผ่าน guest auth ของแอป Login จริงเรียก `authService.login` ปุ่มถูก disable ระหว่างส่งข้อมูล

### 4.2 Dashboard ของ Staff / User — `/dashboard`

```text
Sidebar | TopBar
        | [Slots] [CCTV] [Log]
        | เนื้อหาตามแท็บ
```

User/Guest เห็นเฉพาะ Slots; Staff/Admin เห็นครบสามแท็บ

**Slots:** ใช้ `DashboardMap.vue` มีชื่อสถานที่ ปุ่มดู Sample map ปุ่มเปิด/ปิด filter, สรุปจำนวนช่องจอด และแผนผัง SVG ตัวกรองเป็นลำดับ Building → Floor → Vehicle; ยังไม่เลือกอาคารจะเลือกชั้นไม่ได้ และยังไม่เลือกชั้นจะเลือกประเภทรถไม่ได้

ใต้แผนที่มี legend และปุ่ม Enable/Disable สำหรับผู้มี `canManageParking` เมื่อมี parking map และเลือกช่องจอด ตัว editor อยู่ในโหมด readonly ด้านการวาด layout แต่ยังส่ง selection ให้ parent ได้ มี loading, error/retry, ยังไม่เลือกสถานที่ และยังไม่มี map แยกกัน

**CCTV:** grid ของ `CameraPreviewCard.vue` ใช้รายการ Entrance, Exit, Floor4 B6, Floor4 C3 ที่กำหนดในไฟล์ ภาพรถ/เสา/เวลาเป็น HTML/CSS ประกอบฉาก จึงยังไม่ใช่หลักฐานว่าต่อวิดีโอสดแล้ว

**Log:** banner แจ้งว่า Exited car log จะ reset หลัง 24 ชั่วโมง และรายการ `ParkingLogCard.vue` แสดงเจ้าของรถ ทะเบียน จังหวัด ยี่ห้อ รุ่น สี เวลา ช่องจอด และสถานะ รายการที่หน้าใช้อยู่เป็น array ตัวอย่าง; ข้อความ banner ไม่ได้ยืนยันว่ามีระบบล้างข้อมูลจริง

### 4.3 Slot Status Log — `/history`

หัวข้อ + คำอธิบาย Enable / Disable Slot Records + info tooltip ตามด้วย card รายการ แต่ละ card มีผู้แก้ไข อาคาร ชั้น ช่องจอด วันที่ เวลา และสถานะที่เปลี่ยนเป็น Enable/Disable ข้อมูลใน view เป็นตัวอย่างสองรายการ ยังไม่ดึงประวัติจาก API

### 4.4 My Vehicles — `/my-vehicle`

```text
[Cars] [Parking History]
  Cars → card รถแต่ละคัน + [แก้ไข] [ลบ] + card ปุ่มเพิ่ม
  History → ParkingLogCard

เพิ่มรถ → เลือก Car/Motor → ฟอร์ม → ยืนยันเพิ่ม → บันทึก
แก้ไข → ฟอร์มข้อมูลเดิม → บันทึก
ลบ → dialog ยืนยันพร้อมทะเบียน → ลบ
```

ชื่อแท็บเป็น Cars แต่รายการรองรับทั้งรถยนต์และมอเตอร์ไซค์ Card มี Brand, Model, Color, License Number, Province ฟอร์มมีข้อมูลเดียวกันและ dropdown จังหวัด มี loading, empty, load error, saving และ delete error

รายการรถและการเพิ่ม/แก้ไข/ลบต่อ `vehicleService` สำหรับผู้ใช้จริง ส่วน Guest ไม่ซิงก์ API แท็บ Parking History ยังใช้ข้อมูลตัวอย่าง Popup ประกอบด้วย type picker, form dialog, add confirmation และ delete confirmation

### 4.5 Admin Dashboard — `/admin/dashboard`

ใช้ `views/admin/DashboardView.vue` เป็น container แล้วฝัง `views/staff/DashboardView.vue` ผ่าน `<SharedDashboard embedded />` จึงใช้แท็บ Slots/CCTV/Log และคอมโพเนนต์ชุดเดียวกัน ไม่ใช่ dashboard implementation แยกชุด ระยะด้านซ้ายถูกปรับด้วย embedded mode

### 4.6 Staff Manager — `/admin/staff`

```text
Staff Manager                                  [+ Add Staff]
Staff List (จำนวน) / ข้อความเงื่อนไขการแก้ไข
  profile | ชื่อ / username / password / เวลา / status | edit/delete
```

มีสามโหมดในหน้าเดียว: list, add, edit ถ้าไม่มีข้อมูลจะแสดง empty state พร้อมปุ่มเพิ่มคนแรก แก้ไขได้เมื่อไม่ใช่ Online หรือ Logging in

ฟอร์มมี Staff Name, Username, Password, Confirm Password, ปุ่มดู/ซ่อนรหัสผ่าน, Add/Edit และ Cancel โหมด Add เพิ่มหลายฟอร์มได้ด้วย Add More Staff

`StaffFormPanel` ประกาศด้วย `defineComponent` และ `h()` อยู่ในไฟล์ Admin Dashboard รายการ Staff เริ่มว่างและการเพิ่ม/แก้ไข/ลบเปลี่ยนเฉพาะ Pinia memory ใน `stores/admin.ts` ยังไม่มีการเรียก API ใน flow นี้ การ refresh จึงไม่ใช่การโหลดรายการที่บันทึกไว้จาก server

### 4.7 Parking Setup — `/admin/setup`

```text
Parking Setup / เพิ่มอาคาร
  อาคาร (รูป, ชื่อ, ข้อมูลสรุปกล้อง, action)
    └── รายการชั้นและประเภทรถ
        ├── สถานะ / จำนวนช่องจอด
        ├── แก้ไข / ลบ
        ├── CCTV
        └── Parking Map
```

ใช้ `setupMode` สลับทั้งหมดแปดโหมดภายใน route เดียว:

| โหมด | UI และข้อมูล |
| --- | --- |
| `parking-list` | `ParkingSetupList` แสดงอาคารและชั้น; มี load/error/retry |
| `add-building`, `edit-building` | `BuildingFormPanel`: ชื่ออาคาร, เลือกรูป, preview, บันทึก/ยกเลิก |
| `add-floor`, `edit-floor` | `FloorFormPanel`: อาคาร, เลขชั้น, ประเภทรถ, Available/Disable; ลบพร้อมยืนยันในโหมดแก้ไข |
| `cctv-list` | `CCTVSetupList`: ไฟล์ source ส่วนกลาง, preset กล้องของชั้น, เพิ่ม/แก้ไขกล้อง, ไป Parking Map |
| `add-cctv`, `edit-cctv` | `AddCCTVPanel`: ชื่อกล้อง, original CCTV source, Camera No/IP, JSON ช่องจอด, IP/RTSP ใน Connection details |

Building/Floor ต่อ API ผ่าน `buildingService`/`floorService` มี dialog ยืนยันลบอาคารและชั้น พร้อมข้อความระบุข้อมูลที่เกี่ยวข้องที่จะถูกลบ

**CCTV Setup:** import JSON ต้นทางได้หลายไฟล์ มีข้อความจำกัด 5 MB ต่อ import และดาวน์โหลดไฟล์ได้ Preset ระบุชื่อกล้อง ประเภทรถ source file, parking slot file และ Camera No/IP การเพิ่ม/แก้ไขผูกกับชั้นที่เลือก ภาพ preview เป็นภาพจำลอง ไม่ใช่ video player แม้ฟอร์มจะรับ RTSP

`ParkingSetupList` ประกาศอยู่ใน Admin Dashboard ด้วย render function ส่วน `BuildingCameraSummary.vue` ใช้แสดงสรุปกล้องของอาคาร

### 4.8 Parking Map — `/admin/setup/floors/:floorId/parking-map`

```text
← Parking Setup | Parking Map / อาคาร-ชั้น-ประเภทรถ | Saved/Unsaved
Map Import/Export                                      [Export] [Import]
สรุปจำนวนช่องจอดตามสถานะ (คลิกกรองได้)
┌────────────────────────────────────┬────────────────────────┐
│ Preview / Layout editor            │ Slot details           │
│ ค้นหาช่องจอด / กรองสถานะ           │ ชื่อ / สถานะ / อาคาร/ชั้น │
│ แผนผัง SVG + zoom                  │ selection / Enable     │
│ เครื่องมือวาดเมื่อเปิดโหมดแก้ไข      │ Disable / ข้อความบันทึก  │
└────────────────────────────────────┴────────────────────────┘
```

Preview ดูแผนผังและเลือกช่องจอด Layout editor ใช้วาด/ย้าย/ปรับขนาด แก้ชื่อ เพิ่มรูปร่าง/ข้อความ/ภาพพื้นหลัง มี undo/redo, duplicate, delete, snap, zoom, pan, autosave และ save now

แก้ layout/import ได้เมื่อเป็น Admin และชั้นนั้นไม่ได้เป็น `available` ต้อง disable ชั้นจาก Parking Setup ก่อน ชื่อช่องจอดต้องตรงกับ CCTV JSON รวมตัวพิมพ์เล็กใหญ่ สถานะ Occupied/Incoming มีข้อจำกัดการแก้ไขและ UI ระบุว่าควบคุมโดยกล้อง

บันทึก map ไป server ผ่าน `floorService` และมี draft ใน localStorage ระหว่างออกจากหน้าที่มีการแก้ไขค้างจะแสดง dialog ให้ Keep editing, Discard changes หรือ Save and leave มี loading, error/retry, no matching slots, import error และ save error

### 4.9 Support Chat — overlay ร่วมหลายหน้า

ใช้ `ChatWidget.vue` และ `stores/chat.ts` ไม่ใช่ route แยก เปิดจากตัว widget หรือปุ่มกระดิ่ง ผู้ใช้ทั่วไปเห็น MFU Support และ Staff เห็น Support Inbox; Admin/Guest ไม่แสดง widget

โครงหลักมี inbox/รายการ ticket, ค้นหาและกรองสถานะ, ฟอร์มแจ้งปัญหา, รายละเอียดเรื่อง, ข้อความสนทนาและช่องตอบกลับ ฝั่ง Staff มี flow รับดูแลและเปลี่ยนสถานะ ticket เชื่อม service `/support/tickets` มี unread count ใน store

## 5. แผนผังคอมโพเนนต์

```text
src/
├── App.vue                         layout กลางและเงื่อนไข ChatWidget
├── router/index.ts                 routes / redirects / permission guards
├── components/
│   ├── layout/                     Sidebar, TopBar
│   ├── parking/
│   │   ├── DashboardMap.vue        location filter / summary / map viewer
│   │   ├── ParkingLayoutEditor.vue SVG viewer และ editor ที่ใช้ร่วมกัน
│   │   ├── CameraPreviewCard.vue   camera illustration
│   │   ├── ParkingLogCard.vue      แสดงข้อมูลการจอดซ้ำหลายหน้า
│   │   └── *.ts                   layout, JSON, preview และ sample template
│   └── chat/ChatWidget.vue         support overlay
├── views/
│   ├── staff/                      Login, Dashboard, History ที่ router ใช้
│   ├── admin/                      Dashboard container, forms, CCTV, ParkingMap
│   └── user/MyVehicleView.vue      รถส่วนตัวและประวัติ
├── stores/                         auth, admin, dashboard, chat, counter
└── services/api.ts                 Axios client และ service ของแต่ละ domain
```

Data flow ไม่ได้ผ่าน Pinia ทุกหน้า: บางหน้าใช้ local `ref` แล้วเรียก service โดยตรง เช่น My Vehicles และ Parking Setup ขณะที่ auth, support chat และ staff list ใช้ store

## 6. สถานะการเชื่อมข้อมูลที่เห็นจาก frontend

| ส่วน UI | แหล่งข้อมูล/พฤติกรรมที่ตรวจพบ |
| --- | --- |
| Login | Auth API; token/user เก็บ localStorage สำหรับผู้ใช้จริง |
| Dashboard Slots | Floor catalog/map API + sample map ที่เปิดดูได้ |
| Dashboard CCTV | ชื่อกล้องคงที่ + ภาพจำลอง HTML/CSS |
| Dashboard Log | array ตัวอย่างใน view |
| Slot Status Log | array ตัวอย่างใน view |
| My Vehicles | Vehicle API สำหรับผู้ใช้จริง; Guest ไม่ซิงก์ |
| My Vehicles: Parking History | array ตัวอย่างใน view |
| Staff Manager | Pinia memory; ยังไม่เห็น API ใน flow |
| Building/Floor/CCTV presets/source files | เรียก API ผ่าน service |
| Parking Map | API + local draft |
| Support Chat | Support API ผ่าน chat store |
| TopBar: Online | ข้อความ/จุดสีที่แสดงใน template; ไม่ได้ผูก health check ใน component |

ตารางนี้ยืนยันเพียงการเชื่อมจากโค้ด frontend ไม่ได้ยืนยันว่า backend, database, กล้อง และระบบตรวจจับทำงานครบในการใช้งานจริง

## 7. ไฟล์ UI ที่มีอยู่แต่ router ปัจจุบันไม่เรียก

- `src/views/LoginView.vue`
- `src/views/DashboardView.vue`
- `src/views/HistoryView.vue`
- `src/views/admin/LoginView.vue` — เป็น redirect component แต่ route `/admin/login` ใช้ redirect โดยตรง

สามไฟล์แรกเป็นอีกชุด implementation ที่มีหน้าตาต่างจากชุด `views/staff` จึงไม่ควรใช้อ้างว่าเป็นหน้าที่ผู้ใช้เห็นจริงจาก router ปัจจุบัน ส่วน `ReferenceParkingMap.vue` มีอยู่ในโฟลเดอร์ component แต่ไม่ได้อยู่ในเส้นทาง component หลักที่ไล่ไว้ด้านบน

## 8. ข้อสังเกตสำหรับพัฒนาต่อ

1. แยก Staff Manager และ Parking Setup ออกจาก Admin Dashboard จะทำให้ดูแลและอ่านแต่ละหน้าได้ง่ายขึ้น โดยเฉพาะ `StaffFormPanel`/`ParkingSetupList` ที่ยังเป็น inline render function
2. รวมขนาด sidebar/topbar, สี, spacing และการเว้นพื้นที่เนื้อหาเป็น design token และ layout component กลาง เพื่อลด CSS ซ้ำและค่าที่คลาดกัน
3. ต่อข้อมูลจริงให้ CCTV, parking logs, status history, vehicle history และ staff manager ก่อนถือว่า flow เหล่านี้สมบูรณ์
4. ตรวจ UX ของ Guest ใน My Vehicles เพราะ route เปิดให้เข้า แต่ไม่ซิงก์ API และตรวจเมนู History ของ Admin ให้ตรงกับสิทธิ์ที่ตั้งใจ
5. แยกสถานะ Online/Live ที่เป็นภาพประกอบออกจากสถานะการเชื่อมต่อจริงเมื่อเชื่อมระบบกล้อง
6. ทดสอบ browser เพิ่มที่ desktop/tablet/mobile โดยเน้น sidebar คงที่, map editor, dialog และ chat overlay

เอกสารนี้ไม่ได้แก้ implementation หรือรันทดสอบแอป ข้อเสนอในส่วนนี้เป็นแนวทางต่อยอดจากโครงสร้างปัจจุบัน

2## 9. Research: SVG editor

### 9.1 SVG editor คืออะไร

SVG (Scalable Vector Graphics) เป็นรูปแบบกราฟิกเวกเตอร์ที่อธิบายภาพด้วย element และพิกัด เช่น สี่เหลี่ยม เส้น และข้อความ แทนการเก็บสีของทุก pixel แบบภาพ raster อย่าง PNG/JPEG ไฟล์ SVG เป็น markup แบบข้อความและสามารถแสดงผลคมชัดเมื่อย่อหรือขยายได้ ในเว็บสามารถฝัง SVG เป็นส่วนหนึ่งของ DOM ทำให้แอปเปลี่ยนรูปทรง สี และข้อความ หรือผูก event กับแต่ละ element ได้

คำว่า **SVG editor** ในบริบทนี้หมายถึง UI ที่ให้ผู้ใช้สร้างหรือปรับ element บนพื้นที่ SVG เช่น วาดช่องจอด ย้าย/ปรับขนาด และแก้ label ไม่ได้หมายความว่าต้องติดตั้งโปรแกรมวาดภาพแยก หรือว่าข้อมูลทุกครั้งต้องถูกบันทึกเป็นไฟล์ `.svg`

### 9.2 ใช้กับระบบ Parking Management ตรงไหน

| จุดใช้งาน | สิ่งที่ระบบทำอยู่ | ประโยชน์กับงาน |
| --- | --- | --- |
| **Admin → Parking Setup → เลือกชั้น → Parking Map → Layout editor** | Admin วางตำแหน่งและปรับขนาดช่องจอด วาดองค์ประกอบแผนผังและข้อความ เพิ่มภาพแปลนเป็นพื้นหลัง ใช้ snap, zoom/pan, undo/redo และเลือกหลาย element ได้ | กำหนดผังแต่ละชั้น/ประเภทรถให้ตรงกับพื้นที่จริง โดยช่องจอดเป็น element แยกจากภาพพื้นหลัง |
| **Admin → Parking Map → Parking Preview / Slot details** | ดูแผนที่ เลือกหรือค้นหาช่องจอด กรองสถานะ และตรวจชื่อ/สถานะของช่อง | ตรวจความถูกต้องของตำแหน่งและข้อมูลช่อง ก่อนหรือหลังแก้ layout |
| **Dashboard → Slots** | เลือกอาคาร ชั้น และประเภทรถเพื่อดูแผนที่แบบอ่านอย่างเดียว พร้อมสรุปและ legend สถานะ | ให้ผู้ใช้/เจ้าหน้าที่ดูภาพรวมและตำแหน่งช่องจอด โดยไม่เปิดเครื่องมือแก้ layout |

การใช้งานเหล่านี้ใช้ `ParkingLayoutEditor.vue` ร่วมกันระหว่างหน้า Admin และ Dashboard โดยกำหนดโหมดแก้ไขหรืออ่านอย่างเดียวตามบริบท ส่วน Dashboard แสดงแผนที่หลังเลือก Building → Floor → Vehicle

### 9.3 สอดคล้องกับ implementation ปัจจุบันอย่างไร

- ตัวแผนที่เป็น inline `<svg>` ใช้ coordinate system / `viewBox` เพื่อจัดวางองค์ประกอบ และใช้ pointer events สำหรับเลือก วาด หรือจัดการ element
- ช่องจอดและองค์ประกอบแผนผังถูกวาดเป็น SVG shapes/text; ช่องจอดเชื่อมกับชื่อและสถานะในข้อมูล จึงแสดงรายละเอียดและสถานะบนแผนที่ได้
- ภาพพื้นหลังรับไฟล์ PNG, JPEG และ WebP ใน editor ปัจจุบัน ส่วนช่องจอด/ตำแหน่ง/องค์ประกอบ layout เก็บใน model ของแผนที่
- Import/Export ของ Parking Map ในปัจจุบันเป็น **JSON** สำหรับข้อมูลช่องจอด ชื่อ และตำแหน่ง ไม่ใช่การนำเข้า/ส่งออกไฟล์ SVG
- สิทธิ์แก้ layout จำกัดที่ Admin และชั้นที่ไม่ได้อยู่สถานะ Available; Dashboard ใช้ editor แบบ readonly

ดังนั้น SVG editor ไม่ใช่ฟีเจอร์ที่ต้องเริ่มสร้างใหม่ทั้งหมด: โครงสร้างหลักมีอยู่แล้ว งานต่อยอดควรเน้นความถูกต้องของข้อมูลและ UX ของ flow แก้แผนที่ รวมถึงทดสอบการใช้งานด้วยคีย์บอร์ดและหน้าจอขนาดต่าง ๆ

### 9.4 แนวทางนำไปใช้และข้อควรคำนึง

1. ใช้ภาพแปลนเป็น **พื้นหลังอ้างอิง** แล้ววางช่องจอดเป็น SVG element ที่มีชื่อ/สถานะของตนเอง ไม่ควรรวมช่องจอดทั้งหมดเป็นรูปภาพเดียว เพราะจะเลือกและเชื่อมกับข้อมูลรายช่องได้ยาก
2. ให้ API/model เป็นแหล่งข้อมูลหลักของตำแหน่งและสถานะ แล้วให้ SVG เป็นตัวแสดงผล เพื่อให้หน้า Admin และ Dashboard ใช้ข้อมูลผังเดียวกัน
3. ตรวจ mapping ระหว่างชื่อช่องในแผนที่กับข้อมูล CCTV/ช่องจอดก่อนบันทึกหรือ import เพราะพิกัดที่วาดได้อย่างเดียวไม่ได้ยืนยันว่าชื่อและข้อมูลสถานะตรงกับระบบจริง
4. รักษาโหมด readonly สำหรับผู้ดูแผนที่ และคงข้อจำกัดสิทธิ์/สถานะชั้นใน flow แก้ไข เพื่อป้องกันการเปลี่ยน layout โดยไม่ตั้งใจ
5. ทดสอบการเลือกช่องด้วยคีย์บอร์ด, focus/คำอธิบายสถานะ, สีที่แยกสถานะได้ชัด, การทำงานเมื่อ zoom และการตอบสนองเมื่อมีช่องจอดจำนวนมาก การใช้ SVG ไม่ได้ทำให้ accessibility หรือประสิทธิภาพดีขึ้นโดยอัตโนมัติ
6. แยกให้ชัดระหว่าง **ภาพแปลนพื้นหลัง** กับ **ไฟล์ข้อมูลแผนที่**: editor ปัจจุบันรับภาพพื้นหลัง PNG/JPEG/WebP แต่ map import/export เป็น JSON; หากต้องการ SVG file import/export ต้องกำหนด schema, การตรวจสอบ และขอบเขตการรองรับเพิ่มเติมก่อน

### References

**เอกสารมาตรฐาน/เทคนิค**

1. MDN, [SVG: Scalable Vector Graphics](https://developer.mozilla.org/en-US/docs/Web/SVG) — นิยาม SVG, ลักษณะ vector, การย่อ/ขยาย และการทำงานร่วมกับ Web standards
2. MDN, [Positions in SVG](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Positions) และ [The `viewBox` attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox) — ระบบพิกัด user units และการแปลงพิกัดให้พอดีกับ viewport
3. MDN, [Scripting SVG](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/Scripting) — การจัดการ event บน SVG และการแปลง pointer coordinates กลับเป็นพิกัดใน SVG
4. MDN, [The `<image>` SVG element](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image) — การแสดงภาพ raster ภายใน SVG
5. W3C, [SVG 2: Scripting and Interactivity](https://www.w3.org/TR/SVG2/interact.html) — ข้อกำหนดด้าน event, pointer interaction และ focus ของ SVG

**หลักฐานจาก source code ใน repository**

- [ParkingLayoutEditor.vue](../../parking-front/src/components/parking/ParkingLayoutEditor.vue) — canvas, tools, slot elements, pointer interaction, background image, zoom, snap และ undo/redo
- [ParkingMapView.vue](../../parking-front/src/views/admin/ParkingMapView.vue) — หน้าจอ Admin, สิทธิ์แก้ไข, การจัดการ draft และ Map JSON import/export
- [DashboardMap.vue](../../parking-front/src/components/parking/DashboardMap.vue) — ตัวกรองตำแหน่ง, summary, สถานะ และการใช้ editor แบบ readonly บน Dashboard
