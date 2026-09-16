"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  StickyNote,
  Bot,
  LogOut,
  Menu,
  X,
  Phone,
  Grid3x3,
  MessageCircle,
  Settings
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, logout, user } = useRole();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const mainItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['Admin', 'Employee', 'Client', 'Intern'] },
    { name: 'Projects', icon: StickyNote, href: '/projects', roles: ['Admin', 'Employee', 'Intern'] },
    { name: 'Clients', icon: Users, href: '/clients', roles: ['Admin', 'Employee'] },
    { name: 'Email Agent', icon: Bot, href: '/email-agent', roles: ['Admin', 'Employee'] },
    { name: 'Calls', icon: Phone, href: '/calls', roles: ['Admin', 'Employee'] },
    { name: 'Services', icon: Menu, href: '/store', roles: ['Client'] },
    { name: 'Messages', icon: MessageCircle, href: '/messages', roles: ['Client', 'Admin', 'Employee'] },
  ];

  const moreItems = [
    { name: 'Services Overview', href: '/admin/services-overview', roles: ['Admin', 'Employee'] },
    { name: 'Request Board', href: '/admin/requests', roles: ['Admin', 'Employee'] },
    { name: 'Interns', href: '/interns', roles: ['Admin', 'Employee'] },
    { name: 'Employees', href: '/employees', roles: ['Admin'] },
    { name: 'Audit', href: '/audit', roles: ['Client', 'Admin', 'Employee'] },
    { name: 'Monitor', href: '/monitor', roles: ['Client'] },
  ];

  const filteredMainItems = mainItems.filter(item => item.roles.includes(role));
  const filteredMoreItems = moreItems.filter(item => item.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      {/* Spacer to prevent content from hiding behind the navbar */}
      <div className="h-28 w-full"></div>

      {/* ═══ LUXURY FLOATING NAV BAR ═══ */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        {/* Main Navbar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 px-6 py-4 bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-full"
        >
          {/* Large Grid Icon Button (Apps Menu) */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="relative p-3.5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-indigo-500/50 transition-all hover:scale-105 group"
          >
            <Grid3x3 className="w-6 h-6" />
            <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
              Apps Menu
            </span>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200/50"></div>

          {/* Menu Items - Show first 3 main items + more */}
          <div className="flex items-center gap-1">
            {filteredMainItems.slice(0, 3).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="relative px-3 py-3 rounded-full flex items-center justify-center transition-all group"
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-indigo-100 rounded-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      "w-5 h-5 relative z-10 transition-colors",
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-2 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* More Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative px-3 py-3 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors group"
            >
              <Menu className="w-5 h-5" />
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-2 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                More
              </span>
            </button>
          </div>
        </motion.div>

        {/* Apps Menu Dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-96 bg-white/90 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl p-6 overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-3 mb-4">
                {filteredMainItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "p-4 rounded-2xl flex flex-col items-center gap-2 transition-all",
                        isActive
                          ? "bg-indigo-100 text-indigo-600 shadow-md"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                      <span className="text-xs font-bold text-center">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
              {filteredMoreItems.length > 0 && (
                <>
                  <div className="border-t border-slate-200/50 py-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 px-1">More Options</p>
                    <div className="space-y-2">
                      {filteredMoreItems.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all font-medium"
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ FLOATING ACTION BUTTONS ═══ */}
      
      {/* Profile Button (Bottom Left) */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="fixed bottom-8 left-8 z-40 w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow-lg hover:shadow-slate-800/50 transition-all cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsUserMenuOpen(!isUserMenuOpen);
          }
        }}
      >
        {user?.name?.charAt(0).toUpperCase() || 'U'}
        
        {/* User Menu Dropdown */}
        <AnimatePresence>
          {isUserMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute bottom-0 left-0 mb-16 w-48 bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-200/50">
                <p className="text-sm font-bold text-slate-800">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500 font-medium">{role}</p>
              </div>
              <div className="py-2">
                <button className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition-colors font-medium">
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium border-t border-slate-200/50"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Chat/Messaging Button (Bottom Right) */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push('/messages')}
        className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg hover:shadow-indigo-500/50 transition-all group border-0 cursor-pointer"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
          Messages
        </span>
      </motion.button>
    </>
  );
}
