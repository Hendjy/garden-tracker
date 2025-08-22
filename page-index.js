// page-index.js — Parcelles + WeatherCard
const C = window.GardenCore;
const { useState } = React;

/* ---------- Grille Parcelles (inchangé côté logique) ---------- */
function ParcelGrid(){
  const [, setTick] = useState(0);
  const [mode, setMode] = useState("plant");
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const par = C.getCurrentParcel();
  function refresh(){ setTick(t=>t+1); }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="font-semibold">Parcelle :</span>
          <select className="border rounded px-2 py-1" value={C.db.currentParcelId}
                  onChange={(e)=>{C.setCurrentParcel(e.target.value); refresh();}}>
            {Object.values(C.db.parcels).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="px-2 py-1 border rounded" onClick={()=>{
            const name = prompt("Nom de la parcelle","Nouvelle parcelle")||"Parcelle";
            const rows = Number(prompt("Lignes","8"))||8;
            const cols = Number(prompt("Colonnes","12"))||12;
            C.addParcel({name, rows, cols}); refresh();
          }}>+ Parcelle</button>
          <button className="px-2 py-1 border rounded text-red-600" onClick={()=>{
            if (confirm("Supprimer cette parcelle ?")) { C.removeParcel(C.db.currentParcelId); refresh(); }
          }}>Supprimer</button>

          <span className="ml-auto">Taille:</span>
          <input type="number" className="w-16 border rounded px-2 py-1" min="1"
                 value={par.rows} onChange={(e)=>{C.resizeParcel(par.id, Number(e.target.value)||1, par.cols); refresh();}}/>
          <input type="number" className="w-16 border rounded px-2 py-1" min="1"
                 value={par.cols} onChange={(e)=>{C.resizeParcel(par.id, par.rows, Number(e.target.value)||1); refresh();}}/>
        </div>

        <div className="flex gap-2 mb-2 text-sm">
          <span className="font-medium">Mode:</span>
          <button className={`px-2 py-1 rounded border ${mode==='plant'?'bg-slate-900 text-white':''}`} onClick={()=>setMode('plant')}>Planter</button>
          <button className={`px-2 py-1 rounded border ${mode==='path'?'bg-slate-900 text-white':''}`}  onClick={()=>setMode('path')}>Allée</button>
          <button className={`px-2 py-1 rounded border ${mode==='mulch'?'bg-slate-900 text-white':''}`} onClick={()=>setMode('mulch')}>Paillage</button>
          <span className="text-xs text-slate-500 ml-2">Clic = action · clic droit = vider plante / basculer couche</span>
        </div>

        <div className="overflow-auto border rounded-xl">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${par.cols}, minmax(36px, 1fr))` }}>
            {par.grid.map((row, r) => row.map((cell, c) => {
              const p = cell.plantId ? C.db.plants[cell.plantId] : null;
              const bg = cell.layers.path ? "bg-amber-200/60" : cell.layers.mulch ? "bg-emerald-100/60" : "bg-white";
              return (
                <div key={`${r}-${c}`} className={`aspect-square border border-slate-200 flex items-center justify-center relative ${bg}`}
                     onClick={()=>{ if (mode==='plant') { if (selectedPlantId) C.placePlant(r,c,selectedPlantId); }
                                    else { C.toggleLayer(r,c,mode); } refresh(); }}
                     onContextMenu={(e)=>{ e.preventDefault(); if (mode==='plant') C.clearCell(r,c); else C.toggleLayer(r,c,mode); refresh(); }}>
                  {p ? ( p.iconUrl
                          ? <img src={p.iconUrl} alt={p.name} className="h-7 w-7 object-contain select-none" />
                          : <div className="text-2xl select-none" title={`${p.name}${p.variety?" • "+p.variety:""}`}>{p.emoji||"🌱"}</div>
                       )
                      : <span className="text-slate-300 text-[10px]">{r+1},{c+1}</span>}
                </div>
              );
            }))}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-semibold mb-2">Catalogue plants</h3>
          <AddPlantForm onAdd={(data)=>{ const id=C.addPlant(data); setSelectedPlantId(id); refresh(); }} />
          <div className="max-h-56 overflow-auto divide-y mt-2">
            {Object.values(C.db.plants).map(p=>(
              <button key={p.id} onClick={()=>setSelectedPlantId(p.id)}
                      className={`w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center gap-2 ${selectedPlantId===p.id?"bg-slate-100":""}`}>
                <span className="text-xl">{p.emoji||"🌱"}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}{p.variety?` – ${p.variety}`:""}</div>
                  <div className="text-xs text-slate-500">Planté le {p.plantedAt}</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <button className="px-1 py-0.5 border rounded" onClick={(e)=>{e.stopPropagation(); C.updatePlant(p.id,{name: prompt("Nom",p.name)||p.name}); refresh();}}>Renommer</button>
                  <button className="px-1 py-0.5 border rounded" onClick={(e)=>{e.stopPropagation(); C.updatePlant(p.id,{emoji: prompt("Emoji",p.emoji)||p.emoji}); refresh();}}>Emoji</button>
                  <button className="px-1 py-0.5 border rounded" onClick={(e)=>{e.stopPropagation(); const url=prompt("URL d’icône (png/svg/data:)", p.iconUrl||""); if(url!=null){C.updatePlant(p.id,{iconUrl:url}); refresh();}}}>Icône</button>
                  <button className="px-1 py-0.5 border rounded text-red-600" onClick={(e)=>{e.stopPropagation(); if(confirm("Supprimer ?")){C.deletePlant(p.id); refresh();}}}>Suppr.</button>
                </div>
              </button>
            ))}
          </div>
        </div>

        <WeatherCard/>
      </aside>
    </div>
  );
}

/* ---------- Formulaire ajout plant (avec URL/fichier icône) ---------- */
function AddPlantForm({ onAdd }){
  const [form, setForm] = React.useState({ name:"", variety:"", emoji:"🌱", plantedAt: new Date().toISOString().slice(0,10), notes:"" });
  const [iconUrlInput, setIconUrlInput] = React.useState("");
  const [iconFile, setIconFile] = React.useState(null);

  function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r = new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

  return (
    <form className="grid grid-cols-2 gap-2 text-sm"
          onSubmit={async (e)=>{ e.preventDefault(); let iconUrl = iconUrlInput; if (iconFile) iconUrl = await fileToDataUrl(iconFile);
                                 onAdd({ ...form, iconUrl }); setForm(f=>({...f, name:"", variety:"", notes:""})); setIconUrlInput(""); setIconFile(null); }}>
      <label className="col-span-2">Nom
        <input className="w-full mt-1 px-2 py-1 border rounded" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Tomate" required/>
      </label>
      <label>Variété
        <input className="w-full mt-1 px-2 py-1 border rounded" value={form.variety} onChange={(e)=>setForm({...form, variety:e.target.value})} placeholder="Cœur de bœuf"/>
      </label>
      <label>Emoji
        <input className="w-full mt-1 px-2 py-1 border rounded" value={form.emoji} onChange={(e)=>setForm({...form, emoji:e.target.value})} placeholder="🍅"/>
      </label>
      <label className="col-span-2">Icône (URL)
        <input className="w-full mt-1 px-2 py-1 border rounded" value={iconUrlInput} onChange={(e)=>setIconUrlInput(e.target.value)} placeholder="https://…/legume.png"/>
      </label>
      <label className="col-span-2">Icône (fichier)
        <input type="file" accept="image/*" className="w-full mt-1" onChange={(e)=>setIconFile(e.target.files?.[0]||null)} />
      </label>
      <label className="col-span-2">Date de plantation
        <input type="date" className="w-full mt-1 px-2 py-1 border rounded" value={form.plantedAt} onChange={(e)=>setForm({...form, plantedAt:e.target.value})}/>
      </label>
      <label className="col-span-2">Notes
        <textarea className="w-full mt-1 px-2 py-1 border rounded" rows="2" value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} placeholder="Ex: plein soleil…"/>
      </label>
      <div className="col-span-2 flex justify-end"><button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Ajouter</button></div>
    </form>
  );
}

/* ---------- WeatherCard (adresse + pin + passé & prévisions) ---------- */
function WeatherCard(){
  const [lat, setLat] = React.useState(C.db.weather.lat ?? 48.8566);
  const [lon, setLon] = React.useState(C.db.weather.lon ?? 2.3522);
  const [pastDays, setPastDays] = React.useState(14);
  const [nextDays, setNextDays] = React.useState(7);
  const [addr, setAddr] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [past, setPast] = React.useState([]);       // {date,rain_mm}
  const [forecast, setForecast] = React.useState([]); // {date,rain_mm}
  const mapRef = React.useRef(null); const markerRef = React.useRef(null);

  const iso = (d)=>d.toISOString().slice(0,10);
  async function geocodeAddress(address){
    const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res=await fetch(url); const data=await res.json();
    if(!data.length) throw new Error("Adresse introuvable");
    return { lat:Number(data[0].lat), lon:Number(data[0].lon) };
  }
  async function fetchPluv(la,lo,p,n){
    const start=new Date(Date.now()-(p-1)*86400000);
    const end=new Date(Date.now()+n*86400000);
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&start_date=${iso(start)}&end_date=${iso(end)}&daily=precipitation_sum&timezone=auto`;
    const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); const j=await r.json();
    const all=(j?.daily?.time||[]).map((t,i)=>({date:t,rain_mm:Number(j.daily.precipitation_sum[i]||0)}));
    const today=iso(new Date()); return { past: all.filter(d=>d.date<=today), forecast: all.filter(d=>d.date>today) };
  }
  function save(lat,lon){ C.db.weather.lat=lat; C.db.weather.lon=lon; C.save(C.db); }

  React.useEffect(()=>{ if(!window.L||mapRef.current) return;
    const map=L.map('weather-map', {zoomControl:true}).setView([lat,lon],11); mapRef.current=map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
    markerRef.current=L.marker([lat,lon]).addTo(map);
    map.on('click',(e)=>{ const {lat:la,lng:lo}=e.latlng; markerRef.current.setLatLng([la,lo]); setLat(la); setLon(lo); save(la,lo); reload(la,lo,pastDays,nextDays); });
  },[]);
  React.useEffect(()=>{ if(mapRef.current&&markerRef.current){ markerRef.current.setLatLng([lat,lon]); mapRef.current.setView([lat,lon], mapRef.current.getZoom()); }},[lat,lon]);

  async function reload(la=lat,lo=lon,p=pastDays,n=nextDays){ setLoading(true); setError(null);
    try{ const d=await fetchPluv(la,lo,p,n); setPast(d.past); setForecast(d.forecast); }catch(e){ setError(e.message||String(e)); } setLoading(false); }
  React.useEffect(()=>{ reload(); },[]);

  async function search(){ if(!addr.trim()) return; setLoading(true); setError(null);
    try{ const {lat:la,lon:lo}=await geocodeAddress(addr.trim()); setLat(la); setLon(lo); save(la,lo); await reload(la,lo,pastDays,nextDays); }
    catch(e){ setError(e.message||String(e)); setLoading(false); } }
  function useGps(){ if(!navigator.geolocation){ setError("Géolocalisation non dispo"); return; }
    setLoading(true); setError(null);
    navigator.geolocation.getCurrentPosition(async pos=>{ const la=pos.coords.latitude, lo=pos.coords.longitude; setLat(la); setLon(lo); save(la,lo); await reload(la,lo,pastDays,nextDays); },
      err=>{ setError(err.message||"Position indisponible"); setLoading(false); }, {enableHighAccuracy:true, timeout:10000}); }

  const sum = arr => arr.reduce((s,x)=>s+(Number(x.rain_mm)||0),0);

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

      {(past.length>0 || forecast.length>0) && (
        <div className="mt-3 grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-1">Pluviométrie passée (Σ {sum(past).toFixed(1)} mm)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {past.slice(-pastDays).map(d=>(
                <div key={d.date} className="p-2 border rounded text-center">
                  <div className="text-xs text-slate-500">{d.date}</div>
                  <div className="text-lg font-semibold">{d.rain_mm.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Prévisions (Σ {sum(forecast).toFixed(1)} mm)</h4>
            {forecast.length===0 ? <p className="text-sm text-slate-500">Pas de prévisions demandées.</p> :
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {forecast.slice(0,nextDays).map(d=>(
                  <div key={d.date} className="p-2 border rounded text-center">
                    <div className="text-xs text-slate-500">{d.date}</div>
                    <div className="text-lg font-semibold">{d.rain_mm.toFixed(1)}</div>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-2">
        Astuce : si la pluie cumulée des 3 derniers jours &lt; 5 mm et que le dernier arrosage date de &gt; 2 jours, pense à arroser.
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ParcelGrid />);