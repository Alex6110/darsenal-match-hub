const SUPABASE_URL = 'https://uoicamwesrlpixdeymqe.supabase.co';
// Inserisci qui la tua SUPABASE_KEY che usavi nell'altra app
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaWNhbXdlc3JscGl4ZGV5bXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzgyMjUsImV4cCI6MjEwNTgxNDIyNX0.MjqXHwzagfRTB6o9GpANeM_QopCso_48UUu2Blune-o';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);