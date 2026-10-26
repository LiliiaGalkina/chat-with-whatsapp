import axios from "axios";
import { useState, useEffect } from "react";
import AuthForm from "./auth/AuthForm";
import MessageList from "./chat/MessageList";
import SendMessageForm from "./chat/SendMessageForm";
import OpenChat from "./chat/OpenChat";
import style from "./chatwindow.module.scss";
import { sendWhatsappMessage } from "../utils/api";

const ChatWindow = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [allEvents, setAllEvents] = useState([]);

  // 3. Обработчик успеха
  const handleAuthSuccess = (creds) => {
    // Сохраняем данные для отправки сообщений
    setCredentials(creds);
    // Включаем флаг
    setIsAuthenticated(true);
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || !phoneNumber || !credentials) return;

    setIsSending(true);
    try {
      await sendWhatsappMessage(
        credentials.instanceId,
        credentials.token,
        phoneNumber,
        text,
      );
      const newMessage = { sender: "me", text, timestamp: Date.now() };
      setMessages((prev) => [...prev, newMessage]);
      setInputValue("");
    } catch (err) {
      console.error("Ошибка отправки:", err);
      alert(err.message || "Не удалось отправить сообщение.");
    } finally {
      setIsSending(false);
    }
  };

  // Поллинг (опрос всех событий каждые 3 секунды)
  useEffect(() => {
    let intervalId;
    if (!credentials || !credentials.token || !phoneNumber || messages.length === 0) return;
    const fetchAndFilter = async () => {
      try {
        const responseData = await getWhatsappEvents(
          credentials.instanceId,
          credentials.token,
        );
        if (!Array.isArray(response.data)) {
          console.warn("Сервер вернул некорректный ответ:", response);
          return;
        }
       
        // Сохраняем ВСЕ полученные события из API
        setAllEvents((prev) => [...prev, ...responseData]);
      } catch (error) {
        console.error("Ошибка опроса:", error.response?.statusText);


        if (
          axios.isAxiosError(error) &&
          [401, 503].includes(error.response?.status)
        ) {
          alert(
            "Сессия WhatsApp истекла или произошла ошибка подключения." +
              "\nПожалуйста, выйдите из приложения и войдите снова.",
          );
          handleLogout();
        }
      }
    };

    intervalId = setInterval(fetchAndFilter, 3000); // Каждые 3 сек
    return () => clearInterval(intervalId);
  }, [credentials, phoneNumber, messages]);

  //фильтрация событий
  const extractTextMessagesFromEvents = (events, phoneNumber) => {
    // ↓↓↓ Защита от null/undefined
    if (!Array.isArray(events)) return [];

    return events
      .filter(
        (event) =>
          event?.chatId === `${phoneNumber}@c.us` &&
          event?.messageData?.textMessageData,
      )
      .map((event) => ({
        sender: "peer",
        text: event.messageData.textMessageData.text ?? "",
        timestamp: Date.parse(event.timestamp), 
      }));
  };

  //выход из чата
  const handleCloseChat = () => {
    // Сбрасываем номер собеседника
    setPhoneNumber(null);
    // Чистим историю переписки
    setMessages([]);
  };

  //выход из приложения
  const handleLogout = () => {
    setCredentials(null); // Токены и ID инстанса
    setPhoneNumber(null); // Номер собеседника
    setMessages([]); // История переписки
    setIsAuthenticated(false);
  };

  return (
    <div className={style.chatApp}>
      <header className={style.header}>
        <h1 className={style.mainTitle}>Чат с WhatsApp</h1>
        {phoneNumber && (
          <button onClick={handleCloseChat} className={style.closeChatBtn}>
            Закрыть чат
          </button>
        )}
        {!phoneNumber && isAuthenticated && (
          <button onClick={handleLogout} className={style.logoutBtn}>
            Выйти из приложения
          </button>
        )}
        <h2 className={style.title}>
          {!isAuthenticated && "🔑 Авторизация"}
          {isAuthenticated && !phoneNumber && "📱 Создаем Чат"}
          {isAuthenticated && phoneNumber && ""}
        </h2>
      </header>

      {/* БЛОК 1: Авторизация */}
      {!isAuthenticated && <AuthForm onLogin={handleAuthSuccess} />}

      {/* БЛОК 2: Ввод номера */}
      {isAuthenticated && !phoneNumber && (
        <OpenChat
          setPhoneNumber={(num) => {
            setPhoneNumber(num);
          }}
        />
      )}

      {/* БЛОК 3: Чат */}
      {isAuthenticated && phoneNumber && (
        <div className={style.chatContent}>
          <SendMessageForm
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onSubmit={handleSendMessage}
            disabled={isSending}
          />
          <MessageList
            messages={[
              ...messages,
              ...extractTextMessagesFromEvents(allEvents, phoneNumber),
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
