import React from 'react';

type WidgetShellProps = {
    children?: React.ReactNode;
};

export function WidgetShell({ children }: WidgetShellProps) {
    return (
        <div className="widget-shell">
            {/* SVG clip-path definitions for arc-shaped wedges with inner circle cutout */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    {/* Top wedge - donut shaped */}
                    <clipPath id="wedge-top" clipPathUnits="objectBoundingBox">
                        <path d="M 0.39,0.39 A 0.15,0.15 0 0,1 0.61,0.39 L 0.85,0.15 A 0.42,0.42 0 0,0 0.15,0.15 Z" />
                    </clipPath>
                    {/* Right wedge - donut shaped */}
                    <clipPath id="wedge-right" clipPathUnits="objectBoundingBox">
                        <path d="M 0.61,0.39 A 0.15,0.15 0 0,1 0.61,0.61 L 0.85,0.85 A 0.42,0.42 0 0,0 0.85,0.15 Z" />
                    </clipPath>
                    {/* Bottom wedge - donut shaped */}
                    <clipPath id="wedge-bottom" clipPathUnits="objectBoundingBox">
                        <path d="M 0.61,0.61 A 0.15,0.15 0 0,1 0.39,0.61 L 0.15,0.85 A 0.42,0.42 0 0,0 0.85,0.85 Z" />
                    </clipPath>
                    {/* Left wedge - donut shaped */}
                    <clipPath id="wedge-left" clipPathUnits="objectBoundingBox">
                        <path d="M 0.39,0.61 A 0.15,0.15 0 0,1 0.39,0.39 L 0.15,0.15 A 0.42,0.42 0 0,0 0.15,0.85 Z" />
                    </clipPath>
                </defs>
            </svg>
            <div className='widget-shell-inner'>
                {children}
                {/* Drag handle in center circle */}
                <div className="drag-handle" />
            </div>
        </div>
    );
};
