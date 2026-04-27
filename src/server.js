import express from 'express'
import dotenv from 'dotenv'
import propertiesRouter from './routes/properties.js'
import bookingsRouter  from './routes/bookings.js'
import cors from 'cors'

dotenv.config()

const app = express()
app.use(cors())

app.use(express.json())

app.use('/api/properties', propertiesRouter)
app.use('/api/bookings',   bookingsRouter)

app.get('/', (req, res) => {
  res.json({ message: 'API is running' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

