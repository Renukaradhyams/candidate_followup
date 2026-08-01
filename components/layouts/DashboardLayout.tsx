"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../Sidebar';
import Topbar from '../Topbar';
import ToastContainer from '../Toast';
import { Auth, UserSession } from '../../services/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  rightElement?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  breadcrumbs = [],
  rightElement
}: DashboardLayoutProps) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!Auth.check()) {
      router.replace('/login');
      return;
    }
    setSession(Auth.get());
  }, [router]);

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={rightElement}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
