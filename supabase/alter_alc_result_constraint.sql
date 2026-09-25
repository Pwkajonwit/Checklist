-- =========================================================================
-- SQL Migration: ปลดล็อค Constraint ของ alc_result เพื่อรองรับการระบุค่าอิสระ
-- =========================================================================

-- ปลดล็อค check constraint เดิม (หากมี) เพื่อให้สามารถบันทึกค่าตัวเลขหรือข้อความ ALC ได้ตามต้องการ
ALTER TABLE public.checklist_entries DROP CONSTRAINT IF EXISTS checklist_entries_alc_result_check;
