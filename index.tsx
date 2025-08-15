
import React, { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, useNavigate, Navigate, NavLink } from 'react-router-dom';

// Type Definitions
interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface Case {
    id: number;
    case_number: string;
    client_id: number;
    description: string;
    status: string;
    client_name?: string; // from JOIN in DB query
}

interface ClientListItem {
    id: number;
    name: string;
}

// Define the type for the API exposed by the preload script
declare global {
  interface Window {
    api: {
      login: (credentials: {username: string, password: string}) => Promise<{success: boolean, user?: any, message?: string}>;
      getStats: () => Promise<{success: boolean, stats?: any, message?: string}>;
      manualBackup: () => Promise<{success: boolean, message?: string}>;
      askAi: (prompt: string) => Promise<{success: boolean, text?: string, message?: string}>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      // Client API
      getClients: () => Promise<{ success: boolean, clients?: Client[], message?: string }>;
      getClientList: () => Promise<{ success: boolean, clientList?: ClientListItem[], message?: string}>;
      addClient: (client: Omit<Client, 'id'>) => Promise<{ success: boolean, client?: Client, message?: string }>;
      updateClient: (client: Client) => Promise<{ success: boolean, client?: Client, message?: string }>;
      deleteClient: (id: number) => Promise<{ success: boolean, message?: string }>;
      // Case API
      getCases: () => Promise<{ success: boolean, cases?: Case[], message?: string }>;
      addCase: (caseData: Omit<Case, 'id'>) => Promise<{ success: boolean, case?: Case, message?: string }>;
      updateCase: (caseData: Case) => Promise<{ success: boolean, case?: Case, message?: string }>;
      deleteCase: (id: number) => Promise<{ success: boolean, message?: string }>;
    };
  }
}

// AI Assistant Types
type AiMessage = {
  id: number;
  sender: 'user' | 'ai' | 'error';
  text: string;
};

// AI Assistant Modal Component
const AiAssistantModal = ({ isOpen, onClose, messages, onSendMessage, isLoading }: { isOpen: boolean, onClose: () => void, messages: AiMessage[], onSendMessage: (prompt: string) => void, isLoading: boolean }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2>مساعد الأفوكاتو الذكي</h2>
          <button onClick={onClose} className="close-btn" aria-label="إغلاق">&times;</button>
        </div>
        <div className="ai-modal-body">
          {messages.map((msg) => (
            <div key={msg.id} className={`ai-message ${msg.sender}`}>
              <div className="message-bubble">
                <p style={{whiteSpace: 'pre-wrap'}}>{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="ai-message ai">
               <div className="message-bubble">
                <div className="ai-loading-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="ai-modal-footer">
          <form onSubmit={handleSubmit} className="ai-input-form">
            <input
              type="text"
              className="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك القانوني هنا..."
              aria-label="اكتب سؤالك القانوني هنا"
              disabled={isLoading}
            />
            <button type="submit" className="ai-send-btn" disabled={isLoading || !input.trim()}>
              إرسال
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


// Authentication Context
const AuthContext = createContext(null);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user')));
  const navigate = useNavigate();

  const login = (userData) => {
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    navigate('/');
  };

  const logout = () => {
    sessionStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const authValue = { user, login, logout };

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
};

const useAuth = () => {
  return useContext(AuthContext);
};

// Protected Route Component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" />;
  }
  return children;
};

// Toast Notification Component
const Toast = ({ message }) => {
    if (!message) return null;
    return <div className="toast">{message}</div>;
};

// General Purpose Modal for Forms
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
}

// Confirmation Dialog
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
    if(!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="modal-body">
                <p>{message}</p>
            </div>
            <div className="modal-footer">
                <button className="btn-secondary" onClick={onClose}>إلغاء</button>
                <button className="btn-danger" onClick={onConfirm}>تأكيد الحذف</button>
            </div>
        </Modal>
    );
};


// Login Component
const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }
    const result = await window.api.login({ username, password });
    if (result.success) {
      login(result.user);
    } else {
      setError(result.message || 'حدث خطأ غير متوقع.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="logo">L</div>
        <h1>مكتب الأفوكاتو</h1>
        <p>للمحاماة والاستشارات القانونية</p>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <input
              type="text"
              placeholder="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label="اسم المستخدم"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="كلمة المرور"
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button">تسجيل الدخول</button>
        </form>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
    const [stats, setStats] = useState({ casesCount: 0, upcomingAppointments: 0, activeClients: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            const result = await window.api.getStats();
            if (result.success) {
                setStats(result.stats);
            }
        };
        fetchStats();
    }, []);

    return (
        <>
            <div className="main-content-header">
                <h1>لوحة الإحصائيات</h1>
            </div>
            <div className="dashboard-stats">
                <div className="stat-card">
                    <h3>إجمالي القضايا</h3>
                    <div className="stat-number">{stats.casesCount}</div>
                </div>
                <div className="stat-card">
                    <h3>الجلسات القادمة</h3>
                    <div className="stat-number">{stats.upcomingAppointments}</div>
                </div>
                <div className="stat-card">
                    <h3>العملاء النشطين</h3>
                    <div className="stat-number">{stats.activeClients}</div>
                </div>
            </div>
        </>
    );
};

// Clients Page Component
const ClientsPage = ({ showToast }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    const fetchClients = async () => {
        const result = await window.api.getClients();
        if (result.success) {
            setClients(result.clients);
        } else {
            showToast(`فشل في جلب العملاء: ${result.message}`);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleOpenModal = (client: Client | null = null) => {
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const handleSaveClient = async (clientData: Omit<Client, 'id'> | Client) => {
        if ('id' in clientData) { // Editing
            const result = await window.api.updateClient(clientData);
            if(result.success) {
                showToast("تم تحديث العميل بنجاح!");
                fetchClients();
            } else {
                showToast(`فشل التحديث: ${result.message}`);
            }
        } else { // Adding
            const result = await window.api.addClient(clientData);
            if(result.success) {
                showToast("تمت إضافة العميل بنجاح!");
                fetchClients();
            } else {
                showToast(`فشل الإضافة: ${result.message}`);
            }
        }
        handleCloseModal();
    };
    
    const handleDeleteRequest = (client: Client) => {
        setClientToDelete(client);
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        const result = await window.api.deleteClient(clientToDelete.id);
        if (result.success) {
            showToast("تم حذف العميل بنجاح.");
            fetchClients();
        } else {
            showToast(`فشل الحذف: ${result.message}`);
        }
        setClientToDelete(null);
    };


    return (
        <>
            <div className="main-content-header">
                <h1>إدارة العملاء</h1>
                <button className="action-btn" onClick={() => handleOpenModal()}>إضافة عميل جديد</button>
            </div>
            
            <table className="data-table">
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>الهاتف</th>
                        <th>البريد الإلكتروني</th>
                        <th>العنوان</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {clients.map(client => (
                        <tr key={client.id}>
                            <td>{client.name}</td>
                            <td>{client.phone || '-'}</td>
                            <td>{client.email || '-'}</td>
                            <td>{client.address || '-'}</td>
                            <td className="actions">
                                <button className="action-btn" onClick={() => handleOpenModal(client)}>تعديل</button>
                                <button className="action-btn delete" onClick={() => handleDeleteRequest(client)}>حذف</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {isModalOpen && (
                <ClientFormModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveClient}
                    client={editingClient}
                />
            )}
            
            <ConfirmationDialog 
                isOpen={!!clientToDelete}
                onClose={() => setClientToDelete(null)}
                onConfirm={confirmDelete}
                title="تأكيد الحذف"
                message={`هل أنت متأكد أنك تريد حذف العميل "${clientToDelete?.name}"؟ سيؤدي هذا إلى إزالة ربطه من أي قضايا حالية.`}
            />
        </>
    );
};

// Client Form Modal
const ClientFormModal = ({ isOpen, onClose, onSave, client }) => {
    const [formData, setFormData] = useState({
        name: client?.name || '',
        phone: client?.phone || '',
        email: client?.email || '',
        address: client?.address || '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name) return; // Basic validation
        const dataToSave = client ? { ...client, ...formData } : formData;
        onSave(dataToSave);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={client ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}>
            <form onSubmit={handleSubmit}>
                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="name">الاسم الكامل</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">رقم الهاتف</label>
                        <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">البريد الإلكتروني</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="address">العنوان</label>
                        <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
                    <button type="submit" className="btn-primary">حفظ</button>
                </div>
            </form>
        </Modal>
    );
};

// Cases Page Component
const CasesPage = ({ showToast }) => {
    const [cases, setCases] = useState<Case[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCase, setEditingCase] = useState<Case | null>(null);
    const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);

    const fetchCases = async () => {
        const result = await window.api.getCases();
        if (result.success) {
            setCases(result.cases);
        } else {
            showToast(`فشل في جلب القضايا: ${result.message}`);
        }
    };

    useEffect(() => {
        fetchCases();
    }, []);

    const handleOpenModal = (caseData: Case | null = null) => {
        setEditingCase(caseData);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCase(null);
    };

    const handleSaveCase = async (caseData: Omit<Case, 'id' | 'client_name'> | Case) => {
        if ('id' in caseData) { // Editing
            const result = await window.api.updateCase(caseData);
            if(result.success) {
                showToast("تم تحديث القضية بنجاح!");
                fetchCases();
            } else {
                showToast(`فشل التحديث: ${result.message}`);
            }
        } else { // Adding
            const result = await window.api.addCase(caseData);
            if(result.success) {
                showToast("تمت إضافة القضية بنجاح!");
                fetchCases();
            } else {
                showToast(`فشل الإضافة: ${result.message}`);
            }
        }
        handleCloseModal();
    };

    const handleDeleteRequest = (caseData: Case) => {
        setCaseToDelete(caseData);
    };

    const confirmDelete = async () => {
        if (!caseToDelete) return;
        const result = await window.api.deleteCase(caseToDelete.id);
        if (result.success) {
            showToast("تم حذف القضية بنجاح.");
            fetchCases();
        } else {
            showToast(`فشل الحذف: ${result.message}`);
        }
        setCaseToDelete(null);
    };

    return (
        <>
            <div className="main-content-header">
                <h1>إدارة القضايا</h1>
                <button className="action-btn" onClick={() => handleOpenModal()}>إضافة قضية جديدة</button>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>رقم القضية</th>
                        <th>العميل</th>
                        <th>الوصف</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {cases.map(caseItem => (
                        <tr key={caseItem.id}>
                            <td>{caseItem.case_number}</td>
                            <td>{caseItem.client_name || 'غير محدد'}</td>
                            <td>{caseItem.description || '-'}</td>
                            <td>{caseItem.status}</td>
                            <td className="actions">
                                <button className="action-btn" onClick={() => handleOpenModal(caseItem)}>تعديل</button>
                                <button className="action-btn delete" onClick={() => handleDeleteRequest(caseItem)}>حذف</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {isModalOpen && (
                <CaseFormModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveCase}
                    caseData={editingCase}
                    showToast={showToast}
                />
            )}

            <ConfirmationDialog 
                isOpen={!!caseToDelete}
                onClose={() => setCaseToDelete(null)}
                onConfirm={confirmDelete}
                title="تأكيد الحذف"
                message={`هل أنت متأكد أنك تريد حذف القضية رقم "${caseToDelete?.case_number}"؟ لا يمكن التراجع عن هذا الإجراء.`}
            />
        </>
    );
};

// Case Form Modal
const CaseFormModal = ({ isOpen, onClose, onSave, caseData, showToast }) => {
    const [formData, setFormData] = useState({
        case_number: caseData?.case_number || '',
        client_id: caseData?.client_id || '',
        description: caseData?.description || '',
        status: caseData?.status || 'Open',
    });
    const [clientList, setClientList] = useState<ClientListItem[]>([]);

    useEffect(() => {
        const fetchClientList = async () => {
            const result = await window.api.getClientList();
            if (result.success) {
                setClientList(result.clientList);
            } else {
                showToast(`فشل جلب قائمة العملاء: ${result.message}`);
            }
        };
        fetchClientList();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.case_number || !formData.client_id) {
            showToast('يرجى إدخال رقم القضية واختيار العميل.');
            return;
        }
        const dataToSave = caseData ? { ...caseData, ...formData } : formData;
        onSave(dataToSave);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={caseData ? 'تعديل بيانات القضية' : 'إضافة قضية جديدة'}>
            <form onSubmit={handleSubmit}>
                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="case_number">رقم القضية</label>
                        <input type="text" id="case_number" name="case_number" value={formData.case_number} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="client_id">العميل</label>
                        <select id="client_id" name="client_id" value={formData.client_id} onChange={handleChange} required>
                            <option value="" disabled>-- اختر العميل --</option>
                            {clientList.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="status">الحالة</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange} required>
                            <option value="Open">مفتوحة</option>
                            <option value="Closed">مغلقة</option>
                             <option value="Pending">معلقة</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="description">الوصف</label>
                        <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4}></textarea>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
                    <button type="submit" className="btn-primary">حفظ</button>
                </div>
            </form>
        </Modal>
    );
};


// Main Application Layout
const MainAppLayout = () => {
  const { user, logout } = useAuth();
  const [toastMessage, setToastMessage] = useState('');
  const [isAiModalOpen, setAiModalOpen] = useState(false);
  const [isAiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
      {
          id: 1,
          sender: 'ai',
          text: 'مرحباً! أنا مساعد الأفوكاتو الذكي. كيف يمكنني مساعدتك اليوم في استفساراتك حول القانون المصري؟'
      }
  ]);

  const showToast = (message) => {
      setToastMessage(message);
      setTimeout(() => setToastMessage(''), 4000);
  };

  const handleBackup = async () => {
    const result = await window.api.manualBackup();
    if(result.success) {
        showToast("تم إنشاء النسخة الاحتياطية بنجاح!");
    } else {
        showToast(`فشل: ${result.message}`);
    }
  };
  
  const handleAiSendMessage = async (prompt: string) => {
    const newUserMessage: AiMessage = { id: Date.now(), sender: 'user', text: prompt };
    setAiMessages(prev => [...prev, newUserMessage]);
    setAiLoading(true);

    try {
        const result = await window.api.askAi(prompt);
        if (result.success) {
            const newAiMessage: AiMessage = { id: Date.now() + 1, sender: 'ai', text: result.text };
            setAiMessages(prev => [...prev, newAiMessage]);
        } else {
            const newErrorMessage: AiMessage = { id: Date.now() + 1, sender: 'error', text: `حدث خطأ: ${result.message || 'لا يمكن الوصول للمساعد الذكي حالياً.'}` };
            setAiMessages(prev => [...prev, newErrorMessage]);
        }
    } catch (error) {
        const newErrorMessage: AiMessage = { id: Date.now() + 1, sender: 'error', text: `حدث خطأ في الاتصال: ${error.message}` };
        setAiMessages(prev => [...prev, newErrorMessage]);
    } finally {
        setAiLoading(false);
    }
  };

  return (
    <div className="main-app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>الأفوكاتو</h2>
          <p>مرحباً، {user?.username} ({user?.role})</p>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li><NavLink to="/" end>لوحة التحكم</NavLink></li>
            <li><NavLink to="/cases">القضايا</NavLink></li>
            <li><NavLink to="/clients">العملاء</NavLink></li>
            <li><NavLink to="/appointments">الجلسات</NavLink></li>
            <li><NavLink to="/invoices">الفواتير</NavLink></li>
            {user?.role === 'Admin' && <li><NavLink to="/users">المستخدمين</NavLink></li>}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleBackup}>نسخ احتياطي يدوي</button>
          <button onClick={logout} style={{marginTop: '1rem', borderColor: '#8892b0', color: '#8892b0'}}>تسجيل الخروج</button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientsPage showToast={showToast} />} />
            <Route path="/cases" element={<CasesPage showToast={showToast} />} />
        </Routes>
      </main>
      <Toast message={toastMessage} />
      <button className="ai-fab" onClick={() => setAiModalOpen(true)} aria-label="فتح المساعد الذكي">
        AI
      </button>
      <AiAssistantModal 
          isOpen={isAiModalOpen} 
          onClose={() => setAiModalOpen(false)}
          messages={aiMessages}
          onSendMessage={handleAiSendMessage}
          isLoading={isAiLoading}
      />
    </div>
  );
};


// Main App Component
const App = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <MainAppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
