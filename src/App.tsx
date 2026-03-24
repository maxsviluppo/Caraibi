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
  Timestamp,
  limit,
  limitToLast
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
  Bell
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
  roomId: string;
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-bold tracking-tight">Il Tuo Profilo</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-3xl">
              <img src={user.photoURL || ''} alt="" className="w-20 h-20 rounded-full border-4 border-white shadow-sm" referrerPolicy="no-referrer" />
              <div>
                <h4 className="font-bold text-xl">{user.displayName}</h4>
                <p className="text-gray-500 text-sm">{user.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Bio</label>
              <textarea 
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 min-h-[120px] resize-none"
                placeholder="Raccontaci qualcosa di te e della tua passione per il ballo..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Stili di Ballo</label>
              <div className="flex flex-wrap gap-2">
                {danceStyles.map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      formData.styles?.includes(style)
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Livello</label>
                <select 
                  value={formData.level}
                  onChange={e => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 font-medium"
                >
                  <option value="Beginner">Principiante</option>
                  <option value="Intermediate">Intermedio</option>
                  <option value="Advanced">Avanzato</option>
                  <option value="Pro">Professionista</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Ruolo</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 font-medium"
                >
                  <option value="Leader">Leader</option>
                  <option value="Follower">Follower</option>
                  <option value="Both">Entrambi</option>
                </select>
              </div>
            </div>

            <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <label className="block text-sm font-bold text-orange-800 mb-4">Posizione Sulla Mappa</label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-orange-400 block mb-1">Latitudine</span>
                  <input 
                    type="number" step="any"
                    value={formData.location?.lat}
                    onChange={e => setFormData({ ...formData, location: { ...formData.location!, lat: parseFloat(e.target.value) } })}
                    className="w-full px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-orange-400 block mb-1">Longitudine</span>
                  <input 
                    type="number" step="any"
                    value={formData.location?.lng}
                    onChange={e => setFormData({ ...formData, location: { ...formData.location!, lng: parseFloat(e.target.value) } })}
                    className="w-full px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
              </div>
              <button 
                type="button"
                onClick={useGPS}
                className="w-full py-3 bg-white text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-100 transition-all flex items-center justify-center gap-2 border border-orange-200"
              >
                <MapPin className="w-4 h-4" /> Aggiorna con GPS
              </button>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit" 
                disabled={isSaving}
                className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20 disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva Profilo'}
              </button>
              <button 
                type="button" 
                onClick={onClose}
                className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
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
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[60] flex flex-col border-l border-gray-100"
    >
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-orange-500 text-white">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6" />
          <h3 className="font-bold text-lg">Community Chat</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
          <Plus className="w-6 h-6 rotate-45" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
            <div className={`flex gap-2 max-w-[80%] ${msg.senderId === user.uid ? 'flex-row-reverse' : 'flex-row'}`}>
              <img src={msg.senderPhoto} alt="" className="w-8 h-8 rounded-full border border-gray-100" referrerPolicy="no-referrer" />
              <div className={`p-3 rounded-2xl text-sm ${
                msg.senderId === user.uid 
                  ? 'bg-orange-500 text-white rounded-tr-none' 
                  : 'bg-gray-100 text-gray-800 rounded-tl-none'
              }`}>
                <p className="font-bold text-[10px] mb-1 opacity-70">{msg.senderName}</p>
                <p>{msg.text}</p>
              </div>
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-10">
              {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
            </span>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-6 border-t border-gray-100 bg-gray-50">
        <div className="flex gap-2">
          <input 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 transition-all text-sm"
          />
          <button type="submit" className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">
            <ChevronRight className="w-5 h-5" />
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
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 bg-orange-500 text-white flex items-center justify-between">
          <h3 className="text-2xl font-bold">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-white/20 rounded-full transition-colors"><ChevronRight className="w-6 h-6 rotate-180" /></button>
            <button onClick={nextMonth} className="p-2 hover:bg-white/20 rounded-full transition-colors"><ChevronRight className="w-6 h-6" /></button>
          </div>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-7 gap-4 mb-4">
            {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
              <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">{day}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-4">
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
                  className={`aspect-square rounded-2xl border p-2 flex flex-col items-center justify-center relative group transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-orange-500 border-orange-600 text-white shadow-lg shadow-orange-500/30 scale-105 z-10' 
                      : isToday 
                        ? 'bg-orange-100 border-orange-200 text-orange-600' 
                        : 'bg-white border-gray-50 hover:bg-orange-50 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-bold">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {dayEvents.slice(0, 3).map(e => (
                        <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`} />
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
          className="bg-gray-50 rounded-[2.5rem] p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-gray-800">
              Eventi del {selectedDay} {monthNames[currentDate.getMonth()]}
            </h4>
            <span className="px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'Evento' : 'Eventi'}
            </span>
          </div>

          {selectedDayEvents.length > 0 ? (
            <div className="space-y-4">
              {selectedDayEvents.map(event => (
                <div key={event.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={event.photoURL || 'https://picsum.photos/seed/dance/200'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold uppercase">{event.type}</span>
                      {event.style && (
                        <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-[10px] font-bold uppercase">{event.style}</span>
                      )}
                      <span className="text-xs text-gray-400 font-medium">{event.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <h5 className="font-bold text-gray-900">{event.title}</h5>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {event.address}
                    </p>
                  </div>
                  <button className="px-6 py-2 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors">
                    Dettagli
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Nessun evento in programma per questo giorno.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

const PartnerFinder = ({ user }: { user: User }) => {
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
          
          <button className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5" /> Invia Messaggio
          </button>
        </motion.div>
      ))}
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
  activeView, 
  onViewChange, 
  onSignOut, 
  onOpenChat,
  notificationsEnabled,
  onToggleNotifications
}: { 
  user: User | null, 
  activeView: string,
  onViewChange: (view: string) => void,
  onSignOut: () => void, 
  onOpenChat: () => void,
  notificationsEnabled: boolean,
  onToggleNotifications: () => void
}) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-4 py-2 flex justify-between items-center z-50 md:px-6 md:py-3 md:top-0 md:bottom-auto md:border-b md:border-t-0">
    <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => onViewChange('home')}>
      <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
        <Music className="text-white w-5 h-5" />
      </div>
      <span className="font-bold text-xl tracking-tight hidden sm:block">SalsaConnect</span>
    </div>
    
    <div className="flex items-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar px-2">
      <button 
        onClick={() => onViewChange('map')}
        className={`p-2 transition-colors flex-shrink-0 ${activeView === 'map' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
      >
        <MapPin className="w-6 h-6" />
      </button>
      <button 
        onClick={() => onViewChange('calendar')}
        className={`p-2 transition-colors flex-shrink-0 ${activeView === 'calendar' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
      >
        <Calendar className="w-6 h-6" />
      </button>
      <button 
        onClick={() => onViewChange('schools')}
        className={`p-2 transition-colors flex-shrink-0 ${activeView === 'schools' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
      >
        <Music className="w-6 h-6" />
      </button>
      <button 
        onClick={() => onViewChange('partners')}
        className={`p-2 transition-colors flex-shrink-0 ${activeView === 'partners' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
      >
        <Users className="w-6 h-6" />
      </button>
      <button 
        onClick={onToggleNotifications}
        className={`p-2 transition-colors flex-shrink-0 ${notificationsEnabled ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
        title={notificationsEnabled ? 'Notifiche Attive' : 'Attiva Notifiche'}
      >
        <Bell className="w-6 h-6" />
      </button>
      <button onClick={onOpenChat} className="p-2 text-gray-400 hover:text-orange-500 transition-colors flex-shrink-0"><MessageSquare className="w-6 h-6" /></button>
    </div>

    {user && (
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
        <button onClick={onSignOut} className="p-2 text-gray-400 hover:text-red-500 transition-colors hidden sm:block">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    )}
  </nav>
);

const Hero = ({ onSignIn }: { onSignIn: () => void }) => (
  <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-black">
    <div className="absolute inset-0 opacity-60">
      <img 
        src="https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?q=80&w=2070&auto=format&fit=crop" 
        className="w-full h-full object-cover"
        alt="Salsa dancing"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40"></div>
    </div>
    
    <div className="relative z-10 text-center px-4 max-w-3xl">
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight"
      >
        Balla, Connettiti, <span className="text-orange-500">Vivi.</span>
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xl text-gray-300 mb-10 font-light"
      >
        La community definitiva per Salsa, Bachata e Kizomba. Trova scuole, eventi e partner di ballo vicino a te.
      </motion.p>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        onClick={onSignIn}
        className="px-8 py-4 bg-orange-500 text-white rounded-full font-semibold text-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
      >
        Inizia a Ballare Ora
      </motion.button>
    </div>
  </section>
);

const EventCard = ({ event }: { event: DanceEvent }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
  >
    <div className="h-48 bg-gray-200 relative overflow-hidden">
      <img 
        src={event.photoURL || `https://picsum.photos/seed/${event.id}/800/600`} 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        alt={event.title}
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-orange-600 shadow-sm">
          {event.type}
        </div>
        {event.style && (
          <div className="bg-orange-500 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm">
            {event.style}
          </div>
        )}
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-bold mb-2 group-hover:text-orange-500 transition-colors">{event.title}</h3>
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
        <Calendar className="w-4 h-4" />
        <span>{new Date(event.date?.seconds * 1000).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-6">
        <MapPin className="w-4 h-4" />
        <span className="truncate">{event.address}</span>
      </div>
      <button className="w-full py-3 bg-gray-50 text-gray-900 rounded-2xl font-semibold hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2">
        Prenota Posto <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </motion.div>
);

const SchoolCard = ({ school }: { school: DanceSchool }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
  >
    <div className="h-48 bg-gray-200 relative overflow-hidden">
      <img 
        src={school.photoURL || `https://picsum.photos/seed/${school.id}/800/600`} 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        alt={school.name}
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-indigo-600">
        Scuola
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-500 transition-colors">{school.name}</h3>
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
        <MapPin className="w-4 h-4" />
        <span className="truncate">{school.address}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {school.styles?.slice(0, 3).map(style => (
          <span key={style} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">{style}</span>
        ))}
      </div>
      <button className="w-full py-3 bg-gray-50 text-gray-900 rounded-2xl font-semibold hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2">
        Vedi Corsi <ChevronRight className="w-4 h-4" />
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white text-gray-900 font-sans pb-20 md:pb-0 md:pt-20">
        <Navbar 
          user={user} 
          activeView={activeView}
          onViewChange={setActiveView}
          onSignOut={handleSignOut} 
          onOpenChat={() => setIsChatOpen(true)} 
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={requestNotificationPermission}
        />

        <AnimatePresence>
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
              className="max-w-7xl mx-auto px-6 py-8"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-4">
                  <img 
                    src={user.photoURL || ''} 
                    alt="" 
                    className="w-16 h-16 rounded-full border-2 border-orange-500 cursor-pointer hover:scale-105 transition-transform" 
                    onClick={() => setIsProfileModalOpen(true)}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ciao, {user.displayName?.split(' ')[0]}! 👋</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      {userProfile?.location ? (
                        <span className="text-sm text-gray-500">
                          {userProfile.location.lat.toFixed(2)}, {userProfile.location.lng.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Posizione non impostata</span>
                      )}
                      <button 
                        onClick={() => setIsProfileModalOpen(true)}
                        className="text-xs font-bold text-orange-500 hover:underline ml-2"
                      >
                        Modifica Profilo
                      </button>
                    </div>
                  </div>
                </div>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Cerca eventi, scuole o ballerini..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
              </header>

              {isCreatingEvent && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-12 bg-white border border-orange-100 rounded-3xl p-8 shadow-xl"
                >
                  <h3 className="text-2xl font-bold mb-6">Crea Nuovo Evento</h3>
                  <form onSubmit={handleCreateEvent} className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Titolo Evento</label>
                      <input 
                        required
                        value={newOrder.title}
                        onChange={e => setNewOrder({...newOrder, title: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Es: Serata Salsa Cubana"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Indirizzo</label>
                      <input 
                        required
                        value={newOrder.address}
                        onChange={e => setNewOrder({...newOrder, address: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Via Roma 1, Milano"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Tipo</label>
                      <select 
                        value={newOrder.type}
                        onChange={e => setNewOrder({...newOrder, type: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option>Social</option>
                        <option>Congress</option>
                        <option>Workshop</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Stile di Ballo</label>
                      <select 
                        value={newOrder.style}
                        onChange={e => setNewOrder({...newOrder, style: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option>Salsa</option>
                        <option>Bachata</option>
                        <option>Kizomba</option>
                        <option>Altro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Data Evento</label>
                      <input 
                        type="date"
                        required
                        value={newOrder.date}
                        onChange={e => setNewOrder({...newOrder, date: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Prezzo (€)</label>
                      <input 
                        type="number"
                        value={newOrder.price}
                        onChange={e => setNewOrder({...newOrder, price: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Foto Evento</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="event-photo-upload"
                        />
                        <label 
                          htmlFor="event-photo-upload"
                          className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm cursor-pointer hover:border-orange-500 hover:text-orange-500 transition-all text-center"
                        >
                          {newOrder.photoURL ? 'Foto Selezionata ✓' : 'Carica Foto'}
                        </label>
                        {newOrder.photoURL && (
                          <img src={newOrder.photoURL} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 flex gap-4">
                      <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all">
                        Pubblica Evento
                      </button>
                      <button type="button" onClick={() => setIsCreatingEvent(false)} className="px-8 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
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
                  className="mb-12 bg-white border border-indigo-100 rounded-3xl p-8 shadow-xl"
                >
                  <h3 className="text-2xl font-bold mb-6">Aggiungi Nuova Scuola</h3>
                  <form onSubmit={handleCreateSchool} className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Nome Scuola</label>
                      <input 
                        required
                        value={newOrder.title}
                        onChange={e => setNewOrder({...newOrder, title: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Es: Accademia Latino Americana"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Indirizzo</label>
                      <input 
                        required
                        value={newOrder.address}
                        onChange={e => setNewOrder({...newOrder, address: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Via Roma 1, Milano"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Foto Scuola</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="school-photo-upload"
                        />
                        <label 
                          htmlFor="school-photo-upload"
                          className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm cursor-pointer hover:border-indigo-500 hover:text-indigo-500 transition-all text-center"
                        >
                          {newOrder.photoURL ? 'Foto Selezionata ✓' : 'Carica Foto'}
                        </label>
                        {newOrder.photoURL && (
                          <img src={newOrder.photoURL} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 flex gap-4">
                      <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
                        Salva Scuola
                      </button>
                      <button type="button" onClick={() => setIsCreatingSchool(false)} className="px-8 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                        Annulla
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

                {activeView === 'home' && (
                  <div className="space-y-12">
                    <section>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold tracking-tight">Mappa Interattiva</h3>
                        <button onClick={() => setActiveView('map')} className="text-orange-500 font-bold text-sm hover:underline">Espandi Mappa</button>
                      </div>
                      <MapView 
                        events={events} 
                        schools={schools} 
                        userLocation={userProfile?.location} 
                      />
                    </section>

                    <section>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold tracking-tight">Scuole di Ballo</h3>
                        <button onClick={() => setActiveView('schools')} className="text-indigo-600 font-bold text-sm hover:underline">Vedi Tutte</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {schools.slice(0, 3).map(school => (
                          <SchoolCard key={school.id} school={school} />
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                          <h3 className="text-2xl font-bold tracking-tight">Prossimi Eventi</h3>
                          <p className="text-gray-500 text-sm mt-1">Scopri le migliori serate e workshop</p>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                          {['Tutti', 'Salsa', 'Bachata', 'Kizomba'].map(style => (
                            <button
                              key={style}
                              onClick={() => setSelectedStyle(style)}
                              className={`px-6 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                                selectedStyle === style 
                                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' 
                                  : 'bg-white text-gray-500 hover:bg-orange-50 border border-gray-100'
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>

                      {events.filter(e => selectedStyle === 'Tutti' || e.style === selectedStyle).length > 0 ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                          {events
                            .filter(e => selectedStyle === 'Tutti' || e.style === selectedStyle)
                            .slice(0, 6)
                            .map(event => (
                              <EventCard key={event.id} event={event} />
                            ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Calendar className="text-gray-300 w-8 h-8" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-400">Nessun evento {selectedStyle !== 'Tutti' ? `di ${selectedStyle}` : ''} trovato</h4>
                          <p className="text-gray-400 mt-2">Prova a cambiare filtro o torna più tardi!</p>
                        </div>
                      )}
                      
                      <div className="mt-12 text-center">
                        <button 
                          onClick={() => setActiveView('calendar')}
                          className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-all shadow-sm"
                        >
                          Vedi Calendario Completo
                        </button>
                      </div>
                    </section>

                    <section className="grid md:grid-cols-2 gap-8">
                      <div className="bg-orange-500 rounded-3xl p-8 text-white relative overflow-hidden group cursor-pointer" onClick={() => setActiveView('partners')}>
                        <div className="relative z-10">
                          <h3 className="text-2xl font-bold mb-2">Cerca Partner</h3>
                          <p className="text-orange-100 mb-6 max-w-xs">Trova il compagno ideale per il tuo prossimo corso.</p>
                          <button className="px-6 py-3 bg-white text-orange-500 rounded-xl font-bold group-hover:scale-105 transition-transform">
                            Trova Partner
                          </button>
                        </div>
                        <Users className="absolute -right-4 -bottom-4 w-48 h-48 text-orange-400/30 rotate-12" />
                      </div>

                      <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden group cursor-pointer" onClick={() => setIsCreatingSchool(true)}>
                        <div className="relative z-10">
                          <h3 className="text-2xl font-bold mb-2">Aggiungi Scuola</h3>
                          <p className="text-indigo-100 mb-6 max-w-xs">Sei un gestore? Inserisci la tua scuola sulla mappa.</p>
                          <button className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold group-hover:scale-105 transition-transform">
                            Pubblica Ora
                          </button>
                        </div>
                        <Music className="absolute -right-4 -bottom-4 w-48 h-48 text-indigo-400/30 -rotate-12" />
                      </div>
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
                  <PartnerFinder user={user} />
                </div>
              )}
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
