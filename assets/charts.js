// ============================================================
// Thư viện biểu đồ SVG thuần — không phụ thuộc thư viện ngoài.
// Hỗ trợ: radar, grouped bar, donut, line, gauge, heat table.
// ============================================================
const NS = "http://www.w3.org/2000/svg";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const P = (o) => { const e = document.createElementNS(NS, "svg"); e.setAttribute("viewBox", o.vb); e.setAttribute("class","chart-svg"); e.style.width="100%"; e.style.height="auto"; e.style.overflow="visible"; return e; };

// ---------- RADAR (ATiGB 5 chiều, trước vs nay) ----------
export function radar(el, { labels, series }) {
  const W = 480, H = 420, cx = W/2, cy = H/2 - 6, R = 150, n = labels.length;
  const svg = P({ vb: `0 0 ${W} ${H}` });
  const angle = (i) => (Math.PI*2*i/n) - Math.PI/2;
  const pt = (i, r) => [cx + Math.cos(angle(i))*r, cy + Math.sin(angle(i))*r];

  // rings
  for (let g=1; g<=5; g++){
    const r = R*g/5, poly=[];
    for (let i=0;i<n;i++){ const [x,y]=pt(i,r); poly.push(`${x},${y}`); }
    const ring = document.createElementNS(NS,"polygon");
    ring.setAttribute("points",poly.join(" "));
    ring.setAttribute("fill","none"); ring.setAttribute("stroke","#E1EAD8"); ring.setAttribute("stroke-width","1");
    svg.appendChild(ring);
    const lab=document.createElementNS(NS,"text");
    lab.setAttribute("x",cx+3); lab.setAttribute("y",cy-r+3); lab.setAttribute("fill","#9AA893");
    lab.setAttribute("font-size","9"); lab.textContent=g; svg.appendChild(lab);
  }
  // spokes + labels
  for (let i=0;i<n;i++){
    const [x,y]=pt(i,R);
    const ln=document.createElementNS(NS,"line");
    ln.setAttribute("x1",cx);ln.setAttribute("y1",cy);ln.setAttribute("x2",x);ln.setAttribute("y2",y);
    ln.setAttribute("stroke","#E1EAD8");ln.setAttribute("stroke-width","1");svg.appendChild(ln);
    const [lx,ly]=pt(i,R+26);
    const t=document.createElementNS(NS,"text");
    t.setAttribute("x",lx);t.setAttribute("y",ly);t.setAttribute("text-anchor","middle");
    t.setAttribute("dominant-baseline","middle");t.setAttribute("font-size","12");t.setAttribute("font-weight","700");
    t.setAttribute("fill","#137A3A");t.textContent=labels[i];svg.appendChild(t);
  }
  // series
  series.forEach(s=>{
    const poly=[];
    s.values.forEach((v,i)=>{ const [x,y]=pt(i, R*v/5); poly.push(`${x},${y}`); });
    const area=document.createElementNS(NS,"polygon");
    area.setAttribute("points",poly.join(" "));
    area.setAttribute("fill",s.color); area.setAttribute("fill-opacity","0.14");
    area.setAttribute("stroke",s.color); area.setAttribute("stroke-width","2.5");
    area.setAttribute("stroke-linejoin","round"); svg.appendChild(area);
    s.values.forEach((v,i)=>{ const [x,y]=pt(i,R*v/5);
      const c=document.createElementNS(NS,"circle");
      c.setAttribute("cx",x);c.setAttribute("cy",y);c.setAttribute("r","4");
      c.setAttribute("fill",s.color);c.setAttribute("stroke","#fff");c.setAttribute("stroke-width","1.5");svg.appendChild(c);
    });
  });
  el.innerHTML=""; el.appendChild(svg);
  el.appendChild(legend(series));
}

// ---------- GROUPED BAR (trước vs nay theo chiều) ----------
export function groupedBar(el, { labels, series, max=5 }) {
  const W=640, H=340, pad={l:44,r:16,t:20,b:54}, iw=W-pad.l-pad.r, ih=H-pad.t-pad.b;
  const svg=P({vb:`0 0 ${W} ${H}`});
  const n=labels.length, gw=iw/n, bw=Math.min(30,(gw-16)/series.length);
  // gridlines
  for(let g=0;g<=max;g++){ const y=pad.t+ih-(ih*g/max);
    const ln=document.createElementNS(NS,"line");
    ln.setAttribute("x1",pad.l);ln.setAttribute("x2",W-pad.r);ln.setAttribute("y1",y);ln.setAttribute("y2",y);
    ln.setAttribute("stroke","#E6EFDC");ln.setAttribute("stroke-width","1");svg.appendChild(ln);
    const t=document.createElementNS(NS,"text");t.setAttribute("x",pad.l-8);t.setAttribute("y",y+3);
    t.setAttribute("text-anchor","end");t.setAttribute("font-size","10");t.setAttribute("fill","#9AA893");t.textContent=g;svg.appendChild(t);
  }
  labels.forEach((lab,i)=>{
    const gx=pad.l+gw*i+gw/2;
    series.forEach((s,si)=>{
      const v=s.values[i], h=ih*v/max, x=gx-(series.length*bw+ (series.length-1)*6)/2 + si*(bw+6), y=pad.t+ih-h;
      const r=document.createElementNS(NS,"rect");
      r.setAttribute("x",x);r.setAttribute("y",y);r.setAttribute("width",bw);r.setAttribute("height",h);
      r.setAttribute("rx","4");r.setAttribute("fill",s.color);svg.appendChild(r);
      const t=document.createElementNS(NS,"text");t.setAttribute("x",x+bw/2);t.setAttribute("y",y-5);
      t.setAttribute("text-anchor","middle");t.setAttribute("font-size","10");t.setAttribute("font-weight","700");
      t.setAttribute("fill",s.color);t.textContent=v.toFixed(2);svg.appendChild(t);
    });
    const t=document.createElementNS(NS,"text");t.setAttribute("x",gx);t.setAttribute("y",H-32);
    t.setAttribute("text-anchor","middle");t.setAttribute("font-size","12");t.setAttribute("font-weight","700");
    t.setAttribute("fill","#137A3A");t.textContent=lab;svg.appendChild(t);
  });
  el.innerHTML="";el.appendChild(svg);el.appendChild(legend(series));
}

// ---------- DONUT ----------
export function donut(el, { data }) {
  const W=320,H=280,cx=W/2,cy=H/2,r=95,rin=58;
  const svg=P({vb:`0 0 ${W} ${H}`});
  const total=data.reduce((a,d)=>a+d.value,0)||1;
  let ang=-Math.PI/2;
  data.forEach(d=>{
    const frac=d.value/total, a2=ang+frac*Math.PI*2;
    const large=frac>0.5?1:0;
    const x1=cx+Math.cos(ang)*r, y1=cy+Math.sin(ang)*r, x2=cx+Math.cos(a2)*r, y2=cy+Math.sin(a2)*r;
    const xi1=cx+Math.cos(a2)*rin, yi1=cy+Math.sin(a2)*rin, xi2=cx+Math.cos(ang)*rin, yi2=cy+Math.sin(ang)*rin;
    const p=document.createElementNS(NS,"path");
    p.setAttribute("d",`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi1},${yi1} A${rin},${rin} 0 ${large} 0 ${xi2},${yi2} Z`);
    p.setAttribute("fill",d.color);svg.appendChild(p);
    ang=a2;
  });
  const c=document.createElementNS(NS,"text");c.setAttribute("x",cx);c.setAttribute("y",cy-4);
  c.setAttribute("text-anchor","middle");c.setAttribute("font-size","30");c.setAttribute("font-weight","700");
  c.setAttribute("font-family","'Cormorant Garamond',serif");c.setAttribute("fill","#137A3A");c.textContent=total;svg.appendChild(c);
  const c2=document.createElementNS(NS,"text");c2.setAttribute("x",cx);c2.setAttribute("y",cy+16);
  c2.setAttribute("text-anchor","middle");c2.setAttribute("font-size","11");c2.setAttribute("fill","#8A938D");c2.textContent="phản hồi";svg.appendChild(c2);
  el.innerHTML="";el.appendChild(svg);
  el.appendChild(legend(data.map(d=>({name:`${d.name} (${d.value})`,color:d.color}))));
}

// ---------- LINE (theo thời gian / theo câu hỏi) ----------
export function lineChart(el, { labels, values, color="#2E7D5B", max=5, highlight=[] }) {
  const W=680,H=300,pad={l:40,r:16,t:20,b:50},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  const svg=P({vb:`0 0 ${W} ${H}`});
  for(let g=0;g<=max;g++){const y=pad.t+ih-(ih*g/max);
    const ln=document.createElementNS(NS,"line");ln.setAttribute("x1",pad.l);ln.setAttribute("x2",W-pad.r);
    ln.setAttribute("y1",y);ln.setAttribute("y2",y);ln.setAttribute("stroke","#E6EFDC");svg.appendChild(ln);
    const t=document.createElementNS(NS,"text");t.setAttribute("x",pad.l-6);t.setAttribute("y",y+3);
    t.setAttribute("text-anchor","end");t.setAttribute("font-size","10");t.setAttribute("fill","#9AA893");t.textContent=g;svg.appendChild(t);}
  const n=labels.length, sx=(i)=>pad.l+(iw*(n===1?0.5:i/(n-1))), sy=(v)=>pad.t+ih-(ih*v/max);
  let d="";values.forEach((v,i)=>{d+=(i?"L":"M")+sx(i)+","+sy(v)+" ";});
  const path=document.createElementNS(NS,"path");path.setAttribute("d",d);path.setAttribute("fill","none");
  path.setAttribute("stroke",color);path.setAttribute("stroke-width","2.5");path.setAttribute("stroke-linejoin","round");svg.appendChild(path);
  values.forEach((v,i)=>{const hl=highlight.includes(i);
    const c=document.createElementNS(NS,"circle");c.setAttribute("cx",sx(i));c.setAttribute("cy",sy(v));
    c.setAttribute("r",hl?6:4);c.setAttribute("fill",hl?"#B23A48":color);c.setAttribute("stroke","#fff");c.setAttribute("stroke-width","1.5");svg.appendChild(c);
    const t=document.createElementNS(NS,"text");t.setAttribute("x",sx(i));t.setAttribute("y",sy(v)-10);
    t.setAttribute("text-anchor","middle");t.setAttribute("font-size","9");t.setAttribute("font-weight","700");
    t.setAttribute("fill",hl?"#B23A48":color);t.textContent=v.toFixed(2);svg.appendChild(t);
    const lb=document.createElementNS(NS,"text");lb.setAttribute("x",sx(i));lb.setAttribute("y",H-30);
    lb.setAttribute("text-anchor","middle");lb.setAttribute("font-size","10");lb.setAttribute("fill",hl?"#B23A48":"#4A544E");
    lb.setAttribute("font-weight",hl?"700":"400");lb.textContent=labels[i];svg.appendChild(lb);});
  el.innerHTML="";el.appendChild(svg);
}

// ---------- GAUGE (điểm tổng) ----------
export function gauge(el, { value, max=5, label="", color="#2E7D5B" }) {
  const W=240,H=150,cx=W/2,cy=130,r=90;
  const svg=P({vb:`0 0 ${W} ${H}`});
  const arc=(a1,a2,col,w)=>{const x1=cx+Math.cos(a1)*r,y1=cy+Math.sin(a1)*r,x2=cx+Math.cos(a2)*r,y2=cy+Math.sin(a2)*r;
    const p=document.createElementNS(NS,"path");p.setAttribute("d",`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`);
    p.setAttribute("fill","none");p.setAttribute("stroke",col);p.setAttribute("stroke-width",w);p.setAttribute("stroke-linecap","round");svg.appendChild(p);};
  arc(Math.PI,Math.PI*2,"#E6EFDC",14);
  arc(Math.PI,Math.PI+(Math.PI*value/max),color,14);
  const t=document.createElementNS(NS,"text");t.setAttribute("x",cx);t.setAttribute("y",cy-14);
  t.setAttribute("text-anchor","middle");t.setAttribute("font-size","38");t.setAttribute("font-weight","700");
  t.setAttribute("font-family","'Cormorant Garamond',serif");t.setAttribute("fill",color);t.textContent=value.toFixed(2);svg.appendChild(t);
  const s=document.createElementNS(NS,"text");s.setAttribute("x",cx);s.setAttribute("y",cy+6);
  s.setAttribute("text-anchor","middle");s.setAttribute("font-size","11");s.setAttribute("fill","#8A938D");s.textContent=label;svg.appendChild(s);
  el.innerHTML="";el.appendChild(svg);
}

function legend(series){
  const d=document.createElement("div");d.className="chart-legend";
  d.innerHTML=series.map(s=>`<span class="lg"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("");
  return d;
}
