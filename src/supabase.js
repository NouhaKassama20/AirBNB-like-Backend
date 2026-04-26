//import { createClient } from '@supabase/supabase-js';

//import dotenv from 'dotenv'

//dotenv.config()


//const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
//const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

//export const supabase = createClient(supabaseUrl, supabaseKey);
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default supabase