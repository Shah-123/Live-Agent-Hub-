import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook to handle OpenAI Realtime Voice Interaction.
 * Connects to the local relay and manages audio capture/playback.
 */
export function useRealtimeVoice() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Buffer for playing back received audio chunks
  const audioBufferRef = useRef<Int16Array[]>([]);

  const connect = useCallback(async () => {
    if (socketRef.current) return;

    // 1. Initialize Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

    // 2. Setup WebSocket connection to our relay
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Assuming same host for now, or use env
    // For local dev, Vite will proxy the /api route (including WS with ws: true)
    const relayUrl = `${protocol}//${host}/api/realtime/relay`;
    
    const socket = new WebSocket(relayUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Realtime relay connected');
      setIsConnected(true);
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      // Handle server events from OpenAI
      if (data.type === 'session.created') {
        setIsReady(true);
      }

      if (data.type === 'response.audio.delta') {
        const base64Audio = data.delta;
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const pcm16 = new Int16Array(bytes.buffer);
        playAudioChunk(pcm16);
      }

      // Handle user being interrupted
      if (data.type === 'input_audio_buffer.speech_started') {
        console.log('User started speaking, interrupting agent...');
        stopAgentSpeaking();
      }
    };

    socket.onclose = () => {
      console.log('Realtime relay closed');
      setIsConnected(false);
      setIsReady(false);
      socketRef.current = null;
    };

    // 3. Setup Microphone Capture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Use ScriptProcessor for simplicity in this initial integration
      // (Worklets are better but need separate files which can be tricky with Vite/ESm)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (!isReady || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send to relay
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        socketRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }));
      };

    } catch (err) {
      console.error('Failed to access microphone', err);
    }
  }, [isReady]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    socketRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  const playAudioChunk = (pcm16: Int16Array) => {
    if (!audioContextRef.current) return;

    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
    };
  };

  const stopAgentSpeaking = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "response.cancel" }));
    }
    
    // Instantly stop all scheduled audio
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped or not started
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  };

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    isConnected,
    isReady,
    connect,
    disconnect
  };
}
