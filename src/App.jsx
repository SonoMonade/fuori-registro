import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings, FileText, Printer, Database, Calculator, Info, RefreshCw, 
  ChevronRight, Link, AlertCircle, Save, CheckCircle2, User, 
  Download, Trash2, FolderOpen, Percent, MessageSquare, 
  Package, Plus, Phone, Mail, Palette, Layers, Users, 
  Clock, Truck, Search, ShoppingCart, ChevronDown, ExternalLink
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBZhGymRz4uPLYzjWTTf1galmVjQXOTFoM",
  authDomain: "fuori-registro.firebaseapp.com",
  projectId: "fuori-registro",
  storageBucket: "fuori-registro.appspot.com",
  messagingSenderId: "290610870467",
  appId: "1:290610870467:web:44da29f29a54bb36f3ca76"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'fuori-registro-system';

const STATUS_FLOW = [
  { id: 'preventivo', label: 'Preventivo', icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  { id: 'accettazione', label: 'Accettato', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'lavorazione', label: 'In Produzione', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
  { id: 'consegna', label: 'Consegnato', icon: Truck, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('calculator');
  const [savedOrders, setSavedOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [availableSizes, setAvailableSizes] = useState(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Unica']);
  const [availableColors, setAvailableColors] = useState(['Bianco', 'Nero', 'Navy', 'Grigio', 'Rosso']);
  
  const [sheetData, setSheetData] = useState({
    servizi: [
      { id: 1, nome: 'Telaio Serigrafico', costo: 40 },
      { id: 2, nome: 'Battuta Abbigliamento', costo: 2 },
      { id: 3, nome: 'Battuta Adesivi', costo: 1 },
    ],
    supporti: [
      { id: 1, categoria: 'Abbigliamento', nome: 'B&C Inspire E150', costo: 4.00 },
      { id: 2, categoria: 'Abbigliamento', nome: 'Fruit Standard', costo: 3.00 },
      { id: 3, categoria: 'Adesivi', nome: 'PVC Bianco', costo: 1.50 }, 
      { id: 4, categoria: 'Felpe', nome: 'Fruit Felpa', costo: 10.00 },
    ]
  });

  const [currentOrder, setCurrentOrder] = useState({
    id: Math.random().toString(36).substring(7).toUpperCase(),
    cliente: '', telefono: '', email: '', sconto: 0, items: [], status: 'preventivo'
  });

  const [tempItem, setTempItem] = useState({
    prodottoNome: '', tipo: 'abbigliamento', quantita: 50, colori: 1, supportoId: 1, taglia: 'M', coloreCapo: 'Nero', dimensioneAdesivo: 'M'
  });

  const resaMappa = { 'S': 32, 'M': 24, 'L': 16 };

  useEffect(() => {
    signInAnonymously(auth).catch(() => console.error("Auth error"));
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const qOrders = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
    const qCust = query(collection(db, 'artifacts', appId, 'public', 'data', 'customers'));
    
    const unsubs = [
      onSnapshot(qOrders, (s) => setSavedOrders(s.docs.map(d => ({...d.data(), firestoreId: d.id})))),
      onSnapshot(qCust, (s) => setCustomers(s.docs.map(d => ({...d.data(), id: d.id}))))
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  const calculateItem = (item) => {
    const isAdesivi = item.tipo === 'adesivi';
    const supporto = sheetData.supporti.find(s => s.id === parseInt(item.supportoId));
    const sTelaio = sheetData.servizi.find(s => s.nome.toLowerCase().includes('telaio'));
    const sBattuta = isAdesivi ? sheetData.servizi[2] : sheetData.servizi[1];
    const resa = isAdesivi ? resaMappa[item.dimensioneAdesivo] : 1;
    let unitaProd = isAdesivi ? Math.ceil(item.quantita / resa) : item.quantita;
    let subtotale = Math.ceil((item.colori * (sTelaio?.costo || 40)) + (unitaProd * (supporto?.costo || 0)) + (unitaProd * (sBattuta?.costo || 1) * item.colori));
    return { subtotale, unitario: item.quantita > 0 ? (subtotale / item.quantita).toFixed(2) : 0 };
  };

  const orderResults = useMemo(() => {
    const lordo = currentOrder.items.reduce((acc, item) => acc + calculateItem(item).subtotale, 0);
    const valoreSconto = lordo * (currentOrder.sconto / 100);
    return { lordo, valoreSconto, totale: Math.ceil(lordo - valoreSconto) };
  }, [currentOrder, sheetData]);

  const handleSave = async () => {
    if (!user || currentOrder.items.length === 0) return;
    const custId = currentOrder.email || currentOrder.cliente.toLowerCase().replace(/\s/g, '');
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', custId), {
      nome: currentOrder.cliente, telefono: currentOrder.telefono, email: currentOrder.email, lastOrder: serverTimestamp()
    });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', currentOrder.id), {
      ...currentOrder, results: orderResults, timestamp: serverTimestamp(), date: new Date().toLocaleString('it-IT')
    });
    setCurrentOrder({ id: Math.random().toString(36).substring(7).toUpperCase(), cliente: '', telefono: '', email: '', sconto: 0, items: [], status: 'preventivo' });
    setActiveTab('orders');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b px-8 py-4 sticky top-0 z-40 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 rounded-xl text-white shadow-lg rotate-3"><Layers size={20} /></div>
          <div><h1 className="font-black uppercase tracking-tighter text-xl leading-none">Fuori Registro</h1></div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['calculator', 'orders', 'customers', 'settings'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-8 max-w-[1800px] mx-auto">
        {activeTab === 'calculator' && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in">
            <div className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white rounded-[2rem] shadow-sm border p-8 space-y-6">
                <input type="text" placeholder="Nome Cliente" value={currentOrder.cliente} onChange={e => setCurrentOrder({...currentOrder, cliente: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500" />
                <input type="text" placeholder="Cosa stampiamo?" value={tempItem.prodottoNome} onChange={e => setTempItem({...tempItem, prodottoNome: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Quantità" value={tempItem.quantita} onChange={e => setTempItem({...tempItem, quantita: parseInt(e.target.value) || 0})} className="bg-slate-50 border p-4 rounded-2xl text-sm font-bold" />
                  <input type="number" placeholder="Colori" value={tempItem.colori} onChange={e => setTempItem({...tempItem, colori: parseInt(e.target.value) || 1})} className="bg-slate-50 border p-4 rounded-2xl text-sm font-bold" />
                </div>
                <button onClick={() => setCurrentOrder({...currentOrder, items: [...currentOrder.items, {...tempItem, id: Date.now()}]})} className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest">+ Aggiungi Articolo</button>
                {currentOrder.items.length > 0 && (
                  <button onClick={handleSave} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100">Salva Tutto</button>
                )}
              </div>
            </div>

            <div className="lg:col-span-8">
              <div id="print-area" className="bg-white shadow-2xl p-16 min-h-[1000px] relative rounded-sm border">
                <div className="flex justify-between items-start mb-16 border-b-4 border-black pb-8">
                  <h2 className="text-5xl font-black uppercase italic">Fuori Registro</h2>
                  <div className="text-right uppercase font-black text-slate-400 text-xs">ID: {currentOrder.id}<br/>{new Date().toLocaleDateString()}</div>
                </div>
                <div className="mb-12">
                  <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest mb-1">Preventivo per</p>
                  <h3 className="text-4xl font-black uppercase">{currentOrder.cliente || 'Nuovo Cliente'}</h3>
                </div>
                <table className="w-full text-left mb-20">
                  <thead className="border-b-2 border-slate-100 text-[10px] uppercase font-black text-slate-400">
                    <tr><th className="py-4">Articolo</th><th className="text-center">Quantità</th><th className="text-right">Subtotale</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentOrder.items.map((item, i) => (
                      <tr key={i} className="font-bold">
                        <td className="py-8 text-xl uppercase font-black">{item.prodottoNome || 'Articolo'} {item.colori} Col.</td>
                        <td className="text-center text-2xl">{item.quantita}</td>
                        <td className="text-right text-2xl">€ {calculateItem(item).subtotale},00</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="absolute bottom-16 right-16 text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400">Totale Documento</p>
                  <p className="text-8xl font-black text-indigo-600 tracking-tighter leading-none">€ {orderResults.totale},00</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="grid gap-6 animate-in fade-in">
            {savedOrders.map(o => {
              const status = STATUS_FLOW.find(s => s.id === (o.status || 'preventivo')) || STATUS_FLOW[0];
              const StatusIcon = status.icon;
              return (
                <div key={o.firestoreId} className={`bg-white p-8 rounded-[2rem] border-2 ${status.border} shadow-sm flex items-center justify-between group hover:shadow-xl transition-all`}>
                  <div className="flex items-center gap-8">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${status.bg} ${status.color}`}><StatusIcon size={32} /></div>
                    <div>
                      <h4 className="text-3xl font-black uppercase tracking-tighter">{o.cliente}</h4>
                      <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>{o.date}</span><span>{o.items?.length || 0} Prodotti</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Totale</p>
                      <p className="text-4xl font-black tracking-tighter">€ {o.results?.totale || 0},00</p>
                    </div>
                    <div className="flex gap-2">
                      {STATUS_FLOW.map(s => {
                        const SIcon = s.icon;
                        return <button key={s.id} onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.firestoreId), {status: s.id})} className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${o.status === s.id ? `${s.bg} ${s.color} border-current` : 'border-transparent text-slate-200 hover:text-slate-400'}`}><SIcon size={18} /></button>
                      })}
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.firestoreId))} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { .no-print { display: none !important; } body { background: white; } main { max-width: 100%; padding: 0; } #print-area { border: none; box-shadow: none; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.4s ease-out forwards; }
      `}} />
    </div>
  );
};

export default App;
