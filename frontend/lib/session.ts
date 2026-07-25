/**
 * LingXiMind 灵犀 LingXi — 前端会话管理
 *
 * 管理 B站登录后的 session_id 持久化、用户信息存储、
 * 知识构建任务快照、以及 React Hook 封装。
 */

// ==================== 常量 ====================

const SESSION_KEY = "lingxi_session";
const USER_NAME_KEY = "lingxi_user_name";
const BUILD_TASK_PREFIX = "lingxi_build_task_";

// ==================== 类型 ====================

export interface KnowledgeBuildTaskSnapshot {
  taskId: string;
  status: string;
  message: string;
  progress: number;
  currentStep: string;
  updatedAt: number;
}

// ==================== 底层 Storage 操作 ====================

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // 存储不可用（隐私模式等），静默失败
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ==================== 认证会话 ====================

/**
 * 读取已持久化的认证会话信息
 */
export function readAuthSession(): {
  sessionId: string | null;
  userName: string | null;
} {
  return {
    sessionId: safeGet(SESSION_KEY),
    userName: safeGet(USER_NAME_KEY),
  };
}

/**
 * 写入认证会话到 localStorage
 */
export function setAuthSession(sessionId: string, userName: string): void {
  safeSet(SESSION_KEY, sessionId);
  safeSet(USER_NAME_KEY, userName);
}

/**
 * 清除认证会话（退出登录）
 */
export function clearAuthSession(): void {
  safeRemove(SESSION_KEY);
  safeRemove(USER_NAME_KEY);
  safeRemove("lingxi_remember");
}

/**
 * 判断 sessionId 是否有效（非空非 null）
 */
export function isActiveSession(sessionId: string | null): boolean {
  return !!sessionId;
}

// ==================== React Hook ====================

import { useState, useEffect } from "react";

/**
 * 认证会话 Hook — 在客户端组件中使用
 *
 * 返回 sessionId、userName 和 scopeKey（与 sessionId 相同，用于数据隔离）
 * 监听 storage 事件以支持跨标签页同步
 */
export function useAuthSession(): {
  sessionId: string | null;
  userName: string | null;
  scopeKey: string | null;
} {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // 仅在客户端读取
    const sid = safeGet(SESSION_KEY);
    const name = safeGet(USER_NAME_KEY);
    setSessionId(sid);
    setUserName(name);

    // 监听其他标签页的 storage 变更（跨标签页同步）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) {
        setSessionId(e.newValue);
        setUserName(e.newValue ? safeGet(USER_NAME_KEY) : null);
      }
      if (e.key === USER_NAME_KEY) {
        setUserName(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return {
    sessionId,
    userName,
    scopeKey: sessionId, // scopeKey 与 sessionId 一致，用于后端 session_id 参数
  };
}

// ==================== 知识构建任务持久化 ====================

/**
 * 读取知识构建任务快照
 */
export function readKnowledgeBuildTask(
  sessionId: string
): KnowledgeBuildTaskSnapshot | null {
  if (!sessionId) return null;
  const raw = safeGet(`${BUILD_TASK_PREFIX}${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KnowledgeBuildTaskSnapshot;
  } catch {
    return null;
  }
}

/**
 * 写入知识构建任务快照
 */
export function writeKnowledgeBuildTask(
  sessionId: string,
  snapshot: KnowledgeBuildTaskSnapshot
): void {
  if (!sessionId) return;
  try {
    safeSet(`${BUILD_TASK_PREFIX}${sessionId}`, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}
