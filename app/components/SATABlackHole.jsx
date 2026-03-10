import { useEffect, useRef, useState, useCallback } from "react";

const CAPITAL_LABELS = ['$', '€', '¥', '£', 'USD', 'ETF', 'BND', 'TRS', 'CAP', 'FI', 'T-BILL', 'CORP', 'MBS', 'GOV'];
const BASE_W = 1200, BASE_H = 675;
const SATA_PAR = 100;
const SATA_IPO_PRICE = 80;

function lerp(a, b, t) { return a + (b - a) * t; }

function generateLightning(ctx, x1, y1, x2, y2, roughness, generations) {
  if (generations === 0) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); return; }
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * roughness;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * roughness;
  generateLightning(ctx, x1, y1, mx, my, roughness / 2, generations - 1);
  generateLightning(ctx, mx, my, x2, y2, roughness / 2, generations - 1);
}

class Particle {
  constructor(W, H, CX, CY, delay = 0, zoomScale = 1) {
    this.W = W; this.H = H; this.CX = CX; this.CY = CY;
    this.reset(true, delay, zoomScale);
  }
  reset(initial = false, delay = 0, zoomScale = 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = (280 + Math.random() * 320) * zoomScale;
    this.x = this.CX + Math.cos(angle) * dist;
    this.y = this.CY + Math.sin(angle) * dist;
    this.angle = angle;
    this.dist = dist;
    this.speed = 0.0004 + Math.random() * 0.0008;
    this.inwardSpeed = (0.4 + Math.random() * 0.6) * zoomScale;
    this.size = 1 + Math.random() * 2.5;
    this.opacity = 0.3 + Math.random() * 0.6;
    this.label = Math.random() > 0.72 ? CAPITAL_LABELS[Math.floor(Math.random() * CAPITAL_LABELS.length)] : null;
    this.color = Math.random() > 0.85 ? '#FF6B00' : Math.random() > 0.7 ? '#ffffff' : `hsl(${200 + Math.random() * 60}, 60%, 70%)`;
    this.delay = initial ? Math.random() * 200 : delay;
    this.age = 0;
    this.trail = [];
    this.zoomScale = zoomScale;
  }
  update(blackHoleRadius) {
    if (this.age < this.delay) { this.age++; return; }
    this.trail.push({ x: this.x, y: this.y, opacity: this.opacity });
    if (this.trail.length > 14) this.trail.shift();
    this.angle += this.speed * (1 + (400 * this.zoomScale - this.dist) / (200 * this.zoomScale));
    this.dist -= this.inwardSpeed * (1 + (400 * this.zoomScale - this.dist) / (150 * this.zoomScale));
    this.x = this.CX + Math.cos(this.angle) * this.dist;
    this.y = this.CY + Math.sin(this.angle) * this.dist;
    if (this.dist < blackHoleRadius * 2.5) { this.inwardSpeed *= 1.06; this.opacity *= 0.97; }
    if (this.dist < blackHoleRadius * 0.5 || this.opacity < 0.02) this.reset(false, 0, this.zoomScale);
  }
  draw(ctx) {
    if (this.age < this.delay) return;
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const a = (i / this.trail.length) * this.opacity * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.size * 0.5, 0, Math.PI * 2);
      if (this.color === '#FF6B00') ctx.fillStyle = `rgba(255,107,0,${a})`;
      else if (this.color === '#ffffff') ctx.fillStyle = `rgba(255,255,255,${a})`;
      else ctx.fillStyle = this.color.replace('hsl', 'hsla').replace(')', `,${a})`);
      ctx.fill();
    }
    ctx.globalAlpha = this.opacity;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    if (this.label && this.dist > 120 * this.zoomScale) {
      ctx.globalAlpha = this.opacity * 0.65;
      ctx.font = `${7 + this.size}px monospace`;
      ctx.fillStyle = this.color;
      ctx.fillText(this.label, this.x + 4, this.y - 4);
    }
    ctx.globalAlpha = 1;
  }
}

export default function SATABlackHole() {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const starsRef = useRef(null);
  const fixedIncomeDotsRef = useRef(null);
  const lightningRef = useRef([]);
  const lightningTimerRef = useRef(0);

  const [sataPrice, setSataPrice] = useState(94.78); // Fallback price
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [zoom, setZoom] = useState(1);
  const [atPar, setAtPar] = useState(false);
  const zoomRef = useRef(1);
  const atParRef = useRef(false);

  // Calculate par progress based on price
  const parProgress = (sataPrice - SATA_IPO_PRICE) / (SATA_PAR - SATA_IPO_PRICE);

  const W = BASE_W, H = BASE_H;
  const CX = W * 0.58, CY = H * 0.5;

  // Fetch live price from Yahoo Finance
  useEffect(() => {
    async function fetchPrice() {
      try {
        // Option 1: Use a CORS proxy if you don't have a backend
        // This uses a public API that fetches Yahoo data
        const response = await fetch(
          `https://api.allorigins.win/get?url=${encodeURIComponent('https://query1.finance.yahoo.com/v10/finance/quoteSummary/SATA?modules=price')}`
        );
        
        if (!response.ok) throw new Error('Price fetch failed');
        
        const data = await response.json();
        const parsed = JSON.parse(data.contents);
        const price = parsed?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw;
        
        if (price && price > 0) {
          setSataPrice(price);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.warn('Could not fetch live price, using fallback:', error);
        // Silently fail and use fallback
      }
    }

    // Fetch on mount
    fetchPrice();

    // Optional: Refresh every 5 minutes (300000ms) instead of 60s to avoid rate limits
    const interval = setInterval(fetchPrice, 300000);
    
    return () => clearInterval(interval);
  }, []);

  const handleZoomChange = useCallback((val) => {
    setZoom(val);
    zoomRef.current = val;
  }, []);

  const handleAtPar = useCallback(() => {
    setAtPar(prev => {
      atParRef.current = !prev;
      return !prev;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    fixedIncomeDotsRef.current = Array.from({ length: 2400 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 600 + Math.random() * 4400;
      return {
        x: CX + Math.cos(angle) * dist,
        y: CY + Math.sin(angle) * dist,
        r: 0.5 + Math.random() * 2.5,
        baseOpacity: 0.08 + Math.random() * 0.25,
        color: Math.random() > 0.8 ? `hsl(${30 + Math.random()*30},80%,60%)` : Math.random() > 0.6 ? `hsl(${200 + Math.random()*40},60%,65%)` : '#ffffff',
        label: Math.random() > 0.88 ? ['$300T','BOND','GOV','CORP','MBS','FI'][Math.floor(Math.random()*6)] : null,
        dist, angle,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
      };
    });

    starsRef.current = Array.from({ length: 220 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.2, a: 0.1 + Math.random() * 0.35,
      twinkle: Math.random() * Math.PI * 2,
    }));

    particlesRef.current = Array.from({ length: 340 }, (_, i) => new Particle(W, H, CX, CY, i, 1));

    function drawFixedIncomeDots() {
      const z = zoomRef.current;
      fixedIncomeDotsRef.current.forEach(dot => {
        dot.twinkle += dot.twinkleSpeed;
        const twinkleAlpha = dot.baseOpacity * (0.7 + 0.3 * Math.sin(dot.twinkle));
        const scaledX = CX + (dot.x - CX) / z;
        const scaledY = CY + (dot.y - CY) / z;
        if (scaledX < -50 || scaledX > W + 50 || scaledY < -50 || scaledY > H + 50) return;
        const scaledR = Math.max(0.3, dot.r / Math.sqrt(z));
        ctx.globalAlpha = twinkleAlpha * Math.min(1, (z - 1) * 0.4 + 0.05);
        ctx.beginPath();
        ctx.arc(scaledX, scaledY, scaledR, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.fill();
        if (dot.label && z > 3 && scaledR > 1) {
          ctx.globalAlpha = twinkleAlpha * 0.5 * Math.min(1, (z - 3) * 0.3);
          ctx.font = `${8 / Math.sqrt(z)}px monospace`;
          ctx.fillStyle = dot.color;
          ctx.fillText(dot.label, scaledX + 3, scaledY - 3);
        }
        ctx.globalAlpha = 1;
      });
    }

    function drawStars() {
      starsRef.current.forEach(s => {
        s.twinkle += 0.015;
        const a = s.a * (0.8 + 0.2 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      });
    }

    function drawGravityLensing(t, bhR) {
      const s = 1 / zoomRef.current;
      for (let i = 0; i < 4; i++) {
        const r = (bhR * 3.2 + i * 28 + Math.sin(t * 0.5 + i) * 3) * s;
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,200,100,${0.05 - i * 0.01})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    function drawAccretionDisk(t, bhR, pp) {
      const s = 1 / zoomRef.current;
      const rings = [
        { r: bhR*3.3, width: 18, speed: 0.3,  color: [255, lerp(107,140,pp), 0], opacity: lerp(0.12,0.28,pp) },
        { r: bhR*2.5, width: 10, speed: -0.5, color: [255, lerp(149,180,pp), 0], opacity: lerp(0.18,0.35,pp) },
        { r: bhR*1.8, width: 6,  speed: 0.8,  color: [255, lerp(184,200,pp), 0], opacity: lerp(0.22,0.42,pp) },
        { r: bhR*1.3, width: 4,  speed: -1.2, color: [255, lerp(107,130,pp), 0], opacity: lerp(0.30,0.55,pp) },
      ];
      rings.forEach(ring => {
        ctx.save();
        ctx.translate(CX, CY); ctx.rotate(t * ring.speed); ctx.translate(-CX, -CY);
        const [r,g,b] = ring.color;
        const gr = ctx.createRadialGradient(CX, CY, (ring.r - ring.width)*s, CX, CY, (ring.r + ring.width)*s);
        gr.addColorStop(0, 'transparent');
        gr.addColorStop(0.3, `rgba(${r},${g},${b},${ring.opacity})`);
        gr.addColorStop(0.5, `rgba(${r},${g},${b},${ring.opacity * 1.8})`);
        gr.addColorStop(0.7, `rgba(${r},${g},${b},${ring.opacity})`);
        gr.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(CX, CY, ring.r * s, 0, Math.PI * 2);
        ctx.strokeStyle = gr;
        ctx.lineWidth = ring.width * 2 * s;
        ctx.stroke();
        ctx.restore();
      });
    }

    function drawLightning(bhR, pp) {
      if (pp < 0.5) return;
      const s = 1 / zoomRef.current;
      const intensity = (pp - 0.5) * 2;
      lightningTimerRef.current++;
      if (lightningTimerRef.current % 4 === 0) {
        const count = Math.floor(1 + intensity * 3);
        for (let i = 0; i < count; i++) {
          const startAngle = Math.random() * Math.PI * 2;
          const startR = bhR * (1.4 + Math.random() * 2) * s;
          lightningRef.current.push({
            x1: CX + Math.cos(startAngle) * startR,
            y1: CY + Math.sin(startAngle) * startR,
            x2: CX + Math.cos(startAngle + (Math.random()-0.5)*0.8) * bhR * 0.9 * s,
            y2: CY + Math.sin(startAngle + (Math.random()-0.5)*0.8) * bhR * 0.9 * s,
            life: 3 + Math.floor(Math.random() * 4), maxLife: 6,
            roughness: 20 + Math.random() * 30,
            color: Math.random() > 0.5 ? [255,200,50] : [255,130,0],
          });
        }
      }
      lightningRef.current = lightningRef.current.filter(l => l.life > 0);
      lightningRef.current.forEach(l => {
        const a = (l.life / l.maxLife) * intensity * 0.85;
        const [r,g,b] = l.color;
        ctx.save();
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        ctx.lineWidth = 1 + (l.life / l.maxLife) * 1.5;
        ctx.shadowColor = `rgba(255,180,50,${a * 0.8})`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        generateLightning(ctx, l.x1, l.y1, l.x2, l.y2, l.roughness, 4);
        ctx.stroke();
        ctx.restore();
        l.life--;
      });
    }

    function drawBlackHole(t, bhR, pp) {
      const s = 1 / zoomRef.current;
      const bhScaled = bhR * s;
      const glowRadius = bhScaled * (6 + pp * 4);
      const outerGlow = ctx.createRadialGradient(CX, CY, bhScaled * 0.5, CX, CY, glowRadius);
      outerGlow.addColorStop(0,    'rgba(0,0,0,1)');
      outerGlow.addColorStop(0.15, 'rgba(0,0,0,0.98)');
      outerGlow.addColorStop(0.3,  `rgba(255,107,0,${0.06 + pp * 0.18})`);
      outerGlow.addColorStop(0.55, `rgba(255,107,0,${0.02 + pp * 0.08})`);
      outerGlow.addColorStop(0.75, `rgba(255,80,0,${pp * 0.04})`);
      outerGlow.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      const eh = ctx.createRadialGradient(CX, CY, 0, CX, CY, bhScaled);
      eh.addColorStop(0,    '#000');
      eh.addColorStop(0.65, '#000');
      eh.addColorStop(0.82, `rgba(255,${lerp(107,180,pp)},0,${lerp(0.3,0.9,pp)})`);
      eh.addColorStop(1,    `rgba(255,${lerp(107,160,pp)},0,0)`);
      ctx.beginPath();
      ctx.arc(CX, CY, bhScaled, 0, Math.PI * 2);
      ctx.fillStyle = eh;
      ctx.fill();

      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
      ctx.beginPath();
      ctx.arc(CX, CY, bhScaled + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,${lerp(180,220,pp)},50,${lerp(0.15,0.55,pp) + pulse * 0.1})`;
      ctx.lineWidth = lerp(1.5, 3.5, pp);
      ctx.shadowColor = `rgba(255,140,0,${pp * 0.8})`;
      ctx.shadowBlur = pp * 20;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (pp > 0.7) {
        const coronaAlpha = (pp - 0.7) / 0.3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(CX, CY, bhScaled * (1.15 + i * 0.25) + pulse * (2 + i), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,${120+i*20},0,${coronaAlpha * (0.4 - i*0.1)})`;
          ctx.lineWidth = 2 - i * 0.4;
          ctx.stroke();
        }
      }
    }

    function drawZoomIndicator() {
      const z = zoomRef.current;
      if (z <= 1) return;
      const trillion = ((z - 1) / 19) * 300;
      const label = trillion < 1 ? `${(trillion*1000).toFixed(0)}B` : `$${trillion.toFixed(0)}T`;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255,200,100,0.8)';
      ctx.fillText(`Fixed Income Universe: ~${label} / $300T visible`, W - 320, H - 18);
      ctx.restore();
    }

    function animate() {
      const t = frameRef.current * 0.016;
      frameRef.current++;
      const pp = atParRef.current ? 1 : parProgress;
      const bhR = lerp(28, 58, pp);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      drawStars();
      drawFixedIncomeDots();
      drawGravityLensing(t, bhR);
      drawAccretionDisk(t, bhR, pp);
      particlesRef.current.forEach(p => { p.update(bhR); p.draw(ctx); });
      drawBlackHole(t, bhR, pp);
      drawLightning(bhR, pp);
      drawZoomIndicator();

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Format timestamp as relative time (e.g., "2m ago")
  const formatLastUpdate = () => {
    const now = new Date();
    const diffMs = now - lastUpdate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const stats = atPar
    ? [
        { label: 'Annual Yield',    value: '12.50%', color: '#FF6B00' },
        { label: 'Effective Yield', value: '12.50%', color: '#FF6B00' },
        { label: 'Price at Par',    value: '$100.00', color: '#FF6B00' },
        { label: 'Liq. Preference', value: '$100.00', color: '#FF6B00' },
      ]
    : [
        { label: 'Annual Yield',    value: '12.50%', color: '#FF6B00' },
        { label: 'Effective Yield', value: ((12.50 / (sataPrice / 100)).toFixed(2)) + '%', color: '#00FF88' },
        { label: 'Current Price',   value: `$${sataPrice.toFixed(2)}`,  color: '#fff', sublabel: formatLastUpdate() },
        { label: 'Liq. Preference', value: '$100.00', color: '#fff'   },
      ];

  return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'monospace' }}>

      <div style={{ width: '100%', maxWidth: BASE_W, aspectRatio: '16/9', position: 'relative', background: '#000', overflow: 'hidden', border: atPar ? '1px solid rgba(255,107,0,0.5)' : '1px solid rgba(255,255,255,0.05)', boxShadow: atPar ? '0 0 40px rgba(255,107,0,0.3)' : 'none', transition: 'box-shadow 0.8s, border 0.8s' }}>

        <canvas ref={canvasRef} width={BASE_W} height={BASE_H} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>

          {/* Top Left */}
          <div style={{ position: 'absolute', top: '6%', left: '5%' }}>
            <div style={{ fontSize: 'clamp(7px,0.9vw,10px)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 3 }}>
              Strive Asset Management
            </div>
            <div style={{ fontSize: 'clamp(32px,5.5vw,70px)', color: atPar ? '#FF6B00' : '#fff', letterSpacing: '0.06em', lineHeight: 1, fontWeight: 700, transition: 'color 0.8s', textShadow: atPar ? '0 0 30px rgba(255,107,0,0.8)' : 'none' }}>
              $SATA
            </div>
            <div style={{ fontSize: 'clamp(6px,0.85vw,9px)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 5 }}>
              Variable Rate · Series A · Perpetual Preferred
            </div>
          </div>

          {/* Top Right */}
          <div style={{ position: 'absolute', top: '6%', right: '5%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ border: `1px solid ${atPar ? 'rgba(255,107,0,0.8)' : 'rgba(255,107,0,0.4)'}`, background: `rgba(255,107,0,${atPar ? 0.2 : 0.08})`, padding: '7px 16px', borderRadius: 2, transition: 'all 0.8s' }}>
              <div style={{ fontSize: 'clamp(10px,1.2vw,15px)', color: '#FF6B00', letterSpacing: '0.15em', fontWeight: 700 }}>
                {atPar ? '✦ AT PAR ✦' : 'NASDAQ: SATA'}
              </div>
            </div>
            {atPar && (
              <div style={{ fontSize: 'clamp(7px,0.8vw,10px)', color: 'rgba(255,107,0,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'right' }}>
                Par reached · Full yield unlocked
              </div>
            )}
          </div>

          {/* Zoom universe label */}
          <div style={{ position: 'absolute', top: '50%', left: '2%', transform: 'translateY(-50%)', opacity: zoom > 2 ? Math.min(1, (zoom-2)*0.3) : 0, transition: 'opacity 0.5s' }}>
            <div style={{ fontSize: 'clamp(7px,0.8vw,10px)', color: 'rgba(255,200,100,0.6)', letterSpacing: '0.25em', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>
              $300T Fixed Income Universe
            </div>
          </div>

          {/* Bottom Left — Stats */}
          <div style={{ position: 'absolute', bottom: '7%', left: '5%', display: 'flex', gap: 'clamp(12px,2.5vw,44px)', alignItems: 'flex-end' }}>
            {stats.map(({ label, value, color, sublabel }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 'clamp(6px,0.75vw,8px)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                  {label}
                </div>
                <div style={{ fontSize: 'clamp(14px,2vw,28px)', color, letterSpacing: '0.05em', lineHeight: 1, fontWeight: 700, textShadow: atPar ? `0 0 12px ${color}66` : 'none', transition: 'all 0.8s' }}>
                  {value}
                </div>
                <div style={{ fontSize: 'clamp(7px,0.7vw,9px)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginTop: 2, minHeight: '1.2em' }}>
                  {sublabel || ''}
                </div>
              </div>
            ))}
          </div>

          {/* At par bottom right label only */}
          {atPar && (
            <div style={{ position: 'absolute', bottom: '7%', right: '5%', textAlign: 'right' }}>
              <div style={{ fontSize: 'clamp(11px,1.5vw,18px)', color: '#FF6B00', letterSpacing: '0.1em', lineHeight: 1.3, fontWeight: 700, textShadow: '0 0 20px rgba(255,107,0,0.6)' }}>
                Par achieved.<br />All yield. Forever.
              </div>
            </div>
          )}

          {/* Bottom accent */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #FF6B00, transparent 60%)', opacity: atPar ? 1 : 0.6, transition: 'opacity 0.8s' }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ width: '100%', maxWidth: BASE_W, marginTop: 16, display: 'flex', alignItems: 'center', gap: 24, padding: '12px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
              Zoom — Fixed Income Universe
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,200,100,0.7)', letterSpacing: '0.15em' }}>
              {zoom === 1 ? 'SATA view' : `~$${(((zoom-1)/19)*300).toFixed(0)}T visible`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em' }}>SATA</span>
            <input type="range" min={1} max={20} step={0.1} value={zoom}
              onChange={e => handleZoomChange(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#FF6B00', cursor: 'pointer' }} />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em' }}>$300T</span>
          </div>
        </div>

        <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />

        <button onClick={handleAtPar} style={{
          padding: '10px 24px',
          background: atPar ? 'rgba(255,107,0,0.25)' : 'rgba(255,107,0,0.08)',
          border: `1px solid ${atPar ? 'rgba(255,107,0,0.9)' : 'rgba(255,107,0,0.4)'}`,
          color: atPar ? '#FF6B00' : 'rgba(255,107,0,0.8)',
          fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
          cursor: 'pointer', borderRadius: 2, fontFamily: 'monospace', fontWeight: 700,
          transition: 'all 0.3s',
          boxShadow: atPar ? '0 0 20px rgba(255,107,0,0.4)' : 'none',
          whiteSpace: 'nowrap',
        }}>
          {atPar ? '✦ At Par — Active' : 'Preview: SATA at Par'}
        </button>
      </div>
    </div>
  );
}