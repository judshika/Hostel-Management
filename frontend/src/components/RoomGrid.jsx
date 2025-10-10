import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API } from '../api'
import { useAuth } from '../context/AuthContext'

// Optional prop `rooms`: when provided, the grid renders that list and
// stays in sync with parent updates. When omitted, it fetches on mount.
export default function RoomGrid({ rooms: roomsProp }){
  const [rooms,setRooms]=useState(Array.isArray(roomsProp) ? roomsProp : [])
  const { user } = useAuth()

  useEffect(()=>{
    if (Array.isArray(roomsProp)) {
      setRooms(roomsProp)
      return
    }
    API.get('/rooms/rooms-grid').then(r=>setRooms(r.data))
  },[roomsProp])

  return (
    <div className="row g-3">
      {rooms.map((r)=>{
        const bg =
          r.status === 'Vacant' ? 'room-vacant' :
          r.status === 'Partial' ? 'room-partial' :
          r.status === 'Occupied' ? 'room-occupied' :
          'room-maint'
        const badge =
          r.status === 'Vacant' ? 'success' :
          r.status === 'Partial' ? 'info' :
          r.status === 'Occupied' ? 'danger' :
          'warning'
        return (
          <div key={r.room_id} className="col-6 col-md-3 col-lg-2">
            <div className={`card card-rounded text-center room-card ${bg} shadow-sm`}>
              <div className="card-body p-2">
                <div className="small text-muted">{r.block}-{r.floor}</div>
                <div className="fw-bold">#{r.room_number}</div>
                <div className="small">{typeof r.active_count === 'number' ? `${r.active_count}/${r.capacity}` : `Cap: ${r.capacity}`}</div>
                <span className={`badge bg-${badge} mt-1`}>{r.status}</span>
                {user && (user.role==='Admin' || user.role==='Warden') && (
                  <div className="mt-2">
                    <Link to={`/rooms/${r.room_id}/edit`} className="btn btn-sm btn-light">Edit</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
