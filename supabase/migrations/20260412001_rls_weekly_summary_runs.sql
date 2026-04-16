ALTER TABLE public.farmer_weekly_summary_runs ENABLE ROW LEVEL SECURITY;
-- Table is server-only (service role). No client policies needed.
-- RLS enabled as defense-in-depth measure.
