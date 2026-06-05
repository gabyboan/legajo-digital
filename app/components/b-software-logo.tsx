"use client";

import { useId, useRef } from "react";

type BSoftwareLogoProps = {
  className?: string;
};

export function BSoftwareLogo({ className = "" }: BSoftwareLogoProps) {
  const gradientId = useId();
  const maskId = useId();
  const gradientRef = useRef<SVGRadialGradientElement>(null);

  function moveSpotlight(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return;
    }

    const svgPoint = point.matrixTransform(matrix.inverse());
    gradientRef.current?.setAttribute("cx", String(svgPoint.x));
    gradientRef.current?.setAttribute("cy", String(svgPoint.y));
  }

  function resetSpotlight(event: React.PointerEvent<SVGSVGElement>) {
    const viewBox = event.currentTarget.viewBox.baseVal;
    gradientRef.current?.setAttribute("cx", String(viewBox.width / 2));
    gradientRef.current?.setAttribute("cy", String(viewBox.height / 2));
  }

  const mark = (
    <>
      <path className="fill-current" d="M150 25 L255 90 L255 210 L150 275 L45 210 L45 90 Z" />
      <path className="fill-transparent" d="M150 68 L214 107 L214 192 L150 232 L86 192 L86 107 Z" />
      <path className="fill-transparent" d="M128 195 L152 144 L118 144 L174 78 L150 130 L184 130 Z" />
    </>
  );

  return (
    <svg
      className={className}
      viewBox="0 0 300 300"
      role="img"
      aria-label="Logo de B Software"
      onPointerMove={moveSpotlight}
      onPointerLeave={resetSpotlight}
    >
      <defs>
        <radialGradient
          ref={gradientRef}
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          cx="150"
          cy="150"
          r="82"
        >
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="50%" stopColor="white" stopOpacity="1" />
          <stop offset="78%" stopColor="white" stopOpacity="0.42" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
          <rect x="0" y="0" width="300" height="300" fill={`url(#${gradientId})`} />
        </mask>
      </defs>

      <g
        color="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.34)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
        vectorEffect="non-scaling-stroke"
      >
        {mark}
      </g>

      <g
        mask={`url(#${maskId})`}
        color="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,1)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
        vectorEffect="non-scaling-stroke"
      >
        {mark}
      </g>
    </svg>
  );
}
