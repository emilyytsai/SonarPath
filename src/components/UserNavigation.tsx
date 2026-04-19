import { useState } from 'react'

interface UserNavigationProps {
  onDismiss: () => void
}

export default function UserNavigation({ onDismiss }: UserNavigationProps) {
  const [fading, setFading] = useState(false)

  function dismiss() {
    setFading(true)
    setTimeout(onDismiss, 400)
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'all',
        transition: 'opacity 0.4s ease',
        opacity: fading ? 0 : 1,
      }}
    >
      {/* Tooltip card */}
      <div
        onClick={dismiss}
        style={{
        position: 'absolute',
        top: '120px',
        left: '330px',  // 288px wide + gap
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(255,255,255,0.15)',
        borderRadius: '12px',
        padding: '20px 24px',
        width: '290px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute',
            top: '10px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(0,191,255,0.15)',
            border: '0.5px solid rgba(0,191,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            🚢
          </div>
          <div>
            <p style={{ color: '#00bfff', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', margin: 0 }}>
              Welcome!
            </p>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {[
            { step: '1', text: 'Select a departure and arrival port above', color: '#00bfff', highlight: true },
            { step: '2', text: 'Choose a route', color: '#5cb85c' },
            { step: '3', text: 'Adjust speed to see your noise footprint', color: '#f5a623' },
            { step: '4', text: 'Generate an ESG report for your voyage', color: '#a78bfa' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: `${s.color}22`,
                border: `0.5px solid ${s.color}${s.highlight ? 'cc' : '66'}`,
                color: s.color,
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontFamily: 'ui-monospace, monospace',
                boxShadow: s.highlight ? `0 0 6px ${s.color}44` : 'none',
              }}>
                {s.step}
              </div>
              <p style={{
                color: s.highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                margin: 0,
                lineHeight: 1.5,
                fontFamily: 'ui-monospace, monospace',
                fontWeight: s.highlight ? 500 : 400,
              }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>

        {/* Dismiss hint */}
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', textAlign: 'center', margin: '10px 0 0', fontFamily: 'ui-monospace, monospace' }}>
          click anywhere to dismiss
        </p>

        {/* Bouncing arrow pointing left to sidebar */}
        <div style={{
        position: 'absolute',
        top: '27%',
        left: '-25px',
        transform: 'translateY(-50%)',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '28px',
        animation: 'bounceArrow 1s ease-in-out infinite',
        }}>
        ←
        </div>
      </div>

      <style>{`
        @keyframes bounceArrow {
        0%, 100% { transform: translateY(-50%) translateX(0); }
        50%       { transform: translateY(-50%) translateX(-6px); }
        }
      `}</style>
    </div>
  )
}