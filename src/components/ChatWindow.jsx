import { useState, useEffect, useCallback } from "react";
import AuthForm from "./auth/AuthForm";
import MessageList from "./chat/MessageList";
import SendMessageForm from "./chat/SendMessageForm";
import OpenChat from "./chat/OpenChat";
import style from "./chatwindow.module.scss";
import { getIncomingMessages, sendWhatsappMessage } from "../utils/api";

const ChatWindow = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [credentials, setCredentials] = useState(null);

  // 3. Обработчик успеха
  const handleAuthSuccess = (creds) => {
    // Сохраняем данные для отправки сообщений
    setCredentials(creds);
    // Включаем флаг
    setIsAuthenticated(true);
  };

  //отправка сообщения
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

	/* ✅ Хук №1: Запускаем поллинг ТОЛЬКО при наличии собеседника */
	useEffect(() => {
		let intervalId;
		// Проверяем наличие токенов И выбранного номера 
		if (credentials && credentials.token && phoneNumber) {
			const fetchAndFilter = async () => {
				try {
					const responseData = await getIncomingMessages(credentials.instanceId, credentials.token);
					// Проверяем тип данных перед фильтрацией 
					if (!Array.isArray(responseData)) {
						console.warn('Сервер вернул пустой ответ:', responseData);
						return;
					}
					
					// Фильтруем только те, что пришли ОТ собеседника 
					const filteredMsgs = responseData.filter((msg) =>
						msg.chatId === `${phoneNumber}@c.us`
					).map((msg) => ({
						sender: "peer",
						text: msg.messageData.textMessageData?.text ?? "",
						timestamp: Date.parse(msg.timestamp),
					}));
					setMessages(filteredMsgs);
				} catch (err) {
					console.error('Ошибка опроса:', err.response?.data);
					// Если сервер вернул ошибку 401 или другую критическую, можно сбросить токен 
					if (axios.isAxiosError(err) && [401, 503].includes(err.response?.status)) {
						alert("Сессия WhatsApp истекла. Пожалуйста, авторизуйтесь снова.");
						handleLogout();
					}
				}
			};
			intervalId = setInterval(fetchAndFilter, 5_000);
		}
		return () => clearInterval(intervalId);
	}, [credentials, phoneNumber]);
	
	/* ✅ Хук №2: Очистка стейта при выходе из приложения */
	useEffect(() => {
		if (!isAuthenticated) {
		// При выходе очищаем все данные 
			setCredentials(null);
			setPhoneNumber(null);
			setMessages([]);
		}
	}, [isAuthenticated]);

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
            const cleanedNum = num.replace(/\D/g, "");
            setPhoneNumber(cleanedNum);
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
          <MessageList messages={messages} />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
