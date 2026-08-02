export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'broadcast' | 'candidate' | 'interview' | 'offer' | 'system';
  targetRole?: string;
  read: boolean;
  pinned?: boolean;
}

class NotificationEngine {
  private listeners: ((notifications: SystemNotification[]) => void)[] = [];
  private notifications: SystemNotification[] = [];
  private soundEnabled: boolean = true;

  constructor() {
    this.loadFromStorage();
    // Start interval listener to simulate real-time broadcast sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'bsc_enterprise_notifications') {
        this.loadFromStorage();
      }
    });
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('bsc_enterprise_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      } else {
        // Initial Seed Broadcasts
        this.notifications = [
          {
            id: 'notif-1',
            title: 'Welcome to Enterprise HRMS v2.5',
            message: 'Real-time broadcast notification system and candidate CRM features are live.',
            timestamp: new Date().toISOString(),
            priority: 'normal',
            category: 'broadcast',
            read: false,
            pinned: true
          },
          {
            id: 'notif-2',
            title: 'Interview Schedule Reminder',
            message: 'Please review today’s scheduled interviews in the Interview Panel.',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            priority: 'high',
            category: 'interview',
            read: false
          }
        ];
        this.saveToStorage();
      }
      this.notifyListeners();
    } catch (e) {}
  }

  private saveToStorage() {
    try {
      localStorage.setItem('bsc_enterprise_notifications', JSON.stringify(this.notifications));
    } catch (e) {}
  }

  public getNotifications(): SystemNotification[] {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  public subscribe(listener: (notifications: SystemNotification[]) => void) {
    this.listeners.push(listener);
    listener(this.getNotifications());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.getNotifications()));
  }

  public addNotification(notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) {
    const newNotif: SystemNotification = {
      ...notification,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      read: false
    };

    this.notifications.unshift(newNotif);
    this.saveToStorage();
    this.notifyListeners();
    this.playSound(newNotif.priority);
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this.saveToStorage();
    this.notifyListeners();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.saveToStorage();
    this.notifyListeners();
  }

  public deleteNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveToStorage();
    this.notifyListeners();
  }

  public togglePin(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    this.saveToStorage();
    this.notifyListeners();
  }

  public toggleSound(enable?: boolean) {
    this.soundEnabled = enable !== undefined ? enable : !this.soundEnabled;
    return this.soundEnabled;
  }

  public isSoundEnabled() {
    return this.soundEnabled;
  }

  // Web Audio Synthesizer Chime
  public playSound(type: 'low' | 'normal' | 'high' | 'urgent' = 'normal') {
    if (!this.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'urgent' || type === 'high') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }
}

export const NotificationService = new NotificationEngine();
