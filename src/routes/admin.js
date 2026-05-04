import express from 'express'
import supabase from '../supabase.js'

const router = express.Router()

// ── STAT CARDS ──────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const [
    { count: totalProperties },
    { count: totalClients },
    { count: totalComplaints },
  ] = await Promise.all([
    supabase.from('property').select('*',    { count: 'exact', head: true }),
    supabase.from('guest').select('*',       { count: 'exact', head: true }),
    supabase.from('complaints').select('*',  { count: 'exact', head: true }),
  ])

  res.json({
    houses:     totalProperties || 0,
    clients:    totalClients    || 0,
    complaints: totalComplaints || 0,
  })
})

// ── CHARTS ──────────────────────────────────────────────────

router.get('/bookings-per-month', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('arrival')

  if (error) return res.status(500).json({ error: error.message })

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const counts = Array(12).fill(0)

  data.forEach(b => {
    const month = new Date(b.arrival).getMonth()
    counts[month]++
  })

  res.json(months.map((month, i) => ({ month, bookings: counts[i] })))
})

router.get('/revenue-per-month', async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('total_price, created_at')
    .eq('status', 'paid')

  if (error) return res.status(500).json({ error: error.message })

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const revenue = Array(12).fill(0)

  data.forEach(p => {
    const month = new Date(p.created_at).getMonth()
    revenue[month] += Number(p.total_price)
   // console.log('revenue values:', revenuePerMonth.map(r => r.revenue))

  })

  res.json(months.map((month, i) => ({ month, revenue: revenue[i] })))
})



router.get('/listings-by-wilaya', async (req, res) => {
  const { data: properties, error } = await supabase
    .from('property')
    .select('host_id')

  if (error) return res.status(500).json({ error: error.message })

  const hostIds = [...new Set(properties.map(p => p.host_id))]

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, wilaya')
    .in('user_id', hostIds)

  if (usersError) return res.status(500).json({ error: usersError.message })

  const wilayaMap = {}
  users.forEach(u => {
    wilayaMap[u.user_id] = u.wilaya
  })

  const counts = {}
  properties.forEach(p => {
    const wilaya = wilayaMap[p.host_id] || 'Unknown'
    counts[wilaya] = (counts[wilaya] || 0) + 1
  })

  const result = Object.entries(counts)
    .map(([wilaya, listings]) => ({ wilaya, listings }))
    .sort((a, b) => b.listings - a.listings)
     .slice(0, 6)  // ← add this

  res.json(result)
})

router.get('/booking-status', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('status')

  if (error) return res.status(500).json({ error: error.message })

  const counts = { confirmed: 0, pending: 0, cancelled: 0 }
  data.forEach(b => { if (counts[b.status] !== undefined) counts[b.status]++ })

  res.json([
    { name: 'Confirmed', value: counts.confirmed },
    { name: 'Pending',   value: counts.pending   },
    { name: 'Cancelled', value: counts.cancelled  },
  ])
})

// ── USERS ────────────────────────────────────────────────────

  router.get('/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('user_id, full_name, email, wilaya, created_at, is_banned')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const userIds = data.map(u => u.user_id)

  // ← Guard: if no users, return early
  if (userIds.length === 0) return res.json([])

  const [
    { data: hosts,  error: hostErr  },
    { data: guests, error: guestErr },
    { data: admins, error: adminErr },
  ] = await Promise.all([
    supabase.from('host').select('host_id').in('host_id', userIds),
    supabase.from('guest').select('guest_id').in('guest_id', userIds),
    supabase.from('admin').select('admin_id').in('admin_id', userIds),
  ])

  // ← Log errors so you can see what's failing
  if (hostErr)  console.error('host query error:',  hostErr.message)
  if (guestErr) console.error('guest query error:', guestErr.message)
  if (adminErr) console.error('admin query error:', adminErr.message)

  const hostSet  = new Set((hosts  || []).map(h => h.host_id))
  const guestSet = new Set((guests || []).map(g => g.guest_id))
  const adminSet = new Set((admins || []).map(a => a.admin_id))

  const users = data.map(u => ({
    ...u,
    role: adminSet.has(u.user_id) ? 'Admin'
        : hostSet.has(u.user_id)  ? 'Host'
        : guestSet.has(u.user_id) ? 'Guest'
        : 'Unknown',
  }))

  res.json(users)
})

router.patch('/users/:id/ban', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: true })
    .eq('user_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'User banned successfully' })
})

router.patch('/users/:id/unban', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: false })
    .eq('user_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'User unbanned successfully' })
})

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params

  const steps = [
    supabase.from('reviews').delete().eq('guest_id', id),
    supabase.from('experience_review').delete().eq('guest_id', id),
    supabase.from('experience_booking').delete().eq('guest_id', id),
    supabase.from('wishlist').delete().eq('guest_id', id),
  ]

  await Promise.all(steps)

  // payments references both guest and host — do these after
  await supabase.from('payments').delete().eq('guest_id', id)
  await supabase.from('payments').delete().eq('host_id', id)

  // bookings references guest — after payments
  await supabase.from('bookings').delete().eq('guest_id', id)

  // complaints
  await supabase.from('complaints').delete().eq('guest_id', id)
  await supabase.from('complaints').delete().eq('target_id', id)

  // properties and experiences
  await supabase.from('property').delete().eq('host_id', id)
  await supabase.from('experience').delete().eq('host_id', id)

  // role tables — must be before users
  await supabase.from('host').delete().eq('host_id', id)
  await supabase.from('guest').delete().eq('guest_id', id)
  await supabase.from('admin').delete().eq('admin_id', id)

  // finally users
  const { error } = await supabase.from('users').delete().eq('user_id', id)
  if (error) return res.status(500).json({ error: error.message })

  const { error: authError } = await supabase.auth.admin.deleteUser(id)
  if (authError) console.error('Auth delete error:', authError.message)

  res.json({ message: 'Account deleted successfully' })
})


// ── COMPLAINTS ───────────────────────────────────────────────

router.get('/complaints', async (req, res) => {
 const { data: complaints, error } = await supabase
  .from('complaints')
  .select('complaint_id, description, status, created_at, guest_id, target_id')
  .order('status', { ascending: true })  // 'dismissed', 'open', 'resolved' alphabetically — won't work perfectly
    

  if (error) return res.status(500).json({ error: error.message })

  const userIds = [...new Set([
    ...complaints.map(c => c.guest_id),
    ...complaints.map(c => c.target_id),
  ].filter(Boolean))]

  

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, full_name')
    .in('user_id', userIds)

  if (usersError) return res.status(500).json({ error: usersError.message })

  const userMap = {}
  users.forEach(u => { userMap[u.user_id] = u.full_name })

  const result = complaints.map(c => ({
    ...c,
    guest_name:  userMap[c.guest_id]  || '—',
    target_name: userMap[c.target_id] || '—',
  }))

  res.json(result)
})

router.patch('/complaints/:id/resolve', async (req, res) => {
  const { data, error } = await supabase
    .from('complaints')
    .update({ status: 'resolved' })
    .eq('complaint_id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/complaints/:id/dismiss', async (req, res) => {
  const { data, error } = await supabase
    .from('complaints')
    .update({ status: 'dismissed' })
    .eq('complaint_id', req.params.id)
    .select()
    .single()
  

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── TRANSACTIONS ─────────────────────────────────────────────

router.get('/transactions', async (req, res) => {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('payment_id, total_price, pay_method, status, created_at, guest_id')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const guestIds = [...new Set(payments.map(p => p.guest_id).filter(Boolean))]

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, full_name')
    .in('user_id', guestIds)

  if (usersError) return res.status(500).json({ error: usersError.message })

  const userMap = {}
  users.forEach(u => { userMap[u.user_id] = u.full_name })

  const result = payments.map(p => ({
    ...p,
    guest_name: userMap[p.guest_id] || '—',
  }))

  res.json(result)
})

// ── HOSTS MANAGEMENT ─────────────────────────────────────

router.get('/hosts', async (req, res) => {
  const { data: hosts, error } = await supabase
    .from('host')
    .select('host_id, is_verified, years_since_beginning')

  if (error) return res.status(500).json({ error: error.message })

  const hostIds = hosts.map(h => h.host_id)

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, full_name, email, wilaya, num_tele, created_at, is_banned')
    .in('user_id', hostIds)

  if (usersError) return res.status(500).json({ error: usersError.message })

  const userMap = {}
  users.forEach(u => { userMap[u.user_id] = u })

  const result = hosts.map(h => ({
    ...h,
    ...userMap[h.host_id],
  }))

  res.json(result)
})

router.patch('/hosts/:id/verify', async (req, res) => {
  const { error } = await supabase
    .from('host')
    .update({ is_verified: true })
    .eq('host_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Host verified successfully' })
})

router.patch('/hosts/:id/unverify', async (req, res) => {
  const { error } = await supabase
    .from('host')
    .update({ is_verified: false })
    .eq('host_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Host unverified' })
})

router.get('/hosts/:id/bookings', async (req, res) => {
  const { data: properties, error: propError } = await supabase
    .from('property')
    .select('property_id, title')
    .eq('host_id', req.params.id)

  if (propError) return res.status(500).json({ error: propError.message })

     // console.log('host id:', req.params.id)
  //console.log('properties found:', properties)

  if (propError) return res.status(500).json({ error: propError.message })
  if (!properties.length) return res.json([])
    

  if (!properties.length) return res.json([])

  const propertyIds = properties.map(p => p.property_id)
  const propMap = {}
  properties.forEach(p => { propMap[p.property_id] = p.title })

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('booking_id, arrival, departure, total_price, status, created_at, travelers, guest_id')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const guestIds = [...new Set(bookings.map(b => b.guest_id).filter(Boolean))]

  const { data: guests } = await supabase
    .from('users')
    .select('user_id, full_name')
    .in('user_id', guestIds)

  const guestMap = {}
  guests?.forEach(g => { guestMap[g.user_id] = g.full_name })

  const result = bookings.map(b => ({
    ...b,
    guest_name: guestMap[b.guest_id] || '—',
    property_title: propMap[b.property_id] || '—',
  }))

  res.json(result)
})


// Ban a host
router.patch('/hosts/:id/ban', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: true })
    .eq('user_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Host banned successfully' })
})

// Unban a host
router.patch('/hosts/:id/unban', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: false })
    .eq('user_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Host unbanned successfully' })
})




//Admin Login 

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' })

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  //console.log('authData:', authData)
  //console.log('authError:', authError)

  if (authError || !authData.user)
    return res.status(401).json({ error: 'Invalid email or password' })


  const userId = authData.user.id
 // console.log('userId:', userId)

  // Check if user is in admin table
  const { data: admin, error: adminError } = await supabase
    .from('admin')
    .select('admin_id')
    .eq('admin_id', userId)
    .single()

  if (adminError || !admin)
    return res.status(403).json({ error: 'Access denied. Not an admin.' })

  const { data: profile } = await supabase
    .from('users')
    .select('user_id, full_name, email')
    .eq('user_id', userId)
    .single()


  //console.log('admin:', admin)
  //console.log('adminError:', adminError)

  res.json({ admin: profile })
})

export default router