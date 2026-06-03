import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Validating session status...</p>
      </div>
    );
  }

  // Redirect to login if user session is not present
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
