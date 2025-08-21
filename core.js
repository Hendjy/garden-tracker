// core.js — noyau de données (sans JSX) — VERSION 3
// Schéma v3:
// {
//   version: 3,
//   weather: { lat, lon },
//   plants: { [id]: {id,name,variety,emoji,plantedAt,notes,photos,waterings,harvests} },
//   parcels: {
//     [parcelId]: {
//       id, name, rows, cols,
//       grid[r][c] = { plantId: string|null, layers: { path?:bool, mulch?:bool }, history: [{ts, plantId}] }
//     }
//   },
//   currentParcelId: string
// }

(function(){
  const LS_V1 = "garden-tracker-state-v1";
  const LS_V2 = "garden-tracker-state-v2";
  const LS_V3 = "garden-tracker-state-v3";

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function today(){ return new Date().toISOString().slice(0,10); }

  function makeCell(plantId=null){
    const h = [];
    if (plantId !== null) h.push({ ts: today(), plantId });
    return { plantId, layers: {}, history: h };
  }

  function migrateToV3(db) {
    if (!db) return fresh();
    if (db.version === 3) return db;
    // v2 -> v3
    if (db.version === 2) {
      Object.values(db.parcels).forEach(par=>{
        par.grid = par.grid.map(row => row.map(cell => {
          const pid = (cell && "plantId" in cell) ? cell.plantId : null;
          const layers = (cell && cell.layers) ? cell.layers : {};
          const history = (pid!==null) ? [{ ts: (db.plants[pid]?.plantedAt || today()), plantId: pid }] : [];
          return { plantId: pid, layers, history };
        }));
      });
      db.version = 3;
      return db;
    }
    // v1 -> v2 -> v3
    if (!db.version) {
      // v1 layout
      const pid = uid();
      const rows = db.rows || 8, cols = db.cols || 12;
      const gridV2 = (db.grid && db.grid.length)
        ? db.grid.map(row => row.map(cell => ({ plantId: cell?.plantId ?? null, layers: {} })))
        : Array.from({length: rows}, () => Array.from({length: cols}, () => ({ plantId:null, layers:{} })));
      const db2 = {
        version: 2,
        weather: { lat: 48.8566, lon: 2.3522, ...(db.weather||{}) },
        plants: db.plants || {},
        parcels: { [pid]: { id: pid, name: "Parcelle A", rows, cols, grid: gridV2 } },
        currentParcelId: pid
      };
      return migrateToV3(db2);
    }
    return fresh();
  }

  function fresh(){
    const pid = uid();
    return {
      version: 3,
      weather: { lat: 48.8566, lon: 2.3522 },
      plants: {},
      parcels: {
        [pid]: {
          id: pid, name: "Parcelle A", rows: 8, cols: 12,
          grid: Array.from({length:8}, () => Array.from({length:12}, () => makeCell()))
        }
      },
      currentParcelId: pid
    };
  }

  function load() {
    const raw3 = localStorage.getItem(LS_V3);
    if (raw3) { try { return JSON.parse(raw3); } catch{} }
    const raw2 = localStorage.getItem(LS_V2);
    if (raw2) { try { return migrateToV3(JSON.parse(raw2)); } catch{} }
    const raw1 = localStorage.getItem(LS_V1);
    if (raw1) { try { return migrateToV3(JSON.parse(raw1)); } catch{} }
    return fresh();
  }

  function save(state){ localStorage.setItem(LS_V3, JSON.stringify(state)); }

  const db = migrateToV3(load());
  save(db);

  // ——— Parcelles ———
  function getCurrentParcel(){ return db.parcels[db.currentParcelId]; }
  function setCurrentParcel(id){ if (db.parcels[id]) { db.currentParcelId = id; save(db); } }
  function addParcel({name, rows, cols}){
    const id = uid();
    db.parcels[id] = {
      id, name: name || `Parcelle ${Object.keys(db.parcels).length+1}`,
      rows: rows||8, cols: cols||12,
      grid: Array.from({length: rows||8}, () => Array.from({length: cols||12}, () => makeCell()))
    };
    db.currentParcelId = id; save(db); return id;
  }
  function removeParcel(id){
    if (!db.parcels[id]) return;
    if (Object.keys(db.parcels).length === 1) return; // garder au moins une
    delete db.parcels[id];
    if (!db.parcels[db.currentParcelId]) db.currentParcelId = Object.keys(db.parcels)[0];
    save(db);
  }
  function resizeParcel(id, rows, cols){
    const p = db.parcels[id]; if (!p) return;
    let g = p.grid.slice(0, rows);
    while (g.length < rows) g.push(Array.from({length: cols}, () => makeCell()));
    g = g.map(row => {
      const r = row.slice(0, cols);
      while (r.length < cols) r.push(makeCell());
      return r;
    });
    p.rows = rows; p.cols = cols; p.grid = g; save(db);
  }
  function placePlant(r,c,plantId){
    const p = getCurrentParcel(); if (!p) return;
    const cell = p.grid[r][c];
    cell.plantId = plantId;
    cell.history.unshift({ ts: today(), plantId }); // historique (dernier en tête)
    save(db);
  }
  function clearCell(r,c){
    const p = getCurrentParcel(); const cell = p.grid[r][c];
    cell.plantId = null;
    cell.history.unshift({ ts: today(), plantId: null });
    save(db);
  }
  function toggleLayer(r,c,key){
    const p = getCurrentParcel(); const cell = p.grid[r][c];
    cell.layers[key] = !cell.layers[key]; save(db);
  }

  // ——— Plants ———
  function addPlant(plant){
    const id = uid();
    db.plants[id] = {
      id,
      name: plant.name?.trim() || "Plant",
      variety: plant.variety?.trim() || "",
      emoji: plant.emoji?.trim() || "🌱",
      plantedAt: plant.plantedAt || today(),
      notes: plant.notes || "",
      photos: [],
      waterings: [], // {id,date,amountL,notes}
      harvests: []   // {id,date,qty,weightKg,notes}
    };
    save(db); return id;
  }
  function updatePlant(id, patch){ if (!db.plants[id]) return; db.plants[id] = { ...db.plants[id], ...patch }; save(db); }
  function deletePlant(id){
    if (!db.plants[id]) return;
    Object.values(db.parcels).forEach(par=>{
      par.grid = par.grid.map(row => row.map(cell => {
        if (cell.plantId === id) cell.plantId = null;
        return cell;
      }));
    });
    delete db.plants[id]; save(db);
  }
  function addWatering(plantId, rec){
    const p = db.plants[plantId]; if (!p) return;
    p.waterings.unshift({ id: uid(), date: rec.date, amountL: Number(rec.amountL)||0, notes: rec.notes||"" });
    save(db);
  }
  function addHarvest(plantId, rec){
    const p = db.plants[plantId]; if (!p) return;
    p.harvests.unshift({ id: uid(), date: rec.date, qty: Number(rec.qty)||0, weightKg: Number(rec.weightKg)||0, notes: rec.notes||"" });
    save(db);
  }
  function addPhoto(plantId, rec){
    const p = db.plants[plantId]; if (!p) return;
    p.photos.unshift({ id: uid(), url: rec.url, caption: rec.caption||"" }); save(db);
  }

  // ——— Rotation ———
  // Retourne { "r,c": [{year, plantName}] } à partir de l'historique
  function rotationHistory(parcelId, yearsBack=5){
    const par = db.parcels[parcelId]; if (!par) return {};
    const out = {};
    for (let r=0; r<par.rows; r++){
      for (let c=0; c<par.cols; c++){
        const key = `${r},${c}`;
        const hist = par.grid[r][c].history || [];
        const arr = [];
        hist.forEach(h=>{
          if (!h || h.plantId===null) return;
          const p = db.plants[h.plantId]; if (!p) return;
          const y = (h.ts||p.plantedAt||"").slice(0,4);
          if (!arr.find(x=>x.year===y)) arr.push({ year: y, plantName: p.name });
        });
        out[key] = arr.slice(0, yearsBack);
      }
    }
    return out;
  }

  // ——— Météo ———
  async function fetchRain(lat, lon, days=14){
    const end = new Date();
    const start = new Date(Date.now() - (days-1)*24*3600*1000);
    const fmt = d => d.toISOString().slice(0,10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=precipitation_sum&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    return (json?.daily?.time||[]).map((t,i)=>({ date: t, rain_mm: json.daily.precipitation_sum[i] }));
  }

  // ——— Arrosage ———
  // Renvoie des suggestions par plant selon la pluie récente et le dernier arrosage
  function wateringSuggestions(dailyRain, rainThresholdMm=5, daysWindow=3, maxAgeDays=2){
    // dailyRain: [{date:'YYYY-MM-DD', rain_mm}]
    const rainMap = new Map(dailyRain.map(d=>[d.date, Number(d.rain_mm)||0]));
    const lastNDates = [...rainMap.keys()].sort().slice(-daysWindow);
    const rainSum = lastNDates.reduce((s,d)=>s+(rainMap.get(d)||0),0);

    const out = [];
    Object.values(db.plants).forEach(p=>{
      const lastWater = p.waterings[0]?.date || null;
      const daysSince = lastWater ? Math.floor((Date.now() - new Date(lastWater).getTime()) / 86400000) : Infinity;
      const need = (rainSum < rainThresholdMm) && (daysSince > maxAgeDays);
      out.push({ plantId: p.id, name: p.name, variety: p.variety, lastWater, daysSince, rainSum, need });
    });
    return out.sort((a,b)=> (b.need?1:0)-(a.need?1:0) || (b.daysSince||0)-(a.daysSince||0));
  }

  window.GardenCore = {
    db, save, uid,
    getCurrentParcel, setCurrentParcel, addParcel, removeParcel, resizeParcel,
    placePlant, clearCell, toggleLayer,
    addPlant, updatePlant, deletePlant, addWatering, addHarvest, addPhoto,
    rotationHistory, fetchRain, wateringSuggestions
  };
})();