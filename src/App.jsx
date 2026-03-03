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
  Printer,
  MapPin
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

  // --- LISTINI ---
  const [availableSizes, setAvailableSizes] = useState(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Unica']);
  const [availableColors, setAvailableColors] = useState(['Bianco', 'Nero', 'Navy', 'Grigio', 'Rosso', 'Verde']);
  
  const [sheetData, setSheetData] = useState({
    supporti: [
      { id: 1, categoria: 'Abbigliamento', nome: 'B&C Organic (T-Shirt)', costo: 4.00 },
      { id: 2, categoria: 'Abbigliamento', nome: 'Fruit Standard (T-Shirt)', costo: 3.00 },
      { id: 3, categoria: 'Felpe', nome: 'Fruit of the Loom (Felpa)', costo: 10.00 },
      { id: 4, categoria: 'Adesivi', nome: 'PVC Bianco Opaco', costo: 1.50 }
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

  // --- FIREBASE SYNC ---
  useEffect(() => {
    signInAnonymously(auth).catch(() => setError("Errore Cloud"));
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

  // --- LOGICA CALCOLI ---
  const calculateItem = (item) => {
    const isAdesivi = item.tipo === 'adesivi';
    const supporto = sheetData.supporti.find(s => s.id === parseInt(item.supportoId));
    const resa = isAdesivi ? resaMappa[item.dimensioneAdesivo] : 1;
    let unitaProd = isAdesivi ? Math.ceil(item.quantita / resa) : item.quantita;
    let subtotale = Math.ceil((item.colori * 40) + (unitaProd * (supporto?.costo || 0)) + (unitaProd * (isAdesivi ? 1 : 2) * item.colori));
    return { subtotale, unitario: item.quantita > 0 ? (subtotale / item.quantita).toFixed(2) : 0 };
  };

  const orderTotals = useMemo(() => {
    let lordo = currentOrder.items.reduce((acc, i) => acc + calculateItem(i).subtotale, 0);
    let scontoVal = lordo * (currentOrder.sconto / 100);
    return { lordo, totale: Math.ceil(lordo - scontoVal) };
  }, [currentOrder, sheetData]);

  const dashboardStats = useMemo(() => {
    const totalRevenue = savedOrders.reduce((acc, o) => acc + (o.results?.totale || 0), 0);
    return { totalRevenue, count: savedOrders.length };
  }, [savedOrders]);

  // --- ACTIONS ---
  const handleSaveOrder = async () => {
    if (!user || currentOrder.items.length === 0) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', currentOrder.id), {
      ...currentOrder, results: orderTotals, timestamp: serverTimestamp(), date: new Date().toLocaleDateString('it-IT')
    });
    const custId = (currentOrder.email || currentOrder.cliente).toLowerCase().replace(/\s/g, '');
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', custId), {
      nome: currentOrder.cliente, telefono: currentOrder.telefono, email: currentOrder.email
    });
    setCurrentOrder({ id: Math.random().toString(36).substring(7).toUpperCase(), cliente: '', telefono: '', email: '', sconto: 0, items: [], status: 'preventivo' });
    setActiveTab('orders');
    setShowToast(true); setTimeout(() => setShowToast(false), 3000);
  };

  const updateStatus = async (oid, ns) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', oid), { status: ns });
  };

  const selectCustomer = (c) => {
    setCurrentOrder({ ...currentOrder, cliente: c.nome, telefono: c.telefono, email: c.email });
    setActiveTab('calculator');
  };

  const deleteOrder = async (oid) => {
    if(confirm("Vuoi eliminare definitivamente questo ordine?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', oid));
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-40 flex justify-between items-center no-print shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-black p-2.5 rounded-2xl text-white rotate-3 shadow-xl">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none italic text-slate-900">Fuori Registro</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Management Studio</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[
            { id: 'calculator', icon: Calculator, label: 'Preventivo' },
            { id: 'orders', icon: FolderOpen, label: 'Produzione' },
            { id: 'customers', icon: Users, label: 'Clienti' },
            { id: 'settings', icon: Settings, label: 'Listini' }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === t.id ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-8 max-w-[1900px] mx-auto">
        
        {/* TAB: CALCOLATORE / PREVENTIVI */}
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in">
            <div className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Dati Cliente</h3>
                  {customers.length > 0 && (
                    <select onChange={(e) => e.target.value && setCurrentOrder({...currentOrder, ...JSON.parse(e.target.value)})} className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none cursor-pointer">
                       <option value="">Rubrica...</option>
                       {customers.map(c => <option key={c.id} value={JSON.stringify(c)}>{c.nome}</option>)}
                    </select>
                  )}
                </div>
                <input type="text" placeholder="Nome / Azienda" value={currentOrder.cliente} onChange={e => setCurrentOrder({...currentOrder, cliente: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-indigo-500 transition-all shadow-inner" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Telefono" value={currentOrder.telefono} onChange={e => setCurrentOrder({...currentOrder, telefono: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold" />
                  <input type="text" placeholder="Email" value={currentOrder.email} onChange={e => setCurrentOrder({...currentOrder, email: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold" />
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 space-y-5">
                <h3 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Aggiungi Prodotto</h3>
                <input type="text" placeholder="Nome Articolo (es. Shopper)" value={tempItem.prodottoNome} onChange={e => setTempItem({...tempItem, prodottoNome: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-indigo-500 transition-all shadow-inner" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Quantità" value={tempItem.quantita} onChange={e => setTempItem({...tempItem, quantita: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold" />
                  <input type="number" placeholder="Colori" value={tempItem.colori} onChange={e => setTempItem({...tempItem, colori: parseInt(e.target.value) || 1})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <select value={tempItem.taglia} onChange={e => setTempItem({...tempItem, taglia: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black uppercase">{availableSizes.map(s => <option key={s} value={s}>{s}</option>)}</select>
                   <select value={tempItem.coloreCapo} onChange={e => setTempItem({...tempItem, coloreCapo: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black uppercase">{availableColors.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <button onClick={() => {
                  if(!tempItem.prodottoNome) return;
                  setCurrentOrder({...currentOrder, items: [...currentOrder.items, {...tempItem, id: Date.now()}]});
                  setTempItem({...tempItem, prodottoNome: ''});
                }} className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200">+ Aggiungi Articolo</button>
              </div>

              {currentOrder.items.length > 0 && (
                <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-5">
                  <div className="flex justify-between items-end mb-6">
                     <div>
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Totale Stimato</p>
                        <p className="text-5xl font-black tracking-tighter italic">€ {orderTotals.totale},00</p>
                     </div>
                     <div className="w-20">
                        <label className="text-[9px] font-black uppercase opacity-60">Sconto %</label>
                        <input type="number" value={currentOrder.sconto} onChange={e => setCurrentOrder({...currentOrder, sconto: parseInt(e.target.value) || 0})} className="w-full bg-white/10 p-2 rounded-lg font-black text-center outline-none" />
                     </div>
                  </div>
                  <button onClick={handleSaveOrder} className="w-full bg-white text-indigo-600 p-5 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-slate-50 transition-colors">Archivia e Salva</button>
                </div>
              )}
            </div>

            {/* FOGLIO D'ORDINE / ANTEPRIMA PDF */}
            <div className="lg:col-span-8">
              <div className="bg-white shadow-2xl p-16 min-h-[1200px] flex flex-col rounded-sm border border-slate-100 print-area overflow-hidden">
                <div className="flex justify-between items-start mb-16 border-b-4 border-slate-900 pb-12">
                   <div className="flex items-center gap-8">
                      <div className="bg-black w-24 h-24 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl rotate-2"><Layers size={48} /></div>
                      <div>
                        <h2 className="text-6xl font-black uppercase tracking-tighter leading-none italic text-slate-900">Fuori Registro</h2>
                        <div className="h-2 w-48 bg-indigo-600 mt-3"></div>
                        <div style={{ fontSize: '10pt' }} className="font-black text-slate-400 mt-5 uppercase tracking-[0.3em] leading-relaxed">
                          Via Prenestina 704, 00155 Roma<br/>
                          fuoriregistro.info@gmail.com • 348 5941282
                        </div>
                      </div>
                   </div>
                   <div className="text-right pt-2 flex flex-col items-end">
                      <p style={{ fontSize: '14pt' }} className="font-black text-slate-400 uppercase tracking-widest italic leading-none">Data Documento</p>
                      <p style={{ fontSize: '10pt' }} className="font-black text-slate-900 mt-3">{new Date().toLocaleDateString('it-IT')}</p>
                   </div>
                </div>

                <div className="grid grid-cols-12 gap-10 mb-16 items-start">
                   <div className="col-span-7 border-l-[10px] border-slate-900 pl-8 py-2">
                      <span style={{ fontSize: '14pt' }} className="font-black uppercase text-slate-300 tracking-[0.4em] block mb-4">Spett.le Cliente</span>
                      <h3 style={{ fontSize: '10pt' }} className="font-black uppercase text-slate-900 leading-tight break-words tracking-tight">
                        {currentOrder.cliente || 'Nuovo Cliente'}
                      </h3>
                      <div style={{ fontSize: '10pt' }} className="mt-6 space-y-1.5 font-black text-slate-400 uppercase italic tracking-widest">
                         {currentOrder.telefono && <p className="flex items-center gap-3"><Phone size={14} className="text-indigo-500"/> {currentOrder.telefono}</p>}
                         {currentOrder.email && <p className="flex items-center gap-3"><Mail size={14} className="text-indigo-500"/> {currentOrder.email}</p>}
                      </div>
                   </div>

                   <div className="col-span-5 text-right flex flex-col justify-between h-full py-2">
                      <div>
                        <span style={{ fontSize: '14pt' }} className="font-black uppercase text-slate-300 tracking-[0.4em] block mb-2">Preventivo No.</span>
                        <div style={{ fontSize: '10pt' }} className="font-black text-slate-900 tracking-tighter bg-slate-100 inline-block px-5 py-2 rounded-xl border border-slate-200">
                           FR-{currentOrder.id}
                        </div>
                      </div>
                      <div className="mt-14">
                        <span style={{ fontSize: '14pt' }} className="font-black uppercase text-slate-300 tracking-[0.4em] block mb-2">Importo Totale</span>
                        <div className="text-8xl font-black text-indigo-600 tracking-tighter leading-none flex items-start justify-end gap-1">
                           <span style={{ fontSize: '14pt' }} className="mt-3 uppercase">€</span>
                           <span>{orderTotals.totale.toLocaleString('it-IT')}</span>
                           <span style={{ fontSize: '14pt' }} className="mt-3 uppercase">,00</span>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="w-full h-1.5 bg-slate-900 mb-12"></div>

                <table className="w-full text-left mb-auto">
                   <thead>
                      <tr style={{ fontSize: '14pt' }} className="font-black uppercase text-slate-400 border-b-2 border-slate-100 pb-6 tracking-[0.3em]">
                         <th className="py-6">Articolo / Lavorazione</th>
                         <th className="py-6 text-center w-32">Quantità</th>
                         <th className="py-6 text-right w-44">Subtotale</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y-2 divide-slate-50 font-bold">
                      {currentOrder.items.length === 0 ? (
                        <tr><td colSpan="3" style={{ fontSize: '10pt' }} className="py-32 text-center text-slate-200 uppercase italic tracking-[0.4em] font-black">Configura almeno un articolo per visualizzare il riepilogo</td></tr>
                      ) : (
                        currentOrder.items.map((item, idx) => {
                           const c = calculateItem(item);
                           return (
                             <tr key={idx}>
                                <td className="py-10">
                                   <p style={{ fontSize: '10pt' }} className="font-black uppercase text-slate-900 leading-none">{item.prodottoNome} {item.colori} colori</p>
                                   <div className="mt-4 flex flex-wrap items-center gap-4">
                                      <span style={{ fontSize: '8pt' }} className="bg-slate-900 text-white px-3 py-1 rounded-lg uppercase tracking-tighter shadow-md font-black italic">Laboratorio Fuori Registro Roma</span>
                                      {item.tipo !== 'adesivi' && <span style={{ fontSize: '9pt' }} className="text-slate-400 uppercase italic font-black">Tg. {item.taglia} • {item.coloreCapo}</span>}
                                   </div>
                                </td>
                                <td className="py-10 text-center text-4xl font-black text-slate-900 tracking-tighter">{item.quantita}</td>
                                <td className="py-10 text-right text-4xl font-black text-slate-900 tracking-tighter italic">€ {c.subtotale},00</td>
                             </tr>
                           )
                        })
                      )}
                   </tbody>
                </table>

                <div style={{ fontSize: '10pt' }} className="mt-24 pt-10 border-t-2 border-slate-100 flex justify-between items-center font-black text-slate-300 uppercase tracking-[0.6em]">
                   <span className="flex items-center gap-3"><MapPin size={12}/> Via Prenestina 704 Roma</span>
                   <span className="italic opacity-50 font-black">Handcrafted with Passion</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PRODUZIONE / ORDINI SALVATI */}
        {activeTab === 'orders' && (
           <div className="animate-in fade-in max-w-6xl mx-auto space-y-10">
              <div className="flex justify-between items-center border-b-2 border-slate-200 pb-10">
                 <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-6"><div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl"><LayoutDashboard size={40} /></div> Workflow Cloud</h2>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Lab</p>
                    <p className="text-4xl font-black text-indigo-600 tracking-tighter italic">€ {dashboardStats.totalRevenue},00</p>
                 </div>
              </div>
              
              <div className="relative w-full max-w-md shadow-sm rounded-2xl mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder="Cerca ordine o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 p-4 pl-12 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm" />
              </div>

              <div className="grid gap-8">
                {savedOrders.filter(o => o.cliente.toLowerCase().includes(searchTerm.toLowerCase())).map(o => {
                   const s = STATUS_FLOW.find(x => x.id === (o.status || 'preventivo')) || STATUS_FLOW[0];
                   const Icon = s.icon;
                   return (
                    <div key={o.firestoreId} className={`bg-white p-10 rounded-[3.5rem] border-2 shadow-sm flex items-center justify-between group transition-all hover:shadow-2xl relative overflow-hidden ${s.border}`}>
                       <div className="flex items-center gap-10 flex-1">
                          <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center font-black ${s.bg} ${s.color} shadow-inner`}><Icon size={32} /></div>
                          <div>
                             <div className="flex items-center gap-5">
                                <h4 className="text-4xl font-black uppercase tracking-tighter">{o.cliente}</h4>
                                <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase border ${s.color} ${s.bg} tracking-widest`}>{s.label}</span>
                             </div>
                             <p className="text-[11px] font-bold text-slate-400 uppercase mt-3 tracking-widest">ID: FR-{o.id} • {o.date}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-12">
                          <p className="text-4xl font-black text-slate-900 tracking-tighter">€ {o.results?.totale},00</p>
                          <div className="flex gap-2">
                             {STATUS_FLOW.map(sf => {
                               const MiniIcon = sf.icon;
                               return (
                                 <button key={sf.id} onClick={() => updateStatus(o.firestoreId, sf.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${o.status === sf.id ? `${sf.bg} ${sf.color} border-2 border-current scale-110 shadow-lg` : 'text-slate-200 hover:text-slate-400'}`}><MiniIcon size={16} /></button>
                               );
                             })}
                             <button onClick={() => deleteOrder(o.firestoreId)} className="p-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={20}/></button>
                          </div>
                       </div>
                    </div>
                   );
                })}
              </div>
           </div>
        )}

        {/* TAB: RUBRICA CLIENTI */}
        {activeTab === 'customers' && (
          <div className="animate-in fade-in max-w-6xl mx-auto py-8">
            <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900 mb-16 flex items-center gap-6 leading-none"><div className="bg-black p-5 rounded-3xl text-white shadow-2xl"><Users size={40} /></div> Anagrafica Clienti</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
               {customers.map(c => (
                 <div key={c.id} className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 font-black text-4xl uppercase shadow-inner">{c.nome ? c.nome[0] : '?'}</div>
                    <h4 className="text-3xl font-black uppercase text-slate-900 tracking-tighter mb-6 leading-tight">{c.nome}</h4>
                    <div className="space-y-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] border-l-4 border-slate-50 pl-6">
                       <p className="flex items-center gap-3"><Phone size={14} className="text-indigo-500" /> {c.telefono || '---'}</p>
                       <p className="flex items-center gap-3"><Mail size={14} className="text-indigo-500" /> {c.email || '---'}</p>
                    </div>
                    <button onClick={() => selectCustomer(c)} className="mt-12 w-full bg-slate-900 text-white p-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">Inizia Preventivo</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* TAB: LISTINI E SETTINGS */}
        {activeTab === 'settings' && (
           <div className="max-w-4xl mx-auto py-10 animate-in fade-in">
              <div className="bg-white p-16 rounded-[4.5rem] shadow-2xl border border-slate-200 space-y-16">
                 <h2 className="text-6xl font-black uppercase tracking-tighter flex items-center gap-8 leading-none italic"><div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-2xl rotate-2"><Settings size={44} /></div> Workshop Control</h2>
                 <div className="grid md:grid-cols-2 gap-20 border-t-2 border-slate-100 pt-16">
                    <div className="space-y-10">
                       <h4 className="text-[13px] font-black uppercase text-indigo-500 tracking-[0.4em] flex items-center gap-4">Varianti Prodotto</h4>
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
                             const nome = prompt("Nome Prodotto:");
                             const costo = parseFloat(prompt("Costo unitario (€):"));
                             const cat = prompt("Categoria (Abbigliamento, Felpe, Adesivi):", "Abbigliamento");
                             if(nome && costo) setSheetData({...sheetData, supporti: [...sheetData.supporti, {id: Date.now(), categoria: cat, nome, costo}]});
                          }} className="w-full bg-slate-900 text-white p-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">+ Aggiungi Prodotto</button>
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
          .print-area { box-shadow: none !important; border: none !important; width: 100% !important; height: auto !important; margin: 0 !important; padding: 1.5cm !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.4s ease-out forwards; }
      `}} />
    </div>
  );
};

export default App;
