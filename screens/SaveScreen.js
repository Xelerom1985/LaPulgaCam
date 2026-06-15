import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import * as MediaLibrary from 'expo-media-library'

export default function SaveScreen({ videoPath, local, visitante, onNewMatch }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos permiso para guardar en la galería.')
        return
      }
      await MediaLibrary.saveToLibraryAsync(videoPath)
      setSaved(true)
      Alert.alert('✅ Video guardado', 'El video quedó en tu galería listo para subir a YouTube.')
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el video.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={s.container}>
      {/* Video preview */}
      <Video
        source={{ uri: `file://${videoPath}` }}
        style={s.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
      />

      {/* Right panel */}
      <View style={s.panel}>
        <Text style={s.title}>⚽ LaPulgaCam</Text>

        {/* Final score */}
        <View style={s.scoreCard}>
          <View style={s.teamInfo}>
            {local.logo && <Image source={{ uri: local.logo }} style={s.teamLogo} />}
            <Text style={s.teamName} numberOfLines={1}>{local.name}</Text>
          </View>
          <Text style={s.score}>{local.score} – {visitante.score}</Text>
          <View style={s.teamInfo}>
            <Text style={s.teamName} numberOfLines={1}>{visitante.name}</Text>
            {visitante.logo && <Image source={{ uri: visitante.logo }} style={s.teamLogo} />}
          </View>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving || saved}>
          <Text style={s.saveBtnText}>
            {saving ? '⏳ Guardando...' : saved ? '✅ Guardado' : '⬇ GUARDAR EN GALERÍA'}
          </Text>
        </TouchableOpacity>

        {saved && (
          <Text style={s.hint}>Listo para subir a YouTube</Text>
        )}

        <TouchableOpacity style={s.newBtn} onPress={onNewMatch}>
          <Text style={s.newBtnText}>← Nuevo partido</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', flexDirection: 'row', padding: 16, gap: 16 },
  video: { flex: 1, borderRadius: 10, backgroundColor: '#000' },
  panel: { width: 200, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  title: { color: '#f0c040', fontSize: 18, fontWeight: 'bold' },
  scoreCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 12, width: '100%', gap: 8 },
  teamInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamLogo: { width: 28, height: 28, borderRadius: 4 },
  teamName: { color: '#fff', fontSize: 11, fontWeight: 'bold', flex: 1 },
  score: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 },
  saveBtn: { backgroundColor: '#27ae60', borderRadius: 10, padding: 12, width: '100%' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 13 },
  hint: { color: '#2ecc71', fontSize: 11, textAlign: 'center' },
  newBtn: { backgroundColor: '#0f3460', borderRadius: 10, padding: 10, width: '100%' },
  newBtnText: { color: '#aaa', textAlign: 'center', fontSize: 13 },
})
