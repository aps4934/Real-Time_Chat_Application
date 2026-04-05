import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Hash, 
  Users, 
  Circle, 
  Search, 
  Paperclip, 
  Image as ImageIcon, 
  Smile, 
  MoreVertical, 
  LogOut,
  User
} from 'lucide-react';

const Chat = () => {
  const { user, token, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null); // { id, name, type: 'user' | 'group' }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingStatus, setTypingStatus] = useState({}); // userId -> timer
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  // Initialize Socket
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    });
    setSocket(newSocket);

    newSocket.on('user_status', ({ userId, status }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (status === 'online') next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    newSocket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
      scrollToBottom();
    });

    newSocket.on('display_typing', ({ userId, groupId }) => {
      setTypingStatus(prev => ({ ...prev, [userId]: true }));
      setTimeout(() => {
        setTypingStatus(prev => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }, 3000);
    });

    return () => newSocket.close();
  }, [token]);

  // Fetch users and online status
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/users');
        setUsers(res.data.filter(u => u.id !== user.id));
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user.id]);

  // Fetch messages when chat selected
  useEffect(() => {
    if (selectedChat) {
      const fetchMessages = async () => {
        try {
          const res = await axios.get(`http://localhost:3001/api/messages/${selectedChat.type}/${selectedChat.id}`, {
            headers: { Authorization: token }
          });
          setMessages(res.data);
          scrollToBottom();
        } catch (err) {
          console.error(err);
        }
      };
      if (selectedChat.type === 'group') {
        socket.emit('join_group', selectedChat.id);
      }
      fetchMessages();
    }
  }, [selectedChat, token]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    socket.emit('send_message', {
      recipientId: selectedChat.type === 'user' ? selectedChat.id : null,
      groupId: selectedChat.type === 'group' ? selectedChat.id : null,
      content: newMessage
    });
    setNewMessage('');
  };

  const handleTyping = () => {
    if (!selectedChat) return;
    socket.emit('typing', {
      recipientId: selectedChat.type === 'user' ? selectedChat.id : null,
      groupId: selectedChat.type === 'group' ? selectedChat.id : null
    });
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className="sidebar glass-card">
        <div className="sidebar-header">
          <div className="user-profile">
            <img src={user.avatar_url} alt="me" />
            <div className="user-info">
              <h3>{user.username}</h3>
              <span className="online-badge"><Circle size={10} fill="#10B981" color="#10B981" /> Online</span>
            </div>
          </div>
          <button className="icon-btn" onClick={logout} title="Logout"><LogOut size={20} /></button>
        </div>

        <div className="search-bar">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search conversations..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sidebar-content">
          <div className="section-title">Direct Messages</div>
          {filteredUsers.map(u => (
            <div 
              key={u.id} 
              className={`user-item ${selectedChat?.id === u.id ? 'active' : ''}`}
              onClick={() => setSelectedChat({ id: u.id, name: u.username, type: 'user', avatar: u.avatar_url })}
            >
              <div className="avatar-wrapper">
                <img src={u.avatar_url} alt={u.username} />
                {onlineUsers.has(u.id) && <div className="status-indicator online" />}
              </div>
              <div className="item-info">
                <div className="item-name">{u.username}</div>
                <div className="item-msg">{typingStatus[u.id] ? <span className="typing-text">typing...</span> : 'Click to chat'}</div>
              </div>
            </div>
          ))}
          
          <div className="section-title">Global Channels</div>
          <div 
            className={`user-item ${selectedChat?.id === 1 && selectedChat?.type === 'group' ? 'active' : ''}`}
            onClick={() => setSelectedChat({ id: 1, name: 'General Nexus', type: 'group' })}
          >
            <div className="avatar-wrapper group">
              <Users size={20} />
            </div>
            <div className="item-info">
              <div className="item-name">General Nexus</div>
              <div className="item-msg">Community Hub</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-window">
        {selectedChat ? (
          <>
            <header className="chat-header glass-card">
              <div className="chat-info">
                <div className="avatar-wrapper">
                  {selectedChat.type === 'user' ? (
                    <img src={selectedChat.avatar} alt="avatar" />
                  ) : (
                    <div className="avatar-wrapper group"><Users size={20} /></div>
                  )}
                  {onlineUsers.has(selectedChat.id) && selectedChat.type === 'user' && <div className="status-indicator online" />}
                </div>
                <div>
                  <h2>{selectedChat.name}</h2>
                  <span className="status-text">{onlineUsers.has(selectedChat.id) ? 'Online' : 'Offline'}</span>
                </div>
              </div>
              <div className="header-actions">
                <button className="icon-btn"><Search size={20} /></button>
                <button className="icon-btn"><MoreVertical size={20} /></button>
              </div>
            </header>

            <div className="message-area">
              <div className="scroll-container">
                {messages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.sender_id === user.id ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={msg.id || i} 
                    className={`message-row ${msg.sender_id === user.id ? 'me' : 'them'}`}
                  >
                    {msg.sender_id !== user.id && <img src={msg.sender_avatar} alt="avatar" className="msg-avatar" />}
                    <div className="message-bubble">
                      <div className="message-header">
                        {msg.sender_id !== user.id && <span className="sender-name">{msg.sender_name}</span>}
                        <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p>{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              {Object.keys(typingStatus).length > 0 && selectedChat && (
                <div className="typing-indicator-bar">
                  <div className="typing-bubbles">
                    <span />
                    <span />
                    <span />
                  </div>
                  Someone is typing...
                </div>
              )}
            </div>

            <footer className="input-area glass-card">
              <button className="icon-btn secondary"><Paperclip size={20} /></button>
              <form onSubmit={sendMessage}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                />
                <button type="submit" className="send-btn">
                  <Send size={18} />
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Hash size={80} /></div>
            <h2>Select a conversation to start chatting</h2>
            <p>Connect with your team members in real-time</p>
          </div>
        )}
      </main>

      <style jsx="true">{`
        .chat-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          height: 100vh;
          padding: 20px;
          gap: 20px;
        }
        
        /* Sidebar */
        .sidebar {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .user-profile { display: flex; gap: 12px; align-items: center; }
        .user-profile img { width: 45px; height: 45px; border-radius: 12px; background: var(--glass); }
        .user-info h3 { font-size: 1rem; }
        .online-badge { font-size: 0.75rem; color: #10B981; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
        .search-bar {
          margin: 15px 20px;
          position: relative;
          color: var(--text-muted);
        }
        .search-bar input { padding-left: 40px; font-size: 0.9rem; }
        .search-bar svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); }

        .sidebar-content { flex: 1; overflow-y: auto; padding: 0 10px 20px; }
        .section-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin: 20px 10px 10px; }
        
        .user-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 4px;
        }
        .user-item:hover { background: var(--glass); }
        .user-item.active { background: rgba(124, 58, 237, 0.15); border-left: 3px solid var(--primary); }
        .avatar-wrapper { width: 45px; height: 45px; border-radius: 12px; position: relative; }
        .avatar-wrapper img { width: 100%; height: 100%; border-radius: 12px; object-fit: cover; }
        .avatar-wrapper.group { background: var(--glass); display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid var(--bg-dark);
          position: absolute;
          bottom: -2px;
          right: -2px;
        }
        .status-indicator.online { background: #10B981; }
        .item-info { flex: 1; min-width: 0; }
        .item-name { font-weight: 500; font-size: 0.95rem; }
        .item-msg { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .typing-text { color: var(--primary); }

        /* Chat Window */
        .chat-window {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
        }
        .chat-header {
          padding: 15px 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          flex-shrink: 0;
        }
        .chat-info { display: flex; gap: 15px; align-items: center; }
        .chat-info h2 { font-size: 1.1rem; }
        .status-text { font-size: 0.8rem; color: var(--text-muted); }
        
        .message-area {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .scroll-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .message-row { display: flex; gap: 12px; max-width: 75%; }
        .message-row.me { align-self: flex-end; flex-direction: row-reverse; }
        .message-row.them { align-self: flex-start; }
        .msg-avatar { width: 35px; height: 35px; border-radius: 8px; margin-top: 4px; }
        .message-bubble { 
          padding: 12px 16px; 
          border-radius: 18px; 
          position: relative;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .me .message-bubble { 
          background: var(--primary); 
          color: white; 
          border-bottom-right-radius: 4px;
          background: linear-gradient(135deg, var(--primary), #9333EA);
        }
        .them .message-bubble { 
          background: var(--card-bg); 
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border);
        }
        .message-header { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 6px; font-size: 0.75rem; }
        .sender-name { font-weight: 600; color: var(--primary); }
        .msg-time { opacity: 0.7; }
        
        .input-area {
          padding: 15px 20px;
          margin-top: 15px;
          display: flex;
          gap: 15px;
          align-items: center;
          flex-shrink: 0;
        }
        .input-area form { flex: 1; display: flex; gap: 12px; }
        .send-btn { 
          background: var(--primary); 
          width: 45px; 
          height: 45px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border-radius: 12px; 
          flex-shrink: 0;
        }
        
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          text-align: center;
        }
        .empty-icon {
          width: 140px;
          height: 140px;
          background: var(--glass);
          border-radius: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 30px;
          color: var(--primary);
          box-shadow: inset 0 0 20px rgba(124, 58, 237, 0.1);
        }
        
        .icon-btn {
          width: 40px;
          height: 40px;
          background: var(--glass);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          color: var(--text-main);
          transition: 0.2s;
        }
        .icon-btn:hover { background: var(--border); }
        .icon-btn.secondary { color: var(--text-muted); }

        .typing-indicator-bar {
          position: absolute;
          bottom: 0;
          left: 20px;
          font-size: 0.8rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
        }
        .typing-bubbles { display: flex; gap: 3px; }
        .typing-bubbles span {
          width: 6px;
          height: 6px;
          background: var(--primary);
          border-radius: 50%;
          animation: bounce 1s infinite alternate;
        }
        .typing-bubbles span:nth-child(2) { animation-delay: 0.2s; }
        .typing-bubbles span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { from { transform: translateY(0); opacity: 0.4; } to { transform: translateY(-4px); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Chat;
