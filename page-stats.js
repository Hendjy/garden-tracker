const C = window.GardenCore;

function StatsPage(){
  const [, setTick] = React.useState(0);
  function refresh(){ setTick(t=>t+1); }

  // Agrégations
  const plants = Object.values(C.db.plants);
  const byVariety = aggregate(plants, p => `${p.name}${p.variety? " – "+p.variety:""}`,
                              p => sum(p.harvests.map(h => Number(h.weightKg)||0)));
  const byParcel = aggregateParcels();

  React.useEffect(()=>{
    // Graph 1 : Poids par variété
    const ctx1 = document.getElementById('chartVariety');
    if (ctx1) new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: byVariety.map(x=>x.key),
        datasets: [{ label:'kg', data: byVariety.map(x=>x.value) }]
      },
      options: { responsive:true, plugins:{legend:{display:false}} }
    });

    // Graph 2 : Poids par parcelle
    const ctx2 = document.getElementById('chartParcel');
    if (ctx2) new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: byParcel.map(x=>x.key),
        datasets: [{ label:'kg', data: byParcel.map(x=>x.value) }]
      },
      options: { responsive:true, plugins:{legend:{display:false}} }
    });
  }, [C.db]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="bg-white rounded-2xl shadow p-4">
        <h3 className="font-semibold mb-2">Poids récolté par variété</h3>
        <canvas id="chartVariety" height="200"></canvas>
        <table className="mt-3 text-sm w-full">
          <thead><tr><th className="text-left p-2">Variété</th><th className="text-right p-2">kg</th></tr></thead>
          <tbody>
            {byVariety.map(x=>(
              <tr key={x.key} className="border-t">
                <td className="p-2">{x.key}</td>
                <td className="p-2 text-right">{x.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-2xl shadow p-4">
        <h3 className="font-semibold mb-2">Poids par parcelle</h3>
        <canvas id="chartParcel" height="200"></canvas>
        <table className="mt-3 text-sm w-full">
          <thead><tr><th className="text-left p-2">Parcelle</th><th className="text-right p-2">kg</th></tr></thead>
          <tbody>
            {byParcel.map(x=>(
              <tr key={x.key} className="border-t">
                <td className="p-2">{x.key}</td>
                <td className="p-2 text-right">{x.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-2xl shadow p-4 md:col-span-2">
        <h3 className="font-semibold mb-2">Export</h3>
        <button className="px-3 py-1.5 rounded bg-slate-900 text-white" onClick={()=>{
          const blob = new Blob([JSON.stringify(C.db, null, 2)], {type:'application/json'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href=url; a.download='garden-db.json'; a.click(); URL.revokeObjectURL(url);
        }}>Exporter JSON (tout)</button>
      </section>
    </div>
  );
}

function aggregate(items, keyFn, valFn){
  const map = new Map();
  items.forEach(p=>{
    const key = keyFn(p);
    const val = valFn(p);
    map.set(key, (map.get(key)||0)+val);
  });
  return Array.from(map.entries()).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}
function sum(arr){ return arr.reduce((s,x)=>s+(Number(x)||0),0); }
function aggregateParcels(){
  // poids par parcelle = somme des poids des plants présents dans la parcelle (approx)
  const res = new Map();
  Object.values(C.db.parcels).forEach(par=>{
    let tot=0;
    for (let r=0;r<par.rows;r++){
      for (let c=0;c<par.cols;c++){
        const pid = par.grid[r][c].plantId; if (!pid) continue;
        const p = C.db.plants[pid]; if (!p) continue;
        tot += sum(p.harvests.map(h=>h.weightKg));
      }
    }
    res.set(par.name, tot);
  });
  return Array.from(res.entries()).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<StatsPage />);