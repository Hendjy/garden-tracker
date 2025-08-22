// core.js — Noyau v4 : profils (multi-comptes) + localisation par parcelle + photos
(function(){
  // ---------- PROFILS (multi-comptes) ----------
  const PROFILE_INDEX_KEY = "garden-profiles-index-v1"; // {currentId, list:[{id,name}]}
  const DB_KEY_FOR = (id)=>`garden-db-v4-${id}`;

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function today(){ return new Date().toISOString().slice(0,10); }

  function loadProfiles(){
    const raw = localStorage.getItem(PROFILE_INDEX_KEY);
    if(raw){ try { return JSON.parse(raw); } catch{} }
    // créer un index par défaut
    const id = uid();
    const index = { currentId: id, list: [{ id, name: "Mon jardin" }] };
    localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index));
    // créer la DB du profil
    localStorage.setItem(DB_KEY_FOR(id), JSON.stringify(freshDB("Mon jardin")));
    return index;
  }
  function saveProfiles(index){ localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index)); }

  function listProfiles(){ return loadProfiles().list; }
  function getCurrentProfileId(){ return loadProfiles().currentId; }
  function setCurrentProfile(id){
    const idx = loadProfiles();
    if(!idx.list.find(p=>p.id===id)) return;
    idx.currentId = id; saveProfiles(idx);
    // recharger la db active
    active.db = migrate(loadActiveDB());
  }
  function addProfile(name="Nouveau jardin"){
    const idx = loadProfiles();
    const id = uid();
    idx.list.push({ id, name }); idx.currentId = id; saveProfiles(idx);
    localStorage.setItem(DB_KEY_FOR(id), JSON.stringify(freshDB(name)));
    active.db = migrate(loadActiveDB());
    return id;
  }
  function renameProfile(id, name){
    const idx = loadProfiles(); const p = idx.list.find(x=>x.id===id); if(!p) return; p.name = name; saveProfiles(idx);
  }
  function removeProfile(id){
    const idx = loadProfiles();
    if(idx.list.length<=1) return; // garder au moins 1
    idx.list = idx.list.filter(p=>p.id!==id);
    if(idx.currentId===id) idx.currentId = idx.list[0].id;
    saveProfiles(idx);
    localStorage.removeItem(DB_KEY_FOR(id));
    active.db = migrate(loadActiveDB());
  }
  function loadActiveDB(){
    const id = getCurrentProfileId();
    const raw = localStorage.getItem(DB_KEY_FOR(id));
    if(raw){ try { return JSON.parse(raw); } catch{} }
    const db = freshDB("Jardin");
    localStorage.setItem(DB_KEY_FOR(id), JSON.stringify(db));
    return db;
  }
  function saveActiveDB(db){
    const id = getCurrentProfileId();
    localStorage.setItem(DB_KEY_FOR(id), JSON.stringify(db));
  }

  // ---------- DB ----------
  // v4: ajoute {lat,lon} sur chaque parcelle + historique (déjà v3) + iconUrl
  function freshDB(profileName){
    const parcelId = uid();
    return {
      version: 4,
      profileName,
      plants: {},
      parcels: {
        [parcelId]: {
          id: parcelId, name: "Parcelle A", rows: 8, cols: 12,
          lat: null, lon: null, // << localisation par parcelle
          grid: Array.from({length:8}, ()=>Array.from({length:12}, ()=>makeCell()))
        }
      },
      currentParcelId: parcelId
    };
  }
  function makeCell(plantId=null){
    const h=[]; if(plantId!==null) h.push({ts:today(), plantId});
    return { plantId, layers:{}, history:h };
  }

  function migrate(db){
    if(!db || !db.version) return freshDB("Jardin");
    if(db.version===4){
      // assurer lat/lon
      Object.values(db.parcels).forEach(p=>{
        if(typeof p.lat==="undefined") p.lat = null;
        if(typeof p.lon==="undefined") p.lon = null;
      });
      Object.values(db.plants).forEach(pl=>{ if(pl.iconUrl===undefined) pl.iconUrl=""; });
      return db;
    }
    // v3 -> v4
    if(db.version===3){
      Object.values(db.parcels).forEach(p=>{ if(typeof p.lat==="undefined") p.lat=null; if(typeof p.lon==="undefined") p.lon=null; });
      db.version = 4; return db;
    }
    return db;
  }

  const active = { db: migrate(loadActiveDB()) };

  // ---------- Parcelles ----------
  function getCurrentParcel(){ return active.db.parcels[active.db.currentParcelId]; }
  function setCurrentParcel(id){ if(active.db.parcels[id]) { active.db.currentParcelId=id; saveActiveDB(active.db); } }
  function addParcel({name, rows, cols}){
    const id = uid();
    active.db.parcels[id] = {
      id, name: name||`Parcelle ${Object.keys(active.db.parcels).length+1}`,
      rows: rows||8, cols: cols||12, lat:null, lon:null,
      grid: Array.from({length:rows||8}, ()=>Array.from({length:cols||12}, ()=>makeCell()))
    };
    active.db.currentParcelId = id; saveActiveDB(active.db); return id;
  }
  function removeParcel(id){
    if(!active.db.parcels[id]) return;
    if(Object.keys(active.db.parcels).length<=1) return;
    delete active.db.parcels[id];
    if(!active.db.parcels[active.db.currentParcelId]) active.db.currentParcelId = Object.keys(active.db.parcels)[0];
    saveActiveDB(active.db);
  }
  function resizeParcel(id, rows, cols){
    const p = active.db.parcels[id]; if(!p) return;
    let g = p.grid.slice(0, rows);
    while(g.length<rows) g.push(Array.from({length:cols}, ()=>makeCell()));
    g = g.map(row=>{
      const r=row.slice(0,cols);
      while(r.length<cols) r.push(makeCell());
      return r;
    });
    p.rows=rows; p.cols=cols; p.grid=g; saveActiveDB(active.db);
  }
  function setParcelLocation(id, lat, lon){
    const p = active.db.parcels[id]; if(!p) return; p.lat = lat; p.lon = lon; saveActiveDB(active.db);
  }
  function placePlant(r,c,plantId){
    const p=getCurrentParcel(); const cell=p.grid[r][c]; cell.plantId=plantId; cell.history.unshift({ts:today(), plantId}); saveActiveDB(active.db);
  }
  function clearCell(r,c){
    const p=getCurrentParcel(); const cell=p.grid[r][c]; cell.plantId=null; cell.history.unshift({ts:today(), plantId:null}); saveActiveDB(active.db);
  }
  function toggleLayer(r,c,key){
    const p=getCurrentParcel(); const cell=p.grid[r][c]; cell.layers[key]=!cell.layers[key]; saveActiveDB(active.db);
  }

  // ---------- Plants ----------
  function addPlant(plant){
    const id=uid();
    active.db.plants[id]={
      id,
      name: plant.name?.trim()||"Plant",
      variety: plant.variety?.trim()||"",
      emoji: plant.emoji?.trim()||"🌱",
      iconUrl: plant.iconUrl||"",
      plantedAt: plant.plantedAt || today(),
      notes: plant.notes||"",
      photos: [],     // {id,url,caption,ts}
      waterings: [],  // {id,date,amountL,notes}
      harvests: []    // {id,date,qty,weightKg,notes}
    };
    saveActiveDB(active.db); return id;
  }
  function updatePlant(id, patch){ if(!active.db.plants[id]) return; active.db.plants[id] = { ...active.db.plants[id], ...patch }; saveActiveDB(active.db); }
  function deletePlant(id){
    if(!active.db.plants[id]) return;
    Object.values(active.db.parcels).forEach(par=>{
      par.grid = par.grid.map(row=>row.map(cell=>{ if(cell.plantId===id) cell.plantId=null; return cell; }));
    });
    delete active.db.plants[id]; saveActiveDB(active.db);
  }
  function addWatering(id, rec){ const p=active.db.plants[id]; if(!p) return; p.waterings.unshift({ id:uid(), date:rec.date, amountL:Number(rec.amountL)||0, notes:rec.notes||"" }); saveActiveDB(active.db); }
  function addHarvest(id, rec){ const p=active.db.plants[id]; if(!p) return; p.harvests.unshift({ id:uid(), date:rec.date, qty:Number(rec.qty)||0, weightKg:Number(rec.weightKg)||0, notes:rec.notes||"" }); saveActiveDB(active.db); }
  function addPhoto(id, rec){ const p=active.db.plants[id]; if(!p) return; p.photos.unshift({ id:uid(), url:rec.url, caption:rec.caption||"", ts: Date.now() }); saveActiveDB(active.db); }
  function removePhoto(id, photoId){ const p=active.db.plants[id]; if(!p) return; p.photos = p.photos.filter(ph=>ph.id!==photoId); saveActiveDB(active.db); }

  // ---------- Rotation ----------
  function rotationHistory(parcelId, yearsBack=5){
    const par = active.db.parcels[parcelId]; if(!par) return {};
    const out={};
    for(let r=0;r<par.rows;r++){
      for(let c=0;c<par.cols;c++){
        const key=`${r},${c}`; const hist=par.grid[r][c].history||[]; const arr=[];
        hist.forEach(h=>{ if(!h||h.plantId===null) return; const pl=active.db.plants[h.plantId]; if(!pl) return;
          const y=(h.ts||pl.plantedAt||"").slice(0,4); if(!arr.find(x=>x.year===y)) arr.push({year:y, plantName:pl.name});
        });
        out[key]=arr.slice(0,yearsBack);
      }
    }
    return out;
  }

  // ---------- Météo ----------
  async function fetchRain(lat, lon, pastDays=14, nextDays=7){
    const iso=d=>d.toISOString().slice(0,10);
    const start=new Date(Date.now()-(pastDays-1)*86400000);
    const end  =new Date(Date.now()+ nextDays   *86400000);
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${iso(start)}&end_date=${iso(end)}&daily=precipitation_sum&timezone=auto`;
    const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); const j=await r.json();
    const all=(j?.daily?.time||[]).map((t,i)=>({date:t,rain_mm:Number(j.daily.precipitation_sum[i]||0)}));
    const today=iso(new Date());
    return { past: all.filter(d=>d.date<=today), forecast: all.filter(d=>d.date>today) };
  }

  // ---------- Export API ----------
  window.GardenCore = {
    // profil
    profile: {
      listProfiles, addProfile, removeProfile, renameProfile,
      getCurrentProfileId, setCurrentProfile, get index(){ return loadProfiles(); }
    },
    // db active
    db: active.db, save: saveActiveDB, uid,
    // parcelles
    getCurrentParcel, setCurrentParcel, addParcel, removeParcel, resizeParcel, setParcelLocation,
    placePlant, clearCell, toggleLayer,
    // plants
    addPlant, updatePlant, deletePlant, addWatering, addHarvest, addPhoto, removePhoto,
    // rotation & météo
    rotationHistory, fetchRain
  };
})();