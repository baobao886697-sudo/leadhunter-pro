/**
 * WebSocket 全局 Context
 * 
 * 将WebSocket连接提升为全局状态，所有页面组件都可以通过
 * useWebSocketContext() 访问WebSocket的订阅和连接状态。
 */

import React, { createContext, useContext } from "react";
import { useWebSocket, type WsMessage } from "@/hooks/useWebSocket";

// ==================== 类型定义 ====================

interface WebSocketContextType {
  /** WebSocket是否已连接 */
  isConnected: boolean;
  /** 订阅特定类型的消息，返回取消订阅函数 */
  subscribe: (type: string, handler: (message: WsMessage) => void) => (() => void);
  /** 手动断开连接 */
  disconnect: () => void;
  /** 手动重连 */
  reconnect: () => void;
}

// ==================== Context ====================

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// ==================== Provider ====================

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket();

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ==================== Hook ====================

/**
 * 获取WebSocket Context
 * 如果在WebSocketProvider外部使用，返回一个安全的空操作对象
 * 这保证了即使WebSocket未初始化，组件也不会崩溃
 */
export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  
  // 安全降级：如果不在Provider内，返回空操作
  if (!context) {
    return {
      isConnected: false,
      subscribe: () => () => {},
      disconnect: () => {},
      reconnect: () => {},
    };
  }

  return context;
}
