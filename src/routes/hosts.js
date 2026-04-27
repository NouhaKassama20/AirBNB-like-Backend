import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import supabase from '../supabase.js'

const router = express.Router()

// POST /api/hosts/signup
router.post('/signup', async (req, res) => {
  const { full_name, email, password, username, num_tele, wilaya, age } = req.body

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required' })
  }

  // Check if email already exists in users table
  const { data: existing } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', email)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Insert into users table
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert([{ full_name, email, password: hashedPassword, username, num_tele, wilaya, age }])
    .select()
    .single()

  if (userError) return res.status(500).json({ error: userError.message })

  // Insert into host table using the new user_id
  const { data: newHost, error: hostError } = await supabase
    .from('host')
    .insert([{ host_id: newUser.user_id }])
    .select()
    .single()

  if (hostError) return res.status(500).json({ error: hostError.message })

  // Generate JWT
  const token = jwt.sign(
    { host_id: newHost.host_id, user_id: newUser.user_id, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.status(201).json({ token, host: { ...newUser, host_id: newHost.host_id } })
})

// POST /api/hosts/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  // Find user by email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Check the user is actually a host in the host table
  const { data: host, error: hostError } = await supabase
    .from('host')
    .select('host_id')
    .eq('host_id', user.user_id)
    .single()

  if (hostError || !host) {
    return res.status(403).json({ error: 'This account is not registered as a host' })
  }

  // Generate JWT
  const token = jwt.sign(
    { host_id: host.host_id, user_id: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, host: { ...user, host_id: host.host_id } })
})

export default router