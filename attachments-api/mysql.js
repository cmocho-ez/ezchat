import DBConnector from "./dbconnector.js";

export class AttachmentModel {
  constructor(
    name_key,
    original_name,
    mime_type,
    filesize,
    upload_date,
    author
  ) {
    this.uid = null;
    this.name_key = name_key;
    this.original_name = original_name;
    this.mime_type = mime_type;
    this.filesize = filesize;
    this.upload_date = upload_date;
    this.author = author;
  }
}

export class AttachmentDTO {
  constructor() {
    this.connection = new DBConnector();
  }

  async get(key) {
    const query = "select * from chat_attachments where name_key=?";

    try {
      const result = await this.connection.query(query, [key]);
      return result[0];
    } catch (err) {
      console.log(err);
    }
  }

  async save(AttachmentModel) {
    const query = "insert into chat_attachments set ?";

    // Removing keys that have default values
    delete AttachmentModel.uid;
    delete AttachmentModel.upload_date;

    try {
      const result = await this.connection.query(query, AttachmentModel);
      return result;
    } catch (err) {
      console.log(err);
    }
  }
}
