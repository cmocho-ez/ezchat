import { createServer } from 'http';
import { createServer as createSSLServer } from 'https';
import { readFileSync } from 'fs';
import { Server } from 'socket.io';
import { config } from 'dotenv';
config();

import Package from './package.json' assert { type: 'json' };
import { ChatRoomDTO, MessageModel, RoomPeopleModel, LogDTO, LogModel, RoomPeopleDTO } from './mysql.js';

import StartAPI from './api.js';

const PORT = Number(process.env.PORT);
const COMPATIBLE_CLIENT_VERSIONS = ['1.6.0'];

// Starting server
if (process.env.PFX_FILE && process.env.PFX_PASSWORD) {
  const options = {
    pfx: readFileSync(process.env.PFX_FILE),
    passphrase: process.env.PFX_PASSWORD,
  };
  const httpServer = createSSLServer(options);
  const io = new Server(httpServer, { cors: { origin: '*' } });

  BindIO(io);

  httpServer.listen(PORT);
  console.log(`Socket.IO Server started on SSL port ${PORT}!`);
} else {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });

  BindIO(io);

  httpServer.listen(PORT);
  console.log(`Socket.IO Server started on port ${PORT}!`);
}

async function GetPeopleInvolved(data) {
  const { project_uid, extra_info, room_uid, auth_token } = data;
  const type = extra_info.room_type;
  const typeMap = {
    DWG: 'docDrawings',
    RFI: 'docRFI',
    TECH: 'docTechSubmittals',
    DOCS: 'alldocs',
  };
  try {
    const response = await fetch(
      `https://cdedev.dfmsystems.com:50183/IndividualInformation/GetIndividualInformation?projectKey=${project_uid}&tableName=${typeMap[type]}&recordKey=${room_uid}`,
      {
        headers: {
          Authorization: auth_token,
        },
      }
    );

    const people = await response.json();
    return people;
  } catch (err) {
    console.error('GetPeopleInvolved', err);
  }
}

function BindIO(io) {
  // Socket events
  function onIdentify(data) {
    const { user, clientVersion } = data;

    if (!COMPATIBLE_CLIENT_VERSIONS.includes(clientVersion)) {
      console.error('Incompatible client version', data);

      this.emit('error', {
        message: 'Incompatible client version',
        COMPATIBLE_CLIENT_VERSIONS,
        clientVersion: data.clientVersion,
      });
      this.disconnect();
    } else {
      this.user = user;
      this.clientVersion = clientVersion;

      this.emit('identified');

      console.info(`New client identified as "${this.user.email}" (${this.user.uid}), version ${this.clientVersion}`);
    }
  }
  async function onGetUnreadMessages(data) {
    console.log('Getting unread rooms', data);

    const { project_uid, author_uid } = data;
    const dto = new ChatRoomDTO();
    const result = await dto.getUnreadMessages({ project_uid, author_uid });

    this.emit('unreadrooms', result);
  }
  async function onGetPeopleInvolved(data) {
    const people = await GetPeopleInvolved(data);
    this.emit('peopleinvolved', people);
  }
  async function onGetAllMessages(data) {
    console.log('Getting all messages', data);

    const { room_uid, project_uid } = data;

    const dto = new ChatRoomDTO();
    const result = await dto.getMessages(room_uid, project_uid);

    const rows = result.map((row) => {
      row.author = {
        uid: row.author_uid,
        email: row.author_email,
      };

      row.attachment = {
        uid: row.attachment_uid,
        name: row.filename,
        size: row.filesize,
        type: row.filetype,
      };
      return row;
    });

    this.emit('allmessages', rows);
  }
  function onReadRoom(data) {
    const { author_uid, room_uid, project_uid } = data;
    const dto = new LogDTO();

    dto.readAllMessages({ author_uid, room_uid, project_uid });

    // Log this person as part of this room now
    const dtoPP = new RoomPeopleDTO();
    const model = new RoomPeopleModel({ room_uid, project_uid, author_uid });
    dtoPP.save(model);
  }
  async function onMessage(data) {
    if (data?.message?.startsWith('/')) {
      onCommand(data, this);
      return;
    }

    // Break the data apart
    const { room_uid, project_uid, message, title, auth_token, author, extra_info } = data;
    const dtoMsg = new ChatRoomDTO();
    const msgModel = new MessageModel({
      room_uid,
      project_uid,
      title,
      message,
      author_uid: author.uid,
      author_email: author.email,
      author_full_name: author.fullName,
      extra_info,
    });

    // Remove unused properties
    delete msgModel.attachment_uid;

    // Saves the message
    const result = await dtoMsg.saveMessage(msgModel);
    const message_uid = result.uuid;

    // Updates the UUID
    data.uid = message_uid;

    // Broadcast the message
    io.emit('message', data);

    // Get everyone involved (1)
    const people = await GetPeopleInvolved(data);

    // Verifies if there's anyone involved before logging
    if (people instanceof Array && people.length > 0) {
      // Log the message as unread for all involved
      const dtoLog = new LogDTO();

      people.forEach(async (p) => {
        const model = new LogModel({ message_uid, sent_to: p.key, sent_by: author.uid });
        await dtoLog.saveLog(model);
      });
    }

    // Get everyone attending that room (2)
    const dtoPpl = new RoomPeopleDTO();
    const people2 = await dtoPpl.getPeople({ room_uid, project_uid });

    if (people2 instanceof Array && people2.length > 0) {
      // Log the message as unread for all involved
      const dtoLog = new LogDTO();

      people2.forEach(async (p) => {
        const model = new LogModel({ message_uid, sent_to: p.author_uid, sent_by: author.uid });
        await dtoLog.saveLog(model);
      });
    }

    // Mark self as reader
    const dto = new LogDTO();
    dto.readAllMessages({ author_uid: author.uid, room_uid, project_uid });
  }
  async function onAttachment(data) {
    const { room_uid, project_uid, author, attachment, extra_info } = data;
    const dto = new ChatRoomDTO();
    const model = new MessageModel({
      room_uid,
      project_uid,
      title: 'Attachment',
      message: 'New attachment',
      author_uid: author.uid,
      author_email: author.email,
      attachment_uid: attachment.uid,
      extra_info,
    });

    // Saves the message
    const result = await dto.saveMessage(model);
    const message_uid = result.uuid;

    // Updates the UUID
    data.uid = message_uid;

    // Broadcast the message
    this.broadcast.emit('attachment', data);
  }
  function onCommand(data, socket) {
    const { room_uid, project_uid, message, author } = data;
    switch (message) {
      case '/version':
        socket.emit('response', {
          room_uid,
          project_uid,
          author_uid: author.uid,
          response: `Current server version is ${Package.version}<br />Client version is ${socket.clientVersion}`,
        });
        break;

      case '/clear':
      default:
        break;
    }
  }
  function onUserEvent(data) {
    io.emit('userevent', data);
  }

  io.on('connection', (socket) => {
    const OnIdentify = onIdentify.bind(socket);
    const OnUserEvent = onUserEvent.bind(socket);
    const OnMessage = onMessage.bind(socket);
    const OnAttachment = onAttachment.bind(socket);
    const OnGetAllMessages = onGetAllMessages.bind(socket);
    const OnGetUnreadRooms = onGetUnreadMessages.bind(socket);
    const OnReadRoom = onReadRoom.bind(socket);
    const OnGetPeopleInvolved = onGetPeopleInvolved.bind(socket);

    socket.on('identify', OnIdentify);
    socket.on('userevent', OnUserEvent);
    socket.on('message', OnMessage);
    socket.on('attachment', OnAttachment);
    socket.on('getallmessages', OnGetAllMessages);
    socket.on('getunreadrooms', OnGetUnreadRooms);
    socket.on('readroom', OnReadRoom);
    socket.on('getpeopleinvolved', OnGetPeopleInvolved);

    socket.emit('handshake');
  });
}

StartAPI();

