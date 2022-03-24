import http from "http";
import { Server } from "socket.io";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import productRouter from "./routers/productRouter.js";
import userRouter from "./routers/userRouter.js";
import orderRouter from "./routers/orderRouter.js";
import uploadRouter from "./routers/uploadRouter.js";

dotenv.config();

const app = express();
app.use(express.json()); //Phân tích cú pháp văn bản dưới dạng json
app.use(express.urlencoded({ extended: true })); // urlencoded giúp có thể sử dụng được body x-www-form-urlencoded

mongoose
  .connect(
    // process.env.MONGODB_URL || "mongodb://localhost/amazona"
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PWD}@cluster0.jnoyh.mongodb.net/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`
    , {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => {
    console.log("Database connected");
  });

app.use("/api/uploads", uploadRouter);
app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);
app.get("/api/config/paypal", (req, res) => {
  res.send(process.env.PAYPAL_CLIENT_ID || "sb");
});

app.get("/api/config/google", (req, res) => {
  res.send(process.env.GOOGLE_API_KEY || "");
});

const __dirname = path.resolve(); //trả về đường dẫn tuyệt đối thư mục làm việc hiện tại (thư mục thực hiện lệnh npm start), ở đây là D:\IT\Backend\Nodejs\amazona-master (nó khác với biến môi trường __dirname ở chỗ __dirname là đường dẫn đến thư mục chứa file đang thực thi còn cái này là thư mục làm việc, là thư mục ta thực hiện "npm start", thường là thư mục chứa node_modules và package.json)

app.use("/uploads", express.static(path.join(__dirname, "/uploads"))); //cung cấp cho bên phía trình duyệt hoặc frontend có thể truy cập vào thư mục tĩnh này thông qua đường dẫn                           "http://localhost:5000/uploads/(tên file)" 

app.use(express.static(path.join(__dirname, "/frontend/build"))); //tương tự như trên nhưng trên URL không cần thêm "/uploads"

app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "/frontend/build/index.html")) //res.sendFile để trả về client file được chọn trong ngoặc
);
// app.get('/', (req, res) => {
//   res.send('Server is ready');
// });

app.use((err, req, res, next) => { //tất cả các error bên express-async-handler được đưa vào trong này
  res.status(500).send({ message: err.message });
});

const port = process.env.PORT || 5000;

const httpServer = http.Server(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const users = []; //users là danh sách những users. đặt users ở bên ngoài nhưng vẫn tương tác được bên trong socket.io. users này chỉ trở về giá trị rỗng ban đầu khi restart lại server

io.on("connection", (socket) => { //chỉ cần socketIOClient ở client được gọi là hàm này được gọi
  console.log("connection", socket.id); //mỗi client connect hoặc reconnect thì socket đặt cho nó 1 id khác nhau
  
  socket.on("disconnect", () => { //khi socketIOClient bị ngắt thì hàm có key là "disconnect" này được gọi. Thường xảy ra khi chạy lại trình duyệt hoặc tắt trình duyệt
    const user = users.find((x) => x.socketId === socket.id); //socket tự biết được user nào ngắt kết nối mà ko cần phải gửi từ client nhờ socket.id . socket.id chính là id socket của đơn vị socket ngắt kết nối bên client
    if (user) {
      user.online = false;
      console.log("Offline", user.name);
      const admin = users.find((x) => x.isAdmin && x.online);
      if (admin) {
        io.to(admin.socketId).emit("updateUser", user); //nếu admin đang online thì gửi cho admin thông tin người ngắt kết nối
      }
    }
  });

  socket.on("onLogin", (user) => { //khi mở thanh chat thì socket onLogin được gọi. Thông tin client được gửi về server để xử lý
    const updatedUser = {
      ...user,
      online: true,
      socketId: socket.id,
      messages: [],
    };
    const existUser = users.find((x) => x._id === updatedUser._id);
    if (existUser) {
      existUser.socketId = socket.id; //nếu user đã online trước đó sau khi onLogin lại thì được cập nhật lại socketId
      existUser.online = true;
    } else {
      users.push(updatedUser);
    }
    console.log("Online", user.name);
    const admin = users.find((x) => x.isAdmin && x.online); //users là danh sách những users
    if (admin) { //nếu trong danh sách những users đã online mà có admin thì user mới online này gửi cho admin
      io.to(admin.socketId).emit("updateUser", updatedUser); //gửi cho người có id là admin.socketId thông tin người mới online
    }
    if (updatedUser.isAdmin) {
      io.to(updatedUser.socketId).emit("listUsers", users); //nếu user mới online này mà là admin thì socket gửi cho admin danh sách users
    }
  });

  socket.on("onUserSelected", (user) => {
    const admin = users.find((x) => x.isAdmin && x.online);
    if (admin) {
      const existUser = users.find((x) => x._id === user._id);
      io.to(admin.socketId).emit("selectUser", existUser);
    }
  });

  socket.on("onMessage", (message) => {
    if (message.isAdmin) {
      const user = users.find((x) => x._id === message._id && x.online);
      if (user) {
        io.to(user.socketId).emit("message", message);
        user.messages.push(message);
      }
    } else {
      const admin = users.find((x) => x.isAdmin && x.online);
      if (admin) {
        io.to(admin.socketId).emit("message", message); //gửi cho admin thông tin message
        const user = users.find((x) => x._id === message._id && x.online);
        user.messages.push(message);
      } else {
        io.to(socket.id).emit("message", {
          name: "Admin",
          body: "Sorry. I am not online right now",
        });
      }
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Serve at http://localhost:${port}`);
});

// app.listen(port, () => {
//   console.log(`Serve at http://localhost:${port}`);
// });
