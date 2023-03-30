export class Badge {
  constructor(absolute) {
    this.node = $(`
    <div class="cr-badge${absolute ? ' absolute' : ''}">
      <span></span>
    </div>`);

    this.value = null;
  }

  Refresh() {
    this.node.find('span').text(this.value);
  }
}
