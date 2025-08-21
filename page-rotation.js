const C = window.GardenCore;

function RotationView(){
  const [, setTick] = React.useState(0);
  const par = C.getCurrentParcel();
  function refresh(){ setTick(t=>t+1); }

  const hist = C.rotationHistory(par.id, 5);
  const years = new Set();
  Object.values(C.db.plants).forEach(p=>{ if(p.plantedAt) years.add(p.plantedAt.slice(0,4)); });
  const yearList = Array.from(years).sort().reverse().slice(0,5);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <span className="font-semibold">Parcelle :</span>
        <select className="border rounded px-2 py-1"
                value={C.db.currentParcelId}
                onChange={(e)=>{C.setCurrentParcel(e.target.value); refresh();}}>
          {Object.values(C.db.parcels).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Cellule</th>
              {yearList.map(y=><th key={y} className="text-left p-2">{y}</th>)}
              <th className="text-left p-2">Alerte</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({length: par.rows}).map((_,r)=>(
              Array.from({length: par.cols}).map((__,c)=>{
                const key = `${r},${c}`;
                const row = hist[key]||[];
                const current = row[0];
                // alerte simple: éviter même culture 2 années de suite
                const warn = current ? row.filter(x=>x.plantName===current.plantName).length>1 : false;
                return (
                  <tr key={key} className="border-t">
                    <td className="p-2">{r+1},{c+1}</td>
                    {yearList.map(y=>{
                      const found = row.find(x=>x.year===y);
                      return <td key={y} className="p-2">{found?found.plantName:"—"}</td>;
                    })}
                    <td className={`p-2 ${warn?'text-red-600':''}`}>{warn?'Éviter même famille':'OK'}</td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">Astuce : vise une rotation minimum de 3–4 ans pour une même famille (Solanacées, Brassicacées, Fabacées…).</p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<RotationView />);