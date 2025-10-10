import React from 'react'

export default function RoleBadge({ role }){
  const r = (role||'').toLowerCase()
  const cls = r==='admin' ? 'primary' : r==='warden' ? 'info' : 'success'
  return <span className={`badge bg-${cls}`}>{role}</span>
}

