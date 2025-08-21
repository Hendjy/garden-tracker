const C = window.GardenCore;

function ArrosagePage(){
  const [lat, setLat] = React.useState(C.db.weather.lat);
  const [lon, setLon] = React.useState(C.db.weather.lon);
  const [daysWindow, setDaysWindow] = React.useState(3);
  const [rainThreshold, setRainThreshold] = React.useState(5);
  const [maxAgeDays, setMaxAgeDays] = React.useState(2);
  const [daily, setDaily] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [month, setMonth] = React.useState(new Date()); // mois affiché
  const [selectedPlantId, setSelectedPlantId] = React.useState(Object.keys(C.db.plants)[0] || null);
  const [, setTick] = React.useState(0);
  function refresh(){ setTick(t=>t+1); }

  async function loadRain(){
    setLoading(true); setError(null);
    try{
      const d = await C.fetchRain(lat, lon, 30);
      setDaily(d); C.db.weather.lat=lat; C.db.weather.lon=lon; C.save(C.db);
    }catch(e){ setError(e.message||String(e)); }
    setLoading(false);
  }

  React.useEffect(()=>{ loadRain(); },[]);

  const suggestions = C.wateringSuggestions(daily, rainThreshold, daysWindow, maxAgeDays);

  const grid = buildMonthGrid(month);
  function prevMonth(){ const m = new Date(month); m.setMonth(m.getMonth()-1); setMonth(m); }
  function nextMonth(){ const m = new Date(month); m.setMonth(m.getMonth()+1); setMonth(m); }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Col 1: paramètres & suggestions */}
      <section className="bg-white rounded-2xl shadow p-4 space-y-3">
        <h3 className="font-semibold">Météo / Règles</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>Lat
            <input type="number" step="0.0001" className="w-full mt-1 px-2 py-1 border rounded"
                   value={lat} onChange={(e)=>setLat(Number(e.target.value))}/>
          </label>
          <label>Lon
            <input type="number" step="0.0001" className="w-full mt-1 px-2 py-1 border rounded"
                   value={lon} onChange={(e)=>setLon(Number(e.target.value))}/>
          </label>
          <label>Fenêtre pluie (jours)
            <input type="number" min="1" max="10" className="w-full mt-1 px-2 py-1 border rounded"
                   value={daysWindow} onChange={(e)=>setDaysWindow(Number(e.target.value)||3)}/>
          </label>
          <label>Seuil pluie (mm)
            <input type="number" step="0.1" className="w-full mt-1 px-2 py-1 border rounded"
                   value={rainThreshold} onChange={(e)=>setRainThreshold(Number(e.target.value)||5)}/>
          </label>
          <label>Jours depuis dernier arrosage
            <input type="number" min="0" className="w-full mt-1 px-2 py-1 border rounded"
                   value={maxAgeDays} onChange={(e)=>setMaxAgeDays(Number(e.target.value)||2)}/>
          </label>
        </div>
        <button className="px-3 py-1.5 rounded bg-slate-900 text-white" onClick={loadRain} disabled={loading}>
          {loading ? "…" : "Récupérer pluie"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <h3 className="font-semibold mt-4">Suggestions d'arrosage</h3>
        <ul className="divide-y text-sm">
          {suggestions.map(s=>(
            <li key={s.plantId} className="py-2 flex items-center gap-2">
              <span className="text-lg">{C.db.plants[s.plantId]?.emoji||"🌱"}</span>
              <div className="min-w-0">
                <div className="font-medium">{s.name}{s.variety?` – ${s.variety}`:""}</div>
                <div className="text-xs text-slate-500">
                  Dernier arrosage: {s.lastWater || "—"} · {s.daysSince===Infinity ? "jamais" : `${s.daysSince} j`} · Pluie {daysWindow}j: {s.rainSum.toFixed(1)} mm
                </div>
              </div>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded ${s.need?'bg-red-100 text-red-700':'bg-emerald-100 text-emerald-700'}`}>{s.need?'Arroser':'OK'}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Col 2-3: calendrier + journal plant */}
      <section className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <button className="px-2 py-1 border rounded" onClick={prevMonth}>←</button>
          <div className="font-semibold">{month.toLocaleString('fr-FR',{month:'long', year:'numeric'})}</div>
          <button className="px-2 py-1 border rounded" onClick={nextMonth}>→</button>
          <select className="ml-auto border rounded px-2 py-1 text-sm"
                  value={selectedPlantId||""}
                  onChange={(e)=>setSelectedPlantId(e.target.value||null)}>
            <option value="">— choisir un plant —</option>
            {Object.values(C.db.plants).map(p=><option key={p.id} value={p.id}>{p.name}{p.variety?` – ${p.variety}`:""}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=><div key={d} className="text-xs text-slate-500 text-center">{d}</div>)}
          {grid.map((cell, idx)=>{
            const d = cell.date;
            const rain = daily.find(x=>x.date===d)?.rain_mm || 0;
            const isThisMonth = cell.inMonth;
            return (
              <div key={idx} className={`p-2 border rounded ${isThisMonth?"bg-white":"bg-slate-50/50"} flex flex-col gap-1`}>
                <div className="text-xs text-slate-500">{d.slice(8,10)}</div>
                <div className="text-[10px]">Pluie: {rain.toFixed(1)} mm</div>
                {selectedPlantId && (
                  <button className="mt-auto text-xs px-2 py-1 border rounded"
                          onClick={()=>{
                            const liters = Number(prompt("Litres", "1"))||0;
                            if (liters>0) { C.addWatering(selectedPlantId, { date: d, amountL: liters, notes: "" }); refresh(); }
                          }}>+ Arrosage</button>
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
  const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const startIdx = (first.getDay()+6)%7; // Lundi=0
  const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth()+1, 0).getDate();
  const prevDays = new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();

  const cells = [];
  // jours du mois précédent
  for (let i=0;i<startIdx;i++){
    const d = prevDays - startIdx + 1 + i;
    const date = new Date(refDate.getFullYear(), refDate.getMonth()-1, d).toISOString().slice(0,10);
    cells.push({ date, inMonth:false });
  }
  // mois courant
  for (let d=1; d<=daysInMonth; d++){
    const date = new Date(refDate.getFullYear(), refDate.getMonth(), d).toISOString().slice(0,10);
    cells.push({ date, inMonth:true });
  }
  // compléter à 42 cellules
  while (cells.length < 42){
    const last = new Date(cells[cells.length-1].date);
    last.setDate(last.getDate()+1);
    cells.push({ date: last.toISOString().slice(0,10), inMonth:false });
  }
  return cells;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ArrosagePage />);