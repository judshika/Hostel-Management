import axios from 'axios';
// Prefer env override; otherwise use same-origin "/api" which works with Vite proxy and production behind one host
const BASE = import.meta.env.VITE_API_URL || '/api';
export const API = axios.create({ baseURL: BASE });
export function setToken(token){ if(token){ API.defaults.headers.common.Authorization = 'Bearer '+token } else { delete API.defaults.headers.common.Authorization } }
