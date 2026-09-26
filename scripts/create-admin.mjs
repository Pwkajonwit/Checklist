import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const env = {}

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      let value = match[2] || ''
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      env[match[1]] = value.trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

// รับเบอร์โทรและชื่อจาก command line argument
const phone = process.argv[2] || '0812345678'
const fullName = process.argv[3] || 'ผู้ดูแลระบบ (Admin)'

console.log('--- กำลังสร้างบัญชีผู้ดูแลระบบ (Admin) ด้วยเบอร์โทร ---')
console.log(`URL: ${supabaseUrl}`)
console.log(`เบอร์โทร (Phone): ${phone}`)
console.log(`ชื่อผู้ใช้ (Name): ${fullName}`)
console.log(`สิทธิ์ (Role): admin`)

if (!supabaseUrl) {
  console.error('❌ ไม่พบค่า NEXT_PUBLIC_SUPABASE_URL ใน .env.local')
  process.exit(1)
}

// ใช้ Service Key ถ้ามี หรือใช้ Anon Key ถ้าไม่มี
const apiKey = (serviceRoleKey && !serviceRoleKey.includes('your_supabase')) ? serviceRoleKey : supabaseAnonKey

async function main() {
  try {
    const supabase = createClient(supabaseUrl, apiKey)

    // ตรวจสอบว่าเบอร์นี้มีอยู่แล้วหรือไม่
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id, full_name, phone, role')
      .eq('phone', phone)
      .maybeSingle()

    if (existing) {
      console.log(`ℹ️ พบเบอร์โทรนี้อยู่แล้วในระบบ (ID: ${existing.id}) กำลังอัปเดตสิทธิ์เป็น admin...`)
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ role: 'admin', is_active: true, full_name: fullName })
        .eq('id', existing.id)

      if (updateErr) {
        console.error('❌ อัปเดตไม่สำเร็จ:', updateErr.message)
      } else {
        console.log('✅ อัปเดตสิทธิ์เป็น admin และเปิดใช้งานเรียบร้อย!')
        console.log(`🎉 คุณสามารถใช้เบอร์ ${phone} เข้าสู่ระบบที่หน้า http://localhost:3000 ได้ทันที`)
      }
      return
    }

    // สร้างใหม่
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        full_name: fullName,
        phone: phone,
        role: 'admin',
        department: 'สำนักงานใหญ่',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ เกิดข้อผิดพลาดในการสร้างบัญชี:', error.message)
      if (error.message.includes('column user_profiles.phone does not exist')) {
        console.log('\n⚠️ ตารางยังไม่มีคอลัมน์ phone กรุณารันคำสั่ง SQL Migration ก่อน:')
        console.log('   คัดลอกโค้ดใน supabase/migrations/phone_line_auth.sql ไปรันที่ Supabase SQL Editor')
      }
      return
    }

    console.log('✅ สร้างบัญชีผู้ดูแลระบบสำเร็จ!')
    console.log(`ID: ${data.id}`)
    console.log(`🎉 สามารถนำเบอร์โทร ${phone} ไปกรอกล็อกอินที่ http://localhost:3000 ได้ทันที!`)
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err.message)
  }
}

main()
