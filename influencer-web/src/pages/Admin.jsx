import React, { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

export default function Admin() {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState(false)

  async function create() {
    setMsg('Creating...')
    setError(false)

    try {
      const res = await fetch(`${API_BASE}/influencer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      })

      if (!res.ok) throw new Error("Failed to create influencer")

      const data = await res.json()

      setMsg(`Influencer created: ${data.name}`)
      setName('')

    } catch (err) {
      setError(true)
      setMsg("Error creating influencer")
    }
  }

  return (
    <section className="card">
      <h2>Admin</h2>

      <div className="row">
        <input 
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button onClick={create}>Create Influencer</button>
      </div>

      <p style={{ color: error ? 'red' : 'green' }}>{msg}</p>
    </section>
  )
}
