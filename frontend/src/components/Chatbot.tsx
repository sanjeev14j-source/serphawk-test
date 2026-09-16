"use client";

import { useState } from 'react';
import { MessageSquare, X, Users, UserPlus, Mail, ChevronRight, Send, ShoppingBag, MessageCircle, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  response: string;
  route: string;
}

const ADMIN_ACTIONS: QuickAction[] = [
  {
    label: 'View Customer',
    icon: <Users className="w-4 h-4 text-blue-500" />,
    response: 'Taking you to the clients list. You can select a customer to view their details.',
    route: '/clients',
  },
  {
    label: 'Add Customer',
    icon: <UserPlus className="w-4 h-4 text-green-500" />,
    response: 'Navigating to the clients page where you can add a new customer.',
    route: '/clients?action=add',
  },
  {
    label: 'Send Email',
    icon: <Mail className="w-4 h-4 text-purple-500" />,
    response: 'Opening the Email Agent to generate and send a new email.',
    route: '/email-agent',
  },
];

const CLIENT_ACTIONS: QuickAction[] = [
  {
    label: 'View Services',
    icon: <ShoppingBag className="w-4 h-4 text-amber-500" />,
    response: 'Taking you to the services store where you can browse available services.',
    route: '/store',
  },
  {
    label: 'My Messages',
    icon: <MessageCircle className="w-4 h-4 text-blue-500" />,
    response: 'Opening your messages inbox.',
    route: '/messages',
  },
  {
    label: 'Settings',
    icon: <Settings className="w-4 h-4 text-gray-500" />,
    response: 'Navigating to your account settings.',
    route: '/setup',
  },
];

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user', text: string }[]>([
    { role: 'bot', text: 'Hi! I am the SERP Hawk Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const router = useRouter();
  const { role } = useRole();

  const isClient = role === 'Client';
  const quickActions = isClient ? CLIENT_ACTIONS : ADMIN_ACTIONS;

  const handleCommand = (label: string) => {
    setMessages(prev => [...prev, { role: 'user', text: label }]);

    setTimeout(() => {
      const action = quickActions.find(a => a.label === label);
      const botResponse = action
        ? action.response
        : 'I can help you with specific tasks. Try clicking one of the quick actions below!';

      if (action) router.push(action.route);
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleCommand(input);
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 lg:w-96 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5" style={{ height: '520px' }}>
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="font-bold">SERP Hawk Assistant</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-blue-100 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-t border-gray-100 bg-white space-y-2 shrink-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Quick Actions</p>
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleCommand(action.label)}
                className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-sm text-gray-700 transition-colors border border-transparent hover:border-slate-200"
              >
                <span className="flex items-center gap-2">{action.icon} {action.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-gray-100 text-gray-500 p-2 rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit"
              disabled={!input.trim()}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center group"
        >
          <MessageSquare className="w-6 h-6 group-hover:animate-pulse" />
        </button>
      )}
    </div>
  );
}
