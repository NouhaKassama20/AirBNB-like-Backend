// src/routes/hosts.js
import express from 'express'
import supabase from '../supabase.js'

const router = express.Router()

// POST /api/hosts/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  // Sign in using Supabase Auth (same as how signup created the user)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const userId = authData.user.id

  // Check this user is actually a host
  const { data: host, error: hostError } = await supabase
    .from('host')
    .select('host_id')
    .eq('host_id', userId)
    .single()

  if (hostError || !host) {
    return res.status(403).json({ error: 'This account is not registered as a host' })
  }

  // Get full profile from users table
  const { data: userProfile } = await supabase
    .from('users')
    .select('user_id, full_name, email, username, wilaya')
    .eq('user_id', userId)
    .single()

  res.json({
    host: { ...userProfile, host_id: userId }
  })
})

// POST /api/hosts/signup
router.post('/signup', async (req, res) => {
  const { full_name, email, password, username, num_tele, wilaya, age } = req.body

  if (!full_name || !email || !password || !username) {
    return res.status(400).json({ error: 'full_name, email, password and username are required' })
  }

  // Check duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  // Create in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'host' }
  })

  if (authError) return res.status(400).json({ error: authError.message })

  const userId = authData.user.id

  // Insert into users table
  const { error: userError } = await supabase
    .from('users')
    .insert([{
      user_id: userId,
      full_name,
      email,
      password: 'managed_by_supabase_auth',
      username,
      num_tele: num_tele || null,
      wilaya: wilaya || null,
      age: age || null
    }])

  if (userError) {
    await supabase.auth.admin.deleteUser(userId)
    return res.status(500).json({ error: userError.message })
  }

  // Insert into host table
  const { error: hostError } = await supabase
    .from('host')
    .insert([{ host_id: userId }])

  if (hostError) {
    await supabase.auth.admin.deleteUser(userId)
    await supabase.from('users').delete().eq('user_id', userId)
    return res.status(500).json({ error: hostError.message })
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('user_id, full_name, email, username, wilaya')
    .eq('user_id', userId)
    .single()

  res.status(201).json({
    host: { ...userProfile, host_id: userId }
  })
})

export default router