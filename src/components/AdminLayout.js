import React, { useState } from 'react';
import { FiHome, FiSearch, FiMusic, FiSettings, FiLogOut, FiChevronDown, FiChevronRight, FiUpload, FiMessageSquare } from 'react-icons/fi';
import './AdminLayout.css';

/**
 * AdminLayout - Main layout wrapper with sidebar navigation
 * Updated with new menu structure: Dashboard, Song Discovery (with sub-items), Manage SOU Database, Settings
 */
function AdminLayout({ children, activePage, onNavigate, onLogout }) {
  const [expandedItems, setExpandedItems] = useState(['discovery']); // Discovery expanded by default

  const menuItems = [
    { 
      id: 'dashboard', 
      icon: <FiHome />, 
      label: 'Dashboard' 
    },
    {
      id: 'conversation',
      icon: <FiMessageSquare />,
      label: 'Studio Chat'
    },
    { 
      id: 'discovery', 
      icon: <FiSearch />, 
      label: 'Song Discovery',
      subItems: [
        { id: 'search-add', label: 'Search & Add Songs' },
        { id: 'bulk-add', label: 'Bulk Add Songs' }
      ]
    },
    { 
      id: 'manage-sou', 
      icon: <FiMusic />, 
      label: 'Manage SOU Database' 
    },
    { 
      id: 'settings', 
      icon: <FiSettings />, 
      label: 'Settings' 
    }
  ];

  const toggleExpand = (itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isActive = (item) => {
    if (item.subItems) {
      // Parent is active if any sub-item is active
      return item.subItems.some(sub => sub.id === activePage);
    }
    return activePage === item.id;
  };

  const isExpanded = (itemId) => expandedItems.includes(itemId);

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>SOU Admin</h2>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <div key={item.id} className="nav-item-wrapper">
              {item.subItems ? (
                // Parent item with sub-items
                <>
                  <button
                    className={`nav-item has-subitems ${isActive(item) ? 'active' : ''}`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-chevron">
                      {isExpanded(item.id) ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                  </button>
                  
                  {isExpanded(item.id) && (
                    <div className="nav-subitems">
                      {item.subItems.map(subItem => (
                        <button
                          key={subItem.id}
                          className={`nav-subitem ${activePage === subItem.id ? 'active' : ''}`}
                          onClick={() => onNavigate(subItem.id)}
                        >
                          {subItem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Regular item without sub-items
                <button
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              )}
            </div>
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
