/*State*/
let currentType = 'single';
let calcDone    = false;
let lastParams  = {};
let autoStepDown = false;   // false = step-up, true = step-down

/*Flux Animation*/
let fluxAnimId = null;
let fluxT      = 0;
let fluxSpeed  = 1.5;
let loadLevel  = 0.5;
let satLevel   = 0.3;

/*Tab Switching*/
function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  const isAuto  = type === 'auto';
  const isThree = type === 'three';

  document.getElementById('turnsSection').style.display      = isAuto  ? 'none'  : 'block';
  document.getElementById('autoSection').style.display       = isAuto  ? 'block' : 'none';
  document.getElementById('threePhaseSection').style.display = isThree ? 'block' : 'none';
}

function switchTab(index) {
  document.querySelectorAll('.tab-panel').forEach((p, i) =>
    p.style.display = i === index ? 'block' : 'none'
  );
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', i === index)
  );

  if (index === 1 && calcDone) {
    requestAnimationFrame(() => {
      drawCircuitDiagram(
        lastParams.Req, lastParams.Xeq,
        lastParams.RL,  lastParams.XL,
        lastParams.a,   lastParams.hasExc,
        lastParams.RC,  lastParams.XM
      );
      drawPhasor(lastParams.VS, lastParams.IS, lastParams.Zeq, lastParams.a);
    });
  }
  if (index === 2) startFluxAnimation();
  else             stopFluxAnimation();
}

function toggleExcitation() {
  const on = document.getElementById('useExcitation').checked;
  document.getElementById('excitationFields').style.display = on ? 'grid' : 'none';
}


function toggleAutoMode() {
  autoStepDown = document.getElementById('autoStepDown').checked;
  const lbl  = document.getElementById('autoModeLabel');
  const info = document.getElementById('autoModeInfo');
  if (autoStepDown) {
    lbl.innerHTML  = 'Step-Down (V<sub>out</sub> &lt; V<sub>in</sub>)';
  } else {
    lbl.innerHTML  = 'Step-Up (V<sub>out</sub> &gt; V<sub>in</sub>)';
  }
  if (info) {
    info.innerHTML = '';
    info.style.display = 'none';
  }
}


/*Complex Math*/
const C = {
  mk:    (re, im=0) => ({re, im}),
  add:   (a,b) => ({re: a.re+b.re, im: a.im+b.im}),
  sub:   (a,b) => ({re: a.re-b.re, im: a.im-b.im}),
  mul:   (a,b) => ({re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re}),
  div:   (a,b) => {
    const d = b.re*b.re + b.im*b.im;
    if (!d) return {re:0, im:0};
    return {re: (a.re*b.re + a.im*b.im)/d, im: (a.im*b.re - a.re*b.im)/d};
  },
  mag:   a => Math.sqrt(a.re*a.re + a.im*a.im),
  ang:   a => Math.atan2(a.im, a.re) * 180/Math.PI,
  scale: (a,k) => ({re: a.re*k, im: a.im*k}),
  par:   (a,b) => C.div(C.mul(a,b), C.add(a,b)),
  fmt:   (a,d=3) => {
    const re = +a.re.toFixed(d), im = +a.im.toFixed(d);
    return `${re} ${im<0?'−':'+'} j${Math.abs(im)}`;
  },
  polar: (a,d=2) => `${C.mag(a).toFixed(d)} ∠ ${C.ang(a).toFixed(1)}°`
};

/*Inputs*/
function getBaseInputs() {
  return {
    VP:  parseFloat(document.getElementById('vp').value)   || 0,
    NP:  parseFloat(document.getElementById('np').value)   || 1,
    NS:  parseFloat(document.getElementById('ns').value)   || 1,
    Req: parseFloat(document.getElementById('req').value)  || 0,
    Xeq: parseFloat(document.getElementById('xeq').value)  || 0,
    RL:  parseFloat(document.getElementById('rl').value)   || 0,
    XL:  parseFloat(document.getElementById('xl').value)   || 0,
    RC:  parseFloat(document.getElementById('rc').value)   || Infinity,
    XM:  parseFloat(document.getElementById('xm').value)   || Infinity,
    useExc: document.getElementById('useExcitation').checked
  };
}


function calculate() {
  try {
    if      (currentType === 'single') calcSingle();
    else if (currentType === 'auto')   calcAuto();
    else                               calcThree();

    calcDone = true;
    document.getElementById('diagrams-placeholder').style.display = 'none';
    document.getElementById('diagrams-content').style.display     = 'block';
  } catch(e) {
    alert('Calculation error: ' + e.message);
    console.error(e);
  }
}

/*Single Phase*/
function calcSingle() {
  const {VP, NP, NS, Req, Xeq, RL, XL, RC, XM, useExc} = getBaseInputs();
  const a      = NP / NS;
  const Zeq    = C.mk(Req, Xeq);
  const ZL_sec = C.mk(RL, XL);
  const ZL_pri = C.scale(ZL_sec, a*a);
  const VP_ph  = C.mk(VP, 0);

  let IP, IS, VS;
  let Ic = C.mk(0), Im_c = C.mk(0), Iexc = C.mk(0);

  if (useExc) {
    Ic   = C.div(VP_ph, C.mk(RC, 0));
    Im_c = C.div(VP_ph, C.mk(0, XM));
    Iexc = C.add(Ic, Im_c);
    const IL_pri = C.div(VP_ph, C.add(Zeq, ZL_pri));
    IP   = C.add(Iexc, IL_pri);
    VS   = C.scale(C.sub(VP_ph, C.mul(IL_pri, Zeq)), 1/a);
    IS   = C.scale(IL_pri, a);
  } else {
    IP = C.div(VP_ph, C.add(Zeq, ZL_pri));
    VS = C.scale(C.sub(VP_ph, C.mul(IP, Zeq)), 1/a);
    IS = C.scale(IP, a);
  }

  const VSmag  = C.mag(VS), VSnl = VP/a;
  const VR     = (VSnl - VSmag) / VSmag * 100;
  const ZL_ang = Math.atan2(ZL_sec.im, ZL_sec.re) * 180/Math.PI;
  const pfType = ZL_sec.im > 0.001 ? 'lagging' : ZL_sec.im < -0.001 ? 'leading' : 'unity';
  const Pout   = C.mag(VS) * C.mag(IS) * Math.cos((C.ang(VS)-C.ang(IS))*Math.PI/180);
  const Pin    = C.mag(VP_ph) * C.mag(IP) * Math.cos(-C.ang(IP)*Math.PI/180);
  const Pcu    = C.mag(IP)*C.mag(IP)*Req;
  const Pcore  = useExc && Ic ? C.mag(Ic)*C.mag(Ic)*RC : 0;
  const eta    = Pin > 0 ? Pout/Pin*100 : 0;

  lastParams = {VP_ph, IP, IS, VS, Zeq, ZL_sec, a, Iexc, Ic, Im_c,
                hasExc: useExc, Req, Xeq, RL, XL, RC, XM};

  const cards = [
    {
      label: 'Primary Current',
      value: C.polar(IP),
      sub: C.fmt(IP, 3) + ' A'
    },
    {
      label: 'Secondary Current',
      value: C.polar(IS),
      sub: C.fmt(IS, 3) + ' A'
    },
    {
      label: 'Secondary Voltage',
      value: VSmag.toFixed(2) + ' V',
      sub: C.polar(VS),
      cls: 'green'
    },
    {
      label: 'Load Power Factor',
      value: Math.cos(ZL_ang * Math.PI / 180).toFixed(4),
      sub: pfType,
      cls: 'yellow'
    },
    {
      label: 'Voltage Regulation',
      value: VR.toFixed(3) + ' %',
      sub: `No-load voltage = ${VSnl.toFixed(2)} V`,
      cls: VR > 0 ? '' : 'yellow'
    },
    {
      label: 'Efficiency',
      value: eta.toFixed(2) + ' %',
      sub: 'Output power compared with input power',
      cls: 'green'
    },
    {
      label: 'Turns Ratio',
      value: a.toFixed(4),
      sub: `${document.getElementById('np').value} : ${document.getElementById('ns').value}`,
      cls: 'purple'
    },
    {
      label: 'Copper Loss',
      value: fmtPowerWatts(Pcu),
      sub: 'Series winding resistance loss',
      cls: 'yellow'
    },
    {
      label: 'Core Loss',
      value: useExc ? fmtPowerWatts(Pcore) : 'Not included',
      sub: useExc ? 'Calculated from core-loss resistance Rc' : 'Enable excitation branch to calculate',
      cls: 'yellow'
    }
  ];

  if (useExc && Iexc) {
    cards.push({
      label: 'Excitation Current',
      value: C.polar(Iexc),
      sub: `Core-loss component: ${C.mag(Ic).toFixed(4)} A · Magnetizing component: ${C.mag(Im_c).toFixed(4)} A`,
      cls: 'purple',
      full: true
    });
  }

  renderResultCards(cards);

  renderPowerTable([
    { name: 'Input Power',  val: fmtPowerWatts(Pin), cls: '' },
    { name: 'Output Power', val: fmtPowerWatts(Pout), cls: 'green' },
    { name: 'Copper Loss',  val: fmtPowerWatts(Pcu), cls: 'yellow' },
    { name: 'Core Loss',    val: fmtPowerWatts(Pcore), cls: 'yellow' },
    { name: 'Total Losses', val: fmtPowerWatts(Pcu + Pcore), cls: 'yellow' },
    { name: 'Efficiency',   val: eta.toFixed(3) + ' %', cls: 'green' }
  ]);
  showResults();
}

/*Autotransformer*/
function calcAuto() {
  const {VP, Req, Xeq, RL, XL, RC, useExc} = getBaseInputs();
  const NC  = parseFloat(document.getElementById('nc').value)  || 1;
  const NSE = parseFloat(document.getElementById('nse').value) || 1;

  // Voltage ratio always (NSE+NC)/NC — step-up: Vin=VL, Vout=VH
  //                                    step-down: Vin=VH, Vout=VL
  const aAuto = (NSE + NC) / NC;   // VH/VL

  const ZL_sec = C.mk(RL, XL);
  const Zeq    = C.mk(Req, Xeq);

  let Pin, Pout, Pcu, eta, VR, IL_in, VOut, IOut, kVA_auto, kVA_wind;
  let VP_ph, IL_ref;

  if (!autoStepDown) {
    // Step-up: input = L side (VP), output = H side
    const ZL_ref = C.scale(ZL_sec, aAuto*aAuto);
    VP_ph  = C.mk(VP, 0);
    IL_ref = C.div(VP_ph, C.add(Zeq, ZL_ref));
    const Vdrop = C.mul(IL_ref, Zeq);
    VOut   = C.scale(C.sub(VP_ph, Vdrop), aAuto);    // referred to H side
    IOut   = C.scale(IL_ref, 1/aAuto);
    const VOutNL = VP * aAuto;
    VR     = (VOutNL - C.mag(VOut)) / C.mag(VOut) * 100;
    IL_in  = IL_ref;
  } else {
    // Step-down: input = H side (VP), output = L side
    const ZL_ref = C.scale(ZL_sec, 1/(aAuto*aAuto)); // referred to H side: ZL*(1/a²)
    VP_ph  = C.mk(VP, 0);
    IL_ref = C.div(VP_ph, C.add(Zeq, ZL_ref));
    const Vdrop = C.mul(IL_ref, Zeq);
    VOut   = C.scale(C.sub(VP_ph, Vdrop), 1/aAuto);
    IOut   = C.scale(IL_ref, aAuto);
    const VOutNL = VP / aAuto;
    VR     = (VOutNL - C.mag(VOut)) / C.mag(VOut) * 100;
    IL_in  = IL_ref;
  }

  const ZL_ang = Math.atan2(ZL_sec.im, ZL_sec.re) * 180/Math.PI;
  const pf     = Math.cos(ZL_ang * Math.PI/180);
  Pout   = C.mag(VOut) * C.mag(IOut) * pf;
  Pcu    = C.mag(IL_ref)*C.mag(IL_ref)*Req;
  Pin    = C.mag(VP_ph) * C.mag(IL_ref) * Math.cos(-C.ang(IL_ref)*Math.PI/180);
  const Pcore = useExc && Number.isFinite(RC) && RC > 0 ? VP*VP/RC : 0;
  const PinTotal = Pin + Pcore;
  eta    = PinTotal > 0 ? Pout/PinTotal*100 : 0;
  kVA_auto = C.mag(VOut)*C.mag(IOut)/1000;
  kVA_wind = kVA_auto * NC/(NC+NSE);

  lastParams = {VP_ph, IP:IL_ref, IS:IOut, VS:VOut, Zeq, ZL_sec,
                a:aAuto, hasExc:useExc, Req, Xeq, RL, XL, RC, XM:Infinity};

  const modeLabel = autoStepDown ? 'Step-Down' : 'Step-Up';

  renderResultCards([
    {
      label: 'Mode',
      value: modeLabel,
      sub: `Voltage ratio ${aAuto.toFixed(4)} : 1`,
      cls: 'purple'
    },
    {
      label: 'Input Voltage',
      value: VP.toFixed(2) + ' V',
      sub: 'Reference voltage'
    },
    {
      label: 'Output Voltage',
      value: C.mag(VOut).toFixed(2) + ' V',
      sub: C.polar(VOut),
      cls: 'green'
    },
    {
      label: 'Input Current',
      value: C.polar(IL_ref),
      sub: C.mag(IL_ref).toFixed(4) + ' A'
    },
    {
      label: 'Output Current',
      value: C.polar(IOut),
      sub: C.mag(IOut).toFixed(4) + ' A'
    },
    {
      label: 'Winding Turns',
      value: `Common = ${NC}, Series = ${NSE}`,
      sub: `Voltage ratio = ${aAuto.toFixed(4)}`,
      cls: 'yellow'
    },
    {
      label: 'Voltage Regulation',
      value: VR.toFixed(3) + ' %',
      sub: 'No-load to full-load voltage change'
    },
    {
      label: 'Efficiency',
      value: eta.toFixed(2) + ' %',
      sub: 'Output power compared with input power',
      cls: 'green'
    },
    {
      label: 'Copper Loss',
      value: fmtPowerWatts(Pcu),
      sub: 'Series equivalent resistance loss',
      cls: 'yellow'
    },
    {
      label: 'Core Loss',
      value: useExc ? fmtPowerWatts(Pcore) : 'Not included',
      sub: useExc ? 'Estimated from Rc using input voltage' : 'Enable excitation branch to calculate',
      cls: 'yellow'
    },
    {
      label: 'Apparent Power Rating',
      value: kVA_auto.toFixed(3) + ' kVA',
      sub: `Power through windings = ${kVA_wind.toFixed(3)} kVA`,
      cls: 'yellow',
      full: true
    }
  ]);

  renderPowerTable([
    { name: 'Input Power',            val: fmtPowerWatts(PinTotal), cls: '' },
    { name: 'Output Power',           val: fmtPowerWatts(Pout), cls: 'green' },
    { name: 'Copper Loss',            val: fmtPowerWatts(Pcu), cls: 'yellow' },
    { name: 'Core Loss',              val: useExc ? fmtPowerWatts(Pcore) : 'Not included', cls: 'yellow' },
    { name: 'Efficiency',             val: eta.toFixed(3) + ' %', cls: 'green' },
    { name: 'Power Through Windings', val: kVA_wind.toFixed(3) + ' kVA', cls: '' },
    { name: 'Power Advantage',        val: (kVA_auto / kVA_wind).toFixed(3), cls: 'yellow' }
  ]);
  showResults();
}

/*Three-phase*/
function calcThree() {
  const {VP, NP, NS, Req, Xeq, RL, XL, RC, useExc} = getBaseInputs();
  const primConn = document.getElementById('primaryConn').value;
  const secConn  = document.getElementById('secondaryConn').value;
  const a        = NP / NS;
  const VphasePri = primConn === 'Y' ? VP/Math.sqrt(3) : VP;

  let aEff = a;
  if (primConn === 'Y' && secConn === 'D') aEff = a * Math.sqrt(3);
  else if (primConn === 'D' && secConn === 'Y') aEff = a / Math.sqrt(3);

  const VP_ph     = C.mk(VphasePri, 0);
  const ZL_sec_ph = C.mk(RL, XL);
  const ZL_pri_ph = C.scale(ZL_sec_ph, aEff*aEff);
  const Zeq       = C.mk(Req, Xeq);
  const IP_ph     = C.div(VP_ph, C.add(Zeq, ZL_pri_ph));
  const VS_ph     = C.scale(C.sub(VP_ph, C.mul(IP_ph, Zeq)), 1/aEff);
  const IS_ph     = C.scale(IP_ph, aEff);

  const VSmag     = C.mag(VS_ph);
  const VSline    = secConn === 'Y' ? VSmag*Math.sqrt(3) : VSmag;
  const VSnl_line = secConn === 'Y' ? VphasePri/aEff*Math.sqrt(3) : VphasePri/aEff;
  const VR        = (VSnl_line - VSline)/VSline*100;
  const ZL_ang    = Math.atan2(ZL_sec_ph.im, ZL_sec_ph.re)*180/Math.PI;
  const pf        = Math.cos(ZL_ang*Math.PI/180);
  const pfType    = ZL_sec_ph.im > 0.001 ? 'lagging' : ZL_sec_ph.im < -0.001 ? 'leading' : 'unity';
  const Pout      = 3*VSmag*C.mag(IS_ph)*pf;
  const Pcu       = 3*C.mag(IP_ph)*C.mag(IP_ph)*Req;
  const Pin       = 3*C.mag(VP_ph)*C.mag(IP_ph)*Math.cos(-C.ang(IP_ph)*Math.PI/180);
  const Pcore     = useExc && Number.isFinite(RC) && RC > 0 ? 3*VphasePri*VphasePri/RC : 0;
  const PinTotal  = Pin + Pcore;
  const eta       = PinTotal > 0 ? Pout/PinTotal*100 : 0;
  const VA3ph     = 3*VSmag*C.mag(IS_ph);

  lastParams = {VP_ph, IP:IP_ph, IS:IS_ph, VS:VS_ph, Zeq, ZL_sec:ZL_sec_ph,
                a:aEff, hasExc:useExc, Req, Xeq, RL, XL, RC, XM:Infinity};

  renderResultCards([
    {
      label: 'Primary Phase Voltage',
      value: VphasePri.toFixed(2) + ' V',
      sub: `Line voltage = ${VP.toFixed(2)} V, ${primConn} connection`
    },
    {
      label: 'Secondary Phase Voltage',
      value: VSmag.toFixed(2) + ' V',
      sub: `Line voltage = ${VSline.toFixed(2)} V, ${secConn} connection`,
      cls: 'green'
    },
    {
      label: 'Primary Phase Current',
      value: C.polar(IP_ph),
      sub: `${primConn} connection`
    },
    {
      label: 'Secondary Phase Current',
      value: C.polar(IS_ph),
      sub: `${secConn} connection`
    },
    {
      label: 'Load Power Factor',
      value: pf.toFixed(4),
      sub: pfType,
      cls: 'yellow'
    },
    {
      label: 'Voltage Regulation',
      value: VR.toFixed(3) + ' %',
      sub: `No-load line voltage = ${VSnl_line.toFixed(2)} V`
    },
    {
      label: 'Efficiency',
      value: eta.toFixed(2) + ' %',
      sub: 'Three-phase output power compared with input power',
      cls: 'green'
    },
    {
      label: 'Copper Loss',
      value: fmtPowerWatts(Pcu),
      sub: 'Total three-phase winding loss',
      cls: 'yellow'
    },
    {
      label: 'Core Loss',
      value: useExc ? fmtPowerWatts(Pcore) : 'Not included',
      sub: useExc ? 'Three-phase core loss estimated from Rc' : 'Enable excitation branch to calculate',
      cls: 'yellow'
    },
    {
      label: 'Three-Phase Apparent Power',
      value: (VA3ph / 1000).toFixed(3) + ' kVA',
      sub: `Connection: ${primConn}-${secConn}`,
      cls: 'purple',
      full: true
    }
  ]);

  renderPowerTable([
    { name: 'Three-Phase Input Power',    val: fmtPowerWatts(PinTotal), cls: '' },
    { name: 'Three-Phase Output Power',   val: fmtPowerWatts(Pout), cls: 'green' },
    { name: 'Three-Phase Copper Loss',    val: fmtPowerWatts(Pcu), cls: 'yellow' },
    { name: 'Core Loss',                  val: useExc ? fmtPowerWatts(Pcore) : 'Not included', cls: 'yellow' },
    { name: 'Per-Phase Copper Loss',      val: fmtPowerWatts(Pcu / 3), cls: '' },
    { name: 'Efficiency',                 val: eta.toFixed(3) + ' %', cls: 'green' },
    { name: 'Three-Phase Apparent Power', val: (VA3ph / 1000).toFixed(3) + ' kVA', cls: 'yellow' }
  ]);
  showResults();
}



function fmtPowerWatts(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return (value / 1000).toFixed(3) + ' kW';
  return value.toFixed(2) + ' W';
}

function renderResultCards(cards) {
  const grid = document.getElementById('resultsGrid');
  grid.innerHTML = '';
  cards.forEach(c => {
    const div = document.createElement('div');
    div.className = 'result-card' + (c.full ? ' full' : '');
    div.innerHTML = `
      <div class="result-label">${c.label}</div>
      <div class="result-value ${c.cls||''}">${c.value}</div>
      ${c.sub ? `<div class="result-sub">${c.sub}</div>` : ''}
    `;
    grid.appendChild(div);
  });
}

function renderPowerTable(rows) {
  document.getElementById('powerSummary').innerHTML = rows.map(r => `
    <div class="power-row">
      <span class="power-name">${r.name}</span>
      <span class="power-val ${r.cls||''}">${r.val}</span>
    </div>
  `).join('');
}

function showResults() {
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display     = 'block';
}


function drawCircuitDiagram(Req, Xeq, RL, XL, a, hasExc, RC, XM) {
  const canvas = document.getElementById('circuitCanvas');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 700;
  const H = 280;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (currentType === 'auto') {
    drawAutoTransformerSchematic(ctx, W, H);
  } else if (currentType === 'three') {
    drawThreePhaseTransformerSchematic(ctx, W, H, hasExc);
  } else {
    drawSinglePhaseTransformerSchematic(ctx, W, H, hasExc);
  }
}

/* ── common schematic helpers ── */
function schWire(ctx, x1, y1, x2, y2, lw = 2) {
  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function schDashedWire(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function schTerminal(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.fillStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function schNode(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function schText(ctx, text, x, y, size = 15, bold = true, align = 'center') {
  ctx.save();
  ctx.fillStyle = '#020617';
  ctx.font = `${bold ? '700' : '500'} ${size}px Inter, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}


function schArrow(ctx, x1, y1, x2, y2, color, label) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * 10 - uy * 5, y2 - uy * 10 + ux * 5);
  ctx.lineTo(x2 - ux * 10 + uy * 5, y2 - uy * 10 - ux * 5);
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = '700 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, y1 - 12);
  }
  ctx.restore();
}


function schResistorH(ctx, x1, x2, y, label, opts = {}) {
  const w = x2 - x1;
  const n = 6;
  const step = w / n;

  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x1, y);

  for (let i = 0; i < n; i++) {
    const x = x1 + step * i;
    ctx.lineTo(x + step * 0.5, i % 2 === 0 ? y - 14 : y + 14);
    ctx.lineTo(x + step, y);
  }

  ctx.stroke();
  ctx.restore();

  const dx = opts.dx || 0;
  const dy = opts.dy || -30;
  const align = opts.align || 'center';
  schText(ctx, label, (x1 + x2) / 2 + dx, y + dy, opts.size || 16, true, align);
}


function schResistorV(ctx, x, y1, y2, label, opts = {}) {
  const h = y2 - y1;
  const n = 6;
  const step = h / n;

  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y1);

  for (let i = 0; i < n; i++) {
    const y = y1 + step * i;
    ctx.lineTo(i % 2 === 0 ? x - 13 : x + 13, y + step * 0.5);
    ctx.lineTo(x, y + step);
  }

  ctx.stroke();
  ctx.restore();

  const dx = opts.dx ?? -34;
  const dy = opts.dy ?? 0;
  const align = opts.align || 'center';
  schText(ctx, label, x + dx, (y1 + y2) / 2 + dy, opts.size || 15, true, align);
}


function schInductorH(ctx, x1, x2, y, label, opts = {}) {
  const loops = 4;
  const w = x2 - x1;
  const r = w / (loops * 2);

  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x1, y);

  for (let i = 0; i < loops; i++) {
    ctx.arc(x1 + r * (2 * i + 1), y, r, Math.PI, 0, false);
  }

  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();

  const dx = opts.dx || 0;
  const dy = opts.dy || -30;
  const align = opts.align || 'center';
  schText(ctx, label, (x1 + x2) / 2 + dx, y + dy, opts.size || 16, true, align);
}


function schInductorV(ctx, x, y1, y2, label, opts = {}) {
  const loops = 4;
  const h = y2 - y1;
  const r = h / (loops * 2);

  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y1);

  for (let i = 0; i < loops; i++) {
    ctx.arc(x, y1 + r * (2 * i + 1), r, -Math.PI / 2, Math.PI / 2, false);
  }

  ctx.lineTo(x, y2);
  ctx.stroke();
  ctx.restore();

  const dx = opts.dx ?? 38;
  const dy = opts.dy ?? 0;
  const align = opts.align || 'center';
  schText(ctx, label, x + dx, (y1 + y2) / 2 + dy, opts.size || 15, true, align);
}


function schTransformerSymbol(ctx, x, yTop, yBot) {
  const h = yBot - yTop;
  const yMid = (yTop + yBot) / 2;
  const coilH = h * 0.58;
  const top = yMid - coilH / 2;
  const bot = yMid + coilH / 2;
  const x1 = x;
  const x2 = x + 34;
  const loops = 4;
  const r = coilH / (loops * 2);

  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;

  ctx.beginPath();
  ctx.moveTo(x1, top);
  for (let i = 0; i < loops; i++) {
    ctx.arc(x1, top + r * (2 * i + 1), r, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.lineTo(x1, bot);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, top);
  for (let i = 0; i < loops; i++) {
    ctx.arc(x2, top + r * (2 * i + 1), r, Math.PI / 2, -Math.PI / 2, true);
  }
  ctx.lineTo(x2, bot);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1 + 12, top - 10);
  ctx.lineTo(x1 + 12, bot + 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1 + 20, top - 10);
  ctx.lineTo(x1 + 20, bot + 10);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(x1 - 10, top + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x2 + 10, top + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  schWire(ctx, x1, yTop, x1, top);
  schWire(ctx, x1, bot, x1, yBot);
  schWire(ctx, x2, yTop, x2, top);
  schWire(ctx, x2, bot, x2, yBot);
}

function schLoadBoxV(ctx, x, yTop, yBot, label = 'ZL', sub = 'Load') {
  const boxW = 58;
  const boxH = Math.max(62, (yBot - yTop) - 40);
  const boxX = x - boxW / 2;
  const boxY = (yTop + yBot) / 2 - boxH / 2;

  schWire(ctx, x, yTop, x, boxY);

  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.fillStyle = '#f8fafc';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  schText(ctx, sub, x, boxY + boxH / 2 - 12, 13, true);
  schText(ctx, label, x, boxY + boxH / 2 + 12, 16, true);

  schWire(ctx, x, boxY + boxH, x, yBot);
}


/* ── 1. Single-phase transformer schematic ── */
function drawSinglePhaseTransformerSchematic(ctx, W, H, hasExc) {
  const y = 102;
  const bot = 220;

  const xIn = 40;
  const xR1a = 110;
  const xR1b = 172;
  const xX1a = 196;
  const xX1b = 266;
  const xNode = 288;
  const xTf = 430;
  const xSec = 510;
  const xJX2b = 584;
  const xR2a = 618;
  const xR2b = 682;
  const xLoad = W - 82;

  schText(ctx, 'Approximate Equivalent Circuit', W / 2, 26, 17);

  schTerminal(ctx, xIn, y);
  schTerminal(ctx, xIn, bot);
  schText(ctx, 'Vᵢₙ', xIn - 10, (y + bot) / 2, 18, true, 'right');

  schWire(ctx, xIn + 5, y, xR1a, y);
  schArrow(ctx, xIn + 20, y - 28, xIn + 58, y - 28, '#ef4444', 'I₁');

  schResistorH(ctx, xR1a, xR1b, y, 'R₁');
  schWire(ctx, xR1b, y, xX1a, y);
  schInductorH(ctx, xX1a, xX1b, y, 'jX₁');
  schWire(ctx, xX1b, y, xNode, y);
  schNode(ctx, xNode, y);

  const branchTop = y + 18;
  const branchBot = bot - 18;
  const rcX = xNode - 44;
  const xmX = xNode + 34;

  schWire(ctx, xNode, y, xNode, branchTop);
  schWire(ctx, xNode, branchTop, rcX, branchTop);
  schWire(ctx, xNode, branchTop, xmX, branchTop);

  if (!hasExc) {
    schDashedWire(ctx, rcX, branchTop, rcX, branchBot);
    schDashedWire(ctx, xmX, branchTop, xmX, branchBot);
  }

  schResistorV(ctx, rcX, branchTop, branchBot, 'R꜀', { dx: -25, align: 'right' });
  schInductorV(ctx, xmX, branchTop, branchBot, 'jXₘ', { dx: 18, dy: 22, align: 'left', size: 14 });

  schWire(ctx, rcX, branchBot, xmX, branchBot);
  schWire(ctx, xNode, branchBot, xNode, bot);
  schNode(ctx, xNode, bot);

  schWire(ctx, xNode, y, xTf, y);
  schTransformerSymbol(ctx, xTf, y, bot);

  schWire(ctx, xTf + 34, y, xSec, y);
  schArrow(ctx, xSec + 4, y - 48, xSec + 50, y - 48, '#d946ef', 'I₂');

  schInductorH(ctx, xSec, xJX2b, y, 'jX₂', { dy: -28, dx: -4 });
  schWire(ctx, xJX2b, y, xR2a, y);
  schResistorH(ctx, xR2a, xR2b, y, 'R₂', { dy: -28, dx: 4 });
  schWire(ctx, xR2b, y, xLoad, y);

  schLoadBoxV(ctx, xLoad, y, bot, 'ZL', 'Load');
  schWire(ctx, xLoad, bot, xIn, bot);
}



/* ── 2. Autotransformer schematic ── */
function drawAutoTransformerSchematic(ctx, W, H) {
  const xW = W * 0.42;
  const yTop = 66;
  const yTap = 146;
  const yBot = 224;
  const xLeft = 62;
  const xRight = W - 90;

  schText(ctx, 'Autotransformer Equivalent Circuit', W / 2, 26, 17);

  // shared winding
  schInductorV(ctx, xW, yTop, yTap - 8, 'Nₛₑ', { dx: -28, align: 'right' });
  schNode(ctx, xW, yTap);
  schInductorV(ctx, xW, yTap + 8, yBot, 'N꜀', { dx: -28, align: 'right' });

  if (!autoStepDown) {
    // STEP-UP: input on common winding, output on full winding
    schTerminal(ctx, xLeft, yTap);
    schTerminal(ctx, xLeft, yBot);
    schWire(ctx, xLeft + 5, yTap, xW, yTap);
    schWire(ctx, xLeft + 5, yBot, xW, yBot);
    schText(ctx, 'Vᵢₙ', xLeft - 12, (yTap + yBot) / 2, 18, true, 'right');
    schArrow(ctx, xLeft + 18, yTap - 28, xLeft + 62, yTap - 28, '#ef4444', 'Iᵢₙ');

    schTerminal(ctx, xRight, yTop);
    schTerminal(ctx, xRight, yBot);
    schWire(ctx, xW, yTop, xRight - 5, yTop);
    schWire(ctx, xW, yBot, xRight - 5, yBot);
    schText(ctx, 'Vₒᵤₜ', xRight + 14, (yTop + yBot) / 2, 18, true, 'left');
    schArrow(ctx, xRight - 68, yTop - 28, xRight - 24, yTop - 28, '#d946ef', 'Iₒᵤₜ');
  } else {
    // STEP-DOWN: input on full winding, output on common winding
    schTerminal(ctx, xLeft, yTop);
    schTerminal(ctx, xLeft, yBot);
    schWire(ctx, xLeft + 5, yTop, xW, yTop);
    schWire(ctx, xLeft + 5, yBot, xW, yBot);
    schText(ctx, 'Vᵢₙ', xLeft - 12, (yTop + yBot) / 2, 18, true, 'right');
    schArrow(ctx, xLeft + 18, yTop - 28, xLeft + 62, yTop - 28, '#ef4444', 'Iᵢₙ');

    schTerminal(ctx, xRight, yTap);
    schTerminal(ctx, xRight, yBot);
    schWire(ctx, xW, yTap, xRight - 5, yTap);
    schWire(ctx, xW, yBot, xRight - 5, yBot);
    schText(ctx, 'Vₒᵤₜ', xRight + 14, (yTap + yBot) / 2, 18, true, 'left');
    schArrow(ctx, xRight - 68, yTap - 28, xRight - 24, yTap - 28, '#d946ef', 'Iₒᵤₜ');
  }

  schText(ctx, 'Series winding', xW - 82, (yTop + yTap) / 2, 12, false, 'right');
  schText(ctx, 'Common winding', xW - 82, (yTap + yBot) / 2, 12, false, 'right');
}


/* ── 3. Three-phase transformer schematic ── */
function drawThreePhaseTransformerSchematic(ctx, W, H, hasExc) {
  const primConn = document.getElementById('primaryConn')?.value || 'Y';
  const secConn = document.getElementById('secondaryConn')?.value || 'Y';

  const y = 112;
  const bot = 220;

  const xIn = 52;
  const xReqA = 140;
  const xReqB = 205;
  const xXeqA = 230;
  const xXeqB = 300;
  const xNode = 340;
  const xLoad = W - 88;

  schText(ctx, '3-Phase Transformer Equivalent Circuit', W / 2, 24, 17);
  schText(ctx, `Per-phase model shown    Primary: ${primConn}    Secondary: ${secConn}`, W / 2, 48, 13, false);

  schText(ctx, '3φ', xIn - 20, y, 20);
  schTerminal(ctx, xIn, y);
  schTerminal(ctx, xIn, bot);

  schWire(ctx, xIn + 5, y, xReqA, y);
  schResistorH(ctx, xReqA, xReqB, y, 'Rₑq');
  schWire(ctx, xReqB, y, xXeqA, y);
  schInductorH(ctx, xXeqA, xXeqB, y, 'jXₑq');
  schWire(ctx, xXeqB, y, xNode, y);
  schNode(ctx, xNode, y);

  const rcX = xNode - 42;
  const xmX = xNode + 38;
  const branchTop = y + 18;
  const branchBot = bot - 18;

  schWire(ctx, xNode, y, xNode, branchTop);
  schWire(ctx, xNode, branchTop, rcX, branchTop);
  schWire(ctx, xNode, branchTop, xmX, branchTop);

  if (!hasExc) {
    schDashedWire(ctx, rcX, branchTop, rcX, branchBot);
    schDashedWire(ctx, xmX, branchTop, xmX, branchBot);
  }

  schResistorV(ctx, rcX, branchTop, branchBot, 'R꜀', { dx: -26, align: 'right' });
  schInductorV(ctx, xmX, branchTop, branchBot, 'jXₘ', { dx: 28, align: 'left' });
  schWire(ctx, rcX, branchBot, xmX, branchBot);
  schWire(ctx, xNode, branchBot, xNode, bot);
  schNode(ctx, xNode, bot);

  schWire(ctx, xNode, y, xLoad, y);
  schLoadBoxV(ctx, xLoad, y, bot, "Z′L", 'Load');
  schWire(ctx, xLoad, bot, xIn, bot);
}



function drawPhasor(VS, IS, Zeq, a) {
  const canvas = document.getElementById('phasorCanvas');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 700;
  const H = 420;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#080b14';
  ctx.fillRect(0, 0, W, H);

  const legendW = 260;
  const plotW = W - legendW - 28;
  const cx = plotW * 0.43;
  const cy = H * 0.54;

  
  const vsAngle = Math.atan2(VS.im, VS.re);
  const rotateBy = (z, ang) => ({
    re: z.re * Math.cos(ang) - z.im * Math.sin(ang),
    im: z.re * Math.sin(ang) + z.im * Math.cos(ang)
  });

  const VS_ref = C.mk(C.mag(VS), 0);
  const IS_ref = rotateBy(IS, -vsAngle);

  const Req_s = Zeq.re / (a * a);
  const Xeq_s = Zeq.im / (a * a);
  const VRdrop = C.mul(C.mk(Req_s, 0), IS_ref);      // parallel to Is
  const VXdrop = C.mul(C.mk(0, Xeq_s), IS_ref);      // 90° anticlockwise from Is
  const VP_sec_true = C.add(VS_ref, C.add(VRdrop, VXdrop));

  
  const baseVoltage = Math.max(C.mag(VS_ref), C.mag(VP_sec_true), 1);
  const maxDrop = Math.max(C.mag(VRdrop), C.mag(VXdrop), 1e-12);
  const dropVisFactor = Math.max(1, Math.min(80, (baseVoltage * 0.13) / maxDrop));

  const VRdrop_vis = C.scale(VRdrop, dropVisFactor);
  const VXdrop_vis = C.scale(VXdrop, dropVisFactor);

  const P0 = C.mk(0, 0);
  const P1 = VS_ref;
  const P2 = C.add(P1, VRdrop_vis);
  const P3 = C.add(P2, VXdrop_vis);

  
  const isMag = Math.max(C.mag(IS_ref), 1e-12);
  const IS_dir = C.scale(IS_ref, baseVoltage * 0.22 / isMag);

  const points = [P0, P1, P2, P3, IS_dir];
  const maxExtent = Math.max(
    ...points.map(p => Math.abs(p.re)),
    ...points.map(p => Math.abs(p.im)),
    1
  );
  const sc = Math.min(plotW * 0.43, H * 0.42) / maxExtent;

  const toXY = z => ({ x: cx + z.re * sc, y: cy - z.im * sc });
  const org = toXY(P0);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 28, 14); ctx.lineTo(cx + i * 28, H - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, cy + i * 28); ctx.lineTo(plotW - 14, cy + i * 28); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(12, cy); ctx.lineTo(plotW - 12, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 12); ctx.lineTo(cx, H - 12); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '700 13px JetBrains Mono, monospace';
  ctx.textAlign = 'right'; ctx.fillText('Re', plotW - 15, cy - 8);
  ctx.textAlign = 'left';  ctx.fillText('Im', cx + 8, 24);

  function drawVec(from, to, color, options = {}) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const ux = dx / len;
    const uy = dy / len;
    const lw = options.lw || 2.4;
    const dash = options.dash || null;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.setLineDash([]);

    const headLen = Math.min(14, len * 0.25);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - ux * headLen - uy * 5, to.y - uy * headLen + ux * 5);
    ctx.lineTo(to.x - ux * headLen + uy * 5, to.y - uy * headLen - ux * 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDot(xy, color, r = 4.3) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#080b14';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(xy.x, xy.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawLabel(text, xy, color, dx = 0, dy = 0, align = 'center') {
    ctx.save();
    ctx.font = '800 17px Inter, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8,11,20,0.92)';
    ctx.strokeText(text, xy.x + dx, xy.y + dy);
    ctx.fillStyle = color;
    ctx.fillText(text, xy.x + dx, xy.y + dy);
    ctx.restore();
  }

  const P1_xy = toXY(P1);
  const P2_xy = toXY(P2);
  const P3_xy = toXY(P3);
  const IS_xy = toXY(IS_dir);

  
  drawVec(org, P1_xy, '#10b981', { lw: 3.0 });   // Vs
  drawVec(org, IS_xy, '#f59e0b', { lw: 2.0 });   // Is
  drawVec(P1_xy, P2_xy, '#60a5fa', { lw: 2.4 }); // ReqIs
  drawVec(P2_xy, P3_xy, '#a78bfa', { lw: 2.4 }); // jXeqIs
  drawVec(org, P3_xy, '#00d4ff', { lw: 3.0 });   // Vp/a

  drawDot(org, 'rgba(255,255,255,0.70)', 4.0);
  drawDot(P1_xy, '#10b981');
  drawDot(P2_xy, '#60a5fa');
  drawDot(P3_xy, '#00d4ff');
  drawDot(IS_xy, '#f59e0b');

  drawLabel('Vₛ', { x: (org.x + P1_xy.x) / 2, y: (org.y + P1_xy.y) / 2 }, '#10b981', 0, 16);
  drawLabel('Iₛ', IS_xy, '#f59e0b', -8, 16, 'right');
  drawLabel('RₑqIₛ', { x: (P1_xy.x + P2_xy.x) / 2, y: (P1_xy.y + P2_xy.y) / 2 }, '#60a5fa', 0, 18);
  drawLabel('jXₑqIₛ', { x: (P2_xy.x + P3_xy.x) / 2, y: (P2_xy.y + P3_xy.y) / 2 }, '#a78bfa', 12, -10, 'left');
  drawLabel('Vₚ/a', P3_xy, '#00d4ff', 8, -18, 'left');

  const theta = Math.atan2(IS_dir.im, IS_dir.re);
  const arcR = 38;
  ctx.save();
  ctx.strokeStyle = 'rgba(245,158,11,0.75)';
  ctx.fillStyle = 'rgba(245,158,11,0.85)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(org.x, org.y, arcR, 0, -theta, theta > 0);
  ctx.stroke();
  ctx.font = '800 15px Inter, sans-serif';
  ctx.fillText('θ', org.x + arcR * 0.72, org.y + (theta < 0 ? 18 : -18));
  ctx.restore();

  const legX = plotW + 20;
  const legY = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(legX - 12, legY - 12, legendW - 10, 314, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.font = '800 16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PHASOR LEGEND', legX, legY + 5);

  const rows = [
    ['#10b981', 'Vₛ reference', `${C.mag(VS).toFixed(2)} V ∠ 0°`],
    ['#f59e0b', 'Iₛ', `${C.mag(IS).toFixed(4)} A ∠ ${(C.ang(IS) - C.ang(VS)).toFixed(1)}°`],
    ['#60a5fa', 'RₑqIₛ', `${C.mag(VRdrop).toFixed(3)} V`],
    ['#a78bfa', 'jXₑqIₛ', `${C.mag(VXdrop).toFixed(3)} V`],
    ['#00d4ff', 'Vₚ/a', `${C.mag(VP_sec_true).toFixed(2)} V`]
  ];

  rows.forEach((r, i) => {
    const y = legY + 42 + i * 52;
    ctx.strokeStyle = r[0];
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(legX, y); ctx.lineTo(legX + 34, y); ctx.stroke();
    drawDot({ x: legX + 41, y }, r[0], 3.7);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '800 14px Inter, sans-serif';
    ctx.fillText(r[1], legX, y + 20);

    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.font = '700 13px JetBrains Mono, monospace';
    ctx.fillText(r[2], legX, y + 39);
  });
}



function updateFluxParams() {
  fluxSpeed = parseFloat(document.getElementById('fluxSpeed').value);
  loadLevel = parseFloat(document.getElementById('loadLevel').value);
  satLevel  = parseFloat(document.getElementById('satLevel').value);
  document.getElementById('fluxSpeedVal').textContent = fluxSpeed.toFixed(1)+'×';
  document.getElementById('loadLevelVal').textContent  = (loadLevel*100).toFixed(0)+'%';
  document.getElementById('satLevelVal').textContent   = (satLevel*100).toFixed(0)+'%';
  updateFluxStats();
}

function updateFluxStats() {
  const inp  = getBaseInputs();
  const a    = inp.NP / inp.NS;
  const f    = parseFloat(document.getElementById('freq').value) || 60;
  const fSafe = Math.max(Math.abs(f), 0.001);
  const npSafe = Math.max(inp.NP, 1);

 
  const pkMutual = (inp.VP / (4.44 * fSafe * npSafe) * (1 + satLevel * 0.8)).toFixed(5);
  const pkLeak1  = (inp.Xeq / Math.max(inp.NP,1) * loadLevel * 0.0001).toFixed(6);
  const pkLeak2  = (inp.Xeq / Math.max(inp.NS,1) * loadLevel * 0.0001 / (a||1)).toFixed(6);

  const stats = [
    {label:'Frequency',              value:fSafe.toFixed(2)+' Hz', color:'#00d4ff'},
    {label:'Peak Mutual Flux Φ_m',   value:pkMutual+' Wb', color:'#00d4ff'},
    {label:'Primary Leakage Φ_l1',   value:pkLeak1+' Wb',  color:'#f59e0b'},
    {label:'Secondary Leakage Φ_l2', value:pkLeak2+' Wb',  color:'#a78bfa'},
    {label:'Load Level',             value:(loadLevel*100).toFixed(0)+'%', color:'#10b981'},
    {label:'Saturation Index',       value:(satLevel*100).toFixed(0)+'%',  color:'#f87171'},
  ];
  document.getElementById('fluxStats').innerHTML = stats.map(s => `
    <div class="flux-stat-card">
      <div class="flux-stat-label">${s.label}</div>
      <div class="flux-stat-value" style="color:${s.color}">${s.value}</div>
    </div>
  `).join('');
}

function startFluxAnimation() {
  stopFluxAnimation();
  updateFluxStats();
  fluxT = 0;
  (function loop() {
    fluxT += 0.016 * fluxSpeed;
    _drawFluxFrame(fluxT, loadLevel, satLevel);
    fluxAnimId = requestAnimationFrame(loop);
  })();
}

function stopFluxAnimation() {
  if (fluxAnimId !== null) { cancelAnimationFrame(fluxAnimId); fluxAnimId = null; }
}

function _drawFluxFrame(t, load, sat) {
  const canvas = document.getElementById('fluxCanvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 680, H = 400;
  if (canvas.width !== W*dpr || canvas.height !== H*dpr) {
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#080b14'; ctx.fillRect(0,0,W,H);

  const coreW=W*0.60, coreH=H*0.28;
  const coreX=(W-coreW)/2, coreY=H*0.09;
  const thick=Math.max(28, coreH*0.24);
  const wrapW=W*0.1, wrapH=coreH*0.64;
  const wrapY=coreY+(coreH-wrapH)/2;
  const priX=coreX+thick*0.22;
  const secX=coreX+coreW-thick*0.22-wrapW;
  const midY=coreY+coreH/2;

  const inp = getBaseInputs();
  const f = parseFloat(document.getElementById('freq').value) || 60;
  const fSafe = Math.max(Math.abs(f), 0.001);
  const fluxRatio = Math.max(0.35, Math.min(2.4, 60 / fSafe));
  const satVisual = Math.min(1, sat + Math.max(0, fluxRatio - 1) * 0.35);
  const fluxVisual = Math.max(0.35, Math.min(1.7, fluxRatio));

  // Saturation glow. Lower frequency increases flux for the same voltage and turns.
  if (satVisual > 0.05) {
    ctx.save();
    const sg=ctx.createRadialGradient(W/2,midY,10,W/2,midY,coreW*0.55);
    sg.addColorStop(0,`rgba(248,113,113,${satVisual*0.16})`); sg.addColorStop(1,'transparent');
    ctx.fillStyle=sg; ctx.fillRect(coreX,coreY,coreW,coreH); ctx.restore();
  }

  // Core (E-I)
  ctx.fillStyle='#15202e'; ctx.strokeStyle='#2a3f6a'; ctx.lineWidth=1.5; ctx.setLineDash([]);
  [[coreX,coreY,thick,coreH],[coreX+coreW-thick,coreY,thick,coreH],
   [coreX,coreY,coreW,thick],[coreX,coreY+coreH-thick,coreW,thick]].forEach(([x,y,w,h])=>{
    ctx.beginPath(); ctx.roundRect(x,y,w,h,5); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.font='bold 11px Inter, sans-serif'; ctx.textAlign='center';
  ctx.fillText('IRON CORE', W/2, midY+5);

  // Windings
  const drawCoil=(x,y,w,h,color,turns)=>{
    const sy=h/turns; ctx.strokeStyle=color; ctx.lineWidth=2.2; ctx.setLineDash([]);
    for (let i=0;i<turns;i++){
      const yt=y+i*sy+sy*0.12, yb=y+i*sy+sy*0.88;
      ctx.beginPath(); ctx.moveTo(x+2,yt); ctx.bezierCurveTo(x-11,yt,x-11,yb,x+2,yb); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w-2,yt); ctx.bezierCurveTo(x+w+11,yt,x+w+11,yb,x+w-2,yb); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+2,yt); ctx.lineTo(x+w-2,yt); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+2,yb); ctx.lineTo(x+w-2,yb); ctx.stroke();
    }
  };
  drawCoil(priX,wrapY,wrapW,wrapH,'#f59e0b',8);
  drawCoil(secX,wrapY,wrapW,wrapH,'#a78bfa',6);

  ctx.textAlign='center';
  ctx.fillStyle='#f59e0b'; ctx.font='bold 12px Inter, sans-serif';
  ctx.fillText('Primary', priX+wrapW/2, wrapY-12);
  ctx.fillStyle='rgba(245,158,11,0.5)'; ctx.font='10px JetBrains Mono, monospace';
  ctx.fillText('Nₚ='+document.getElementById('np').value, priX+wrapW/2, wrapY-24);
  ctx.fillStyle='#a78bfa'; ctx.font='bold 12px Inter, sans-serif';
  ctx.fillText('Secondary', secX+wrapW/2, wrapY-12);
  ctx.fillStyle='rgba(167,139,250,0.5)'; ctx.font='10px JetBrains Mono, monospace';
  ctx.fillText('Nₛ='+document.getElementById('ns').value, secX+wrapW/2, wrapY-24);
  ctx.textAlign='left';

  // Mutual flux lines
  const nMutual=12, mutAmp=fluxVisual*(1+sat*0.55);
  const coreInX=coreX+thick, coreInW=coreW-2*thick;
  ctx.setLineDash([5,5]);
  for (let i=0;i<nMutual;i++){
    const ph=i/nMutual*Math.PI*2;
    const rawY=midY+Math.sin(t+ph)*(coreH*0.5-thick*1.3)*mutAmp*(1/(1+satVisual*1.3));
    const cy2=Math.max(coreY+thick+3,Math.min(coreY+coreH-thick-3,rawY));
    const alpha=(0.28+0.55*Math.abs(Math.sin(t+ph)))*Math.min(1.15,0.72+fluxVisual*0.28);
    ctx.strokeStyle=`rgba(0,212,255,${Math.min(alpha*0.85,0.95)})`; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(coreInX+5,cy2);
    ctx.bezierCurveTo(W/2-20,cy2-16*Math.sin(t+ph),W/2+20,cy2+16*Math.sin(t+ph),coreInX+coreInW-5,cy2);
    ctx.stroke();
    const px=coreInX+5+((t*52+i/nMutual*coreInW)%coreInW);
    if (px>coreInX&&px<coreInX+coreInW){
      ctx.setLineDash([]);
      ctx.fillStyle=`rgba(0,212,255,${alpha+0.15})`; ctx.beginPath(); ctx.arc(px,cy2,3.5,0,2*Math.PI); ctx.fill();
      ctx.setLineDash([5,5]);
    }
  }
  ctx.setLineDash([]);

  // Primary leakage
  const nLeak=7; ctx.setLineDash([2,4]);
  for (let i=0;i<nLeak;i++){
    const ph=i/nLeak*Math.PI*2, prog=(t*0.7+i/nLeak)%1;
    const leakR=14+i*7+load*22, leakX=priX-16+Math.sin(t*2+ph)*3;
    const alpha=load*0.65*(0.4+0.5*Math.abs(Math.sin(t*2.5+ph)));
    ctx.strokeStyle=`rgba(245,158,11,${alpha})`; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(leakX,midY,leakR,Math.PI*0.28,Math.PI*1.72); ctx.stroke();
    const ang=Math.PI*0.28+Math.PI*1.44*prog;
    ctx.setLineDash([]);
    ctx.fillStyle=`rgba(245,158,11,${alpha+0.25})`; ctx.beginPath(); ctx.arc(leakX+Math.cos(ang)*leakR,midY+Math.sin(ang)*leakR,3,0,2*Math.PI); ctx.fill();
    ctx.setLineDash([2,4]);
  }
  for (let i=0;i<nLeak;i++){
    const ph=i/nLeak*Math.PI*2+Math.PI, prog=(t*0.7+i/nLeak+0.5)%1;
    const leakR=14+i*7+load*22, leakX=secX+wrapW+16+Math.sin(t*2+ph)*3;
    const alpha=load*0.55*(0.4+0.5*Math.abs(Math.sin(t*2.5+ph)));
    ctx.strokeStyle=`rgba(167,139,250,${alpha})`; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(leakX,midY,leakR,Math.PI*(-0.22),Math.PI*1.22,true); ctx.stroke();
    const ang=Math.PI*1.22-Math.PI*1.44*prog;
    ctx.setLineDash([]);
    ctx.fillStyle=`rgba(167,139,250,${alpha+0.25})`; ctx.beginPath(); ctx.arc(leakX+Math.cos(ang)*leakR,midY+Math.sin(ang)*leakR,3,0,2*Math.PI); ctx.fill();
    ctx.setLineDash([2,4]);
  }
  ctx.setLineDash([]);

  // B density bar
  const barX=W-22,barY=coreY,barH=coreH,barW=10;
  ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(barX,barY,barW,barH);
  const bGrad=ctx.createLinearGradient(0,barY,0,barY+barH);
  bGrad.addColorStop(0,'#f87171'); bGrad.addColorStop(0.5,'#00d4ff'); bGrad.addColorStop(1,'#f87171');
  const fillH2=barH*Math.min(1, (0.22+satVisual*0.58+Math.max(0, fluxRatio-1)*0.25))*Math.abs(Math.sin(t));
  ctx.fillStyle=bGrad; ctx.fillRect(barX,barY+barH/2-fillH2/2,barW,fillH2);
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.strokeRect(barX,barY,barW,barH);
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='9px JetBrains Mono, monospace';
  ctx.textAlign='center'; ctx.fillText('B',barX+barW/2,barY-5); ctx.textAlign='left';

  // Waveform panel
  const panY=coreY+coreH+24, panH=H-panY-14, panX=32, panW=W-58;
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(panX,panY+panH/2); ctx.lineTo(panX+panW,panY+panH/2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.font='bold 10px Inter, sans-serif';
  ctx.fillText('EMF & Flux waveforms', panX, panY+11);
  ctx.font='9px JetBrains Mono, monospace'; ctx.fillStyle='rgba(255,255,255,0.2)';
  ctx.textAlign='right'; ctx.fillText('ωt →', panX+panW, panY+panH/2-5); ctx.textAlign='left';

  const plotWave=(color,fn)=>{
    ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.setLineDash([]);
    ctx.beginPath();
    for (let i=0;i<180;i++){
      const wt=t-(i/180)*4*Math.PI;
      const x2=panX+(i/180)*panW;
      const y2=panY+panH/2-fn(wt)*(panH*0.4);
      i===0?ctx.moveTo(x2,y2):ctx.lineTo(x2,y2);
    }
    ctx.stroke();
  };
  plotWave('rgba(0,212,255,0.9)',  wt=>Math.sin(wt)*fluxVisual*(1+sat*0.45*Math.sin(2*wt)));
  plotWave('rgba(245,158,11,0.7)', wt=>Math.sin(wt+0.15)*load*0.36);
  plotWave('rgba(167,139,250,0.7)',wt=>Math.sin(wt-0.10)*load*0.28);
  plotWave('rgba(16,185,129,0.9)', wt=>Math.sin(wt)*fluxVisual*(1+sat*0.22*Math.sin(2*wt))-Math.sin(wt+0.15)*load*0.36);

  const curX=panX+(t%(4*Math.PI))/(4*Math.PI)*panW%panW;
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(curX,panY+4); ctx.lineTo(curX,panY+panH-4); ctx.stroke(); ctx.setLineDash([]);

  ctx.font='9px JetBrains Mono, monospace';
  [['rgba(0,212,255,0.9)','Φ_m mutual'],['rgba(245,158,11,0.7)','Φ_l1 pri leakage'],
   ['rgba(167,139,250,0.7)','Φ_l2 sec leakage'],['rgba(16,185,129,0.9)','e resultant EMF']
  ].forEach((l,i)=>{
    ctx.fillStyle=l[0]; ctx.textAlign='right';
    ctx.fillText(l[1], panX+panW, panY+11+i*13);
  });
  ctx.textAlign='left';
}


window.addEventListener('load', () => {
  calculate();
  updateFluxStats();
});

window.addEventListener('resize', () => {
  if (!calcDone) return;
  const active = [...document.querySelectorAll('.tab')].findIndex(t=>t.classList.contains('active'));
  if (active === 1) {
    drawCircuitDiagram(lastParams.Req,lastParams.Xeq,lastParams.RL,lastParams.XL,lastParams.a,lastParams.hasExc,lastParams.RC,lastParams.XM);
    drawPhasor(lastParams.VS,lastParams.IS,lastParams.Zeq,lastParams.a);
  }
});