// src/routes/hostProperties.js
import express from 'express'
import supabase from '../supabase.js'

const router = express.Router()

// GET all properties for a host
router.get('/', async (req, res) => {
  const { host_id } = req.query

  if (!host_id) return res.status(400).json({ error: 'host_id required' })

  const { data, error } = await supabase
    .from('property')
    .select('*')
    .eq('host_id', host_id)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST add a new property
router.post('/', async (req, res) => {
  const { host_id, title, location, price, img, tags, badge, category, description, video } = req.body

  if (!host_id || !title || !location || !price) {
    return res.status(400).json({ error: 'host_id, title, location, price are required' })
  }

  const { data, error } = await supabase
    .from('property')
    .insert([{
      host_id,
      title,
      location,
      price: parseFloat(price),
      img: Array.isArray(img) ? img : (img ? [img] : null),
      tags: tags || null,
      badge: badge || null,
      category: category || null,
      description: description || null,
      video: video || null,
      status: 'pending'
    }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PUT update a property
router.put('/:id', async (req, res) => {
  const { host_id, title, location, price, img, tags, badge, category, description, video, status } = req.body

  if (!host_id) return res.status(400).json({ error: 'host_id required' })

  // Make sure this property belongs to this host
  const { data: existing } = await supabase
    .from('property')
    .select('host_id')
    .eq('property_id', req.params.id)
    .single()

  if (!existing || existing.host_id !== host_id) {
    return res.status(403).json({ error: 'Not your property' })
  }

  const { data, error } = await supabase
    .from('property')
    .update({ title, location, price: parseFloat(price), img, tags, badge, category, description, video, status })
    .eq('property_id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE a property
router.delete('/:id', async (req, res) => {
  const { host_id } = req.query

  const { data: existing } = await supabase
    .from('property')
    .select('host_id')
    .eq('property_id', req.params.id)
    .single()

  if (!existing || existing.host_id !== host_id) {
    return res.status(403).json({ error: 'Not your property' })
  }

  const { error } = await supabase
    .from('property')
    .delete()
    .eq('property_id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router