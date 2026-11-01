import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type SpeechError = 'denied' | 'no-speech' | 'unavailable' | 'other';

/**
 * Browser speech-to-text (free). Not available in the Android app's WebView or some iOS PWAs,
 * so `supported` is false there and the mic button is simply not shown.
 */
export function useSpeech(onFinal: (text: string) => void, onError: (e: SpeechError) => void) {
  const supported = Boolean(ctor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const ref = useRef<RecognitionLike | null>(null);
  const cb = useRef({ onFinal, onError });
  useEffect(() => {
    cb.current = { onFinal, onError };
  }, [onFinal, onError]);
  useEffect(() => () => ref.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor || ref.current) return;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final = e.results[i].isFinal;
      }
      setInterim(text);
      if (final) cb.current.onFinal(text.trim());
    };
    rec.onerror = (e) => {
      cb.current.onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'no-speech' : e.error === 'network' ? 'unavailable' : 'other');
    };
    rec.onend = () => {
      ref.current = null;
      setListening(false);
      setInterim('');
    };
    ref.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      ref.current = null;
      setListening(false);
      cb.current.onError('other');
    }
  }, []);

  const stop = useCallback(() => ref.current?.stop(), []);
  return { supported, listening, interim, start, stop };
}
