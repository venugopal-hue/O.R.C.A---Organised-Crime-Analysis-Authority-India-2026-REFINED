import { db } from "./firebase";
import { doc, setDoc, deleteDoc, collection, getDocs, query } from "firebase/firestore";

export interface AttachmentFile {
  name: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "orca";
  text: string;
  timestamp: string;
  attachments?: AttachmentFile[];
  report?: any;
  media?: any;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  pinned: boolean;
  messages: ChatMessage[];
  moduleContext?: string;
}

const getLocalStorageKey = (userId: string) => `orca_chats_${userId}`;

export async function dbSaveConversation(userId: string, conversation: ChatConversation): Promise<void> {
  try {
    const docRef = doc(db, "users", userId, "conversations", conversation.id);
    await setDoc(docRef, conversation);
  } catch (error) {
    console.warn("[Firestore Save Warning, using local storage fallback]:", error);
  }
  
  // Always update local storage as a mirror/cache
  try {
    const localKey = getLocalStorageKey(userId);
    const existing = localStorage.getItem(localKey);
    const chats: Record<string, ChatConversation> = existing ? JSON.parse(existing) : {};
    chats[conversation.id] = conversation;
    localStorage.setItem(localKey, JSON.stringify(chats));
  } catch (localErr) {
    console.error("[LocalStorage Sync Error]:", localErr);
  }
}

export async function dbDeleteConversation(userId: string, conversationId: string): Promise<void> {
  try {
    const docRef = doc(db, "users", userId, "conversations", conversationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("[Firestore Delete Warning, using local storage fallback]:", error);
  }
  
  try {
    const localKey = getLocalStorageKey(userId);
    const existing = localStorage.getItem(localKey);
    if (existing) {
      const chats: Record<string, ChatConversation> = JSON.parse(existing);
      delete chats[conversationId];
      localStorage.setItem(localKey, JSON.stringify(chats));
    }
  } catch (localErr) {
    console.error("[LocalStorage Delete Error]:", localErr);
  }
}

export async function dbLoadConversations(userId: string): Promise<ChatConversation[]> {
  try {
    const colRef = collection(db, "users", userId, "conversations");
    const snap = await getDocs(query(colRef));
    const list: ChatConversation[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as ChatConversation);
    });
    if (list.length > 0) {
      // Sync local storage mirror with Firestore list
      try {
        const localKey = getLocalStorageKey(userId);
        const chats: Record<string, ChatConversation> = {};
        list.forEach(c => { chats[c.id] = c; });
        localStorage.setItem(localKey, JSON.stringify(chats));
      } catch (localErr) {
        console.error("[LocalStorage Load Sync Error]:", localErr);
      }
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (error) {
    console.warn("[Firestore Load Warning, using local storage fallback]:", error);
  }

  // Fallback to local storage mirror
  try {
    const localKey = getLocalStorageKey(userId);
    const existing = localStorage.getItem(localKey);
    if (existing) {
      const chats: Record<string, ChatConversation> = JSON.parse(existing);
      return Object.values(chats).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (localErr) {
    console.error("[LocalStorage Load Error]:", localErr);
  }
  return [];
}
