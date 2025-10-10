import React from 'react'
import { useAuth } from '../context/AuthContext'

export default function PageHeader({ title, subtitle, actions, variant }){
  const { user } = useAuth()
  const role = (variant || user?.role || 'Default').toLowerCase()
  const accent = role==='admin' ? 'accent-admin' : role==='warden' ? 'accent-warden' : role==='student' ? 'accent-student' : 'accent-default'
  return (
    <div className={`page-header card-rounded ${accent}`}>
      <div className="container">
        <div className="d-flex align-items-center flex-wrap gap-2 py-3">
          <div className="me-auto">
            <h4 className="mb-0 text-white fw-semibold">{title}</h4>
            {subtitle && <div className="text-white-50 small">{subtitle}</div>}
          </div>
          {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

