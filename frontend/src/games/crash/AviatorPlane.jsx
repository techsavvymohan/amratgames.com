import React, { useId } from 'react'

/**
 * Authentic Red Aviator Monoplane Component
 * Features high-detail aerodynamic red fuselage, glass cockpit reflection,
 * Amrat gold wingtip lights, and high-speed animated spinning propeller.
 */
export default function AviatorPlane({
    isSpinning = true,
    width = 74,
    height = 38,
    className = '',
    style = {}
}) {
    const rawId = useId()
    const id = rawId.replace(/[^a-zA-Z0-9]/g, '')

    return (
        <div
            className={`aviator-plane-element ${className}`.trim()}
            style={{ width, height, ...style }}
        >
            <svg
                width={width}
                height={height}
                viewBox="0 0 160 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="aviator-plane-svg"
            >
                <defs>
                    <linearGradient id={`${id}-fuselageGrad`} x1="0%" y1="0%" x2="100%" y2="50%">
                        <stop offset="0%" stopColor="#991b1b" />
                        <stop offset="25%" stopColor="#dc2626" />
                        <stop offset="70%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#f87171" />
                    </linearGradient>
                    <linearGradient id={`${id}-mainWingGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#7f1d1d" />
                        <stop offset="40%" stopColor="#dc2626" />
                        <stop offset="100%" stopColor="#f87171" />
                    </linearGradient>
                    <linearGradient id={`${id}-canopyReflect`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                        <stop offset="45%" stopColor="#67e8f9" stopOpacity="0.75" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9" />
                    </linearGradient>
                    <filter id={`${id}-planeGlow`} x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#dc2626" floodOpacity="0.45" />
                    </filter>
                </defs>

                <g filter={`url(#${id}-planeGlow)`}>
                    {/* Rear Tail Wing / Stabilizer */}
                    <path d="M 16 38 L 4 18 L 22 18 L 34 37 Z" fill="#991b1b" />
                    <path d="M 20 40 L 10 50 L 26 50 L 36 43 Z" fill="#7f1d1d" />

                    {/* Lower Wing Strut */}
                    <path d="M 52 42 L 72 58 Q 88 58 84 52 L 68 42 Z" fill="#991b1b" />

                    {/* Aerodynamic Red Fuselage Body */}
                    <path
                        d="M 12 40 Q 35 30 95 30 Q 132 30 144 38 Q 148 40 144 43 Q 126 50 80 49 Q 35 48 12 40 Z"
                        fill={`url(#${id}-fuselageGrad)`}
                        stroke="#7f1d1d"
                        strokeWidth="1.2"
                    />

                    {/* Cockpit Canopy Glass */}
                    <path
                        d="M 72 30 Q 90 20 108 29 Q 110 30 72 30 Z"
                        fill={`url(#${id}-canopyReflect)`}
                        stroke="#ffffff"
                        strokeWidth="0.8"
                    />

                    {/* Upper Main Wing */}
                    <path
                        d="M 60 36 L 86 12 Q 106 12 102 18 L 78 38 Z"
                        fill={`url(#${id}-mainWingGrad)`}
                        stroke="#7f1d1d"
                        strokeWidth="1"
                    />

                    {/* Wing Tip Amrat Gold Light */}
                    <circle cx="98" cy="14" r="2.5" fill="#f5af19" />

                    {/* Engine Cowling Nose */}
                    <ellipse cx="144" cy="40" rx="4.5" ry="8" fill="#334155" />
                    <ellipse cx="145" cy="40" rx="3" ry="5" fill="#94a3b8" />

                    {/* Spinning Propeller */}
                    <g className={isSpinning ? 'aviator-propeller-animated' : ''}>
                        <ellipse cx="147" cy="40" rx="2.5" ry="22" fill="rgba(255, 255, 255, 0.4)" />
                        <line x1="147" y1="20" x2="147" y2="60" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
                        <circle cx="147" cy="40" r="3.5" fill="#f5af19" />
                    </g>
                </g>
            </svg>
        </div>
    )
}
