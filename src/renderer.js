import { STOP_GAP, ROAD_NAMES } from './constants.js';
import { rw, ibox, cx, cy } from './geometry.js';

const NEON = { g:'#00ff88', b:'#00d4ff', p:'#ff006e', y:'#ffea00', o:'#ff6b00' };
const COL  = {
  grass:'#0b1520', road:'#1c2c3e', center:'#1a2a3a',
  lane:'rgba(255,255,255,0.16)', stopLine:'rgba(255,255,255,0.60)',
  kerb:'rgba(0,212,255,0.18)', zebra:'rgba(255,255,255,0.06)',
  label:'rgba(0,212,255,0.80)',
};

// Rounded-rect path helper
function rrp(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ── Scene (roads, markings, poles) ──────────────────────────────────────────
export function drawScene(ctx, CW, CH, getSig, dens) {
  const X=cx(CW), Y=cy(CH), R=rw(CW,CH), IB=ibox(CW,CH);

  ctx.fillStyle=COL.grass; ctx.fillRect(0,0,CW,CH);

  // Grid
  ctx.strokeStyle='rgba(0,212,255,0.03)'; ctx.lineWidth=1;
  const gs=Math.round(CW/16);
  for(let gx=0;gx<CW;gx+=gs){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,CH);ctx.stroke();}
  for(let gy=0;gy<CH;gy+=gs){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(CW,gy);ctx.stroke();}

  // Road arms
  ctx.fillStyle=COL.road;
  ctx.fillRect(X-R/2,0,R,Y-IB); ctx.fillRect(X-R/2,Y+IB,R,CH-Y-IB);
  ctx.fillRect(0,Y-R/2,X-IB,R); ctx.fillRect(X+IB,Y-R/2,CW-X-IB,R);
  ctx.fillStyle=COL.center; ctx.fillRect(X-IB,Y-IB,IB*2,IB*2);

  // Kerbs
  ctx.strokeStyle=COL.kerb; ctx.lineWidth=2;
  [[X-R/2,0,X-R/2,Y-IB],[X+R/2,0,X+R/2,Y-IB],[X-R/2,Y+IB,X-R/2,CH],[X+R/2,Y+IB,X+R/2,CH],
   [0,Y-R/2,X-IB,Y-R/2],[0,Y+R/2,X-IB,Y+R/2],[X+IB,Y-R/2,CW,Y-R/2],[X+IB,Y+R/2,CW,Y+R/2]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});

  // Lane dashes
  ctx.strokeStyle=COL.lane; ctx.lineWidth=2; ctx.setLineDash([R*.18,R*.14]);
  [[X,0,X,Y-IB],[X,Y+IB,X,CH],[0,Y,X-IB,Y],[X+IB,Y,CW,Y]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  ctx.setLineDash([]);

  // Zebra crossings
  const ZT=Math.round(R*.13);
  const zeb=(bx,by,bw,bh,hz)=>{
    const n=6,sw=hz?bw/n:bh/n;
    for(let i=0;i<n;i+=2){ctx.fillStyle=COL.zebra;hz?ctx.fillRect(bx+i*sw,by,sw,bh):ctx.fillRect(bx,by+i*sw,bw,sw);}
  };
  zeb(X-R/2,Y-IB-ZT,R,ZT,true); zeb(X-R/2,Y+IB,R,ZT,true);
  zeb(X-IB-ZT,Y-R/2,ZT,R,false); zeb(X+IB,Y-R/2,ZT,R,false);

  // Stop lines
  ctx.strokeStyle=COL.stopLine; ctx.lineWidth=3;
  [[X-R/2,Y-IB-STOP_GAP,X,Y-IB-STOP_GAP],[X,Y+IB+STOP_GAP,X+R/2,Y+IB+STOP_GAP],
   [X-IB-STOP_GAP,Y,X-IB-STOP_GAP,Y+R/2],[X+IB+STOP_GAP,Y-R/2,X+IB+STOP_GAP,Y]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});

  // Signal poles
  const po=Math.round(R*.52);
  _pole(ctx,X-R/2-po,Y-IB-po,0,getSig,CW);
  _pole(ctx,X+R/2+po,Y+IB+po,2,getSig,CW);
  _pole(ctx,X+IB+po,Y-R/2-po,1,getSig,CW);
  _pole(ctx,X-IB-po,Y+R/2+po,3,getSig,CW);

  // Labels + density
  const fs=Math.max(11,Math.min(14,CW/62));
  ctx.font=`700 ${fs}px "Share Tech Mono",monospace`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowBlur=8; ctx.shadowColor=NEON.b; ctx.fillStyle=COL.label;
  ctx.fillText('ROAD A',X,14); ctx.fillText('ROAD C',X,CH-12);
  ctx.textAlign='left'; ctx.fillText('ROAD B',X+IB+R/2+16,Y);
  ctx.textAlign='right'; ctx.fillText('ROAD D',X-IB-R/2-16,Y);
  ctx.shadowBlur=0; ctx.textAlign='center';

  const sc=d=>{const s=getSig(d);return s==='green'?NEON.g:s==='yellow'?NEON.y:'#ff4444';};
  const df=Math.max(9,Math.min(12,CW/82));
  ctx.font=`600 ${df}px "Share Tech Mono",monospace`;
  ctx.fillStyle=sc(0); ctx.textAlign='center'; ctx.fillText(`▼ ${dens[0]} veh`,X,26);
  ctx.fillStyle=sc(2); ctx.fillText(`▲ ${dens[2]} veh`,X,CH-24);
  ctx.fillStyle=sc(1); ctx.textAlign='left';  ctx.fillText(`◀ ${dens[1]} veh`,X+IB+R/2+16,Y+df+4);
  ctx.fillStyle=sc(3); ctx.textAlign='right'; ctx.fillText(`▶ ${dens[3]} veh`,X-IB-R/2-16,Y-df-4);
  ctx.textAlign='center'; ctx.textBaseline='middle';
}

function _pole(ctx, x, y, dir, getSig, CW) {
  const sig=getSig(dir), sc=Math.max(0.7,Math.min(1.4,CW/700));
  const HW=Math.round(16*sc), HH=Math.round(42*sc), lr=5.5*sc;
  ctx.strokeStyle='#263d56'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(x,y+HH/2); ctx.lineTo(x,y+HH/2+Math.round(18*sc)); ctx.stroke();
  ctx.fillStyle='#06101c'; rrp(ctx,x-HW/2,y-HH/2,HW,HH,4); ctx.fill();
  ctx.strokeStyle='rgba(0,212,255,0.25)'; ctx.lineWidth=1.5; rrp(ctx,x-HW/2,y-HH/2,HW,HH,4); ctx.stroke();
  [{s:'red',c:'#ff1744',o:'#3a0808',oy:-HH*.31},{s:'yellow',c:'#ffea00',o:'#3a2e00',oy:0},{s:'green',c:'#00ff88',o:'#083a12',oy:HH*.31}]
  .forEach(l=>{
    const on=l.s===sig;
    ctx.beginPath(); ctx.arc(x,y+l.oy,lr,0,Math.PI*2);
    if(on){ctx.shadowColor=l.c;ctx.shadowBlur=18;}
    ctx.fillStyle=on?l.c:l.o; ctx.fill(); ctx.shadowBlur=0;
    if(on){ctx.beginPath();ctx.arc(x-1.8,y+l.oy-1.8,1.5,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fill();}
  });
  ctx.font=`600 ${Math.round(9*sc)}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillStyle='rgba(0,212,255,0.45)';
  ctx.fillText(['N▼','E◀','S▲','W▶'][dir],x,y+HH/2+4);
}

// ── Regular vehicle ──────────────────────────────────────────────────────────
export function drawCar(ctx, v) {
  let col=v.col;
  if(v.isViolator&&!v.detected) col='#ff5500';
  if(v.isViolator&& v.detected) col='#ff006e';
  if(v._wrecked) col='#882200';
  const {L,W}=v;
  ctx.save(); ctx.translate(v.px,v.py); ctx.rotate([Math.PI/2,Math.PI,3*Math.PI/2,0][v.dir]);
  if(v._wrecked){ctx.globalAlpha=Math.max(0.15,(v._wreckedTtl||1)/90);}
  ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  ctx.fillStyle='rgba(0,0,0,0.25)'; rrp(ctx,-L/2+2,-W/2+2,L,W,3); ctx.fill();
  ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.fillStyle=col; rrp(ctx,-L/2,-W/2,L,W,3); ctx.fill();
  ctx.strokeStyle=col+'cc'; ctx.lineWidth=1.2; rrp(ctx,-L/2,-W/2,L,W,3); ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,0.36)'; rrp(ctx,-L/2+4,-W/2+2.5,L-12,W-5,2); ctx.fill();
  if(!v._wrecked){
    ctx.fillStyle='rgba(160,235,255,0.58)'; rrp(ctx,L/2-8,-W/2+2.5,6,W-5,2); ctx.fill();
    [[L/2-2,-W/2+2],[L/2-2,W/2-2]].forEach(([lx,ly])=>{ctx.beginPath();ctx.arc(lx,ly,2,0,Math.PI*2);ctx.fillStyle='#ffffdd';ctx.shadowColor='#ffff99';ctx.shadowBlur=9;ctx.fill();ctx.shadowBlur=0;});
    [[-L/2+2,-W/2+2],[-L/2+2,W/2-2]].forEach(([lx,ly])=>{ctx.beginPath();ctx.arc(lx,ly,1.8,0,Math.PI*2);ctx.fillStyle='#ff2244';ctx.shadowColor='#ff0000';ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;});
    if(v.waiting){ctx.fillStyle='rgba(255,60,0,0.18)';ctx.beginPath();ctx.ellipse(0,0,L*.65,W*.65,0,0,Math.PI*2);ctx.fill();}
  }
  const ug=ctx.createRadialGradient(0,0,0,0,0,L*.55);ug.addColorStop(0,col+'1a');ug.addColorStop(1,'transparent');
  ctx.fillStyle=ug; ctx.beginPath(); ctx.ellipse(0,0,L*.55,W*.55,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── Emergency vehicle ────────────────────────────────────────────────────────
export function drawEmgCar(ctx, v, sirenBlink) {
  const {L,W}=v;
  ctx.save(); ctx.translate(v.px,v.py); ctx.rotate([Math.PI/2,Math.PI,3*Math.PI/2,0][v.dir]);
  const ec=v.type==='police'?'rgba(68,136,255,0.22)':v.type==='ambulance'?'rgba(255,60,60,0.22)':'rgba(255,100,0,0.22)';
  const ag=ctx.createRadialGradient(0,0,0,0,0,L*1.2);ag.addColorStop(0,ec);ag.addColorStop(1,'transparent');
  ctx.fillStyle=ag; ctx.beginPath(); ctx.ellipse(0,0,L*1.2,W*1.5,0,0,Math.PI*2); ctx.fill();
  ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;
  ctx.fillStyle='rgba(0,0,0,0.3)'; rrp(ctx,-L/2+2,-W/2+2,L,W,3); ctx.fill();
  ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.fillStyle=v.col; rrp(ctx,-L/2,-W/2,L,W,3); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1.5; rrp(ctx,-L/2,-W/2,L,W,3); ctx.stroke();
  ctx.fillStyle=v.roof; rrp(ctx,-L/2+3,-W/2+2.5,L-6,W-5,2); ctx.fill();
  ctx.fillStyle='rgba(190,245,255,0.6)'; rrp(ctx,L/2-9,-W/2+2.5,7,W-5,2); ctx.fill();
  if(v.type==='ambulance'){ctx.fillStyle='rgba(255,0,0,0.88)';ctx.fillRect(-1.5,-W/2+3,3,W-6);ctx.fillRect(-5,-1.5,10,3);}
  else if(v.type==='police'){ctx.fillStyle='rgba(255,255,255,0.48)';const sw=(L-8)/4;for(let k=0;k<4;k++)if(k%2===0){ctx.fillRect(-L/2+4+k*sw,-W/2+1,sw,3.5);ctx.fillRect(-L/2+4+k*sw,W/2-4.5,sw,3.5);}}
  else{ctx.fillStyle='rgba(255,210,0,0.55)';ctx.fillRect(-L/2+4,-1.5,L-8,3);}
  const s1=sirenBlink?v.s1:'#0a0a0a', s2=sirenBlink?'#0a0a0a':v.s2;
  ctx.beginPath();ctx.arc(L/2-6,-W/2+4,3,0,Math.PI*2);ctx.fillStyle=s1;ctx.shadowColor=s1;ctx.shadowBlur=sirenBlink?16:0;ctx.fill();ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(L/2-6,W/2-4,3,0,Math.PI*2);ctx.fillStyle=s2;ctx.shadowColor=s2;ctx.shadowBlur=sirenBlink?0:16;ctx.fill();ctx.shadowBlur=0;
  [[L/2-2,-W/2+2],[L/2-2,W/2-2]].forEach(([lx,ly])=>{ctx.beginPath();ctx.arc(lx,ly,2.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;});
  [[-L/2+2,-W/2+2],[-L/2+2,W/2-2]].forEach(([lx,ly])=>{ctx.beginPath();ctx.arc(lx,ly,1.8,0,Math.PI*2);ctx.fillStyle='#ff2244';ctx.shadowColor='#ff0000';ctx.shadowBlur=7;ctx.fill();ctx.shadowBlur=0;});
  ctx.restore();
  const lc=v.type==='police'?'#4488ff':v.type==='ambulance'?'#ff5555':'#ff8800';
  ctx.font=`700 10px Orbitron,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillStyle=lc; ctx.shadowColor=lc; ctx.shadowBlur=8;
  ctx.fillText(v.label,v.px,v.py-(W/2+5)); ctx.shadowBlur=0;
}

// ── Violation flash ──────────────────────────────────────────────────────────
export function drawVioFlash(ctx, f) {
  const alpha=Math.min(1,f.ttl/30), r=12+(1-f.ttl/90)*26;
  ctx.beginPath(); ctx.arc(f.px,f.py,r,0,Math.PI*2);
  ctx.strokeStyle=`rgba(255,0,80,${alpha*.85})`; ctx.lineWidth=2.5; ctx.stroke();
  if(f.ttl>35){
    ctx.font='700 11px Orbitron,monospace'; ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillStyle=`rgba(255,0,80,${alpha})`; ctx.shadowColor='#ff0050'; ctx.shadowBlur=10;
    ctx.fillText('⚠ BUSTED',f.px,f.py-r-3);
    ctx.font='600 9px Share Tech Mono,monospace';
    ctx.fillStyle=`rgba(255,234,0,${alpha})`; ctx.fillText(f.plate,f.px,f.py-r+9); ctx.shadowBlur=0;
  }
}

// ── Crash flash ──────────────────────────────────────────────────────────────
export function drawCrashFlash(ctx, f) {
  const alpha=f.ttl/f.maxTtl, radius=f.r+(1-alpha)*f.r*3;
  ctx.beginPath(); ctx.arc(f.px,f.py,radius,0,Math.PI*2);
  ctx.strokeStyle=`rgba(255,${Math.round(80+alpha*120)},0,${alpha*.9})`; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); ctx.arc(f.px,f.py,radius*.4,0,Math.PI*2);
  ctx.fillStyle=`rgba(255,200,0,${alpha*.4})`; ctx.fill();
  if(f.ttl>f.maxTtl*.55){
    for(let k=0;k<6;k++){
      const ang=k*Math.PI/3+(1-alpha)*.8, len=f.r*1.8*alpha;
      ctx.beginPath(); ctx.moveTo(f.px,f.py); ctx.lineTo(f.px+Math.cos(ang)*len,f.py+Math.sin(ang)*len);
      ctx.strokeStyle=`rgba(255,230,0,${alpha*.7})`; ctx.lineWidth=1.5; ctx.stroke();
    }
  }
}

// ── HUD bar ──────────────────────────────────────────────────────────────────
export function drawHUD(ctx, CW, CH, engine) {
  const {phase, remaining, overrideActive, overrideDir, activeDir} = engine;
  const isY  = phase === 'YELLOW';
  const isNS = activeDir===0 || activeDir===2;
  const col  = overrideActive ? NEON.o : isY ? NEON.y : NEON.g;
  const rn   = isNS ? 'A & C' : 'B & D';
  const dur  = overrideActive ? 5500 : isY ? 1800 : (engine.signals?.phaseDur ?? 7000);
  const pct  = Math.max(0,Math.min(1, remaining/dur));

  ctx.fillStyle='rgba(2,8,18,0.86)'; ctx.fillRect(0,CH-34,CW,34);
  ctx.fillStyle='rgba(0,212,255,0.1)'; ctx.fillRect(0,CH-34,CW,1);
  const fs=Math.max(10,Math.min(13,CW/68));
  ctx.font=`700 ${fs}px Orbitron,sans-serif`; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle=col;
  const lbl=overrideActive?`🚨 EMERGENCY — ROAD ${ROAD_NAMES[overrideDir]} CLEARED`
    :isY?'⚠ YELLOW — TRANSITIONING'
    :`▶ GREEN — ROAD ${rn}`;
  ctx.fillText(lbl,14,CH-17);
  const bw=Math.min(180,CW*.22);
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(CW-bw-14,CH-26,bw,12);
  const pg=ctx.createLinearGradient(CW-bw-14,0,CW-14,0);
  pg.addColorStop(0,col); pg.addColorStop(1,NEON.b);
  ctx.fillStyle=pg; ctx.fillRect(CW-bw-14,CH-26,bw*pct,12);
  ctx.font=`600 ${Math.max(9,fs-1)}px Share Tech Mono,monospace`;
  ctx.textAlign='right'; ctx.fillStyle='rgba(255,255,255,0.45)';
  ctx.fillText(overrideActive?'OVR':Math.ceil(remaining/1000)+'s', CW-18,CH-19);
}
