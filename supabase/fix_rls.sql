-- ============================================================
-- แก้ปัญหา: infinite recursion detected in policy for relation "user_profiles"
-- วิธีใช้: คัดลอกทั้งหมดนี้ไปวางใน Supabase Dashboard -> SQL Editor แล้วกด RUN
-- ============================================================

-- 1. [สำคัญที่สุด] ลบ Policy เดิมที่มีปัญหา Infinite Recursion (การวนลูป) ออกให้หมดก่อน
DROP POLICY IF EXISTS "profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;

DROP POLICY IF EXISTS "activities_read" ON public.activities;
DROP POLICY IF EXISTS "activities_write" ON public.activities;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.activities;

DROP POLICY IF EXISTS "contractors_read" ON public.contractors;
DROP POLICY IF EXISTS "contractors_write" ON public.contractors;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contractors;

DROP POLICY IF EXISTS "companies_read" ON public.companies;
DROP POLICY IF EXISTS "companies_write" ON public.companies;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.companies;

DROP POLICY IF EXISTS "checklist_read" ON public.checklist_entries;
DROP POLICY IF EXISTS "checklist_write" ON public.checklist_entries;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.checklist_entries;

-- 2. สร้าง Policy ใหม่แบบ Direct (ตรงไปตรงมา ไม่มีการ SELECT ซ้ำในตัวเอง จึงไม่มีวัน Recursion)
CREATE POLICY "Allow all for authenticated users" ON public.user_profiles 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.activities 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.contractors 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.companies 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.checklist_entries 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- สิทธิ์อ่านสำหรับ anon
DROP POLICY IF EXISTS "Allow anon read activities" ON public.activities;
CREATE POLICY "Allow anon read activities" ON public.activities FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon read contractors" ON public.contractors;
CREATE POLICY "Allow anon read contractors" ON public.contractors FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon read companies" ON public.companies;
CREATE POLICY "Allow anon read companies" ON public.companies FOR SELECT TO anon USING (true);

-- 3. เพิ่มคอลัมน์ที่จำเป็น
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tasks TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. ซิงค์โปรไฟล์ผู้ใช้ทุกคนใน auth.users ให้เป็น 'admin'
INSERT INTO public.user_profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 
  'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';
