const C = window.GardenCore;

// Composant météo dédié (par PARCELLE)
function WeatherPage(){
  const [, setTick] = React.useState(0);
  function refresh(){ setTick(t=>t+1); }

  const [parcelId, setParcelId] = React.useState(C.db.currentParcelId);
  const parcel = C.db.parcels[parcelId];

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Parcelle :</h3>
          <select className="border rounded px-2 py-1" value={parcelId} onChange={(e)=>{ setParcelId(e.target.value); C.setCurrentParcel(e.target.value); refresh(); }}>
            {Object.values(C.db.parcels).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="text-sm ml-2 text-slate-500">Coord.: {parcel.lat.toFixed(4)}, {parcel.lon.toFixed(4)}</div>
        </div>
      </section>

      <WeatherCardForParcel parcelId={parcelId} onLocationChange={()=>refresh()} />
    </div>
  );
}

function WeatherCardForParcel({ parcelId, onLocationChange }){
  const par = C.db.parcels[parcelId];
  const [lat, setLat] = React.useState(par.lat);
  const [lon, setLon] = React.useState(par.lon);
  const [pastDays, setPastDays] = React.useState(14);
  const [nextDays, setNextDays] = React.useState(7);
  const [addr, setAddr] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [past, setPast] = React.useState([]); const [forecast, setForecast] = React.useState([]);

  const mapRef = React.useRef(null); const markerRef = React.useRef(null);
  const chartCanvasRef = React.useRef(null); const chartInstanceRef = React.useRef(null);

  const iso=(d)=>d.toISOString().slice(0,10);

  async function geocodeAddress(address){
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const r = await fetch(url); const d = await r.json();
    if(!d.length) throw new Error("Adresse introuvable");
    return { lat: Number(d[0].lat), lon: Number(d[0].lon) };
  }
  async function fetchPluv(la,lo,p,n){
    const start=new Date(Date.now()-(p-1)*86400000);
    const end=new Date(Date.now()+n*86400000);
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&start_date=${iso(start)}&end_date=${iso(end)}&daily=precipitation_sum&timezone=auto`;
    const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status);
    const j=await r.json();
    const all=(j?.daily?.time||[]).map((t,i)=>({date:t, rain_mm:Number(j.daily.precipitation_sum[i]||0)}));
    const today=iso(new Date()); return { past: all.filter(x=>x.date<=today), forecast: all.filter(x=>x.date>today) };
  }

  // Leaflet
  React.useEffect(()=>{ if(!window.L||mapRef.current) return;
    const map=L.map('weather-map', {zoomControl:true}).setView([lat,lon],11); mapRef.current=map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
    markerRef.current=L.marker([lat,lon]).addTo(map);
    map.on('click',(e)=>{ const {lat:la,lng:lo}=e.latlng; markerRef.current.setLatLng([la,lo]); setLat(la); setLon(lo); C.setParcelLocation(par.id, la, lo); onLocationChange?.(); reload(la,lo,pastDays,nextDays); });
  },[]);
  React.useEffect(()=>{ if(mapRef.current&&markerRef.current){ markerRef.current.setLatLng([lat,lon]); mapRef.current.setView([lat,lon], mapRef.current.getZoom()); }},[lat,lon]);

  // Chart
  function buildChart(pastArr, foreArr){
    const ctx=chartCanvasRef.current.getContext('2d');
    if(chartInstanceRef.current){ chartInstanceRef.current.destroy(); chartInstanceRef.current=null; }
    const labels=[...pastArr.map(d=>d.date), ...foreArr.map(d=>d.date)];
    const pastData=[...pastArr.map(d=>d.rain_mm), ...foreArr.map(_=>0)];
    const forecastData=[...pastArr.map(_=>0), ...foreArr.map(d=>d.rain_mm)];
    const splitIndex=pastArr.length-1;
    chartInstanceRef.current=new Chart(ctx,{
      type:'bar',
      data:{ labels, datasets:[
        {label:'Passé (mm)', data:pastData, backgroundColor:'rgba(16,185,129,.75)'},
        {label:'Prévision (mm)', data:forecastData, backgroundColor:'rgba(59,130,246,.75)'}
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}, tooltip:{mode:'index', intersect:false}},
        scales:{ x:{ticks:{maxRotation:0,autoSkip:true}}, y:{beginAtZero:true, title:{display:true, text:'mm'}} },
        pluginsCustomLine:{index:splitIndex}
      },
      plugins:[{id:'pluginsCustomLine', afterDraw(chart,_a,opts){ const i=opts.index; if(i<0) return; const x=chart.scales.x.getPixelForValue(i); const ctx=chart.ctx; ctx.save(); ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x,chart.chartArea.top); ctx.lineTo(x,chart.chartArea.bottom); ctx.stroke(); ctx.restore(); }}]
    });
  }

  async function reload(la=lat,lo=lon,p=pastDays,n=nextDays){
    setLoading(true); setError(null);
    try{ const d=await fetchPluv(la,lo,p,n); setPast(d.past); setForecast(d.forecast); buildChart(d.past.slice(-p), d.forecast.slice(0,n)); }
    catch(e){ setError(e.message||String(e)); }
    setLoading(false);
  }

  React.useEffect(()=>{ reload(); },[]);

  async function search(){ if(!addr.trim()) return; setLoading(true); setError(null);
    try{ const {lat:la, lon:lo} = await geocodeAddress(addr.trim());
      setLat(la); setLon(lo); C.setParcelLocation(par.id, la, lo); onLocationChange?.();
      await reload(la,lo,pastDays,nextDays);
    }catch(e){ setError(e.message||String(e)); setLoading(false); }
  }

  const sum=arr=>arr.reduce((s,x)=>s+(Number(x.rain_mm)||0),0);

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="border rounded px-2 py-1 flex-1 min-w-[200px]" placeholder="Adresse (ex: Melun, France)" value={addr} onChange={e=>setAddr(e.target.value)}/>
        <button className="px-3 py-1.5 rounded border" onClick={search} disabled={loading}>Rechercher</button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label>Passé (j)<input type="number" min="1" max="60" className="w-16 ml-1 border rounded px-2 py-1" value={pastDays} onChange={e=>{const v=Number(e.target.value)||14; setPastDays(v); reload(lat,lon,v,nextDays);}}/></label>
          <label>Prévision (j)<input type="number" min="0" max="16" className="w-16 ml-1 border rounded px-2 py-1" value={nextDays} onChange={e=>{const v=Number(e.target.value)||7; setNextDays(v); reload(lat,lon,pastDays,v);}}/></label>
          <button className="px-3 py-1.5 rounded bg-slate-900 text-white" onClick={()=>reload()} disabled={loading}>{loading?"…":"Actualiser"}</button>
        </div>
      </div>

      <div id="weather-map" className="rounded-xl overflow-hidden border mt-3" style={{height: 340}}></div>
      {error && <p className="text-sm text-red-600 mt-2">Erreur: {error}</p>}

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold">Pluie (passé & prévisions)</h4>
          <div className="text-xs text-slate-500">Σ passé: {sum(past).toFixed(1)} mm · Σ prévisions: {sum(forecast).toFixed(1)} mm</div>
        </div>
        <div className="h-64 md:h-80"><canvas ref={chartCanvasRef}></canvas></div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<WeatherPage />);