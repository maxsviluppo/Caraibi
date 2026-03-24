/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  limit,
  limitToLast,
  where
} from 'firebase/firestore';
import { 
  MapPin, 
  Calendar, 
  Users, 
  MessageSquare, 
  LogOut, 
  Search,
  Plus,
  ChevronRight,
  User as UserIcon,
  Music,
  Info,
  Bell,
  Camera,
  X,
  School,
  Home
} from 'lucide-react';
import { 
  APIProvider, 
  Map, 
  Marker, 
  InfoWindow
} from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { handleFirestoreError, OperationType, testConnection } from './firestore-utils';

// --- Types ---
interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio?: string;
  styles?: string[];
  level?: string;
  role?: string;
  location?: { lat: number; lng: number };
}

interface DanceEvent {
  id: string;
  title: string;
  description: string;
  date: any;
  location: { lat: number; lng: number };
  address: string;
  type: string;
  style?: string;
  organizerId: string;
  price?: number;
  photoURL?: string;
}

interface DanceSchool {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  description?: string;
  photoURL?: string;
  styles?: string[];
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  timestamp: any;
  chatId: string;
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastTimestamp?: any;
  updatedAt: any;
  otherUser?: UserProfile;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: any;
  read: boolean;
  type: 'message' | 'event' | 'system';
}

// --- Utils ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const showNotification = (title: string, body: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
};

// --- Components ---

const ProfileModal = ({ 
  user, 
  profile, 
  onClose, 
  onUpdate 
}: { 
  user: User, 
  profile: UserProfile | null, 
  onClose: () => void,
  onUpdate: (data: Partial<UserProfile>) => Promise<void>
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    bio: profile?.bio || '',
    styles: profile?.styles || [],
    level: profile?.level || 'Beginner',
    role: profile?.role || 'Both',
    location: profile?.location || { lat: 45.4642, lng: 9.1900 }
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate(formData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStyle = (style: string) => {
    const currentStyles = formData.styles || [];
    if (currentStyles.includes(style)) {
      setFormData({ ...formData, styles: currentStyles.filter(s => s !== style) });
    } else {
      setFormData({ ...formData, styles: [...currentStyles, style] });
    }
  };

  const useGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setFormData({ 
        ...formData, 
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude } 
      });
    });
  };

  const danceStyles = ['Salsa Cubana', 'Salsa Linea', 'Bachata Sensual', 'Bachata Fusion', 'Kizomba', 'Zouk'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/20 border-8 border-white"
      >
        <div className="p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-3xl font-display font-black text-slate-900 tracking-tight">Il Tuo Profilo</h3>
              <p className="text-slate-500 font-medium">Personalizza la tua esperienza su Caraibi</p>
            </div>
            <button onClick={onClose} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all group">
              <Plus className="w-6 h-6 rotate-45 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="flex items-center gap-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <div className="relative">
                <img src={user.photoURL || ''} alt="" className="w-24 h-24 rounded-[2rem] border-4 border-white shadow-xl object-cover" referrerPolicy="no-referrer" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
              </div>
              <div>
                <h4 className="font-display font-black text-2xl text-slate-900">{user.displayName}</h4>
                <p className="text-slate-400 font-medium text-sm">{user.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full text-[10px] font-black uppercase tracking-wider text-slate-500 border border-slate-100">
                  <UserIcon className="w-3 h-3 text-brand" />
                  ID: {user.uid.slice(0, 8)}...
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Bio</label>
              <textarea 
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-6 py-5 bg-slate-50 rounded-[2rem] border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all min-h-[140px] resize-none font-medium placeholder:text-slate-300"
                placeholder="Raccontaci qualcosa di te e della tua passione per il ballo..."
              />
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Stili di Ballo</label>
              <div className="flex flex-wrap gap-3">
                {danceStyles.map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                      formData.styles?.includes(style)
                        ? 'bg-brand text-white shadow-xl shadow-brand/20 scale-105'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Livello</label>
                <select 
                  value={formData.level}
                  onChange={e => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-6 py-5 bg-slate-50 rounded-[2rem] border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-black uppercase tracking-widest text-xs appearance-none cursor-pointer"
                >
                  <option value="Beginner">Principiante</option>
                  <option value="Intermediate">Intermedio</option>
                  <option value="Advanced">Avanzato</option>
                  <option value="Pro">Professionista</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Ruolo</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-6 py-5 bg-slate-50 rounded-[2rem] border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-black uppercase tracking-widest text-xs appearance-none cursor-pointer"
                >
                  <option value="Leader">Leader</option>
                  <option value="Follower">Follower</option>
                  <option value="Both">Entrambi</option>
                </select>
              </div>
            </div>

            <div className="p-8 bg-brand/5 rounded-[2.5rem] border-2 border-brand/10">
              <div className="flex items-center gap-3 mb-6">
                <MapPin className="w-5 h-5 text-brand" />
                <label className="block text-xs font-black text-brand uppercase tracking-widest">Posizione Sulla Mappa</label>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-black text-brand/40 block ml-1 tracking-tighter">Latitudine</span>
                  <input 
                    type="number" step="any"
                    value={formData.location?.lat}
                    onChange={e => setFormData({ ...formData, location: { ...formData.location!, lat: parseFloat(e.target.value) } })}
                    className="w-full px-5 py-3 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand text-sm font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-black text-brand/40 block ml-1 tracking-tighter">Longitudine</span>
                  <input 
                    type="number" step="any"
                    value={formData.location?.lng}
                    onChange={e => setFormData({ ...formData, location: { ...formData.location!, lng: parseFloat(e.target.value) } })}
                    className="w-full px-5 py-3 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand text-sm font-bold text-slate-700"
                  />
                </div>
              </div>
              <button 
                type="button"
                onClick={useGPS}
                className="w-full py-4 bg-white text-brand rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand hover:text-white transition-all flex items-center justify-center gap-2 border-2 border-brand/20 shadow-lg shadow-brand/5 active:scale-95"
              >
                <MapPin className="w-4 h-4" /> Aggiorna con GPS
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button 
                type="submit" 
                disabled={isSaving}
                className="flex-1 py-5 bg-brand text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 disabled:opacity-50 active:scale-95"
              >
                {isSaving ? 'Salvataggio...' : 'Salva Profilo'}
              </button>
              <button 
                type="button" 
                onClick={onClose}
                className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

const PrivateChat = ({ 
  user, 
  onClose, 
  chats, 
  activeChatId, 
  setActiveChatId, 
  messages, 
  onSendMessage 
}: { 
  user: User, 
  onClose: () => void, 
  chats: Chat[], 
  activeChatId: string | null, 
  setActiveChatId: (id: string | null) => void,
  messages: ChatMessage[],
  onSendMessage: (chatId: string, text: string) => Promise<void>
}) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    if (activeChatId) {
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, activeChatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;
    await onSendMessage(activeChatId, newMessage);
    setNewMessage('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[60] flex flex-col border-l border-slate-100"
    >
      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          {activeChatId && (
            <button onClick={() => setActiveChatId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all mr-2">
              <ChevronRight className="w-5 h-5 rotate-180 text-slate-400" />
            </button>
          )}
          <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-brand" />
          </div>
          <div>
            <h3 className="font-display font-black text-xl text-slate-900 leading-none">
              {activeChatId ? activeChat?.otherUser?.displayName : 'Messaggi'}
            </h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
              {activeChatId ? 'Chat Privata' : 'Le tue conversazioni'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
          <Plus className="w-6 h-6 rotate-45 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </button>
      </div>

      {!activeChatId ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {chats.length > 0 ? (
            chats.map(chat => (
              <button 
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className="w-full p-6 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-[2rem] border-2 border-transparent hover:border-brand/10 transition-all flex items-center gap-6 text-left group"
              >
                <div className="relative">
                  <img src={chat.otherUser?.photoURL || ''} alt="" className="w-16 h-16 rounded-[1.5rem] object-cover border-4 border-white shadow-lg" referrerPolicy="no-referrer" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-display font-black text-slate-900 truncate">{chat.otherUser?.displayName}</h4>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                      {chat.updatedAt?.seconds ? new Date(chat.updatedAt.seconds * 1000).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium truncate group-hover:text-brand transition-colors">{chat.lastMessage}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-slate-200" />
              </div>
              <h4 className="text-xl font-display font-black text-slate-300 mb-2">Nessun messaggio</h4>
              <p className="text-slate-400 font-medium">Inizia a ballare e connettiti con altri partner!</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.senderId === user.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img src={msg.senderPhoto} alt="" className="w-10 h-10 rounded-2xl border-2 border-white shadow-md object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                  <div className={`p-4 rounded-3xl text-sm font-medium ${
                    msg.senderId === user.uid 
                      ? 'bg-brand text-white rounded-tr-none shadow-lg shadow-brand/20' 
                      : 'bg-slate-100 text-slate-700 rounded-tl-none'
                  }`}>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-300 mt-2 px-12 uppercase tracking-tighter">
                  {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSend} className="p-8 border-t border-slate-100 bg-white">
            <div className="flex gap-3">
              <input 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="flex-1 px-6 py-4 bg-slate-50 rounded-[2rem] border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all text-sm font-medium placeholder:text-slate-300"
              />
              <button type="submit" className="w-14 h-14 bg-brand text-white rounded-[2rem] flex items-center justify-center hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 active:scale-90">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </form>
        </>
      )}
    </motion.div>
  );
};

const ChatRoom = ({ user, onClose, messages }: { user: User, onClose: () => void, messages: ChatMessage[] }) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'chats', 'global', 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'Anonimo',
        senderPhoto: user.photoURL || '',
        text: newMessage,
        timestamp: serverTimestamp(),
        roomId: 'global'
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats/global/messages');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[60] flex flex-col border-l border-slate-100"
    >
      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-brand" />
          </div>
          <div>
            <h3 className="font-display font-black text-xl text-slate-900 leading-none">Community Chat</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Caraibi Live</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
          <Plus className="w-6 h-6 rotate-45 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.senderId === user.uid ? 'flex-row-reverse' : 'flex-row'}`}>
              <img src={msg.senderPhoto} alt="" className="w-10 h-10 rounded-2xl border-2 border-white shadow-md object-cover flex-shrink-0" referrerPolicy="no-referrer" />
              <div className={`p-4 rounded-3xl text-sm font-medium ${
                msg.senderId === user.uid 
                  ? 'bg-brand text-white rounded-tr-none shadow-lg shadow-brand/20' 
                  : 'bg-slate-100 text-slate-700 rounded-tl-none'
              }`}>
                {msg.senderId !== user.uid && (
                  <p className="font-black text-[10px] mb-1 uppercase tracking-widest opacity-50">{msg.senderName}</p>
                )}
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-slate-300 mt-2 px-12 uppercase tracking-tighter">
              {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
            </span>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-8 border-t border-slate-100 bg-white">
        <div className="flex gap-3">
          <input 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-6 py-4 bg-slate-50 rounded-[2rem] border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all text-sm font-medium placeholder:text-slate-300"
          />
          <button type="submit" className="w-14 h-14 bg-brand text-white rounded-[2rem] flex items-center justify-center hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 active:scale-90">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const CalendarView = ({ events }: { events: DanceEvent[] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const getEventsForDay = (day: number | null) => {
    if (day === null) return [];
    return events.filter(event => {
      const eventDate = event.date.toDate();
      return eventDate.getDate() === day && 
             eventDate.getMonth() === currentDate.getMonth() &&
             eventDate.getFullYear() === currentDate.getFullYear();
    });
  };

  const selectedDayEvents = getEventsForDay(selectedDay);

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border-8 border-white overflow-hidden">
        <div className="p-10 bg-brand text-white flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-display font-black tracking-tight">{monthNames[currentDate.getMonth()]}</h3>
            <p className="text-white/70 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">{currentDate.getFullYear()}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={prevMonth} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <button onClick={nextMonth} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-10">
          <div className="grid grid-cols-7 gap-1 md:gap-4 mb-6">
            {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
              <div key={day} className="text-center text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">{day}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 md:gap-4">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
              const isSelected = selectedDay === day;
              
              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-2xl border-2 p-2 flex flex-col items-center justify-center relative group transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-brand border-brand text-white shadow-xl shadow-brand/30 scale-110 z-10' 
                      : isToday 
                        ? 'bg-brand/5 border-brand/20 text-brand' 
                        : 'bg-white border-slate-50 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-sm font-black">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {dayEvents.slice(0, 3).map(e => (
                        <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand'}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 rounded-[3rem] p-10 border-2 border-white shadow-inner"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-2xl font-display font-black text-slate-900 tracking-tight">
                Eventi del {selectedDay} {monthNames[currentDate.getMonth()]}
              </h4>
              <p className="text-slate-500 font-medium text-sm">Programma la tua serata</p>
            </div>
            <span className="px-5 py-2 bg-brand/10 text-brand rounded-full text-xs font-black uppercase tracking-widest">
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'Evento' : 'Eventi'}
            </span>
          </div>

          {selectedDayEvents.length > 0 ? (
            <div className="grid gap-6">
              {selectedDayEvents.map(event => (
                <div key={event.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-8 hover:shadow-xl transition-all group">
                  <div className="w-24 h-24 rounded-[1.5rem] overflow-hidden flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    <img src={event.photoURL || 'https://picsum.photos/seed/dance/200'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                      <span className="px-3 py-1 bg-brand/10 text-brand rounded-full text-[10px] font-black uppercase tracking-widest">{event.type}</span>
                      {event.style && (
                        <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{event.style}</span>
                      )}
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-tighter">
                        {event.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h5 className="text-xl font-display font-black text-slate-900 leading-tight">{event.title}</h5>
                    <p className="text-sm text-slate-500 font-medium flex items-center justify-center sm:justify-start gap-1.5 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-brand" /> {event.address}
                    </p>
                  </div>
                  <button className="w-full sm:w-auto px-10 py-4 bg-brand text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-brand-dark transition-all shadow-xl shadow-brand/10 active:scale-95">
                    Dettagli
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-slate-200" />
              </div>
              <h5 className="text-xl font-display font-black text-slate-300 mb-2">Nessun evento</h5>
              <p className="text-slate-400 font-medium">Non ci sono eventi in programma per questo giorno.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

const PartnerFinder = ({ user, onStartChat }: { user: User, onStartChat: (partner: UserProfile) => void }) => {
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(p => p.uid !== user.uid);
      setPartners(usersData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, [user.uid]);

  if (loading) return <div className="flex justify-center p-12"><Music className="w-8 h-8 text-orange-500 animate-spin" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {partners.map(partner => (
        <motion.div 
          key={partner.uid}
          whileHover={{ y: -8 }}
          className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-2xl transition-all group"
        >
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <img src={partner.photoURL || ''} alt="" className="w-20 h-20 rounded-full border-4 border-white shadow-lg" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
            </div>
            <div>
              <h4 className="font-bold text-xl">{partner.displayName}</h4>
              <div className="flex items-center gap-1 text-orange-500 font-bold text-xs uppercase tracking-wider">
                <Users className="w-3 h-3" /> {partner.role} • {partner.level}
              </div>
            </div>
          </div>
          
          <p className="text-gray-500 text-sm mb-6 line-clamp-2 italic">"{partner.bio || 'Appassionato di ballo pronto per la pista!'}"</p>
          
          <div className="flex flex-wrap gap-2 mb-8">
            {partner.styles?.slice(0, 3).map(style => (
              <span key={style} className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-[10px] font-bold border border-gray-100">{style}</span>
            ))}
          </div>
          
          <button 
            onClick={() => onStartChat(partner)}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-5 h-5" /> Invia Messaggio
          </button>
        </motion.div>
      ))}
    </div>
  );
};

const NotificationsView = ({ 
  notifications, 
  onMarkAsRead, 
  onClearAll 
}: { 
  notifications: AppNotification[], 
  onMarkAsRead: (id: string) => void,
  onClearAll: () => void
}) => {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h3 className="text-4xl md:text-5xl font-display font-black text-slate-900 tracking-tighter">Notifiche</h3>
          <p className="text-slate-500 font-medium mt-2">Rimani aggiornato sulla tua attività</p>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={onClearAll}
            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            Cancella Tutto
          </button>
        )}
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200"
            >
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50">
                <Bell className="w-10 h-10 text-slate-200" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Tutto tace...</h4>
              <p className="text-slate-400 font-medium">Non hai ancora ricevuto notifiche.</p>
            </motion.div>
          ) : (
            notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative p-6 md:p-8 rounded-[2rem] border transition-all cursor-pointer ${
                  notification.read 
                    ? 'bg-white border-slate-100 opacity-75' 
                    : 'bg-white border-brand/20 shadow-xl shadow-brand/5 ring-1 ring-brand/5'
                }`}
                onClick={() => onMarkAsRead(notification.id)}
              >
                <div className="flex items-start gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                    notification.type === 'message' ? 'bg-blue-50 text-blue-600' :
                    notification.type === 'event' ? 'bg-brand/10 text-brand' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {notification.type === 'message' ? <MessageSquare className="w-6 h-6" /> :
                     notification.type === 'event' ? <Calendar className="w-6 h-6" /> :
                     <Bell className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`text-lg font-bold truncate ${notification.read ? 'text-slate-600' : 'text-slate-900'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ml-4">
                        {new Date(notification.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed line-clamp-2 ${notification.read ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                      {notification.body}
                    </p>
                  </div>

                  {!notification.read && (
                    <div className="w-3 h-3 bg-brand rounded-full shadow-lg shadow-brand/50 shrink-0 mt-2 animate-pulse" />
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const MapView = ({ events, schools, userLocation }: { events: DanceEvent[], schools: DanceSchool[], userLocation?: { lat: number, lng: number } }) => {
  const [selectedItem, setSelectedItem] = useState<{ type: 'event' | 'school', data: any } | null>(null);
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const defaultCenter = userLocation || { lat: 45.4642, lng: 9.1900 }; // Milano

  if (!apiKey) {
    return (
      <div className="h-[400px] w-full rounded-3xl bg-gray-100 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-200">
        <MapPin className="w-12 h-12 text-gray-300 mb-4" />
        <h4 className="text-lg font-bold text-gray-600">Mappa non configurata</h4>
        <p className="text-sm text-gray-400 mt-2 max-w-xs">
          Inserisci la tua <strong>GOOGLE_MAPS_API_KEY</strong> nelle impostazioni di AI Studio per attivare la mappa.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full rounded-3xl overflow-hidden border border-gray-100 shadow-inner relative">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          className="w-full h-full"
          gestureHandling={'greedy'}
          disableDefaultUI={false}
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker 
              position={userLocation}
              label="Tu"
            />
          )}

          {/* Event Markers */}
          {events.map(event => (
            <Marker 
              key={event.id} 
              position={event.location}
              onClick={() => setSelectedItem({ type: 'event', data: event })}
              title={event.title}
            />
          ))}

          {/* School Markers */}
          {schools.map(school => (
            <Marker 
              key={school.id} 
              position={school.location}
              onClick={() => setSelectedItem({ type: 'school', data: school })}
              title={school.name}
            />
          ))}

          {selectedItem && (
            <InfoWindow
              position={selectedItem.data.location}
              onCloseClick={() => setSelectedItem(null)}
            >
              <div className="p-2 max-w-[200px]">
                <h4 className="font-bold text-gray-900">{selectedItem.data.title || selectedItem.data.name}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{selectedItem.data.address}</p>
                {selectedItem.type === 'event' && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-orange-600 uppercase">{selectedItem.data.type}</span>
                    <span className="text-[10px] font-bold text-gray-900">€{selectedItem.data.price}</span>
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

const Navbar = ({ 
  user, 
  onViewChange, 
  onSignOut, 
  onOpenProfile,
}: { 
  user: User | null, 
  onViewChange: (view: string) => void,
  onSignOut: () => void, 
  onOpenProfile: () => void,
}) => (
  <nav className="fixed top-0 left-0 right-0 glass border-b border-white/20 px-4 py-3 flex justify-between items-center z-50 md:px-8 md:py-4 shadow-lg shadow-black/5">
    <div className="flex items-center gap-3 cursor-pointer flex-shrink-0 group" onClick={() => onViewChange('home')}>
      <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-110 transition-transform duration-300">
        <Music className="text-white w-6 h-6" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display font-extrabold text-xl tracking-tight text-slate-900">Caraibi</span>
        <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Community</span>
      </div>
    </div>

    {user && (
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <div className="flex flex-col items-end flex">
          <span className="text-[10px] sm:text-xs font-bold text-slate-900 leading-tight">{user.displayName?.split(' ')[0]}</span>
          <span className="text-[8px] sm:text-[10px] text-slate-500 font-medium">Online</span>
        </div>
        <img 
          src={user.photoURL || ''} 
          alt="Profile" 
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 border-white shadow-sm object-cover cursor-pointer hover:scale-105 transition-transform" 
          referrerPolicy="no-referrer"
          onClick={onOpenProfile}
        />
        <button onClick={onSignOut} className="p-2 text-slate-400 hover:text-red-500 transition-all hidden md:block hover:bg-red-50 rounded-xl">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    )}
  </nav>
);

const FloatingNavbar = ({
  activeView,
  onViewChange,
  onOpenChat,
  onOpenCommunityChat,
  notificationsEnabled,
  onToggleNotifications,
  chatCount,
  notificationCount
}: {
  activeView: string,
  onViewChange: (view: string) => void,
  onOpenChat: () => void,
  onOpenCommunityChat: () => void,
  notificationsEnabled: boolean,
  onToggleNotifications: () => void,
  chatCount: number,
  notificationCount: number
}) => {
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md">
      <div className="glass-dark rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl shadow-black/40 border border-white/10">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'map', icon: MapPin, label: 'Mappa' },
          { id: 'calendar', icon: Calendar, label: 'Eventi' },
          { id: 'schools', icon: Music, label: 'Scuole' },
          { id: 'partners', icon: Users, label: 'Partner' }
        ].map(item => {
          const isActive = activeView === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`p-4 rounded-[1.8rem] transition-all relative group ${
                isActive 
                  ? 'bg-brand text-white shadow-xl shadow-brand/20' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon 
                className="w-6 h-6 transition-all duration-300" 
                fill="none"
                strokeWidth={2}
              />
              {isActive && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                />
              )}
            </button>
          );
        })}
        <div className="w-px h-8 bg-white/10 mx-1"></div>
        
        <div className="relative">
          <AnimatePresence>
            {isChatMenuOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col gap-3 items-center">
                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  onClick={() => {
                    onViewChange('notifications');
                    setIsChatMenuOpen(false);
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl border border-white/10 relative ${
                    activeView === 'notifications' ? 'bg-brand text-white' : 'glass-dark text-white/60'
                  }`}
                  title="Notifiche"
                >
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"></span>
                  )}
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: 0.05 }}
                  onClick={() => {
                    onOpenCommunityChat();
                    setIsChatMenuOpen(false);
                  }}
                  className="w-12 h-12 rounded-full glass-dark text-white flex items-center justify-center shadow-xl border border-white/10 hover:bg-brand transition-colors"
                  title="Chat Community"
                >
                  <Users className="w-5 h-5" />
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: 0.1 }}
                  onClick={() => {
                    onOpenChat();
                    setIsChatMenuOpen(false);
                  }}
                  className="w-12 h-12 rounded-full glass-dark text-white flex items-center justify-center shadow-xl border border-white/10 hover:bg-brand transition-colors relative"
                  title="Chat Singola"
                >
                  <MessageSquare className="w-5 h-5" />
                  {chatCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"></span>
                  )}
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setIsChatMenuOpen(!isChatMenuOpen)} 
            className={`p-4 rounded-[1.8rem] transition-all group relative ${
              isChatMenuOpen ? 'bg-brand text-white shadow-xl shadow-brand/20' : 'bg-white/10 text-white hover:bg-brand hover:text-white'
            }`}
          >
            <MessageSquare className="w-6 h-6 transition-transform" />
            {(chatCount > 0 || notificationCount > 0) && !isChatMenuOpen && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const Hero = ({ onSignIn }: { onSignIn: () => void }) => (
  <section className="relative h-[85vh] flex items-center justify-center overflow-hidden bg-slate-950">
    <div className="absolute inset-0">
      <img 
        src="https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?q=80&w=2070&auto=format&fit=crop" 
        className="w-full h-full object-cover opacity-40 scale-105"
        alt="Salsa dancing"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/40 to-slate-950"></div>
    </div>
    
    <div className="relative z-10 text-center px-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-dark text-white/80 text-xs font-bold tracking-widest uppercase"
      >
        <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
        La più grande community di ballo in Italia
      </motion.div>
      
      <motion.h1 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-6xl md:text-8xl lg:text-9xl font-display font-black text-white mb-8 tracking-tighter leading-[0.9] text-balance"
      >
        BALLA, <span className="text-brand">CONNETTITI</span>, VIVI.
      </motion.h1>
      
      <motion.p 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl md:text-2xl text-slate-300 mb-12 font-light max-w-2xl mx-auto leading-relaxed text-balance"
      >
        Trova scuole, eventi e partner di ballo vicino a te. La tua passione per Salsa, Bachata e Kizomba inizia qui.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <button
          onClick={onSignIn}
          className="group relative px-10 py-5 bg-brand text-white rounded-2xl font-bold text-lg hover:bg-brand-dark transition-all shadow-2xl shadow-brand/30 flex items-center gap-3 overflow-hidden"
        >
          <span className="relative z-10">Inizia a Ballare Ora</span>
          <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </button>
        
        <button className="px-10 py-5 glass-dark text-white rounded-2xl font-bold text-lg hover:bg-white/10 transition-all">
          Scopri di più
        </button>
      </motion.div>
    </div>
    
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Scroll</span>
      <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent"></div>
    </div>
  </section>
);

const EventCard = ({ event, onBook }: { event: DanceEvent, onBook?: (event: DanceEvent) => void }) => (
  <motion.div 
    whileHover={{ y: -8 }}
    className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(249,115,22,0.12)] transition-all group w-full"
  >
    <div className="aspect-video md:h-80 bg-slate-100 relative overflow-hidden">
      <img 
        src={event.photoURL || `https://picsum.photos/seed/${event.id}/800/600`} 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
        alt={event.title}
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
      
      <div className="absolute top-2 right-2 md:top-6 md:right-6 flex flex-col gap-1 md:gap-2 items-end z-10">
        <div className="bg-white/90 backdrop-blur-md px-2 py-0.5 md:px-5 md:py-2 rounded-full text-[8px] md:text-[11px] font-black text-brand uppercase tracking-[0.1em] shadow-xl">
          {event.type}
        </div>
        {event.style && (
          <div className="bg-brand/90 backdrop-blur-md px-2 py-0.5 md:px-5 md:py-2 rounded-full text-[8px] md:text-[11px] font-black text-white uppercase tracking-[0.1em] shadow-xl">
            {event.style}
          </div>
        )}
      </div>
      
      <div className="absolute bottom-2 left-2 md:bottom-6 md:left-6 z-10">
        <div className="flex items-center gap-2 text-white/90">
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-5 h-5 md:w-7 md:h-7 rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden">
                <img src={`https://i.pravatar.cc/100?u=${event.id}${i}`} alt="avatar" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <span className="text-[9px] md:text-xs font-bold tracking-tight">
            +24 ballano qui
          </span>
        </div>
      </div>
    </div>
    <div className="p-4 md:p-10">
      <h3 className="text-base md:text-3xl font-display font-black mb-1.5 md:mb-4 group-hover:text-brand transition-colors leading-[1.1] tracking-tight line-clamp-2">{event.title}</h3>
      
      <div className="space-y-2 md:space-y-4 mb-5 md:mb-10">
        <div className="flex items-center gap-3 md:gap-4 text-slate-500">
          <div className="w-6 h-6 md:w-10 md:h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Calendar className="w-3 h-3 md:w-5 md:h-5 text-brand" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] md:text-sm font-bold text-slate-900">
              {new Date(event.date?.seconds * 1000).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="text-[9px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">Inizio ore 21:30</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 text-slate-500">
          <div className="w-6 h-6 md:w-10 md:h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <MapPin className="w-3 h-3 md:w-5 md:h-5 text-brand" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] md:text-sm font-bold text-slate-900 truncate max-w-[150px] md:max-w-[200px]">{event.address}</span>
            <span className="text-[9px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">Vedi sulla mappa</span>
          </div>
        </div>
      </div>
      
      <button 
        onClick={() => onBook?.(event)}
        className="w-full py-3 md:py-5 bg-slate-900 text-white rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] hover:bg-brand transition-all flex items-center justify-center gap-3 group/btn shadow-xl shadow-slate-900/10 hover:shadow-brand/30"
      >
        Prenota Posto 
        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </button>
    </div>
  </motion.div>
);

const SchoolCard = ({ school }: { school: DanceSchool }) => (
  <motion.div 
    whileHover={{ y: -8 }}
    className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.12)] transition-all group w-full"
  >
    <div className="aspect-video md:h-80 bg-slate-100 relative overflow-hidden">
      <img 
        src={school.photoURL || `https://picsum.photos/seed/${school.id}/800/600`} 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
        alt={school.name}
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-2 right-2 md:top-6 md:right-6 bg-white/90 backdrop-blur-md px-2 py-0.5 md:px-5 md:py-2 rounded-full text-[8px] md:text-[11px] font-black text-indigo-600 uppercase tracking-[0.1em] shadow-xl">
        Scuola Certificata
      </div>
    </div>
    <div className="p-4 md:p-10">
      <h3 className="text-base md:text-3xl font-display font-black mb-1.5 md:mb-4 group-hover:text-indigo-600 transition-colors leading-[1.1] tracking-tight line-clamp-2">{school.name}</h3>
      
      <div className="flex items-center gap-3 md:gap-4 text-slate-500 mb-4 md:mb-8">
        <div className="w-6 h-6 md:w-10 md:h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
          <MapPin className="w-3 h-3 md:w-5 md:h-5 text-indigo-500" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-sm font-bold text-slate-900 truncate max-w-[150px] md:max-w-[200px]">{school.address}</span>
          <span className="text-[9px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">Sede Principale</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1 md:gap-2 mb-5 md:mb-10">
        {school.styles?.slice(0, 3).map(style => (
          <span key={style} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[8px] md:text-[11px] font-black uppercase tracking-wider">
            {style}
          </span>
        ))}
        {school.styles && school.styles.length > 3 && (
          <span className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-xl text-[8px] md:text-[11px] font-black uppercase tracking-wider">
            +{school.styles.length - 3}
          </span>
        )}
      </div>
      
      <button className="w-full py-3 md:py-5 bg-slate-900 text-white rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 group/btn shadow-xl shadow-slate-900/10 hover:shadow-indigo-500/30">
        Vedi Corsi 
        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </button>
    </div>
  </motion.div>
);

const SchoolFinder = ({ schools, searchQuery }: { schools: DanceSchool[], searchQuery: string }) => {
  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    school.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    school.styles?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {filteredSchools.map(school => (
        <SchoolCard key={school.id} school={school} />
      ))}
      {filteredSchools.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Nessuna scuola trovata per "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<DanceEvent[]>([]);
  const [schools, setSchools] = useState<DanceSchool[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Tutti');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const isFirstLoadEvents = useRef(true);
  const isFirstLoadMessages = useRef(true);
  const [newOrder, setNewOrder] = useState({ 
    title: '', 
    address: '', 
    type: 'Social', 
    style: 'Salsa',
    price: 10,
    date: new Date().toISOString().split('T')[0],
    photoURL: ''
  });

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
    }
  };

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribeProfile = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          } else {
            setDoc(userRef, {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Anonimo',
              photoURL: currentUser.photoURL || '',
              styles: [],
              level: 'Beginner',
              role: 'Both'
            }).catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`));
          }
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`));
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DanceEvent[];
      
      if (!isFirstLoadEvents.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newEvent = { id: change.doc.id, ...change.doc.data() } as DanceEvent;
            if (newEvent.organizerId !== user?.uid) {
              if (userProfile?.location && newEvent.location) {
                const dist = getDistance(
                  userProfile.location.lat, 
                  userProfile.location.lng, 
                  newEvent.location.lat, 
                  newEvent.location.lng
                );
                if (dist < 50) { // 50km
                  showNotification('Nuovo Evento Vicino!', `${newEvent.title} a ${newEvent.address}`);
                }
              } else {
                showNotification('Nuovo Evento!', newEvent.title);
              }
            }
          }
        });
      }
      isFirstLoadEvents.current = false;
      setEvents(eventsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [user, userProfile?.location]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    
    const q = query(
      collection(db, 'chats', 'global', 'messages'),
      orderBy('timestamp', 'asc'),
      limitToLast(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      if (!isFirstLoadMessages.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
            if (newMsg.senderId !== user?.uid && !isChatOpen) {
              showNotification(`Nuovo messaggio da ${newMsg.senderName}`, newMsg.text);
            }
          }
        });
      }
      isFirstLoadMessages.current = false;
      setMessages(messagesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats/global/messages'));

    return () => unsubscribe();
  }, [user, isChatOpen]);

  useEffect(() => {
    const q = query(collection(db, 'schools'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schoolsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DanceSchool[];
      setSchools(schoolsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'events'), {
        title: newOrder.title,
        description: 'Una fantastica serata di ballo!',
        date: Timestamp.fromDate(new Date(newOrder.date)),
        location: { lat: 45.4642, lng: 9.1900 }, // Milano default
        address: newOrder.address,
        type: newOrder.type,
        style: newOrder.style,
        organizerId: user.uid,
        price: newOrder.price,
        photoURL: newOrder.photoURL
      });
      setIsCreatingEvent(false);
      setNewOrder({ 
        title: '', 
        address: '', 
        type: 'Social', 
        style: 'Salsa',
        price: 10, 
        date: new Date().toISOString().split('T')[0],
        photoURL: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'schools'), {
        name: newOrder.title,
        address: newOrder.address,
        location: { lat: 45.4642, lng: 9.1900 }, // Milano default
        photoURL: newOrder.photoURL,
        styles: ['Salsa', 'Bachata'],
        ownerId: user.uid
      });
      setIsCreatingSchool(false);
      setNewOrder({ 
        title: '', 
        address: '', 
        type: 'Social', 
        style: 'Salsa',
        price: 10, 
        date: new Date().toISOString().split('T')[0],
        photoURL: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'schools');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit
        alert("La foto è troppo grande. Carica un'immagine inferiore a 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if too large to keep base64 string manageable
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width > height) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            } else {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality to stay under 1MB Firestore limit
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setNewOrder(prev => ({ ...prev, photoURL: compressedDataUrl }));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateLocation = async (lat: number, lng: number) => {
    if (!user) return;
    setIsUpdatingLocation(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        location: { lat, lng }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocalizzazione non supportata dal tuo browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error("Errore geolocalizzazione:", error);
        alert("Impossibile ottenere la posizione. Controlla i permessi.");
      }
    );
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = () => signOut(auth);

  const handleBookEvent = async (event: DanceEvent) => {
    if (!user || !userProfile) return;
    try {
      await addDoc(collection(db, 'bookings'), {
        eventId: event.id,
        userId: user.uid,
        timestamp: serverTimestamp(),
        status: 'Confirmed'
      });

      // Notify organizer
      if (event.organizerId) {
        await addDoc(collection(db, 'users', event.organizerId, 'notifications'), {
          title: 'Nuova Prenotazione!',
          body: `${userProfile.displayName} si è prenotato per "${event.title}"`,
          timestamp: Date.now(),
          read: false,
          type: 'event'
        });
      }

      alert(`Prenotazione confermata per ${event.title}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    }
  };

  const markNotificationAsRead = async (id: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', id), {
        read: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${id}`);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'users', user.uid, 'notifications', n.id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/notifications`);
    }
  };

  const startPrivateChat = async (otherUser: UserProfile) => {
    if (!user) return;
    
    // Check if chat already exists
    const existingChat = chats.find(c => c.participants.includes(otherUser.uid));
    
    if (existingChat) {
      setActiveChatId(existingChat.id);
      setIsChatListOpen(true);
      return;
    }

    try {
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, otherUser.uid],
        updatedAt: serverTimestamp(),
        lastMessage: 'Inizia una conversazione...',
        lastTimestamp: serverTimestamp()
      });
      
      // Notify the other user
      await addDoc(collection(db, 'users', otherUser.uid, 'notifications'), {
        title: 'Nuova richiesta di chat',
        body: `${userProfile?.displayName || 'Qualcuno'} vuole chattare con te!`,
        timestamp: Date.now(),
        read: false,
        type: 'message'
      });

      setActiveChatId(chatRef.id);
      setIsChatListOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const sendPrivateMessage = async (chatId: string, text: string) => {
    if (!user || !userProfile) return;
    try {
      const messageData = {
        senderId: user.uid,
        senderName: userProfile.displayName,
        senderPhoto: userProfile.photoURL || '',
        text,
        timestamp: serverTimestamp(),
        chatId
      };
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create notification for the recipient
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        const recipientId = chat.participants.find(id => id !== user.uid);
        if (recipientId) {
          await addDoc(collection(db, 'users', recipientId, 'notifications'), {
            title: `Nuovo messaggio da ${userProfile.displayName}`,
            body: text,
            timestamp: Date.now(),
            read: false,
            type: 'message'
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: Chat[] = [];
      for (const snap of snapshot.docs) {
        const data = snap.data();
        if (data.participants.includes(user.uid)) {
          const otherUserId = data.participants.find((id: string) => id !== user.uid);
          // Fetch other user profile if not already in cache
          const otherUserSnap = await getDoc(doc(db, 'users', otherUserId));
          const otherUser = otherUserSnap.exists() ? { uid: otherUserSnap.id, ...otherUserSnap.data() } as UserProfile : undefined;
          
          chatList.push({
            id: snap.id,
            ...data,
            otherUser
          } as Chat);
        }
      }
      // Sort by updatedAt desc on client
      chatList.sort((a, b) => {
        const tA = a.updatedAt?.toMillis() || 0;
        const tB = b.updatedAt?.toMillis() || 0;
        return tB - tA;
      });
      setChats(chatList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      setNotifications(notifs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeChatId) {
      setChatMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limitToLast(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setChatMessages(msgs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${activeChatId}/messages`));

    return () => unsubscribe();
  }, [activeChatId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-20 h-20 border-t-4 border-brand rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Music className="text-brand w-8 h-8 animate-pulse" />
          </div>
        </div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]"
        >
          Caricamento Caraibi
        </motion.p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white text-gray-900 font-sans pt-20 pb-32">
        <Navbar 
          user={user} 
          onViewChange={setActiveView}
          onSignOut={handleSignOut} 
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {user && (
          <FloatingNavbar 
            activeView={activeView}
            onViewChange={setActiveView}
            onOpenChat={() => setIsChatListOpen(true)}
            onOpenCommunityChat={() => setIsChatOpen(true)}
            notificationsEnabled={notificationsEnabled}
            onToggleNotifications={requestNotificationPermission}
            chatCount={chats.length}
            notificationCount={notifications.filter(n => !n.read).length}
          />
        )}

        <AnimatePresence>
          {isChatListOpen && user && (
            <PrivateChat 
              user={user} 
              onClose={() => setIsChatListOpen(false)} 
              chats={chats}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              messages={chatMessages}
              onSendMessage={sendPrivateMessage}
            />
          )}
          {isChatOpen && user && (
            <ChatRoom user={user} onClose={() => setIsChatOpen(false)} messages={messages} />
          )}
          {isProfileModalOpen && user && (
            <ProfileModal 
              user={user} 
              profile={userProfile} 
              onClose={() => setIsProfileModalOpen(false)} 
              onUpdate={updateProfile}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Hero onSignIn={handleSignIn} />
              
              <div className="max-w-7xl mx-auto px-6 py-24">
                <div className="grid md:grid-cols-3 gap-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <MapPin className="text-orange-600 w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Trova Scuole</h3>
                    <p className="text-gray-500">Scopri le migliori scuole di ballo nella tua zona con recensioni e orari.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Calendar className="text-blue-600 w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Eventi & Serate</h3>
                    <p className="text-gray-500">Non perdere mai una serata. Prenota il tuo posto direttamente dall'app.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Users className="text-purple-600 w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Incontra Ballerini</h3>
                    <p className="text-gray-500">Connettiti con altri appassionati, organizza uscite e trova partner di ballo.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.main
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-7xl mx-auto px-6 py-12"
            >
              <div className="relative flex-1 max-w-xl group mb-16 mx-auto">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cerca eventi, scuole o ballerini..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-white border-none rounded-[2rem] shadow-xl shadow-slate-200/50 focus:ring-2 focus:ring-brand transition-all font-medium placeholder:text-slate-300"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
              </div>

              {isCreatingEvent && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-16 bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                      <Calendar className="text-brand w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-black text-slate-900">Crea Nuovo Evento</h3>
                      <p className="text-sm text-slate-500 font-medium">Condividi la tua passione con la community</p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleCreateEvent} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Titolo Evento</label>
                      <input 
                        required
                        value={newOrder.title}
                        onChange={e => setNewOrder({...newOrder, title: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-medium"
                        placeholder="Es: Serata Salsa Cubana"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Indirizzo</label>
                      <input 
                        required
                        value={newOrder.address}
                        onChange={e => setNewOrder({...newOrder, address: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-medium"
                        placeholder="Via Roma 1, Milano"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                      <select 
                        value={newOrder.type}
                        onChange={e => setNewOrder({...newOrder, type: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-medium appearance-none cursor-pointer"
                      >
                        <option>Social</option>
                        <option>Congress</option>
                        <option>Workshop</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Stile di Ballo</label>
                      <select 
                        value={newOrder.style}
                        onChange={e => setNewOrder({...newOrder, style: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-medium appearance-none cursor-pointer"
                      >
                        <option>Salsa</option>
                        <option>Bachata</option>
                        <option>Kizomba</option>
                        <option>Altro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Data Evento</label>
                      <input 
                        type="date"
                        required
                        value={newOrder.date}
                        onChange={e => setNewOrder({...newOrder, date: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Prezzo (€)</label>
                      <input 
                        type="number"
                        value={newOrder.price}
                        onChange={e => setNewOrder({...newOrder, price: Number(e.target.value)})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-brand focus:bg-white focus:ring-0 transition-all font-medium"
                      />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Foto Evento</label>
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="event-photo-upload"
                        />
                        <label 
                          htmlFor="event-photo-upload"
                          className="w-full sm:flex-1 h-32 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 cursor-pointer hover:border-brand hover:text-brand hover:bg-brand/5 transition-all group"
                        >
                          <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-bold">{newOrder.photoURL ? 'Foto Selezionata ✓' : 'Trascina o clicca per caricare'}</span>
                        </label>
                        {newOrder.photoURL && (
                          <div className="relative">
                            <img src={newOrder.photoURL} alt="Preview" className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-lg" />
                            <button 
                              type="button"
                              onClick={() => setNewOrder({...newOrder, photoURL: ''})}
                              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-4 pt-4">
                      <button type="submit" className="flex-1 py-5 bg-brand text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 active:scale-95">
                        Pubblica Evento
                      </button>
                      <button type="button" onClick={() => setIsCreatingEvent(false)} className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                        Annulla
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {isCreatingSchool && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-16 bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                      <School className="text-indigo-600 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-black text-slate-900">Aggiungi Nuova Scuola</h3>
                      <p className="text-sm text-slate-500 font-medium">Fai conoscere la tua accademia a tutti</p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleCreateSchool} className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome Scuola</label>
                      <input 
                        required
                        value={newOrder.title}
                        onChange={e => setNewOrder({...newOrder, title: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-0 transition-all font-medium"
                        placeholder="Es: Accademia Latino Americana"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Indirizzo</label>
                      <input 
                        required
                        value={newOrder.address}
                        onChange={e => setNewOrder({...newOrder, address: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-0 transition-all font-medium"
                        placeholder="Via Roma 1, Milano"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Foto Scuola</label>
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="school-photo-upload"
                        />
                        <label 
                          htmlFor="school-photo-upload"
                          className="w-full sm:flex-1 h-32 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 cursor-pointer hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all group"
                        >
                          <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-bold">{newOrder.photoURL ? 'Foto Selezionata ✓' : 'Trascina o clicca per caricare'}</span>
                        </label>
                        {newOrder.photoURL && (
                          <div className="relative">
                            <img src={newOrder.photoURL} alt="Preview" className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-lg" />
                            <button 
                              type="button"
                              onClick={() => setNewOrder({...newOrder, photoURL: ''})}
                              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 pt-4">
                      <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95">
                        Salva Scuola
                      </button>
                      <button type="button" onClick={() => setIsCreatingSchool(false)} className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                        Annulla
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {activeView === 'home' && (
                <div className="space-y-24">
                  {/* Hero Section */}
                  <section className="relative py-12 md:py-24 overflow-hidden">
                    <div className="relative z-10 max-w-4xl">
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      >
                        <h1 className="text-[14vw] md:text-[120px] font-display font-black text-slate-900 leading-[0.85] mb-8 tracking-tighter">
                          BALLA <br />
                          <span className="text-brand">SENZA</span> <br />
                          CONFINI.
                        </h1>
                        <p className="text-lg md:text-2xl text-slate-500 font-medium max-w-xl mb-12 leading-relaxed">
                          La più grande community di balli caraibici in Italia. Trova scuole, eventi e partner in un click.
                        </p>
                        <div className="flex flex-wrap gap-4 md:gap-6">
                          <button 
                            onClick={() => setActiveView('events')} 
                            className="px-8 py-4 md:px-12 md:py-6 bg-slate-900 text-white rounded-2xl md:rounded-3xl font-black uppercase tracking-[0.2em] text-xs md:text-sm hover:bg-brand transition-all shadow-2xl shadow-slate-900/20 hover:-translate-y-1"
                          >
                            Esplora Eventi
                          </button>
                          <button 
                            onClick={() => setActiveView('schools')} 
                            className="px-8 py-4 md:px-12 md:py-6 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl md:rounded-3xl font-black uppercase tracking-[0.2em] text-xs md:text-sm hover:border-brand transition-all hover:-translate-y-1"
                          >
                            Cerca Scuole
                          </button>
                        </div>
                      </motion.div>
                    </div>
                    
                    {/* Abstract Background Elements */}
                    <div className="absolute -right-20 -top-20 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full hidden lg:flex items-center justify-center -z-10">
                      <div className="relative w-full aspect-square">
                        <div className="absolute inset-0 border-[40px] border-slate-100 rounded-full animate-[spin_20s_linear_infinite]"></div>
                        <div className="absolute inset-20 border-[20px] border-brand/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                        <Music className="absolute inset-0 m-auto w-32 h-32 text-brand/20" />
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                      <div>
                        <span className="text-brand font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-4 block">Esplora il territorio</span>
                        <h3 className="text-4xl md:text-6xl font-display font-black text-slate-900 tracking-tighter leading-none">Mappa Interattiva</h3>
                      </div>
                      <button 
                        onClick={() => setActiveView('map')} 
                        className="flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-slate-200 transition-all w-fit"
                      >
                        Espandi Mappa
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="rounded-[2.5rem] md:rounded-[4rem] overflow-hidden shadow-2xl shadow-slate-200/50 border-[6px] md:border-[12px] border-white relative group">
                      <div className="absolute inset-0 bg-slate-900/5 group-hover:bg-transparent transition-colors duration-500 pointer-events-none z-10"></div>
                      <MapView 
                        events={events} 
                        schools={schools} 
                        userLocation={userProfile?.location} 
                      />
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                      <div>
                        <span className="text-indigo-600 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-4 block">Formazione d'eccellenza</span>
                        <h3 className="text-4xl md:text-6xl font-display font-black text-slate-900 tracking-tighter leading-none">Scuole di Ballo</h3>
                      </div>
                      <button 
                        onClick={() => setActiveView('schools')} 
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-indigo-100 transition-all w-fit"
                      >
                        Vedi Tutte
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                      {schools.slice(0, 3).map(school => (
                        <div key={school.id} className="w-full">
                          <SchoolCard school={school} />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                      <div>
                        <span className="text-brand font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-4 block">Agenda Caraibica</span>
                        <h3 className="text-4xl md:text-6xl font-display font-black text-slate-900 tracking-tighter leading-none">Prossimi Eventi</h3>
                      </div>
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full md:w-auto">
                        <div className="flex bg-slate-100 p-2 rounded-2xl overflow-x-auto no-scrollbar w-full md:w-auto">
                          {['Tutti', 'Salsa', 'Bachata', 'Kizomba', 'Zouk'].map(filter => (
                            <button 
                              key={filter}
                              onClick={() => setSelectedStyle(filter)}
                              className={`px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                selectedStyle === filter 
                                  ? 'bg-white text-brand shadow-md' 
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => setActiveView('events')} 
                          className="flex items-center gap-3 px-8 py-4 bg-brand/10 text-brand rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-brand/20 transition-all w-full md:w-auto justify-center"
                        >
                          Vedi Tutti
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                      {events
                        .filter(e => selectedStyle === 'Tutti' || e.style === selectedStyle)
                        .slice(0, 6)
                        .map(event => (
                          <div key={event.id} className="w-full">
                            <EventCard event={event} onBook={handleBookEvent} />
                          </div>
                        ))}
                    </div>
                  </section>

                  <section className="grid md:grid-cols-2 gap-8 md:gap-12">
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="bg-slate-900 rounded-[2.5rem] md:rounded-[4rem] p-10 md:p-16 text-white relative overflow-hidden group cursor-pointer shadow-2xl shadow-slate-900/20" 
                      onClick={() => setActiveView('partners')}
                    >
                      <div className="relative z-10">
                        <span className="text-brand font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-6 block">Social Dance</span>
                        <h3 className="text-4xl md:text-6xl font-display font-black mb-6 leading-none tracking-tighter">Cerca <br />Partner</h3>
                        <p className="text-slate-400 mb-10 max-w-[240px] md:max-w-sm text-sm md:text-lg leading-relaxed">Trova il compagno ideale per il tuo prossimo corso o serata.</p>
                        <button className="px-10 py-5 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-dark transition-all shadow-xl shadow-brand/20">
                          Trova Partner
                        </button>
                      </div>
                      <Users className="absolute -right-10 -bottom-10 w-64 h-64 md:w-96 md:h-96 text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                    </motion.div>

                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="bg-brand rounded-[2.5rem] md:rounded-[4rem] p-10 md:p-16 text-white relative overflow-hidden group cursor-pointer shadow-2xl shadow-brand/20" 
                      onClick={() => setIsCreatingSchool(true)}
                    >
                      <div className="relative z-10">
                        <span className="text-white/60 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-6 block">Business & Growth</span>
                        <h3 className="text-4xl md:text-6xl font-display font-black mb-6 leading-none tracking-tighter">Aggiungi <br />Scuola</h3>
                        <p className="text-white/80 mb-10 max-w-[240px] md:max-w-sm text-sm md:text-lg leading-relaxed">Sei un gestore? Inserisci la tua scuola sulla mappa e cresci.</p>
                        <button className="px-10 py-5 bg-white text-brand rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all shadow-xl shadow-white/10">
                          Pubblica Ora
                        </button>
                      </div>
                      <Music className="absolute -right-10 -bottom-10 w-64 h-64 md:w-96 md:h-96 text-white/10 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                    </motion.div>
                  </section>
                </div>
              )}

                {activeView === 'schools' && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold">Scuole di Ballo</h3>
                      <button onClick={() => setIsCreatingSchool(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Aggiungi Scuola
                      </button>
                    </div>
                    <SchoolFinder schools={schools} searchQuery={searchQuery} />
                  </div>
                )}

              {activeView === 'map' && (
                <div className="space-y-8">
                  <h3 className="text-2xl font-bold">Mappa Completa</h3>
                  <MapView events={events} schools={schools} userLocation={userProfile?.location} />
                </div>
              )}

              {activeView === 'calendar' && (
                <div className="space-y-8">
                  <h3 className="text-2xl font-bold">Calendario Eventi</h3>
                  <CalendarView events={events} />
                </div>
              )}

              {activeView === 'partners' && (
                <div className="space-y-8">
                  <h3 className="text-2xl font-bold">Trova Partner di Ballo</h3>
                  <PartnerFinder user={user} onStartChat={startPrivateChat} />
                </div>
              )}

              {activeView === 'notifications' && (
                <NotificationsView 
                  notifications={notifications}
                  onMarkAsRead={markNotificationAsRead}
                  onClearAll={clearAllNotifications}
                />
              )}
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
