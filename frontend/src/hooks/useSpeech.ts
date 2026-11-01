import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

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
 * Speech-to-text (free). Browsers use the Web Speech API; the Android app uses the phone's own recognizer through a
 * Capacitor plugin (the WebView has no Web Speech API). Where neither exists, `supported` is false and the mic is hidden.
 */
export function useSpeech(onFinal: (text: string) => void, onError: (e: SpeechError) => void) {
  const native = Capacitor.isNativePlatform();
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const supported = native ? nativeAvailable : Boolean(ctor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const ref = useRef<RecognitionLike | null>(null);
  const busy = useRef(false);
  const cb = useRef({ onFinal, onError });
  useEffect(() => {
    cb.current = { onFinal, onError };
  }, [onFinal, onError]);

  useEffect(() => {
    if (!native) return;
    let alive = true;
    void import('@capacitor-community/speech-recognition')
      .then(({ SpeechRecognition }) => SpeechRecognition.available())
      .then((r) => alive && setNativeAvailable(r.available))
      .catch(() => alive && setNativeAvailable(false));
    return () => {
      alive = false;
    };
  }, [native]);

  useEffect(
    () => () => {
      ref.current?.stop();
      if (native) void import('@capacitor-community/speech-recognition').then(({ SpeechRecognition }) => SpeechRecognition.stop().catch(() => undefined));
    },
    [native],
  );

  const startNative = useCallback(async () => {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
    let perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') {
      cb.current.onError('denied');
      return;
    }
    await SpeechRecognition.removeAllListeners();
    let last = '';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      void SpeechRecognition.removeAllListeners();
      setListening(false);
      setInterim('');
      busy.current = false;
      if (last.trim()) cb.current.onFinal(last.trim());
      else cb.current.onError('no-speech');
    };
    await SpeechRecognition.addListener('partialResults', (d) => {
      last = d.matches?.[0] ?? last;
      setInterim(last);
    });
    await SpeechRecognition.addListener('listeningState', (d) => {
      if (d.status === 'stopped') finish(); // Android ends the session on silence
    });
    setListening(true);
    try {
      await SpeechRecognition.start({ language: 'en-IN', maxResults: 1, partialResults: true, popup: false });
    } catch {
      finished = true;
      setListening(false);
      busy.current = false;
      cb.current.onError('unavailable');
    }
  }, []);

  const start = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    if (native) {
      void startNative().catch(() => {
        busy.current = false;
        setListening(false);
        cb.current.onError('other');
      });
      return;
    }
    const Ctor = ctor();
    if (!Ctor) {
      busy.current = false;
      return;
    }
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
      busy.current = false;
      setListening(false);
      setInterim('');
    };
    ref.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      ref.current = null;
      busy.current = false;
      setListening(false);
      cb.current.onError('other');
    }
  }, [native, startNative]);

  const stop = useCallback(() => {
    if (native) void import('@capacitor-community/speech-recognition').then(({ SpeechRecognition }) => SpeechRecognition.stop().catch(() => undefined));
    else ref.current?.stop();
  }, [native]);

  return { supported, listening, interim, start, stop };
}
