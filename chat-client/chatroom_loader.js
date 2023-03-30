import { io } from 'https://cdn.socket.io/4.3.2/socket.io.esm.min.js';
import ChatRoom from './chatroom.js';

// const chatServerURL = 'https://transfer.onlinedfm.com:50155';
const chatServerURL = 'http://localhost:50156';

if (ENABLE_CHAT) {
  const checkForTable = setInterval(() => {
    const $table = $('table.sortable');

    // Check if table exists
    if ($table.length > 0) {
      clearInterval(checkForTable);

      // Get all extra info from CDE front-end
      const extraInfo = {
        user: {
          fullName: USER_FULLNAME,
          email: USER_EMAIL,
          uid: USER_KEY,
        },
      };

      // Start ChatRoom
      const chatRoom = new ChatRoom({
        io,
        chatServerURL,
        project_uid: PROJECT_NUMBER,
        auth_token: TOKEN,
        extra_info: extraInfo,
      });
      chatRoom.Render();

      // Add chat buttons to current interface
      chatRoom.AddChatButtons({ parent: $table, nodes: $table.find('tr[id]').find('td:first') });

      // Finally, check for unread messages
      chatRoom.GetUnreadRooms();
    }
  }, 250);
}

