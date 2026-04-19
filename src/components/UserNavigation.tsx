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
            bottom: '230px',
            left: '50%',
            transform: 'translateX(60%)',
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '20px 24px',
            width: '320px',
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

        {/* Ship icon + title */}
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
              Mission Briefing
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 500, margin: 0, fontFamily: 'ui-monospace, monospace' }}>
              MV Cargo · San Francisco → LA
            </p>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {[
            { step: '1', text: 'Select a route below — ECO avoids whale zones', color: '#5cb85c' },
            { step: '2', text: 'Adjust speed to see your noise footprint change', color: '#00bfff' },
            { step: '3', text: 'Generate an ESG report for your voyage', color: '#a78bfa' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: `${s.color}22`,
                border: `0.5px solid ${s.color}66`,
                color: s.color,
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontFamily: 'ui-monospace, monospace',
              }}>
                {s.step}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', margin: 0, lineHeight: 1.5, fontFamily: 'ui-monospace, monospace' }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>

        {/* Dismiss hint */}
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', textAlign: 'center', margin: '10px 0 0', fontFamily: 'ui-monospace, monospace' }}>
          click anywhere to dismiss
        </p>

        {/* Bouncing arrow — positioned below card */}
        <div style={{
          position: 'absolute',
          bottom: '-35px',
          left: '50%',
          transform: 'translateX(60%)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '28px',
          animation: 'bounceArrow 1s ease-in-out infinite',
        }}>
          ↓
        </div>
      </div>

      <style>{`
        @keyframes bounceArrow {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </div>
  )
}