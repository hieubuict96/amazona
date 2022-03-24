import multer from 'multer';
import express from 'express';
import { isAuth } from '../utils.js';

const uploadRouter = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/'); //đối số thứ 2 là tên folder chứa file
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}.jpg`); //đối số thứ 2 là tên file
  },
});

const upload = multer({ storage });

uploadRouter.post('/', isAuth, upload.single('image'), (req, res) => { //tên trong single phải trùng với key của phần tử được tải lên. Ở đây phần tử tải lên phải có key là "image", còn trong form thì thuộc tính name của input tải lên phải có giá trị là "image"
  res.send(`/${req.file.path}`);
});

export default uploadRouter;
