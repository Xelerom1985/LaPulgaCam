import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import SetupScreen from './screens/SetupScreen'
import RecordingScreen from './screens/RecordingScreen'
import SaveScreen from './screens/SaveScreen'

const makeTeam = (side) => ({
  name: side === 'local' ? 'LOCAL' : 'VISITANTE',
  logo: null,
  color: side === 'local' ? '#c0392b' : '#2980b9',
  score: 0,
})

export default function App() {
  const [screen, setScreen] = useState('setup')
  const [local, setLocal] = useState(makeTeam('local'))
  const [visitante, setVisitante] = useState(makeTeam('visitante'))
  const [videoPath, setVideoPath] = useState(null)
  const [bannerBg, setBannerBg] = useState('#111111')
  const [cameraKey, setCameraKey] = useState(0)

  const handleStart = () => {
    setLocal(t => ({ ...t, score: 0 }))
    setVisitante(t => ({ ...t, score: 0 }))
    setScreen('recording')
  }

  const handleStop = (path) => {
    setVideoPath(path)
    setScreen('save')
  }

  if (screen === 'recording') {
    return (
      <>
        <StatusBar hidden />
        <RecordingScreen
          key={cameraKey}
          local={local} setLocal={setLocal}
          visitante={visitante} setVisitante={setVisitante}
          bannerBg={bannerBg}
          onStop={handleStop}
          onCameraFailed={() => setCameraKey(k => k + 1)}
        />
      </>
    )
  }

  if (screen === 'save') {
    return (
      <>
        <StatusBar style="light" />
        <SaveScreen
          videoPath={videoPath}
          local={local}
          visitante={visitante}
          onNewMatch={() => { setVideoPath(null); setScreen('setup') }}
        />
      </>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <SetupScreen
        local={local} setLocal={setLocal}
        visitante={visitante} setVisitante={setVisitante}
        bannerBg={bannerBg} setBannerBg={setBannerBg}
        onStart={handleStart}
      />
    </>
  )
}
