import React from 'react';
import { FiHome, FiSearch, FiTrendingUp, FiStar, FiMusic, FiUpload, FiSettings, FiLogOut } from 'react-icons/fi';
import './AdminLayout.css';

/**
 * AdminLayout - Main layout wrapper with sidebar navigation
 */
function AdminLayout({ children, activePage, onNavigate, onLogout }) {
  const menuItems = [
    { id: 'dashboard', icon: <FiHome />, label: 'Dashboard', path: 'dashboard' },
    { id: 'search', icon: <FiSearch />, label: 'Search Database', path: 'search' },
    { id: 'charts', icon: <FiTrendingUp />, label: 'Chart Lookup', path: 'charts' },
    { id: 'popularity', icon: <FiStar />, label: 'Popularity Catalog', path: 'popularity' },
    { id: 'songs', icon: <FiMusic />, label: 'Manage Songs', path: 'songs' },
    { id: 'bulk', icon: <FiUpload />, label: 'Bulk Import', path: 'bulk' },
    { id: 'settings', icon: <FiSettings />, label: 'Settings', path: 'settings' }
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>SOU Admin</h2>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <span className="nav-icon"><FiLogOut /></span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
