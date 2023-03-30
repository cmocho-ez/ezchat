export class FileMessage {
  constructor(name, size, type, author, fileData) {
    this.uid = "";
    this.author = author;
    this.status = size >= MAX_FILE_SIZE ? "error" : "new";
    this.name = name || "";
    this.type = type || "";
    this.size = size ?? 0;
    this.data = fileData;
    this.progress = 0;
    this.uploadDate = new Date();
    this.onClick = null;
    this.html = `
        <div class='file-message ${this.status}'>
          <section class="header">
            <span><i class="fas fa-paperclip"></i>&nbsp;File attachment</span>
            <i class="fas fa-times button" name="btnCancelAttachment" title="Cancel attachment"></i>
            <i class="fas fa-cog fa-spin" name="uploadIndicator" title="Uploading..."></i>
          </section>
          <section class='file-info'>
            <div class='file-preview'></div>
            <div class='data'>
              <span>Sent by ${this.author.email}</span>
              <span>${this.name} - ${bytes(this.size)}</span>
            </div>
          </section>
          <section class='progress-bar'>
            <div class="progress-amount" style="width: ${
              this.status === "error" ? "100%" : "0"
            }"></div>
          </section>
        </div>`;

    this.node = $(this.html);
    this.title = this.node.find('[name="title"]');
    this.btnCancelAttachment = this.node.find("[name=btnCancelAttachment]");
    this.progressIcon = this.node.find("[name=uploadIndicator]");

    this.progressIcon.hide();

    this.btnCancelAttachment.on("click", this.cancelUpload);
  }

  toJSON() {
    return {
      filename: this.name,
      filetype: this.type,
      filesize: this.size,
      author: this.author,
    };
  }

  setProgress(progress) {
    this.progress = progress;
    this.node
      .find(".progress-amount")
      .css({ width: this.progress.toFixed(2) + "%" });
    // this.node.find(".progress-amount").text(this.progress.toFixed(2) + "%");

    if (progress >= 100) {
      this.node.find(".progress-amount").addClass("completed");
      this.progressIcon.hide();

      if (this.status === "error")
        this.node.find(".progress-amount").addClass("error");
      else this.btnCancelAttachment.hide();
    }
  }

  cancelUpload() {
    if (this.xhr) {
      this.xhr.abort();
      return;
    }

    if (this.remove) this.remove();
  }

  uploadFile() {
    if (this.status === "new") {
      this.status = "uploading";
      this.progressIcon.show();

      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      this.xhr = xhr;

      xhr.open("POST", `${API_BASE_URL}/files/upload`, true);
      xhr.upload.addEventListener("progress", e => {
        this.setProgress((e.loaded * 100.0) / e.total);
      });

      xhr.addEventListener("readystatechange", e => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          this.status = "done";
          this.setProgress(100);
          this.uid = xhr.responseText;

          this.node.addClass("done");
          this.node.removeClass("new");

          if (this.done) this.done(this.uid);
        } else if (xhr.readyState === 4 && xhr.status !== 200) {
          this.status = "error";
          this.setProgress(100);

          this.node.addClass("error");
          this.node.removeClass("new");
        }
      });

      formData.append("file", this.data);
      formData.append("author_uid", this.author.uid);

      xhr.send(formData);
    }
  }

  enableClick(filename, src) {
    if (!src) return;

    this.setProgress(100);

    this.node.addClass("clickable");
    this.node.on("click", () => {
      const link = document.createElement("a");

      link.href = src;
      link.download = filename;
      link.click();
    });
  }
}
