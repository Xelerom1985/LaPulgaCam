import { useRef, useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, AppState } from 'react-native'
import { useCameraDevice, useCameraPermission, useMicrophonePermission, Camera, useSkiaFrameProcessor } from 'react-native-vision-camera'
import { Skia } from '@shopify/react-native-skia'
import { useSharedValue } from 'react-native-worklets-core'

const BANNER_X = 16
const BANNER_Y = 16
const BANNER_W = 280
const BANNER_H = 90
const ROW_H = 44

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function RecordingScreen({ local, setLocal, visitante, setVisitante, bannerBg, onStop }) {
  const { hasPermission, requestPermission } = useCameraPermission()
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission()
  const device = useCameraDevice('back')
  const cameraRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [zoom, setZoom] = useState(1)
  const startTimeRef = useRef(null)
  const [noOverlay, setNoOverlay] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isAppActive, setIsAppActive] = useState(true)

  // Liberar/readquirir cámara cuando la app pasa a background/foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      const active = state === 'active'
      setIsAppActive(active)
      if (active) setRetryCount(0) // Reinicia detección al volver al frente
    })
    return () => sub.remove()
  }, [])

  // Retry cada 300ms hasta que aparezca la cámara
  useEffect(() => {
    if (hasPermission && !device) {
      const t = setTimeout(() => setRetryCount(c => c + 1), 300)
      return () => clearTimeout(t)
    }
  }, [hasPermission, device, retryCount])

  // Valores compartidos — solo strings/números, sin Skia en el render
  const localScore = useSharedValue(local.score)
  const visitanteScore = useSharedValue(visitante.score)
  const localName = useSharedValue(local.name)
  const visitanteName = useSharedValue(visitante.name)
  const localColor = useSharedValue(local.color)
  const visitanteColor = useSharedValue(visitante.color)

  useEffect(() => { localScore.value = local.score }, [local.score])
  useEffect(() => { visitanteScore.value = visitante.score }, [visitante.score])
  useEffect(() => { localName.value = local.name }, [local.name])
  useEffect(() => { visitanteName.value = visitante.name }, [visitante.name])
  useEffect(() => { localColor.value = local.color }, [local.color])
  useEffect(() => { visitanteColor.value = visitante.color }, [visitante.color])

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

  // Objetos Skia creados dentro del worklet (como en builds anteriores que funcionaban)
  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet'
    frame.render()

    const bgPaint = Skia.Paint()
    bgPaint.setColor(Skia.Color('#000000'))
    bgPaint.setAlphaf(0.85)
    bgPaint.setAntiAlias(true)
    frame.drawRRect(
      Skia.RRectXY(Skia.XYWHRect(BANNER_X, BANNER_Y, BANNER_W, BANNER_H), 8, 8),
      bgPaint
    )

    const divPaint = Skia.Paint()
    divPaint.setColor(Skia.Color('#ffffff'))
    divPaint.setAlphaf(0.15)
    frame.drawRect(Skia.XYWHRect(BANNER_X, BANNER_Y + ROW_H, BANNER_W, 1), divPaint)

    const textPaint = Skia.Paint()
    textPaint.setColor(Skia.Color('#ffffff'))

    const font = Skia.Font(null, 16)
    const fontScore = Skia.Font(null, 22)

    const teams = [
      { name: localName.value, score: localScore.value, color: localColor.value },
      { name: visitanteName.value, score: visitanteScore.value, color: visitanteColor.value },
    ]

    for (let i = 0; i < 2; i++) {
      const team = teams[i]
      const ry = BANNER_Y + i * ROW_H
      const cy = ry + ROW_H / 2

      const circlePaint = Skia.Paint()
      circlePaint.setColor(Skia.Color(team.color))
      circlePaint.setAntiAlias(true)
      frame.drawCircle(BANNER_X + 26, cy, 12, circlePaint)

      frame.drawText(team.name, BANNER_X + 44, cy + 6, font, textPaint)

      const scoreBoxPaint = Skia.Paint()
      scoreBoxPaint.setColor(Skia.Color('#ffffff'))
      scoreBoxPaint.setAlphaf(0.2)
      frame.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(BANNER_X + BANNER_W - 44, ry + 8, 36, ROW_H - 16), 4, 4),
        scoreBoxPaint
      )

      frame.drawText(String(team.score), BANNER_X + BANNER_W - 34, cy + 8, fontScore, textPaint)
    }
  }, [localScore, visitanteScore, localName, visitanteName, localColor, visitanteColor])

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
        <TouchableOpacity style={s.permBtn} onPress={() => setRetryCount(0)}>
          <Text style={s.permBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <Camera
        key={noOverlay ? 'nofp' : 'fp'}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isAppActive || recording}
        video={true}
        audio={true}
        zoom={zoom}
        frameProcessor={noOverlay ? undefined : frameProcessor}
      />

      <TouchableOpacity
        style={[s.diagBtn, !noOverlay && s.diagBtnActive]}
        onPress={() => { if (!recording) setNoOverlay(v => !v) }}
      >
        <Text style={s.diagText}>{noOverlay ? 'SIN OVERLAY' : 'CON OVERLAY'}</Text>
      </TouchableOpacity>

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
  permBtn: { backgroundColor: '#f0c040', padding: 12, borderRadius: 10 },
  permBtnText: { color: '#1a1a2e', fontWeight: 'bold' },
  diagBtn: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6,
    borderWidth: 1, borderColor: '#666',
  },
  diagBtnActive: { borderColor: '#f0c040' },
  diagText: { color: '#ccc', fontSize: 11, fontWeight: 'bold' },
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
