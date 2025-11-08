import React from 'react';

type WidgetShellProps = {
    children?: React.ReactNode;
};

export function WidgetShell({ children }: WidgetShellProps) {
    return (
        <div className="widget-shell">
            {/* SVG clip-path definitions for arc-shaped wedges */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    {/* Top wedge */}
                    <clipPath id="wedge-top" clipPathUnits="objectBoundingBox">
                        <path d="M 0.5,0.5 L 0.15,0.15 A 0.42,0.42 0 0,1 0.85,0.15 Z" />
                    </clipPath>
                    {/* Right wedge */}
                    <clipPath id="wedge-right" clipPathUnits="objectBoundingBox">
                        <path d="M 0.5,0.5 L 0.85,0.15 A 0.42,0.42 0 0,1 0.85,0.85 Z" />
                    </clipPath>
                    {/* Bottom wedge */}
                    <clipPath id="wedge-bottom" clipPathUnits="objectBoundingBox">
                        <path d="M 0.5,0.5 L 0.85,0.85 A 0.42,0.42 0 0,1 0.15,0.85 Z" />
                    </clipPath>
                    {/* Left wedge */}
                    <clipPath id="wedge-left" clipPathUnits="objectBoundingBox">
                        <path d="M 0.5,0.5 L 0.15,0.85 A 0.42,0.42 0 0,1 0.15,0.15 Z" />
                    </clipPath>
                </defs>
            </svg>
            <div className='widget-shell-inner'>{children}</div>
        </div>
    );
};
