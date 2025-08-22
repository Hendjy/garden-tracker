// page-arrosage.js — WeatherCard (Leaflet + Chart.js) + calendrier
const C = window.GardenCore;

/* ===== WeatherCard (même version que page-index.js) ===== */
function WeatherCard(){
  const [lat, setLat] = React.useState(C.db.weather.lat ?? 48.8566);
  const [lon, setLon] = React.useState(C.db.weather.lon ?? 2.3522);
  const [pastDays, setPastDays] = React.useState(14);
  const [nextDays, setNextDays] = React.useState(7);
  const [addr, setAddr] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [past, setPast] = React.useState([]); const [forecast, setForecast] = React.useState([]);
  const mapRef = React.useRef(null); const markerRef = React.useRef(null);
  const chartCanvasRef = React.useRef(null); const chartInstanceRef = React.useRef(null);

  const iso=(d)=>d.toISOString().slice(0,10);
  async function geocodeAddress(address){ const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`; const r=await fetch(url); const d=await r.json(); if(!d.length) throw new Error("Adresse introuvable"); return {lat:Number(d[0].lat), lon:Number(d[0].lon)}; }
  async function fetchPluv(la,lo,p,n){ const start=new Date(Date.now()-(p-1)*86400000); const end=new Date(Date.now()+n*86400000); const url=`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&start_date=${iso(start)}&end_date=${iso(end)}&daily=precipitation_sum&timezone=auto`; const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); const j=await r.json(); const all=(j?.daily?.time||[]).map((t,i)=>({date:t,rain_mm:Number(j.daily.precipitation_sum[i]||0)})); const today=iso(new Date()); return {past:all.filter(x=>x.date<=today), forecast:all.filter(x=>x.date>today)}; }
  function save(lat,lon){ C.db.weather.lat=lat; C.db.weather.lon=lon; C.save(C.db); }

  React.useEffect(()=>{ if(!window.L||mapRef.current) return; const map=L.map('weather-map', {zoomControl:true}).setView([lat,lon],11); mapRef.current=map; L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map); markerRef.current=L.marker([lat,lon]).addTo(map); map.on('click',(e)=>{ const {lat:la,lng:lo}=e.latlng; markerRef.current.setLatLng([la,lo]); setLat(la); setLon(lo); save(la,lo); reload(la,lo,pastDays,nextDays); }); },[]);
  React.useEffect(()=>{ if(mapRef.current&&markerRef.current){ markerRef.current.setLatLng([lat,lon]); mapRef.current.setView([lat,lon], mapRef.current.getZoom()); }},[lat,lon]);

  function buildChart(pastArr, foreArr){ const ctx=chartCanvasRef.current.getContext('2d'); if(chartInstanceRef.current){ chartInstanceRef.current.destroy(); chartInstanceRef.current=null; }
    const labels=[...pastArr.map(d=>d.date), ...foreArr.map(d=>d.date)];
    const pastData=[...pastArr.map(d=>d.rain_mm), ...foreArr.map(_=>0)];
    const forecastData=[...pastArr.map(_=>0), ...foreArr.map(d=>d.rain_mm)];
    const splitIndex=pastArr.length-1;
    chartInstanceRef.current=new Chart(ctx,{ type:'bar', data:{ labels, datasets:[ {label:'Passé (mm)', data:pastData, backgroundColor:'rgba(16,185,129,.75)'}, {label:'Prévision (mm)', data:forecastData, backgroundColor:'rgba(59,130,246,.75)'} ] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}, tooltip:{mode:'index', intersect:false}}, scales:{ x:{ticks:{maxRotation:0,autoSkip:true}}, y:{beginAtZero:true, title:{display:true,text:'mm'}} }, pluginsCustomLine:{index:splitIndex}}, plugins:[{ id:'pluginsCustomLine', afterDraw(chart,_a,opts){ const i=opts.index; if(i<0) return; const x=chart.scales.x.getPixelForValue(i); const ctx=chart.ctx; ctx.save(); ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x,chart.chartArea.top); ctx.lineTo(x,chart.chartArea.bottom); ctx.stroke(); ctx.restore(); } }] }); }

  async function reload(la=lat,lo=lon,p=pastDays,n=nextDays){ setLoading(true); setError(null); try{ const d=await fetchPluv(la,lo,p,n); setPast(d.past); setForecast(d.forecast); buildChart(d.past.slice(-p), d.forecast.slice(0,n)); }catch(e){ setError(e.message||String(e)); } setLoading(false); }
  React.useEffect(()=>{ reload(); },[]);
  async function search(){ if(!addr.trim()) return; setLoading(true); setError(null); try{ const {lat:la,lon:lo}=await geocodeAddress(addr.trim()); setLat(la); setLon(lo); save(la,lo); await reload(la,lo,pastDays,nextDays);}catch(e){ setError(e.message||String(e)); setLoading(false);} }
  function useGps(){ if(!navigator.geolocation){ setError("Géolocalisation non dispo"); return; } setLoading(true); setError(null);
    navigator.geolocation.getCurrentPosition(async pos=>{ const la=pos.coords.latitude,lo=pos.coords.longitude; setLat(la); setLon(lo); save(la,lo); await reload(la,lo,pastDays,nextDays); }, err=>{ setError(err.message||"Position indisponible"); setLoading(false); }, {enableHighAccuracy:true, timeout:10000}); }

  const sum=arr=>arr.reduce((s,x)=>s+(Number(x.rain_mm)||0),0);

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="border rounded px-2 py-1 flex-1 min-w-[180px]" placeholder="Adresse (ex: Melun, France)" value={addr} onChange={e=>setAddr(e.target.value)}/>
        <button className="px-3 py-1.5 rounded border" onClick={search} disabled={loading}>Rechercher</button>
        <button className="px-3 py-1.5 rounded border" onClick={useGps} disabled={loading}>📍 Ma position</button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label>Passé (j)<input type="number" min="1" max="60" className="w-16 ml-1 border rounded px-2 py-1" value={pastDays} onChange={e=>{const v=Number(e.target.value)||14; setPastDays(v); reload(lat,lon,v,nextDays);}}/></label>
          <label>Prévision (j)<input type="number" min="0" max="16" className="w-16 ml-1 border rounded px-2 py-1" value={nextDays} onChange={e=>{const v=Number(e.target.value)||7; setNextDays(v); reload(lat,lon,pastDays,v);}}/></label>
          <button className="px-3 py-1.5 rounded bg-slate-900 text-white" onClick={()=>reload()} disabled={loading}>{loading?"…":"Actualiser"}</button>
        </div>
      </div>

      <div id="weather-map" className="rounded-xl overflow-hidden border mt-3" style={{height: 300}}></div>
      {error && <p className="text-sm text-red-600 mt-2">Erreur: {error}</p>}

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold">Pluie (passé & prévisions)</h4>
          <div className="text-xs text-slate-500">Σ passé: {sum(past).toFixed(1)} mm · Σ prévisions: {sum(forecast).toFixed(1)} mm</div>
        </div>
        <div className="h-56 md:h-64"><canvas ref={chartCanvasRef}></canvas></div>
      </div>
    </div>
  );
}
/* ===== fin WeatherCard ===== */

function ArrosagePage(){
  const [month, setMonth] = React.useState(new Date());
  const [selectedPlantId, setSelectedPlantId] = React.useState(Object.keys(C.db.plants)[0] || null);
  const [, setTick] = React.useState(0);
  function refresh(){ setTick(t=>t+1); }

  const grid = buildMonthGrid(month);
  function prevMonth(){ const m=new Date(month); m.setMonth(m.getMonth()-1); setMonth(m); }
  function nextMonth(){ const m=new Date(month); m.setMonth(m.getMonth()+1); setMonth(m); }

  return (
    <div className="space-y-4">
      <WeatherCard/>
      <section className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <button className="px-2 py-1 border rounded" onClick={prevMonth}>←</button>
          <div className="font-semibold">{month.toLocaleString('fr-FR',{month:'long', year:'numeric'})}</div>
          <button className="px-2 py-1 border rounded" onClick={nextMonth}>→</button>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={selectedPlantId||""} onChange={(e)=>setSelectedPlantId(e.target.value||null)}>
            <option value="">— choisir un plant —</option>
            {Object.values(C.db.plants).map(p=><option key={p.id} value={p.id}>{p.name}{p.variety?` – ${p.variety}`:""}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=><div key={d} className="text-xs text-slate-500 text-center">{d}</div>)}
          {grid.map((cell, idx)=>{
            const d = cell.date;
            return (
              <div key={idx} className={`p-2 border rounded ${cell.inMonth?"bg-white":"bg-slate-50/50"} flex flex-col gap-1`}>
                <div className="text-xs text-slate-500">{d.slice(8,10)}</div>
                {selectedPlantId && (
                  <button className="mt-auto text-xs px-2 py-1 border rounded"
                          onClick={()=>{ const liters = Number(prompt("Litres", "1"))||0; if (liters>0) { C.addWatering(selectedPlantId, { date: d, amountL: liters, notes: "" }); refresh(); } }}>
                    + Arrosage
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {selectedPlantId && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Journal – {C.db.plants[selectedPlantId]?.name}</h4>
            <table className="text-sm w-full">
              <thead><tr><th className="text-left p-2">Date</th><th className="text-right p-2">Litres</th><th className="text-left p-2">Notes</th></tr></thead>
              <tbody>
                {(C.db.plants[selectedPlantId]?.waterings||[]).map(w=>(
                  <tr key={w.id} className="border-t">
                    <td className="p-2">{w.date}</td>
                    <td className="p-2 text-right">{w.amountL}</td>
                    <td className="p-2">{w.notes||""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function buildMonthGrid(refDate){
  const first=new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const startIdx=(first.getDay()+6)%7; const daysInMonth=new Date(refDate.getFullYear(), refDate.getMonth()+1, 0).getDate();
  const prevDays=new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();
  const cells=[];
  for(let i=0;i<startIdx;i++){ const d=prevDays-startIdx+1+i; const date=new Date(refDate.getFullYear(), refDate.getMonth()-1, d).toISOString().slice(0,10); cells.push({date,inMonth:false}); }
  for(let d=1; d<=daysInMonth; d++){ const date=new Date(refDate.getFullYear(), refDate.getMonth(), d).toISOString().slice(0,10); cells.push({date,inMonth:true}); }
  while(cells.length<42){ const last=new Date(cells[cells.length-1].date); last.setDate(last.getDate()+1); cells.push({date:last.toISOString().slice(0,10), inMonth:false}); }
  return cells;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ArrosagePage />);