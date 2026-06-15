import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { loadTeams, saveTeams } from '../services/teams'

function TeamCard({ team, setTeam, label }) {
  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para elegir el escudo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const base64 = `data:image/jpeg;base64,${asset.base64}`
      setTeam(t => ({ ...t, logo: base64 }))
    }
  }

  return (
    <View style={s.teamCard}>
      <Text style={s.cardTitle}>{label}</Text>

      <TouchableOpacity onPress={pickLogo} style={s.logoBox}>
        {team.logo
          ? <Image source={{ uri: team.logo }} style={s.logoImg} />
          : <Text style={{ fontSize: 28 }}>🛡️</Text>
        }
      </TouchableOpacity>

      <TextInput
        style={s.input}
        value={team.name}
        onChangeText={v => setTeam(t => ({ ...t, name: v.toUpperCase() }))}
        placeholder="Nombre"
        placeholderTextColor="#666"
        maxLength={20}
        autoCapitalize="characters"
      />

      <View style={s.colorRow}>
        <Text style={s.colorLabel}>Color</Text>
        <View style={[s.colorSwatch, { backgroundColor: team.color }]} />
        <View style={s.colorOptions}>
          {['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#1abc9c','#e67e22','#2c3e50'].map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setTeam(t => ({ ...t, color: c }))}
              style={[s.colorDot, { backgroundColor: c }, team.color === c && s.colorDotSelected]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

export default function SetupScreen({ local, setLocal, visitante, setVisitante, bannerBg, setBannerBg, onStart }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTeams().then(data => {
      if (data) {
        if (data.local) setLocal(t => ({ ...t, ...data.local, score: 0 }))
        if (data.visitante) setVisitante(t => ({ ...t, ...data.visitante, score: 0 }))
        if (data.bannerBg) setBannerBg(data.bannerBg)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleStart = async () => {
    setSaving(true)
    try {
      await saveTeams(local, visitante, bannerBg)
    } catch {}
    setSaving(false)
    onStart()
  }

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#f0c040" />
        <Text style={s.loadingText}>⚽ LaPulgaCam</Text>
      </View>
    )
  }

  const BG_COLORS = ['#111111', '#1a1a2e', '#0d3b1e', '#1a0a0a']

  return (
    <View style={s.container}>
      {/* Local */}
      <TeamCard team={local} setTeam={setLocal} label="EQUIPO LOCAL" />

      {/* Center */}
      <View style={s.center}>
        <Text style={s.appTitle}>⚽ LaPulgaCam</Text>

        {/* Banner preview */}
        <View style={[s.bannerPreview, { backgroundColor: bannerBg }]}>
          {[local, visitante].map((team, i) => (
            <View key={i} style={[s.bannerRow, i === 0 && s.bannerRowBorder]}>
              <View style={[s.bannerLogo, { backgroundColor: team.color }]}>
                {team.logo
                  ? <Image source={{ uri: team.logo }} style={s.bannerLogoImg} />
                  : <Text style={{ fontSize: 10 }}>⚽</Text>
                }
              </View>
              <Text style={s.bannerName} numberOfLines={1}>{team.name}</Text>
              <View style={s.bannerScore}><Text style={s.bannerScoreText}>0</Text></View>
            </View>
          ))}
        </View>

        {/* Banner bg color */}
        <View style={s.bgRow}>
          <Text style={s.colorLabel}>Fondo banner</Text>
          <View style={s.colorOptions}>
            {BG_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setBannerBg(c)}
                style={[s.colorDot, { backgroundColor: c, borderColor: '#666' }, bannerBg === c && s.colorDotSelected]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={handleStart} disabled={saving}>
          <Text style={s.startBtnText}>{saving ? '⏳ Guardando...' : '▶  GRABAR'}</Text>
        </TouchableOpacity>
      </View>

      {/* Visitante */}
      <TeamCard team={visitante} setTeam={setVisitante} label="EQUIPO VISITANTE" />
    </View>
  )
}

const s = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#f0c040', fontSize: 20, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#1a1a2e', flexDirection: 'row', padding: 12, gap: 10 },
  teamCard: { flex: 1, backgroundColor: '#16213e', borderRadius: 12, padding: 12, gap: 8 },
  cardTitle: { color: '#aaa', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  logoBox: {
    width: 64, height: 64, borderRadius: 10, backgroundColor: '#0f3460',
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#445',
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  input: {
    backgroundColor: '#0f3460', borderRadius: 8, padding: 8,
    color: '#fff', fontSize: 14, textAlign: 'center', borderWidth: 1, borderColor: '#234',
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  colorLabel: { color: '#aaa', fontSize: 10 },
  colorSwatch: { width: 20, height: 20, borderRadius: 4 },
  colorOptions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'transparent' },
  colorDotSelected: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
  center: { minWidth: 180, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  appTitle: { color: '#f0c040', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  bannerPreview: { width: '100%', borderRadius: 8, overflow: 'hidden' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 5 },
  bannerRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  bannerLogo: { width: 22, height: 22, borderRadius: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bannerLogoImg: { width: '100%', height: '100%' },
  bannerName: { flex: 1, color: '#fff', fontSize: 11, fontWeight: 'bold' },
  bannerScore: { width: 24, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  bannerScoreText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  bgRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  startBtn: { backgroundColor: '#f0c040', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, width: '100%' },
  startBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
})
