import { FC } from 'react'

const App: FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          BuildIt Network
        </h1>
        <p className="text-muted-foreground">
          Privacy-first organizing platform
        </p>
      </div>
    </div>
  )
}

export default App
