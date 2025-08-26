# ChatApp WebSocket Server

WebSocket server untuk ChatApp menggunakan Socket.IO.

## Instalasi

```bash
cd websocket-server
npm install
```

## Menjalankan Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Server akan berjalan di `http://localhost:3001`

## Fitur

- Real-time messaging
- User online status
- Chat history
- Room-based messaging
- CORS support untuk frontend

## Events

### Client ke Server
- `join`: User bergabung dengan username
- `start_chat`: Memulai chat dengan user lain
- `send_message`: Mengirim pesan

### Server ke Client
- `users_updated`: Update daftar user online
- `message_received`: Menerima pesan baru
- `chat_history`: History pesan dalam chat room

## Struktur Data

### User
```javascript
{
  id: string,
  username: string,
  isOnline: boolean
}
```

### Message
```javascript
{
  id: string,
  senderId: string,
  senderName: string,
  receiverId: string,
  content: string,
  timestamp: Date
}
```