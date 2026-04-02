// ════════════════════════════════════════════════════════
//  Renderer.js — Canvas drawing for Urban Flow
//  BUG3 FIX: All drawing in CSS coordinates.
//            DPR scaling applied once at canvas setup.
//            No coordinate recalculation needed on render.
// ════════════════════════════════════════════════════════

import { EMG_CFG, ROAD_NAMES } from './SimEngine.js';

function shade(hex, a) {
  let n = parseInt(hex.replace('#','').padEnd(6,'0'), 16) || 0;
  return '#' + [n>>16,(n>>8)&255,n&255]
    .map(c => Math.max(0,Math.min(255,c+a)).toString(16).padStart(2,'0')).join('');
}

function rr(ctx, x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);          ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r);    ctx.closePath();
}

export function renderFrame(ctx, engine) {
  const { CW, CH, buildings, trees, overrideActive, overrideDir,
          vehs, emgVehs, crashFlashes, vioFlashes, sirenTick,
          sigState, sigDur, phaseStartTime,
          overrideEnd, manualOverrideDir, manualOverrideEnd } = engine;

  const X  = engine.cx(), Y = engine.cy();
  const R  = engine.RW(), IB = engine.IBOX();
  const SW = Math.round(R * 0.28);
  const now = performance.now();

  // ── background ────────────────────────────────────────
  ctx.fillStyle = '#030d0c';
  ctx.fillRect(0, 0, CW, CH);

  // grid
  ctx.strokeStyle = 'rgba(0,212,255,0.022)'; ctx.lineWidth = 1;
  const gs = Math.round(CW / 18);
  for (let x = 0; x <= CW; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke(); }
  for (let y = 0; y <= CH; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke(); }

  // ── buildings ─────────────────────────────────────────
  buildings.forEach(b => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(b.x+4,b.y+4,b.w,b.h);
    ctx.fillStyle = b.col;  ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x+2,b.y+2,b.w-4,b.h-4);
    const wSz=Math.max(2,Math.min(5,b.w*.18)),wPad=Math.max(2,b.w*.1),wGap=wSz+wPad;
    for (let wx=b.x+wPad; wx<b.x+b.w-wSz; wx+=wGap)
      for (let wy=b.y+wPad; wy<b.y+b.h-wSz; wy+=wGap)
        if (Math.sin(wx*.3+wy*.5)>0) {
          ctx.fillStyle=`rgba(0,${Math.random()>.6?'255,136':'212,255'},.18)`;
          ctx.fillRect(wx,wy,wSz,wSz*1.3);
        }
    ctx.strokeStyle='rgba(0,212,255,0.07)';ctx.lineWidth=.7;ctx.strokeRect(b.x,b.y,b.w,b.h);
  });

  // ── sidewalks ─────────────────────────────────────────
  ctx.fillStyle = '#0e1e2e';
  ctx.fillRect(X-R/2-SW,0,SW,Y-IB);    ctx.fillRect(X+R/2,0,SW,Y-IB);
  ctx.fillRect(X-R/2-SW,Y+IB,SW,CH-Y-IB); ctx.fillRect(X+R/2,Y+IB,SW,CH-Y-IB);
  ctx.fillRect(0,Y-R/2-SW,X-IB,SW);    ctx.fillRect(0,Y+R/2,X-IB,SW);
  ctx.fillRect(X+IB,Y-R/2-SW,CW-X-IB,SW); ctx.fillRect(X+IB,Y+R/2,CW-X-IB,SW);

  // ── trees ─────────────────────────────────────────────
  trees.forEach(t => {
    const tr = t.r || 3;
    ctx.fillStyle='#3d2010';ctx.beginPath();ctx.ellipse(t.x,t.y+tr*.3,tr*.26,tr*.38,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(t.x+2,t.y+2,tr,tr*.78,0,0,Math.PI*2);ctx.fill();
    const TREE_COLS=['#0d2e0d','#0b260b','#0f380f','#102810','#163416'];
    const gi=Math.floor(Math.abs(Math.sin(t.x+t.y))*TREE_COLS.length);
    ctx.fillStyle=TREE_COLS[gi%TREE_COLS.length];ctx.beginPath();ctx.arc(t.x,t.y,tr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,255,100,0.13)';ctx.beginPath();ctx.arc(t.x-tr*.2,t.y-tr*.2,tr*.5,0,Math.PI*2);ctx.fill();
  });

  // ── roads ─────────────────────────────────────────────
  ctx.fillStyle = '#1e2e3e';
  ctx.fillRect(X-R/2,0,R,Y-IB);     ctx.fillRect(X-R/2,Y+IB,R,CH-Y-IB);
  ctx.fillRect(0,Y-R/2,X-IB,R);     ctx.fillRect(X+IB,Y-R/2,CW-X-IB,R);

  // intersection box
  ctx.fillStyle = '#1a2834'; ctx.fillRect(X-IB,Y-IB,IB*2,IB*2);

  // ── emergency corridor ────────────────────────────────
  if (overrideActive && now < overrideEnd && overrideDir >= 0) {
    const ns = overrideDir === 0 || overrideDir === 2;
    ctx.fillStyle = 'rgba(255,234,0,0.07)';
    if (ns) ctx.fillRect(X-R/2,0,R,CH);
    else    ctx.fillRect(0,Y-R/2,CW,R);
    ctx.strokeStyle='rgba(255,234,0,0.25)';ctx.lineWidth=1.5;ctx.setLineDash([8,6]);
    if (ns) {
      ctx.beginPath();ctx.moveTo(X-R/2,0);ctx.lineTo(X-R/2,CH);ctx.stroke();
      ctx.beginPath();ctx.moveTo(X+R/2,0);ctx.lineTo(X+R/2,CH);ctx.stroke();
    } else {
      ctx.beginPath();ctx.moveTo(0,Y-R/2);ctx.lineTo(CW,Y-R/2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,Y+R/2);ctx.lineTo(CW,Y+R/2);ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // ── kerbs ─────────────────────────────────────────────
  ctx.strokeStyle='rgba(0,212,255,0.2)';ctx.lineWidth=1.5;
  [[X-R/2,0,X-R/2,Y-IB],[X+R/2,0,X+R/2,Y-IB],[X-R/2,Y+IB,X-R/2,CH],[X+R/2,Y+IB,X+R/2,CH],
   [0,Y-R/2,X-IB,Y-R/2],[0,Y+R/2,X-IB,Y+R/2],[X+IB,Y-R/2,CW,Y-R/2],[X+IB,Y+R/2,CW,Y+R/2]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});

  // ── lane centre lines ─────────────────────────────────
  ctx.strokeStyle='rgba(255,255,255,0.16)';ctx.lineWidth=1.6;ctx.setLineDash([R*.16,R*.12]);
  [[X,0,X,Y-IB],[X,Y+IB,X,CH],[0,Y,X-IB,Y],[X+IB,Y,CW,Y]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  ctx.setLineDash([]);

  // ── zebra crossings ───────────────────────────────────
  const ZT = Math.round(R * 0.11);
  function zebra(bx,by,bw,bh,hz){
    const n=6, sw=hz?bw/n:bh/n;
    ctx.fillStyle='rgba(255,255,255,0.065)';
    for(let i=0;i<n;i+=2) hz?ctx.fillRect(bx+i*sw,by,sw,bh):ctx.fillRect(bx,by+i*sw,bw,sw);
  }
  zebra(X-R/2,Y-IB-ZT,R,ZT,true); zebra(X-R/2,Y+IB,R,ZT,true);
  zebra(X-IB-ZT,Y-R/2,ZT,R,false); zebra(X+IB,Y-R/2,ZT,R,false);

  // ── stop lines ───────────────────────────────────────
  const STOP_GAP = 6;
  ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(X-R/2,Y-IB-STOP_GAP);ctx.lineTo(X,Y-IB-STOP_GAP);ctx.stroke();
  ctx.beginPath();ctx.moveTo(X,Y+IB+STOP_GAP);ctx.lineTo(X+R/2,Y+IB+STOP_GAP);ctx.stroke();
  ctx.beginPath();ctx.moveTo(X-IB-STOP_GAP,Y);ctx.lineTo(X-IB-STOP_GAP,Y+R/2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(X+IB+STOP_GAP,Y-R/2);ctx.lineTo(X+IB+STOP_GAP,Y);ctx.stroke();

  // ── signal poles ──────────────────────────────────────
  const po = Math.round(R * 0.54);
  drawPole(ctx, engine, X-R/2-po, Y-IB-po, 0);
  drawPole(ctx, engine, X+R/2+po, Y+IB+po, 2);
  drawPole(ctx, engine, X+IB+po,  Y-R/2-po, 1);
  drawPole(ctx, engine, X-IB-po,  Y+R/2+po, 3);

  // ── road labels ───────────────────────────────────────
  const fs  = Math.max(9, Math.min(12, CW/66));
  const dfs = Math.max(7, Math.min(10, CW/84));
  ctx.font=`700 ${fs}px "Share Tech Mono",monospace`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,212,255,0.72)';
  ctx.fillText('ROAD A',X,13); ctx.fillText('ROAD C',X,CH-11);
  ctx.textAlign='left';  ctx.fillText('ROAD B',X+IB+R/2+14,Y);
  ctx.textAlign='right'; ctx.fillText('ROAD D',X-IB-R/2-14,Y);

  ctx.font=`600 ${dfs}px "Share Tech Mono",monospace`;
  const sc=[0,1,2,3].map(i=>{const s=engine.getSig(i);return s==='green'?'#00ff88':s==='yellow'?'#ffea00':'#ff4444';});
  // FIX: count real vehicles per direction instead of showing fake engine.dens[]
  const vA = engine.vehs.filter(v => v.dir === 0).length;
  const vB = engine.vehs.filter(v => v.dir === 1).length;
  const vC = engine.vehs.filter(v => v.dir === 2).length;
  const vD = engine.vehs.filter(v => v.dir === 3).length;
  ctx.textAlign='center';ctx.fillStyle=sc[0];ctx.fillText(`▼ ${vA} veh`,X,24);
  ctx.fillStyle=sc[2];ctx.fillText(`▲ ${vC} veh`,X,CH-22);
  ctx.textAlign='left';ctx.fillStyle=sc[1];ctx.fillText(`◀ ${vB}`,X+IB+R/2+14,Y+fs+3);
  ctx.textAlign='right';ctx.fillStyle=sc[3];ctx.fillText(`▶ ${vD}`,X-IB-R/2-14,Y-fs-3);
  ctx.textAlign='center';ctx.textBaseline='middle';

  // ── vehicles ──────────────────────────────────────────
  [...vehs, ...emgVehs]
    .sort((a,b) => a.py - b.py)
    .forEach(v => v.type ? drawEmgCar(ctx, engine, v, sirenTick) : drawCar(ctx, v));

  // ── effects ───────────────────────────────────────────
  crashFlashes.forEach(f => {
    const al = f.ttl/f.maxTtl, rad = f.r + (1-al)*f.r*3;
    ctx.strokeStyle=`rgba(255,${Math.round(80+al*120)},0,${al*.82})`;ctx.lineWidth=2.2;
    ctx.beginPath();ctx.arc(f.px,f.py,rad,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=`rgba(255,200,0,${al*.32})`;ctx.beginPath();ctx.arc(f.px,f.py,rad*.33,0,Math.PI*2);ctx.fill();
    f.ttl--;
  });
  engine.crashFlashes = engine.crashFlashes.filter(f => f.ttl > 0);

  vioFlashes.forEach(f => {
    const al = Math.min(1, f.ttl/30), r = 12 + (1-f.ttl/80)*20;
    ctx.strokeStyle=`rgba(255,0,80,${al*.78})`;ctx.lineWidth=1.8;
    ctx.beginPath();ctx.arc(f.px,f.py,r,0,Math.PI*2);ctx.stroke();
  });

  // ── HUD bar ───────────────────────────────────────────
  drawHUD(ctx, engine, CW, CH, now);
}

// ── signal pole ───────────────────────────────────────────
function drawPole(ctx, engine, x, y, dir) {
  const sig = engine.getSig(dir);
  const sc  = Math.max(0.65, Math.min(1.5, engine.CW/650));
  const HW=Math.round(16*sc), HH=Math.round(43*sc), LR=5.2*sc;
  ctx.strokeStyle='#263d56';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(x,y+HH/2);ctx.lineTo(x,y+HH/2+Math.round(19*sc));ctx.stroke();
  ctx.fillStyle='#06101c'; rr(ctx,x-HW/2,y-HH/2,HW,HH,4); ctx.fill();
  ctx.strokeStyle='rgba(0,212,255,0.28)';ctx.lineWidth=1.1; rr(ctx,x-HW/2,y-HH/2,HW,HH,4); ctx.stroke();
  [{state:'red',col:'#ff1744',off:'#2a0808',oy:-HH*.31},
   {state:'yellow',col:'#ffea00',off:'#2a2000',oy:0},
   {state:'green',col:'#00ff88',off:'#082a12',oy:HH*.31}]
  .forEach(l => {
    const on = l.state === sig;
    ctx.beginPath(); ctx.arc(x, y+l.oy, LR, 0, Math.PI*2);
    if (on) { ctx.shadowColor=l.col; ctx.shadowBlur=12; }
    ctx.fillStyle = on ? l.col : l.off; ctx.fill(); ctx.shadowBlur=0;
    if (on) { ctx.beginPath();ctx.arc(x-1.4,y+l.oy-1.4,1.3,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.45)';ctx.fill(); }
  });
}

// ── regular vehicle ───────────────────────────────────────
function drawCar(ctx, v) {
  let col = v.col;
  if (v.isViolator && !v.detected) col='#ff5500';
  if (v.isViolator && v.detected)  col='#ff006e';
  if (v._wrecked) col='#882200';
  const L=v.L, W=v.W, vtype=v.vtype||'sedan';
  ctx.save();
  ctx.translate(v.px, v.py);
  ctx.rotate([Math.PI/2, Math.PI, 3*Math.PI/2, 0][v.dir]);
  if (v._wrecked) ctx.globalAlpha = Math.max(.1, (v._wreckedTtl||1)/80);

  // shadow
  ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.ellipse(2,3,L*.43,W*.37,0,0,Math.PI*2);ctx.fill();

  // wheels
  const wr=W*.25, wxF=L/2-wr*1.55, wxR=-L/2+wr*1.55;
  [[wxF,-W/2+wr*.05],[wxF,W/2-wr*.05],[wxR,-W/2+wr*.05],[wxR,W/2-wr*.05]].forEach(([wx,wy])=>{
    ctx.fillStyle='#181818';ctx.beginPath();ctx.ellipse(wx,wy,wr,wr*.77,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=shade(col,28)+'bb';ctx.beginPath();ctx.arc(wx,wy,wr*.55,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=.55;
    for(let k=0;k<4;k++){const a=k*Math.PI/2;ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+Math.cos(a)*wr*.48,wy+Math.sin(a)*wr*.46);ctx.stroke();}
    ctx.fillStyle='#bbb';ctx.beginPath();ctx.arc(wx,wy,wr*.17,0,Math.PI*2);ctx.fill();
  });

  // body
  ctx.fillStyle=col; rr(ctx,-L/2,-W/2,L,W,W*.22); ctx.fill();
  ctx.fillStyle=shade(col,36)+'42'; rr(ctx,-L/2+1,-W/2+1,L-2,W*.4,W*.17); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.2)'; rr(ctx,-L/2+1,W/2-W*.3,L-2,W*.28,W*.08); ctx.fill();
  ctx.strokeStyle=shade(col,-32);ctx.lineWidth=.75; rr(ctx,-L/2,-W/2,L,W,W*.22); ctx.stroke();
  ctx.fillStyle=shade(col,-18);
  rr(ctx,L/2-L*.1,-W/2+W*.07,L*.1,W*.86,2);ctx.fill();
  rr(ctx,-L/2,-W/2+W*.07,L*.1,W*.86,2);ctx.fill();

  // cabin
  const cxs=vtype==='bus'?-L*.37:vtype==='van'?-L*.28:-L*.05;
  const cw=vtype==='bus'?L*.74:vtype==='van'?L*.68:L*.49;
  ctx.fillStyle=shade(col,-26); rr(ctx,cxs,-W*.33,cw,W*.66,W*.09); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.06)'; rr(ctx,cxs+1,-W*.29,cw-2,W*.28,W*.07); ctx.fill();

  if (!v._wrecked) {
    ctx.fillStyle='rgba(130,210,255,0.65)'; rr(ctx,L*.13,-W*.29,L*.2,W*.58,2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.beginPath();ctx.moveTo(L*.15,-W*.26);ctx.lineTo(L*.21,-W*.26);ctx.lineTo(L*.19,-W*.08);ctx.lineTo(L*.15,-W*.08);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(80,160,200,0.52)'; rr(ctx,-L*.33,-W*.27,L*.16,W*.54,2); ctx.fill();
    ctx.fillStyle='#fffff0';
    ctx.beginPath();ctx.ellipse(L/2-3.2,-W*.3,3.5,2.1,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(L/2-3.2,W*.3,3.5,2.1,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,240,180,0.3)';
    ctx.beginPath();ctx.ellipse(L/2,-W*.3,5.5,3.2,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(L/2,W*.3,5.5,3.2,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f44336';
    ctx.beginPath();ctx.ellipse(-L/2+2.8,-W*.3,3,1.8,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(-L/2+2.8,W*.3,3,1.8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(244,67,54,0.16)';
    ctx.beginPath();ctx.ellipse(-L/2,-W*.3,5,2.8,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(-L/2,W*.3,5,2.8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=shade(col,-14)+'88';ctx.lineWidth=.45;
    ctx.beginPath();ctx.moveTo(L/2-1.2,0);ctx.lineTo(-L/2+1.2,0);ctx.stroke();
  }
  if (v.waiting&&!v._wrecked){ctx.fillStyle='rgba(244,67,54,0.18)';ctx.beginPath();ctx.ellipse(-L/2-2,0,L*.2,W*.65,0,0,Math.PI*2);ctx.fill();}
  if (v.isViolator&&!v._wrecked){ctx.strokeStyle='rgba(255,80,0,0.45)';ctx.lineWidth=1.3;rr(ctx,-L/2-1.3,-W/2-1.3,L+2.6,W+2.6,W*.25);ctx.stroke();}
  ctx.restore();
}

// ── emergency vehicle ─────────────────────────────────────
function drawEmgCar(ctx, engine, v, sirenTick) {
  const cfg   = EMG_CFG[v.type];
  const L=v.L, W=v.W;
  const blink = sirenTick < 300;
  ctx.save();
  ctx.translate(v.px, v.py);
  ctx.rotate([Math.PI/2, Math.PI, 3*Math.PI/2, 0][v.dir]);

  const ac=v.type==='police'?'rgba(68,136,255,0.16)':v.type==='ambulance'?'rgba(255,60,60,0.16)':'rgba(255,100,0,0.16)';
  ctx.fillStyle=ac;ctx.beginPath();ctx.ellipse(0,0,L*1.2,W*1.55,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.32)';ctx.beginPath();ctx.ellipse(2,4,L*.44,W*.39,0,0,Math.PI*2);ctx.fill();

  const wr=W*.25,wxF=L/2-wr*1.48,wxR=-L/2+wr*1.48;
  [[wxF,-W/2+wr*.05],[wxF,W/2-wr*.05],[wxR,-W/2+wr*.05],[wxR,W/2-wr*.05]].forEach(([wx,wy])=>{
    ctx.fillStyle='#111';ctx.beginPath();ctx.ellipse(wx,wy,wr,wr*.77,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#666';ctx.beginPath();ctx.arc(wx,wy,wr*.53,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#aaa';ctx.beginPath();ctx.arc(wx,wy,wr*.19,0,Math.PI*2);ctx.fill();
  });

  ctx.fillStyle=cfg.col; rr(ctx,-L/2,-W/2,L,W,W*.2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=.9; rr(ctx,-L/2,-W/2,L,W,W*.2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.09)'; rr(ctx,-L/2+1,-W/2+1,L-2,W*.38,W*.14); ctx.fill();
  ctx.fillStyle=cfg.roof; rr(ctx,-L/2+3,-W/2+2.5,L-6,W-5,2); ctx.fill();
  ctx.fillStyle='rgba(190,235,255,0.62)'; rr(ctx,L/2-9.5,-W/2+2.5,7.5,W-5,2); ctx.fill();

  if (v.type==='ambulance') {
    ctx.fillStyle='rgba(220,0,0,0.88)';
    ctx.fillRect(-1.4,-W/2+3,2.8,W-6); ctx.fillRect(-5.5,-1.3,11,2.6);
  } else if (v.type==='police') {
    ctx.fillStyle='rgba(255,255,255,0.43)';
    const sw=(L-10)/4;
    for(let k=0;k<4;k++) if(k%2===0){ctx.fillRect(-L/2+5+k*sw,-W/2+1.4,sw,2.8);ctx.fillRect(-L/2+5+k*sw,W/2-4.2,sw,2.8);}
  } else {
    ctx.fillStyle='rgba(255,210,0,0.68)'; ctx.fillRect(-L/2+5,-1.3,L-10,2.6);
  }

  const s1=blink?cfg.s1:'#0a0a0a', s2=blink?'#0a0a0a':cfg.s2;
  if(blink){ctx.shadowColor=s1;ctx.shadowBlur=10;}
  ctx.fillStyle=s1;ctx.beginPath();ctx.arc(L/2-6.5,-W/2+3.8,3.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  if(!blink){ctx.shadowColor=s2;ctx.shadowBlur=10;}
  ctx.fillStyle=s2;ctx.beginPath();ctx.arc(L/2-6.5,W/2-3.8,3.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

  ctx.fillStyle='#fffff0';
  ctx.beginPath();ctx.ellipse(L/2-2.4,-W*.3,3.3,1.9,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(L/2-2.4,W*.3,3.3,1.9,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f44336';
  ctx.beginPath();ctx.ellipse(-L/2+2.8,-W*.3,2.8,1.7,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(-L/2+2.8,W*.3,2.8,1.7,0,0,Math.PI*2);ctx.fill();
  ctx.restore();

  const lc=v.type==='police'?'#4488ff':v.type==='ambulance'?'#ff5555':'#ff8800';
  const lfs=Math.max(7,Math.min(10,engine.CW/84));
  ctx.font=`700 ${lfs}px "Share Tech Mono",monospace`;
  ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillStyle=lc;ctx.fillText(cfg.label,v.px,v.py-(v.W/2+5));
}

// ── HUD ───────────────────────────────────────────────────
function drawHUD(ctx, engine, CW, CH, now) {
  const { sigState, sigDur, phaseStartTime, overrideActive, overrideEnd,
          overrideDir, manualOverrideDir, manualOverrideEnd } = engine;

  const elapsed  = now - phaseStartTime;
  const rem      = Math.max(0, sigDur - elapsed);
  const pct      = Math.min(1, rem / sigDur);
  const isY      = sigState==='NS_YELLOW'||sigState==='EW_YELLOW';
  const isNS     = sigState==='NS_GREEN' ||sigState==='NS_YELLOW';
  const manActive= manualOverrideDir>=0 && now < manualOverrideEnd;
  const col      = overrideActive && now<overrideEnd ? '#ff6b00'
                 : manActive ? '#ffea00' : isY ? '#ffea00' : '#00ff88';

  ctx.fillStyle='rgba(2,8,18,0.86)'; ctx.fillRect(0,CH-30,CW,30);
  ctx.fillStyle='rgba(0,212,255,0.08)'; ctx.fillRect(0,CH-30,CW,1);

  const fs=Math.max(8,Math.min(11,CW/72));
  ctx.font=`700 ${fs}px "Share Tech Mono",monospace`;
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=col;

  let lbl;
  if (overrideActive && now<overrideEnd)
    lbl=`🚨 EMERGENCY OVERRIDE — ROAD ${'ABCD'[overrideDir]}`;
  else if (manActive)
    lbl=`👮 MANUAL OVERRIDE — ROAD ${'ABCD'[manualOverrideDir]} — ${Math.ceil(Math.max(0,manualOverrideEnd-now)/1000)}s`;
  else if (isY) lbl=`⚠ YELLOW — TRANSITIONING`;
  else lbl=`▶ GREEN — ROAD ${isNS?'A & C':'B & D'}`;
  ctx.fillText(lbl, 12, CH-15);

  const bw=Math.min(150,CW*.18);
  ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(CW-bw-12,CH-22,bw,8);
  ctx.fillStyle=col; ctx.fillRect(CW-bw-12,CH-22,bw*pct,8);

  ctx.font=`500 ${Math.max(7,fs-1)}px "Share Tech Mono",monospace`;
  ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.38)';
  const timerLabel = overrideActive&&now<overrideEnd ? 'OVR'
                   : manActive ? 'MAN' : Math.ceil(rem/1000)+'s';
  ctx.fillText(timerLabel, CW-16, CH-17);
}
