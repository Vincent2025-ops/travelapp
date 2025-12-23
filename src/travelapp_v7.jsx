import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Map, Calendar, StickyNote, Languages, Navigation, Plus, MapPin, 
  Clock, Trash2, Utensils, ShoppingBag, BedDouble, Camera, Share, 
  Search, Mic, ArrowDown, X, Edit3, GripVertical, Check, Aperture, 
  Loader2, ExternalLink, Menu, DollarSign, Sun, CloudRain, Cloud, 
  Copy, Image as ImageIcon, RefreshCcw, Settings, Info, ArrowLeft,
  LayoutGrid, List as ListIcon, Globe, Download, AlertTriangle, Share2,
  Smartphone, Shield, FerrisWheel, UploadCloud, FileText, Clipboard,
  Minus
} from 'lucide-react';

// --- 1. Google Sheet 資料獲取 (CSV Fetching) ---

// 您的 Google Sheet 連結 (Export as CSV)
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1TaKPCN4jeiQTH0ZAr5v1ZoWPnnfTOksSoptqW2lA7b8/export?format=csv";

// 簡單的 CSV 解析器
const parseCSV = (text) => {
  if (!text) return [];
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    // 處理引號內的逗號
    const row = [];
    let inQuotes = false;
    let currentVal = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());

    // 將陣列轉為物件
    const obj = {};
    headers.forEach((h, index) => {
      let val = row[index] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      obj[h] = val;
    });
    return obj;
  });
};

const fetchPlacesFromGoogleSheet = async () => {
  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
    const text = await response.text();
    return parseCSV(text);
  } catch (error) {
    console.warn("無法讀取 Google Sheet 資料 (可能是 CORS 跨域限制或網絡問題)。將顯示錯誤提示卡片。");
    return [
      { 
        id: 'error_msg', 
        city: '系統訊息', 
        keyword: 'Error', 
        category: 'misc', 
        img: '⚠️', 
        title: '連線提示', 
        location: '資料庫', 
        description: '暫時無法連結至 Google Sheet 資料庫 (因瀏覽器跨域安全限制)，請稍後再試。', 
        mapsLink: '' 
      }
    ];
  }
};

const CATEGORIES = {
  food: { label: '美食', icon: Utensils, color: 'bg-orange-100 text-orange-600 border-orange-200' },
  shopping: { label: '購物', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600 border-pink-200' },
  scenery: { label: '風景', icon: Camera, color: 'bg-green-100 text-green-600 border-green-200' },
  stay: { label: '住宿', icon: BedDouble, color: 'bg-blue-100 text-blue-600 border-blue-200' },
  fun: { label: '遊樂', icon: FerrisWheel, color: 'bg-purple-100 text-purple-600 border-purple-200' },
  misc: { label: '其他', icon: Settings, color: 'bg-gray-100 text-gray-600 border-gray-200' }
};

const TRANSLATION_DICT = {
  "你好": { text: "こんにちは", romaji: "Konnichiwa" },
  "謝謝": { text: "ありがとう", romaji: "Arigatou" },
  "多少錢": { text: "いくらですか", romaji: "Ikura desu ka" },
  "好吃": { text: "おいしい", romaji: "Oishii" },
};

// 預設行程範本
const NEW_TRIP_TEMPLATE = {
  destination: "沖繩 Okinawa Trip",
  startDate: new Date().toISOString().split('T')[0],
  dates: ["Day 1", "Day 2", "Day 3"],
  days: { "Day 1": [], "Day 2": [], "Day 3": [] },
  notes: { "Day 1": "", "Day 2": "", "Day 3": "" }
};

const DEFAULT_TRIPS = [
  {
    id: 'default_okinawa',
    ...NEW_TRIP_TEMPLATE,
    destination: "沖繩自駕遊", 
    startDate: "2024-07-10",
    days: {
      "Day 1": [], "Day 2": [], "Day 3": []
    }
  }
];

// --- Helper Functions ---
const isTimePassedCheck = (day, timeStr) => {
    if (day !== "Day 1") return false; 
    return timeStr < "12:00"; 
};

// 格式化時間顯示
const formatTimeDisplay = (time24) => {
    return time24 || '';
};

// 剪貼簿複製 helper
const copyToClipboard = (text, onSuccess, onError) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(onSuccess)
        .catch((err) => {
            console.warn('Clipboard API failed, trying fallback...');
            fallbackCopyText(text, onSuccess, onError);
        });
  } else {
      fallbackCopyText(text, onSuccess, onError);
  }
};

const fallbackCopyText = (text, onSuccess, onError) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      if (onSuccess) onSuccess();
    } else {
      if (onError) onError(new Error("Copy command failed"));
    }
  } catch (err) {
    if (onError) onError(err);
  }
  
  document.body.removeChild(textArea);
};

// --- 子組件 ---

const ToastContainer = ({ toasts }) => (
  <div className="fixed top-4 left-0 right-0 z-[80] flex flex-col items-center pointer-events-none space-y-2">
    {toasts.map((toast) => (
      <div 
        key={toast.id} 
        className={`bg-white px-4 py-3 rounded-full shadow-lg border-2 flex items-center animate-in slide-in-from-top-2 duration-300 pointer-events-auto ${
          toast.type === 'success' ? 'border-green-400 text-green-800' : 
          toast.type === 'info' ? 'border-blue-400 text-blue-800' : 'border-yellow-400 text-yellow-800'
        }`}
      >
        {toast.type === 'success' ? <Check size={16} className="mr-2 bg-green-100 rounded-full p-0.5" /> : 
         toast.type === 'info' ? <Info size={16} className="mr-2" /> : <Loader2 size={16} className="mr-2 animate-spin"/>}
        <span className="text-sm font-bold">{String(toast.message)}</span>
      </div>
    ))}
  </div>
);

const PermissionModal = ({ type, onConfirm, onCancel }) => {
    if (!type) return null;
    const config = {
        mic: { title: "允許錄製音訊？", desc: "此功能需要存取您的麥克風以進行語音翻譯。", icon: Mic },
        location: { title: "允許存取位置資訊？", desc: "為了顯示您周邊的地圖與路線，需要存取您的 GPS 位置。", icon: MapPin },
    };
    const { title, desc, icon: Icon } = config[type];

    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <Icon size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                    <p className="text-sm text-gray-500 mt-2">{desc}</p>
                </div>
                <div className="flex flex-col space-y-2">
                    <button onClick={onConfirm} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">允許</button>
                    <button onClick={onCancel} className="w-full py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">拒絕</button>
                </div>
            </div>
        </div>
    );
};

const Sidebar = ({ isOpen, onClose, onUpdateDestination, destinationValue, startDate, setStartDate, duration, setDuration, onInstallApp, isPwaReady }) => (
  <>
    {isOpen && <div key="sidebar-overlay" className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />}
    <div key="sidebar-main" className={`fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out p-6 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-gray-800 flex items-center"><Settings className="mr-2"/>設定</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X size={24} /></button>
      </div>

      <div className="space-y-8 flex-1">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase mb-3 block tracking-wider">本次旅行名稱</label>
          <div className="relative">
             <Globe className="absolute left-3 top-3 text-gray-400" size={18}/>
             <input 
              type="text" 
              value={destinationValue || ''}
              onChange={(e) => onUpdateDestination(e.target.value)}
              placeholder="輸入旅行名稱..."
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 pl-10 font-bold text-gray-700 outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase mb-3 block tracking-wider">旅程開始日期</label>
          <div className="relative mb-4">
             <Calendar className="absolute left-3 top-3 text-gray-400" size={18}/>
             <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 pl-10 font-bold text-gray-700 outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <label className="text-xs font-bold text-gray-400 uppercase mb-3 block tracking-wider">旅遊天數 (Days)</label>
          <div className="relative flex items-center border-2 border-gray-100 rounded-xl overflow-hidden bg-white">
             <button 
                onClick={() => setDuration(Math.max(1, duration - 1))}
                className="p-3 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 transition text-gray-600 border-r border-gray-100"
             >
                <Minus size={18} />
             </button>
             <input 
              type="number" 
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              className="w-full p-3 text-center font-bold text-gray-700 outline-none appearance-none"
              style={{MozAppearance: 'textfield'}} 
            />
             <button 
                onClick={() => setDuration(duration + 1)}
                className="p-3 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 transition text-gray-600 border-l border-gray-100"
             >
                <Plus size={18} />
             </button>
          </div>
        </div>
      </div>
      
      <div className="pt-4 border-t border-gray-100 space-y-3">
          <button 
            onClick={onInstallApp}
            className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl bg-yellow-400 text-white font-bold hover:bg-yellow-500 transition-colors shadow-md active:scale-95"
          >
            <Smartphone size={18} />
            <span>安裝應用程式 (PWA)</span>
          </button>
          <div className="text-center text-xs text-gray-400">
              Wanderlust Tracker v5.4
          </div>
      </div>
    </div>
  </>
);

const PreviewCardModal = ({ itinerary, day, onClose, onDownload }) => {
    const items = itinerary.days[day] || [];
    return (
        <div key="preview-modal" className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">行程卡預覽</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-yellow-50">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-gray-800">{itinerary.destination}</h2>
                            <div className="text-yellow-600 font-bold mt-1">{day} 行程表</div>
                        </div>
                        <div className="space-y-4">
                            {items.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm">尚無行程</p>
                            ) : (
                                items.map((item, idx) => (
                                    <div key={idx} className="flex items-start">
                                        <div className="w-12 text-sm font-bold text-gray-500 pt-1">{formatTimeDisplay(item.time)}</div>
                                        <div className="flex-1 border-l-2 border-yellow-200 pl-4 pb-4 relative">
                                            <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-yellow-400"></div>
                                            <div className="font-bold text-gray-800">{item.title}</div>
                                            {item.location && <div className="text-xs text-gray-400">📍 {item.location}</div>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
                            Generated by Wanderlust Tracker
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-white flex space-x-3">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">取消</button>
                    <button onClick={onDownload} className="flex-1 py-3 bg-yellow-400 text-white font-bold rounded-xl shadow-lg hover:bg-yellow-500 transition-colors flex items-center justify-center">
                        <Download size={18} className="mr-2"/> 儲存圖片
                    </button>
                </div>
            </div>
        </div>
    );
};

// 4. 工具箱 Modal
const ToolsModal = ({ onClose, onExport, onImport, allTrips, activeTripId, onInstall }) => {
    const fileInputRef = useRef(null);
    const [importCode, setImportCode] = useState("");
    const [selectedTripToShare, setSelectedTripToShare] = useState('all');

    useEffect(() => {
        if (activeTripId) {
            setSelectedTripToShare(activeTripId);
        } else {
            setSelectedTripToShare('all');
        }
    }, [activeTripId]);

    const handleImportText = () => {
        if (!importCode) return;
        try {
            const data = JSON.parse(importCode);
            onImport(data);
        } catch (e) {
            alert("代碼格式錯誤，請確認複製內容是否完整。");
        }
    };

    const handleCopyShareCode = () => {
        let code = "";
        if (selectedTripToShare === 'all') {
            code = localStorage.getItem('wanderlust_all_trips_v6') || "[]";
        } else {
            const trip = allTrips.find(t => t.id === selectedTripToShare);
            if (trip) {
                code = JSON.stringify(trip);
            }
        }
        
        if (code) {
             copyToClipboard(code, () => alert("行程代碼已複製！"), () => alert("複製失敗"));
        } else {
            alert("找不到資料");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"><X size={24}/></button>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center justify-center">
                   <Settings size={24} className="mr-2 text-yellow-500" />
                   工具箱
                </h3>

                <div className="mb-6 border-b border-gray-100 pb-6">
                    <h4 className="font-bold text-gray-700 mb-3 flex items-center"><UploadCloud size={18} className="mr-2"/> 檔案備份/還原</h4>
                    <div className="grid grid-cols-2 gap-3">
                         <button onClick={onExport} className="p-3 bg-green-100 text-green-700 rounded-xl font-bold hover:bg-green-200 transition flex flex-col items-center justify-center">
                             <Download size={20} className="mb-1"/>
                             匯出備份檔
                         </button>
                         <button onClick={() => fileInputRef.current.click()} className="p-3 bg-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-200 transition flex flex-col items-center justify-center">
                             <UploadCloud size={20} className="mb-1"/>
                             匯入備份檔
                         </button>
                         <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                             if (e.target.files[0]) {
                                 const reader = new FileReader();
                                 reader.onload = (ev) => {
                                     try {
                                         const data = JSON.parse(ev.target.result);
                                         onImport(data);
                                     } catch(err) { alert("檔案讀取失敗"); }
                                 };
                                 reader.readAsText(e.target.files[0]);
                             }
                         }} />
                    </div>
                </div>

                <div>
                    <h4 className="font-bold text-gray-700 mb-3 flex items-center"><FileText size={18} className="mr-2"/> 文字代碼分享</h4>
                    <p className="text-xs text-gray-500 mb-2">將行程轉為文字代碼，方便在手機通訊軟體傳送。</p>
                    
                    <div className="mb-3">
                        <select 
                            value={selectedTripToShare} 
                            onChange={(e) => setSelectedTripToShare(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                        >
                            <option value="all">📁 全部行程 (完整備份)</option>
                            {allTrips.map(trip => (
                                <option key={trip.id} value={trip.id}>✈️ {trip.destination}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={handleCopyShareCode}
                        className="w-full p-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition mb-4 flex items-center justify-center border border-gray-300"
                    >
                        <Copy size={16} className="mr-2"/> 複製選定行程代碼
                    </button>
                    
                    <div className="relative">
                        <textarea 
                            value={importCode}
                            onChange={(e) => setImportCode(e.target.value)}
                            placeholder="在此貼上朋友分享的代碼..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                        ></textarea>
                        <button 
                            onClick={handleImportText}
                            className="absolute bottom-3 right-3 bg-yellow-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow hover:bg-yellow-600"
                        >
                            匯入
                        </button>
                    </div>
                </div>

                {/* 3. PWA 安裝按鈕 */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                     <h4 className="font-bold text-gray-700 mb-3 flex items-center"><Smartphone size={18} className="mr-2"/> 安裝 App</h4>
                     <button onClick={onInstall} className="w-full p-4 bg-yellow-400 text-white font-bold rounded-2xl shadow-lg hover:bg-yellow-500 transition flex items-center justify-center">
                         <Download size={20} className="mr-2"/> 安裝至主畫面
                     </button>
                </div>
             </div>
        </div>
    );
};

// --- 3. 獨立視圖元件 (Extracted View Components) ---

// Dashboard View Component
const DashboardView = ({ allTrips, onSetActiveTripId, onCreateTrip, onDeleteTrip, onUpdateTripTitle, onOpenTools }) => {
    const [viewMode, setViewMode] = useState('grid');
    
    return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
       <div className="bg-yellow-400 px-6 py-8 rounded-b-[40px] shadow-lg mb-6 relative">
          <div className="flex justify-between items-center mb-2">
             <h1 className="text-3xl font-black text-gray-800 tracking-tight">我的冒險旅程</h1>
             <div className="flex space-x-2">
                 {/* 工具箱按鈕 */}
                 <button onClick={onOpenTools} className="bg-white/30 p-2 rounded-full text-yellow-900 hover:bg-white/50 transition">
                   <Settings size={24} />
                 </button>
                 <button onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')} className="bg-white/30 p-2 rounded-full text-yellow-900 hover:bg-white/50 transition">
                   {viewMode === 'grid' ? <ListIcon size={24} /> : <LayoutGrid size={24} />}
                 </button>
             </div>
          </div>
          <p className="text-yellow-800 font-bold opacity-80">紀錄每一個精彩瞬間 ✨</p>
       </div>

       <div className="flex-1 px-6 overflow-y-auto pb-24 space-y-4">
          {allTrips.map(trip => (
             <div 
                key={trip.id} 
                onClick={() => onSetActiveTripId(trip.id)}
                className={`bg-white p-5 rounded-3xl shadow-sm border-2 border-transparent hover:border-yellow-400 transition-all cursor-pointer active:scale-95 group relative overflow-hidden ${viewMode === 'list' ? 'flex items-center space-x-4' : 'flex flex-col'}`}
             >
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-100 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-500 pointer-events-none"></div>
                <div className={`flex items-center justify-center bg-gray-100 text-3xl rounded-2xl ${viewMode === 'list' ? 'w-16 h-16 flex-shrink-0' : 'w-full h-32 mb-4'}`}>
                   {trip.destination.includes('大阪') ? '🏯' : trip.destination.includes('東京') ? '🗼' : trip.destination.includes('台北') ? '🇹🇼' : trip.destination.includes('沖繩') ? '🐠' : '🌍'}
                </div>
                <div className="flex-1 z-10">
                   <div className="relative group/edit">
                     <input 
                       type="text" 
                       value={trip.destination}
                       onClick={(e) => e.stopPropagation()} 
                       onChange={(e) => onUpdateTripTitle(trip.id, e.target.value)}
                       className="text-xl font-black text-gray-800 leading-tight mb-1 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-yellow-400 outline-none w-full transition-colors"
                     />
                     <Edit3 size={14} className="absolute right-0 top-1.5 text-gray-300 opacity-0 group-hover/edit:opacity-100 pointer-events-none" />
                   </div>
                   <div className="flex items-center text-gray-500 text-xs font-bold space-x-2 mt-1">
                      <Calendar size={12} />
                      <span className="bg-gray-100 px-2 py-1 rounded-md">{trip.startDate}</span>
                      <span>• {trip.dates.length} 天</span>
                   </div>
                </div>
                <button onClick={(e) => onDeleteTrip(e, trip.id)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-gray-300 hover:text-red-500 shadow-sm z-20"><Trash2 size={16} /></button>
             </div>
          ))}
          <button 
            key="create-new-trip-btn"
            onClick={onCreateTrip}
            className={`w-full border-4 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:border-yellow-400 hover:text-yellow-500 hover:bg-yellow-50 transition-all ${viewMode === 'list' ? 'h-24' : 'h-48'}`}
          >
             <Plus size={32} className="mb-2" />
             <span className="font-bold">規劃新旅程</span>
          </button>
       </div>
    </div>
    );
};

// Map View Component
const MapView = ({ itinerary, currentDay, onBack, onRequestPermission, addToast, focusedItem, onClearFocus }) => {
    const [userLocation, setUserLocation] = useState(null);
    const [locationError, setLocationError] = useState(false);
    const [selectedMapItem, setSelectedMapItem] = useState(focusedItem);

    // Sync focusedItem prop to internal state, but allow internal state to change (clicking top nav)
    useEffect(() => {
        setSelectedMapItem(focusedItem);
    }, [focusedItem]);

    const items = itinerary.days[currentDay] || [];
    const hasRoute = items.length > 0;
    
    // Determine the route based on selection
    // If selectedMapItem is present, route is Current -> SelectedItem
    // If NO selectedMapItem, route is Current -> Item1 -> Item2 ... -> LastItem (Full day view)
    let routeUrl = "";
    const displayItems = selectedMapItem ? [selectedMapItem] : items;
    
    if (displayItems.length > 0) {
        // Construct the origin part of the URL based on user location availability
        const originQuery = userLocation 
            ? `${userLocation.lat},${userLocation.lng}` 
            : 'Current+Location';

        // If single item focused
        if (selectedMapItem) {
             const destination = encodeURIComponent(selectedMapItem.location || selectedMapItem.title);
             routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destination}&travelmode=driving`;
        } else {
             // Full day route
             const destination = encodeURIComponent(items[items.length - 1].location || items[items.length - 1].title);
             const waypoints = items.slice(0, items.length - 1).slice(0, 8).map(i => encodeURIComponent(i.location || i.title)).join('|');
             routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
        }
    }

    // Embed map logic
    // If focused, center on it. If not, center on user location if available, otherwise first stop
    let mapCenter = "Taipei";
    
    if (selectedMapItem) {
        mapCenter = selectedMapItem.location || selectedMapItem.title;
    } else if (userLocation) {
        mapCenter = `${userLocation.lat},${userLocation.lng}`;
    } else if (items.length > 0) {
        mapCenter = items[0].location || items[0].title;
    }

    const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapCenter)}&z=14&output=embed`;


    useEffect(() => {
        // Updated Logic: Check permission status first (if possible) or try to get location if we think we might have it
        const checkLocation = () => {
             if (navigator.geolocation) {
                // If we want to avoid prompt, we rely on browser behavior. 
                // Calling getCurrentPosition will show prompt if not granted.
                // To check 'if authorized' without prompt is tricky in some browsers without Permissions API.
                // Here we just try to get it. If it was granted before, it wont prompt.
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                        setLocationError(false);
                    },
                    (error) => {
                        console.error(error);
                        // Only set error if we really expected it to work or user explicitly denied now
                        if(error.code === error.PERMISSION_DENIED) {
                            setLocationError(true);
                            addToast('定位未授權，顯示預設地圖', 'info');
                        }
                    }
                );
            }
        };
        
        // We use the same requestPermission wrapper which might check Permissions API in App component
        onRequestPermission('location', checkLocation);
    }, []);

    return (
    <div className="h-full bg-gray-100 relative flex flex-col">
      <div className="absolute top-4 left-4 right-4 z-10 bg-white p-3 rounded-2xl shadow-lg flex flex-col">
        <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center">
                {/* 調整返回按鈕：地圖 -> 行程表 */}
                <button onClick={onBack} className="mr-3 p-1 bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
                <MapPin className="text-purple-500 mr-2" />
                <span className="font-bold text-gray-700">
                    {selectedMapItem ? `導航前往: ${selectedMapItem.title}` : "當日路線導航"}
                </span>
            </div>
        </div>
        
        {/* 強大的導航按鈕 */}
        {displayItems.length > 0 && (
             <a href={routeUrl} target="_blank" rel="noopener noreferrer" className="w-full mb-3 flex items-center justify-center bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-transform hover:bg-blue-700">
                <Navigation size={18} className="mr-2" />
                🚀 開啟完整導航路線 (Google Maps)
             </a>
        )}

        {/* 返回當日總覽按鈕 (僅在單點模式顯示) */}
        {selectedMapItem && (
             <button onClick={() => { setSelectedMapItem(null); onClearFocus(); }} className="w-full mb-2 flex items-center justify-center bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200">
                <Map size={14} className="mr-2" />
                顯示當日全行程
             </button>
        )}

        {/* 判斷無行程的情況 (Empty State) */}
        {!hasRoute && (
            <div className="text-center py-6 text-gray-500">
                 <p className="text-xs font-medium mb-1">⚠️ 尚無行程目標</p>
                 <p className="text-[10px]">請先在行程表中新增景點</p>
            </div>
        )}
        
        {/* 上方行程列表 (可點擊切換單點導航) */}
        {hasRoute && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-hide">
                 <span 
                    className={`text-[10px] px-2 py-1 rounded whitespace-nowrap border cursor-pointer ${
                        !selectedMapItem && userLocation ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}
                    onClick={() => {
                        if (userLocation) {
                             setSelectedMapItem(null); 
                             onClearFocus();
                        } else {
                            addToast("尚未取得定位", "info");
                            onRequestPermission('location', () => {}); // Retry permission
                        }
                    }}
                 >
                    起點: 當前位置
                 </span>
                 {items.map((item, i) => {
                     const isPassed = isTimePassedCheck(currentDay, item.time);
                     const isSelected = selectedMapItem && selectedMapItem.id === item.id;
                     return (
                     <React.Fragment key={i}>
                        <span className="text-gray-300">→</span>
                        <button 
                            onClick={() => setSelectedMapItem(item)}
                            className={`text-[10px] px-2 py-1 rounded whitespace-nowrap border transition-colors ${
                                isSelected 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                                : isPassed 
                                    ? 'bg-gray-100 text-gray-400 line-through border-gray-200' 
                                    : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'
                            }`}
                        >
                            {item.title}
                        </button>
                     </React.Fragment>
                 )})}
            </div>
        )}

        {(locationError) && (
             <div className="mt-2 flex items-center text-xs text-orange-600 bg-orange-50 p-2 rounded-lg">
                <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
                <span>無法取得您的目前位置，請檢查定位權限。</span>
            </div>
        )}
      </div>
      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-purple-50/50">
        <iframe 
          width="100%" 
          height="100%" 
          frameBorder="0" 
          style={{ border: 0 }} 
          // 使用更通用的 Embed URL
          src={mapSrc}
          allowFullScreen
        ></iframe>
      </div>
    </div>
  )};

// Translate View Component
const TranslateView = ({ onBack, onRequestPermission, addToast }) => {
    const [transInput, setTransInput] = useState("");
    const [transOutput, setTransOutput] = useState({ text: "こんにちは！", romaji: "(Konnichiwa)" });
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    const handleTranslate = (text) => {
        setTransInput(text);
        if (!text) { setTransOutput({ text: "...", romaji: "" }); return; }
        setTransOutput({ text: "翻譯中...", romaji: "..." });
        setTimeout(() => {
            const match = Object.keys(TRANSLATION_DICT).find(key => text.includes(key));
            if (match) setTransOutput(TRANSLATION_DICT[match]);
            else setTransOutput({ text: `[日文]: ${text}`, romaji: "(點擊下方按鈕開啟 Google 翻譯)" });
        }, 600);
    };

    const handleOpenGoogleTranslate = () => {
        const text = encodeURIComponent(transInput);
        const url = `https://translate.google.com/?sl=auto&tl=ja&text=${text}&op=translate`;
        window.open(url, '_blank');
    };

    const startListening = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = 'zh-TW';
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.onstart = () => setIsListening(true);
            recognitionRef.current.onend = () => setIsListening(false);
            recognitionRef.current.onerror = () => { setIsListening(false); addToast('語音辨識失敗', 'info'); };
            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setTransInput(transcript); 
                handleTranslate(transcript);
            };
            recognitionRef.current.start();
        } else {
            alert("您的瀏覽器不支援語音辨識功能");
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
    };

    return (
        <div className="h-full bg-blue-50 p-6 flex flex-col items-center relative">
            <div className="w-full flex items-center mb-6 mt-2">
                <button onClick={onBack} className="bg-white p-2 rounded-full text-blue-700 shadow-sm mr-4"><ArrowLeft size={20}/></button>
                <h2 className="text-2xl font-black text-blue-800">翻譯蒟蒻</h2>
            </div>
            <div className="w-full bg-white p-6 rounded-[2rem] shadow-lg border-b-8 border-blue-100 mb-4 transform hover:scale-[1.02] transition-transform">
                <div className="flex justify-between text-gray-400 text-sm font-bold mb-2"><span>中文</span><Edit3 size={14} /></div>
                <textarea placeholder="輸入文字..." className="w-full text-xl font-bold text-gray-700 outline-none resize-none h-24 placeholder-gray-300" value={transInput} onChange={(e) => handleTranslate(e.target.value)}></textarea>
            </div>
            <div className="bg-yellow-400 p-3 rounded-full text-white shadow-md z-10 -my-8 border-4 border-blue-50"><ArrowDown size={24} strokeWidth={3} /></div>
            <div className="w-full bg-blue-600 p-6 rounded-[2rem] shadow-lg mt-4 text-white min-h-[140px] flex flex-col justify-center relative">
                <div className="flex justify-between text-blue-200 text-sm font-bold mb-2"><span>日文</span></div>
                {transInput ? (
                    <>
                        <p className="text-2xl font-black break-words">{transOutput.text}</p>
                        <p className="text-sm opacity-80 mt-1">{transOutput.romaji}</p>
                    </>
                ) : (
                    <p className="text-gray-200 text-center text-sm">請輸入文字或使用語音</p>
                )}
                <button 
                    onClick={handleOpenGoogleTranslate}
                    className="absolute bottom-4 right-4 bg-white text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-blue-50 transition-colors flex items-center"
                >
                    前往 Google 翻譯 <ExternalLink size={10} className="ml-1" />
                </button>
            </div>
            <div className="flex justify-center mt-auto mb-8 relative z-20 w-full">
                <button 
                    onMouseDown={() => onRequestPermission('mic', startListening)} 
                    onTouchStart={(e) => { e.preventDefault(); onRequestPermission('mic', startListening); }} 
                    onMouseUp={stopListening} 
                    onTouchEnd={(e) => { e.preventDefault(); stopListening(); }} 
                    className="flex flex-col items-center space-y-2 group transform transition-transform active:scale-95"
                >
                <div className={`w-20 h-20 rounded-full shadow-lg border-4 flex items-center justify-center transition-all ${isListening ? 'bg-red-500 border-red-200 scale-110 animate-pulse' : 'bg-orange-400 border-orange-200 animate-bounce'}`}><Mic size={32} className="text-white" /></div>
                <span className={`text-xs font-bold ${isListening ? 'text-red-500' : 'text-orange-500'}`}>{isListening ? '正在聆聽...' : '按住說話'}</span>
                </button>
            </div>
        </div>
    );
};

// Recommendation View Component
const RecommendationView = ({ itinerary, onBack, onAddItem }) => {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
    const [placesDB, setPlacesDB] = useState([]); 

    useEffect(() => {
        const loadPlaces = async () => {
            const data = await fetchPlacesFromGoogleSheet();
            setPlacesDB(data);
        };
        loadPlaces();
    }, []);

    useEffect(() => {
        if (itinerary.destination && placesDB.length > 0 && !searchKeyword) {
             const dest = itinerary.destination.includes(' ') ? itinerary.destination.split(' ')[0] : itinerary.destination;
             setSearchKeyword(dest);
             performSearch(dest);
        }
    }, [itinerary.destination, placesDB]);

    const performSearch = (keyword) => {
        setIsSearching(true);
        setTimeout(() => {
            const lower = keyword.toLowerCase();
            const results = placesDB.filter(p => 
                p.city.includes(keyword) || (p.keyword && lower.includes(p.keyword.toLowerCase())) ||
                p.title.includes(keyword) || p.description.includes(keyword)
            );
            setSearchResults(results);
            setIsSearching(false);
        }, 600);
    };

    return (
        <div className="pb-28 bg-green-50 min-h-screen p-5">
            <div className="flex items-center mb-4">
                <button onClick={onBack} className="bg-white p-2 rounded-full text-green-700 shadow-sm mr-4"><ArrowLeft size={20}/></button>
                <h2 className="text-2xl font-black text-green-800">探索 {itinerary.destination}</h2>
            </div>
            <p className="text-green-600 mb-6 font-medium text-sm">搜尋當地熱門景點，加入你的行程！</p>

            <form onSubmit={(e) => { e.preventDefault(); performSearch(searchKeyword); }} className="relative mb-6">
                <input 
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜尋景點 (如: 沖繩、水族館)..."
                    className="w-full p-4 pl-12 rounded-2xl border-4 border-green-200 bg-white font-bold text-green-900 placeholder-green-300 focus:outline-none focus:border-green-400 shadow-sm"
                />
                <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-green-400" />
                <button type="submit" className="absolute right-2 top-2 bottom-2 bg-green-500 text-white px-4 rounded-xl font-bold text-sm hover:bg-green-600 shadow-sm active:scale-95 transition-transform">搜尋</button>
            </form>

            <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
                <button key="all-filter" onClick={() => setActiveCategoryFilter('all')} className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap transition-colors ${activeCategoryFilter === 'all' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-100'}`}>全部</button>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <button key={key} onClick={() => setActiveCategoryFilter(key)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap flex items-center transition-colors ${activeCategoryFilter === key ? cat.color.replace('bg-', 'bg-white ').replace('border-', 'border-current ') + ' ring-2 ring-offset-1' : 'bg-white text-gray-400 border-gray-100'}`}><cat.icon size={12} className="mr-1" />{cat.label}</button>
                ))}
            </div>

            {isSearching ? (
                <div key="is-searching-loading" className="flex flex-col items-center justify-center py-20 text-green-400"><Loader2 size={40} className="animate-spin mb-2" /><span className="font-bold">搜尋資料中...</span></div>
            ) : (
                <div key="search-results-grid" className="grid grid-cols-2 gap-4">
                    {searchResults.filter(item => activeCategoryFilter === 'all' || item.category === activeCategoryFilter).map(rec => (
                    <div key={rec.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border-b-4 border-gray-100 flex flex-col items-center text-center relative group">
                        <div className={`absolute top-3 right-3 p-1.5 rounded-lg ${CATEGORIES[rec.category]?.color} bg-opacity-20`}><MapPin size={14} /></div>
                        <div className="text-5xl mb-3 mt-4 transform group-hover:scale-110 transition-transform">{rec.img}</div>
                        <h3 className="font-black text-gray-800 mb-1 leading-tight text-lg">{rec.title}</h3>
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2 px-1 h-8">{rec.description}</p>
                        <div className="w-full space-y-2">
                            {rec.mapsLink && <a href={rec.mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full py-1.5 bg-blue-50 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-100"><ExternalLink size={12} className="mr-1" /> 地圖查看</a>}
                            <button onClick={() => onAddItem(rec)} className="w-full py-2.5 bg-green-100 text-green-700 rounded-xl font-bold text-sm hover:bg-green-200 active:scale-95 transition-all">+ 加入行程</button>
                        </div>
                    </div>
                    ))}
                    {!isSearching && searchResults.length === 0 && (
                        <div key="no-results-fallback" className="col-span-2 text-center py-10 text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                            <p className="font-bold mb-2">找不到相關景點 🥲</p>
                            <a href={`https://www.google.com/maps/search/${searchKeyword}`} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-200"><Map size={16} className="mr-2" /> 去 Google Map 搜尋</a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- 4. 主應用程式 ---

export default function TravelApp() {
  const [allTrips, setAllTrips] = useState(DEFAULT_TRIPS);
  
  // Initialize from storage or null
  const [activeTripId, setActiveTripId] = useState(() => localStorage.getItem('activeTripId_v1'));

  // Initialize view state from storage
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab_v1') || 'itinerary');
  const [currentDay, setCurrentDay] = useState(() => localStorage.getItem('currentDay_v1') || 'Day 1');
  
  const [itinerary, setItinerary] = useState(NEW_TRIP_TEMPLATE); 
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [placesDB, setPlacesDB] = useState([]); 
  const [showToolsModal, setShowToolsModal] = useState(false); // New state for Tools Modal
  const [focusedMapItem, setFocusedMapItem] = useState(null); // New state for single map item focus
  
  const [dashboardView, setDashboardView] = useState('grid'); 
  const [showDragHint, setShowDragHint] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [modalMode, setModalMode] = useState('add');
  const [showItemModal, setShowItemModal] = useState(false);
  const [currentItem, setCurrentItem] = useState({ id: '', time: '10:00', title: '', location: '', category: 'fun', cost: '', notes: '' });

  const [permissionModal, setPermissionModal] = useState(null); 
  
  const dragItem = useRef();
  const dragOverItem = useRef();
  
  // Install App PWA logic
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  // 動態注入 Manifest (解決 PWA 問題)
  useEffect(() => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = {
        "name": "Wanderlust Tracker",
        "short_name": "Wanderlust",
        "start_url": ".",
        "display": "standalone",
        "theme_color": "#ffffff",
        "background_color": "#ffffff",
        "icons": [
          {
            "src": "https://cdn-icons-png.flaticon.com/512/201/201623.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "https://cdn-icons-png.flaticon.com/512/201/201623.png",
            "sizes": "512x512",
            "type": "image/png"
          }
        ]
      };
      
      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], {type: 'application/json'});
      const manifestURL = URL.createObjectURL(blob);
      
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = manifestURL;
      document.head.appendChild(link);
      
      const metaApple = document.createElement('meta');
      metaApple.name = "apple-mobile-web-app-capable";
      metaApple.content = "yes";
      document.head.appendChild(metaApple);
      
      const metaMobile = document.createElement('meta');
      metaMobile.name = "mobile-web-app-capable";
      metaMobile.content = "yes";
      document.head.appendChild(metaMobile);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('PWA installation triggered');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      // 瀏覽器不支援觸發安裝，顯示手動安裝教學
      alert("【安裝教學】\n\n1. Android (Chrome): 點擊瀏覽器右上角選單 ->「安裝應用程式」或「加到主畫面」。\n\n2. iOS (Safari): 點擊下方「分享」按鈕 -> 往下滑找到「加入主畫面」。");
    }
  };

  // --- Effects ---

  useEffect(() => {
    const savedTrips = localStorage.getItem('wanderlust_all_trips_v6'); 
    if (savedTrips) {
      setAllTrips(JSON.parse(savedTrips));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('wanderlust_all_trips_v6', JSON.stringify(allTrips));
  }, [allTrips]);

  useEffect(() => {
    const loadPlaces = async () => {
        const data = await fetchPlacesFromGoogleSheet();
        setPlacesDB(data);
    };
    loadPlaces();
  }, []);
  
  // Persist trip ID
  useEffect(() => {
      if(activeTripId) localStorage.setItem('activeTripId_v1', activeTripId);
      else localStorage.removeItem('activeTripId_v1');
  }, [activeTripId]);

  // Persist view state
  useEffect(() => {
      localStorage.setItem('activeTab_v1', activeTab);
  }, [activeTab]);

  useEffect(() => {
      localStorage.setItem('currentDay_v1', currentDay);
  }, [currentDay]);

  // Sync state on load/switch
  useEffect(() => {
    if (activeTripId && allTrips.length > 0) {
      const trip = allTrips.find(t => t.id === activeTripId);
      if (trip) {
        setItinerary(trip); 
        // Logic to validate currentDay
        // Create empty day if not exists to avoid crash
        if (!trip.days[currentDay]) {
            // If currentDay is invalid (e.g. Day 4 but only 3 days), reset to Day 1
            // OR if valid (just created), ensure it exists in state
            const dayKeys = Object.keys(trip.days);
            if (dayKeys.length > 0) {
                // If currentDay is not in keys, fallback to first day
                if (!dayKeys.includes(currentDay)) {
                    setCurrentDay(dayKeys[0]);
                }
            } else {
                setCurrentDay('Day 1');
            }
        }
      } else {
          setActiveTripId(null); // ID exists but trip gone
      }
    }
  }, [activeTripId, allTrips]); 

  useEffect(() => {
    if (activeTripId) {
      const hasSeenHint = localStorage.getItem('has_seen_drag_hint');
      if (!hasSeenHint) {
        setShowDragHint(true);
        setTimeout(() => setShowDragHint(false), 4000);
        localStorage.setItem('has_seen_drag_hint', 'true');
      }
    }
  }, [activeTripId]);
  
  // Handle tab reset when switching trips
  useEffect(() => {
      if (!activeTripId) {
          setFocusedMapItem(null); // Reset map focus when leaving trip
      }
  }, [activeTripId]);


  // --- Helpers ---

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random(); 
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  };

  const updateItinerary = (newItinerary) => {
    setItinerary(newItinerary); 
    setAllTrips(prev => prev.map(t => t.id === activeTripId ? newItinerary : t)); 
  };

  const getDayInfo = (dayStr) => {
    const dayIndex = parseInt(dayStr.replace('Day ', '')) - 1;
    const date = new Date(itinerary.startDate);
    date.setDate(date.getDate() + dayIndex);
    const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const weatherIndex = (date.getDate() + dayIndex) % 3;
    const weatherTypes = ['sunny', 'cloudy', 'rain'];
    return {
      dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
      weekDay: weekDays[date.getDay()],
      weatherType: weatherTypes[weatherIndex]
    };
  };

  const calculateDailyCost = (day) => {
    return itinerary.days[day]?.reduce((sum, item) => sum + (parseInt(item.cost) || 0), 0) || 0;
  };

  const isTimePassed = (day, timeStr) => {
    if (day !== "Day 1") return false; 
    return timeStr < "12:00"; 
  };

  // --- Logic Functions ---

  const requestPermission = (type, callback) => {
      setPermissionModal({ type, callback });
  };

  const handlePermissionConfirm = () => {
      const { callback } = permissionModal;
      setPermissionModal(null);
      callback();
  };

  const handlePermissionCancel = () => {
      setPermissionModal(null);
      addToast('已取消操作', 'info');
  };

  // --- Actions ---

  const handleCreateTrip = () => {
    const newId = `trip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newTrip = { ...NEW_TRIP_TEMPLATE, id: newId };
    setAllTrips([...allTrips, newTrip]);
    setActiveTripId(newId);
    addToast("新旅程已建立！開始規劃吧 ✨");
  };

  const handleDeleteTrip = (e, tripId) => {
    e.stopPropagation();
    if (window.confirm("確定要刪除這個行程嗎？刪除後無法復原喔！")) {
      setAllTrips(prev => prev.filter(t => t.id !== tripId));
      addToast("行程已刪除", "info");
    }
  };

  const handleUpdateTripTitle = (id, newTitle) => {
    setAllTrips(prev => prev.map(t => t.id === id ? { ...t, destination: newTitle } : t));
  };
  
  const handleUpdateDestination = (newDestination) => {
      const updated = { ...itinerary, destination: newDestination };
      updateItinerary(updated);
  };

  const handleBackToDashboard = () => {
    setActiveTripId(null);
  };
  
  const handleDurationChange = (newDuration) => {
    const daysCount = parseInt(newDuration) || 1;
    const newDates = Array.from({ length: daysCount }, (_, i) => `Day ${i + 1}`);
    
    let newCurrentDay = currentDay;
    if (daysCount < parseInt(itinerary.dates.length) && !newDates.includes(currentDay)) {
        newCurrentDay = "Day 1";
    }
    
    // Ensure new days exist in the 'days' object (fix for adding days bug)
    const currentDaysData = { ...itinerary.days };
    // Also sync notes
    const currentNotesData = { ...itinerary.notes };

    newDates.forEach(day => {
        if (!currentDaysData[day]) {
            currentDaysData[day] = [];
        }
        if (!currentNotesData[day]) {
            currentNotesData[day] = "";
        }
    });

    const updated = { 
        ...itinerary, 
        dates: newDates,
        days: currentDaysData,
        notes: currentNotesData
    };
    updateItinerary(updated);
    if(newCurrentDay !== currentDay) setCurrentDay(newCurrentDay);
  };

  const handleStartDateChange = (newDate) => {
      const updated = { ...itinerary, startDate: newDate };
      updateItinerary(updated);
  };

  const saveItem = () => {
    if (!currentItem.title) return;
    
    // Fix: Ensure the day array exists before spreading
    const currentDayItems = itinerary.days[currentDay] || [];
    const dayList = [...currentDayItems];
    
    let newList;
    if (modalMode === 'add') {
      const newItem = { ...currentItem, id: Date.now().toString() + Math.random().toString().slice(2, 5) };
      newList = [...dayList, newItem].sort((a, b) => a.time.localeCompare(b.time));
    } else {
      newList = dayList.map(item => item.id === currentItem.id ? currentItem : item);
      newList.sort((a, b) => a.time.localeCompare(b.time));
    }
    
    const updated = { 
        ...itinerary, 
        days: { ...itinerary.days, [currentDay]: newList } 
    };
    updateItinerary(updated);

    setShowItemModal(false);
    addToast(modalMode === 'add' ? `已加入 ${currentDay}！` : '修改已儲存');
  };

  const handleDeleteItem = (day, index) => {
    if (window.confirm('確定要刪除此行程項目嗎？')) {
        const currentItems = itinerary.days[day] || [];
        const newItems = currentItems.filter((_, i) => i !== index);
        updateItinerary({ ...itinerary, days: { ...itinerary.days, [day]: newItems } });
        addToast('行程已刪除', 'info');
    }
  };

  // Add item from recommendation
  const handleAddItemFromRec = (rec) => {
      setCurrentItem({ 
          id: Date.now().toString() + Math.random().toString().slice(2, 5), 
          time: '14:00', 
          title: rec.title, 
          location: rec.title,
          category: rec.category, 
          cost: '', 
          notes: rec.description 
      }); 
      setModalMode('add'); 
      setShowItemModal(true);
  };

  const dragStart = (e, position) => { 
    dragItem.current = position; 
    if (navigator.vibrate) navigator.vibrate(50);
  };
  const dragEnter = (e, position) => {
    dragOverItem.current = position;
    const listCopy = [...itinerary.days[currentDay]];
    const dragItemContent = listCopy[dragItem.current];
    listCopy.splice(dragItem.current, 1);
    listCopy.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = position;
    const updated = { ...itinerary, days: { ...itinerary.days, [currentDay]: listCopy } };
    updateItinerary(updated);
  };
  const drop = () => { dragItem.current = null; dragOverItem.current = null; };

  const handleCopyItinerary = () => {
    const { dateStr, weekDay } = getDayInfo(currentDay);
    const text = itinerary.days[currentDay].map(i => `⏰ ${formatTimeDisplay(i.time)} ${i.title} @${i.location || '無地點'}`).join('\n');
    const header = `📅 ${itinerary.destination} - ${currentDay} (${dateStr} ${weekDay})\n`;
    const textToCopy = header + (text || "今日無行程") + `\n\n預算: $${calculateDailyCost(currentDay)}`;
    
    // Native share API
    if (navigator.share) {
        navigator.share({
            title: itinerary.destination,
            text: textToCopy,
        }).catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback clipboard
        copyToClipboard(textToCopy, () => addToast('行程文字已複製！'), () => addToast('複製失敗', 'info'));
    }
  };
  
  const handleOpenPreview = () => setShowPreviewModal(true);
  const handleSaveImage = () => { setShowPreviewModal(false); addToast('圖片已儲存至相簿！(模擬)'); }
  
  // Backup & Restore Handlers (Added for Tools Modal)
  const handleExport = (data = null, filename = '行程備份') => {
    try {
        // If data is passed, use it, otherwise fallback to current itinerary (legacy behavior)
        const exportData = data || itinerary;
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowToolsModal(false);
        addToast('行程資料已匯出成功！');
    } catch (error) {
        console.error('Export Error:', error);
        addToast('匯出失敗', 'info');
    }
  };

  const handleImport = (importedData) => {
    try {
        // Handle BOTH single trip object and array of trips (from previous version backup)
        // Scenario 1: Imported data is an array of trips (Full Backup from another device/version)
        if (Array.isArray(importedData)) {
             if (window.confirm(`匯入的檔案包含 ${importedData.length} 個行程。這將會覆蓋您目前所有的行程資料。確定要繼續嗎？`)) {
                setAllTrips(importedData);
                // Also update local state if we are currently viewing a trip that got replaced/updated?
                // For simplicity, kick back to dashboard
                setActiveTripId(null);
                setShowToolsModal(false);
                addToast('所有行程資料已還原成功！');
            }
            return;
        }

        // Scenario 2: Imported data is a single trip object (Share from another user)
        if (importedData && importedData.destination && importedData.days) {
            // Check if this is a restore of a specific trip or adding a new one
            // Here we treat single import as ADDING a new trip to avoid overwriting existing unless user wants to (complex UI)
            // Just add as new trip
            const newTripId = `imported_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const newTrip = { ...importedData, id: newTripId };
            
            // Add as a NEW trip, don't overwrite current
            setAllTrips(prev => [newTrip, ...prev]);
            
            // Switch to the newly imported trip immediately
            setActiveTripId(newTripId);
            setItinerary(newTrip); // Optimistic update
            setCurrentDay(Object.keys(newTrip.days)[0] || 'Day 1');
            
            setShowToolsModal(false);
            addToast('新行程已成功匯入！');
        } else {
            alert('匯入的檔案格式不正確或內容不完整。');
        }
    } catch (error) {
        console.error(error);
        alert('無法解析資料。');
    }
  };


  // --- Render Helpers ---

  const renderItineraryItems = () => {
      const items = itinerary.days[currentDay] || [];
      if (items.length === 0) {
        return (
            <div key="empty-itinerary" className="text-center py-12 bg-gray-50 border-4 border-dashed border-gray-200 rounded-[2rem] mx-2">
              <div className="text-5xl mb-4 animate-pulse">🗺️</div>
              <p className="text-gray-400 font-bold mb-6 text-lg">這裡空空的，快去冒險吧！</p>
              <button onClick={() => { setModalMode('add'); setCurrentItem({ id: '', time: '10:00', title: '', location: '', category: 'fun', cost: '', notes: '' }); setShowItemModal(true); }} className="bg-yellow-400 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-yellow-200 hover:bg-yellow-500 transform transition-transform hover:scale-105 active:scale-95">+ 新增行程</button>
            </div>
        );
      }
      return (
        <React.Fragment key="itinerary-list">
            {items.map((item, index) => {
                const isPassed = isTimePassed(currentDay, item.time);
                const categoryConfig = CATEGORIES[item.category] || CATEGORIES.fun;
                return (
                  <div 
                    key={item.id} 
                    draggable
                    onDragStart={(e) => dragStart(e, index)}
                    onDragEnter={(e) => dragEnter(e, index)}
                    onDragEnd={drop}
                    // 1. Click card body -> EDIT
                    onClick={() => { setModalMode('edit'); setCurrentItem(item); setShowItemModal(true); }}
                    className={`group relative flex items-center bg-white p-4 rounded-3xl border-2 border-transparent hover:border-yellow-300 shadow-sm transition-all duration-200 cursor-pointer active:scale-95 select-none ${isPassed ? 'opacity-60 bg-gray-50 scale-[0.98]' : 'hover:-translate-y-1'}`}
                  >
                    <div 
                        className="absolute left-2 text-gray-200 mr-2 cursor-grab active:cursor-grabbing p-2"
                        // Prevent click on grip from triggering edit
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical size={18} />
                    </div>
                    <div className="ml-5 mr-4 flex flex-col items-center min-w-[3.5rem]">
                      <span className={`text-lg font-black font-mono ${isPassed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{formatTimeDisplay(item.time)}</span>
                    </div>
                    <div className="flex-1 pr-2 border-l-2 border-gray-100 pl-4 py-1">
                       <div className="flex items-center justify-between mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${categoryConfig.color} bg-opacity-20`}>{categoryConfig.label}</span>
                          {item.cost && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center border border-green-100"><DollarSign size={10}/>{item.cost}</span>}
                       </div>
                       <h3 className={`font-bold text-gray-800 text-lg leading-tight line-clamp-1 ${isPassed ? 'line-through text-gray-400' : ''}`}>{item.title}</h3>
                       {item.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-1">📝 {item.notes}</p>}
                    </div>

                    {/* 2. Map Icon -> NAVIGATE TO MAP */}
                    {item.location && (
                      <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            // Internal Navigation Logic
                            setFocusedMapItem(item);
                            setActiveTab('map');
                        }} 
                        className="p-3 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-100 transition-colors flex-shrink-0"
                      >
                        <MapPin size={18} />
                      </button>
                    )}
                    
                    {/* 3. Delete Button */}
                    <div className="flex flex-col ml-2 space-y-1">
                         <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteItem(currentDay, index); }}
                             className="p-2 text-gray-400 hover:text-red-500"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                );
            })}
        </React.Fragment>
      );
  };

  // --- Main Render ---

  return (
    <div className="w-full h-screen bg-white max-w-md mx-auto relative overflow-hidden flex flex-col font-sans select-none">
      <ToastContainer toasts={toasts} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onUpdateDestination={handleUpdateDestination} 
        destinationValue={itinerary.destination} 
        startDate={itinerary.startDate} 
        setStartDate={handleStartDateChange} 
        duration={itinerary.dates.length}
        setDuration={handleDurationChange}
        onInstallApp={handleInstallApp}
        isPwaReady={!!deferredPrompt}
      />

      {permissionModal && <PermissionModal type={permissionModal.type} onConfirm={handlePermissionConfirm} onCancel={handlePermissionCancel} />}

      {/* Conditionally Render View based on activeTripId */}
      {!activeTripId ? (
        <React.Fragment key="dashboard-mode-view">
            <DashboardView 
                allTrips={allTrips}
                onSetActiveTripId={setActiveTripId}
                onCreateTrip={handleCreateTrip}
                onDeleteTrip={handleDeleteTrip}
                onUpdateTripTitle={handleUpdateTripTitle}
                onOpenTools={() => {
                    // Open the SAME tools modal but maybe with different options in future?
                    // For now, let's allow accessing the same ToolsModal to import trips.
                    setShowToolsModal(true);
                }}
            />
        </React.Fragment>
      ) : (
        <React.Fragment key="active-trip-view">
          <div className="flex-1 overflow-y-auto scrollbar-hide bg-white">
            {(() => {
                switch (activeTab) {
                    case 'itinerary':
                        // Inlined Itinerary View content
                        const { dateStr, weekDay, weatherType } = getDayInfo(currentDay);
                        const dailyCost = calculateDailyCost(currentDay);
                        return (
                            <div className="pb-28">
                                <div className="bg-yellow-400 p-6 rounded-b-[40px] shadow-lg mb-6 relative z-10">
                                   <div className="flex justify-between items-start mb-4">
                                    <div className="flex space-x-2">
                                       <button onClick={handleBackToDashboard} className="bg-white/30 p-2 rounded-full text-yellow-900 hover:bg-white/50 transition-colors"><ArrowLeft size={24} /></button>
                                       <button onClick={() => setIsSidebarOpen(true)} className="bg-white/30 p-2 rounded-full text-yellow-900 hover:bg-white/50 transition-colors"><Menu size={24} /></button>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button onClick={handleOpenPreview} className="bg-white/30 p-2 rounded-full text-yellow-900 hover:bg-white/50 transition-colors"><ImageIcon size={20} /></button>
                                      {/* Reverted to Share2 icon for native share/copy */}
                                      <button onClick={handleCopyItinerary} className="bg-white/30 p-2 rounded-full text-yellow-900 hover:bg-white/50 transition-colors"><Share2 size={20} /></button>
                                    </div>
                                  </div>
                                  <div className="mb-4 pl-1">
                                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">{itinerary.destination}</h1>
                                    <div className="flex items-center text-yellow-900 font-bold mt-1 opacity-80 space-x-2 text-sm">
                                      <Calendar size={14} />
                                      <span>{itinerary.startDate} 出發 • 共 {itinerary.dates.length} 天</span>
                                    </div>
                                  </div>
                                  <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                                    {itinerary.dates.map(day => (
                                      <button key={day} onClick={() => setCurrentDay(day)} className={`flex-shrink-0 px-5 py-2 rounded-2xl text-sm font-bold transition-all transform hover:scale-105 border-2 ${currentDay === day ? 'bg-white text-yellow-600 border-white shadow-md' : 'bg-yellow-500/50 text-white border-transparent hover:bg-yellow-500'}`}>{day}</button>
                                    ))}
                                  </div>
                                </div>

                                <div className="px-6 mb-4 flex justify-between items-end">
                                  <div>
                                    <h2 className="text-2xl font-black text-gray-700 flex items-center">
                                      {currentDay}
                                      <span className="ml-3 text-xs font-bold text-gray-500 flex items-center bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                                        {dateStr} {weekDay} 
                                        <span className="ml-2">
                                          {weatherType === 'sunny' && <Sun size={18} className="text-orange-400" />}
                                          {weatherType === 'cloudy' && <Cloud size={18} className="text-gray-400" />}
                                          {weatherType === 'rain' && <CloudRain size={18} className="text-blue-400" />}
                                        </span>
                                      </span>
                                    </h2>
                                  </div>
                                  <div className="text-right">
                                     <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">今日預算</div>
                                     <div className="text-lg font-black text-green-600 flex items-center justify-end"><DollarSign size={16} strokeWidth={3} /> {dailyCost.toLocaleString()}</div>
                                  </div>
                                </div>
                                
                                <div className="px-6 mb-4">
                                   <button onClick={() => setShowNoteModal(true)} className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 text-yellow-700 rounded-2xl font-bold hover:bg-yellow-100 transition-colors border-2 border-yellow-100 group">
                                    <span className="flex items-center"><StickyNote size={18} className="mr-2 group-hover:rotate-12 transition-transform"/> 心情隨筆</span>
                                    <span className="text-xs opacity-60 truncate max-w-[150px]">{itinerary.notes[currentDay] || "寫點什麼..."}</span>
                                  </button>
                                </div>

                                <div className="px-5 space-y-4 relative">
                                  {showDragHint && (
                                    <div key="drag-hint" className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                      <div className="bg-black/70 text-white px-6 py-4 rounded-2xl animate-bounce backdrop-blur-sm shadow-xl flex items-center"><GripVertical className="mr-2" /> 長按卡片可以拖曳排序喔！</div>
                                    </div>
                                  )}
                                  {renderItineraryItems()}
                                </div>
                            </div>
                        );
                    case 'recommend':
                        return <RecommendationView itinerary={itinerary} onBack={() => setActiveTab('itinerary')} onAddItem={handleAddItemFromRec} />;
                    case 'translate':
                        return <TranslateView onBack={() => setActiveTab('itinerary')} onRequestPermission={requestPermission} addToast={addToast} />;
                    case 'map':
                        return (
                          <MapView 
                            itinerary={itinerary} 
                            currentDay={currentDay} 
                            onBack={() => setActiveTab('itinerary')} 
                            onRequestPermission={requestPermission} 
                            addToast={addToast}
                            focusedItem={focusedMapItem}
                            onClearFocus={() => setFocusedMapItem(null)}
                          />
                        );
                    default:
                        return null;
                }
            })()}
          </div>

          <div className={`absolute bottom-6 left-6 right-6 h-16 bg-white rounded-[2.5rem] shadow-2xl flex justify-between items-center px-6 z-30 border border-gray-50 transition-all duration-300 ${activeTab === 'map' ? 'translate-y-[200%]' : 'translate-y-0'}`}>
            <button onClick={() => setActiveTab('itinerary')} className={`transition-all ${activeTab === 'itinerary' ? 'text-yellow-500 scale-110' : 'text-gray-300'}`}><Calendar size={24} strokeWidth={3} /></button>
            <button onClick={() => setActiveTab('recommend')} className={`transition-all ${activeTab === 'recommend' ? 'text-green-500 scale-110' : 'text-gray-300'}`}><Search size={24} strokeWidth={3} /></button>
            <div className="relative -top-6">
              <button onClick={() => { setModalMode('add'); setCurrentItem({ id: '', time: '10:00', title: '', location: '', category: 'fun', cost: '', notes: '' }); setShowItemModal(true); }} className="w-16 h-16 bg-yellow-400 rounded-full shadow-[0_8px_20px_rgba(250,204,21,0.4)] flex items-center justify-center text-white border-4 border-white hover:bg-yellow-500 hover:scale-105 transition-all"><Plus size={32} strokeWidth={4} /></button>
            </div>
            <button onClick={() => setActiveTab('translate')} className={`transition-all ${activeTab === 'translate' ? 'text-blue-500 scale-110' : 'text-gray-300'}`}><Languages size={24} strokeWidth={3} /></button>
            <button onClick={() => setActiveTab('map')} className={`transition-all ${activeTab === 'map' ? 'text-purple-500 scale-110' : 'text-gray-300'}`}><Navigation size={24} strokeWidth={3} /></button>
          </div>
        </React.Fragment>
      )}

      {showItemModal && (
        <div key="item-modal" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative">
            <button onClick={() => setShowItemModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200"><X size={20} /></button>
            <h3 className="text-xl font-black text-center mb-6 text-gray-800">{modalMode === 'add' ? '✨ 新增行程' : '✏️ 修改行程'}</h3>
            <div className="space-y-4">
              <div className="flex justify-between bg-gray-50 p-2 rounded-2xl">
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <button key={key} onClick={() => setCurrentItem({...currentItem, category: key})} className={`p-2.5 rounded-xl transition-all ${currentItem.category === key ? `${cat.color} shadow-sm transform scale-110` : 'text-gray-300 hover:bg-gray-200'}`}><cat.icon size={20} /></button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                 <div className="col-span-1"><label className="text-xs font-bold text-gray-400 ml-2 block mb-1">時間</label><input type="time" value={currentItem.time} onChange={(e) => setCurrentItem({...currentItem, time: e.target.value})} className="w-full bg-gray-100 rounded-2xl p-3 font-bold text-gray-700 outline-none text-center"/></div>
                 <div className="col-span-2"><label className="text-xs font-bold text-gray-400 ml-2 block mb-1">做什麼呢？</label><input type="text" placeholder="行程標題" value={currentItem.title} onChange={(e) => setCurrentItem({...currentItem, title: e.target.value})} className="w-full bg-gray-100 rounded-2xl p-3 font-bold text-gray-700 outline-none"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div className="col-span-1"><label className="text-xs font-bold text-gray-400 ml-2 block mb-1">地點 (導航)</label><input type="text" placeholder="Google Map 地點" value={currentItem.location} onChange={(e) => setCurrentItem({...currentItem, location: e.target.value})} className="w-full bg-gray-100 rounded-2xl p-3 font-medium text-gray-700 outline-none"/></div>
                 <div className="col-span-1"><label className="text-xs font-bold text-gray-400 ml-2 block mb-1">預算 ($)</label><input type="number" placeholder="0" value={currentItem.cost} onChange={(e) => setCurrentItem({...currentItem, cost: e.target.value})} className="w-full bg-gray-100 rounded-2xl p-3 font-bold text-green-700 outline-none"/></div>
              </div>
              <div><label className="text-xs font-bold text-gray-400 ml-2 block mb-1">備註</label><textarea rows={2} placeholder="票券資訊..." value={currentItem.notes} onChange={(e) => setCurrentItem({...currentItem, notes: e.target.value})} className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-3 font-medium text-gray-600 outline-none resize-none"/></div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowItemModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-bold">取消</button>
              <button onClick={saveItem} className="flex-1 py-4 bg-yellow-400 text-white rounded-2xl font-black text-lg shadow-lg hover:bg-yellow-500 flex items-center justify-center"><Check size={20} className="mr-2" />{modalMode === 'add' ? '加入清單' : '完成修改'}</button>
            </div>
          </div>
        </div>
      )}
      {/* FIX: Added key="note-modal" */}
      {showNoteModal && (
        <div key="note-modal" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-yellow-50 w-full rounded-3xl p-6 shadow-xl border-4 border-yellow-200 relative rotate-1">
            <button onClick={() => setShowNoteModal(false)} className="absolute top-2 right-2 p-2 text-yellow-600"><X size={24}/></button>
            <h3 className="text-xl font-bold text-yellow-800 mb-4 text-center">📒 {currentDay} 的心情</h3>
            <textarea className="w-full h-48 bg-transparent text-yellow-900 text-lg leading-relaxed outline-none resize-none placeholder-yellow-800/30" placeholder="寫點什麼..." value={itinerary.notes[currentDay]} onChange={(e) => setItinerary(prev => ({ ...prev, notes: { ...prev.notes, [currentDay]: e.target.value } }))}/>
          </div>
        </div>
      )}
      {/* Preview Modal */}
      {showPreviewModal && (
          <PreviewCardModal 
              itinerary={itinerary} 
              day={currentDay} 
              onClose={() => setShowPreviewModal(false)} 
              onDownload={handleSaveImage} 
          />
      )}
      {/* Tools Modal */}
      {showToolsModal && (
        <ToolsModal
            onClose={() => setShowToolsModal(false)}
            onExport={handleExport}
            onImport={handleImport}
            onInstall={handleInstallApp}
            allTrips={allTrips} // Pass allTrips for sharing
            activeTripId={activeTripId} // Pass activeTripId to set default selection
        />
      )}
    </div>
  );
}