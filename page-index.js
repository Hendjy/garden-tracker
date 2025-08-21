// page-index.js (Babel + React)
const { useState } = React;
const C = window.GardenCore;

function ParcelGrid() {
  const [, setTick] = useState(0);
  const par = C.getCurrentParcel();
  const [mode, setMode] = useState("plant"); // "plant" | "path" | "mulch"
  const [selectedPlantId, setSelectedPlantId] = useState(null);

  function refresh(){ setTick(t=>t+1); }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <section className="md:col-span-2 bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="font-semibold">Parcelle :</span>
          <select className="border rounded px-2 py-1"
                  value={C.db.currentParcelId}
                  onChange={(e)=>{C.setCurrentParcel(e.target.value); refresh();}}>
            {Object.values(C.db.parcels).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="px-2 py-1 border rounded" onClick={()=>{
            const name = prompt("Nom de la parcelle","Nouvelle parcelle")||"Parcelle";
            const rows = Number(prompt("Lignes", "8"))||8;
            const cols = Number(prompt("Colonnes", "12"))||12;
            C.addParcel({name, rows, cols}); refresh();
          }}>+ Parcelle</button>
          <button className="px-2 py-1 border rounded text-red-600" onClick={()=>{ if(confirm("Supprimer cette parcelle ?")) { C.removeParcel(C.db.currentParcelId); refresh(); }}}>Supprimer</button>
          <span className="ml-auto">Taille:</span>
          <input type="number" className="w-16 border rounded px-2 py-1" min="1" value={par.rows} onChange={(e)=>{C.resizeParcel(par.id, Number(e.target.value)||1, par.cols); refresh();}}/>
          <input type="number" className="w-16 border rounded px-2 py-1" min="1" value={par.cols} onChange={(e)=>{C.resizeParcel(par.id, par.rows, Number(e.target.value)||1); refresh();}}/>
        </div>

        <div className="flex gap-2 mb-2 text-sm">
          <span className="font-medium">Mode:</span>
          <button className={`px-2 py-1 rounded border ${mode==='plant'?'bg-slate-900 text-white':''}`} onClick={()=>setMode('plant')}>Planter</button>
          <button className={`px-2 py-1 rounded border ${mode==='path'?'bg-slate-900 text-white':''}`} onClick={()=>setMode('path')}>Allée</button>
          <button className={`px-2 py-1 rounded border ${mode==='mulch'?'bg-slate-900 text-white':''}`} onClick={()=>setMode('mulch')}>Paillage</button>
          <span className="text-xs text-slate-500 ml-2">Clic = action · clic droit = vider la plante / basculer couche</span>
        </div>

        <div className="overflow-auto border rounded-xl">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${par.cols}, minmax(36px, 1fr))` }}>
            {par.grid.map((row, r) => row.map((cell, c) => {
              const p = cell.plantId ? C.db.plants[cell.plantId] : null;
              const isPath = !!cell.layers.path;
              const isMulch = !!cell.layers.mulch;
              const bg = isPath ? "bg-amber-200/60" : isMulch ? "bg-emerald-100/60" : "bg-white";
              return (
                <div key={`${r}-${c}`}
                     className={`aspect-square border border-slate-200 flex items-center justify-center relative ${bg}`}
                     onClick={(e)=>{
                       if (mode==='plant') {
                         if (selectedPlantId) C.placePlant(r,c,selectedPlantId);
                       } else {
                         C.toggleLayer(r,c, mode);
                       }
                       refresh();
                     }}
                     onContextMenu={(e)=>{
                       e.preventDefault();
                       if (mode==='plant') { C.clearCell(r,c); }
                       else { C.toggleLayer(r,c, mode); }
                       refresh();
                     }}>
                  {p ? <div className="text-2xl" title={`${p.name}${p.variety? " • "+p.variety:""}`}>{p.emoji||"🌱"}</div>
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
              <button key={p.id} onClick={()=>setSelectedPlantId(p.id)} className={`w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center gap-2 ${selectedPlantId===p.id?"bg-slate-100":""}`}>
                <span className="text-xl">{p.emoji||"🌱"}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}{p.variety?` – ${p.variety}`:""}</div>
                  <div className="text-xs text-slate-500">Planté le {p.plantedAt}</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <button className="px-1 py-0.5 border rounded" onClick={(e)=>{e.stopPropagation(); C.updatePlant(p.id, { name: prompt("Nom", p.name)||p.name }); refresh();}}>Renommer</button>
                  <button className="px-1 py-0.5 border rounded" onClick={(e)=>{e.stopPropagation(); C.updatePlant(p.id, { emoji: prompt("Emoji", p.emoji)||p.emoji }); refresh();}}>Emoji</button>
                  <button className="px-1 py-0.5 border rounded text-red-600" onClick={(e)=>{e.stopPropagation(); if(confirm("Supprimer ?")) { C.deletePlant(p.id); refresh(); }}}>Suppr.</button>
                </div>
              </button>
            ))}
          </div>
        </div>

        <WeatherCard />
      </aside>
    </div>
  );
}

function AddPlantForm({ onAdd }) {
  const [form, setForm] = React.useState({
    name:"", variety:"", emoji:"🌱",
    plantedAt: new Date().toISOString().slice(0,10),
    notes:""
  });
  return (
    <form className="grid grid-cols-2 gap-2 text-sm"
          onSubmit={(e)=>{e.preventDefault(); onAdd(form); setForm(f=>({...f, name:"", variety:"", notes:""}));}}>
      <label className="col-span-2">Nom
        <input className="w-full mt-1 px-2 py-1 border rounded"
               value={form.name}
               onChange={(e)=>setForm({...form,name:e.target.value})}
               placeholder="Tomate" required/>
      </label>
      <label>Variété
        <input className="w-full mt-1 px-2 py-1 border rounded"
               value={form.variety}
               onChange={(e)=>setForm({...form, variety:e.target.value})}
               placeholder="Cœur de bœuf"/>
      </label>
      <label>Emoji
        <input className="w-full mt-1 px-2 py-1 border rounded"
               value={form.emoji}
               onChange={(e)=>setForm({...form, emoji:e.target.value})}
               placeholder="🍅"/>
      </label>
      <label className="col-span-2">Date de plantation
        <input type="date"
               className="w-full mt-1 px-2 py-1 border rounded"
               value={form.plantedAt}
               onChange={(e)=>setForm({...form, plantedAt:e.target.value})}/>
      </label>
      <label className="col-span-2">Notes
        <textarea className="w-full mt-1 px-2 py-1 border rounded" rows={2}
                  value={form.notes}
                  onChange={(e)=>setForm({...form, notes:e.target.value})}
                  placeholder="Ex: plein soleil, paillage…"/>
      </label>
      <div className="col-span-2 flex justify-end">
        <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Ajouter</button>
      </div>
    </form>
  );
}

function WeatherCard(){
  const [lat, setLat] = React.useState(C.db.weather.lat);
  const [lon, setLon] = React.useState(C.db.weather.lon);
  const [days, setDays] = React.useState(14);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [daily, setDaily] = React.useState([]);

  async function load(){
    setLoading(true); setError(null);
    try{
      const d = await C.fetchRain(lat, lon, days);
      setDaily(d);
      C.db.weather.lat = lat; C.db.weather.lon = lon; C.save(C.db);
    }catch(e){ setError(e.message||String(e)); }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Météo – Pluie (mm)</h3>
        <div className="flex gap-2 text-sm items-center">
          <input type="number" step="0.0001" className="w-24 px-2 py-1 border rounded" value={lat} onChange={(e)=>setLat(Number(e.target.value))}/>
          <input type="number" step="0.0001" className="w-24 px-2 py-1 border rounded" value={lon} onChange={(e)=>setLon(Number(e.target.value))}/>
          <input type="number" min="1" max="60" className="w-16 px-2 py-1 border rounded" value={days} onChange={(e)=>setDays(Number(e.target.value)||14)}/>
          <button className="px-3 py-1.5 rounded bg-slate-900 text-white" onClick={load} disabled={loading}>{loading?"…":"Récupérer"}</button>
      </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">Erreur: {error}</p>}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {daily.map(d=>(
          <div key={d.date} className="p-2 rounded-lg border text-center">
            <div className="text-xs text-slate-500">{d.date}</div>
            <div className="text-lg font-semibold">{(d.rain_mm??0).toFixed(1)}</div>
          </div>
        ))}
      </div>
      {daily.length>0 && (
        <p className="text-xs text-slate-500 mt-2">
          Astuce: si la pluie cumulée &lt; 5 mm sur 3 jours, planifie un arrosage.
        </p>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ParcelGrid />);