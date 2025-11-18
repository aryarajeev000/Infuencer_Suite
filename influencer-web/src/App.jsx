import React from 'react'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

export default function App(){
  return (
    <div>
      <header className="topbar">
        <h1>Influencer Suite</h1>
      </header>
      <main>
        <div className="container">
          <Dashboard />
          <Admin />
        </div>
      </main>
    </div>
  )
}
