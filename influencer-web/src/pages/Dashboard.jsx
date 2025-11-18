import React, { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const mockUserId = '6912fe62a74a5974653352a7'

  async function fetchStats() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`${API_BASE}/appmetrica/stats`, {
        headers: { "x-mock-user-id": mockUserId }
      })

      if (!res.ok) throw new Error('Failed')

      const data = await res.json()
      setStats(data)
    } catch (err) {
      setMsg("Failed to load stats")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [])

  function copyLink() {
    if (!stats) return
    navigator.clipboard.writeText(stats.referralLink)
    setMsg("Referral link copied!")
    setTimeout(() => setMsg(""), 2000)
  }

  return (
    <section className="card">
      <h2>Influencer Dashboard</h2>

      {loading && <p>Loading...</p>}
      {!loading && stats && (
        <>
          <p><strong>Name:</strong> {stats.name}</p>
          <p><strong>Installs:</strong> {stats.installs}</p>
          <p><strong>Earnings:</strong> {stats.earnings}</p>

          <div className="referral">
            <input readOnly value={stats.referralLink} />
            <button onClick={copyLink}>Copy Link</button>
          </div>
        </>
      )}

      {msg && <p style={{ color: 'green' }}>{msg}</p>}

      <button onClick={fetchStats}>Refresh</button>
    </section>
  )
}
