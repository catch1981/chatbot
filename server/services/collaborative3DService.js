const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class Collaborative3DService extends EventEmitter {
  constructor() {
    super();
    this.activeWorkspaces = new Map();
    this.userCursors = new Map();
    this.operationalTransform = new Map();
    this.collaborationHistory = new Map();
    this.realtimeChannels = new Map();
  }

  // Create collaborative 3D workspace
  async createWorkspace(workspaceData) {
    const { 
      name, 
      creatorId, 
      participants = [], 
      permissions = {},
      initialObjects = [],
      environment = {}
    } = workspaceData;

    const workspaceId = uuidv4();
    
    const workspace = {
      id: workspaceId,
      name: name || `Workspace ${workspaceId.slice(0, 8)}`,
      creatorId,
      participants: new Set([creatorId, ...participants]),
      permissions: this.setupWorkspacePermissions(creatorId, participants, permissions),
      objects: new Map(),
      environment: this.initializeEnvironment(environment),
      camera: {
        position: [0, 0, 5],
        target: [0, 0, 0],
        fov: 60,
        updatedBy: null,
        updatedAt: new Date()
      },
      lights: new Map(),
      materials: new Map(),
      selections: new Map(), // User selections
      locks: new Map(), // Object locks
      history: [], // Undo/redo history
      redoStack: [],
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1,
        totalEdits: 0
      }
    };

    // Initialize with starting objects
    for (const objData of initialObjects) {
      const objId = uuidv4();
      workspace.objects.set(objId, this.create3DObject(objId, objData));
    }

    this.activeWorkspaces.set(workspaceId, workspace);
    this.setupRealtimeChannel(workspaceId);

    // Initialize operational transform
    this.operationalTransform.set(workspaceId, new OperationalTransformEngine());

    this.emit('workspaceCreated', { workspaceId, workspace });
    
    return workspace;
  }

  // Real-time 3D object editing
  async applyEdit(workspaceId, editData) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const { 
      userId, 
      operation, 
      objectId, 
      parameters, 
      timestamp = new Date(),
      clientVersion = 0 
    } = editData;

    // Check permissions
    if (!this.hasEditPermission(userId, workspaceId, operation)) {
      throw new Error('Insufficient permissions for this operation');
    }

    // Check for object locks
    const lockCheck = this.checkObjectLock(objectId, userId, workspace);
    if (!lockCheck.allowed) {
      return this.handleLockedObject(workspaceId, editData, lockCheck);
    }

    try {
      // Apply operational transform for concurrent edits
      const transformEngine = this.operationalTransform.get(workspaceId);
      const transformedEdit = transformEngine.transform(editData, clientVersion);
      
      // Apply the edit
      const result = await this.executeEdit(workspace, transformedEdit);
      
      // Update workspace metadata
      workspace.metadata.totalEdits++;
      workspace.metadata.lastModified = new Date();
      
      // Add to history for undo/redo
      this.addToHistory(workspace, transformedEdit);
      
      // Broadcast to all participants
      this.broadcastEdit(workspaceId, {
        ...transformedEdit,
        result,
        serverTimestamp: new Date(),
        serverVersion: workspace.metadata.version
      });

      // Release object lock if it was temporary
      this.releaseObjectLock(objectId, userId, workspace);

      return result;

    } catch (error) {
      console.error('3D edit error:', error);
      throw error;
    }
  }

  // Advanced 3D object creation with templates
  async createObject(workspaceId, userId, objectData) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    if (!this.hasEditPermission(userId, workspaceId, 'create')) {
      throw new Error('Insufficient permissions to create objects');
    }

    const objectId = uuidv4();
    const object = this.create3DObject(objectId, objectData);

    // Set object properties
    object.createdBy = userId;
    object.createdAt = new Date();
    object.position = objectData.position || [Math.random() * 4 - 2, Math.random() * 2, Math.random() * 4 - 2];
    object.rotation = objectData.rotation || [0, 0, 0];
    object.scale = objectData.scale || [1, 1, 1];
    object.material = this.assignMaterial(objectData.material, workspace);
    
    workspace.objects.set(objectId, object);

    // Broadcast object creation
    this.broadcastToWorkspace(workspaceId, 'objectCreated', {
      objectId,
      object,
      createdBy: userId
    }, userId);

    return object;
  }

  // Collaborative selection management
  async updateSelection(workspaceId, userId, selectionData) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) return;

    const { objectIds, selectionType = 'single' } = selectionData;
    
    // Update user's selection
    workspace.selections.set(userId, {
      objectIds: Array.isArray(objectIds) ? objectIds : [objectIds],
      selectionType,
      updatedAt: new Date()
    });

    // Broadcast selection change
    this.broadcastToWorkspace(workspaceId, 'selectionChanged', {
      userId,
      objectIds,
      selectionType
    }, userId);

    // Auto-select connected objects if in group mode
    if (selectionType === 'group') {
      const connectedObjects = this.findConnectedObjects(workspace, objectIds);
      if (connectedObjects.length > 0) {
        await this.updateSelection(workspaceId, userId, {
          objectIds: connectedObjects,
          selectionType: 'group'
        });
      }
    }
  }

  // Real-time cursor and presence tracking
  async updateCursor(workspaceId, userId, cursorData) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) return;

    const cursor = {
      userId,
      position: cursorData.position || [0, 0, 0],
      rotation: cursorData.rotation || [0, 0, 0],
      color: this.getUserColor(userId),
      tools: cursorData.tools || [],
      isActive: true,
      lastUpdate: new Date()
    };

    this.userCursors.set(`${workspaceId}:${userId}`, cursor);

    // Broadcast cursor position (throttled)
    this.throttledBroadcast(workspaceId, 'cursorUpdate', cursor, 100); // 100ms throttle
  }

  // Advanced 3D transformation operations
  async transformObject(workspaceId, userId, transformData) {
    const { objectId, transform, options = {} } = transformData;
    const workspace = this.activeWorkspaces.get(workspaceId);
    
    if (!workspace) throw new Error('Workspace not found');
    
    const object = workspace.objects.get(objectId);
    if (!object) throw new Error('Object not found');

    // Check if user can modify this object
    if (!this.canUserModifyObject(userId, object, workspace)) {
      throw new Error('Cannot modify this object');
    }

    // Apply transformation constraints
    const constrainedTransform = this.applyTransformConstraints(
      transform, 
      object, 
      options
    );

    // Update object transform
    object.transform = { ...object.transform, ...constrainedTransform };
    object.lastModifiedBy = userId;
    object.lastModifiedAt = new Date();

    // Create transform operation
    const operation = {
      type: 'transform',
      objectId,
      transform: constrainedTransform,
      originalTransform: { ...object.transform },
      options
    };

    return this.applyEdit(workspaceId, {
      userId,
      operation: 'transform',
      objectId,
      parameters: { transform: constrainedTransform, originalTransform: object.transform },
      timestamp: new Date()
    });
  }

  // Real-time voice integration
  async startVoiceSession(workspaceId, userId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const sessionId = uuidv4();
    
    const voiceSession = {
      id: sessionId,
      workspaceId,
      participants: new Set([userId]),
      settings: {
        pushToTalk: false,
        spatialAudio: true,
        noiseReduction: true,
        echoCancellation: true
      },
      active: true,
      createdAt: new Date()
    };

    workspace.voiceSession = voiceSession;
    
    this.emit('voiceSessionStarted', {
      sessionId,
      workspaceId,
      userId
    });

    return voiceSession;
  }

  // Advanced material and texture editing
  async updateMaterial(workspaceId, userId, materialData) {
    const { objectId, materialProperties } = materialData;
    const workspace = this.activeWorkspaces.get(workspaceId);
    
    if (!workspace) throw new Error('Workspace not found');
    
    const object = workspace.objects.get(objectId);
    if (!object) throw new Error('Object not found');

    // Create or update material
    const materialId = object.material.id || uuidv4();
    const material = {
      id: materialId,
      ...materialProperties,
      updatedBy: userId,
      updatedAt: new Date()
    };

    // Add to workspace materials
    workspace.materials.set(materialId, material);
    
    // Update object material reference
    object.material = material;

    // Broadcast material update
    this.broadcastToWorkspace(workspaceId, 'materialUpdated', {
      objectId,
      material,
      updatedBy: userId
    });

    return material;
  }

  // Scene lighting and environment editing
  async updateEnvironment(workspaceId, userId, environmentData) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    // Update environment settings
    workspace.environment = {
      ...workspace.environment,
      ...environmentData,
      updatedBy: userId,
      updatedAt: new Date()
    };

    // Add lighting if specified
    if (environmentData.lights) {
      for (const lightData of environmentData.lights) {
        const lightId = uuidv4();
        const light = {
          id: lightId,
          ...lightData,
          createdBy: userId,
          createdAt: new Date()
        };
        workspace.lights.set(lightId, light);
      }
    }

    // Broadcast environment update
    this.broadcastToWorkspace(workspaceId, 'environmentUpdated', {
      environment: workspace.environment,
      updatedBy: userId
    });

    return workspace.environment;
  }

  // Undo/Redo functionality
  async undo(workspaceId, userId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    if (workspace.history.length === 0) {
      throw new Error('No actions to undo');
    }

    const lastAction = workspace.history.pop();
    
    // Store in redo stack
    workspace.redoStack.push(lastAction);
    
    // Apply inverse operation
    const inverseOperation = this.createInverseOperation(lastAction);
    await this.applyInverseOperation(workspace, inverseOperation);

    // Broadcast undo
    this.broadcastToWorkspace(workspaceId, 'undo', {
      undoneAction: lastAction,
      performedBy: userId
    });

    return inverseOperation;
  }

  async redo(workspaceId, userId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    if (workspace.redoStack.length === 0) {
      throw new Error('No actions to redo');
    }

    const redoAction = workspace.redoStack.pop();
    
    // Store in history
    workspace.history.push(redoAction);
    
    // Re-apply the operation
    await this.applyEdit(workspaceId, {
      userId,
      ...redoAction
    });

    // Broadcast redo
    this.broadcastToWorkspace(workspaceId, 'redo', {
      redoneAction: redoAction,
      performedBy: userId
    });

    return redoAction;
  }

  // Get workspace state for new participants
  async getWorkspaceState(workspaceId, userId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        objects: Array.from(workspace.objects.values()),
        environment: workspace.environment,
        lights: Array.from(workspace.lights.values()),
        materials: Array.from(workspace.materials.values()),
        camera: workspace.camera
      },
      user: {
        id: userId,
        permissions: this.getUserPermissions(userId, workspaceId),
        selection: workspace.selections.get(userId) || null,
        cursor: this.userCursors.get(`${workspaceId}:${userId}`)
      },
      participants: Array.from(workspace.participants).map(participantId => ({
        id: participantId,
        selection: workspace.selections.get(participantId) || null,
        cursor: this.userCursors.get(`${workspaceId}:${participantId}`)
      })),
      history: workspace.history.slice(-10), // Last 10 actions
      metadata: workspace.metadata
    };
  }

  // Helper Methods

  create3DObject(objectId, objectData) {
    return {
      id: objectId,
      type: objectData.type || 'cube',
      geometry: objectData.geometry || this.getDefaultGeometry(objectData.type || 'cube'),
      transform: {
        position: objectData.position || [0, 0, 0],
        rotation: objectData.rotation || [0, 0, 0],
        scale: objectData.scale || [1, 1, 1]
      },
      material: this.createDefaultMaterial(),
      metadata: {
        name: objectData.name || `Object ${objectId.slice(0, 8)}`,
        tags: objectData.tags || [],
        ...objectData.metadata
      },
      createdBy: null,
      createdAt: new Date(),
      lastModifiedBy: null,
      lastModifiedAt: null
    };
  }

  getDefaultGeometry(type) {
    const geometries = {
      cube: { type: 'box', size: [1, 1, 1] },
      sphere: { type: 'sphere', radius: 0.5, segments: 32 },
      cylinder: { type: 'cylinder', radius: 0.5, height: 1, segments: 32 },
      cone: { type: 'cone', radius: 0.5, height: 1, segments: 32 },
      plane: { type: 'plane', size: [1, 1] }
    };
    
    return geometries[type] || geometries.cube;
  }

  createDefaultMaterial() {
    return {
      id: uuidv4(),
      type: 'standard',
      color: [0.7, 0.7, 0.7],
      roughness: 0.5,
      metalness: 0.0,
      opacity: 1.0,
      transparent: false
    };
  }

  setupWorkspacePermissions(creatorId, participants, customPermissions) {
    const permissions = new Map();
    
    // Creator permissions
    permissions.set(creatorId, {
      edit: true,
      delete: true,
      share: true,
      manage: true,
      invite: true,
      voice: true,
      materials: true,
      lighting: true
    });

    // Participant permissions
    participants.forEach(participantId => {
      permissions.set(participantId, {
        edit: customPermissions.edit ?? true,
        delete: customPermissions.delete ?? false,
        share: customPermissions.share ?? false,
        manage: customPermissions.manage ?? false,
        invite: customPermissions.invite ?? false,
        voice: customPermissions.voice ?? true,
        materials: customPermissions.materials ?? true,
        lighting: customPermissions.lighting ?? false
      });
    });

    return permissions;
  }

  hasEditPermission(userId, workspaceId, operation) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) return false;

    const permissions = workspace.permissions.get(userId);
    if (!permissions) return false;

    switch (operation) {
      case 'create': return permissions.edit;
      case 'delete': return permissions.delete;
      case 'transform': return permissions.edit;
      case 'material': return permissions.materials;
      case 'lighting': return permissions.lighting;
      default: return permissions.edit;
    }
  }

  getUserColor(userId) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#10AC84', '#EE5A6F', '#C44569', '#F8B500', '#4B6584'
    ];
    
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }

  // Real-time communication
  setupRealtimeChannel(workspaceId) {
    const channel = new EventEmitter();
    this.realtimeChannels.set(workspaceId, channel);
  }

  broadcastToWorkspace(workspaceId, event, data, excludeUserId = null) {
    const channel = this.realtimeChannels.get(workspaceId);
    if (channel) {
      channel.emit(event, { data, excludeUserId, workspaceId });
    }
  }

  throttledBroadcast(workspaceId, event, data, throttleMs = 100) {
    const key = `${workspaceId}:${event}`;
    
    if (!this.throttleTimers) {
      this.throttleTimers = new Map();
    }
    
    if (this.throttleTimers.has(key)) {
      return; // Already throttled
    }
    
    this.broadcastToWorkspace(workspaceId, event, data);
    
    this.throttleTimers.set(key, setTimeout(() => {
      this.throttleTimers.delete(key);
    }, throttleMs));
  }

  broadcastEdit(workspaceId, editData) {
    this.broadcastToWorkspace(workspaceId, 'editApplied', editData);
  }

  // Object locking for conflict prevention
  checkObjectLock(objectId, userId, workspace) {
    const lock = workspace.locks.get(objectId);
    
    if (!lock) {
      // No lock, allow access
      return { allowed: true };
    }
    
    if (lock.userId === userId) {
      // User owns the lock
      return { allowed: true, lock };
    }
    
    // Object is locked by another user
    return {
      allowed: false,
      lock,
      message: `Object is locked by ${lock.userId}`
    };
  }

  acquireObjectLock(objectId, userId, workspace, lockType = 'edit', duration = 30000) {
    const existingLock = workspace.locks.get(objectId);
    
    if (existingLock && existingLock.userId !== userId) {
      return { success: false, lock: existingLock };
    }
    
    const lock = {
      objectId,
      userId,
      type: lockType,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + duration)
    };
    
    workspace.locks.set(objectId, lock);
    
    // Auto-release lock after duration
    setTimeout(() => {
      if (workspace.locks.get(objectId)?.userId === userId) {
        workspace.locks.delete(objectId);
        this.broadcastToWorkspace(workspace.id, 'lockReleased', { objectId, userId });
      }
    }, duration);
    
    this.broadcastToWorkspace(workspace.id, 'lockAcquired', { objectId, userId, lockType });
    
    return { success: true, lock };
  }

  releaseObjectLock(objectId, userId, workspace) {
    const lock = workspace.locks.get(objectId);
    
    if (lock && lock.userId === userId) {
      workspace.locks.delete(objectId);
      this.broadcastToWorkspace(workspace.id, 'lockReleased', { objectId, userId });
    }
  }

  // Helper methods for operational transform
  addToHistory(workspace, editData) {
    workspace.history.push({
      ...editData,
      timestamp: new Date()
    });
    
    // Keep only last 100 actions
    if (workspace.history.length > 100) {
      workspace.history = workspace.history.slice(-100);
    }
    
    // Clear redo stack when new action is added
    workspace.redoStack = [];
  }

  createInverseOperation(operation) {
    switch (operation.operation) {
      case 'create':
        return { ...operation, operation: 'delete' };
      case 'delete':
        return { ...operation, operation: 'restore' };
      case 'transform':
        return { 
          ...operation, 
          operation: 'transform',
          parameters: { 
            transform: operation.parameters.originalTransform 
          }
        };
      default:
        return operation;
    }
  }

  async applyInverseOperation(workspace, inverseOperation) {
    switch (inverseOperation.operation) {
      case 'delete':
        // Restore deleted object
        workspace.objects.set(inverseOperation.objectId, inverseOperation.parameters.object);
        break;
      case 'restore':
        // Permanently delete (invert of restore)
        workspace.objects.delete(inverseOperation.objectId);
        break;
      case 'transform':
        // Apply inverse transform
        const object = workspace.objects.get(inverseOperation.objectId);
        if (object) {
          object.transform = inverseOperation.parameters.transform;
        }
        break;
    }
  }

  // Utility methods
  findConnectedObjects(workspace, objectIds) {
    const connected = [];
    const objects = Array.from(workspace.objects.values());
    
    for (const object of objects) {
      for (const selectedId of objectIds) {
        if (object.id !== selectedId && this.areObjectsConnected(object, workspace.objects.get(selectedId))) {
          connected.push(object.id);
          break;
        }
      }
    }
    
    return connected;
  }

  areObjectsConnected(obj1, obj2) {
    if (!obj1 || !obj2) return false;
    
    // Simple distance-based connection check
    const pos1 = obj1.transform.position;
    const pos2 = obj2.transform.position;
    const distance = Math.sqrt(
      Math.pow(pos1[0] - pos2[0], 2) +
      Math.pow(pos1[1] - pos2[1], 2) +
      Math.pow(pos1[2] - pos2[2], 2)
    );
    
    return distance < 2.0; // Connected if within 2 units
  }

  applyTransformConstraints(transform, object, options) {
    let constrainedTransform = { ...transform };
    
    if (options.constrainScale) {
      const scale = constrainedTransform.scale || [1, 1, 1];
      const minScale = options.minScale || [0.1, 0.1, 0.1];
      const maxScale = options.maxScale || [10, 10, 10];
      
      constrainedTransform.scale = [
        Math.max(minScale[0], Math.min(maxScale[0], scale[0])),
        Math.max(minScale[1], Math.min(maxScale[1], scale[1])),
        Math.max(minScale[2], Math.min(maxScale[2], scale[2]))
      ];
    }
    
    if (options.snapToGrid) {
      const gridSize = options.gridSize || 0.5;
      
      if (constrainedTransform.position) {
        constrainedTransform.position = constrainedTransform.position.map(pos => 
          Math.round(pos / gridSize) * gridSize
        );
      }
    }
    
    return constrainedTransform;
  }

  canUserModifyObject(userId, object, workspace) {
    const permissions = workspace.permissions.get(userId);
    
    // Creator can always modify
    if (userId === workspace.creatorId) return true;
    
    // Check if user owns the object
    if (object.createdBy === userId) return true;
    
    // Check general edit permissions
    return permissions?.edit || false;
  }

  assignMaterial(materialData, workspace) {
    if (!materialData) return this.createDefaultMaterial();
    
    const materialId = uuidv4();
    return {
      id: materialId,
      ...materialData
    };
  }

  getUserPermissions(userId, workspaceId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) return null;
    
    return workspace.permissions.get(userId) || null;
  }

  // Cleanup methods
  cleanupWorkspace(workspaceId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    if (!workspace) return;
    
    // Clean up all associated data
    this.activeWorkspaces.delete(workspaceId);
    this.operationalTransform.delete(workspaceId);
    this.collaborationHistory.delete(workspaceId);
    
    // Clean up user cursors
    for (const [key, cursor] of this.userCursors.entries()) {
      if (key.startsWith(workspaceId + ':')) {
        this.userCursors.delete(key);
      }
    }
    
    // Clean up realtime channel
    this.realtimeChannels.delete(workspaceId);
    
    console.log(`Cleaned up workspace ${workspaceId}`);
  }

  // Get active workspaces for a user
  getUserWorkspaces(userId) {
    const userWorkspaces = [];
    
    for (const [workspaceId, workspace] of this.activeWorkspaces.entries()) {
      if (workspace.participants.has(userId)) {
        userWorkspaces.push({
          id: workspaceId,
          name: workspace.name,
          lastModified: workspace.metadata.lastModified,
          participantCount: workspace.participants.size,
          objectCount: workspace.objects.size
        });
      }
    }
    
    return userWorkspaces;
  }
}

// Operational Transform Engine for conflict resolution
class OperationalTransformEngine {
  constructor() {
    this.operations = [];
    this.version = 0;
  }

  transform(incomingOp, clientVersion) {
    // Transform incoming operation against operations since client version
    let transformedOp = { ...incomingOp };
    
    for (const existingOp of this.operations.slice(clientVersion)) {
      transformedOp = this.transformOperation(transformedOp, existingOp);
    }
    
    // Add to operations history
    this.operations.push(transformedOp);
    this.version++;
    
    return transformedOp;
  }

  transformOperation(op1, op2) {
    // Simplified operational transform
    // In production, this would be more sophisticated
    
    if (op1.objectId === op2.objectId) {
      // Operations on same object - need conflict resolution
      if (op1.operation === 'transform' && op2.operation === 'transform') {
        // Combine transforms
        return {
          ...op1,
          parameters: {
            transform: this.combineTransforms(op1.parameters.transform, op2.parameters.transform)
          }
        };
      }
    }
    
    return op1;
  }

  combineTransforms(transform1, transform2) {
    return {
      position: [
        (transform1.position?.[0] || 0) + (transform2.position?.[0] || 0),
        (transform1.position?.[1] || 0) + (transform2.position?.[1] || 0),
        (transform1.position?.[2] || 0) + (transform2.position?.[2] || 0)
      ],
      rotation: [
        (transform1.rotation?.[0] || 0) + (transform2.rotation?.[0] || 0),
        (transform1.rotation?.[1] || 0) + (transform2.rotation?.[1] || 0),
        (transform1.rotation?.[2] || 0) + (transform2.rotation?.[2] || 0)
      ],
      scale: [
        (transform1.scale?.[0] || 1) * (transform2.scale?.[0] || 1),
        (transform1.scale?.[1] || 1) * (transform2.scale?.[1] || 1),
        (transform1.scale?.[2] || 1) * (transform2.scale?.[2] || 1)
      ]
    };
  }
}

module.exports = Collaborative3DService;