/**
 * AI Assistant Panel Component
 * Chat interface with AI assistant for compliance help
 */

import React, { useState, useRef, useEffect } from 'react';
import { XIcon, SmileIcon, SendIcon, UserIcon, SearchIcon, ZapIcon } from '../ui/Icons';
import { ChatMessage, QuickAction } from '../../types';
import './AIAssistant.css';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI compliance assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const quickActions: QuickAction[] = [
    { id: '1', label: 'Explain last scan', icon: 'search', prompt: 'Can you explain the results of the last scan?' },
    { id: '2', label: 'Fix critical issues', icon: 'zap', prompt: 'How do I fix the critical issues?' },
    { id: '3', label: 'Best practices', icon: 'shield', prompt: 'What are the best compliance practices?' },
  ];

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I understand your question. Based on your recent scans, here are some recommendations...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`ai-assistant-panel ${isOpen ? 'open' : ''}`}>
      <div className="ai-assistant-header">
        <div className="ai-assistant-title-group">
          <div className="ai-assistant-avatar">
            <SmileIcon size={24} />
            <div className="ai-status-indicator" />
          </div>
          <div>
            <div className="ai-assistant-title">AI Assistant</div>
            <div className="ai-assistant-subtitle">Always here to help</div>
          </div>
        </div>
        <button className="ai-close-btn" onClick={onClose}>
          <XIcon size={18} />
        </button>
      </div>

      <div className="ai-quick-actions">
        <div className="ai-quick-actions-label">Quick Actions</div>
        <div className="ai-quick-buttons">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className="ai-quick-btn"
              onClick={() => handleQuickAction(action.prompt)}
            >
              {action.icon === 'search' && <SearchIcon size={14} />}
              {action.icon === 'zap' && <ZapIcon size={14} />}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-chat-container" ref={chatContainerRef}>
        {messages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role}`}>
            <div className="ai-message-avatar">
              {message.role === 'assistant' ? <SmileIcon size={16} /> : <UserIcon size={16} />}
            </div>
            <div className="ai-message-content">{message.content}</div>
          </div>
        ))}
        {isTyping && (
          <div className="ai-typing-indicator">
            <div className="ai-message-avatar">
              <SmileIcon size={16} />
            </div>
            <div className="ai-typing-dots">
              <div className="ai-typing-dot" />
              <div className="ai-typing-dot" />
              <div className="ai-typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="ai-input-container">
        <div className="ai-input-wrapper">
          <input
            type="text"
            className="ai-input"
            placeholder="Ask me anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button
            className="ai-send-btn"
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
          >
            <SendIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
