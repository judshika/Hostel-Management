import React from 'react'
import RoomGrid from '../components/RoomGrid'
import PageHeader from '../components/PageHeader'

export default function AdminDashboard(){
  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Overview of rooms and status" variant="Admin" />
      <div className="container py-4">
        <RoomGrid />
      </div>
    </>
  )
}
