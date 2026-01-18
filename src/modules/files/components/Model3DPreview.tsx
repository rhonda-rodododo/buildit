/**
 * 3D Model Preview Component
 * Epic 57: Preview OBJ and STL files using Three.js
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, ZoomIn, ZoomOut, Move3D, Box, Download } from 'lucide-react'

interface Model3DPreviewProps {
  url: string
  filename: string
}

export function Model3DPreview({ url, filename }: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sceneRef, setSceneRef] = useState<{
    resetCamera: () => void
    zoomIn: () => void
    zoomOut: () => void
  } | null>(null)

  useEffect(() => {
    let cleanup: (() => void) | undefined

    const loadModel = async () => {
      if (!containerRef.current) return

      setLoading(true)
      setError(null)

      try {
        // Dynamic import Three.js and loaders
        const THREE = await import('three')
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        const container = containerRef.current
        const width = container.clientWidth
        const height = container.clientHeight

        // Create scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1a1a2e)

        // Create camera
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
        camera.position.set(0, 0, 5)

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(window.devicePixelRatio)
        container.appendChild(renderer.domElement)

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        directionalLight.position.set(5, 5, 5)
        scene.add(directionalLight)

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5)
        directionalLight2.position.set(-5, -5, -5)
        scene.add(directionalLight2)

        // Add orbit controls
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05

        // Determine file type and load
        const ext = filename.split('.').pop()?.toLowerCase()

        let geometry: InstanceType<typeof THREE.BufferGeometry> | undefined

        if (ext === 'stl') {
          const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
          const loader = new STLLoader()
          const response = await fetch(url)
          const buffer = await response.arrayBuffer()
          geometry = loader.parse(buffer)
        } else if (ext === 'obj') {
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
          const loader = new OBJLoader()
          const response = await fetch(url)
          const text = await response.text()
          const obj = loader.parse(text)

          // Extract geometry from OBJ (may have multiple meshes)
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (!geometry) {
                geometry = child.geometry.clone()
              }
            }
          })

          // If OBJ has group, add directly
          if (!geometry) {
            // Center the object
            const box = new THREE.Box3().setFromObject(obj)
            const center = box.getCenter(new THREE.Vector3())
            obj.position.sub(center)

            // Scale to fit
            const size = box.getSize(new THREE.Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            const scale = 4 / maxDim
            obj.scale.multiplyScalar(scale)

            scene.add(obj)
          }
        }

        // If we have geometry, create mesh
        if (geometry) {
          // Center geometry
          geometry.center()

          // Compute normals if not present
          if (!geometry.attributes.normal) {
            geometry.computeVertexNormals()
          }

          // Create material
          // Create material
          const material = new THREE.MeshStandardMaterial({
            color: 0x3b82f6, // Blue color
            metalness: 0.3,
            roughness: 0.7,
            flatShading: false,
          })

          // Cast geometry to the correct type for Three.js Mesh constructor
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mesh = new THREE.Mesh(geometry as any, material)

          // Scale to fit view
          const box = new THREE.Box3().setFromObject(mesh)
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 4 / maxDim
          mesh.scale.multiplyScalar(scale)

          scene.add(mesh)
        }

        // Add grid helper
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
        scene.add(gridHelper)

        // Animation loop
        let animationId: number
        const animate = () => {
          animationId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // Handle resize
        const handleResize = () => {
          if (!containerRef.current) return
          const newWidth = containerRef.current.clientWidth
          const newHeight = containerRef.current.clientHeight
          camera.aspect = newWidth / newHeight
          camera.updateProjectionMatrix()
          renderer.setSize(newWidth, newHeight)
        }
        window.addEventListener('resize', handleResize)

        // Set control functions
        setSceneRef({
          resetCamera: () => {
            camera.position.set(0, 0, 5)
            camera.lookAt(0, 0, 0)
            controls.reset()
          },
          zoomIn: () => {
            camera.position.multiplyScalar(0.8)
          },
          zoomOut: () => {
            camera.position.multiplyScalar(1.25)
          },
        })

        setLoading(false)

        // Cleanup function
        cleanup = () => {
          cancelAnimationFrame(animationId)
          window.removeEventListener('resize', handleResize)
          renderer.dispose()
          controls.dispose()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        }
      } catch (err) {
        console.error('Failed to load 3D model:', err)
        setError(err instanceof Error ? err.message : 'Failed to load 3D model')
        setLoading(false)
      }
    }

    loadModel()

    return () => {
      if (cleanup) cleanup()
    }
  }, [url, filename])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/10 p-8">
        <Box className="h-16 w-16 text-red-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to load 3D model</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">{error}</p>
        <Button variant="outline" onClick={() => window.open(url, '_blank')}>
          <Download className="h-4 w-4 mr-2" />
          Download Model
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading 3D model...</p>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Badge variant="secondary" className="justify-center">
          <Move3D className="h-3 w-3 mr-1" />
          3D Model
        </Badge>
        {sceneRef && (
          <>
            <Button variant="secondary" size="icon" onClick={sceneRef.zoomIn} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={sceneRef.zoomOut} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={sceneRef.resetCamera} title="Reset View">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Three.js canvas container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10">
        <Badge variant="outline" className="bg-background/80">
          Drag to rotate | Scroll to zoom | Shift+drag to pan
        </Badge>
      </div>
    </div>
  )
}
