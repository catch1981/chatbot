const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class CollaborationService extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.userPermissions = new Map();
    this.sharedWorkspaces = new Map();
    this.conflictResolver = new ConflictResolver();
  }

  // Real-time collaborative 3D editing
  async createCollaborative3DSession(sessionData) {
    const { workspaceId, creatorId, participants = [], permissions = {} } = sessionData;
    
    const session = {
      id: uuidv4(),
      workspaceId,
      creatorId,
      participants: new Set([creatorId, ...participants]),
      permissions: this.setupPermissions(creatorId, participants, permissions),
      sharedState: new Shared3DState(),
      activeCursors: new Map(),
      locks: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.activeSessions.set(session.id, session);
    
    // Initialize shared 3D workspace
    await this.initializeSharedWorkspace(session);
    
    this.emit('sessionCreated', session);
    return session;
  }

  // Handle collaborative 3D model editing
  async process3DEdit(sessionId, editData) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const { userId, operation, objectId, data } = editData;
    
    // Check permissions
    if (!this.hasPermission(userId, sessionId, 'edit')) {
      throw new Error('Insufficient permissions for 3D editing');
    }

    // Check for conflicts
    const conflict = this.conflictResolver.detectConflict(session, operation, objectId);
    if (conflict) {
      return this.resolveEditConflict(sessionId, conflict, editData);
    }

    // Apply edit to shared state
    const result = await session.sharedState.applyEdit(operation, objectId, data);
    
    // Update session activity
    session.lastActivity = new Date();
    
    // Broadcast change to all participants
    this.broadcastToSession(sessionId, '3dEditApplied', {
      sessionId,
      userId,
      operation,
      objectId,
      result,
      timestamp: new Date()
    });

    return result;
  }

  // Real-time cursor tracking and presence
  async updateUserCursor(sessionId, userId, positionData) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const cursor = {
      userId,
      position: positionData,
      color: this.getUserColor(userId),
      lastUpdate: new Date()
    };

    session.activeCursors.set(userId, cursor);
    
    // Broadcast cursor position to other users
    this.broadcastToSession(sessionId, 'cursorUpdate', cursor, [userId]);
  }

  // Voice chat integration with 3D collaboration
  async initiateVoiceCollaboration(sessionId, userId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Create voice room
    const voiceRoom = {
      id: uuidv4(),
      sessionId,
      participants: [userId],
      voiceSettings: {
        pushToTalk: false,
        noiseReduction: true,
        spatialAudio: true
      }
    };

    this.emit('voiceRoomCreated', voiceRoom);
    return voiceRoom;
  }

  // Advanced conflict resolution for concurrent edits
  async resolveEditConflict(sessionId, conflict, editData) {
    const session = this.activeSessions.get(sessionId);
    const { type, participants, operation } = conflict;

    switch (type) {
      case 'object_modification':
        return this.handleObjectConflict(session, conflict, editData);
      
      case 'transform_operation':
        return this.handleTransformConflict(session, conflict, editData);
      
      case 'material_change':
        return this.handleMaterialConflict(session, conflict, editData);
      
      default:
        return this.handleGenericConflict(session, conflict, editData);
    }
  }

  // Create shared 3D workspace
  async initializeSharedWorkspace(session) {
    const workspace = new Shared3DWorkspace({
      id: session.workspaceId,
      objects: new Map(),
      materials: new Map(),
      lights: new Map(),
      cameras: new Map(),
      environment: new SharedEnvironment()
    });

    session.workspace = workspace;
    this.sharedWorkspaces.set(session.workspaceId, workspace);
  }

  // Permission management
  setupPermissions(creatorId, participants, customPermissions = {}) {
    const permissions = new Map();
    
    // Creator has full permissions
    permissions.set(creatorId, {
      edit: true,
      delete: true,
      share: true,
      manage: true,
      invite: true
    });

    // Set participant permissions
    participants.forEach(participantId => {
      permissions.set(participantId, {
        edit: customPermissions.edit ?? true,
        delete: customPermissions.delete ?? false,
        share: customPermissions.share ?? false,
        manage: customPermissions.manage ?? false,
        invite: customPermissions.invite ?? false
      });
    });

    return permissions;
  }

  hasPermission(userId, sessionId, action) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const userPermissions = session.permissions.get(userId);
    return userPermissions && userPermissions[action] === true;
  }

  // Session management
  async endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Clean up resources
    session.sharedState.cleanup();
    session.activeCursors.clear();
    session.locks.clear();

    this.activeSessions.delete(sessionId);
    this.sharedWorkspaces.delete(session.workspaceId);
    
    this.emit('sessionEnded', { sessionId, timestamp: new Date() });
  }

  // Broadcast to session participants
  broadcastToSession(sessionId, event, data, excludeUsers = []) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.participants.forEach(participantId => {
      if (!excludeUsers.includes(participantId)) {
        this.emit(`session_${sessionId}_${event}`, {
          userId: participantId,
          data
        });
      }
    });
  }

  // Get active sessions for user
  getUserSessions(userId) {
    const userSessions = [];
    
    this.activeSessions.forEach((session, sessionId) => {
      if (session.participants.has(userId)) {
        userSessions.push({
          sessionId,
          workspaceId: session.workspaceId,
          participants: Array.from(session.participants),
          lastActivity: session.lastActivity,
          isActive: this.isSessionActive(session)
        });
      }
    });

    return userSessions;
  }
}

// Supporting Classes

class Shared3DState {
  constructor() {
    this.objects = new Map();
    this.materials = new Map();
    this.history = [];
    this.undoStack = [];
  }

  async applyEdit(operation, objectId, data) {
    const operationHistory = {
      id: uuidv4(),
      operation,
      objectId,
      data,
      timestamp: new Date()
    };

    switch (operation) {
      case 'create_object':
        return this.createObject(objectId, data);
      
      case 'update_transform':
        return this.updateTransform(objectId, data);
      
      case 'update_material':
        return this.updateMaterial(objectId, data);
      
      case 'delete_object':
        return this.deleteObject(objectId);
      
      case 'clone_object':
        return this.cloneObject(objectId, data);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  createObject(objectId, objectData) {
    const object = {
      id: objectId,
      type: objectData.type,
      transform: objectData.transform || { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      material: objectData.material || 'default',
      geometry: objectData.geometry,
      metadata: objectData.metadata || {},
      createdAt: new Date()
    };

    this.objects.set(objectId, object);
    return object;
  }

  updateTransform(objectId, transformData) {
    const object = this.objects.get(objectId);
    if (!object) throw new Error('Object not found');

    object.transform = { ...object.transform, ...transformData };
    return object;
  }

  updateMaterial(objectId, materialData) {
    const object = this.objects.get(objectId);
    if (!object) throw new Error('Object not found');

    const materialId = uuidv4();
    const material = {
      id: materialId,
      ...materialData,
      createdAt: new Date()
    };

    this.materials.set(materialId, material);
    object.material = materialId;
    
    return { object, material };
  }

  deleteObject(objectId) {
    const object = this.objects.get(objectId);
    if (!object) throw new Error('Object not found');

    this.objects.delete(objectId);
    return { deleted: objectId };
  }

  cloneObject(objectId, cloneData) {
    const original = this.objects.get(objectId);
    if (!original) throw new Error('Object not found');

    const cloneId = uuidv4();
    const clone = {
      ...original,
      id: cloneId,
      transform: {
        ...original.transform,
        position: [
          original.transform.position[0] + (cloneData.offsetX || 1),
          original.transform.position[1] + (cloneData.offsetY || 0),
          original.transform.position[2] + (cloneData.offsetZ || 0)
        ]
      },
      createdAt: new Date()
    };

    this.objects.set(cloneId, clone);
    return clone;
  }

  cleanup() {
    this.objects.clear();
    this.materials.clear();
    this.history = [];
    this.undoStack = [];
  }
}

class ConflictResolver {
  detectConflict(session, operation, objectId) {
    // Check for active locks
    const activeLock = session.locks.get(objectId);
    if (activeLock && activeLock.userId !== operation.userId) {
      return {
        type: 'object_locked',
        objectId,
        lockedBy: activeLock.userId,
        operation
      };
    }

    // Check for concurrent modifications
    const recentEdits = session.sharedState.history
      .filter(edit => edit.objectId === objectId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    if (recentEdits.length > 1) {
      return {
        type: 'concurrent_modification',
        objectId,
        recentEdits: recentEdits.slice(0, 2),
        operation
      };
    }

    return null;
  }

  async resolveObjectLockConflict(session, conflict, editData) {
    // Implement lock conflict resolution
    // Options: steal lock, queue request, merge operations
    return { resolved: true, strategy: 'queue' };
  }

  async resolveConcurrentModification(session, conflict, editData) {
    // Implement operational transformation or merge strategy
    return { resolved: true, strategy: 'merge' };
  }
}

class Shared3DWorkspace {
  constructor(config) {
    this.id = config.id;
    this.objects = config.objects;
    this.materials = config.materials;
    this.lights = config.lights;
    this.cameras = config.cameras;
    this.environment = config.environment;
  }

  // Serialize workspace for network transmission
  serialize() {
    return {
      id: this.id,
      objects: Array.from(this.objects.values()),
      materials: Array.from(this.materials.values()),
      lights: Array.from(this.lights.values()),
      cameras: Array.from(this.cameras.values()),
      environment: this.environment.serialize()
    };
  }
}

class SharedEnvironment {
  constructor() {
    this.skybox = null;
    this.fog = { type: 'none', color: [0.5, 0.5, 0.5], density: 0.01 };
    this.ambientLight = [0.2, 0.2, 0.2];
    this.backgroundColor = [0.1, 0.1, 0.1];
  }

  serialize() {
    return {
      skybox: this.skybox,
      fog: this.fog,
      ambientLight: this.ambientLight,
      backgroundColor: this.backgroundColor
    };
  }
}

module.exports = CollaborationService;