"use client";

import { FC, useEffect, useRef, useState } from "react";

interface Curve3DProps {
  ethReserve: number;
  tokenReserve: number;
  addingEth: number;
  addingToken: number;
  width: number;
  height: number;
}

export const Curve3D: FC<Curve3DProps> = ({
  ethReserve,
  tokenReserve,
  addingEth,
  addingToken,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interactive orbit rotation (pitch and yaw)
  const [rotation, setRotation] = useState({ x: 0.5, y: -0.6 });
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const hasReserves = ethReserve > 0 && tokenReserve > 0;
    if (!hasReserves) {
      ctx.fillStyle = "#a5b4fc";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add liquidity to load 3D AMM model", width / 2, height / 2);
      return;
    }

    const k = ethReserve * tokenReserve;

    // Projection constants
    const distance = 400;
    const fov = 350;
    const center = { x: width / 2, y: height / 2 + 20 };

    // 3D Point projection helper
    const project = (x3d: number, y3d: number, z3d: number) => {
      // Apply yaw (around Y axis)
      const cosY = Math.cos(rotation.y);
      const sinY = Math.sin(rotation.y);
      const x1 = x3d * cosY - z3d * sinY;
      const z1 = x3d * sinY + z3d * cosY;

      // Apply pitch (around X axis)
      const cosX = Math.cos(rotation.x);
      const sinX = Math.sin(rotation.x);
      const y2 = y3d * cosX - z1 * sinX;
      const z2 = y3d * sinX + z1 * cosX;

      // perspective scale
      const s = fov / (distance + z2);
      return {
        x: center.x + x1 * s,
        y: center.y - y2 * s,
        z: z2,
        scale: s,
      };
    };

    // Draw frame loop
    ctx.clearRect(0, 0, width, height);

    // Grid sizes (3D box boundary)
    const boxSize = 120;
    
    // Draw 3D coordinate box boundaries/axes
    ctx.strokeStyle = "rgba(139, 92, 246, 0.15)";
    ctx.lineWidth = 1;

    // Helper to draw a 3D line
    const drawLine3D = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      const p1 = project(x1, y1, z1);
      const p2 = project(x2, y2, z2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    };

    // Draw coordinate base grid (floor at y = -boxSize/2)
    const floorY = -60;
    for (let i = -3; i <= 3; i++) {
      const offset = (i * boxSize) / 6;
      // Grid lines parallel to Z axis
      drawLine3D(offset, floorY, -boxSize/2, offset, floorY, boxSize/2);
      // Grid lines parallel to X axis
      drawLine3D(-boxSize/2, floorY, offset, boxSize/2, floorY, offset);
    }

    // Draw main axes
    ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
    ctx.lineWidth = 2;
    // X Axis (ETH Reserves)
    drawLine3D(-boxSize/2, floorY, -boxSize/2, boxSize/2 + 20, floorY, -boxSize/2);
    // Y Axis (Token Reserves)
    drawLine3D(-boxSize/2, floorY, -boxSize/2, -boxSize/2, floorY + boxSize, -boxSize/2);
    // Z Axis (Constant product invariant)
    drawLine3D(-boxSize/2, floorY, -boxSize/2, -boxSize/2, floorY, boxSize/2 + 20);

    // Add labels on the axes in 3D
    ctx.fillStyle = "rgba(167, 139, 250, 0.8)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";

    const labelX = project(boxSize/2 + 25, floorY, -boxSize/2);
    ctx.fillText("ETH (x)", labelX.x, labelX.y);

    const labelY = project(-boxSize/2 - 15, floorY + boxSize, -boxSize/2);
    ctx.fillText("BAL (y)", labelY.x, labelY.y);

    const labelZ = project(-boxSize/2, floorY, boxSize/2 + 25);
    ctx.fillText("Pool size", labelZ.x, labelZ.y);

    // Draw the 3D surface mesh representing the Constant Product x * y = k
    // Let's generate points along the curve
    const pointsCount = 40;
    const curvePoints: Array<{x: number, y: number, z: number}> = [];

    // Map actual pool reserves into 3D box coordinates
    // Center around the current pool size
    const maxVal = Math.max(ethReserve, tokenReserve) * 2;
    const to3DCoords = (eth: number, token: number) => {
      const x = ((eth / maxVal) - 0.5) * boxSize;
      const y = ((token / maxVal) - 0.5) * boxSize;
      // Invariant z axis
      const z = (( (eth * token) / (maxVal * maxVal) ) - 0.5) * boxSize;
      return { x, y, z };
    };

    // Draw constant product curve line
    ctx.beginPath();
    ctx.lineWidth = 3.5;
    
    // Create color gradient along the curve
    const pStart = project(-boxSize/2 + 10, floorY + boxSize - 10, 0);
    const pEnd = project(boxSize/2 - 10, floorY + 10, 0);
    const grad = ctx.createLinearGradient(pStart.x, pStart.y, pEnd.x, pEnd.y);
    grad.addColorStop(0, "#c084fc"); // purple-400
    grad.addColorStop(0.5, "#818cf8"); // indigo-400
    grad.addColorStop(1, "#38bdf8"); // sky-400
    ctx.strokeStyle = grad;

    for (let i = 0; i <= pointsCount; i++) {
      const t = 0.1 + (i / pointsCount) * 1.8; // range from 0.1 to 1.9 of pool ratio
      const eth = ethReserve * t;
      const token = k / eth;
      
      const pt3D = to3DCoords(eth, token);
      const projPt = project(pt3D.x, pt3D.y, 0); // Flat on the pool plane

      if (i === 0) {
        ctx.moveTo(projPt.x, projPt.y);
      } else {
        ctx.lineTo(projPt.x, projPt.y);
      }
      curvePoints.push({ x: pt3D.x, y: pt3D.y, z: 0 });
    }
    ctx.stroke();

    // Draw vertical projection lines from the curve to base grid to give 3D depth feeling
    ctx.strokeStyle = "rgba(139, 92, 246, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < curvePoints.length; i += 4) {
      const pt = curvePoints[i];
      if (pt) {
        drawLine3D(pt.x, floorY, pt.y, pt.x, pt.x * pt.y / boxSize, pt.y); // Projection mesh
      }
    }

    // Draw active trading coordinate point
    const current3D = to3DCoords(ethReserve, tokenReserve);
    const currentProj = project(current3D.x, current3D.y, 0);

    // Glowing point indicator
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#a78bfa";
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.arc(currentProj.x, currentProj.y, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Inner highlight point
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(currentProj.x, currentProj.y, 3, 0, 2 * Math.PI);
    ctx.fill();

    // If adding ETH, draw the path along the curve
    if (addingEth > 0) {
      const targetEth = ethReserve + addingEth;
      const targetToken = k / targetEth;
      const target3D = to3DCoords(targetEth, targetToken);
      const targetProj = project(target3D.x, target3D.y, 0);

      // Draw dashed trajectory line
      ctx.strokeStyle = "#f43f5e"; // rose-500
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(currentProj.x, currentProj.y);
      ctx.lineTo(targetProj.x, targetProj.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw target indicator
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(targetProj.x, targetProj.y, 6, 0, 2 * Math.PI);
      ctx.fill();
    }

    // If adding BAL, draw the path along the curve
    if (addingToken > 0) {
      const targetToken = tokenReserve + addingToken;
      const targetEth = k / targetToken;
      const target3D = to3DCoords(targetEth, targetToken);
      const targetProj = project(target3D.x, target3D.y, 0);

      // Draw dashed trajectory line
      ctx.strokeStyle = "#0ea5e9"; // sky-500
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(currentProj.x, currentProj.y);
      ctx.lineTo(targetProj.x, targetProj.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw target indicator
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.arc(targetProj.x, targetProj.y, 6, 0, 2 * Math.PI);
      ctx.fill();
    }

  }, [rotation, ethReserve, tokenReserve, addingEth, addingToken, width, height]);

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    setRotation(prev => ({
      x: Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, prev.x - deltaY * 0.007)),
      y: prev.y - deltaX * 0.007,
    }));

    previousMousePosition.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-md border border-violet-500/20 shadow-2xl p-5 overflow-hidden group w-full">
      {/* Glow Effects */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-700" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />

      <div className="flex items-center justify-between mb-4 border-b border-violet-500/10 pb-3 relative z-10">
        <div>
          <span className="font-semibold text-lg bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            3D Interactive AMM Graph
          </span>
          <p className="text-xs text-slate-400 mt-0.5">Click & Drag to rotate and explore</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
          x · y = k
        </span>
      </div>

      <div 
        style={{ width, height }} 
        className="rounded-xl overflow-hidden cursor-grab active:cursor-grabbing bg-slate-950/50 border border-violet-500/10 relative z-10 flex items-center justify-center mx-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
      </div>

      <div className="flex justify-between items-center mt-4 text-xs text-slate-400 relative z-10 border-t border-violet-500/10 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-md shadow-violet-400/50" />
          <span>Active Reserves</span>
        </div>
        <span className="font-mono text-slate-500">
          k: {ethReserve && tokenReserve ? (ethReserve * tokenReserve).toFixed(4) : "0"}
        </span>
      </div>
    </div>
  );
};
