import React from 'react'
import RoomGrid from '../components/RoomGrid'
import PageHeader from '../components/PageHeader'

export default function WardenDashboard(){
  return (
    <>
      <PageHeader title="Warden Dashboard" subtitle="Monitor allocations and occupancy" variant="Warden" />
      <div className="container py-4">
        <RoomGrid />
      </div>
    </>
  )
}
