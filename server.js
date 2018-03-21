'use strict';

const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');
const app = express()
const server = app
  // .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);

let userCount = 0
io.on('connection', (socket) => {
  userCount++
  console.log('a user connected', userCount);
  io.emit("userCount", userCount);
  io.to(socket.id).emit("message", 'your id: ' + socket.id);

  socket.on("disconnect", () => {
    userCount--
    io.emit("userCount", userCount);
    console.log("a user go out", userCount);
  });
  
  socket.on("draw", (data) => {
    socket.broadcast.emit('draw', data); // everyone gets it but the sender
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(INDEX)
})
// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');

// catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   var err = new Error('Not Found');
//   err.status = 404;
//   next(err);
// });

// error handler
// app.use(function(err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });