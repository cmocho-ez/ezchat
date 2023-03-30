create table if not exists chat_room_people (
  room_uid varchar(36) not null,
  project_uid varchar(36) not null, 
  author_uid varchar(36) not null,
  primary key (room_uid, project_uid, author_uid)
);

alter table chat_rooms add cde_extra_info text default null;
alter table chat_rooms add author_full_name varchar(250) not null;
alter table chat_rooms drop column direct_link;
alter table chat_rooms drop column room_type;

create or replace view vw_logged_messages as
   select cr.*,
          cl.sent_to, cl.read_on 
     from chat_rooms cr 
left join chat_log cl on cr.uid = cl.message_uid;

create or replace view vw_room_people as
select crp.*, 
       cr.author_email, cr.author_full_name 
  from chat_room_people crp 
 inner join chat_rooms cr on crp.room_uid = cr.room_uid and crp .project_uid = cr.project_uid and crp.author_uid = cr.author_uid;

SET GLOBAL log_bin_trust_function_creators = 1;

delimiter $

drop function if exists fn_save_message$
create function fn_save_message(
  p_room_uid varchar(36),
  p_project_uid varchar(36), 
  p_title varchar(200), 
  p_message text, 
  p_author_uid varchar(36),
  p_author_email varchar(250),
  p_author_full_name varchar(250),
  p_cde_extra_info text
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
    title = p_title,
    message = p_message,
    author_uid = p_author_uid,
    author_email = p_author_email,
    author_full_name = p_author_full_name,
    cde_extra_info = p_cde_extra_info;

  return @uuid;
END$

delimiter ;
