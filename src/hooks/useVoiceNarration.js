import { useState, useEffect, useRef } from 'react'

const VOICE_CONFIG = { rate: 0.9, pitch: 1.0, volume: 0.9 }

export default function useVoiceNarration(message) {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const lastSpoken = useRef(null)

  function speakMessage(text) {
    if (!text || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate   = VOICE_CONFIG.rate
    utt.pitch  = VOICE_CONFIG.pitch
    utt.volume = VOICE_CONFIG.volume
    window.speechSynthesis.speak(utt)
  }

  function toggleVoice() {
    setVoiceEnabled(prev => {
      if (prev && window.speechSynthesis) window.speechSynthesis.cancel()
      return !prev
    })
  }

  useEffect(() => {
    if (!voiceEnabled || !message || message === lastSpoken.current) return
    lastSpoken.current = message
    speakMessage(message)
  }, [message, voiceEnabled])

  return { voiceEnabled, toggleVoice }
}
