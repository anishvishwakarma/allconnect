import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { chatsApi } from "../../services/api";
import { getSocket, joinChatRoom, leaveChatRoom, emitTyping, emitStopTyping } from "../../services/socket";
import { useAuthStore } from "../../store/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";

const PRIMARY = "#E8751A";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { isDark } = useAppTheme();
  const alert = useAlert();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [expired, setExpired] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";
  const inputBg = isDark ? "#1A1A1F" : "#FFFFFF";
  const myMsgBg = PRIMARY;
  const theirMsgBg = isDark ? "#252528" : "#FFFFFF";

  useEffect(() => {
    if (!token) return;
    if (!id) { setLoading(false); return; }
    loadMessages();
    const socket = getSocket();
    joinChatRoom(id);

    socket.on("new_message", (msg: { id: string; user_id: string; body: string; created_at: string }) => {
      setMessages((p) => [...p, { id: msg.id, user_id: msg.user_id, body: msg.body, created_at: msg.created_at }]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    });
    socket.on("chat:typing", () => setTyping(true));
    socket.on("chat:stop_typing", () => setTyping(false));
    socket.on("chat:expired", () => {
      setExpired(true);
      alert.show("Chat ended", "This event has ended and the group has been closed.", undefined, "info");
    });

    return () => {
      leaveChatRoom(id);
      socket.off("new_message");
      socket.off("chat:typing");
      socket.off("chat:stop_typing");
      socket.off("chat:expired");
    };
  }, [id, token]);

  async function loadMessages() {
    try {
      const msgs = await chatsApi.messages(id);
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 80);
    } catch (err: any) {
      if (err.message?.includes("expired")) setExpired(true);
    } finally { setLoading(false); }
  }

  function handleChange(t: string) {
    setInput(t);
    emitTyping(id);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitStopTyping(id), 2000);
  }

  async function send() {
    const t = input.trim();
    if (!t || expired) return;
    setInput("");
    clearTimeout(typingTimer.current);
    emitStopTyping(id);
    try {
      const msg = await chatsApi.send(id, t);
      setMessages((p) => [...p, { id: msg.id, user_id: msg.user_id, body: msg.body, created_at: msg.created_at }]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (_) {
      setInput(t);
    }
  }

  const renderItem = useCallback(({ item, index }: any) => {
    const isMe = item.user_id === user?.id;
    const prev = messages[index - 1];
    const showName = !isMe && (!prev || prev.user_id !== item.user_id);
    const body = item.body ?? item.text;
    const createdAt = item.created_at ?? item.createdAt;
    return (
      <View style={[msgS.row, isMe && msgS.myRow]}>
        {!isMe && (
          <View style={[msgS.avatar, showName ? { opacity: 1 } : { opacity: 0 }]}>
            <Text style={msgS.avatarText}>U</Text>
          </View>
        )}
        <View style={[msgS.bubble, isMe ? [msgS.myBubble, { backgroundColor: myMsgBg }] : [msgS.theirBubble, { backgroundColor: theirMsgBg, borderColor: border }]]}>
          {showName && <Text style={[msgS.senderName, { color: PRIMARY }]}>User</Text>}
          <Text style={[msgS.msgText, { color: isMe ? "#fff" : text }]}>{body}</Text>
          <Text style={[msgS.time, { color: isMe ? "rgba(255,255,255,0.6)" : sub }]}>
            {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  }, [user?.id, messages, isDark]);

  if (token && !id) {
    return (
      <View style={[s.center, { flex: 1, backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={[s.emptyTitle, { color: text }]}>Chat not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={[s.backCta]}>
          <Text style={[s.backCtaText, { color: PRIMARY }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: surface, borderBottomColor: border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}>
          <Ionicons name="arrow-back" size={18} color={PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.headerTitle, { color: text }]} numberOfLines={1}>Group Chat</Text>
          {expired && <Text style={[s.expiredLabel]}>Chat has ended</Text>}
        </View>
        <View style={[s.statusIndicator, { backgroundColor: expired ? "#FF453A18" : "#30D15818" }]}>
          <View style={[s.statusDot, { backgroundColor: expired ? "#FF453A" : "#30D158" }]} />
          <Text style={[s.statusText, { color: expired ? "#FF453A" : "#30D158" }]}>{expired ? "Ended" : "Live"}</Text>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={PRIMARY} size="large" /></View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 4 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.center}>
              <View style={[s.emptyIconBg, { backgroundColor: isDark ? "#1A1A1F" : "#F5F5F7" }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={sub} />
              </View>
              <Text style={[s.emptyTitle, { color: text }]}>Start the conversation!</Text>
              <Text style={[s.emptySub, { color: sub }]}>Say hello to the group</Text>
            </View>
          }
        />
      )}

      {/* Typing indicator */}
      {typing && (
        <View style={[s.typingRow, { backgroundColor: bg }]}>
          <View style={[s.typingBubble, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}>
            <Text style={[s.typingText, { color: sub }]}>Someone is typing</Text>
            <Text style={[s.typingDots, { color: PRIMARY }]}>···</Text>
          </View>
        </View>
      )}

      {/* Input bar */}
      {!expired ? (
        <View style={[s.inputBar, { backgroundColor: surface, borderTopColor: border, paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={input} onChangeText={handleChange}
            placeholder="Message..." placeholderTextColor={sub}
            multiline maxLength={2000}
            style={[s.inputField, { backgroundColor: inputBg, color: text, borderColor: input ? PRIMARY : border }]}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim()}
            style={[s.sendBtn, { backgroundColor: input.trim() ? PRIMARY : (isDark ? "#252528" : "#F0F0F3") }]}
          >
            <Ionicons name="send" size={16} color={input.trim() ? "#fff" : sub} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.expiredBar, { backgroundColor: "#FF453A10", borderTopColor: "#FF453A30", paddingBottom: insets.bottom + 14 }]}>
          <Ionicons name="lock-closed-outline" size={14} color="#FF453A" />
          <Text style={s.expiredBarText}>This group chat has ended</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const msgS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 2 },
  myRow: { flexDirection: "row-reverse" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8751A18", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "700", color: "#E8751A" },
  bubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  myBubble: { borderBottomRightRadius: 4, shadowColor: "#E8751A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  theirBubble: { borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  senderName: { fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 0.2 },
  msgText: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 10, marginTop: 4, textAlign: "right" },
});

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  expiredLabel: { fontSize: 11, color: "#FF453A", fontWeight: "600", marginTop: 2 },
  statusIndicator: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  backCta: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 20 },
  backCtaText: { fontSize: 16, fontWeight: "600" },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySub: { fontSize: 14, textAlign: "center" },
  typingRow: { paddingHorizontal: 16, paddingBottom: 4 },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  typingText: { fontSize: 12, fontStyle: "italic" },
  typingDots: { fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inputField: { flex: 1, borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 110, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#E8751A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  expiredBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderTopWidth: 1 },
  expiredBarText: { color: "#FF453A", fontSize: 13, fontWeight: "600" },
});
