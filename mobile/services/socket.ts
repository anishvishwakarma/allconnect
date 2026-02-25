import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';
import { useAuthStore } from '../store/auth';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;

  const token = useAuthStore.getState().token;
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connect error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinChatRoom(chatId: string): void {
  getSocket().emit('chat:join', chatId);
}

export function leaveChatRoom(chatId: string): void {
  if (socket) socket.emit('chat:leave', chatId);
}

export function sendSocketMessage(chatId: string, text: string): void {
  getSocket().emit('chat:send', { chatId, text });
}

export function emitTyping(chatId: string): void {
  if (socket) socket.emit('chat:typing', { chatId });
}

export function emitStopTyping(chatId: string): void {
  if (socket) socket.emit('chat:stop_typing', { chatId });
}
