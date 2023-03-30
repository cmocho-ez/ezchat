import DBConnector from './dbconnector.js';

export class MessageModel {
  constructor({
    room_uid,
    project_uid,
    title,
    message,
    attachment_uid,
    author_uid,
    author_email,
    author_full_name,
    extra_info,
  }) {
    this.room_uid = room_uid;
    this.project_uid = project_uid;
    this.message = message;
    this.title = title;
    this.attachment_uid = attachment_uid;
    this.author_uid = author_uid;
    this.author_email = author_email;
    this.author_full_name = author_full_name;
    this.extra_info = extra_info;
  }
}

export class LogModel {
  constructor({ message_uid, sent_to, sent_by, read }) {
    this.message_uid = message_uid;
    this.sent_by = sent_by;
    this.sent_to = sent_to;
  }
}

export class RoomPeopleModel {
  constructor({ room_uid, project_uid, author_uid }) {
    this.room_uid = room_uid;
    this.project_uid = project_uid;
    this.author_uid = author_uid;
  }
}

export class LogDTO {
  constructor() {
    this.connection = new DBConnector();
  }

  async saveLog(model) {
    const query = `insert into chat_log set message_uid = ?, sent_to = ?${
      model.sent_by === model.sent_to ? ', read_on = now()' : ''
    } on duplicate key update read_on = now()`;

    try {
      const result = await this.connection.query(query, [model.message_uid, model.sent_to]);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async readAllMessages({ room_uid, author_uid, project_uid }) {
    const query = `insert into chat_log (message_uid, sent_to, read_on) 
                   select uid, ?, now() from chat_rooms where project_uid = ? and room_uid = ?
                   on duplicate key update read_on = now()`;

    try {
      const result = await this.connection.query(query, [author_uid, project_uid, room_uid]);
      return result;
    } catch (err) {
      console.log(err);
    }
  }
}

export class RoomPeopleDTO {
  constructor() {
    this.connection = new DBConnector();
  }

  async save(model) {
    const query = 'insert ignore into chat_room_people set room_uid = ?, project_uid = ?, author_uid = ?';

    try {
      const result = await this.connection.query(query, [model.room_uid, model.project_uid, model.author_uid]);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async getPeople({ room_uid, project_uid }) {
    const query = 'select distinct author_uid from chat_room_people where project_uid = ? and room_uid = ?';

    try {
      const result = await this.connection.query(query, [project_uid, room_uid]);
      return result;
    } catch (err) {
      console.log(err);
    }
  }
}

export class ChatRoomDTO {
  constructor() {
    this.connection = new DBConnector();
  }

  async getMessages(room_uid, project_uid) {
    const query = `select cr.*, ca.original_name as filename, ca.mime_type as filetype, ca.filesize from chat_rooms cr 
                   left join chat_attachments ca on cr.attachment_uid = ca.name_key
                   where room_uid=? and project_uid=? order by sent_on`;

    try {
      const result = await this.connection.query(query, [room_uid, project_uid]);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async getUnreadMessages({ project_uid, author_uid }) {
    const query = `select * from vw_logged_messages where read_on is null and project_uid = ? and sent_to = ?`;

    try {
      const result = await this.connection.query(query, [project_uid, author_uid]);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async getAllMessages({ project_uid, room_uid, user_uid, page, page_size, sort, unread }) {
    const query = `select * from vw_logged_messages where project_uid = ?${room_uid ? ' and room_uid = ?' : ''}${
      user_uid ? ' and sent_to = ?' : ''
    }${unread ? ' and read_on is null' : ''}${sort ? ' order by sent_on ' + sort : ''}${
      page && page_size ? ' limit ?, ?' : ''
    }`;

    const params = [project_uid];

    if (room_uid) params.push(room_uid);
    if (user_uid) params.push(user_uid);
    if (page && page_size) {
      params.push((page - 1) * page_size);
      params.push(page_size);
    }

    try {
      const result = await this.connection.query(query, params);
      return result;
    } catch (err) {
      console.log(err);
    }
  }

  async saveMessage(model) {
    const query = 'select fn_save_message(?, ?, ?, ?, ?, ?, ?, ?) as uuid;';
    const { room_uid, project_uid, title, message, author_uid, author_email, author_full_name, extra_info } = model;

    try {
      const result = await this.connection.query(query, [
        room_uid,
        project_uid,
        title,
        message,
        author_uid,
        author_email,
        author_full_name,
        JSON.stringify(extra_info),
      ]);
      return result[0];
    } catch (err) {
      console.log(err);
    }
  }
}
