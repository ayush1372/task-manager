
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()
const supabaseUrl = 'https://tzapqnrhjgrnwkiplhat.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
console.log(supabaseKey)
export const supabase = createClient(supabaseUrl, supabaseKey)