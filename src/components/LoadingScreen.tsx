import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  onComplete: () => void
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [phase, setPhase] = useState<'loading' | 'fading'>('loading')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          return 100
        }
        return p + 1.2
      })
    }, 30)

    const fadeTimer = setTimeout(() => setPhase('fading'), 3000)
    const doneTimer = setTimeout(() => onComplete(), 3700)

    return () => {
      clearInterval(interval)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete])

  const whales = [0, 1, 2, 3, 4].map(i => ({
    id: i,
    delay: i * 0.4,
    offset: i * 18,
  }))

  const whalesvg = (color = '#a78bfa') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 45" width="22" height="14">
      <ellipse cx="32" cy="22" rx="26" ry="14" fill="${color}"/>
      <path d="M56 18 Q68 8 65 22 Q68 34 56 28 Z" fill="${color}"/>
      <ellipse cx="26" cy="26" rx="14" ry="6" fill="rgba(255,255,255,0.15)"/>
      <circle cx="14" cy="18" r="2.5" fill="rgba(0,0,0,0.4)"/>
      <circle cx="13" cy="17" r="0.8" fill="rgba(255,255,255,0.7)"/>
    </svg>
  `

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#3a3f53',
      transition: 'opacity 0.7s ease-out',
      opacity: phase === 'fading' ? 0 : 1,
      pointerEvents: phase === 'fading' ? 'none' : 'all',
      overflow: 'hidden',
    }}>
      {/* Ocean background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="oceanGlow" cx="50%" cy="60%" r="60%">
                <stop offset="0%" stopColor="#3a4253" />
                <stop offset="100%" stopColor="#5d6386" />
            </radialGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#oceanGlow)" />
          <g transform="translate(720, 450)" fill="none" stroke="#00bfff">
            <circle cx="0" cy="0" r="80"  opacity="0.03" strokeWidth="1" />
            <circle cx="0" cy="0" r="160" opacity="0.025" strokeWidth="1" />
            <circle cx="0" cy="0" r="240" opacity="0.02" strokeWidth="1" />
            <circle cx="0" cy="0" r="320" opacity="0.015" strokeWidth="1" />
          </g>
          {[...Array(15)].map((_, i) => (
            <circle
              key={i}
              cx={`${(i * 97) % 1440}`}
              cy={`${(i * 73) % 900}`}
              r="1"
              fill="#00bfff"
              opacity={0.06 + (i % 4) * 0.03}
            />
          ))}
        </svg>
      </div>

      {/* Logo + progress */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <img
          src="/logo.svg"
          alt="SonarPath"
          style={{ width: '380px', height: 'auto', marginBottom: '32px' }}
        />

        {/* Whale swimming progress bar */}
        <div style={{ position: 'relative', width: '300px', margin: '-36px auto 0' }}>
          {/* Wavy ocean track using SVG */}
          <svg
            width="300"
            height="30"
            viewBox="0 0 300 30"
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* Wave path as track */}
            <path
              d="M0,15 Q15,8 30,15 Q45,22 60,15 Q75,8 90,15 Q105,22 120,15 Q135,8 150,15 Q165,22 180,15 Q195,8 210,15 Q225,22 240,15 Q255,8 270,15 Q285,22 300,15"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Filled wave progress */}
           <path
                d="M0,15 Q15,8 30,15 Q45,22 60,15 Q75,8 90,15 Q105,22 120,15 Q135,8 150,15 Q165,22 180,15 Q195,8 210,15 Q225,22 240,15 Q255,8 270,15 Q285,22 300,15"
                fill="none"
                stroke="rgb(207, 222, 255)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="320"
                strokeDashoffset={320 - (progress / 100) * 320}
                style={{ transition: 'stroke-dashoffset 0.03s linear' }}
                />
          </svg>

          {/* Swimming whales */}
          {whales.map(w => {
            const pos = Math.min(progress - w.offset, 110)
            if (pos < 0) return null
            return (
              <div
                key={w.id}
                style={{
                  position: 'absolute',
                  top: '-2px',
                  left: `${Math.min(pos, 110)}%`,
                  transform: 'translateX(-50%)',
                  transition: 'left 0.03s linear',
                  opacity: pos > 105 ? 0 : 1,
                  animation: 'whaleBob 0.8s ease-in-out infinite',
                  animationDelay: `${w.delay}s`,
                }}
                dangerouslySetInnerHTML={{ __html: whalesvg('#a78bfa') }}
              />
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes whaleBob {
          0%, 100% { transform: translateX(-50%) translateY(0px) rotate(-2deg); }
          50%       { transform: translateX(-50%) translateY(-4px) rotate(2deg); }
        }
      `}</style>
    </div>
  )
}