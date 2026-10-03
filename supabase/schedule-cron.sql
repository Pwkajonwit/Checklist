-- ==============================================================================
-- SiteCheck PRO: Supabase Smart Cron & Auto-Dispatch
-- 
-- สคริปต์นี้รันใน Supabase Dashboard -> SQL Editor เพียง "ครั้งเดียวเท่านั้น"
-- ระบบจะคอยอ่านเวลาจาก "หน้าตั้งค่าการแจ้งเตือน" ที่คุณตั้งไว้ในระบบโดยอัตโนมัติ!
--
-- ต่อจากนี้ หากคุณต้องการ:
--   - เพิ่มเวลาส่ง (เช่น 08:30, 09:00, 12:00, 17:00)
--   - ลบเวลาส่ง
--   - เปิด/ปิด การแจ้งเตือนอัตโนมัติ
-- 
-- -> ให้ทำผ่าน "หน้าตั้งค่าการแจ้งเตือน" ในหน้าเว็บได้เลย ไม่ต้องมาแก้ SQL อีกต่อไป!
-- ==============================================================================

-- 1. เปิด Extensions ที่จำเป็น
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. ลบ Job เดิมก่อนเพื่อป้องกันการทำงานซ้ำซ้อน
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('daily-line-report-0900', 'sitecheck-auto-dispatch');
EXCEPTION WHEN OTHERS THEN
END $$;

-- 3. สร้าง Smart Cron Job (ตรวจเช็คทุกๆ 1 นาที)
-- จะคอยดึงเวลาปัจจุบันในไทยไปเทียบกับ schedule_times ในตาราง settings
-- ถ้าตรงเวลาและเปิดใช้งานอยู่ จะยิงเข้า LINE OA ทันที
SELECT cron.schedule(
  'sitecheck-auto-dispatch',
  '* * * * *',
  $$
  DO $cron$
  DECLARE
    v_config jsonb;
    v_enabled boolean;
    v_times jsonb;
    v_current_time text;
  BEGIN
    -- ดึงการตั้งค่าล่าสุดจาก settings ที่ผู้ใช้กดบันทึกในหน้าเว็บ
    SELECT data INTO v_config FROM public.settings WHERE id = 'notification_config';
    IF v_config IS NULL THEN RETURN; END IF;

    -- ตรวจสอบว่าเปิดใช้งานการแจ้งเตือนอัตโนมัติหรือไม่
    v_enabled := COALESCE((v_config->>'schedule_enabled')::boolean, false);
    IF NOT v_enabled THEN RETURN; END IF;

    -- ตรวจสอบเวลาปัจจุบันในไทย (รูปแบบ HH:MI เช่น '09:00', '12:00')
    v_current_time := to_char(timezone('Asia/Bangkok', now()), 'HH24:MI');
    v_times := v_config->'schedule_times';

    -- หากเวลาปัจจุบันตรงกับเวลาที่ตั้งไว้ในหน้าเว็บ ให้ยิงส่งรายงานทันที
    IF v_times IS NOT NULL AND jsonb_typeof(v_times) = 'array' AND v_times ? v_current_time THEN
      PERFORM net.http_post(
        url := 'https://kvtmraohblmvcbnkibfc.supabase.co/functions/v1/line-daily-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dG1yYW9oYmxtdmNibmtpYmZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE2NDIyNywiZXhwIjoyMTA1NzQwMjI3fQ.7PR2qgjtPX1s3BxF30tzqKBMuBpgVRCO0L45t13A0s0'
        ),
        body := jsonb_build_object('force', true, 'slot', v_current_time)
      );
    END IF;
  END $cron$;
  $$
);

-- ==============================================================================
-- 4. คำสั่งทดสอบยิงรายงานทันที (Manual Test)
-- คัดลอกเฉพาะคำสั่งด้านล่างนี้ไปกด RUN เพื่อทดสอบว่า Edge Function ส่งเข้า LINE ได้สำเร็จ
-- ==============================================================================
/*
SELECT net.http_post(
  url := 'https://kvtmraohblmvcbnkibfc.supabase.co/functions/v1/line-daily-report',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dG1yYW9oYmxtdmNibmtpYmZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE2NDIyNywiZXhwIjoyMTA1NzQwMjI3fQ.7PR2qgjtPX1s3BxF30tzqKBMuBpgVRCO0L45t13A0s0'
  ),
  body := jsonb_build_object('force', true, 'slot', 'manual-test')
);
*/

-- ตรวจสอบสถานะ Job:
-- SELECT * FROM cron.job;