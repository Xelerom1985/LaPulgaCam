import { useRef, useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useCameraDevice, useCameraPermission, useMicrophonePermission, Camera, useSkiaFrameProcessor } from 'react-native-vision-camera'
import { Skia } from '@shopify/react-native-skia'
import { useSharedValue } from 'react-native-worklets-core'

const BANNER_X = 16
const BANNER_Y = 16
const BANNER_W = 280
const BANNER_H = 90
const ROW_H = 44

function hexToRgb(hex) {
  'worklet'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return { r, g, b }
}

function makeSkiaColor(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex)
  return Skia.Color(r, g, b, alpha)
}

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function RecordingScreen({ local, setLocal, visitante, setVisitante, bannerBg, onStop }) {
  const { hasPermission, requestPermission } = useCameraPermission()
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission()
  const device = useCameraDevice('back')
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    Camera.getAvailableCameraDevices()
      .then((devices) => {
        const info = devices.map(d => `${d.position} | id:${d.id} | physical:${d.physicalDevices?.join(',')}`).join('\n')
        setDebugInfo(`hasPermission: ${hasPermission}\nDispositivos encontrados: ${devices.length}\n${info}`)
      })
      .catch((e) => setDebugInfo(`Error listando cámaras: ${e.message}`))
  }, [hasPermission])
  const cameraRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [zoom, setZoom] = useState(1)
  const startTimeRef = useRef(null)

  // Shared values for the worklet (frame processor runs off main thread)
  const localScore = useSharedValue(local.score)
  const visitanteScore = useSharedValue(visitante.score)
  const localName = useSharedValue(local.name)
  const visitanteName = useSharedValue(visitante.name)
  const localColor = useSharedValue(local.color)
  const visitanteColor = useSharedValue(visitante.color)
  const bannerBgColor = useSharedValue(bannerBg)

  // Keep shared values in sync
  useEffect(() => { localScore.value = local.score }, [local.score])
  useEffect(() => { visitanteScore.value = visitante.score }, [visitante.score])
  useEffect(() => { localName.value = local.name }, [local.name])
  useEffect(() => { visitanteName.value = visitante.name }, [visitante.name])
  useEffect(() => { localColor.value = local.color }, [local.color])
  useEffect(() => { visitanteColor.value = visitante.color }, [visitante.color])
  useEffect(() => { bannerBgColor.value = bannerBg }, [bannerBg])

  // Timer
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [recording])

  useEffect(() => {
    if (!hasPermission) requestPermission()
    if (!hasMicPermission) requestMicPermission()
  }, [hasPermission, hasMicPermission])

  // Skia frame processor — draws banner on every frame (burned into recording)
  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet'
    frame.render()

    const bx = BANNER_X
    const by = BANNER_Y

    // Background
    const bgPaint = Skia.Paint()
    bgPaint.setColor(Skia.Color(0, 0, 0, 0.85))
    bgPaint.setAntiAlias(true)
    const rrect = Skia.RRectXY(Skia.XYWHRect(bx, by, BANNER_W, BANNER_H), 8, 8)
    frame.drawRRect(rrect, bgPaint)

    // Divider
    const divPaint = Skia.Paint()
    divPaint.setColor(Skia.Color(1, 1, 1, 0.15))
    frame.drawRect(Skia.XYWHRect(bx, by + ROW_H, BANNER_W, 1), divPaint)

    const teams = [
      { name: localName.value, score: localScore.value, color: localColor.value },
      { name: visitanteName.value, score: visitanteScore.value, color: visitanteColor.value },
    ]

    const font = Skia.Font(null, 16)
    const fontScore = Skia.Font(null, 22)

    teams.forEach((team, i) => {
      const ry = by + i * ROW_H
      const cy = ry + ROW_H / 2

      // Team color circle
      const circlePaint = Skia.Paint()
      circlePaint.setColor(Skia.Color(...Object.values(hexToRgb(team.color)), 1))
      circlePaint.setAntiAlias(true)
      frame.drawCircle(bx + 14 + 12, cy, 12, circlePaint)

      // Team name
      const textPaint = Skia.Paint()
      textPaint.setColor(Skia.Color(1, 1, 1, 1))
      frame.drawText(team.name, bx + 40, cy + 6, font, textPaint)

      // Score box
      const scoreBoxPaint = Skia.Paint()
      scoreBoxPaint.setColor(Skia.Color(1, 1, 1, 0.2))
      frame.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(bx + BANNER_W - 44, ry + 8, 36, ROW_H - 16), 4, 4),
        scoreBoxPaint
      )

      // Score text
      const scoreText = String(team.score)
      frame.drawText(scoreText, bx + BANNER_W - 44 + 10, cy + 8, fontScore, textPaint)
    })
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
      Alert.alert('Error al iniciar grabación', e.message)
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
    return (
      <View style={s.center}>
        <Text style={s.permText}>No se encontró cámara</Text>
        <Text style={[s.permText, { fontSize: 12, textAlign: 'left' }]}>{debugInfo}</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        video={true}
        audio={true}
        zoom={zoom}
        frameProcessor={frameProcessor}
        pixelFormat="rgb"
      />

      {/* Bottom controls */}
      <View style={s.controls}>
        {/* Local score */}
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

        {/* Center: timer + record + zoom */}
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

        {/* Visitante score */}
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
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: 12,
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
