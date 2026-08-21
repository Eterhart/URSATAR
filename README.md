# 📅 URSA-Planer (Unofficial)

> **Next-generation Timetable & Course Schedule Planner for Bangkok University (BU) Students**  
> เว็บแอปพลิเคชันวางแผนและจัดตารางเรียนสำหรับนักศึกษามหาวิทยาลัยกรุงเทพ เชื่อมต่อข้อมูลวิชาและสถานะที่นั่งจากระบบ URSA แบบเรียลไทม์ ด้วยดีไซน์ Apple-inspired UI ที่เรียบหรูและทันสมัย

---

## ✨ Features (ฟีเจอร์เด่น)

- 🔐 **Live URSA Authentication & Session**: เข้าสู่ระบบด้วยรหัสนักศึกษาและรหัสผ่าน URSA พร้อมดึงชื่อและรหัสนักศึกษาอัตโนมัติ
- 🔍 **Live Section & Seat Query**: ค้นหารายวิชาตามปีการศึกษาและภาคเรียน ดึงข้อมูล Section, อาจารย์ผู้สอน, ห้องเรียน, วัน-เวลาสอบ, และจำนวนที่นั่งว่างแบบเรียลไทม์
- 📊 **Interactive Timetable Grid**: ปฏิทินตารางเรียนแบบ Interactive ลากจัดเรียงแท็บ Plan (Plan A / Plan B / Plan C) และไฮไลต์ช่วงเวลาแบบ Bidirectional Hover
- ⚠️ **Smart Time Conflict Detection**: ระบบตรวจจับวิชาเรียนเวลาชนกันแบบอัตโนมัติ พร้อมแถบแจ้งเตือนระดับวินาที
- 🎛️ **Multi-Filter & Sort**: ตัวกรองสถานะที่นั่ง (ทั้งหมด / ว่าง / เกือบเต็ม / เต็ม) และเลือก Section ตามตัวอักษร A-P อย่างง่ายดาย
- 📋 **One-Click Export & Copy Sec**: คัดลอกรหัสวิชาและ Section เพื่อนำไปใช้ลงทะเบียนในระบบ URSA ได้ทันที พร้อมแอนิเมชัน Confetti
- 📱 **100% Fully Responsive**: รองรับการใช้งานทั้งบน Mobile, Tablet, iPad Pro และ Desktop พร้อมหน้าจอแนะนำการหมุนแนวนอนบนสมาร์ตโฟน

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (Turbopack, App Router)](https://nextjs.org/)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide Icons, Canvas Confetti
- **Typography**: Apple Unified System Font / SF Pro + Prompt
- **API Engine**: Next.js Route Handlers (Proxying URSA CFML & decoding windows-874 / UTF-8)

---

## 🚀 Getting Started (วิธีติดตั้งและรันโปรเจกต์)

### 1. Clone the repository
```bash
git clone https://github.com/Eterhart/URSA-Planer.git
cd URSA-Planer
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

เปิดบราวเซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### 4. Build for production
```bash
npm run build
npm run start
```

---

## ⚠️ Disclaimer (ข้อจำกัดความรับผิดชอบ)

This project is an **unofficial, student-made community tool** and is **not affiliated with, endorsed by, or connected to Bangkok University (BU)**. All official course registrations and academic records must be conducted directly through the official university URSA system.

> โครงการนี้เป็น **โปรเจกต์อิสระที่ไม่เป็นทางการ (Unofficial)** พัฒนาขึ้นโดยนักศึกษาเพื่ออำนวยความสะดวกในการจัดตารางเรียน ไม่มีความเกี่ยวข้องหรือสังกัดกับทางมหาวิทยาลัยกรุงเทพ การลงทะเบียนเรียนจริงและข้อมูลผลการเรียนอย่างเป็นทางการต้องดำเนินการผ่านระบบ URSA ของมหาวิทยาลัยโดยตรงเท่านั้น

---

## 📄 License

Distributed under the [MIT License](LICENSE).
