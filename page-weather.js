const C = window.GardenCore;

/* ——— même WeatherCard que dans page-index.js ——— */
function WeatherCard(){ /* colle ici EXACTEMENT le même code que dans page-index.js */ }
/* ------------------------------------------------- */

function WeatherPage(){
  return (
    <div className="space-y-4">
      <WeatherCard/>
      <section className="bg-white rounded-2xl shadow p-4">
        <h3 className="font-semibold mb-2">Conseils rapides</h3>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Si la pluie cumulée &lt; 5 mm sur 3 jours et que le dernier arrosage a &gt; 2 jours → prévoir un arrosage.</li>
          <li>Le paillage réduit l’évaporation : ajuste ton seuil d’arrosage si ta parcelle est paillée.</li>
          <li>Sur sol argileux, privilégie des arrosages espacés mais plus copieux.</li>
        </ul>
      </section>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<WeatherPage />);