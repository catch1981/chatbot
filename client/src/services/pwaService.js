import { toast } from 'react-hot-toast';

class PWAService {
  constructor() {
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.deferredPrompt = null;
    this.updateAvailable = false;
    this.swRegistration = null;
    
    this.setupEventListeners();
  }

  // Initialize PWA functionality
  async init() {
    try {
      // Register service worker
      await this.registerServiceWorker();
      
      // Setup PWA install prompt
      this.setupInstallPrompt();
      
      // Setup online/offline detection
      this.setupNetworkStatus();
      
      // Setup push notifications
      await this.setupPushNotifications();
      
      console.log('PWA Service initialized successfully');
    } catch (error) {
      console.error('PWA Service initialization failed:', error);
    }
  }

  // Register service worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        this.swRegistration = registration;
        console.log('Service Worker registered successfully');

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.handleServiceWorkerUpdate();
            }
          });
        });

        // Handle service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Setup install prompt
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      toast.success('App installed successfully!');
      console.log('PWA was installed');
    });
  }

  // Show install prompt
  showInstallPrompt() {
    if (this.deferredPrompt) {
      const shouldShow = localStorage.getItem('pwa-install-dismissed') !== 'true';
      
      if (shouldShow) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <img className="h-8 w-8 rounded" src="/icons/icon-192x192.png" alt="AI Chatbot" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Install AI Chatbot
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Get the full app experience with offline support and notifications
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <div className="flex flex-col">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    this.installApp();
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Install
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    this.dismissInstallPrompt();
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        ), {
          duration: 10000,
          position: 'bottom-right'
        });
      }
    }
  }

  // Install the app
  async installApp() {
    if (!this.deferredPrompt) return false;

    try {
      const result = await this.deferredPrompt.prompt();
      const outcome = await result.userChoice;
      
      console.log('Install prompt result:', outcome);
      
      this.deferredPrompt = null;
      return outcome.outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  // Dismiss install prompt
  dismissInstallPrompt() {
    localStorage.setItem('pwa-install-dismissed', 'true');
    // Reset after 24 hours
    setTimeout(() => {
      localStorage.removeItem('pwa-install-dismissed');
    }, 24 * 60 * 60 * 1000);
  }

  // Setup network status monitoring
  setupNetworkStatus() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleConnectionChange(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleConnectionChange(false);
    });
  }

  // Handle connection change
  handleConnectionChange(isOnline) {
    if (isOnline) {
      toast.success('Connection restored', { icon: '🟢' });
      this.syncOfflineData();
    } else {
      toast.error('You\'re offline. Some features may be limited.', { icon: '🔴' });
    }

    // Notify other parts of the app
    window.dispatchEvent(new CustomEvent('pwa:connectionchange', {
      detail: { isOnline }
    }));
  }

  // Setup push notifications
  async setupPushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('Push notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Register for push notifications
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      console.log('Push notifications enabled');
    }
  }

  // Convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Send subscription to server
  async sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(subscription)
      });

      if (response.ok) {
        console.log('Push subscription sent to server');
      }
    } catch (error) {
      console.error('Failed to send push subscription:', error);
    }
  }

  // Show notification
  async showNotification(title, options = {}) {
    if (Notification.permission === 'granted' && this.swRegistration) {
      const notificationOptions = {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: '2'
        },
        actions: [
          {
            action: 'open',
            title: 'Open App',
            icon: '/icons/open-action.png'
          },
          {
            action: 'close',
            title: 'Close',
            icon: '/icons/close-action.png'
          }
        ],
        ...options
      };

      await this.swRegistration.showNotification(title, notificationOptions);
    }
  }

  // Handle service worker messages
  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'MESSAGE_SYNCED':
        this.handleMessageSynced(data.messageId);
        break;
      case '3D_REQUEST_SYNCED':
        this.handle3DRequestSynced(data.requestId);
        break;
      case 'CACHE_UPDATED':
        this.handleCacheUpdated(data);
        break;
      case 'OFFLINE_MODE':
        this.handleOfflineMode(data.isOffline);
        break;
    }
  }

  // Handle message sync
  handleMessageSynced(messageId) {
    toast.success('Message sent successfully!');
    window.dispatchEvent(new CustomEvent('pwa:messageSynced', { detail: { messageId } }));
  }

  // Handle 3D request sync
  handle3DRequestSynced(requestId) {
    toast.success('3D model generation started!');
    window.dispatchEvent(new CustomEvent('pwa:3DRequestSynced', { detail: { requestId } }));
  }

  // Handle cache update
  handleCacheUpdated(data) {
    console.log('Cache updated:', data);
    window.dispatchEvent(new CustomEvent('pwa:cacheUpdated', { detail: data }));
  }

  // Handle offline mode
  handleOfflineMode(isOffline) {
    this.isOnline = !isOffline;
    window.dispatchEvent(new CustomEvent('pwa:offlineMode', { detail: { isOffline } }));
  }

  // Handle service worker update
  handleServiceWorkerUpdate() {
    this.updateAvailable = true;
    
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-blue-600 text-white shadow-lg rounded-lg pointer-events-auto flex`}>
        <div className="flex-1 w-0 p-4">
          <p className="text-sm font-medium">
            New version available
          </p>
          <p className="mt-1 text-sm opacity-90">
            Refresh to get the latest features
          </p>
        </div>
        <div className="flex">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              this.updateApp();
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Update
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'top-center'
    });
  }

  // Update app
  updateApp() {
    if (this.swRegistration && this.swRegistration.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page
      window.location.reload();
    }
  }

  // Sync offline data
  async syncOfflineData() {
    try {
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        
        // Register sync for messages
        await registration.sync.register('background-sync-messages');
        
        // Register sync for 3D requests
        await registration.sync.register('background-sync-3d');
      }
    } catch (error) {
      console.error('Failed to register background sync:', error);
    }
  }

  // Cache data for offline use
  async cacheData(key, data) {
    if ('serviceWorker' in navigator) {
      const message = {
        type: 'CACHE_DATA',
        key,
        data
      };
      
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage(message);
    }
  }

  // Get cached data
  async getCachedData(key) {
    return new Promise((resolve) => {
      const message = {
        type: 'GET_CACHED_DATA',
        key
      };
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          const messageChannel = new MessageChannel();
          
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data[key] || null);
          };
          
          registration.active?.postMessage(message, [messageChannel.port2]);
        });
      } else {
        resolve(null);
      }
    });
  }

  // Store data offline
  async storeOfflineData(type, data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AIChatbotDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([type], 'readwrite');
        const store = transaction.objectStore(type);
        
        const storeRequest = store.put({
          id: Date.now().toString(),
          data,
          timestamp: Date.now()
        });
        
        storeRequest.onsuccess = () => resolve();
        storeRequest.onerror = () => reject(storeRequest.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(type)) {
          db.createObjectStore(type, { keyPath: 'id' });
        }
      };
    });
  }

  // Get offline data
  async getOfflineData(type) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AIChatbotDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([type], 'readonly');
        const store = transaction.objectStore(type);
        
        const getRequest = store.getAll();
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  // Clear offline data
  async clearOfflineData(type) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AIChatbotDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([type], 'readwrite');
        const store = transaction.objectStore(type);
        
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      };
    });
  }

  // Get app size
  async getAppSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage,
          available: estimate.quota,
          percentage: (estimate.usage / estimate.quota) * 100
        };
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
      }
    }
    return null;
  }

  // Check if running as PWA
  isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
  }

  // Get installation status
  getInstallationStatus() {
    return {
      isInstalled: this.isInstalled,
      canInstall: !!this.deferredPrompt,
      isPWA: this.isPWA()
    };
  }

  // Setup event listeners
  setupEventListeners() {
    // Handle visibility change for background sync
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.swRegistration) {
        this.swRegistration.update();
      }
    });

    // Handle beforeunload for cleanup
    window.addEventListener('beforeunload', () => {
      if (this.swRegistration) {
        this.swRegistration.update();
      }
    });
  }

  // Get network information
  getNetworkInfo() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }
    return null;
  }

  // Request persistent storage
  async requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersistent = await navigator.storage.persist();
        console.log('Persistent storage:', isPersistent);
        return isPersistent;
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
      }
    }
    return false;
  }
}

// Create singleton instance
const pwaService = new PWAService();
export default pwaService;