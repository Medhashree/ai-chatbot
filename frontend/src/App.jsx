import { useState, useRef, useEffect } from "react";
import "./App.css";

const categories = [
  { id: "general", icon: "💬", name: "General Chat" },
  { id: "sports", icon: "⚽", name: "Sports" },
  { id: "travel", icon: "✈️", name: "Travel" },
  { id: "movies", icon: "🎬", name: "Movies" },
  { id: "relationship", icon: "❤️", name: "Relationship" },
  { id: "coding", icon: "💻", name: "Coding" },
];

const initialChats = [
  {
    id: 1,
    title: "React performance question",
    category: "coding",
    messages: [
      {
        role: "user",
        content: "How can I improve React application performance?",
      },
      {
        role: "assistant",
        content:
          "There are several ways to improve React performance, including memoization, lazy loading, code splitting, virtualization, and avoiding unnecessary re-renders.",
      },
    ],
  },
  {
    id: 2,
    title: "Spiti trip planning",
    category: "travel",
    messages: [
      {
        role: "user",
        content: "Can you help me plan a 7-day Spiti trip?",
      },
      {
        role: "assistant",
        content:
          "Absolutely! I can help you create an itinerary based on your preferred places, travel time, activities, and budget.",
      },
    ],
  },
  {
    id: 3,
    title: "Latest football discussion",
    category: "sports",
    messages: [
      {
        role: "user",
        content: "Tell me about the latest football matches.",
      },
      {
        role: "assistant",
        content:
          "Sure! Once the sports tools are connected, I’ll be able to provide current match information.",
      },
    ],
  },
];

function App() {
  const [chats, setChats] = useState(initialChats);
  const [activeChatId, setActiveChatId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [activeChat?.messages, isTyping]);

  const handleNewChat = () => {
    setActiveChatId(null);
    setSelectedCategory("general");
    setMessage("");
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category.id);
    setActiveChatId(null);
  };

  const handleChatClick = (chat) => {
    setActiveChatId(chat.id);
    setSelectedCategory(chat.category);
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isTyping) {
      return;
    }

    setMessage("");

    let currentChatId = activeChatId;

    /*
     * If there is no active conversation,
     * create a new one.
     */
    if (!currentChatId) {
      const newChat = {
        id: Date.now(),
        title:
          trimmedMessage.length > 35
            ? trimmedMessage.substring(0, 35) + "..."
            : trimmedMessage,
        category: selectedCategory,
        messages: [],
      };

      currentChatId = newChat.id;

      setChats((prevChats) => [...prevChats, newChat]);
      setActiveChatId(newChat.id);
    }

    /*
     * Add the user's message immediately.
     */
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                {
                  role: "user",
                  content: trimmedMessage,
                },
              ],
            }
          : chat,
      ),
    );

    /*
     * Add an empty assistant message.
     *
     * This message will be progressively updated
     * as chunks arrive from FastAPI.
     */
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                {
                  role: "assistant",
                  content: "",
                },
              ],
            }
          : chat,
      ),
    );

    setIsTyping(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from server");
      }

      if (!response.body) {
        throw new Error("Streaming is not supported by this response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();

        // value usually isn't directly a JavaScript string. value is generally a: Uint8Array, which is essentially a collection of bytes.

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, {
          stream: true, // stream: true tells TextDecoder: "I'm going to give you more bytes later. Keep track of any incomplete multi-byte character between chunks."
        });

        /*
         * Append the newly received chunk
         * to the existing assistant message.
         */
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== currentChatId) {
              return chat;
            }

            const updatedMessages = [...chat.messages];

            const lastMessageIndex = updatedMessages.length - 1;

            updatedMessages[lastMessageIndex] = {
              ...updatedMessages[lastMessageIndex],
              content: updatedMessages[lastMessageIndex].content + chunk,
            };

            return {
              ...chat,
              messages: updatedMessages,
            };
          }),
        );
      }
    } catch (error) {
      console.error("Streaming error:", error);

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== currentChatId) {
            return chat;
          }

          const updatedMessages = [...chat.messages];

          const lastMessageIndex = updatedMessages.length - 1;

          updatedMessages[lastMessageIndex] = {
            ...updatedMessages[lastMessageIndex],
            content: "Sorry, something went wrong while getting the response.",
          };

          return {
            ...chat,
            messages: updatedMessages,
          };
        }),
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const currentCategory =
    categories.find((category) => category.id === selectedCategory) ||
    categories[0];

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          {sidebarOpen && <div className="logo">✦ AI Assistant</div>}

          <button
            className="icon-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle sidebar"
          >
            ☰
          </button>
        </div>

        {sidebarOpen && (
          <>
            <button className="new-chat-button" onClick={handleNewChat}>
              <span>＋</span>
              New Chat
            </button>

            {/* CATEGORIES */}
            <div className="sidebar-section">
              <div className="section-title">Categories</div>

              {categories.map((category) => (
                <button
                  key={category.id}
                  className={`category-item ${
                    selectedCategory === category.id && !activeChatId
                      ? "active"
                      : ""
                  }`}
                  onClick={() => handleCategoryClick(category)}
                >
                  <span className="category-icon">{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>

            {/* CHAT HISTORY */}
            <div className="sidebar-section history-section">
              <div className="section-title">Recent Chats</div>

              <div className="chat-history">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    className={`history-item ${
                      activeChatId === chat.id ? "active" : ""
                    }`}
                    onClick={() => handleChatClick(chat)}
                  >
                    <span className="history-icon">
                      {
                        categories.find(
                          (category) => category.id === chat.category,
                        )?.icon
                      }
                    </span>

                    <span className="history-title">{chat.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-footer">
              <div className="user-avatar">M</div>
              <div className="user-info">
                <span>My Account</span>
                <small>AI Assistant</small>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="mobile-menu">
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
          </div>

          <div className="mobile-title">AI Assistant</div>

          <button className="new-chat-mobile" onClick={handleNewChat}>
            ＋
          </button>
        </header>

        {/* CHAT AREA */}
        <div className="chat-container">
          {!activeChat ? (
            /* WELCOME SCREEN */
            <div className="welcome-screen">
              <div className="welcome-icon">✦</div>

              <h1>How can I help you today?</h1>

              <p>
                Choose a category or start a conversation with your AI
                assistant.
              </p>

              <div className="category-grid">
                {categories.map((category) => (
                  <button
                    className="category-card"
                    key={category.id}
                    onClick={() => handleCategoryClick(category)}
                  >
                    <div className="card-icon">{category.icon}</div>

                    <div>
                      <h3>{category.name}</h3>

                      <p>{getCategoryDescription(category.id)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CONVERSATION */
            <div className="conversation">
              <div className="conversation-header">
                <div>
                  <span className="conversation-category">
                    {currentCategory.icon} {currentCategory.name}
                  </span>

                  <h2>{activeChat.title}</h2>
                </div>
              </div>

              <div className="messages">
                {activeChat.messages.map((msg, index) => (
                  <Message
                    key={index}
                    message={msg}
                    isStreaming={
                      isTyping &&
                      msg.role === "assistant" &&
                      index === activeChat.messages.length - 1
                    }
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="composer-wrapper">
          <div className="composer">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentCategory.name}...`}
              rows="1"
            />

            <button
              className={`send-button ${message.trim() ? "enabled" : ""}`}
              onClick={handleSend}
              disabled={!message.trim() || isTyping}
            >
              ↑
            </button>
          </div>

          <div className="composer-note">
            AI Assistant can make mistakes. Check important information.
          </div>
        </div>
      </main>
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`message-row ${isUser ? "user-row" : "assistant-row"}`}>
      {!isUser && <div className="assistant-avatar">✦</div>}

      <div
        className={`message ${isUser ? "user-message" : "assistant-message"}`}
      >
        {message.content}
      </div>

      {isUser && <div className="user-message-avatar">M</div>}
    </div>
  );
}

function getCategoryDescription(category) {
  const descriptions = {
    general: "Ask anything",
    sports: "Scores, players & matches",
    travel: "Trips & itineraries",
    movies: "Movies & recommendations",
    relationship: "Talk & get advice",
    coding: "Code & development",
  };

  return descriptions[category];
}

export default App;
