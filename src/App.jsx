import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings, 
  FileText, 
  Database, 
  Calculator, 
  RefreshCw, 
  ChevronRight,
  Link, 
  AlertCircle,
  Save,
  CheckCircle2,
  User,
  Trash2,
  FolderOpen,
  Percent,
  MessageSquare,
  TrendingUp,
  Package,
  Plus,
  Phone,
  Mail,
  Palette,
  Layers,
  Users,
  Clock,
  CheckCircle,
  Truck,
  Search,
  ShoppingCart,
  ChevronDown,
  ExternalLink,
  Download,
  LayoutDashboard,
  Printer
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

// --- DEFINIZIONE STATI PRODUZIONE ---
const STATUS_FLOW = [
  { id: 'preventivo', label: 'Preventivo', icon: FileText, color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
  { id: 'accettazione', label: 'Accettato', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'lavorazione', label: 'In Stampa', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
  { id: 'consegna', label: 'Consegnato', icon: Truck, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('calculator');
  const [error, setError] = useState(null);
  const [savedOrders, setSavedOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- DATABASE LOCALE / LISTINI ---
  const [availableSizes, setAvailableSizes] = useState(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Unica']);
  const [availableColors, setAvailableColors] = useState(['Bianco', 'Nero', 'Navy', 'Grigio', 'Rosso', 'Giallo', 'Verde']);
  
  const [sheetData, setSheetData] = useState({
    supporti: [
      { id: 1, categoria: 'Abbigliamento', nome: 'B&C Organic (T-Shirt)', costo: 4.00 },
      { id: 2, categoria: 'Abbigliamento', nome: 'Fruit Standard (T-Shirt)', costo: 3.00 },
      { id: 3, categoria: 'Felpe', nome: 'Fruit of the Loom (Felpa)', costo: 10.00 },
      { id: 4, categoria: 'Adesivi', nome: 'PVC Bianco Opaco', costo: 1.50 },
      { id: 5, categoria: 'Accessori', nome: 'Shopper Cotone', costo: 2.50 }
    ]
  });

  const [currentOrder, setCurrentOrder] = useState({
    id: Math.random().toString(36).substring(7).toUpperCase(),
    cliente: '', telefono: '', email: '', sconto: 0, items: [], status: 'preventivo', note: ''
  });

  const [tempItem, setTempItem] = useState({
    prodottoNome: '', tipo: 'abbigliamento', quantita: 50, colori: 1, supportoId: 1, taglia: 'M', coloreCapo: 'Nero', dimensioneAdesivo: 'M'
  });

  const resaMappa = { 'S': 32, 'M': 24, 'L': 16 };

  // --- FIREBASE SYNC ---
  useEffect(() => {
    signInAnonymously(auth).catch(() => setError("Errore Connessione Cloud"));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubOrders = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'orders')), (snap) => {
      setSavedOrders(snap.docs.map(d => ({ ...d.data(), firestoreId: d.id })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });
    const unsubCust = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'customers')), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    return () => { unsubOrders(); unsubCust(); };
  }, [user]);

  // --- CALCOLO LOGICA ---
  const calculateItem = (item) => {
    const isAdesivi = item.tipo === 'adesivi';
    const supporto = sheetData.supporti.find(s => s.id === parseInt(item.supportoId));
    const resa = isAdesivi ? resaMappa[item.dimensioneAdesivo] : 1;
    let unitaProd = isAdesivi ? Math.ceil(item.quantita / resa) : item.quantita;
    let impianti = item.colori * 40;
    let stampa = unitaProd * (isAdesivi ? 1 : 2) * item.colori;
    let materiale = unitaProd * (supporto?.costo || 0);
    let subtotale = Math.ceil(impianti + stampa + materiale);
    return { subtotale, unitario: item.quantita > 0 ? (subtotale / item.quantita).toFixed(2) : 0, unitaProd };
  };

  const orderTotals = useMemo(() => {
    let lordo = currentOrder.items.reduce((acc, i) => acc + calculateItem(i).subtotale, 0);
    let scontoVal = lordo * (currentOrder.sconto / 100);
    return { lordo, scontoVal, totale: Math.ceil(lordo - scontoVal) };
  }, [currentOrder, sheetData]);

  const dashboardStats = useMemo(() => {
    const totalRevenue = savedOrders.reduce((acc, o) => acc + (o.results?.totale || 0), 0);
    const totalItems = savedOrders.reduce((acc, o) => acc + (o.items?.length || 0), 0);
    return { totalRevenue, totalItems, count: savedOrders.length };
  }, [savedOrders]);

  // --- ACTIONS ---
  const handleSaveOrder = async () => {
    if (!user || currentOrder.items.length === 0) return;
    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', currentOrder.id);
    const custRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', (currentOrder.email || currentOrder.cliente).toLowerCase().replace(/\s/g, ''));
    
    await setDoc(custRef, { nome: currentOrder.cliente, telefono: currentOrder.telefono, email: currentOrder.email, updated: serverTimestamp() });
    await setDoc(orderRef, { ...currentOrder, results: orderTotals, timestamp: serverTimestamp(), date: new Date().toLocaleDateString('it-IT') });
    
    setCurrentOrder({ id: Math.random().toString(36).substring(7).toUpperCase(), cliente: '', telefono: '', email: '', sconto: 0, items: [], status: 'preventivo', note: '' });
    setActiveTab('orders');
    setShowToast(true); setTimeout(() => setShowToast(false), 3000);
  };

  const updateStatus = async (oid, newStatus) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', oid), { status: newStatus });
  };

  const deleteOrder = async (oid) => {
    if(confirm("Eliminare ordine?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', oid));
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans">
      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-10 right-10 z-[100] bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10">
          <CheckCircle className="text-green-400" />
          <p className="font-black uppercase tracking-widest text-xs">Cloud Sincronizzato</p>
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-10 py-5 sticky top-0 z-40 flex justify-between items-center no-print shadow-sm">
        <div className="flex items-center gap-5">
          <div className="bg-black p-3 rounded-2xl text-white shadow-xl rotate-3">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none italic">Fuori Registro</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-1">Management System v4.0</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200">
          {[
            { id: 'calculator', label: 'Preventivo', icon: Calculator },
            { id: 'orders', label: 'Produzione', icon: Package },
            { id: 'customers', label: 'Clienti', icon: Users },
            { id: 'settings', label: 'Listini', icon: Settings }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${activeTab === t.id ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-10 max-w-[1900px] mx-auto">
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in">
            {/* Pannello Input */}
            <div className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-[11px] font-black uppercase text-indigo-500 tracking-widest">Anagrafica Cliente</h3>
                  {customers.length > 0 && (
                    <select onChange={(e) => e.target.value && setCurrentOrder({...currentOrder, ...JSON.parse(e.target.value)})} className="text-[10px] font-black uppercase bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none">
                       <option value="">Rubrica...</option>
                       {customers.map(c => <option key={c.id} value={JSON.stringify(c)}>{c.nome}</option>)}
                    </select>
                  )}
                </div>
                <div className="space-y-4">
                   <div className="relative"><User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/><input type="text" placeholder="Nome / Azienda" value={currentOrder.cliente} onChange={e => setCurrentOrder({...currentOrder, cliente: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold" /></div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="relative"><Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/><input type="text" placeholder="Telefono" value={currentOrder.telefono} onChange={e => setCurrentOrder({...currentOrder, telefono: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 pl-10 rounded-2xl text-xs font-bold" /></div>
                      <div className="relative"><Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/><input type="text" placeholder="Email" value={currentOrder.email} onChange={e => setCurrentOrder({...currentOrder, email: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 pl-10 rounded-2xl text-xs font-bold" /></div>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-8 space-y-6">
                <h3 className="text-[11px] font-black uppercase text-indigo-500 tracking-widest">Configura Articolo</h3>
                <div className="space-y-5">
                   <div className="relative"><Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/><input type="text" placeholder="Nome Articolo (es. Shopper)" value={tempItem.prodottoNome} onChange={e => setTempItem({...tempItem, prodottoNome: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold" /></div>
                   
                   <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                      {['abbigliamento', 'felpe', 'adesivi'].map(t => (
                        <button key={t} onClick={() => setTempItem({...tempItem, tipo: t})} className={`py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${tempItem.tipo === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
                      ))}
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="relative"><ShoppingCart size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/><input type="number" placeholder="Q.tà" value={tempItem.quantita} onChange={e => setTempItem({...tempItem, quantita: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 p-4 pl-10 rounded-2xl font-bold" /></div>
                      <div className="relative"><Palette size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/><input type="number" placeholder="Colori" value={tempItem.colori} onChange={e => setTempItem({...tempItem, colori: parseInt(e.target.value) || 1})} className="w-full bg-slate-50 p-4 pl-10 rounded-2xl font-bold" /></div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <select value={tempItem.taglia} onChange={e => setTempItem({...tempItem, taglia: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black uppercase outline-none">{availableSizes.map(s => <option key={s} value={s}>{s}</option>)}</select>
                      <select value={tempItem.coloreCapo} onChange={e => setTempItem({...tempItem, coloreCapo: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black uppercase outline-none">{availableColors.map(c => <option key={c} value={c}>{c}</option>)}</select>
                   </div>

                   <select value={tempItem.supportoId} onChange={e => setTempItem({...tempItem, supportoId: e.target.value})} className="w-full bg-indigo-50 text-indigo-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                      {sheetData.supporti.filter(s => tempItem.tipo === 'felpe' ? s.categoria === 'Felpe' : s.categoria.toLowerCase() === tempItem.tipo).map(s => <option key={s.id} value={s.id}>{s.nome} (€{s.costo.toFixed(2)})</option>)}
                   </select>

                   <button onClick={() => { if(!tempItem.prodottoNome) return; setCurrentOrder({...currentOrder, items: [...currentOrder.items, {...tempItem, id: Date.now()}]}); setTempItem({...tempItem, prodottoNome: ''}); }} className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"><Plus size={16}/> Aggiungi Articolo</button>
                </div>
              </div>

              {currentOrder.items.length > 0 && (
                <div className="bg-indigo-600 text-white rounded-[3rem] p-10 shadow-2xl shadow-indigo-200 animate-in slide-in-from-bottom-5">
                   <div className="flex justify-between items-end mb-8">
                      <div><p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Importo Totale</p><p className="text-6xl font-black tracking-tighter leading-none">€ {orderTotals.totale},00</p></div>
                      <div className="w-24"><label className="text-[9px] font-black uppercase opacity-60">Sconto %</label><input type="number" value={currentOrder.sconto} onChange={e => setCurrentOrder({...currentOrder, sconto: parseInt(e.target.value) || 0})} className="w-full bg-white/10 p-3 rounded-xl font-black text-center outline-none" /></div>
                   </div>
                   <button onClick={handleSaveOrder} className="w-full bg-white text-indigo-600 p-5 rounded-3xl font-black text-sm uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-slate-50 transition-colors"><Save size={20}/> Salva in Cloud</button>
                </div>
              )}
            </div>

            {/* Preview PDF */}
            <div className="lg:col-span-8">
               <div id="pdf-view" className="bg-white shadow-2xl rounded-sm p-20 min-h-[1200px] relative border border-slate-100 print-area flex flex-col">
                  <div className="flex justify-between items-start mb-24 border-b-8 border-slate-900 pb-16">
                     <div className="flex items-center gap-8">
                        <div className="bg-black w-28 h-28 rounded-3xl flex items-center justify-center text-white shadow-2xl rotate-2"><Layers size={56} /></div>
                        <div>
                          <h2 className="text-8xl font-black uppercase tracking-tighter leading-none italic text-slate-900">Fuori Registro</h2>
                          <div className="h-2.5 w-64 bg-indigo-600 mt-4"></div>
                          <p className="text-[11px] font-black text-slate-400 tracking-[0.5em] mt-5 uppercase">Laboratorio Grafico Serigrafico Roma</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <span className="bg-slate-900 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.3em]">DOC. FR-{currentOrder.id}</span>
                        <p className="text-[12px] font-black text-slate-400 mt-6 uppercase tracking-widest italic">Data: {new Date().toLocaleDateString('it-IT')}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 mb-24">
                     <div className="border-l-[12px] border-slate-900 pl-10 py-2">
                        <span className="text-[11px] font-black uppercase text-slate-300 tracking-[0.4em] block mb-3">Spett.le Cliente</span>
                        <h3 className="text-5xl font-black uppercase text-slate-900 tracking-tighter leading-none">{currentOrder.cliente || 'Nuovo Cliente'}</h3>
                        <div className="mt-8 space-y-2 text-[12px] font-black text-slate-400 uppercase italic tracking-widest">
                           {currentOrder.telefono && <p className="flex items-center gap-3"><Phone size={14} className="text-indigo-500"/> {currentOrder.telefono}</p>}
                           {currentOrder.email && <p className="flex items-center gap-3"><Mail size={14} className="text-indigo-500"/> {currentOrder.email}</p>}
                        </div>
                     </div>
                     <div className="text-right flex flex-col justify-end">
                        <span className="text-[11px] font-black uppercase text-slate-300 tracking-[0.4em] mb-2">Totale Preventivo</span>
                        <p className="text-[10rem] font-black text-indigo-600 tracking-tighter leading-none">€ {orderTotals.totale},00</p>
                     </div>
                  </div>

                  <table className="w-full text-left mb-auto">
                     <thead>
                        <tr className="text-[12px] font-black uppercase text-slate-400 border-b-4 border-slate-900 pb-8 tracking-[0.3em]">
                           <th className="py-8">Descrizione Articolo e Setup</th>
                           <th className="py-8 text-center">Quantità</th>
                           <th className="py-8 text-right">Prezzo Totale</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y-2 divide-slate-100">
                        {currentOrder.items.length === 0 ? (
                          <tr><td colSpan="3" className="py-40 text-center text-slate-200 font-black uppercase italic tracking-[0.4em] text-sm">Configura almeno un prodotto per iniziare</td></tr>
                        ) : (
                          currentOrder.items.map((item, idx) => {
                             const calc = calculateItem(item);
                             return (
                               <tr key={idx} className="font-bold">
                                  <td className="py-14">
                                     <span className="text-3xl font-black uppercase text-slate-900 leading-none">{item.prodottoNome} {item.colori} Colori</span>
                                     <div className="mt-5 flex items-center gap-4">
                                        <span className="text-[10px] bg-indigo-600 text-white px-3 py-1 rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-100">{calc.supportoNome}</span>
                                        {item.tipo !== 'adesivi' && <span className="text-[11px] text-slate-400 uppercase italic font-black">Taglia {item.taglia} • Colore {item.coloreCapo}</span>}
                                     </div>
                                  </td>
                                  <td className="py-14 text-center text-4xl font-black text-slate-900">{item.quantita}</td>
                                  <td className="py-14 text-right text-4xl font-black text-slate-900 tracking-tighter">€ {calc.subtotale},00</td>
                               </tr>
                             );
                          })
                        )}
                     </tbody>
                  </table>

                  <div className="pt-20 border-t-2 border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mt-20">
                     <span>Fuori Registro Studio • Via Prenestina 704 Roma</span>
                     <span>Crafted with Passion • Printed in Italy</span>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-in fade-in max-w-7xl mx-auto space-y-10">
             {/* Dashboard Stats */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200"><TrendingUp className="text-indigo-500 mb-4" size={32}/><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume Cloud</p><p className="text-5xl font-black text-slate-900 tracking-tighter">€ {dashboardStats.totalRevenue},00</p></div>
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200"><Package className="text-blue-500 mb-4" size={32}/><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Progetti Archiviati</p><p className="text-5xl font-black text-slate-900 tracking-tighter">{dashboardStats.count}</p></div>
                <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white flex flex-col justify-center text-center"><p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2 italic">Pronto per stampare?</p><button onClick={() => setActiveTab('calculator')} className="text-indigo-400 font-black text-lg uppercase underline underline-offset-8">Crea Nuovo Progetto</button></div>
             </div>

             <div className="flex justify-between items-center border-b-2 border-slate-200 pb-8">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-5 leading-none"><div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl"><LayoutDashboard size={32} /></div> Workflow Produzione</h2>
                <div className="relative w-96"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"/><input type="text" placeholder="Cerca progetto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 p-5 pl-14 rounded-3xl text-sm font-bold shadow-sm outline-none focus:border-indigo-500 transition-all" /></div>
             </div>

             <div className="grid gap-8">
                {savedOrders.filter(o => o.cliente.toLowerCase().includes(searchTerm.toLowerCase())).map(order => {
                  const s = STATUS_FLOW.find(x => x.id === (order.status || 'preventivo')) || STATUS_FLOW[0];
                  const Icon = s.icon;
                  return (
                    <div key={order.firestoreId} className={`bg-white p-10 rounded-[3.5rem] border-2 shadow-sm flex flex-col lg:flex-row items-center justify-between group transition-all hover:shadow-2xl relative overflow-hidden ${s.border}`}>
                       <div className={`absolute top-0 left-0 w-3 h-full ${s.bg.replace('bg-', 'bg-').replace('-100', '-500')}`}></div>
                       
                       <div className="flex items-center gap-10 flex-1">
                          <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center font-black ${s.bg} ${s.color} shadow-inner transition-colors duration-500`}><Icon size={40} /></div>
                          <div>
                             <div className="flex items-center gap-5">
                                <h4 className="text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none">{order.cliente}</h4>
                                <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase border ${s.color} ${s.bg} tracking-widest`}>{s.label}</span>
                             </div>
                             <p className="text-[11px] font-bold text-slate-400 uppercase mt-4 tracking-widest flex items-center gap-4">
                                <span className="bg-slate-900 text-white px-3 py-1 rounded-lg">FR-{order.id}</span>
                                <span>{order.date}</span>
                                <span className="flex items-center gap-2"><ShoppingCart size={14}/> {order.items?.length || 0} Articoli</span>
                             </p>
                          </div>
                       </div>

                       <div className="flex items-center gap-14 mt-10 lg:mt-0">
                          <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Totale Ordine</p><p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">€ {order.results?.totale || 0},00</p></div>
                          <div className="flex flex-col gap-3">
                             <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                                {STATUS_FLOW.map(sf => {
                                  const MiniIcon = sf.icon;
                                  return (
                                    <button key={sf.id} onClick={() => updateStatus(order.firestoreId, sf.id)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${order.status === sf.id ? `${sf.bg} ${sf.color} border-2 border-current scale-110 shadow-lg z-10` : 'bg-white text-slate-200 hover:text-slate-400 hover:scale-105 shadow-sm'}`}><MiniIcon size={18} /></button>
                                  );
                                })}
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => { setCurrentOrder(order); setActiveTab('calculator'); }} className="flex-1 bg-slate-900 text-white p-4 rounded-xl flex items-center justify-center font-black uppercase text-[10px] tracking-[0.2em] gap-2 hover:bg-indigo-600 transition-all"><ExternalLink size={16}/> Carica</button>
                                <button onClick={() => deleteOrder(order.firestoreId)} className="p-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={20}/></button>
                             </div>
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="animate-in fade-in max-w-6xl mx-auto py-8">
            <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900 mb-16 flex items-center gap-6 leading-none"><div className="bg-black p-5 rounded-3xl text-white shadow-2xl"><Users size={40} /></div> Anagrafica Clienti</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
               {customers.map(c => (
                 <div key={c.id} className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 font-black text-4xl uppercase shadow-inner">{c.nome[0]}</div>
                    <h4 className="text-3xl font-black uppercase text-slate-900 tracking-tighter mb-6 leading-tight">{c.nome}</h4>
                    <div className="space-y-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] border-l-4 border-slate-50 pl-6">
                       <p className="flex items-center gap-3"><Phone size={14} className="text-indigo-500" /> {c.telefono || '---'}</p>
                       <p className="flex items-center gap-3"><Mail size={14} className="text-indigo-500" /> {c.email || '---'}</p>
                    </div>
                    <button onClick={() => { selectCustomer(c); setActiveTab('calculator'); }} className="mt-12 w-full bg-slate-900 text-white p-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">Inizia Preventivo</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="max-w-5xl mx-auto py-10 animate-in fade-in">
              <div className="bg-white p-16 rounded-[4.5rem] shadow-2xl border border-slate-200 space-y-16">
                 <h2 className="text-6xl font-black uppercase tracking-tighter flex items-center gap-8 leading-none italic"><div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-2xl rotate-2"><Settings size={44} /></div> Workshop Control</h2>
                 <div className="grid md:grid-cols-2 gap-20 border-t-2 border-slate-100 pt-16">
                    <div className="space-y-10">
                       <h4 className="text-[13px] font-black uppercase text-indigo-500 tracking-[0.4em] flex items-center gap-4">Varianti di Stampa</h4>
                       <div className="space-y-8">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Taglie nel sistema</p>
                            <div className="flex flex-wrap gap-2.5">
                                {availableSizes.map(s => <span key={s} className="bg-slate-50 px-6 py-3 rounded-2xl text-xs font-black uppercase border border-slate-100 shadow-sm">{s}</span>)}
                                <button onClick={() => { const s = prompt("Nuova Taglia:"); if(s) setAvailableSizes([...availableSizes, s])}} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg hover:scale-105 transition-transform">+</button>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Colori Supporto</p>
                            <div className="flex flex-wrap gap-2.5">
                                {availableColors.map(c => <span key={c} className="bg-slate-50 px-6 py-3 rounded-2xl text-xs font-black uppercase border border-slate-100 shadow-sm">{c}</span>)}
                                <button onClick={() => { const c = prompt("Nuovo Colore:"); if(c) setAvailableColors([...availableColors, c])}} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg hover:scale-105 transition-transform">+</button>
                            </div>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-10">
                       <h4 className="text-[13px] font-black uppercase text-indigo-500 tracking-[0.4em] flex items-center gap-4">Prodotti e Listino</h4>
                       <div className="space-y-4">
                          {sheetData.supporti.map(s => (
                             <div key={s.id} className="flex justify-between items-center bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:bg-white hover:border-indigo-100 transition-all">
                                <span className="text-sm font-black text-slate-600 uppercase tracking-tighter">{s.nome}</span>
                                <span className="text-lg font-black text-slate-900 italic">€ {s.costo.toFixed(2)}</span>
                             </div>
                          ))}
                          <button onClick={() => {
                             const cat = prompt("Categoria (Abbigliamento, Felpe, Adesivi, Accessori):");
                             const nome = prompt("Nome Prodotto:");
                             const costo = parseFloat(prompt("Costo unitario (€):"));
                             if(cat && nome && costo) setSheetData({...sheetData, supporti: [...sheetData.supporti, {id: Date.now(), categoria: cat, nome, costo}]});
                          }} className="w-full bg-slate-900 text-white p-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">+ Aggiungi Prodotto a Listino</button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          main { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; border-radius: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default App;
