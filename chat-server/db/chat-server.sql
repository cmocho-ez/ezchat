create database if not exists chatdb;
use chatdb;

SET GLOBAL log_bin_trust_function_creators = 1;

drop table if exists chat_rooms;
create table chat_rooms (
  uid varchar(36) not null default (UUID()),
  room_uid varchar(36) not null,
  project_uid varchar(36) not null,
  title varchar(200) not null,
  author_email varchar(250) not null,
  author_uid varchar(36) NOT NULL,
  message text not null,
  room_type varchar(10) not null,
  direct_link varchar(300) default null,
  sent_on datetime not null default (now()),
  attachment_uid varchar(36) default null,
  primary key (uid)
);

drop table if exists chat_attachments;
create table chat_attachments(
  uid varchar(36) primary key default (uuid()),
  name_key varchar(36) not null,
  original_name varchar(250) not null,
  mime_type varchar(200) not null,
  filesize bigint unsigned not null default 0,
  upload_date datetime not null default now(),
  author_uid varchar(36) not null
);

drop table if exists chat_log;
create table chat_log(
  message_uid varchar(36) not null,
  sent_to varchar(36) not NULL,
  read_on datetime default null,
  primary key (message_uid, sent_to)
);

create or replace view vw_logged_messages as
   select cr.uid, cr.message, cr.title, cr.room_type, cr.direct_link,
          cr.project_uid, cr.room_uid, cr.author_uid, cr.sent_on,
          cl.sent_to, cl.read_on 
   from chat_rooms cr 
left join chat_log cl on cr.uid = cl.message_uid;

delimiter //

drop function if exists fn_save_message//
CREATE function fn_save_message(
  p_room_uid varchar(36),
  p_project_uid varchar(36), 
  p_message text, 
  p_author_uid varchar(36),
  p_author_email varchar(250),
  p_title varchar(200),
  p_room_type varchar(10),
  p_direct_link varchar(300)
)
RETURNS varchar(36)
NOT DETERMINISTIC
MODIFIES SQL DATA
BEGIN
  SET @uuid = UUID();

  insert into chat_rooms set 
    uid = @uuid, 
    room_uid = p_room_uid,
    project_uid = p_project_uid,
    message = p_message,
    author_uid = p_author_uid,
    author_email = p_author_email,
    room_type = p_room_type,
    direct_link = p_direct_link,
    title = p_title;

  return @uuid;
END//

delimiter ;

/************************************************************************************************************/

create user if not exists 'chat_user'@'localhost' identified with mysql_native_password by 'Ch@tServer-2022!';

grant all privileges on chatdb.* to 'chat_user'@'localhost';

REVOKE Alter ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Create ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Create view ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Drop ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Grant option ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Index ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Alter routine ON chatdb.* FROM 'chat_user'@'localhost';
REVOKE Create routine ON chatdb.* FROM 'chat_user'@'localhost';

flush privileges;