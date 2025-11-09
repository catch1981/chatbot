import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FaComments, FaVideo, FaUser, FaSignOutAlt, FaCircle } from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Nav = styled.nav`
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Logo = styled(Link)`
  color: white;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
  
  &:hover {
    color: #ff6b6b;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const NavLink = styled(Link)`
  color: ${props => props.$active ? '#ff6b6b' : 'rgba(255, 255, 255, 0.8)'};
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  border-radius: 8px;
  transition: all 0.3s ease;
  position: relative;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ff6b6b;
  }
  
  &.active {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  color: white;
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  color: ${props => props.$connected ? '#4CAF50' : '#f44336'};
`;

const StatusDot = styled(FaCircle)`
  font-size: 0.7rem;
`;

const UserMenu = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
`;

const UserAvatar = styled.div`
  width: 35px;
  height: 35px;
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.9rem;
`;

const LogoutButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const getInitial = (username) => {
    return username ? username.charAt(0).toUpperCase() : 'U';
  };

  return (
    <Nav>
      <Logo to="/chat">
        <FaComments />
        ChatBot Pro
      </Logo>

      <NavLinks>
        <NavLink 
          to="/chat" 
          $active={location.pathname === '/chat'}
          className={location.pathname === '/chat' ? 'active' : ''}
        >
          <FaComments />
          Chat
        </NavLink>
        
        <NavLink 
          to="/video" 
          $active={location.pathname === '/video'}
          className={location.pathname === '/video' ? 'active' : ''}
        >
          <FaVideo />
          Video
        </NavLink>
      </NavLinks>

      <UserInfo>
        <ConnectionStatus $connected={isConnected}>
          <StatusDot />
          {isConnected ? 'Connected' : 'Disconnected'}
        </ConnectionStatus>
        
        <UserMenu>
          <UserAvatar>
            {getInitial(user?.username)}
          </UserAvatar>
          <span style={{ fontSize: '0.9rem' }}>{user?.username}</span>
          <LogoutButton
            onClick={handleLogout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaSignOutAlt />
            Logout
          </LogoutButton>
        </UserMenu>
      </UserInfo>
    </Nav>
  );
};

export default Navbar;