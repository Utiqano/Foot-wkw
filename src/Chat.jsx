import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import EmojiPicker from "emoji-picker-react";

export default function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load old messages
    fetchMessages();

    // REAL-TIME LISTENER (instant updates!)
    const subscription = supabase
      .channel("messages-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((current) => [...current, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || uploading) return;

    const { error } = await supabase.from("messages").insert({
      user_id: user.id,
      user_email: user.email,
      message_text: newMessage.trim(),
    });

    if (error) console.error(error);
    setNewMessage("");
    setShowEmoji(false);
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Math.random().toString(
      36
    )}-${Date.now()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
      .from("chat-images")
      .upload(fileName, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-images").getPublicUrl(fileName);

    await supabase.from("messages").insert({
      user_id: user.id,
      user_email: user.email,
      image_url: publicUrl,
    });

    setUploading(false);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>⚽ Live Football Chat</h2>
        <span className="online">● Online</span>
      </div>

      <div className="messages-list">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.user_id === user.id ? "own" : "other"}`}
          >
            {msg.user_id !== user.id && (
              <small className="sender">{msg.user_email?.split("@")[0]}</small>
            )}
            <div className="bubble">
              {msg.message_text && <p>{msg.message_text}</p>}
              {msg.image_url && <img src={msg.image_url} alt="chat" />}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          rows="1"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message... ⚽"
        />

        <div className="input-actions">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="emoji-btn"
          >
            😊
          </button>

          <label className="attach-btn">
            📎
            <input type="file" accept="image/*" onChange={uploadImage} hidden />
          </label>

          {/* ←←← NOUVEAU BOUTON REFRESH ICI */}
          <button
            onClick={fetchMessages}
            className="refresh-btn"
            title="Rafraîchir les messages"
          >
            ⟳
          </button>
          {/* ←←← FIN NOUVEAU BOUTON */}

          <button
            onClick={sendMessage}
            disabled={uploading || !newMessage.trim()}
            className="send-btn"
          >
            {uploading ? "⏳" : "Send"}
          </button>
        </div>

        {showEmoji && (
          <div className="emoji-picker-wrapper">
            <EmojiPicker
              onEmojiClick={(emoji) => setNewMessage((m) => m + emoji.emoji)}
              lazyLoadEmojis={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
