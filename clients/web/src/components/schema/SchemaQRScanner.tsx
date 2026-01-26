/**
 * Schema QR Scanner Component
 *
 * Scans QR codes to import schema bundles for offline updates.
 */

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Camera, CheckCircle, AlertTriangle, X, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * QR chunk structure
 */
interface QRChunk {
  total: number
  index: number
  data: string
  hash?: string
}

interface SchemaQRScannerProps {
  /** Callback when bundle is successfully assembled and verified */
  onBundleReady?: (bundleJson: string, hash: string) => void
  /** Callback when scanning is cancelled */
  onCancel?: () => void
  /** Additional class names */
  className?: string
}

export function SchemaQRScanner({
  onBundleReady,
  onCancel,
  className
}: SchemaQRScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false)
  const [chunks, setChunks] = React.useState<Map<number, string>>(new Map())
  const [totalChunks, setTotalChunks] = React.useState(0)
  const [bundleHash, setBundleHash] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [complete, setComplete] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const progress = totalChunks > 0 ? (chunks.size / totalChunks) * 100 : 0

  const startScanning = async () => {
    try {
      setError(null)
      setIsScanning(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()

        // Start QR detection
        scanFrame()
      }
    } catch (err) {
      setError('Failed to access camera. Please grant camera permission.')
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  const scanFrame = async () => {
    if (!videoRef.current || !streamRef.current) return

    // Use BarcodeDetector if available (Chrome, Edge)
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore - BarcodeDetector is not in TS lib yet
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const barcodes = await detector.detect(videoRef.current)

        for (const barcode of barcodes) {
          handleQRData(barcode.rawValue)
        }
      } catch {
        // Detection failed, continue scanning
      }
    }

    // Continue scanning if not complete
    if (!complete && isScanning) {
      requestAnimationFrame(scanFrame)
    }
  }

  const handleQRData = (data: string) => {
    try {
      const chunk = JSON.parse(data) as QRChunk

      // Validate chunk structure
      if (typeof chunk.total !== 'number' || typeof chunk.index !== 'number' || typeof chunk.data !== 'string') {
        return
      }

      // Store hash from first chunk
      if (chunk.index === 0 && chunk.hash) {
        setBundleHash(chunk.hash)
      }

      // Update total if not set
      if (totalChunks === 0) {
        setTotalChunks(chunk.total)
      }

      // Store chunk
      setChunks(prev => {
        const next = new Map(prev)
        if (!next.has(chunk.index)) {
          next.set(chunk.index, chunk.data)
        }
        return next
      })

      // Check if complete
      if (chunks.size + 1 === chunk.total) {
        assembleBundle()
      }
    } catch {
      // Invalid QR data, ignore
    }
  }

  const assembleBundle = () => {
    if (!bundleHash) {
      setError('Missing bundle hash from first chunk')
      return
    }

    // Assemble chunks in order
    const orderedChunks: string[] = []
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks.get(i)
      if (!chunk) {
        setError(`Missing chunk ${i + 1}`)
        return
      }
      orderedChunks.push(chunk)
    }

    const base64 = orderedChunks.join('')

    try {
      // Decode base64 to JSON
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const json = new TextDecoder().decode(bytes)

      setComplete(true)
      stopScanning()
      onBundleReady?.(json, bundleHash)
    } catch (err) {
      setError('Failed to decode bundle data')
    }
  }

  const handleManualInput = () => {
    const input = prompt('Paste QR code data:')
    if (input) {
      handleQRData(input)
    }
  }

  const reset = () => {
    setChunks(new Map())
    setTotalChunks(0)
    setBundleHash(null)
    setError(null)
    setComplete(false)
  }

  React.useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Import Schema via QR Code
        </CardTitle>
        <CardDescription>
          Scan schema bundle QR codes to update offline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video preview */}
        {isScanning && (
          <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 border-2 border-white/50 rounded-lg m-8" />
          </div>
        )}

        {/* Progress */}
        {totalChunks > 0 && !complete && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Scanning chunks...</span>
              <span>{chunks.size} / {totalChunks}</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Complete */}
        {complete && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Bundle Ready</AlertTitle>
            <AlertDescription>
              All {totalChunks} chunks scanned successfully.
              Bundle hash: {bundleHash?.slice(0, 16)}...
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isScanning && !complete && (
            <>
              <Button onClick={startScanning} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Start Scanning
              </Button>
              <Button variant="outline" onClick={handleManualInput}>
                Manual Input
              </Button>
            </>
          )}

          {isScanning && (
            <Button variant="destructive" onClick={stopScanning} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Stop Scanning
            </Button>
          )}

          {(complete || error) && (
            <Button variant="outline" onClick={reset}>
              Scan Again
            </Button>
          )}

          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {/* Help text */}
        {!isScanning && !complete && (
          <p className="text-sm text-muted-foreground">
            Point your camera at schema bundle QR codes. For multi-code bundles,
            scan each code in sequence. Codes can be scanned in any order.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
