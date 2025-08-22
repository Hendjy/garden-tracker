// core.js — noyau de données v4
// Nouveaux points clés :
// - Localisation par PARCELLE: parcels[id].lat / .lon
// - Photos par plant: addPhoto(plantId, {url, caption})
// - Multi-profils locaux: clé LocalStorage selon ?profile=XXX (ou profil mémorisé)

(function(){
  // ----- profils locaux -----
  const urlParams = new URLSearchParams(location.search);
  const profileFromUrl = urlParams.get("profile");
  const LS_PROFILE_KEY = "gt_profile";
  const currentProfile = (profileFromUrl || localStorage.getItem(LS_PROFILE_KEY) || "default").trim() || "default";
  localStorage.setItem(LS_PROFILE_KEY, currentProfile);

  function storageKey(suffix){ return `garden-${currentProfile}-${suffix}`; }
  const LS_V3 = storageKey("state-v3"); // rétro
  const LS_V4 = storageKey("state-v4"); // courant

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function today(){ return new Date().toISOString().slice(0,10); }

  function makeCell(plantId=null){
    const h=[]; if(plantId!==null) h.push({ ts: today(), plantId });
    return { plantId, layers:{}, history:h };
  }

  function fresh(){
    const pid = uid();
    return {
      version: 4,
      // météo globale n'est plus utilisée; on passe par la parcelle
      plants: {},
      parcels: {
        [pid]: {
          id: pid, name: "Parcelle A",
          rows: 8, cols: 12,
          lat: 48.8566, lon: 2.3522,  // localisation par défaut
          grid: Array.from({length:8},()=>Array.from({length:12},()=>makeCell()))
        }
      },
      currentParcelId: pid
    };
  }

  function migrateToV4(db){
    if(!db) return fresh();
    if(db.version===4) return db;
    // v3 -> v4 : ajouter lat/lon aux parcelles, retirer db.weather
    if(db.version===3 || db.version===2 || !db.version){
      Object.values(db.parcels||{}).forEach(par=>{
        if(typeof par.lat!=="number") par.lat = 48.8566;
        if(typeof par.lon!=="number") par.lon = 2.3522;
        // cells -> ensure history
        par.grid = par.grid.map(row => row.map(cell=>{
          const pid = (cell && "plantId" in cell) ? cell.plantId : null;
          const layers = (cell && cell.layers) ? cell.layers : {};
          const history = (cell && cell.history) ? cell.history : (pid!==null ? [{ts: today(), plantId: pid}] : []);
          return { plantId: pid, layers, history };
        }));
      });
      delete db.weather; // on migre la météo vers parcelle
      db.version = 4;
      return db;
    }
    return fresh();
  }

  function load(){
    const raw4 = localStorage.getItem(LS_V4);
    if(raw4){ try{ return JSON.parse(raw4); }catch{} }
    const raw3 = localStorage.getItem(LS_V3);
    if(raw3){ try{ return migrateToV4(JSON.parse(raw3)); }catch{} }
    return fresh();
  }
  function save(state){ localStorage.setItem(LS_V4, JSON.stringify(state)); }

  const db = migrateToV4(load());
  // Normalisation plants (iconUrl, arrays)
  Object.values(db.plants).forEach(p=>{
    if(p.iconUrl===undefined) p.iconUrl="";
    if(!Array.isArray(p.photos)) p.photos=[];
    if(!Array.isArray(p.waterings)) p.waterings=[];
    if(!Array.isArray(p.harvests)) p.harvests=[];
  });
  save(db);

  // ----- Parcelles -----
  function getCurrentParcel(){ return db.parcels[db.currentParcelId]; }
  function setCurrentParcel(id){ if(db.parcels[id]){ db.currentParcelId=id; save(db); } }
  function setParcelLocation(id, lat, lon){
    const p=db.parcels[id]; if(!p) return;
    p.lat = Number(lat)||p.lat; p.lon = Number(lon)||p.lon; save(db);
  }
  function addParcel({name, rows, cols, lat=48.8566, lon=2.3522}){
    const id=uid();
    db.parcels[id]={ id, name: name||`Parcelle ${Object.keys(db.parcels).length+1}`,
      rows: rows||8, cols: cols||12, lat, lon,
      grid: Array.from({length:rows||8},()=>Array.from({length:cols||12},()=>makeCell()))
    };
    db.currentParcelId=id; save(db); return id;
  }
  function removeParcel(id){
    if(!db.parcels[id]) return;
    if(Object.keys(db.parcels).length===1) return; // au moins 1
    delete db.parcels[id];
    if(!db.parcels[db.currentParcelId]) db.currentParcelId=Object.keys(db.parcels)[0];
    save(db);
  }
  function resizeParcel(id, rows, cols){
    const p=db.parcels[id]; if(!p) return;
    let g=p.grid.slice(0,rows);
    while(g.length<rows) g.push(Array.from({length:cols},()=>makeCell()));
    g=g.map(row=>{
      const r=row.slice(0,cols);
      while(r.length<cols) r.push(makeCell());
      return r;
    });
    p.rows=rows; p.cols=cols; p.grid=g; save(db);
  }
  function placePlant(r,c,plantId){
    const p=getCurrentParcel(); if(!p) return;
    const cell=p.grid[r][c]; cell.plantId=plantId; cell.history.unshift({ts:today(), plantId}); save(db);
  }
  function clearCell(r,c){
    const p=getCurrentParcel(); const cell=p.grid[r][c];
    cell.plantId=null; cell.history.unshift({ts:today(), plantId:null}); save(db);
  }
  function toggleLayer(r,c,key){
    const p=getCurrentParcel(); const cell=p.grid[r][c];
    cell.layers[key]=!cell.layers[key]; save(db);
  }

  // ----- Plants -----
  function addPlant(plant){
    const id=uid();
    db.plants[id]={
      id,
      name: plant.name?.trim()||"Plant",
      variety: plant.variety?.trim()||"",
      emoji: plant.emoji?.trim()||"🌱",
      iconUrl: plant.iconUrl||"",
      plantedAt: plant.plantedAt||today(),
      notes: plant.notes||"",
      photos: [], waterings: [], harvests: []
    };
    save(db); return id;
  }
  function updatePlant(id, patch){ if(!db.plants[id]) return; db.plants[id]={...db.plants[id], ...patch}; save(db); }
  function deletePlant(id){
    if(!db.plants[id]) return;
    Object.values(db.parcels).forEach(par=>{
      par.grid=par.grid.map(row=>row.map(cell=>{ if(cell.plantId===id) cell.plantId=null; return cell; }));
    });
    delete db.plants[id]; save(db);
  }
  function addWatering(plantId, rec){
    const p=db.plants[plantId]; if(!p) return;
    p.waterings.unshift({ id: uid(), date: rec.date, amountL: Number(rec.amountL)||0, notes: rec.notes||"" });
    save(db);
  }
  function addHarvest(plantId, rec){
    const p=db.plants[plantId]; if(!p) return;
    p.harvests.unshift({ id: uid(), date: rec.date, qty: Number(rec.qty)||0, weightKg: Number(rec.weightKg)||0, notes: rec.notes||"" });
    save(db);
  }
  function addPhoto(plantId, rec){
    const p=db.plants[plantId]; if(!p) return;
    p.photos.unshift({ id: uid(), url: rec.url, caption: rec.caption||"", date: rec.date||today() });
    save(db);
  }

  // ----- Rotation -----
  function rotationHistory(parcelId, yearsBack=5){
    const par=db.parcels[parcelId]; if(!par) return {};
    const out={};
    for(let r=0;r<par.rows;r++){
      for(let c=0;c<par.cols;c++){
        const key=`${r},${c}`; const hist=par.grid[r][c].history||[]; const arr=[];
        hist.forEach(h=>{
          if(!h||h.plantId===null) return;
          const p=db.plants[h.plantId]; if(!p) return;
          const y=(h.ts||p.plantedAt||"").slice(0,4);
          if(!arr.find(x=>x.year===y)) arr.push({year:y, plantName:p.name});
        });
        out[key]=arr.slice(0,yearsBack);
      }
    }
    return out;
  }

  // ----- Météo (helpers) -----
  async function fetchRain(lat, lon, startISO, endISO){
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startISO}&end_date=${endISO}&daily=precipitation_sum&timezone=auto`;
    const res=await fetch(url); if(!res.ok) throw new Error("HTTP "+res.status);
    const j=await res.json();
    return (j?.daily?.time||[]).map((t,i)=>({date:t, rain_mm:Number(j.daily.precipitation_sum[i]||0)}));
  }

  window.GardenCore = {
    // state
    db, save, uid, currentProfile,
    // parcels
    getCurrentParcel, setCurrentParcel, setParcelLocation,
    addParcel, removeParcel, resizeParcel, placePlant, clearCell, toggleLayer,
    // plants
    addPlant, updatePlant, deletePlant, addWatering, addHarvest, addPhoto,
    // rotation & météo helpers
    rotationHistory, fetchRain
  };
})();