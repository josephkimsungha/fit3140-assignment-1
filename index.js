const app = require("express")();
const http = require("http").Server(app);
var io = require('socket.io')(http);

app.get("/", function(req, res){
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", socket => {
  console.log("A user connected with id ", socket.id);
  socket.join("the only room", () => {
    socket.on("move", (moveId) => {
      console.log(moveId);
      io.sockets.to("the only room").emit("move", moveId);
    })
  })

  socket.on("disconnect", () => {
    console.log("Disconnect");
  })
})

http.listen(3000, function(){
  console.log("Your game is live at localhost:3000");
});
