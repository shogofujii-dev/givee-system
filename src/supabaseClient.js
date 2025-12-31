import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mxeuwwzgccqzgefsolng.supabase.co'
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZXV3d3pnY2NxemdlZnNvbG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjI0MzgsImV4cCI6MjA4MjczODQzOH0.aP79SuN31ydRhKm8m_3AKsZkmaGWzm_A9EFvexd4_no'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)