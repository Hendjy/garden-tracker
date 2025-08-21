// core.js — noyau de données commun (sans JSX)
// Schéma v2:
// {
//   version: 2,
//   weather: { lat, lon },
//   plants: { [id]: {id,name,variety,emoji,plantedAt,notes,photos,waterings,harvests} },
//   parcels: {
//     [parcelId]: {
//       id, name, rows, cols,
//       // grid[r][c] = { plantId: string|null, layers: { path?:bool, mulch?:bool } }
//       grid: Array<Array<{plantId:string|null, layers:Object}>>
//     }
//   },
//   currentParcelId: string
// }

(function(){
  const LS_KEY_V1 = "garden-tracker-state-v1";
  const LS_KEY_V2 = "garden-tracker-state-v2";

  function uid(){ return Math.random().toString(36).slice(2,10); }

  function load() {
    // v2 prioritaire
    const v2 = localStorage.getItem(LS_KEY_V2);
    if (v2) {
      try { return JSON.parse(v2); } catch {}
    }
    // migrer v1 -> v2 si présent
    const v1raw = localStorage.getItem(LS_KEY_V1);
    if (v1raw) {
      try {
        const v1 = JSON.parse(v1raw);
        const pid = uid();
        const rows = v1.rows || 8;
        const cols = v1.cols || 12;
        const grid = (v1.grid && v1.grid.length)
          ? v1.grid.map(row => row.map(cell => ({
              plantId: cell?.plantId ?? null,
              layers: {}
            })))
          : Array.from({length: rows}, () => Array.from({length: cols}, () => ({ plantId:null, layers:{} })));

        return {
          version: 2,
          weather: { lat: 48.8566, lon: 2.3522, ...(v1.weather||{}) },
          plants: v1.plants || {},
          parcels: {
            [pid]: { id: pid, name: "Parcelle A", rows, cols, grid }
          },
          currentParcelId: pid
        };
      } catch {}
    }
    // sinon état neuf
    const pid = uid();
    return {
      version: 2,
      weather: { lat: 48.8566, lon: 2.3522 },
      plants: {},
      parcels: {
        [pid]: {
          id: pid, name: "Parcelle A", rows: 8, cols: 12,
          grid: Array.from({length:8}, () => Array.from({length:12}, () => ({ plantId:null, layers:{} })))
        }
      },
      currentParcelId: pid
    };
  }

  function save(state) {
    localStorage.setItem(LS_KEY_V2, JSON.stringify(state));
  }

  const db = load();

  // ——— Helpers Parcelles ———
  function getCurrentParcel() { return db.parcels[db.currentParcelId]; }
  function setCurrentParcel(id) { if (db.parcels[id]) { db.currentParcelId = id; save(db); } }
  function addParcel({name, rows, cols}) {
    const id = uid();
    db.parcels[id] = {
      id, name: name||`Parcelle ${Object.keys(db.parcels).length+1}`,
      rows: rows||8, cols: cols||12,
      grid: Array.from({length: rows||8}, () => Array.from({length: cols||12}, () => ({ plantId:null, layers:{} })))
    };
    db.currentParcelId = id;
    save(db);
    return id;
  }
  function removeParcel(id) {
    if (!db.parcels[id]) return;
    // empêcher suppression de la dernière
    if (Object.keys(db.parcels).length === 1) return;
    delete db.parcels[id];
    if (!db.parcels[db.currentParcelId]) db.currentParcelId = Object.keys(db.parcels)[0];
    save(db);
  }
  function resizeParcel(id, rows, cols) {
    const p = db.parcels[id]; if (!p) return;
    // re-dimensionner
    let g = p.grid.slice(0, rows);
    while (g.length < rows) g.push(Array.from({length: cols}, () => ({ plantId:null, layers:{} })));
    g = g.map(row => {
      const r = row.slice(0, cols);
      while (r.length < cols) r.push({ plantId:null, layers:{} });
      return r;
    });
    p.rows = rows; p.cols = cols; p.grid = g;
    save(db);
  }
  function placePlant(r, c, plantId) {
    const p = getCurrentParcel();
    if (!p) return;
    p.grid[r][c].plantId = plantId;
    save(db);
  }
  function clearCell(r, c) {
    const p = getCurrentParcel();
    p.grid[r][c].plantId = null;
    save(db);
  }
  function toggleLayer(r, c, key) {
    const p = getCurrentParcel();
    const cell = p.grid[r][c];
    cell.layers[key] = !cell.layers[key];
    save(db);
  }

  // ——— Helpers Plants ———
  function addPlant(plant) {
    const id = uid();
    db.plants[id] = {
      id,
      name: plant.name?.trim() || "Plant",
      variety: plant.variety?.trim() || "",
      emoji: plant.emoji?.trim() || "🌱",
      plantedAt: plant.plantedAt || new Date().toISOString().slice(0,10),
      notes: plant.notes || "",
      photos: [],
      waterings: [],
      harvests: []
    };
    save(db);
    return id;
  }
  function updatePlant(id, patch) {
    if (!db.plants[id]) return;
    db.plants[id] = { ...db.plants[id], ...patch };
    save(db);
  }
  function deletePlant(id) {
    if (!db.plants[id]) return;
    // retirer des grilles
    Object.values(db.parcels).forEach(par => {
      par.grid = par.grid.map(row => row.map(cell => cell.plantId === id ? ({...cell, plantId:null}) : cell));
    });
    delete db.plants[id];
    save(db);
  }
  function addWatering(plantId, rec) {
    const p = db.plants[plantId]; if (!p) return;
    p.waterings.unshift({ id: uid(), date: rec.date, amountL: Number(rec.amountL)||0, notes: rec.notes||"" });
    save(db);
  }
  function addHarvest(plantId, rec) {
    const p = db.plants[plantId]; if (!p) return;
    p.harvests.unshift({ id: uid(), date: rec.date, qty: Number(rec.qty)||0, weightKg: Number(rec.weightKg)||0, notes: rec.notes||"" });
    save(db);
  }
  function addPhoto(plantId, rec) {
    const p = db.plants[plantId]; if (!p) return;
    p.photos.unshift({ id: uid(), url: rec.url, caption: rec.caption||"" });
    save(db);
  }

  // ——— Rotation ———
  // Retourne un historique par (r,c): [{year, plantName}]
  function rotationHistory(parcelId, yearsBack=5) {
    // On dérive depuis plants[].plantedAt + positions actuelles:
    // Simplifié: la "culture" d'une case est déterminée par le plant placé et sa date de plantation (année)
    const par = db.parcels[parcelId]; if (!par) return {};
    const hist = {};
    for (let r=0; r<par.rows; r++) {
      for (let c=0; c<par.cols; c++) {
        const cell = par.grid[r][c];
        const key = `${r},${c}`;
        if (!cell.plantId) { hist[key] = []; continue; }
        const plant = db.plants[cell.plantId];
        if (!plant) { hist[key] = []; continue; }
        const year = (plant.plantedAt||"").slice(0,4);
        const entry = { year, plantName: plant.name };
        hist[key] = [entry]; // simplifié v1 (1 culture courante). Tu peux étendre en stockant historique lors de placements.
      }
    }
    return hist;
  }

  // ——— Météo ———
  async function fetchRain(lat, lon, days=14) {
    const end = new Date();
    const start = new Date(Date.now() - (days-1)*24*3600*1000);
    const fmt = d => d.toISOString().slice(0,10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=precipitation_sum&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    const daily = (json?.daily?.time||[]).map((t,i) => ({ date:t, rain_mm: json.daily.precipitation_sum[i]}));
    return daily;
  }

  // ——— Exports globaux ———
  window.GardenCore = {
    db, save, uid,
    // parcels
    getCurrentParcel, setCurrentParcel, addParcel, removeParcel, resizeParcel,
    placePlant, clearCell, toggleLayer,
    // plants
    addPlant, updatePlant, deletePlant, addWatering, addHarvest, addPhoto,
    // rotation & weather
    rotationHistory, fetchRain
  };
})();