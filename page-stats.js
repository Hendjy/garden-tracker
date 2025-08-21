const C = window.GardenCore;

function StatsPage(){
  const plants = Object.values(C.db.plants);

  // Agrégations par variété (nom + variété) : total poids + total quantités
  const byVariety = aggregate(plants,
    p => `${p.name}${p.variety? " – "+p.variety:""}`,
    p => ({
      kg: sum(p.harvests.map(h=>h.weightKg)),
      pcs: sum(p.harvests.map(h=>h.qty))
    })
  );

  const byParcel = aggregateParcels(); // {key:name, value:kg}

  const waterVsYield = plants.map(p=>{
    const water = sum(p.waterings.map(w=>w.amountL));
    const yieldKg = sum(p.harvests.map(h=>h.weightKg));
    return { label: `${p.name}${p.variety? " – "+p.variety:""}`, x: water, y: yieldKg };
  });

  React.useEffect(()=>{
    // Bar: variété (kg)
    const ctx1 = document.getElementById('chartVarietyKg');
    if (ctx1) new Chart(ctx1, {
      type: 'bar',
      data: { labels: byVariety.map(x=>x.key), datasets: [{ label:'kg', data: byVariety.map(x=>x.value.kg) }] },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
    // Bar: variété (pcs)
    const ctx1b = document.getElementById('chartVarietyPcs');
    if (ctx1b) new Chart(ctx1b, {
      type: 'bar',
      data: { labels: byVariety.map(x=>x.key), datasets: [{ label:'pcs', data: byVariety.map(x=>x.value.pcs) }] },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
    // Bar: parcelle (kg)
    const ctx2 = document.getElementById('chartParcel');
    if (ctx2) new Chart(ctx2, {
      type: 'bar',
      data: { labels: byParcel.map(x=>x.key), datasets: [{ label:'kg', data: byParcel.map(x=>x.value) }] },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
    // Scatter: eau vs rendement
    const ctx3 = document.getElementById('chartWaterYield');
    if (ctx3) new Chart(ctx3, {
      type: 'scatter',
      data: { datasets: [{ label: 'Eau (L) vs Poids (kg)', data: waterVsYield.map(p=>({x:p.x, y:p.y})) }] },
      options: {
        responsive:true,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(ctx)=>`Eau ${ctx.raw.x} L · ${ctx.raw.y} kg`} } },
        scales:{ x:{ title:{ display:true, text:'Eau totale (L)'} }, y:{ title:{ display:true, text:'Poids total (kg)'} } }
      }
    });
  }, [C.db]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="bg-white rounded-2xl shadow p-4">
        <h3 className="font-semibold mb-2">Poids par variété</h3>
        <canvas id="chartVarietyKg" height="180"></canvas>
        <table className="mt-3 text-sm w-full">
          <thead><tr><th className="text-left p-2">Variété</th><th className="text-right p-2">kg</th><th className="text-right p-2">pcs</th></tr></thead>
          <tbody>
            {byVariety.map(x=>(
              <tr key={x.key} className="border-t">
                <td className="p-2">{x.key}</td>
                <td className="p-2 text-right">{x.value.kg.toFixed(2)}</td>
                <td className="p-2 text-right">{x.value.pcs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-2xl shadow p-4">
        <h3 className="font-semibold mb-2">Nombre de fruits/légumes par variété</h3>
        <canvas id="chartVarietyPcs" height="180"></canvas>
      </section>

      <section className="bg-white rounded-2xl shadow p-4 lg:col-span-2">
        <h3 className="font-semibold mb-2">Poids par parcelle</h3>
        <canvas id="chartParcel" height="200"></canvas>
      </section>

      <section className="bg-white rounded-2xl shadow p-4 lg:col-span-2">
        <h3 className="font-semibold mb-2">Corrélation Arrosage ↔ Rendement</h3>
        <canvas id="chartWaterYield" height="220"></canvas>
        <p className="text-xs text-slate-500 mt-2">
          Chaque point = un plant. X: eau totale (L), Y: poids total (kg). Indices seulement (impact climat/sol/variété).
        </p>
      </section>

      <section className="bg-white rounded-2xl shadow p-4 lg:col-span-2">
        <h3 className="font-semibold mb-2">Export</h3>
        <button className="px-3 py-1.5 rounded bg-slate-900 text-white" onClick={()=>{
          const blob = new Blob([JSON.stringify(C.db, null, 2)], {type:'application/json'});
          const url = URL.createObjectURL(blob); const a = document.createElement('a');
          a.href = url; a.download = 'garden-db.json'; a.click(); URL.revokeObjectURL(url);
        }}>Exporter JSON (tout)</button>
      </section>
    </div>
  );
}

function aggregate(items, keyFn, valObjFn){
  const map = new Map();
  items.forEach(p=>{
    const key = keyFn(p);
    const val = valObjFn(p);
    const cur = map.get(key) || { kg:0, pcs:0 };
    map.set(key, { kg: cur.kg + (val.kg||0), pcs: cur.pcs + (val.pcs||0) });
  });
  return Array.from(map.entries()).map(([key,value])=>({key,value})).sort((a,b)=>b.value.kg - a.value.kg);
}
function sum(arr){ return arr.reduce((s,x)=>s+(Number(x)||0),0); }
function aggregateParcels(){
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