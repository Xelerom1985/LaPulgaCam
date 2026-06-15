import { db } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LOCAL_KEY = 'lapulgacam_teams'

export async function saveTeams(local, visitante, bannerBg) {
  const data = {
    local: { name: local.name, color: local.color, logo: local.logo || null },
    visitante: { name: visitante.name, color: visitante.color, logo: visitante.logo || null },
    bannerBg,
  }
  // Save locally always (offline support)
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  // Try Firebase
  try {
    await setDoc(doc(db, 'config', 'teams'), data)
  } catch {}
}

export async function loadTeams() {
  // Try local first
  try {
    const local = await AsyncStorage.getItem(LOCAL_KEY)
    if (local) return JSON.parse(local)
  } catch {}
  // Try Firebase
  try {
    const snap = await getDoc(doc(db, 'config', 'teams'))
    if (snap.exists()) return snap.data()
  } catch {}
  return null
}
