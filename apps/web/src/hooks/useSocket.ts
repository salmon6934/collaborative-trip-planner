'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, destroySocket } from '../lib/socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseSocketOptions {
  tripId: string;
  token: string | undefined;
  onReconnect?: () => void;
}

/**
 * Manages Socket.io connection lifecycle with auto-reconnect using exponential backoff.
 * Backoff starts at 1s, doubles each attempt, capped at 30s.
 * Joins the trip room after connecting and triggers onReconnect callback after reconnection.
 */
export function useSocket({ tripId, token, onReconnect }: UseSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(1000);
  const isReconnectRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);

  // Keep onReconnect ref in sync without re-triggering effect
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    clearReconnectTimer();
    setStatus('reconnecting');

    reconnectTimerRef.current = setTimeout(() => {
      const sock = socketRef.current;
      if (sock && !sock.connected) {
        sock.connect();
      }
      // Double the delay for next attempt, cap at 30s
      delayRef.current = Math.min(delayRef.current * 2, 30000);
    }, delayRef.current);
  }, [clearReconnectTimer]);

  useEffect(() => {
    if (!token || !tripId) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    function handleConnect() {
      setStatus('connected');
      delayRef.current = 1000; // Reset backoff on successful connection
      clearReconnectTimer();

      // Join the trip room
      socket.emit('join:trip', tripId);

      // If this was a reconnection, trigger resync
      if (isReconnectRef.current) {
        onReconnectRef.current?.();
        isReconnectRef.current = false;
      }
    }

    function handleDisconnect() {
      setStatus('disconnected');
      isReconnectRef.current = true;
      scheduleReconnect();
    }

    function handleConnectError() {
      setStatus('disconnected');
      isReconnectRef.current = true;
      scheduleReconnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Connect
    if (!socket.connected) {
      setStatus('connecting');
      socket.connect();
    } else {
      // Already connected (e.g., re-render), just join the room
      setStatus('connected');
      socket.emit('join:trip', tripId);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      clearReconnectTimer();
      socket.emit('leave:trip', tripId);
      destroySocket();
      socketRef.current = null;
      setStatus('disconnected');
    };
  }, [token, tripId, scheduleReconnect, clearReconnectTimer]);

  return { socket: socketRef.current, status };
}
