import { supabase } from '../supabase.js';

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/host/signup
//  Body: { full_name, email, password, username, age?, num_tele?, wilaya?, emploi?, sec_qst? }
// ─────────────────────────────────────────────────────────────
export const hostSignup = async (req, res) => {
  const { full_name, email, password, username, age, num_tele, wilaya, emploi, sec_qst } = req.body;

  if (!full_name || !email || !password || !username) {
    return res.status(400).json({ error: 'full_name, email, password and username are required.' });
  }

  try {
    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,       // skip email verification for now
      user_metadata: { full_name, role: 'host' }
    });

    if (authError) return res.status(400).json({ error: authError.message });

    const userId = authData.user.id;
     // Check if email already exists in auth before trying to create
const { data: existing } = await supabase
  .from('users')
  .select('user_id')
  .eq('email', email)
  .maybeSingle();

if (existing) {
  return res.status(400).json({ error: 'This email is already registered.' });
}
    // 2. Insert into public.users table
    const { error: userError } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        full_name,
        email,
        password: 'managed_by_supabase_auth',  // password is in Auth, not here
        username,
        age: age || null,
        num_tele: num_tele || null,
        wilaya: wilaya || null,
        emploi: emploi || null,
        sec_qst: sec_qst || null,
      });

    if (userError) {
      // Rollback: delete auth user if users insert fails
      await supabase.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: userError.message });
    }

    // 3. Insert into public.host table
    const { error: hostError } = await supabase
      .from('host')
      .insert({ host_id: userId });

    if (hostError) {
      await supabase.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: hostError.message });
    }

    return res.status(201).json({ message: 'Host account created successfully.', userId });

  } catch (err) {
    console.error('hostSignup error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }

  
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/host/login
//  Body: { email, password }
// ─────────────────────────────────────────────────────────────
export const hostLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) return res.status(401).json({ error: 'Invalid email or password.' });

    const userId = authData.user.id;

    // 2. Confirm this user is actually a host
    const { data: hostRow, error: hostError } = await supabase
      .from('host')
      .select('host_id')
      .eq('host_id', userId)
      .single();

    if (hostError || !hostRow) {
      return res.status(403).json({ error: 'This account is not registered as a host.' });
    }

    // 3. Fetch full user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('user_id, full_name, email, username, wilaya, emploi')
      .eq('user_id', userId)
      .single();

    return res.status(200).json({
      message: 'Login successful.',
      session: authData.session,   // contains access_token and refresh_token
      user: { ...userProfile, role: 'host' },
    });

  } catch (err) {
    console.error('hostLogin error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await supabase.auth.admin.signOut(token);
  return res.status(200).json({ message: 'Logged out.' });
};
