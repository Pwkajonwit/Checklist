-- ============================================================
-- ระบบ Checklist พนักงาน / ผู้รับเหมาเข้าโครงการ (SiteCheck PRO)
-- Single Clean Schema for Supabase PostgreSQL (Production)
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLE: companies (บริษัท / แผนก)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 3. TABLE: contractors (ผู้รับเหมา Master Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name TEXT,
  employee_type TEXT NOT NULL DEFAULT 'contractor' CHECK (employee_type IN ('employee', 'contractor')),
  position TEXT,
  phone TEXT,
  daily_wage NUMERIC,
  alc_risk BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 4. TABLE: activities (กิจกรรมและสถานที่ Master Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  location TEXT,
  tasks TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 5. TABLE: user_profiles (โปรไฟล์ผู้ใช้งาน - Phone Auth & LINE LIFF)
-- ============================================================
-- ลบ trigger และ FK กับ auth.users ออก เพื่อรองรับระบบล็อกอินด้วยเบอร์โทร + LINE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'supervisor', 'viewer')),
  department TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  line_user_id TEXT UNIQUE,
  line_display_name TEXT,
  line_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- เพิ่ม/แก้ไขคอลัมน์ (กรณีตารางมีอยู่แล้ว)
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

ALTER TABLE public.user_profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS line_display_name TEXT,
  ADD COLUMN IF NOT EXISTS line_picture_url TEXT;

-- ============================================================
-- 6. TABLE: checklist_entries (ข้อมูล Checklist หลัก)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
  contractor_name TEXT NOT NULL,
  company_name TEXT,
  supervisor TEXT,
  purpose TEXT,
  check_in_time TIME,
  check_out_time TIME,
  card_code TEXT,
  card_name TEXT,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  activity_name TEXT,
  location TEXT,
  alc_result TEXT DEFAULT '0%',
  ppe_helmet BOOLEAN DEFAULT false,
  ppe_vest BOOLEAN DEFAULT false,
  ppe_shirt BOOLEAN DEFAULT false,
  ppe_gloves BOOLEAN DEFAULT false,
  ppe_shoes BOOLEAN DEFAULT false,
  is_blacklisted BOOLEAN DEFAULT false,
  noise_area BOOLEAN DEFAULT false,
  daily_wage NUMERIC(10,2),
  meal_allowance BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'checked_out', 'cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ปลดล็อค alc_result check constraint เพื่อให้ใส่ค่า % หรือตัวเลขได้อย่างอิสระ
ALTER TABLE public.checklist_entries DROP CONSTRAINT IF EXISTS checklist_entries_alc_result_check;

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checklist_date ON public.checklist_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_checklist_contractor ON public.checklist_entries(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractors_active ON public.contractors(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_line ON public.user_profiles(line_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON public.user_profiles(is_active);

-- ============================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contractors_updated_at ON public.contractors;
CREATE TRIGGER trg_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_checklist_updated_at ON public.checklist_entries;
CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON public.checklist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_entries ENABLE ROW LEVEL SECURITY;

-- Reset policies to avoid recursion
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.companies;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contractors;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.activities;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.checklist_entries;

DROP POLICY IF EXISTS "Allow anon read companies" ON public.companies;
DROP POLICY IF EXISTS "Allow anon read contractors" ON public.contractors;
DROP POLICY IF EXISTS "Allow anon read activities" ON public.activities;
DROP POLICY IF EXISTS "Allow anon read user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow anon all companies" ON public.companies;
DROP POLICY IF EXISTS "Allow anon all contractors" ON public.contractors;
DROP POLICY IF EXISTS "Allow anon all activities" ON public.activities;
DROP POLICY IF EXISTS "Allow anon all checklist_entries" ON public.checklist_entries;

-- สิทธิ์เข้าถึงข้อมูลสำหรับแอปพลิเคชัน
CREATE POLICY "Allow anon all companies" ON public.companies FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all contractors" ON public.contractors FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all activities" ON public.activities FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all checklist_entries" ON public.checklist_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read user_profiles" ON public.user_profiles FOR SELECT TO anon USING (true);

-- Authenticated fallback
CREATE POLICY "Allow all for authenticated users" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.contractors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.checklist_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.user_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 10. INITIAL ADMIN USER (สร้างเฉพาะบัญชีผู้ดูแลระบบคนแรกเท่านั้น)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'admin@admin.com') THEN
    UPDATE public.user_profiles
    SET phone = '0812345678', is_active = true, role = 'admin', full_name = 'ผู้ดูแลระบบ (Admin)', department = 'สำนักงานใหญ่'
    WHERE email = 'admin@admin.com';
  ELSIF EXISTS (SELECT 1 FROM public.user_profiles WHERE phone = '0812345678') THEN
    UPDATE public.user_profiles
    SET is_active = true, role = 'admin', full_name = 'ผู้ดูแลระบบ (Admin)', department = 'สำนักงานใหญ่'
    WHERE phone = '0812345678';
  ELSE
    INSERT INTO public.user_profiles (full_name, phone, role, department, is_active)
    VALUES ('ผู้ดูแลระบบ (Admin)', '0812345678', 'admin', 'สำนักงานใหญ่', true);
  END IF;
END $$;
