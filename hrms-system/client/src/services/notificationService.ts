import { API, Auth } from './api';
import { io, Socket } from 'socket.io-client';

export interface SystemNotification {
  id: string;
  title: string;
  subject?: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category: 'General' | 'HR' | 'Recruitment' | 'Interview' | 'Offer' | 'Joining' | 'Payroll' | 'System' | 'Emergency';
  targetRole?: string;
  targetUserIds?: string[];
  senderName?: string;
  read: boolean;
  pinned?: boolean;
  archived?: boolean;
  status?: 'Draft' | 'Scheduled' | 'Sent' | 'Expired' | 'Cancelled';
  requireAcknowledgement?: boolean;
  acknowledgedBy?: { username: string; readTime: string }[];
  expiryDate?: string;
  scheduledAt?: string;
  allowReplies?: boolean;
  replies?: { id: string; sender: string; text: string; time: string }[];
}

export interface DirectMessage {
  id: string;
  senderUsername: string;
  senderName: string;
  recipientUsername: string;
  recipientName: string;
  text: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  volume: number; // 0 to 1
  desktopToastEnabled: boolean;
  toastDuration: number; // seconds
  showPreview: boolean;
  muteWorkingHours: boolean;
}

class NotificationEngine {
  private listeners: ((notifications: SystemNotification[]) => void)[] = [];
  private dmListeners: ((messages: DirectMessage[]) => void)[] = [];
  private notifications: SystemNotification[] = [];
  private directMessages: DirectMessage[] = [];
  private settings: NotificationSettings = {
    soundEnabled: true,
    volume: 0.8,
    desktopToastEnabled: true,
    toastDuration: 5,
    showPreview: true,
    muteWorkingHours: false
  };
  private socket: Socket | null = null;
  private initialized = false;

  constructor() {
    this.loadSettings();
    this.initSocket();
  }

  private initSocket() {
    if (this.initialized) return;
    
    // @ts-ignore
    const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : undefined;
    this.socket = io(apiBase, {
      autoConnect: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('[NotificationService] Connected to real-time notification socket');
      this.fetchInitialBroadcasts();
    });

    this.socket.on('NEW_BROADCAST', (broadcast: any) => {
      this.handleIncomingBroadcast(broadcast);
    });

    this.socket.on('DELETE_BROADCAST', ({ id }: { id: string }) => {
      this.notifications = this.notifications.filter(n => n.id !== id.toString());
      this.notifyListeners();
    });

    this.initialized = true;
  }

  private async fetchInitialBroadcasts() {
    try {
      const res = await API.getBroadcasts();
      if (res && res.broadcasts) {
        const session = Auth.get();
        const mapped = res.broadcasts.map(this.mapDbBroadcastToNotification);
        
        if (session) {
          this.notifications = mapped.filter((notif: SystemNotification) => {
            return notif.targetRole === 'Everyone' || 
                   notif.targetRole === session.role || 
                   (notif.targetRole === 'HR Team' && (session.role === 'HR' || session.role === 'Admin')) ||
                   (notif.targetRole === 'Store Managers' && session.role === 'Manager') ||
                   (notif.targetRole === 'Admins' && session.role === 'Admin') ||
                   notif.senderName === session.fullName;
          });
        } else {
          this.notifications = mapped;
        }

        this.restoreReadStates();
        this.notifyListeners();
      }
    } catch (e) {
      console.error('[NotificationService] Error fetching initial broadcasts:', e);
    }
  }

  private mapDbBroadcastToNotification = (dbItem: any): SystemNotification => {
    return {
      id: dbItem.id.toString(),
      title: dbItem.title,
      subject: dbItem.subject || '',
      message: dbItem.message,
      timestamp: dbItem.created_at,
      priority: dbItem.priority as any,
      category: dbItem.category as any,
      targetRole: dbItem.target_role,
      senderName: dbItem.sender_name,
      read: false,
      pinned: !!dbItem.pinned,
      status: dbItem.status as any,
      requireAcknowledgement: !!dbItem.require_ack,
    };
  }

  private handleIncomingBroadcast(broadcast: any) {
    const session = Auth.get();
    if (!session) return;

    const notif = this.mapDbBroadcastToNotification(broadcast);
    
    const isTarget = notif.targetRole === 'Everyone' || 
                    notif.targetRole === session.role || 
                    (notif.targetRole === 'HR Team' && (session.role === 'HR' || session.role === 'Admin')) ||
                    (notif.targetRole === 'Store Managers' && session.role === 'Manager') ||
                    (notif.targetRole === 'Admins' && session.role === 'Admin') ||
                    notif.senderName === session.fullName;

    if (isTarget) {
      if (!this.notifications.some(n => n.id === notif.id)) {
        this.notifications = [notif, ...this.notifications];
        this.notifyListeners();
        this.playNotificationSound(notif.priority);
      }
    }
  }

  private loadSettings() {
    try {
      const storedSettings = localStorage.getItem('bsc_enterprise_notification_settings');
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
      }
    } catch (e) {}
  }

  private restoreReadStates() {
    try {
      const readStates = JSON.parse(localStorage.getItem('bsc_enterprise_read_broadcasts') || '{}');
      this.notifications = this.notifications.map(n => ({
        ...n,
        read: !!readStates[n.id]
      }));
    } catch(e) {}
  }

  private persistReadStates() {
    try {
      const readStates = this.notifications.reduce((acc, n) => {
        if (n.read) acc[n.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      localStorage.setItem('bsc_enterprise_read_broadcasts', JSON.stringify(readStates));
    } catch(e) {}
  }

  public saveSettings(newSettings: NotificationSettings) {
    this.settings = newSettings;
    try {
      localStorage.setItem('bsc_enterprise_notification_settings', JSON.stringify(newSettings));
    } catch (e) {}
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public isSoundEnabled(): boolean {
    return !!this.settings.soundEnabled;
  }

  public toggleSound(enable?: boolean): boolean {
    const next = enable !== undefined ? enable : !this.settings.soundEnabled;
    this.saveSettings({ ...this.settings, soundEnabled: next });
    return next;
  }

  public getUnreadCount(): number {
    const session = Auth.get();
    if (!session) return 0;
    
    return this.notifications.filter(n => {
      if (n.read) return false;
      const t = n.targetRole;
      return t === 'Everyone' || t === session.role || 
             (t === 'HR Team' && (session.role === 'HR' || session.role === 'Admin')) ||
             (t === 'Store Managers' && session.role === 'Manager') ||
             (t === 'Admins' && session.role === 'Admin') ||
             n.senderName === session.fullName;
    }).length;
  }

  public getUnreadDirectCount(username?: string): number {
    return this.directMessages.filter(m => !m.read && (!username || m.recipientUsername === username)).length;
  }

  public markAsRead(id: string) {
    let found = false;
    this.notifications = this.notifications.map(n => {
      if (n.id === id) {
        found = true;
        return { ...n, read: true };
      }
      return n;
    });
    if (found) {
      this.persistReadStates();
      this.notifyListeners();
    }
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.persistReadStates();
    this.notifyListeners();
  }

  public acknowledgeNotification(id: string, username: string) {
    this.markAsRead(id);
  }

  public acknowledgeRead(id: string, username: string) {
    this.markAsRead(id);
  }

  public togglePin(id: string) {
    const item = this.notifications.find(n => n.id === id);
    if (item) {
      item.pinned = !item.pinned;
      this.notifyListeners();
    }
  }

  public toggleArchive(id: string) {
    this.markAsRead(id);
  }

  public sendDirectMessage(toUserId: string, recipientName?: string, content?: string, senderId?: string, senderName?: string) {
    return this.sendDM(toUserId, content || recipientName || '');
  }

  public playSound(priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') {
    this.playNotificationSound(priority);
  }

  public async addNotification(data: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) {
    try {
      const payload = {
        title: data.title,
        subject: data.subject,
        message: data.message,
        priority: data.priority,
        category: data.category,
        target_role: data.targetRole,
        sender_name: data.senderName,
        status: data.status,
        require_ack: data.requireAcknowledgement,
        pinned: data.pinned
      };
      await API.createBroadcast(payload);
    } catch(err) {
      console.error('[NotificationService] Add failed', err);
    }
  }

  public async deleteNotification(id: string) {
    try {
      await API.deleteBroadcast(id);
    } catch(err) {
      console.error('[NotificationService] Delete failed', err);
    }
  }

  public getNotifications(): SystemNotification[] {
    return [...this.notifications];
  }

  public subscribe(listener: (notifications: SystemNotification[]) => void) {
    this.listeners.push(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const list = [...this.notifications];
    this.listeners.forEach(l => l(list));
  }

  public subscribeDMs(callback: (dms: DirectMessage[]) => void) {
    this.dmListeners.push(callback);
    callback([...this.directMessages]);
    return () => {
      this.dmListeners = this.dmListeners.filter((cb) => cb !== callback);
    };
  }

  async sendDM(toUserId: string, content: string) {
    // Legacy stub or future implementation
    console.log('Sending DM to', toUserId, content);
  }

  async markDmAsRead(dmId: string | number) {
    // Legacy stub or future implementation
    console.log('Marking DM as read', dmId);
  }

  public playNotificationSound(priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') {
    if (!this.settings.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      let freq1 = 440, freq2 = 880, duration = 0.1;
      
      switch(priority) {
        case 'high': freq1 = 880; freq2 = 1760; duration = 0.15; break;
        case 'critical': freq1 = 1200; freq2 = 2400; duration = 0.3; break;
        case 'low': freq1 = 300; freq2 = 600; duration = 0.05; break;
      }
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.settings.volume * 0.1, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }
}

export const NotificationService = new NotificationEngine();
