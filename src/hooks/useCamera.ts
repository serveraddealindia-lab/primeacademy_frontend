import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCameraOptions {
  width?: number;
  height?: number;
}

export const useCamera = (options?: UseCameraOptions) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: options?.width ?? 640,
        height: options?.height ?? 480,
        facingMode: 'user',
      },
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    streamRef.current = stream;
    setIsCapturing(true);
  }, [options?.height, options?.width]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      throw new Error('Camera not ready');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to capture photo');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreview(dataUrl);
    return dataUrl;
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isCapturing,
    preview,
    start,
    stop,
    capture,
    videoRef,
    canvasRef,
    clearPreview: () => setPreview(null),
  };
};




