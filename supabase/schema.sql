-- ============================================================
-- ระบบ Checklist พนักงาน / ผู้รับเหมาเข้าโครงการ
-- Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: companies (บริษัท / แผนก)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- TABLE: contractors (ผู้รับเหมา Master Data)
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
-- TABLE: activities (กิจกรรม Master Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- TABLE: user_profiles (โปรไฟล์ผู้ใช้งาน)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'supervisor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- TABLE: checklist_entries (ข้อมูล Checklist หลัก)
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
  alc_result TEXT DEFAULT '0%' CHECK (alc_result IN ('0%', '>0%', 'ไม่ได้ตรวจ')),
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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checklist_date ON public.checklist_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_checklist_contractor ON public.checklist_entries(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractors_active ON public.contractors(is_active);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON public.checklist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.contractors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.user_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.checklist_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon read
CREATE POLICY "Allow anon read activities" ON public.activities FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read contractors" ON public.contractors FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read companies" ON public.companies FOR SELECT TO anon USING (true);

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO public.companies (name, code) VALUES
  ('ช.หลุยส์', 'CHL'),
  ('ช.ป๊อบ', 'CPP'),
  ('ช.เปีย', 'CPE'),
  ('ช.ตีะ', 'CTK'),
  ('ช.เดียร์', 'CDR'),
  ('งานอิสระ', 'IND')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.activities (name, location) VALUES
  ('งานปูกระเบื้อง', 'โรง 3'),
  ('งานฉาบปูน', 'โรง 1'),
  ('งานไฟฟ้า', 'โรง 2'),
  ('งานประปา', 'โรง 3'),
  ('งานเหล็ก', 'โรง 1'),
  ('งานทาสี', 'โรง 2'),
  ('งานไม้แบบ', 'โรง 3'),
  ('งานผูกเหล็ก', 'โรง 1'),
  ('งานขนย้าย', 'ทั่วไป'),
  ('งานก่อสร้างทั่วไป', 'ทั่วไป')
ON CONFLICT DO NOTHING;
