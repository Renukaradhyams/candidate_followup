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

  constructor() {
    this.loadFromStorage();
    window.addEventListener('storage', (e) => {
      if (e.key === 'bsc_enterprise_notifications' || e.key === 'bsc_enterprise_direct_messages') {
        this.loadFromStorage();
      }
    });
  }

  private loadFromStorage() {
    try {
      const storedNotifs = localStorage.getItem('bsc_enterprise_notifications');
      if (storedNotifs) {
        this.notifications = JSON.parse(storedNotifs);
      } else {
        this.notifications = [
          {
            id: 'notif-seed-1',
            title: 'Welcome to Enterprise HRMS 2026',
            subject: 'System Upgrade Announcement',
            message: 'Role-based broadcasts, direct messaging, real-time alerts, and read acknowledgements are fully active.',
            timestamp: new Date().toISOString(),
            priority: 'normal',
            category: 'System',
            targetRole: 'Everyone',
            senderName: 'System Admin',
            read: false,
            pinned: true,
            status: 'Sent',
            requireAcknowledgement: true,
            acknowledgedBy: []
          },
          {
            id: 'notif-seed-2',
            title: 'Interview Schedule Reminder',
            subject: 'Pending Scoring Desk',
            message: 'Please review today’s scheduled candidate interviews in the Interview Panel.',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            priority: 'high',
            category: 'Interview',
            targetRole: 'Interview Panel',
            senderName: 'HR Desk',
            read: false,
            status: 'Sent'
          }
        ];
        this.saveNotificationsToStorage();
      }

      const storedDms = localStorage.getItem('bsc_enterprise_direct_messages');
      if (storedDms) {
        this.directMessages = JSON.parse(storedDms);
      }

      const storedSettings = localStorage.getItem('bsc_enterprise_notification_settings');
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
      }
    } catch (e) {}
  }

  private saveNotificationsToStorage() {
    try {
      localStorage.setItem('bsc_enterprise_notifications', JSON.stringify(this.notifications));
    } catch (e) {}
  }

  private saveDmsToStorage() {
    try {
      localStorage.setItem('bsc_enterprise_direct_messages', JSON.stringify(this.directMessages));
    } catch (e) {}
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

  public getNotifications(): SystemNotification[] {
    return [...this.notifications];
  }

  public getDirectMessages(): DirectMessage[] {
    return [...this.directMessages];
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read && !n.archived).length;
  }

  public subscribe(listener: (notifications: SystemNotification[]) => void) {
    this.listeners.push(listener);
    listener(this.getNotifications());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public subscribeDMs(listener: (messages: DirectMessage[]) => void) {
    this.dmListeners.push(listener);
    listener(this.getDirectMessages());
    return () => {
      this.dmListeners = this.dmListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.getNotifications()));
  }

  private notifyDmListeners() {
    this.dmListeners.forEach(l => l(this.getDirectMessages()));
  }

  public addNotification(notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) {
    const newNotif: SystemNotification = {
      ...notification,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      read: false,
      status: notification.status || 'Sent',
      acknowledgedBy: notification.acknowledgedBy || []
    };

    this.notifications.unshift(newNotif);
    this.saveNotificationsToStorage();
    this.notifyListeners();
    this.playSound(newNotif.priority, newNotif.category);
  }

  // Automatic System Event Triggers
  public triggerSystemEvent(type: string, details: string, sender = 'System') {
    this.addNotification({
      title: type,
      subject: 'Automated CRM Event',
      message: details,
      priority: type.toLowerCase().includes('cancelled') || type.toLowerCase().includes('exit') ? 'high' : 'normal',
      category: type.toLowerCase().includes('candidate') ? 'Recruitment' : type.toLowerCase().includes('interview') ? 'Interview' : type.toLowerCase().includes('offer') ? 'Offer' : 'System',
      targetRole: 'Everyone',
      senderName: sender,
      status: 'Sent'
    });
  }

  // Direct Personal Messaging (Text Only)
  public sendDirectMessage(recipientUsername: string, recipientName: string, text: string, senderUsername: string, senderName: string) {
    const newDm: DirectMessage = {
      id: 'dm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      senderUsername,
      senderName,
      recipientUsername,
      recipientName,
      text,
      timestamp: new Date().toISOString(),
      read: false,
      delivered: true
    };

    this.directMessages.unshift(newDm);
    this.saveDmsToStorage();
    this.notifyDmListeners();
    this.playSound('normal', 'General');
  }

  public acknowledgeRead(id: string, username: string) {
    this.notifications = this.notifications.map(n => {
      if (n.id === id) {
        const list = n.acknowledgedBy || [];
        if (!list.some(a => a.username === username)) {
          list.push({ username, readTime: new Date().toISOString() });
        }
        return { ...n, read: true, acknowledgedBy: list };
      }
      return n;
    });
    this.saveNotificationsToStorage();
    this.notifyListeners();
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this.saveNotificationsToStorage();
    this.notifyListeners();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.saveNotificationsToStorage();
    this.notifyListeners();
  }

  public toggleArchive(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, archived: !n.archived } : n);
    this.saveNotificationsToStorage();
    this.notifyListeners();
  }

  public deleteNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveNotificationsToStorage();
    this.notifyListeners();
  }

  public togglePin(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    this.saveNotificationsToStorage();
    this.notifyListeners();
  }

  // Web Audio Synthesizer Tone
  public playSound(priority: 'low' | 'normal' | 'high' | 'critical' = 'normal', category = 'General') {
    if (!this.settings.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      const vol = this.settings.volume || 0.8;

      if (priority === 'critical' || category === 'Emergency') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.setValueAtTime(1046.50, now + 0.12); // C6
        gain.gain.setValueAtTime(0.2 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (priority === 'high') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.15 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.1 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }
}

export const NotificationService = new NotificationEngine();
