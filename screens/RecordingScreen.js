import { useRef, useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, AppState } from 'react-native'
import { useCameraDevice, useCameraDevices, getCameraDevice, useCameraPermission, useMicrophonePermission, Camera } from 'react-native-vision-camera'

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function RecordingScreen({ local, setLocal, visitante, setVisitante, bannerBg, onStop, onCameraFailed }) {
  const { hasPermission, requestPermission } = useCameraPermission()
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission()
  const allDevices = useCameraDevices()
  const vcDevice = useCameraDevice('back')
  const device = vcDevice ?? getCameraDevice(allDevices, 'back') ?? allDevices[0]
  const cameraRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [zoom, setZoom] = useState(1)
  const startTimeRef = useRef(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isAppActive, setIsAppActive] = useState(true)

  const deviceRef = useRef(device)
  deviceRef.current = device
  const recordingRef = useRef(recording)
  recordingRef.current = recording

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      const active = state === 'active'
      setIsAppActive(active)
      if (active && !deviceRef.current && !recordingRef.current) {
        onCameraFailed?.()
      }
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (hasPermission && !device) {
      const t = setTimeout(() => setRetryCount(c => c + 1), 300)
      return () => clearTimeout(t)
    }
  }, [hasPermission, device, retryCount])

  useEffect(() => {
    if (!hasPermission) requestPermission()
    if (!hasMicPermission) requestMicPermission()
  }, [hasPermission, hasMicPermission])

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [recording])

  const startRecording = () => {
    if (!cameraRef.current) return
    try {
      startTimeRef.current = Date.now()
      setRecording(true)
      cameraRef.current.startRecording({
        fileType: 'mp4',
        onRecordingFinished: (video) => {
          setRecording(false)
          onStop(video.path)
        },
        onRecordingError: (e) => {
          Alert.alert('Error al grabar', e.message)
          setRecording(false)
        },
      })
    } catch (e) {
      Alert.alert('Error al iniciar', e.message)
      setRecording(false)
    }
  }

  const stopRecording = async () => {
    await cameraRef.current?.stopRecording()
    setRecording(false)
  }

  const adjust = (team, setTeam, delta) => {
    setTeam(t => ({ ...t, score: Math.max(0, t.score + delta) }))
  }

  const zoomIn = () => setZoom(z => Math.min(device?.maxZoom ?? 10, z + 0.5))
  const zoomOut = () => setZoom(z => Math.max(device?.minZoom ?? 1, z - 0.5))

  if (!hasPermission) {
    return (
      <View style={s.center}>
        <Text style={s.permText}>Necesitamos permiso de cámara</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    if (retryCount < 20) {
      return (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#f0c040" />
          <Text style={s.permText}>Buscando cámara...</Text>
        </View>
      )
    }
    return (
      <View style={s.center}>
        <Text style={s.permText}>No se encontró cámara</Text>
        <Text style={s.debugInfo}>
          Permisos: {hasPermission ? 'CAM ✓' : 'CAM ✗'} {hasMicPermission ? 'MIC ✓' : 'MIC ✗'}
        </Text>
        <Text style={s.debugInfo}>
          Cámaras: {allDevices.length}{allDevices.length > 0 ? ` [${allDevices.map(d => d.position).join(', ')}]` : ''}
        </Text>
        <TouchableOpacity style={s.permBtn} onPress={() => onCameraFailed?.()}>
          <Text style={s.permBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isAppActive || recording}
        video={true}
        audio={true}
        zoom={zoom}
      />

      <View style={s.controls}>
        <View style={s.scoreGroup}>
          <Text style={s.teamLabel}>{local.name}</Text>
          <View style={s.scoreRow}>
            <TouchableOpacity style={[s.scoreBtn, { backgroundColor: '#555' }]} onPress={() => adjust(local, setLocal, -1)}>
              <Text style={s.scoreBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.scoreDisplay}>{local.score}</Text>
            <TouchableOpacity style={[s.scoreBtn, { backgroundColor: local.color }]} onPress={() => adjust(local, setLocal, 1)}>
              <Text style={s.scoreBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.centerControls}>
          {recording && <Text style={s.timer}>⏺ {fmt(elapsed)}</Text>}
          <TouchableOpacity
            style={[s.recordBtn, recording && s.recordBtnActive]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Text style={s.recordBtnText}>{recording ? '⏹ STOP' : '⏺ GRABAR'}</Text>
          </TouchableOpacity>
          <View style={s.zoomRow}>
            <TouchableOpacity style={s.zoomBtn} onPress={zoomOut}><Text style={s.zoomText}>−</Text></TouchableOpacity>
            <Text style={s.zoomLabel}>{zoom.toFixed(1)}x</Text>
            <TouchableOpacity style={s.zoomBtn} onPress={zoomIn}><Text style={s.zoomText}>+</Text></TouchableOpacity>
          </View>
        </View>

        <View style={s.scoreGroup}>
          <Text style={s.teamLabel}>{visitante.name}</Text>
          <View style={s.scoreRow}>
            <TouchableOpacity style={[s.scoreBtn, { backgroundColor: visitante.color }]} onPress={() => adjust(visitante, setVisitante, 1)}>
              <Text style={s.scoreBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={s.scoreDisplay}>{visitante.score}</Text>
            <TouchableOpacity style={[s.scoreBtn, { backgroundColor: '#555' }]} onPress={() => adjust(visitante, setVisitante, -1)}>
              <Text style={s.scoreBtnText}>−</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', gap: 16 },
  permText: { color: '#fff', fontSize: 16 },
  debugInfo: { color: '#aaa', fontSize: 12, textAlign: 'center' },
  permBtn: { backgroundColor: '#f0c040', padding: 12, borderRadius: 10 },
  permBtnText: { color: '#1a1a2e', fontWeight: 'bold' },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.75)', gap: 12,
  },
  scoreGroup: { flex: 1, alignItems: 'center', gap: 4 },
  teamLabel: { color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scoreBtnText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 28 },
  scoreDisplay: { color: '#fff', fontSize: 24, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
  centerControls: { flex: 1, alignItems: 'center', gap: 6 },
  timer: { color: '#f0c040', fontSize: 18, fontWeight: 'bold' },
  recordBtn: { backgroundColor: '#27ae60', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 20 },
  recordBtnActive: { backgroundColor: '#e74c3c' },
  recordBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  zoomLabel: { color: '#fff', fontSize: 13, minWidth: 36, textAlign: 'center' },
})
