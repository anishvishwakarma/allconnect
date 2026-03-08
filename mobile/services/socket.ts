import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';
import { useAuthStore } from '../store/auth';

let socket: Socket | null = null;
let socketToken: string | null = null;
const joinedRooms = new Set<string>();

export function getSocket(): Socket {
  const token = useAuthStore.getState().token;
  if (socket && socketToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token ?? null;
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    if (__DEV__) console.log('🔌 Socket connected:', socket?.id);
    for (const roomId of joinedRooms) {
      socket?.emit('chat:join', roomId);
    }
  });

  socket.on('connect_error', (err) => {
    if (__DEV__) console.warn('Socket connect error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('Socket disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socketToken = null;
  joinedRooms.clear();
}

export function joinChatRoom(chatId: string): void {
  joinedRooms.add(chatId);
  const current = getSocket();
  if (current.connected) {
    current.emit('chat:join', chatId);
    return;
  }
  current.once('connect', () => current.emit('chat:join', chatId));
}

export function leaveChatRoom(chatId: string): void {
  joinedRooms.delete(chatId);
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
