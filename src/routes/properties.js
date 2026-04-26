import express from 'express'
import supabase from '../supabase.js'

const router = express.Router()

// GET all properties
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('property')
    .select('*')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET single property by id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('property')
    .select('*')
    .eq('property_id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: error.message })
  res.json(data)
})

// GET all offers with property info joined
router.get('/offers/all', async (req, res) => {
  const { data, error } = await supabase
    .from('offers')
    .select(`
      *,
      property (
        title,
        description,
        localisation_google_map,
        host_id
      )
    `)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router