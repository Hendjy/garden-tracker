// app.js — version CDN (React global + Babel in-browser)
const { useEffect, useMemo, useRef, useState } = React;

// === Utils & Local Storage ===
function uid() { return Math.random().toString(36).slice(2, 10); }
const LS_KEY = "garden-tracker-state-v1";
const saveState = (state) => localStorage.setItem(LS_KEY, JSON.stringify(state));
const loadState = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

// === App ===
function GardenHarvestTrackerApp() {
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(12);
  const [plants, setPlants] = useState({}); // {id: Plant}
  const [grid, setGrid] = useState([]);     // 2D array of {plantId: string|null}
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); // {r,c}
  const [weather, setWeather] = useState({ lat: 48.8566, lon: 2.3522, days: 14, daily: [], loading:false, error:null});

  // Init from localStorage or fresh grid
  useEffect(() => {
    const s = loadState();
    if (s) {
      setRows(s.rows);
      setCols(s.cols);
      setPlants(s.plants || {});
      setGrid(s.grid || []);
      setSelectedPlantId(s.selectedPlantId || null);
      setWeather((w)=>({ ...w, lat: s.weather?.lat ?? 48.8566, lon: s.weather?.lon ?? 2.3522 }));
    } else {
      setGrid(Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ plantId: null }))));
    }
  }, []);

  // Keep grid in sync when rows/cols change
  useEffect(() => {
    setGrid((g) => {
      if (!g.length) return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ plantId: null })));
      // rows
      let ng = g.slice(0, rows);
      while (ng.length < rows) ng.push(Array.from({ length: cols }, () => ({ plantId: null })));
      // cols
      ng = ng.map((row) => {
        const r = row.slice(0, cols);
        while (r.length < cols) r.push({ plantId: null });
        return r;
      });
      return ng;
    });
  }, [rows, cols]);

  // Persist
  useEffect(() => {
    saveState({ rows, cols, plants, grid, selectedPlantId, weather: {lat: weather.lat, lon: weather.lon} });
  }, [rows, cols, plants, grid, selectedPlantId, weather.lat, weather.lon]);

  const selectedPlant = selectedPlantId ? plants[selectedPlantId] : null;

  // Actions
  const addPlant = (data) => {
    const id = uid();
    const plant = {
      id,
      name: data.name?.trim() || "Plant",
      variety: data.variety?.trim() || "",
      emoji: data.emoji?.trim() || "🌱",
      plantedAt: data.plantedAt || new Date().toISOString().slice(0,10),
      notes: data.notes || "",
      photos: [],    // {id,url,caption}
      waterings: [], // {id,date,amountL,notes}
      harvests: [],  // {id,date,qty,weightKg,notes}
    };
    setPlants((p) => ({ ...p, [id]: plant }));
    setSelectedPlantId(id);
  };

  const updatePlant = (id, patch) => setPlants((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const deletePlant = (id) => {
    setPlants((p) => {
      const np = { ...p };
      delete np[id];
      return np;
    });
    setGrid((g) => g.map(row => row.map(cell => cell.plantId === id ? { plantId: null } : cell)));
    if (selectedPlantId === id) setSelectedPlantId(null);
  };

  const placePlantAt = (r, c, plantId) => {
    setGrid((g) => {
      const ng = g.map((row) => row.slice());
      ng[r][c] = { plantId };
      return ng;
    });
  };

  const clearCell = (r, c) => placePlantAt(r, c, null);

  const addWatering = (plantId, rec) => updatePlant(plantId, { waterings: [ { id: uid(), ...rec }, ...plants[plantId].waterings ] });
  const addHarvest  = (plantId, rec) => updatePlant(plantId, { harvests:  [ { id: uid(), ...rec }, ...plants[plantId].harvests  ] });
  const addPhoto    = (plantId, rec) => updatePlant(plantId, { photos:    [ { id: uid(), ...rec }, ...plants[plantId].photos    ] });

  // Import / Export
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ rows, cols, plants, grid }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `garden-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const importRef = useRef(null);
  const doImport = async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    setRows(data.rows || 8);
    setCols(data.cols || 12);
    setPlants(data.plants || {});
    setGrid(data.grid || Array.from({ length: data.rows||8 }, () => Array.from({ length: data.cols||12 }, () => ({ plantId: null }))));
  };

  // Weather (Open-Meteo)
  const fetchWeather = async () => {
    setWeather(w => ({...w, loading:true, error:null}));
    try {
      const end = new Date();
      const start = new Date(Date.now() - (weather.days-1)*24*3600*1000);
      const fmt = (d) => d.toISOString().slice(0,10);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${weather.lat}&longitude=${weather.lon}&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const daily = (json?.daily?.time||[]).map((t, i) => ({ date: t, rain_mm: json.daily.precipitation_sum[i] }))
      setWeather(w => ({...w, daily, loading:false}));
    } catch (e) {
      setWeather(w => ({...w, loading:false, error: e.message||String(e)}));
    }
  };

  // Derived
  const totalHarvest = useMemo(() => {
    const entries = Object.values(plants).flatMap(p => p.harvests);
    const weight = entries.reduce((s, x) => s + (Number(x.weightKg)||0), 0);
    const qty    = entries.reduce((s, x) => s + (Number(x.qty)||0), 0);
    return { weight, qty };
  }, [plants]);

  const handleFileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // UI
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto p-4 flex items-center gap-3">
          <span className="text-2xl">🪴</span>
          <h1 className="text-xl font-bold">Garden Harvest Tracker</h1>
          <div className="ml-auto flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-slate-900 text-white" onClick={exportJson}>Exporter JSON</button>
            <label className="px-3 py-1.5 rounded-lg bg-slate-200 cursor-pointer">Importer
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e)=> e.target.files?.[0] && doImport(e.target.files[0])} />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Plan de la parcelle</h2>
              <div className="flex gap-2 items-center text-sm">
                <label className="flex items-center gap-1">Lignes
                  <input type="number" min={1} className="w-16 px-2 py-1 border rounded" value={rows} onChange={(e)=>setRows(Number(e.target.value)||1)} />
                </label>
                <label className="flex items-center gap-1">Colonnes
                  <input type="number" min={1} className="w-16 px-2 py-1 border rounded" value={cols} onChange={(e)=>setCols(Number(e.target.value)||1)} />
                </label>
                <button className="px-2 py-1 rounded bg-slate-100 border" onClick={()=>setGrid(Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ plantId: null }))))}>Vider</button>
              </div>
            </div>
            <div className="overflow-auto border rounded-xl">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(40px, 1fr))` }}>
                {grid.map((row, r) => row.map((cell, c) => {
                  const p = cell.plantId ? plants[cell.plantId] : null;
                  return (
                    <div key={`${r}-${c}`} className="aspect-square border border-slate-200 flex items-center justify-center relative group"
                         onClick={() => { setSelectedCell({r,c}); if (selectedPlantId) placePlantAt(r,c,selectedPlantId); }}
                         onContextMenu={(e)=>{e.preventDefault(); clearCell(r,c);}}>
                      {p ? (
                        <div className="text-2xl select-none" title={`${p.name}${p.variety?" • "+p.variety:""}`}>{p.emoji || "🌱"}</div>
                      ) : (
                        <span className="text-slate-300 text-xs">{r+1},{c+1}</span>
                      )}
                      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/5 text-xs">
                        {p? "Clic droit pour vider" : selectedPlantId? "Clic pour placer" : "Sélectionner un plant"}
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
            {selectedCell && (
              <p className="text-xs text-slate-500 mt-2">Cellule sélectionnée: L{selectedCell.r+1} C{selectedCell.c+1}</p>
            )}
          </div>
        </section>

        <section>
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Ajouter un plant</h2>
            <AddPlantForm onAdd={addPlant} />
          </div>
          <div className="bg-white rounded-2xl shadow p-4 mt-4">
            <h3 className="font-semibold mb-2">Catalogue</h3>
            <div className="max-h-64 overflow-auto divide-y">
              {Object.values(plants).length===0 && (
                <p className="text-sm text-slate-500">Ajoutez vos plants (tomate, salade, courgette…)</p>
              )}
              {Object.values(plants).map((p) => (
                <button key={p.id} onClick={()=>setSelectedPlantId(p.id)} className={`w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center gap-2 ${selectedPlantId===p.id?"bg-slate-100": ""}`}>
                  <span className="text-xl">{p.emoji||"🌱"}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}{p.variety?` – ${p.variety}`:""}</div>
                    <div className="text-xs text-slate-500">Planté le {p.plantedAt}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// === Forms & Lists ===
function AddPlantForm({ onAdd }) {
  const [form, setForm] = useState({ name:"", variety:"", emoji:"🌱", plantedAt: new Date().toISOString().slice(0,10), notes:"" });
  return (
    <form className="grid grid-cols-2 gap-2 text-sm" onSubmit={(e)=>{e.preventDefault(); onAdd(form); setForm(f=>({...f, name:"", variety:"", notes:""}));}}>
      <label className="col-span-2">Nom
        <input className="w-full mt-1 px-2 py-1 border rounded" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Tomate" required/>
      </label>
      <label>Variété
        <input className="w-full mt-1 px-2 py-1 border rounded" value={form.variety} onChange={(e)=>setForm({...form,variety:e.target.value})} placeholder="Cœur de bœuf"/>
      </label>
      <label>Emoji
        <input className="w-full mt-1 px-2 py-1 border rounded" value={form.emoji} onChange={(e)=>setForm({...form,emoji:e.target.value})} placeholder="🍅"/>
      </label>
      <label className="col-span-2">Date de plantation
        <input type="date" className="w-full mt-1 px-2 py-1 border rounded" value={form.plantedAt} onChange={(e)=>setForm({...form,plantedAt:e.target.value})}/>
      </label>
      <label className="col-span-2">Notes
        <textarea className="w-full mt-1 px-2 py-1 border rounded" rows={2} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Ex: en plein soleil, paillage, tuteurage…"/>
      </label>
      <div className="col-span-2 flex justify-end">
        <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Ajouter</button>
      </div>
    </form>
  );
}

function LogList({ items, render }) {
  if (!items?.length) return <p className="text-sm text-slate-500">Aucune donnée.</p>;
  return (
    <ul className="divide-y">
      {items.map((it)=> (
        <li key={it.id} className="py-1.5">{render(it)}</li>
      ))}
    </ul>
  );
}

// === Mount ===
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<GardenHarvestTrackerApp />);