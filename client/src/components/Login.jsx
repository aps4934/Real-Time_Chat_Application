import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, UserCircle, Key } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('All fields are required');
      setLoading(false);
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const endpoint = isLogin ? '/api/login' : '/api/register';
    try {
      const res = await axios.post(`http://localhost:3001${endpoint}`, { username, password });
      login(res.data.user, res.data.token);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card auth-card"
      >
        <div className="auth-header">
          <div className="logo-badge">
            <LogIn size={40} className="logo-icon" />
          </div>
          <h1>NexusChat</h1>
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Sign in to continue your conversations' : 'Join our secure real-time network'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <UserCircle className="input-icon" size={20} />
            <input 
              type="text" 
              placeholder="Username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required
            />
          </div>
          <div className="input-group">
            <Key className="input-icon" size={20} />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>
          
          {error && <div className="error-msg">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
          </button>
        </form>

        <div className="auth-footer">
          <button className="text-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </motion.div>

      <style jsx="true">{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          padding: 40px;
          text-align: center;
        }
        .auth-header { margin-bottom: 30px; }
        .logo-badge {
          background: linear-gradient(135deg, var(--primary), #EC4899);
          width: 80px;
          height: 80px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 10px 25px rgba(124, 58, 237, 0.4);
        }
        .logo-icon { color: white; }
        .auth-header h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 10px; background: linear-gradient(135deg, white, #A855F7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .auth-header h2 { font-size: 1.4rem; margin-bottom: 8px; font-weight: 500; }
        .auth-header p { color: var(--text-muted); font-size: 0.95rem; }
        .auth-form { display: flex; flex-direction: column; gap: 20px; }
        .input-group { position: relative; }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .input-group input { padding-left: 45px; }
        .error-msg { color: #f87171; font-size: 0.9rem; text-align: left; }
        .auth-card button[type="submit"] {
          padding: 14px;
          font-size: 1rem;
          margin-top: 10px;
        }
        .auth-footer { margin-top: 25px; }
        .text-btn {
          background: none;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .text-btn:hover {
          color: var(--primary);
          transform: none;
        }
      `}</style>
    </div>
  );
};

export default Login;
