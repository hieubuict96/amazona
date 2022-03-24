import express from "express";
import expressAsyncHandler from "express-async-handler"; //module này để không phải xử lý lỗi thủ công mà được tự động xử lý và gửi sang 1 function bên file server
import bcrypt from "bcryptjs";
import data from "../data.js";
import User from "../models/userModel.js";
import { generateToken, isAdmin, isAuth } from "../utils.js";

const userRouter = express.Router();

userRouter.get(
  "/top-sellers",
  expressAsyncHandler(async (req, res) => {
    const topSellers = await User.find({ isSeller: true }) //thực thi liên quan đến database phải dùng async await để chờ xử lý từ database
      .sort({ "seller.rating": -1 }) //sắp xếp seller.rating giảm dần (do giảm dần là -1, tăng dần là 1)
      .limit(3); //giới hạn số lượng truy vấn là 3
    res.send(topSellers);
  })
);

userRouter.get( //seed data từ file bên ngoài và vào thẳng backend không thông qua frontend nhờ phương thức get
  "/seed",
  expressAsyncHandler(async (req, res) => {
    // await User.remove({});
    const createdUsers = await User.insertMany(data.users);
    res.send({ createdUsers }); //createdUsers là mảng các đối tượng được thêm vào từ hàm insertMany(). Ở ví dụ này là mảng data.users
  })
);

userRouter.post( //mỗi lần đăng nhập nó sẽ tạo ra 1 token mới, token ở server chỉ mất khi hết thời gian được cài đặt trong code tạo token, kể cả ta ngắt chạy server
  "/signin",
  expressAsyncHandler(async (req, res) => {
    console.log(req.body.password);
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        //so sánh mật khẩu đã nhập với mật khẩu đã hash trong database
        res.send({
          _id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          isSeller: user.isSeller,
          token: generateToken(user),
        });
        return;
      }
    }
    res.status(401).send({ message: "Invalid email or password" });
  })
);

userRouter.post(
  "/register",
  expressAsyncHandler(async (req, res) => {
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 8), //hash mật khẩu với độ bảo mật là 8. độ bảo mật càng cao hash càng lâu, hashSync là hàm đồng bộ do đó ko cần phải await
    });
    const createdUser = await user.save();
    res.send({
      _id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      isAdmin: createdUser.isAdmin,
      isSeller: user.isSeller,
      token: generateToken(createdUser),
    });
  })
);

userRouter.get(
  "/:id", //request đi từ trên xuống dưới để tìm đường dẫn phù hợp, nếu dưới route này có route dạng /id với id là chuỗi bất kỳ thì vẫn ưu tiên truy cập vào route này hơn
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id); //tìm user dựa vào id được thêm vào trên URL
    if (user) {
      res.send(user);
    } else {
      res.status(404).send({ message: "User Not Found" });
    }
  })
);

userRouter.put(
  "/profile",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (user.isSeller) {
        user.seller.name = req.body.sellerName || user.seller.name;
        user.seller.logo = req.body.sellerLogo || user.seller.logo;
        user.seller.description =
          req.body.sellerDescription || user.seller.description;
      }
      if (req.body.password) {
        user.password = bcrypt.hashSync(req.body.password, 8);
      }
      const updatedUser = await user.save(); //đây là công thức update data được gửi từ client lên server, updatedUser là user được update
      res.send({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        isSeller: user.isSeller,
        token: generateToken(updatedUser),
      });
    }
  })
);

userRouter.get(
  "/",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const users = await User.find({});
    res.send(users);
  })
);

userRouter.delete(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.email === "admin@example.com") {
        res.status(400).send({ message: "Can Not Delete Admin User" });
        return;
      }
      const deleteUser = await user.deleteOne();
      res.send({ message: "User Deleted", user: deleteUser });
    } else {
      res.status(404).send({ message: "User Not Found" });
    }
  })
);

userRouter.put(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.isSeller = Boolean(req.body.isSeller);
      user.isAdmin = Boolean(req.body.isAdmin);
      // user.isAdmin = req.body.isAdmin || user.isAdmin;
      const updatedUser = await user.save();
      res.send({ message: "User Updated", user: updatedUser });
    } else {
      res.status(404).send({ message: "User Not Found" });
    }
  })
);

export default userRouter;
