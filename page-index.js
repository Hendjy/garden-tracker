// page-index.js — prise en charge des icônes personnalisées (URL ou fichier)
const C = window.GardenCore;
const { useState } = React;

function ParcelGrid(){
  const [, setTick] = useState(0);
  const [mode, setMode] = useState("plant"); // 'plant' | 'path' | 'mulch'
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const par = C.getCurrentParcel();
  function refresh(){ setTick(t=>t+1); }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Grille */}
      <section className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="font-semibold">Parcelle :</span>
          <select className="border rounded px-2 py-1"
                  value={C.db.currentParcelId}
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
          <span className="text-xs text-slate-500 ml-2">Clic = action · Clic droit = vider plante / basculer couche</span>
        </div>

        <div className="overflow-auto border rounded-xl">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${par.cols}, minmax(36px, 1fr))` }}>
            {par.grid.map((row, r) => row.map((cell, c) => {
              const p = cell.plantId ? C.db.plants[cell.plantId] : null;
              const bg = cell.layers.path ? "bg-amber-200/60" : cell.layers.mulch ? "bg-emerald-100/60" : "bg-white";
              return (
                <div key={`${r}-${c}`}
                     className={`aspect-square border border-slate-200 flex items-center justify-center relative ${bg}`}
                     onClick={()=>{
                       if (mode==='plant') { if (selectedPlantId) C.placePlant(r,c,selectedPlantId); }
                       else { C.toggleLayer(r,c,mode); }
                       refresh();
                     }}
                     onContextMenu={(e)=>{
                       e.preventDefault();
                       if (mode==='plant') C.clearCell(r,c); else C.toggleLayer(r,c,mode);
                       refresh();
                     }}>
                  {p ? (
                    p.iconUrl
                      ? <img src={p.iconUrl} alt={p.name} className="h-7 w-7 object-contain select-none" />
                      : <div className="text-2xl select-none" title={`${p.name}${p.variety?" • "+p.variety:""}`}>{p.emoji || "🌱"}</div>
                  ) : (
                    <span className="text-slate-300 text-[10px]">{r+1},{c+1}</span>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      </section>

      {/* Sidebar */}
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
      </aside>
    </div>
  );
}

function AddPlantForm({ onAdd }){
  const [form, setForm] = React.useState({
    name:"", variety:"", emoji:"🌱", plantedAt: new Date().toISOString().slice(0,10), notes:""
  });
  const [iconUrlInput, setIconUrlInput] = React.useState("");
  const [iconFile, setIconFile] = React.useState(null);

  function fileToDataUrl(file){
    return new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  return (
    <form className="grid grid-cols-2 gap-2 text-sm"
          onSubmit={async (e)=>{
            e.preventDefault();
            let iconUrl = iconUrlInput;
            if (iconFile) iconUrl = await fileToDataUrl(iconFile);
            onAdd({ ...form, iconUrl });
            setForm(f=>({...f, name:"", variety:"", notes:""}));
            setIconUrlInput(""); setIconFile(null);
          }}>
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

      <label className="col-span-2">Icône (URL)
        <input className="w-full mt-1 px-2 py-1 border rounded"
               value={iconUrlInput}
               onChange={(e)=>setIconUrlInput(e.target.value)}
               placeholder="https://…/mon-legume.png"/>
      </label>
      <label className="col-span-2">Icône (fichier)
        <input type="file" accept="image/*" className="w-full mt-1"
               onChange={(e)=>setIconFile(e.target.files?.[0]||null)} />
      </label>

      <label className="col-span-2">Date de plantation
        <input type="date" className="w-full mt-1 px-2 py-1 border rounded"
               value={form.plantedAt}
               onChange={(e)=>setForm({...form, plantedAt:e.target.value})}/>
      </label>
      <label className="col-span-2">Notes
        <textarea className="w-full mt-1 px-2 py-1 border rounded" rows="2"
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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ParcelGrid />);