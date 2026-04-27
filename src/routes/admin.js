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
    revenue[month] += p.total_price
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
    .select('user_id, full_name, email, wilaya, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const userIds = data.map(u => u.user_id)

  const [{ data: hosts }, { data: guests }, { data: admins }] = await Promise.all([
    supabase.from('host').select('host_id').in('host_id', userIds),
    supabase.from('guest').select('guest_id').in('guest_id', userIds),
    supabase.from('admin').select('admin_id').in('admin_id', userIds),
  ])

  const hostSet  = new Set(hosts.map(h => h.host_id))
  const guestSet = new Set(guests.map(g => g.guest_id))
  const adminSet = new Set(admins.map(a => a.admin_id))

  const users = data.map(u => ({
    ...u,
    role: adminSet.has(u.user_id) ? 'Admin'
        : hostSet.has(u.user_id)  ? 'Host'
        : guestSet.has(u.user_id) ? 'Guest'
        : 'Unknown',
  }))

  res.json(users)
})

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params

  await supabase.from('host').delete().eq('host_id', id)
  await supabase.from('guest').delete().eq('guest_id', id)

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('user_id', id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'User banned successfully' })
})

// ── COMPLAINTS ───────────────────────────────────────────────

router.get('/complaints', async (req, res) => {
  const { data: complaints, error } = await supabase
    .from('complaints')
    .select('complaint_id, description, status, created_at, guest_id, target_id')
    .order('created_at', { ascending: false })

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

export default router