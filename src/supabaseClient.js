import { createClient } from "@supabase/supabase-js";

// ⚠️ REPLACE WITH YOUR OWN SUPABASE PROJECT KEYS
const supabaseUrl = "https://duyovwsbbzburbzptcxw.supabase.co"; // ← Change this
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1eW92d3NiYnpidXJienB0Y3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzkyMzIsImV4cCI6MjA3OTI1NTIzMn0.ImI0wqE1bxY6un3_UEg5T09YCL41fiEGbGSbxaSf2MI"; // ← Change this

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
