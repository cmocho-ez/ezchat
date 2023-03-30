// Reads server config from the .env file and sets the variables
import { config } from "dotenv";
import { Router, json, urlencoded } from "express";
import { join, resolve } from "node:path";
import multer from "multer";
import { AttachmentDTO, AttachmentModel } from "../mysql.js";

config();

const router = Router();
const defaultUploadPath = process.env.DEFAULT_UPLOAD_PATH || "upload";

// Set these routes to use JSON body And form data
router.use(json());
router.use(urlencoded({ extended: true }));

/***********************/
/******* FILES  ********/
/***********************/

const uploader = multer({ dest: resolve(defaultUploadPath) });

// POST - Upload file
router.post("/files/upload", uploader.single("file"), async (req, res) => {
  const file = req.file;
  const { author } = req.body;
  const model = new AttachmentModel();
  const dto = new AttachmentDTO();

  model.name_key = file.filename;
  model.original_name = file.originalname;
  model.mime_type = file.mimetype;
  model.filesize = file.size;
  model.author = author;

  try {
    await dto.save(model);
    return res.send(model.name_key);
  } catch (err) {
    return res.status(500).send({
      code: 500,
      message: `Something went wrong: ${err.message}`,
      error: err,
    });
  }
});

// GET - File info by key
router.get("/files/info/:key", async (req, res) => {
  const { key } = req.params;
  const dto = new AttachmentDTO();

  try {
    const file = await dto.get(key);

    if (file) {
      res.json(file);
    } else {
      res.status(404).send({ code: 404, message: "File not found" });
    }
  } catch (err) {
    return res.status(500).send({
      code: 500,
      message: `Something went wrong: ${err.message}`,
      error: err,
    });
  }
});

// GET - Download file by key
router.get("/files/download/:key", async (req, res) => {
  const { key } = req.params;
  const dto = new AttachmentDTO();

  try {
    const file = await dto.get(key);

    if (file) {
      const filepath = join(resolve(defaultUploadPath), file.name_key);

      res.header(
        "Content-Disposition",
        `attachment; filename="${file.original_name}"`
      );
      res.type(file.mime_type).sendFile(filepath);
    } else {
      res.status(404).send({ code: 404, message: "File not found" });
    }
  } catch (err) {
    return res.status(500).send({
      code: 500,
      message: `Something went wrong: ${err.message}`,
      error: err,
    });
  }
});

export default router;
