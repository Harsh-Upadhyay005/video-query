import React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export type FluidGradientTextProps = {
  /** Text content rendered inside the SVG. */
  text: string;
  /**
   * SVG viewBox width used to scale the gradient and text layout.
   * @default 1200
   * */
  svgViewBoxWidth?: number;
  /**
   * SVG viewBox height used as the base text size.
   * @default 300
   * */
  svgViewBoxHeight?: number;
  className?: string;
};

export function FluidGradientText({
  text,
  svgViewBoxWidth = 1200,
  svgViewBoxHeight = 300,
  className = ""
}: FluidGradientTextProps) {
  const gradientX1Raw = useMotionValue(0.5);
  const gradientX1 = useSpring(
    useTransform(gradientX1Raw, [0, 1], [0, svgViewBoxWidth]),
    {
      stiffness: 150,
      damping: 25,
    }
  );

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const containerRect = event.currentTarget.getBoundingClientRect();
    gradientX1Raw.set(
      (event.clientX - containerRect.left) / containerRect.width
    );
  };

  const handleMouseLeave = () => {
    gradientX1Raw.set(0.5);
  };

  return (
    <div
      className={`relative w-full overflow-hidden select-none after:absolute after:bottom-0 after:h-px after:w-full after:bg-current/15 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        className="w-full h-auto max-h-[220px] sm:max-h-[300px] translate-y-[20%] sm:translate-y-[25%] select-none overflow-visible"
        viewBox={`0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2.5"
          fill="url(#fluid_gradient_text_linear)"
          style={{
            fontFamily: "Outfit, Inter, system-ui, sans-serif",
            fontSize: Math.min(svgViewBoxHeight * 0.72, (svgViewBoxWidth / (text.length * 0.65))),
            fontWeight: "900",
            letterSpacing: "-0.03em"
          }}
        >
          {text}
        </text>
        <defs>
          <motion.linearGradient
            id="fluid_gradient_text_linear"
            x1={gradientX1}
            y1="0"
            x2={svgViewBoxWidth / 2}
            y2={svgViewBoxHeight}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.3" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="0.65" stopColor="#D9CCF5" stopOpacity="0.5" />
            <stop offset="1" stopColor="currentColor" stopOpacity="1" />
          </motion.linearGradient>
        </defs>
      </svg>
    </div>
  );
}
