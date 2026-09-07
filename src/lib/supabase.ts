import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("URL do Supabase:", supabaseUrl)
  console.error("Chave Anon do Supabase:", supabaseAnonKey)
  throw new Error('Faltam as variáveis de ambiente do Supabase. Verifique se o arquivo .env está na raiz e comece com VITE_.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)