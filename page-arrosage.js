const C = window.GardenCore;

/* —— coller EXACTEMENT la même WeatherCard que dans page-index.js —— */
function WeatherCard(){ /* … même code que ci-dessus … */ }
//////////////////////////////////////////////////////////////

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