import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal shape of the Web Speech API's SpeechRecognition -- not in
// lib.dom.d.ts in all TS configs, so declared narrowly here rather than
// pulling in a full ambient types package for one feature.
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Voice input (speech-to-text) and voice output (text-to-speech), both
 * using real, native browser APIs -- no server-side audio pipeline. Feature
 * detection is explicit so the rest of the app can show "voice isn't
 * supported in this browser" instead of silently doing nothing (spec #41/#85:
 * never pretend a capability works when it doesn't). Chrome/Edge support
 * SpeechRecognition; Firefox/Safari currently do not, but speechSynthesis
 * (voice output) is widely supported everywhere. */
export function useSpeech() {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const sttSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge, or type instead.')
      return
    }
    setError('')
    setTranscript('')
    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      setTranscript((finalText || interimText).trim())
    }
    recognition.onerror = () => {
      setError('Microphone error or permission denied.')
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || !text) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    },
    [ttsSupported]
  )

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [ttsSupported])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      if (ttsSupported) window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    sttSupported,
    ttsSupported,
    listening,
    speaking,
    transcript,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript: () => setTranscript(''),
  }
}
