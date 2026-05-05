import express from 'express'
import supabase from '../supabase.js'

const router = express.Router()

// ─── POST /api/guests/signup ───────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { full_name, email, password, username, num_tele, wilaya, age, civil_state } = req.body

  if (!full_name || !email || !password || !username) {
    return res.status(400).json({ error: 'full_name, email, password and username are required' })
  }

  if (age < 18 || age > 120) {
    return res.status(400).json({ error: 'Age must be between 18 and 120' })
  }

  const phoneRegex = /^(05|06|07)\d{8}$/
  if (num_tele && !phoneRegex.test(num_tele)) {
    return res.status(400).json({ error: 'Invalid phone number format' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const validCivilStates = ['Célibataire', 'Marié', 'Mariée']
  if (civil_state && !validCivilStates.includes(civil_state)) {
    return res.status(400).json({ error: 'Invalid civil state' })
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

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'guest' }
  })

  if (authError) return res.status(400).json({ error: authError.message })

  const userId = authData.user.id

  // Insert into users table
  const { error: userError } = await supabase
    .from('users')
    .insert([{
      user_id:  userId,
      full_name,
      email,
      password: 'managed_by_supabase_auth',
      username,
      num_tele: num_tele || null,
      wilaya:   wilaya   || null,
      age:      age      || null,
    }])

  if (userError) {
    await supabase.auth.admin.deleteUser(userId)
    return res.status(500).json({ error: userError.message })
  }

  // Insert into guest table (includes civil_state)
  const { error: guestError } = await supabase
    .from('guest')
    .insert([{ guest_id: userId, civil_state: civil_state || null }])

  if (guestError) {
    await supabase.auth.admin.deleteUser(userId)
    await supabase.from('users').delete().eq('user_id', userId)
    return res.status(500).json({ error: guestError.message })
  }

  // Return full profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('user_id, full_name, email, username, wilaya')
    .eq('user_id', userId)
    .single()

  res.status(201).json({
    guest: { ...userProfile, guest_id: userId, civil_state: civil_state || null }
  })
})

// ─── POST /api/guests/login ────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const userId = authData.user.id

  // Check this user is actually a guest — also fetch civil_state
  const { data: guest, error: guestError } = await supabase
    .from('guest')
    .select('guest_id, civil_state')
    .eq('guest_id', userId)
    .single()

  if (guestError || !guest) {
    return res.status(403).json({ error: 'This account is not registered as a guest' })
  }

  // Get full profile from users table
  const { data: userProfile } = await supabase
    .from('users')
    .select('user_id, full_name, email, username, wilaya, num_tele, age, is_banned')
    .eq('user_id', userId)
    .single()

  if (userProfile?.is_banned) {
    return res.status(403).json({ error: 'Your account has been banned. Please contact support.' })
  }

  res.json({
    guest: {
      ...userProfile,
      guest_id:    userId,
      civil_state: guest.civil_state || null,
    }
  })
})

// ─── GET /api/guests/:id/profile ──────────────────────────────────────────
router.get('/:id/profile', async (req, res) => {
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('user_id, full_name, email, username, wilaya, num_tele, age')
    .eq('user_id', req.params.id)
    .single()

  if (userError) return res.status(500).json({ error: userError.message })

  const { data: guestData, error: guestError } = await supabase
    .from('guest')
    .select('civil_state')
    .eq('guest_id', req.params.id)
    .single()

  if (guestError) return res.status(500).json({ error: guestError.message })

  res.json({ ...userProfile, civil_state: guestData.civil_state || null })
})

// ─── PUT /api/guests/:id/profile ──────────────────────────────────────────
router.put('/:id/profile', async (req, res) => {
  const { full_name, email, username, num_tele, wilaya, age, civil_state } = req.body

  const validCivilStates = ['Célibataire', 'Marié', 'Mariée']
  if (civil_state && !validCivilStates.includes(civil_state)) {
    return res.status(400).json({ error: 'Invalid civil state' })
  }

  // Update users table
  const { data, error: userError } = await supabase
    .from('users')
    .update({ full_name, email, username, num_tele, wilaya, age })
    .eq('user_id', req.params.id)
    .select()
    .single()

  if (userError) return res.status(500).json({ error: userError.message })

  // Update guest table (civil_state lives here)
  const { error: guestError } = await supabase
    .from('guest')
    .update({ civil_state: civil_state || null })
    .eq('guest_id', req.params.id)

  if (guestError) return res.status(500).json({ error: guestError.message })

  res.json({ ...data, civil_state: civil_state || null })
})

export default router