import { FileMessage } from './file-message.js';
import { Badge } from './badge.js';

export default class ChatRoom {
  #scrollOptions;

  constructor({ io, chatServerURL, project_uid, auth_token, extra_info }) {
    if (!auth_token) {
      console.log('Could not connect to the chat server. Reason: auth_token missing!');
      return;
    }

    const socket = io(chatServerURL);

    this.version = '1.6';
    this.socket = socket;

    this.user = { ...extra_info.user };
    this.extra_info = null;
    this.project_uid = project_uid;
    this.auth_token = auth_token;

    this.mainPanel = null;
    this.room = {
      active: null,
      collection: {},
    };

    this.onNotification = null;

    this.#scrollOptions = {
      block: 'end',
      inline: 'nearest',
      behavior: 'smooth',
    };

    // Server Events
    function onError(instance, data) {
      console.log('Error communicating with chat server.', data);
      instance.socket.disconnect();
    }
    function onHandshake(instance) {
      instance.socket.emit('identify', {
        user: instance.user,
        clientVersion: instance.version,
        project_uid: instance.project_uid,
        auth_token: instance.auth_token,
      });
    }
    function onIdentified(data) {
      console.log('Client identified successfully!');
    }
    function onAllMessages(instance, data) {
      data.forEach((msg) => onMessage(instance, msg));
    }
    function onMessage(instance, data) {
      if (data.attachment?.uid) return onAttachment(instance, data);

      const { room_uid, message, author, sent_on, uid } = data;
      const $panel = instance.mainPanel.find(`.cr-panel[data-uid=${room_uid}]`);
      const $tab = instance.mainPanel.find(`.cr-tab[data-uid=${room_uid}]`);

      if (instance.room.active !== room_uid) {
        instance.mainPanel.addClass('has-messages');
        $tab.addClass('unread');

        // Find the buttons and add a badge
        const btn = $(`[name=btnChat][data-id="${room_uid}"]`);
        instance.AddBadge({ node: btn });
      } else {
        const isMine = author.uid === instance.user.uid;
        const $newMsg = $(`
          <div class="message-row${isMine ? ' mine' : ''}" data-uid="${uid}">
            <span class="message-title">
              <span name="author">${author.email}</span>, <span name="timestamp">${moment(sent_on || new Date()).format(
          'HH:mm:ss DD/MM/YYYY'
        )}</span>
            </span>
            <article>${message}</article>
          </div>
        `);

        $panel.append($newMsg);
        $newMsg[0].scrollIntoView(instance.#scrollOptions);
      }
    }
    function onAttachment(instance, data) {
      const { room_uid, author, attachment } = data;
      const isMine = author.uid === instance.user.uid;

      const fm = new FileMessage(attachment.name, attachment.size, attachment.type, author, attachment);

      const $panel = instance.mainPanel.find(`.cr-panel[data-uid=${room_uid}]`);
      const $tab = instance.mainPanel.find(`.cr-tab[data-uid=${room_uid}]`);
      const activePanelId = instance.mainPanel.find('.cr-tab.active').attr('data-uid');

      fm.node.addClass(isMine ? 'mine' : '');

      const src = `${API_BASE_URL}/files/download/${attachment.uid}`;

      if (attachment.type.startsWith('image'))
        fm.node.find('.file-preview').css({ 'background-image': `url(${src})`, width: '48px' });

      fm.enableClick(attachment.name, src);

      $panel.append(fm.node);
      fm.node[0].scrollIntoView(instance.#scrollOptions);

      if (activePanelId !== room_uid) {
        $tab.addClass('unread');
        instance.mainPanel.addClass('has-messages');
      }
    }
    function onUnreadRooms(instance, data) {
      // Got al unread messages, let's show them!
      const badges = {};
      data.forEach((msg) => {
        if (!badges[msg.room_uid]) badges[msg.room_uid] = 1;
        else badges[msg.room_uid]++;
      });

      Object.keys(badges).forEach((key) => {
        instance.AddBadge({ node: $(`[name=btnChat][data-id="${key}"]`), number: badges[key] });
      });
    }
    function onResponse(instance, data) {
      const { room_uid, response } = data;
      const $newMsg = $(`
      <div class="user-event">
        <article>${response}</article>
      </div>
    `);

      const $panel = instance.mainPanel.find(`.cr-panel[data-uid=${room_uid}]`);

      $panel.append($newMsg);
      $newMsg[0].scrollIntoView(instance.#scrollOptions);
    }
    function onUserEvent(instance, data) {
      const { event, author, project_uid, room_uid } = data;

      if (instance.user.uid === author.uid) return;

      switch (event) {
        case 'left':
        case 'joined': {
          const message = `User ${author.email} ${event}`;
          const $newMsg = $(`
            <div class="user-event">
              <span class="message-title">
                <span name="timestamp">${moment(new Date()).format('HH:mm:ss DD/MM/YYYY')}</span>
              </span>
              <article>${message}</article>
            </div>
          `);

          const $panel = instance.mainPanel.find(`.cr-panel[data-uid=${room_uid}]`);
          const $tab = instance.mainPanel.find(`.cr-tab[data-uid=${room_uid}]`);
          const activePanelId = instance.mainPanel.find('.cr-tab.active').attr('data-uid');

          $panel.append($newMsg);
          $newMsg[0].scrollIntoView(instance.#scrollOptions);

          if (activePanelId !== room_uid) {
            $tab.addClass('unread');
            instance.mainPanel.addClass('has-messages');
          }

          break;
        }

        case 'start-typing':
        case 'stop-typing': {
          if (instance.user.uid === author.uid) break;

          let dotAnimationFn;

          const $panel = instance.mainPanel.find(`.cr-panel[data-uid=${room_uid}]`);
          const $tab = instance.mainPanel.find(`.cr-tab[data-uid=${room_uid}]`);
          const activePanelId = instance.mainPanel.find('.cr-tab.active').attr('data-uid');

          // Typing
          if (event.startsWith('start')) {
            if ($panel.find(`[data-usertyping="${author.uid}"]`).length > 0) return;

            const $newMsg = $(`
              <div class="user-event typing" data-usertyping="${author.uid}">
                <article>${`${author.email} typing `}<span class="is-typing"></span></article>
              </div>
            `);

            $panel.append($newMsg);
            $newMsg[0].scrollIntoView(instance.#scrollOptions);

            let dotCount = 0;
            dotAnimationFn = setInterval(() => {
              $newMsg.find('.is-typing').text('...'.slice(0, dotCount));
              dotCount++;
              if (dotCount > 3) dotCount = 0;
            }, 250); // 1/4 sec
          } else {
            clearInterval(dotAnimationFn);
            $panel.find(`[data-usertyping="${author.uid}"]`).remove();
          }

          break;
        }
      }
    }
    function onPeopleInvolved(instance, data) {
      console.log(data);
    }

    // Socket config
    this.socket.on('error', (data) => onError(this, data));
    this.socket.on('handshake', () => onHandshake(this));
    this.socket.on('identified', (data) => onIdentified(data));
    this.socket.on('message', (data) => onMessage(this, data));
    this.socket.on('attachment', (data) => onAttachment(this, data));
    this.socket.on('unreadrooms', (data) => onUnreadRooms(this, data));
    this.socket.on('response', (data) => onResponse(this, data));
    this.socket.on('userevent', (data) => onUserEvent(this, data));
    this.socket.on('allmessages', (data) => onAllMessages(this, data));
    this.socket.on('peopleinvolved', (data) => onPeopleInvolved(this, data));
  }

  // DOM methods
  Render() {
    if ($('#mainChatPanel').length > 0) {
      this.mainPanel.show();
      return;
    }

    const mainPanelHTML = `<div id="mainChatPanel">
      <header>
        <i class="fas fa-message"></i>
        <span>Message Board</span><span class="version cr-badge">beta</span>&nbsp;
        <button name="btnTogglePanel" class="icon"><i class="fas fa-chevron-up" title="Toggle panel"></i></button>
        <button name="btnClosePanel" class="icon"><i class="fas fa-times" title="Close panel"></i></button>
      </header>
      <div class="mainChatContent">
        <span name="not-connected" style="padding: 15px">Not connected to any chat room!</span>
        <div class="cr-tabs"></div>
        <div class="cr-panels"></div>
      </div>
      <footer>
        <input type="text" name="message" placeholder="Type your message here and press ENTER" autofocus />
        <button type="button" class="primary small" name="btnSendMessage" title="Send message"><i class="fas fa-paper-plane"></i></button>
        <button type="button" class="secondary small" name="btnAttach" title="Attach file"><i class="fas fa-paperclip"></i></button>
      </footer>
      <input type="file" name="files" style="display: none" />
    </div>`;

    this.mainPanel = $(mainPanelHTML);
    this.mainPanel.find('footer').hide();

    $('body').append(this.mainPanel);
    this.mainPanel.hide();

    const $btnTogglePanel = this.mainPanel.find('[name=btnTogglePanel]');
    const $btnClosePanel = this.mainPanel.find('[name=btnClosePanel]');
    const $btnSendMessage = this.mainPanel.find('[name=btnSendMessage]');
    const $btnAttach = this.mainPanel.find('[name=btnAttach]');
    const $inputFile = this.mainPanel.find('[name=files]');
    const $txtMessage = this.mainPanel.find('input[name=message]');

    // Chat component DOM events
    this.mainPanel.on('click', '[name=btnCloseTab]', (e) => {
      const room_uid = $(e.currentTarget).closest('[data-uid]').attr('data-uid');
      this.CloseRoom({ room_uid });
    });

    $btnTogglePanel.off('click').on('click', () => {
      this.mainPanel.toggleClass('closed');
      $btnTogglePanel.find('i').toggleClass('fa-chevron-up fa-chevron-down');
    });

    $btnClosePanel.off('click').on('click', () => {
      this.CloseAllRooms();
      this.mainPanel.hide();
    });

    $btnSendMessage.off('click').on('click', (e) => this.SendMessage(e));
    $btnAttach.off('click').on('click', (e) => this.ShowAttachFile(e));
    $txtMessage.off('keyup').on('keyup', (e) => this.SendMessage(e));
    $inputFile.off('change').on('change', (e) => this.AttachFile(e));

    this.mainPanel
      .find('.mainChatContent .cr-tabs')
      .off('click')
      .on('click', '.cr-tab', (e) => this.SwitchRoom(e));
  }

  Destroy() {
    this.mainPanel.remove();
  }

  AddChatButtons({ parent, nodes }) {
    // Add buttons
    const $btn = $('<button type="button" name="btnChat"><i class="fas fa-comment-medical"></i></button>');

    nodes.append($btn);
    nodes.each((i, el) => {
      const id = $(el).closest('tr').attr('id');
      $(el).find('[name=btnChat]').attr('data-id', id);
    });

    // Add button events
    parent.on('click', '[name=btnChat]', (e) => {
      const room_uid = $(e.target).closest('tr').attr('id');
      const title = $(e.target).closest('tr').attr('data-title') || $(e.target).closest('tr').attr('title');
      const cntId =
        $(e.target).closest('tr').find('td:nth-child(2)').text() ||
        $(e.target).closest('tr').find('td:nth-child(3)').text();
      const room_type = $(e.target).closest('tr').attr('data-type');
      const system_id = $(e.target).closest('tr').attr('data-system-id');
      const system_name = $(e.target).closest('tr').attr('data-system-name');

      this.NewRoom({ room_uid, cntId, title, room_type, system_id, system_name });

      $(e.target).closest('tr').find('td:first .cr-badge').remove();
    });
  }

  AddBadge({ node, number }) {
    const currentBadge = node?.find('.cr-badge');
    const badge = new Badge(true); // is absolute?

    badge.value = number || Number(currentBadge?.text() || '0') + 1;
    badge.Refresh();

    if (currentBadge.length > 0) currentBadge.remove();

    node.append(badge.node);
  }

  RemoveBadge({ node }) {
    const currentBadge = node?.find('.cr-badge');
    if (currentBadge?.length > 0) currentBadge?.remove();
  }

  // User methods
  StartTyping(data) {
    this.socket.emit('userevent', { ...data, event: 'start-typing' });
  }

  StopTyping(data) {
    this.socket.emit('userevent', { ...data, event: 'stop-typing' });
  }

  LeaveRoom(data) {
    this.room.active = null;
    this.socket.emit('userevent', { ...data, event: 'left' });
  }

  JoinRoom(data) {
    const { project_uid, room_uid, author, system_id, system_name } = data;
    this.room.active = room_uid;
    this.room.collection[room_uid] = {
      system: {
        id: system_id,
        name: system_name,
      },
    };
    this.socket.emit('userevent', { ...data, event: 'joined' });

    this.ReadRoom({
      room_uid,
      project_uid,
      author_uid: author.uid,
    });
  }

  // Message methods
  SendMessage(e) {
    const $txtMessage = this.mainPanel.find('input[name=message]');
    const data = {
      room_uid: this.mainPanel.find('.cr-tab.active').attr('data-uid'),
      project_uid: this.project_uid,
      title: this.mainPanel.find('.cr-tab.active span').text().trim(),
      message: $txtMessage.val(),
      auth_token: this.auth_token,
      author: this.user,
      extra_info: {
        room_type: this.mainPanel.find('.cr-tab.active').attr('data-type'),
        ...this.room.collection[this.room.active],
      },
    };

    if (e.type === 'click' || e.key === 'Enter') {
      if (!data.message) return;

      $txtMessage.val('');
      $txtMessage.focus();

      // Sends the message
      this.socket.emit('message', data);
      this.StopTyping(data);
    } else {
      if (data.message) this.StartTyping(data);
      else this.StopTyping(data);
    }
  }

  ShowAttachFile(e) {
    this.mainPanel.find('[name=files]').click();
  }

  AttachFile(e) {
    const file = e.target.files[0];
    const fm = new FileMessage(file.name, file.size, file.type, this.user, file);

    const data = {
      room_uid: this.mainPanel.find('.cr-tab.active').attr('data-uid'),
      project_uid: this.project_uid,
      author: this.user,
      attachment: fm.toJSON(),
    };

    const $activePanel = this.mainPanel.find(`.cr-panel[data-uid=${data.room_uid}]`);

    // Preview images
    if (file.type.startsWith('image')) {
      const src = URL.createObjectURL(file);
      fm.node.find('.file-preview').css({ 'background-image': `url(${src})`, width: '48px' });
    }

    fm.node.addClass('mine');
    $activePanel.append(fm.node);
    fm.node[0].scrollIntoView(this.#scrollOptions);

    fm.done = (uid) => {
      data.attachment.uid = uid;
      this.SendAttachment(data);
    };

    fm.remove = function () {
      fm.node.remove();
    };

    fm.uploadFile();
  }

  SendAttachment(data) {
    this.socket.emit('attachment', data);
  }

  GetAllMessages(data) {
    this.socket.emit('getallmessages', data);
  }

  // Rooms methods
  GetUnreadRooms() {
    this.socket.emit('getunreadrooms', { project_uid: this.project_uid, author_uid: this.user.uid });
  }

  ReadRoom(data) {
    this.socket.emit('readroom', data);
  }

  GetPeopleInvolved(data) {
    this.socket.emit('getpeopleinvolved', { ...data, base_url: location.origin });
  }

  NewRoom(data) {
    const { room_uid, title, cntId, room_type, system_id, system_name } = data;

    this.mainPanel.show();

    if (this.mainPanel.find('.mainChatContent .cr-tabs .cr-tab').length === 0)
      this.mainPanel.find('.mainChatContent .cr-tabs').empty();

    if (this.mainPanel.find(`.mainChatContent .cr-tabs .cr-tab[data-uid=${room_uid}]`).length === 1) return;

    const newTabHTML = `<div class="cr-tab" data-uid="${room_uid}" data-type="${room_type}" title="Container ID: ${cntId}\nType: ${room_type}">
                          <section class="cr-tab-label">
                            <span>${title}</span>
                            <button class="icon" name="btnCloseTab">
                              <i class="fas fa-times" title="Close tab"></i>
                            </button>
                          </section>
                        </div>`;

    this.mainPanel.find('.mainChatContent .cr-tabs').append(newTabHTML);
    this.mainPanel.find('[name=not-connected]').remove();
    this.mainPanel.find('footer').css('display', 'grid');
    this.mainPanel.find('.mainChatContent .cr-panels').append(`<div class="cr-panel" data-uid="${room_uid}"></div>`);
    this.mainPanel.find(`.mainChatContent .cr-tabs .cr-tab[data-uid=${room_uid}]`).trigger('click');

    if (this.mainPanel.is('.closed')) this.mainPanel.addClass('has-messages');

    const params = {
      room_uid,
      project_uid: this.project_uid,
      author: this.user,
      room_type,
      system_id,
      system_name,
    };

    this.GetAllMessages({ room_uid, project_uid: this.project_uid });
    this.JoinRoom(params);
  }

  CloseRoom(data) {
    const { room_uid } = data;

    this.mainPanel
      .find(
        `.mainChatContent .cr-tabs .cr-tab[data-uid=${room_uid}], 
         .mainChatContent .cr-panels .cr-panel[data-uid=${room_uid}]`
      )
      .remove();

    const params = {
      room_uid,
      project_uid: this.project_uid,
      author: this.user,
    };

    this.LeaveRoom(params);
  }

  CloseAllRooms() {
    const tabs = this.mainPanel.find('.mainChatContent .cr-tabs .cr-tab');
    const panels = this.mainPanel.find('.mainChatContent .cr-panels .cr-panel');
    const rooms = tabs.toArray().map((el) => el.getAttribute('data-uid'));

    tabs.remove();
    panels.remove();

    rooms.forEach((room_uid) => {
      this.LeaveRoom({
        room_uid,
        project_uid: this.project_uid,
        author: this.user,
      });
    });
  }

  SwitchRoom(e) {
    const $tab = $(e.currentTarget);
    const room_uid = $(e.currentTarget).attr('data-uid');
    const btn = $(`[name=btnChat][data-id="${room_uid}"]`);

    this.mainPanel.find('.mainChatContent .cr-tabs .cr-tab').removeClass('active');
    this.room.active = room_uid;

    $tab.removeClass('unread');
    $tab.addClass('active');

    this.mainPanel.removeClass('has-messages');

    this.mainPanel.find('.mainChatContent .cr-panels .cr-panel').hide();
    this.mainPanel.find(`.mainChatContent .cr-panels .cr-panel[data-uid=${room_uid}]`).show();

    this.RemoveBadge({ node: btn });

    this.mainPanel.find('input').focus();
  }
}
