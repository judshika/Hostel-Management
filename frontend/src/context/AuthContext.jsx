import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { API, setToken } from '../api'

const Ctx = createContext(null)

export function AuthProvider({ children }){
  const [user,setUser]=useState(null)
  const [token,setTok]=useState(null)

  useEffect(()=>{
    const raw = localStorage.getItem('auth')
    if(raw){
      try{ const p=JSON.parse(raw); setUser(p.user); setTok(p.token); setToken(p.token) }catch{}
    }
  },[])

  const login = async (email,password)=>{
    const {data}=await API.post('/auth/login',{email,password})
    localStorage.setItem('auth', JSON.stringify(data))
    setUser(data.user); setTok(data.token); setToken(data.token)
  }

  const logout = ()=>{ localStorage.removeItem('auth'); setUser(null); setTok(null); setToken(null) }

  const value = useMemo(()=>({user,token,login,logout,setUser}),[user,token])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = ()=>useContext(Ctx)
