import React, { createContext, useState, useEffect, useContext } from 'react';
import API_BASE from '../config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Set up user profile if token is present
  useEffect(() => {
    if (token) {
      try {
        // Base64 decode JWT payload to extract user info
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        
        // Check if token has expired
        if (decoded.exp * 1000 < Date.now()) {
          console.warn('[AuthContext] JWT has expired. Logging out.');
          logout();
        } else {
          setUser({
            id: decoded.id,
            email: decoded.email
          });
        }
      } catch (err) {
        console.error('[AuthContext] Failed to decode local token:', err.message);
        logout();
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [token]);

  // Handle Signup
  const signup = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Registration failed');
      }

      // Save token locally
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Handle Login
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Save token locally
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Handle Logout
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Helper to fetch private API endpoints with token headers
  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle token failures or expired statuses
    if (response.status === 401) {
      logout();
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
