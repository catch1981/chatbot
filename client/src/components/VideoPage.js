import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { 
  FaVideo, 
  FaVideoSlash, 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaPhone,
  FaPhoneSlash,
  FaUsers,
  FaDesktop,
  FaExpand,
  FaCompress
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const VideoContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background: #1a1a1a;
  position: relative;
`;

const VideoGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: ${props => props.participantCount > 1 ? '1fr 1fr' : '1fr'};
  grid-template-rows: ${props => props.participantCount > 2 ? '1fr 1fr' : '1fr'};
  gap: 10px;
  padding: 20px;
  background: #000;
`;

const VideoWrapper = styled.div`
  position: relative;
  background: #222;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &.local-video {
    border: 2px solid #ff6b6b;
  }
`;

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #333;
`;

const VideoLabel = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.9rem;
  
  &.local {
    background: rgba(255, 107, 107, 0.8);
  }
`;

const ControlsBar = styled.div`
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
`;

const ControlButton = styled(motion.button)`
  background: ${props => props.active ? '#ff6b6b' : 'rgba(255, 255, 255, 0.2)'};
  border: none;
  color: white;
  padding: 15px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  min-width: 60px;
  height: 60px;
  transition: all 0.3s ease;
  
  &:hover {
    background: ${props => props.active ? '#ff5252' : 'rgba(255, 255, 255, 0.3)'};
    transform: scale(1.1);
  }
  
  &.danger {
    background: #f44336;
    
    &:hover {
      background: #d32f2f;
    }
  }
`;

const RoomInfo = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
`;

const RoomId = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 5px;
`;

const RoomDetails = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
`;

const ParticipantsList = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  min-width: 200px;
`;

const ParticipantsTitle = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 10px;
`;

const ParticipantItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 0.9rem;
  
  .status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.isOnline ? '#4CAF50' : '#f44336'};
  }
`;

const CreateRoomButton = styled(motion.button)`
  background: linear-gradient(45deg, #4CAF50, #45a049);
  border: none;
  color: white;
  padding: 15px 30px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 20px;
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const JoinRoomSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
`;

const RoomInput = styled.input`
  padding: 15px 20px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 1rem;
  outline: none;
  min-width: 300px;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const VideoPage = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  
  const [roomId, setRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  
  const localVideoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const screenShareRef = useRef(null);

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Initialize local media
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      setError('Failed to access camera/microphone');
      throw error;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((participantId) => {
    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    
    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => new Map(prev.set(participantId, remoteStream)));
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          roomId: currentRoom,
          candidate: event.candidate
        });
      }
    };
    
    peerConnections.current.set(participantId, peerConnection);
    return peerConnection;
  }, [localStream, socket, currentRoom]);

  // Create room
  const createRoom = async () => {
    try {
      const response = await axios.post('/api/video/create-room');
      setRoomId(response.data.roomId);
      setCurrentRoom(response.data.roomId);
      
      await initializeLocalStream();
      
      // Join the room via socket
      socket.emit('join_video_room', response.data.roomId);
      
      toast.success('Video room created successfully!');
    } catch (error) {
      console.error('Failed to create room:', error);
      setError('Failed to create video room');
    }
  };

  // Join room
  const joinRoom = async () => {
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    try {
      // Verify room exists
      await axios.get(`/api/video/room/${roomId}`);
      
      await initializeLocalStream();
      
      setCurrentRoom(roomId);
      socket.emit('join_video_room', roomId);
      
      toast.success('Joined video room successfully!');
    } catch (error) {
      console.error('Failed to join room:', error);
      setError('Failed to join video room. Please check the room ID.');
    }
  };

  // Leave room
  const leaveRoom = () => {
    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Stop screen share
    if (screenShareRef.current) {
      screenShareRef.current.getTracks().forEach(track => track.stop());
      setIsScreenSharing(false);
    }
    
    // Leave socket room
    if (currentRoom) {
      socket.emit('leave_video_room', currentRoom);
    }
    
    // Reset state
    setLocalStream(null);
    setRemoteStreams(new Map());
    setCurrentRoom(null);
    setParticipants([]);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenShareRef.current) {
        screenShareRef.current.getTracks().forEach(track => track.stop());
        setIsScreenSharing(false);
      }
      
      // Re-enable camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        // Replace video track in all peer connections
        const videoTrack = stream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Update local stream
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Failed to enable camera:', error);
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenShareRef.current = screenStream;
        setIsScreenSharing(true);
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Update local stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        // Handle screen share end
        videoTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error('Failed to start screen sharing:', error);
        toast.error('Failed to start screen sharing');
      }
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (socket && isConnected && currentRoom) {
      const handleUserJoined = (data) => {
        console.log('User joined:', data);
        setParticipants(prev => [...prev, data.socketId]);
      };

      const handleUserLeft = (data) => {
        console.log('User left:', data);
        setParticipants(prev => prev.filter(id => id !== data.socketId));
        
        // Close peer connection
        const pc = peerConnections.current.get(data.socketId);
        if (pc) {
          pc.close();
          peerConnections.current.delete(data.socketId);
        }
        
        // Remove remote stream
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(data.socketId);
          return newStreams;
        });
      };

      const handleOffer = async (data) => {
        const peerConnection = createPeerConnection(data.from);
        
        try {
          await peerConnection.setRemoteDescription(data.offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          socket.emit('answer', {
            roomId: currentRoom,
            answer: answer,
            to: data.from
          });
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      };

      const handleAnswer = async (data) => {
        const peerConnection = peerConnections.current.get(data.from);
        if (peerConnection) {
          try {
            await peerConnection.setRemoteDescription(data.answer);
          } catch (error) {
            console.error('Error handling answer:', error);
          }
        }
      };

      const handleIceCandidate = async (data) => {
        const peerConnection = peerConnections.current.get(data.from);
        if (peerConnection) {
          try {
            await peerConnection.addIceCandidate(data.candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      };

      socket.on('user_joined_video', handleUserJoined);
      socket.on('user_left_video', handleUserLeft);
      socket.on('offer', handleOffer);
      socket.on('answer', handleAnswer);
      socket.on('ice-candidate', handleIceCandidate);

      return () => {
        socket.off('user_joined_video', handleUserJoined);
        socket.off('user_left_video', handleUserLeft);
        socket.off('offer', handleOffer);
        socket.off('answer', handleAnswer);
        socket.off('ice-candidate', handleIceCandidate);
      };
    }
  }, [socket, isConnected, currentRoom, createPeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  if (!currentRoom) {
    return (
      <VideoContainer>
        <JoinRoomSection>
          {error && (
            <div style={{ 
              background: 'rgba(244, 67, 54, 0.2)', 
              border: '1px solid #f44336', 
              color: '#f44336', 
              padding: '10px 20px', 
              borderRadius: '5px' 
            }}>
              {error}
            </div>
          )}
          
          <CreateRoomButton
            onClick={createRoom}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FaVideo style={{ marginRight: '10px' }} />
            Create New Room
          </CreateRoomButton>
          
          <div style={{ color: 'white', fontSize: '1.1rem' }}>OR</div>
          
          <RoomInput
            type="text"
            placeholder="Enter Room ID to Join"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
          />
          
          <ControlButton
            onClick={joinRoom}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaUsers />
            Join Room
          </ControlButton>
        </JoinRoomSection>
      </VideoContainer>
    );
  }

  return (
    <VideoContainer>
      <RoomInfo>
        <RoomId>Room ID:</RoomId>
        <RoomDetails>{currentRoom}</RoomDetails>
      </RoomInfo>

      <ParticipantsList>
        <ParticipantsTitle>Participants ({participants.length + 1})</ParticipantsTitle>
        <ParticipantItem isOnline={true}>
          <div className="status" />
          You (Host)
        </ParticipantItem>
        {participants.map(participantId => (
          <ParticipantItem key={participantId} isOnline={true}>
            <div className="status" />
            User {participantId.slice(-4)}
          </ParticipantItem>
        ))}
      </ParticipantsList>

      <VideoGrid participantCount={participants.length + 1}>
        <VideoWrapper className="local-video">
          <VideoElement
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
          />
          <VideoLabel className="local">You</VideoLabel>
        </VideoWrapper>
        
        {Array.from(remoteStreams.entries()).map(([participantId, stream]) => (
          <VideoWrapper key={participantId}>
            <VideoElement
              autoPlay
              playsInline
              ref={el => {
                if (el && stream) {
                  el.srcObject = stream;
                }
              }}
            />
            <VideoLabel>User {participantId.slice(-4)}</VideoLabel>
          </VideoWrapper>
        ))}
      </VideoGrid>

      <ControlsBar>
        <ControlButton
          onClick={toggleVideo}
          active={isVideoEnabled}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
        </ControlButton>

        <ControlButton
          onClick={toggleAudio}
          active={isAudioEnabled}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </ControlButton>

        <ControlButton
          onClick={toggleScreenShare}
          active={isScreenSharing}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <FaDesktop />
        </ControlButton>

        <ControlButton
          onClick={leaveRoom}
          className="danger"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <FaPhoneSlash />
        </ControlButton>
      </ControlsBar>
    </VideoContainer>
  );
};

export default VideoPage;